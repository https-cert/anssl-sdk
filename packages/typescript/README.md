# @anssl/sdk

ANSSL 官方 TypeScript/JavaScript SDK。支持 Node.js 22+、Bun 1.3+ 和现代浏览器；AccessKey 默认应只在可信服务端环境使用。

```ts
import { AnsslClient, createRequestKey } from "@anssl/sdk";

const client = new AnsslClient({ accessKey: process.env.ANSSL_ACCESS_KEY! });
const result = await client.certificates.apply({
  domains: ["example.com"],
  ca: "LetsEncrypt",
  keyAlgorithm: "EC256",
  verificationType: "dns",
  requestKey: createRequestKey("apply"),
});

if (result.operationId) {
  await client.operations.wait(result.operationId);
}
```

生命周期写操作不会被透明重试。调用方应传入 requestKey，以便在网络结果不确定时安全地重新提交。
