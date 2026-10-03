import { CertificateOperationsApi, CertificatesApi } from "./generated/src/apis";
import {
  DownloadCertificateFormatEnum,
  type ListCertificatesRequest,
} from "./generated/src/apis/CertificatesApi";
import type {
  CertificateActionData,
  CertificateDetail,
  CertificateDownload,
  CertificateListData,
  CertificateOperation,
  CheckDomainData,
  CheckDomainRequest,
  SubmitCertificateActionRequest,
} from "./generated/src/models";
import { Configuration, type FetchAPI } from "./generated/src/runtime";
import { mapSdkError } from "./errors";

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const TERMINAL_OPERATION_STATUSES = new Set(["succeeded", "failed", "canceled"]);

/** AnsslClientOptions 配置 ANSSL SDK 的认证、网络和重试行为。 */
export interface AnsslClientOptions {
  /** accessKey 是开放平台颁发的服务端凭据。 */
  accessKey: string;
  /** baseUrl 是可选 API 根地址，默认生产 v1。 */
  baseUrl?: string;
  /** fetch 是可选的标准 Fetch 实现。 */
  fetch?: FetchAPI;
  /** timeoutMs 是单次请求超时，默认 30000 毫秒。 */
  timeoutMs?: number;
  /** maxGetRetries 是安全 GET 的最大重试次数，默认 3。 */
  maxGetRetries?: number;
}

/** DownloadedCertificate 描述 tar 下载结果及响应元数据。 */
export interface DownloadedCertificate {
  /** data 是 tar 文件的原始字节。 */
  data: Uint8Array;
  /** filename 是 Content-Disposition 提供的可选文件名。 */
  filename?: string;
  /** contentType 是服务端响应媒体类型。 */
  contentType: string;
}

/** WaitForOperationOptions 配置异步操作轮询。 */
export interface WaitForOperationOptions {
  /** intervalMs 是轮询间隔，默认 2000 毫秒。 */
  intervalMs?: number;
  /** timeoutMs 是总等待时间，默认 10 分钟。 */
  timeoutMs?: number;
  /** signal 用于主动取消等待。 */
  signal?: AbortSignal;
}

/** ApplyCertificateInput 描述新证书申请的友好输入。 */
export interface ApplyCertificateInput {
  /** domains 是一个到一百个不重复域名。 */
  domains: string[];
  /** ca 是可选证书颁发机构。 */
  ca?: "LetsEncrypt" | "ZeroSSL" | "Google" | "SSLCom" | "Actalis";
  /** keyAlgorithm 是可选公开密钥算法。 */
  keyAlgorithm?: "EC256" | "EC384" | "RSA2048" | "RSA4096";
  /** verificationType 是可选 ACME 验证方式。 */
  verificationType?: "dns" | "http";
  /** requestKey 是可选用户范围幂等键。 */
  requestKey?: string;
}

/** CertificateManageInput 描述续订或吊销证书所需输入。 */
export interface CertificateManageInput {
  /** certKey 是目标证书外部标识。 */
  certKey: string;
  /** requestKey 是可选用户范围幂等键。 */
  requestKey?: string;
}

/** DeleteCertificateInput 描述同步删除平台证书记录所需输入。 */
export interface DeleteCertificateInput {
  /** certKey 是目标证书外部标识。 */
  certKey: string;
}

/** CertificatesResource 提供证书查询、验证、生命周期操作和下载。 */
export class CertificatesResource {
  /** api 是生成器提供的低级证书 API。 */
  private readonly api: CertificatesApi;

  /** constructor 绑定共享的生成器配置。 */
  constructor(configuration: Configuration) {
    this.api = new CertificatesApi(configuration);
  }

  /** list 查询当前用户的证书分页列表。 */
  async list(params: ListCertificatesRequest = {}): Promise<CertificateListData> {
    return this.execute(async () => (await this.api.listCertificates(params)).data);
  }

  /** get 查询指定 certKey 的证书详情。 */
  async get(certKey: string): Promise<CertificateDetail> {
    return this.execute(async () => (await this.api.getCertificate({ certKey })).data);
  }

  /** checkDomains 查询 DNS-01 CNAME 记录和解析状态。 */
  async checkDomains(request: { certKey?: string; domains: string[] }): Promise<CheckDomainData> {
    const generatedRequest = { ...request, domains: new Set(request.domains) } as CheckDomainRequest;
    return this.execute(async () => (await this.api.checkCertificateDomains({ checkDomainRequest: generatedRequest })).data);
  }

  /** apply 提交新证书申请。 */
  async apply(request: ApplyCertificateInput): Promise<CertificateActionData> {
    return this.submit({ ...request, action: "apply", domains: new Set(request.domains) } as SubmitCertificateActionRequest);
  }

  /** renew 提交证书续订。 */
  async renew(request: CertificateManageInput): Promise<CertificateActionData> {
    return this.submit({ ...request, action: "renew" } as SubmitCertificateActionRequest);
  }

  /** revoke 提交证书吊销。 */
  async revoke(request: CertificateManageInput): Promise<CertificateActionData> {
    return this.submit({ ...request, action: "revoke" } as SubmitCertificateActionRequest);
  }

  /** delete 删除 ANSSL 平台证书记录，不向 CA 吊销证书。 */
  async delete(request: DeleteCertificateInput): Promise<CertificateActionData> {
    return this.submit({ ...request, action: "delete" } as SubmitCertificateActionRequest);
  }

  /** downloadTar 下载 tar 格式证书并保留文件名和媒体类型。 */
  async downloadTar(certKey: string): Promise<DownloadedCertificate> {
    return this.execute(async () => {
      const response = await this.api.downloadCertificateRaw({ certKey, format: DownloadCertificateFormatEnum.tar });
      const blob = await response.value();
      const filename = parseFilename(response.raw.headers.get("content-disposition"));
      const result: DownloadedCertificate = {
        data: new Uint8Array(await blob.arrayBuffer()),
        contentType: response.raw.headers.get("content-type") ?? "application/x-tar",
      };
      if (filename !== undefined) result.filename = filename;
      return result;
    });
  }

  /** downloadJson 下载 JSON 格式证书和私钥内容。 */
  async downloadJson(certKey: string): Promise<CertificateDownload> {
    return this.execute(async () => {
      const response = await this.api.downloadCertificateRaw({ certKey, format: DownloadCertificateFormatEnum.json });
      const body = JSON.parse(await (await response.value()).text()) as { data: CertificateDownload };
      return body.data;
    });
  }

  /** submit 调用复用的生命周期操作端点并返回 data。 */
  private async submit(request: SubmitCertificateActionRequest): Promise<CertificateActionData> {
    return this.execute(async () => (
      await this.api.submitCertificateAction({ submitCertificateActionRequest: request })
    ).data);
  }

  /** execute 统一映射生成器和网络错误。 */
  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      return await mapSdkError(error);
    }
  }
}

/** OperationsResource 提供异步操作查询和等待能力。 */
export class OperationsResource {
  /** api 是生成器提供的低级操作 API。 */
  private readonly api: CertificateOperationsApi;

  /** constructor 绑定共享的生成器配置。 */
  constructor(configuration: Configuration) {
    this.api = new CertificateOperationsApi(configuration);
  }

  /** get 查询请求操作所在重试链的最新节点。 */
  async get(operationId: string): Promise<CertificateOperation> {
    try {
      return (await this.api.getCertificateOperation({ operationId })).data;
    } catch (error) {
      return await mapSdkError(error);
    }
  }

  /** wait 轮询异步操作直到终态、超时或被取消。 */
  async wait(operationId: string, options: WaitForOperationOptions = {}): Promise<CertificateOperation> {
    const intervalMs = options.intervalMs ?? 2_000;
    const timeoutMs = options.timeoutMs ?? 600_000;
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (options.signal?.aborted) throw options.signal.reason;
      const operation = await this.get(operationId);
      if (TERMINAL_OPERATION_STATUSES.has(operation.status)) return operation;
      if (Date.now() + intervalMs > deadline) throw new DOMException("Operation wait timed out", "TimeoutError");
      await sleep(intervalMs, options.signal);
    }
  }
}

/** AnsslClient 是 ANSSL TypeScript SDK 的稳定入口。 */
export class AnsslClient {
  /** certificates 提供证书相关操作。 */
  readonly certificates: CertificatesResource;
  /** operations 提供异步操作查询和等待。 */
  readonly operations: OperationsResource;

  /** constructor 验证配置并建立共享鉴权和网络策略。 */
  constructor(options: AnsslClientOptions) {
    if (!options.accessKey.trim()) throw new TypeError("accessKey must not be empty");
    const fetchApi = createPolicyFetch(
      options.fetch ?? globalThis.fetch,
      options.timeoutMs ?? 30_000,
      options.maxGetRetries ?? 3,
    );
    const configuration = new Configuration({
      accessToken: options.accessKey,
      basePath: (options.baseUrl ?? "https://anssl.cn/openapi/v1").replace(/\/+$/, ""),
      fetchApi,
      headers: { "X-ANSSL-SDK": "typescript/0.1.0" },
    });
    this.certificates = new CertificatesResource(configuration);
    this.operations = new OperationsResource(configuration);
  }
}

/** createRequestKey 创建适合生命周期写操作的 UUID v4 幂等键。 */
export function createRequestKey(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}-${id}` : id;
}

/** createPolicyFetch 为安全 GET 添加超时、取消和有限重试。 */
function createPolicyFetch(fetchApi: FetchAPI, timeoutMs: number, maxRetries: number): FetchAPI {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? "GET").toUpperCase();
    const retryCount = method === "GET" ? Math.max(0, maxRetries) : 0;
    for (let attempt = 0; ; attempt += 1) {
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
      const signals = init?.signal ? [init.signal, timeoutController.signal] : [timeoutController.signal];
      try {
        const response = await fetchApi(input, { ...init, signal: AbortSignal.any(signals) });
        if (attempt >= retryCount || !RETRYABLE_STATUSES.has(response.status)) return response;
        await sleep(retryDelayMs(response, attempt), init?.signal ?? undefined);
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

/** retryDelayMs 根据 Retry-After 或指数退避计算 GET 重试等待时间。 */
function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1_000;
  return Math.min(250 * 2 ** attempt, 2_000);
}

/** sleep 等待指定毫秒并支持 AbortSignal 取消。 */
function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/** parseFilename 从 Content-Disposition 中提取简单 filename 参数。 */
function parseFilename(contentDisposition: string | null): string | undefined {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}
