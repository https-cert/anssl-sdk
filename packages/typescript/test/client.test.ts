import { describe, expect, test } from "bun:test";
import { AnsslClient, AnsslNotFoundError } from "../src";

/** jsonResponse 创建带 JSON content-type 的标准 Fetch 响应。 */
function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("AnsslClient", () => {
  /** list 验证 facade 注入 Bearer 头并只返回 envelope data。 */
  test("list injects authentication and unwraps data", async () => {
    let authorization = "";
    const client = new AnsslClient({
      accessKey: "test-key",
      fetch: async (_input, init) => {
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return jsonResponse({ code: 0, message: "success", data: { certs: [], total: 0, page: 1, size: 20 } });
      },
    });

    const result = await client.certificates.list();

    expect(authorization).toBe("Bearer test-key");
    expect(result).toEqual({ certs: [], total: 0, page: 1, size: 20 });
  });

  /** get 验证标准 404 envelope 被映射为稳定错误类型。 */
  test("maps 404 responses", async () => {
    const client = new AnsslClient({
      accessKey: "test-key",
      fetch: async () => jsonResponse({ code: 404, message: "证书不存在" }, 404),
    });

    expect(client.certificates.get("missing")).rejects.toBeInstanceOf(AnsslNotFoundError);
  });

  /** list 验证 GET 在 429 后按 Retry-After 有限重试。 */
  test("retries safe GET after 429", async () => {
    let calls = 0;
    const client = new AnsslClient({
      accessKey: "test-key",
      fetch: async () => {
        calls += 1;
        if (calls === 1) return jsonResponse({ code: 429, message: "限流" }, 429, { "retry-after": "0" });
        return jsonResponse({ code: 0, message: "success", data: { certs: [], total: 0, page: 1, size: 20 } });
      },
    });

    await client.certificates.list();

    expect(calls).toBe(2);
  });

  /** wait 验证操作轮询在最新节点进入终态后结束。 */
  test("waits until operation reaches a terminal state", async () => {
    let calls = 0;
    const client = new AnsslClient({
      accessKey: "test-key",
      fetch: async () => {
        calls += 1;
        const status = calls === 1 ? "running" : "succeeded";
        return jsonResponse({
          code: 0,
          message: "success",
          data: {
            requestedOperationId: "1",
            operationId: "2",
            certKey: "cert-test",
            type: "apply",
            status,
            requestKey: "request-test",
            attempt: 1,
            maxAttempts: 3,
            createdAt: "2026-07-17T00:00:00Z",
            updatedAt: "2026-07-17T00:00:00Z",
          },
        });
      },
    });

    const result = await client.operations.wait("1", { intervalMs: 1, timeoutMs: 100 });

    expect(String(result.status)).toBe("succeeded");
    expect(calls).toBe(2);
  });
});
