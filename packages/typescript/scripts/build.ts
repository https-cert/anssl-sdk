import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dir, "..");
const output = resolve(packageRoot, "dist");
const entrypoint = resolve(packageRoot, "src/index.ts");

/** assertBuild 把 Bun bundler 的结构化日志转换为构建失败。 */
function assertBuild(result: Bun.BuildOutput, format: string): void {
  if (result.success) return;
  for (const log of result.logs) console.error(log);
  throw new Error(`${format} bundle build failed`);
}

/** emitDeclarations 使用锁定的 TypeScript 编译器生成可导航声明文件。 */
async function emitDeclarations(): Promise<void> {
  const process = Bun.spawn(
    ["node", "node_modules/typescript/lib/tsc.js", "-p", "tsconfig.build.json"],
    { cwd: packageRoot, stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`declaration build failed with exit code ${exitCode}`);
}

/** main 清理旧产物并生成 ESM、CommonJS 和类型声明。 */
async function main(): Promise<void> {
  await rm(output, { recursive: true, force: true });
  assertBuild(await Bun.build({
    entrypoints: [entrypoint],
    outdir: output,
    naming: "index.js",
    format: "esm",
    target: "browser",
    sourcemap: "external",
  }), "ESM");
  assertBuild(await Bun.build({
    entrypoints: [entrypoint],
    outdir: output,
    naming: "index.cjs",
    format: "cjs",
    target: "node",
    sourcemap: "external",
  }), "CommonJS");
  await emitDeclarations();
}

await main();
