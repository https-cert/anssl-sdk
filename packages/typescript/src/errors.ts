import { FetchError, RequiredError, ResponseError } from "./generated/src/runtime";

/** ErrorEnvelope 描述 ANSSL 非 2xx JSON 错误体。 */
interface ErrorEnvelope {
  /** code 与响应 HTTP 状态保持一致。 */
  code?: number;
  /** message 是服务端返回的可读错误信息。 */
  message?: string;
}

/** AnsslApiError 是所有已收到 HTTP 响应的 SDK 错误基类。 */
export class AnsslApiError extends Error {
  /** status 是 HTTP 状态码。 */
  readonly status: number;
  /** code 是响应 envelope 中的数字错误码。 */
  readonly code: number;
  /** body 是解析后的原始错误体。 */
  readonly body: unknown;

  /** constructor 保存稳定错误字段，调用方不需要解析 message。 */
  constructor(status: number, code: number, message: string, body?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** AnsslBadRequestError 表示 400 请求参数错误。 */
export class AnsslBadRequestError extends AnsslApiError {}
/** AnsslAuthenticationError 表示 401 AccessKey 错误。 */
export class AnsslAuthenticationError extends AnsslApiError {}
/** AnsslNotFoundError 表示 404 资源不存在。 */
export class AnsslNotFoundError extends AnsslApiError {}
/** AnsslConflictError 表示 409 状态或幂等冲突。 */
export class AnsslConflictError extends AnsslApiError {}
/** AnsslRateLimitError 表示 429 限流。 */
export class AnsslRateLimitError extends AnsslApiError {}
/** AnsslServerError 表示服务端 5xx 错误。 */
export class AnsslServerError extends AnsslApiError {}

/** AnsslTransportError 表示超时、取消、DNS、TLS 或其他无 HTTP 响应错误。 */
export class AnsslTransportError extends Error {
  /** cause 保存底层运行时错误。 */
  override readonly cause: unknown;

  /** constructor 包装底层传输错误并保留 cause。 */
  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "AnsslTransportError";
    this.cause = cause;
  }
}

/** mapSdkError 将生成器异常转换为稳定的 ANSSL SDK 错误族。 */
export async function mapSdkError(error: unknown): Promise<never> {
  if (error instanceof AnsslApiError || error instanceof AnsslTransportError) throw error;
  if (error instanceof RequiredError) {
    throw new AnsslBadRequestError(400, 400, error.message, { field: error.field });
  }
  if (error instanceof ResponseError) {
    const response = error.response;
    let body: ErrorEnvelope | undefined;
    try {
      body = (await response.clone().json()) as ErrorEnvelope;
    } catch {
      body = undefined;
    }
    const code = body?.code ?? response.status;
    const message = body?.message ?? `ANSSL request failed with HTTP ${response.status}`;
    const ErrorType = errorTypeForStatus(response.status);
    throw new ErrorType(response.status, code, message, body);
  }
  if (error instanceof FetchError) throw new AnsslTransportError(error.message, error.cause);
  throw new AnsslTransportError("ANSSL request failed before receiving a response", error);
}

/** errorTypeForStatus 返回 HTTP 状态对应的稳定错误构造器。 */
function errorTypeForStatus(status: number): typeof AnsslApiError {
  if (status === 400) return AnsslBadRequestError;
  if (status === 401) return AnsslAuthenticationError;
  if (status === 404) return AnsslNotFoundError;
  if (status === 409) return AnsslConflictError;
  if (status === 429) return AnsslRateLimitError;
  if (status >= 500) return AnsslServerError;
  return AnsslApiError;
}
