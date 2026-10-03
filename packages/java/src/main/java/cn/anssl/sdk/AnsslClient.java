package cn.anssl.sdk;

import cn.anssl.sdk.api.CertificateOperationsApi;
import cn.anssl.sdk.api.CertificatesApi;
import cn.anssl.sdk.model.ApplyCertificateRequest;
import cn.anssl.sdk.model.CertificateActionData;
import cn.anssl.sdk.model.CertificateDetail;
import cn.anssl.sdk.model.CertificateListData;
import cn.anssl.sdk.model.CertificateOperation;
import cn.anssl.sdk.model.CertificateOperationStatus;
import cn.anssl.sdk.model.CheckDomainData;
import cn.anssl.sdk.model.CheckDomainRequest;
import cn.anssl.sdk.model.DeleteCertificateRequest;
import cn.anssl.sdk.model.RenewCertificateRequest;
import cn.anssl.sdk.model.RevokeCertificateRequest;
import cn.anssl.sdk.model.SubmitCertificateActionRequest;

import java.io.File;
import java.net.http.HttpRequest;
import java.time.Duration;
import java.util.Objects;

/** AnsslClient 是 ANSSL Java SDK 的稳定同步入口。 */
public final class AnsslClient {
    /** certificates 是生成器提供的证书低级 API。 */
    private final CertificatesApi certificates;
    /** operations 是生成器提供的异步操作低级 API。 */
    private final CertificateOperationsApi operations;

    /** 使用生产 API 根地址创建带 Bearer AccessKey 的客户端。 */
    public AnsslClient(String accessKey) {
        this(accessKey, "https://anssl.cn/openapi/v1");
    }

    /** 使用指定 API 根地址创建带 Bearer AccessKey 的客户端。 */
    public AnsslClient(String accessKey, String baseUrl) {
        if (accessKey == null || accessKey.isBlank()) {
            throw new IllegalArgumentException("accessKey must not be empty");
        }
        ApiClient apiClient = new ApiClient();
        apiClient.updateBaseUri(Objects.requireNonNull(baseUrl).replaceAll("/+$", ""));
        apiClient
            .setConnectTimeout(Duration.ofSeconds(30))
            .setReadTimeout(Duration.ofSeconds(30))
            .setRequestInterceptor((HttpRequest.Builder builder) -> builder
                .header("Authorization", "Bearer " + accessKey)
                .header("X-ANSSL-SDK", "java/0.1.0"));
        this.certificates = new CertificatesApi(apiClient);
        this.operations = new CertificateOperationsApi(apiClient);
    }

    /** 查询当前用户的证书分页列表。 */
    public CertificateListData listCertificates(Integer page, Integer size, String keyword, cn.anssl.sdk.model.CertificateStatus status) throws ApiException {
        return certificates.listCertificates(page, size, keyword, status).getData();
    }

    /** 查询指定 certKey 的证书详情。 */
    public CertificateDetail getCertificate(String certKey) throws ApiException {
        return certificates.getCertificate(certKey).getData();
    }

    /** 查询 DNS-01 CNAME 记录和解析状态。 */
    public CheckDomainData checkDomains(CheckDomainRequest request) throws ApiException {
        return certificates.checkCertificateDomains(request).getData();
    }

    /** 下载 tar 或 JSON 格式的证书内容到临时文件。 */
    public File downloadCertificate(String certKey, String format) throws ApiException {
        return certificates.downloadCertificate(certKey, format);
    }

    /** 提交新证书申请，写操作不会被透明重试。 */
    public CertificateActionData applyCertificate(ApplyCertificateRequest request) throws ApiException {
        return submit(new SubmitCertificateActionRequest(request));
    }

    /** 提交证书续订，写操作不会被透明重试。 */
    public CertificateActionData renewCertificate(RenewCertificateRequest request) throws ApiException {
        return submit(new SubmitCertificateActionRequest(request));
    }

    /** 提交证书吊销，写操作不会被透明重试。 */
    public CertificateActionData revokeCertificate(RevokeCertificateRequest request) throws ApiException {
        return submit(new SubmitCertificateActionRequest(request));
    }

    /** 同步删除 ANSSL 平台证书记录。 */
    public CertificateActionData deleteCertificate(DeleteCertificateRequest request) throws ApiException {
        return submit(new SubmitCertificateActionRequest(request));
    }

    /** 调用复用的生命周期端点并返回 envelope data。 */
    private CertificateActionData submit(SubmitCertificateActionRequest request) throws ApiException {
        return certificates.submitCertificateAction(request).getData();
    }

    /** 查询请求操作所在自动重试链的最新节点。 */
    public CertificateOperation getOperation(String operationId) throws ApiException {
        return operations.getCertificateOperation(operationId).getData();
    }

    /** 轮询异步操作直到终态或超过总等待时间。 */
    public CertificateOperation waitOperation(String operationId, Duration interval, Duration timeout) throws ApiException, InterruptedException {
        Duration effectiveInterval = interval == null ? Duration.ofSeconds(2) : interval;
        Duration effectiveTimeout = timeout == null ? Duration.ofMinutes(10) : timeout;
        long deadline = System.nanoTime() + effectiveTimeout.toNanos();
        while (true) {
            CertificateOperation operation = getOperation(operationId);
            CertificateOperationStatus status = operation.getStatus();
            if (status == CertificateOperationStatus.SUCCEEDED || status == CertificateOperationStatus.FAILED || status == CertificateOperationStatus.CANCELED) {
                return operation;
            }
            if (System.nanoTime() + effectiveInterval.toNanos() > deadline) {
                throw new IllegalStateException("operation wait timed out");
            }
            Thread.sleep(effectiveInterval.toMillis());
        }
    }
}
