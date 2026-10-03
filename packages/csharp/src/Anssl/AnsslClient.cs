using System;
using System.Threading;
using System.Threading.Tasks;
using Anssl.Api;
using Anssl.Client;
using Anssl.Model;

namespace Anssl
{
    /// <summary>ANSSL C# SDK 的稳定异步入口。</summary>
    public sealed class AnsslClient
    {
        /// <summary>生成器提供的证书低级 API。</summary>
        private readonly CertificatesApi _certificates;

        /// <summary>生成器提供的异步操作低级 API。</summary>
        private readonly CertificateOperationsApi _operations;

        /// <summary>使用非空 AccessKey 和可选 API 根地址创建客户端。</summary>
        public AnsslClient(string accessKey, string baseUrl = "https://anssl.cn/openapi/v1")
        {
            if (string.IsNullOrWhiteSpace(accessKey))
            {
                throw new ArgumentException("accessKey must not be empty", nameof(accessKey));
            }
            var configuration = new Configuration
            {
                BasePath = baseUrl.TrimEnd('/'),
                AccessToken = accessKey,
                UserAgent = "anssl-csharp/0.1.0",
                Timeout = TimeSpan.FromSeconds(30),
            };
            _certificates = new CertificatesApi(configuration);
            _operations = new CertificateOperationsApi(configuration);
        }

        /// <summary>查询当前用户的证书分页列表。</summary>
        public async Task<CertificateListData> ListCertificatesAsync(int page = 1, int size = 20, string? keyword = null, CertificateStatus? status = null, CancellationToken cancellationToken = default)
        {
            return (await _certificates.ListCertificatesAsync(page, size, keyword, status, cancellationToken)).Data;
        }

        /// <summary>查询指定 certKey 的证书详情。</summary>
        public async Task<CertificateDetail> GetCertificateAsync(string certKey, CancellationToken cancellationToken = default)
        {
            return (await _certificates.GetCertificateAsync(certKey, cancellationToken)).Data;
        }

        /// <summary>查询 DNS-01 CNAME 记录和解析状态。</summary>
        public async Task<CheckDomainData> CheckDomainsAsync(CheckDomainRequest request, CancellationToken cancellationToken = default)
        {
            return (await _certificates.CheckCertificateDomainsAsync(request, cancellationToken)).Data;
        }

        /// <summary>下载 tar 或 JSON 格式的证书内容。</summary>
        public Task<FileParameter> DownloadCertificateAsync(string certKey, string format = "tar", CancellationToken cancellationToken = default)
        {
            return _certificates.DownloadCertificateAsync(certKey, format, cancellationToken);
        }

        /// <summary>提交生命周期操作，写操作不会被透明重试。</summary>
        public async Task<CertificateActionData> SubmitCertificateActionAsync(SubmitCertificateActionRequest request, CancellationToken cancellationToken = default)
        {
            return (await _certificates.SubmitCertificateActionAsync(request, cancellationToken)).Data;
        }

        /// <summary>查询请求操作所在自动重试链的最新节点。</summary>
        public async Task<CertificateOperation> GetOperationAsync(string operationId, CancellationToken cancellationToken = default)
        {
            return (await _operations.GetCertificateOperationAsync(operationId, cancellationToken)).Data;
        }

        /// <summary>轮询异步操作直到终态、超时或被取消。</summary>
        public async Task<CertificateOperation> WaitOperationAsync(string operationId, TimeSpan? interval = null, TimeSpan? timeout = null, CancellationToken cancellationToken = default)
        {
            var effectiveInterval = interval ?? TimeSpan.FromSeconds(2);
            using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutSource.CancelAfter(timeout ?? TimeSpan.FromMinutes(10));
            while (true)
            {
                var operation = await GetOperationAsync(operationId, timeoutSource.Token);
                if (operation.Status is CertificateOperationStatus.Succeeded or CertificateOperationStatus.Failed or CertificateOperationStatus.Canceled)
                {
                    return operation;
                }
                await Task.Delay(effectiveInterval, timeoutSource.Token);
            }
        }
    }
}
