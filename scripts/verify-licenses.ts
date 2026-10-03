import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const packageNames = ["typescript", "go", "python", "java", "php", "csharp"] as const;

/** main 验证所有发布单元携带与仓库根完全一致的 Apache-2.0 许可证。 */
async function main(): Promise<void> {
  const canonical = await readFile(resolve(root, "LICENSE"));
  for (const packageName of packageNames) {
    const packageLicense = await readFile(resolve(root, "packages", packageName, "LICENSE"));
    if (!canonical.equals(packageLicense)) {
      throw new Error(`packages/${packageName}/LICENSE 与根 LICENSE 不一致`);
    }
  }
  console.log(`Verified Apache-2.0 license copies for ${packageNames.length} SDK packages.`);
}

await main();
