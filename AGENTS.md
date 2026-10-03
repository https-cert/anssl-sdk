# 仓库协作指南

## 项目定位

本仓库是 ANSSL 官方多语言 SDK monorepo。所有语言 SDK 共用同一份经过校验的 OpenAPI 合同快照，但必须能够独立测试、独立版本和独立发布。

## 工具约定

- 根目录任务和 TypeScript/JavaScript 包优先使用 Bun。
- 不要在完成改动后自动执行 `git commit` 或 `git push`，提交和推送由维护者手动完成。
- 需要建议提交信息时，使用中文，并保留 Conventional Commits 前缀。

## 代码约定

- 所有手写方法和测试方法必须有说明用途、约束或边界条件的注释。
- 所有手写结构体、接口数据结构和 DTO 的字段必须有注释。
- 生成代码不得手动修改；生成目录必须带有生成来源说明，并通过 CI 校验可重复生成。
- 不得提交真实 AccessKey、证书私钥或其他生产凭据。

## 合同约定

- `openapi/anssl.openapi.yaml` 是后端 canonical 规范的哈希跟踪快照；来源仍为未提交工作树时，不得把它描述为已发布合同。
- canonical OpenAPI 规范归属于 ANSSL 后端仓库；本仓库只消费后端发布的不可变 bundle，并记录来源版本与 SHA-256。
- 合同变更必须先通过 lint、breaking-change 检查和后端合同测试，再重新生成受影响的 SDK。

## Go 1.27 标准库依赖

Go SDK 使用 Go 1.27。涉及 UUID 和 JSON 时，统一使用标准库实现：

- UUID 使用标准库 `uuid` 包，禁止新增第三方 UUID 包的直接引用。
- JSON 使用 `encoding/json/v2`；流式读写使用 `json.MarshalWrite`、`json.UnmarshalRead`，原始 JSON 使用 `jsontext.Value`。
- OpenAPI Generator 仍会输出旧 JSON API；`scripts/generate.ts` 必须在同步 Go SDK 前执行可重复的迁移步骤，禁止只手动改生成结果。
