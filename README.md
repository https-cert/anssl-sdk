# ANSSL SDK

ANSSL 官方 SDK。六种语言共享同一份 OpenAPI 合同，每个包都提供一个简单的稳定客户端；生成代码只负责底层 HTTP 和数据模型。

| 语言 | 包目录 | 客户端入口 |
| --- | --- | --- |
| TypeScript/JavaScript | `packages/typescript` | `AnsslClient` |
| Go | `packages/go` | `NewClient` |
| Python | `packages/python` | `AnsslClient` |
| Java | `packages/java` | `AnsslClient` |
| PHP | `packages/php` | `AnsslClient` |
| C# | `packages/csharp` | `AnsslClient` |

安装和调用示例见各包自己的 `README.md`。

## 开发

根目录只负责编排 OpenAPI 合同和代码生成：

```bash
bun install --frozen-lockfile
bun run check
bun run generate
```

修改 `openapi/anssl.openapi.yaml` 或 `generator/*.json` 后重新生成，再运行对应语言的原生测试。CI 会验证合同、生成结果和六个包。

## 合同

`openapi/anssl.openapi.yaml` 是后端合同快照，来源版本和 SHA-256 记录在 `openapi/source.json`。当前来源标记为 `working-tree`，在后端发布不可变合同 bundle 前不得描述为已发布合同。

生成目录不得手工修改。OpenAPI Generator 版本固定在 `openapitools.json`；生成脚本先写入 `work/generated/`，再只同步各包需要的运行源码，因此不会覆盖手写客户端、测试或包元数据。

所有包使用 Apache License 2.0。版本、提交、标签和发布均由维护者按语言手动处理。
