import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/** SupportedLanguage 是生成脚本允许操作的 SDK 语言标识。 */
type SupportedLanguage = "typescript" | "go" | "python" | "java" | "php" | "csharp";

/** GeneratorTarget 描述单个语言生成器的固定配置。 */
interface GeneratorTarget {
  /** generator 是 OpenAPI Generator 的生成器名称。 */
  generator: string;
  /** config 是相对仓库根目录的生成器配置文件。 */
  config: string;
  /** gitRepoId 是生成器使用的仓库内路径。 */
  gitRepoId: string;
}

const root = resolve(import.meta.dir, "..");
const specification = resolve(root, "openapi/anssl.openapi.yaml");
const targets: Record<SupportedLanguage, GeneratorTarget> = {
  typescript: { generator: "typescript-fetch", config: "generator/typescript.json", gitRepoId: "anssl-sdk" },
  go: { generator: "go", config: "generator/go.json", gitRepoId: "anssl-sdk/packages/go" },
  python: { generator: "python", config: "generator/python.json", gitRepoId: "anssl-sdk" },
  java: { generator: "java", config: "generator/java.json", gitRepoId: "anssl-sdk" },
  php: { generator: "php", config: "generator/php.json", gitRepoId: "anssl-sdk" },
  csharp: { generator: "csharp", config: "generator/csharp.json", gitRepoId: "anssl-sdk" },
};

/** parseLanguages 解析命令行参数并返回需要生成的语言列表。 */
function parseLanguages(args: string[]): SupportedLanguage[] {
  if (args.length === 0 || args.includes("--all")) return Object.keys(targets) as SupportedLanguage[];
  const requested = args.filter((arg): arg is SupportedLanguage => arg in targets);
  if (requested.length > 0) return requested;
  throw new Error(`不支持的 SDK 语言: ${args.join(", ")}`);
}

/** replaceDirectory 用全新生成目录替换目标目录，避免遗留已经删除的模型。 */
async function replaceDirectory(source: string, target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}

/** replaceDirectoryPreserving 替换生成源码，同时恢复明确列出的手写文件。 */
async function replaceDirectoryPreserving(source: string, target: string, preservedPaths: string[]): Promise<void> {
  for (const relativePath of preservedPaths) {
    const destination = resolve(source, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(target, relativePath), destination);
  }

  await replaceDirectory(source, target);
}

/** migrateGeneratedGoSources 将 OpenAPI Generator 的 Go 输出适配到 Go 1.27 标准 JSON API。 */
async function migrateGeneratedGoSources(staging: string): Promise<void> {
  for (const entry of await readdir(staging, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".go")) continue;

    const path = resolve(staging, entry.name);
    let content = await readFile(path, "utf8");
    if (!content.includes('"encoding/json"')) continue;

    content = content.replaceAll('"encoding/json"', '"encoding/json/v2"');
    content = content.replace(
      /\tdecoder := json\.NewDecoder\(bytes\.NewReader\(data\)\)\n\tdecoder\.DisallowUnknownFields\(\)\n\terr = decoder\.Decode\(([^\n]+)\)/g,
      "\terr = json.Unmarshal(data, $1, json.RejectUnknownMembers(true))",
    );
    content = content.replace(
      /err = newStrictDecoder\(data\)\.Decode\(([^\n]+)\)/g,
      "err = json.Unmarshal(data, $1, json.RejectUnknownMembers(true))",
    );
    content = content.replace(
      'err = json.NewEncoder(bodyBuf).Encode(body)',
      'err = json.MarshalWrite(bodyBuf, body)\n\t\tif err == nil {\n\t\t\t_, err = bodyBuf.WriteString("\\n")\n\t\t}',
    );
    content = content.replace(
      /\/\/ A wrapper for strict JSON decoding\nfunc newStrictDecoder\(data \[\]byte\) \*json\.Decoder \{\n\tdec := json\.NewDecoder\(bytes\.NewBuffer\(data\)\)\n\tdec\.DisallowUnknownFields\(\)\n\treturn dec\n\}/,
      "// strictDecoder 保持生成联合模型的 Decode 调用形状，并启用 v2 的未知字段校验。\ntype strictDecoder struct {\n\tdata []byte\n}\n\n// Decode 将单个 JSON 值严格解析到目标结构。\nfunc (d strictDecoder) Decode(out any) error {\n\treturn json.Unmarshal(d.data, out, json.RejectUnknownMembers(true))\n}\n\n// newStrictDecoder 创建生成联合模型使用的严格 JSON 解码器。\nfunc newStrictDecoder(data []byte) strictDecoder {\n\treturn strictDecoder{data: data}\n}",
    );
    if (!content.includes("bytes.")) content = content.replace('\t"bytes"\n', "");
    await writeFile(path, content);
  }

  const modulePath = resolve(staging, "go.mod");
  try {
    const module = await readFile(modulePath, "utf8");
    await writeFile(modulePath, module.replace(/^go \d+\.\d+$/m, "go 1.27"));
  } catch {
    // 生成器在异常情况下可能不产生 go.mod；源码同步仍由后续步骤处理。
  }
}

/** formatGeneratedGoSources 统一格式化生成结果，避免生成器输出未格式化的 Go 文件。 */
async function formatGeneratedGoSources(staging: string): Promise<void> {
  const entries = await readdir(staging, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".go"))
    .map((entry) => resolve(staging, entry.name));
  if (files.length === 0) return;

  const process = Bun.spawn(["gofmt", "-w", ...files], { cwd: staging });
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`gofmt 格式化 Go SDK 失败，退出码 ${exitCode}`);
}

/** syncGoSources 替换生成的 Go 文件，同时保留手写 facade 和测试。 */
async function syncGoSources(staging: string): Promise<void> {
  const target = resolve(root, "packages/go");
  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".go")) continue;
    const targetFile = resolve(target, entry.name);
    const content = await readFile(targetFile, "utf8");
    if (content.includes("Code generated by OpenAPI Generator")) {
      await rm(targetFile);
    }
  }

  for (const entry of await readdir(staging, { withFileTypes: true })) {
    const isGeneratedSource = entry.isFile() && entry.name.endsWith(".go");
    const isModuleFile = entry.isFile() && (entry.name === "go.mod" || entry.name === "go.sum");
    if (isGeneratedSource || isModuleFile) {
      await copyFile(resolve(staging, entry.name), resolve(target, entry.name));
    }
  }
  await formatGeneratedGoSources(target);
}

/** syncGeneratedSources 只把各语言运行时需要的生成源码同步到发布包。 */
async function syncGeneratedSources(language: SupportedLanguage, staging: string): Promise<void> {
  switch (language) {
    case "typescript":
      await replaceDirectory(resolve(staging, "src"), resolve(root, "packages/typescript/src/generated/src"));
      return;
    case "go":
      await syncGoSources(staging);
      return;
    case "python":
      await replaceDirectoryPreserving(resolve(staging, "anssl"), resolve(root, "packages/python/anssl"), ["client.py"]);
      return;
    case "java":
      await replaceDirectoryPreserving(
        resolve(staging, "src/main/java/cn/anssl/sdk"),
        resolve(root, "packages/java/src/main/java/cn/anssl/sdk"),
        ["AnsslClient.java"],
      );
      return;
    case "php":
      await replaceDirectoryPreserving(resolve(staging, "lib"), resolve(root, "packages/php/lib"), ["AnsslClient.php"]);
      return;
    case "csharp":
      await replaceDirectoryPreserving(resolve(staging, "src/Anssl"), resolve(root, "packages/csharp/src/Anssl"), [
        "AnsslClient.cs",
        "Anssl.csproj",
      ]);
  }
}

/** generateLanguage 在临时目录完整生成单个语言，再同步必要源码。 */
async function generateLanguage(language: SupportedLanguage): Promise<void> {
  const target = targets[language];
  const staging = resolve(root, "work/generated", language);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const command = [
    "bunx",
    "openapi-generator-cli",
    "generate",
    "-i",
    specification,
    "-g",
    target.generator,
    "-o",
    staging,
    "-c",
    resolve(root, target.config),
    "--global-property",
    "apiDocs=false,modelDocs=false,apiTests=false,modelTests=false",
    "--git-user-id",
    "https-cert",
    "--git-repo-id",
    target.gitRepoId,
  ];
  const process = Bun.spawn(command, {
    cwd: root,
    env: { ...Bun.env, JAVA_OPTS: Bun.env.JAVA_OPTS ?? "-Xms64m -Xmx512m" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`${language} 生成失败，退出码 ${exitCode}\n${stdout}${stderr}`);
  }

  if (language === "go") {
    await migrateGeneratedGoSources(staging);
    await formatGeneratedGoSources(staging);
  }
  await syncGeneratedSources(language, staging);
  await rm(staging, { recursive: true, force: true });
}

/** main 按固定顺序生成请求的语言，并在首个失败处停止。 */
async function main(): Promise<void> {
  for (const language of parseLanguages(Bun.argv.slice(2))) {
    console.log(`Generating ${language} SDK...`);
    await generateLanguage(language);
  }
  await rm(resolve(root, "work/generated"), { recursive: true, force: true });
}

await main();
