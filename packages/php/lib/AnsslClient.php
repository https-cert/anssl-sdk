<?php
/**
 * ANSSL PHP SDK stable facade.
 */

namespace Anssl;

use Anssl\Api\CertificateOperationsApi;
use Anssl\Api\CertificatesApi;
use Anssl\Model\CertificateOperation;
use Anssl\Model\CheckDomainData;
use Anssl\Model\CheckDomainRequest;
use Anssl\Model\SubmitCertificateActionRequest;

/** AnsslClient 是 ANSSL PHP SDK 的稳定同步入口。 */
final class AnsslClient
{
    /** @var CertificatesApi $certificates 证书低级 API。 */
    private CertificatesApi $certificates;

    /** @var CertificateOperationsApi $operations 异步操作低级 API。 */
    private CertificateOperationsApi $operations;

    /** 使用非空 AccessKey 和可选 API 根地址创建客户端。 */
    public function __construct(string $accessKey, string $baseUrl = 'https://anssl.cn/openapi/v1')
    {
        if (trim($accessKey) === '') {
            throw new \InvalidArgumentException('accessKey must not be empty');
        }
        $configuration = Configuration::getDefaultConfiguration()
            ->setAccessToken($accessKey)
            ->setHost(rtrim($baseUrl, '/'))
            ->setUserAgent('anssl-php/0.1.0');
        $this->certificates = new CertificatesApi(null, $configuration);
        $this->operations = new CertificateOperationsApi(null, $configuration);
    }

    /** 查询当前用户的证书分页列表并返回 envelope data。 */
    public function listCertificates(int $page = 1, int $size = 20, ?string $keyword = null, $status = null)
    {
        return $this->certificates->listCertificates($page, $size, $keyword, $status)->getData();
    }

    /** 查询指定 certKey 的证书详情。 */
    public function getCertificate(string $certKey)
    {
        return $this->certificates->getCertificate($certKey)->getData();
    }

    /** 查询 DNS-01 CNAME 记录和解析状态。 */
    public function checkDomains(CheckDomainRequest $request): CheckDomainData
    {
        return $this->certificates->checkCertificateDomains($request)->getData();
    }

    /** 下载 tar 或 JSON 格式的证书内容到临时文件。 */
    public function downloadCertificate(string $certKey, string $format = 'tar'): \SplFileObject
    {
        return $this->certificates->downloadCertificate($certKey, $format);
    }

    /** 提交生命周期操作，写操作不会被透明重试。 */
    public function submitCertificateAction(SubmitCertificateActionRequest $request)
    {
        return $this->certificates->submitCertificateAction($request)->getData();
    }

    /** 查询请求操作所在自动重试链的最新节点。 */
    public function getOperation(string $operationId): CertificateOperation
    {
        return $this->operations->getCertificateOperation($operationId)->getData();
    }

    /** 轮询异步操作直到终态或超过总等待时间。 */
    public function waitOperation(string $operationId, float $intervalSeconds = 2.0, float $timeoutSeconds = 600.0): CertificateOperation
    {
        $deadline = microtime(true) + $timeoutSeconds;
        while (true) {
            $operation = $this->getOperation($operationId);
            if (in_array((string) $operation->getStatus(), ['succeeded', 'failed', 'canceled'], true)) {
                return $operation;
            }
            if (microtime(true) + $intervalSeconds > $deadline) {
                throw new \RuntimeException('operation wait timed out');
            }
            usleep((int) ($intervalSeconds * 1_000_000));
        }
    }
}
