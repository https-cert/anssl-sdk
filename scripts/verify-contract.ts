import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** ContractSource 描述 SDK 快照记录的 canonical 合同来源。 */
interface ContractSource {
  /** contractVersion 是公开 HTTP 合同版本。 */
  contractVersion: string;
  /** openapiVersion 是规范格式版本。 */
  openapiVersion: string;
  /** backendRepository 是 canonical 合同所在仓库。 */
  backendRepository: string;
  /** backendRevision 是同步时记录的后端基线提交。 */
  backendRevision: string;
  /** backendPath 是 canonical 合同在后端仓库中的路径。 */
  backendPath: string;
  /** sha256 是当前 SDK 合同快照的 SHA-256。 */
  sha256: string;
  /** syncedAt 是合同同步时间。 */
  syncedAt: string;
  /** status 表示来源是否已经提交为不可变基线。 */
  status: string;
}

const root = resolve(import.meta.dir, "..");

/** sha256 计算字节内容的小写十六进制 SHA-256。 */
function sha256(content: Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

/** main 验证合同元数据、规范格式和快照哈希一致。 */
async function main(): Promise<void> {
  const source = JSON.parse(
    await readFile(resolve(root, "openapi/source.json"), "utf8"),
  ) as ContractSource;
  const specification = await readFile(resolve(root, "openapi/anssl.openapi.yaml"));
  const actual = sha256(specification);
  if (source.openapiVersion !== "3.0.3") throw new Error(`不支持的 OpenAPI 版本: ${source.openapiVersion}`);
  if (source.contractVersion !== "1.0.0") throw new Error(`不支持的合同版本: ${source.contractVersion}`);
  if (actual !== source.sha256) throw new Error(`合同 SHA-256 不一致: expected=${source.sha256} actual=${actual}`);
  console.log(`Contract ${source.contractVersion} verified: ${actual}`);
}

await main();
