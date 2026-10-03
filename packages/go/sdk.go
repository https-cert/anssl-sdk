package anssl

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client 是 ANSSL Go SDK 的稳定入口。
type Client struct {
	api       *APIClient // api 是生成器提供的低级客户端。
	accessKey string     // accessKey 是开放平台服务端凭据。
}

// ClientOptions 配置 ANSSL Go SDK。
type ClientOptions struct {
	AccessKey  string       // AccessKey 是开放平台颁发的服务端凭据。
	BaseURL    string       // BaseURL 是可选 API 根地址。
	HTTPClient *http.Client // HTTPClient 是可选自定义 HTTP 客户端。
}

// ListOptions 配置证书列表分页和筛选。
type ListOptions struct {
	Page    int32              // Page 是从 1 开始的可选页码。
	Size    int32              // Size 是 1 到 100 的可选页大小。
	Keyword string             // Keyword 是可选主域名关键词。
	Status  *CertificateStatus // Status 是可选证书状态。
}

// WaitOptions 配置异步操作轮询。
type WaitOptions struct {
	Interval time.Duration // Interval 是轮询间隔，零值使用 2 秒。
	Timeout  time.Duration // Timeout 是总等待时间，零值使用 10 分钟。
}

// NewClient 创建带 Bearer 鉴权的 ANSSL 客户端。
func NewClient(options ClientOptions) (*Client, error) {
	if strings.TrimSpace(options.AccessKey) == "" {
		return nil, fmt.Errorf("accessKey 不能为空")
	}
	cfg := NewConfiguration()
	if options.BaseURL != "" {
		cfg.Servers[0].URL = strings.TrimRight(options.BaseURL, "/")
	}
	if options.HTTPClient != nil {
		cfg.HTTPClient = options.HTTPClient
	}
	cfg.UserAgent = "anssl-go/0.1.0"
	return &Client{api: NewAPIClient(cfg), accessKey: options.AccessKey}, nil
}

// authContext 把 AccessKey 注入生成器使用的请求上下文。
func (c *Client) authContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, ContextAccessToken, c.accessKey)
}

// ListCertificates 查询当前用户的证书分页列表。
func (c *Client) ListCertificates(ctx context.Context, options ListOptions) (*CertificateListData, error) {
	request := c.api.CertificatesAPI.ListCertificates(c.authContext(ctx))
	if options.Page > 0 {
		request = request.Page(options.Page)
	}
	if options.Size > 0 {
		request = request.Size(options.Size)
	}
	if options.Keyword != "" {
		request = request.Keyword(options.Keyword)
	}
	if options.Status != nil {
		request = request.Status(*options.Status)
	}
	response, _, err := request.Execute()
	if err != nil {
		return nil, err
	}
	return &response.Data, nil
}

// GetCertificate 查询指定 certKey 的证书详情。
func (c *Client) GetCertificate(ctx context.Context, certKey string) (*CertificateDetail, error) {
	response, _, err := c.api.CertificatesAPI.GetCertificate(c.authContext(ctx), certKey).Execute()
	if err != nil {
		return nil, err
	}
	return &response.Data, nil
}

// CheckDomains 查询 DNS-01 CNAME 记录和解析状态。
func (c *Client) CheckDomains(ctx context.Context, request CheckDomainRequest) (*CheckDomainData, error) {
	response, _, err := c.api.CertificatesAPI.CheckCertificateDomains(c.authContext(ctx)).CheckDomainRequest(request).Execute()
	if err != nil {
		return nil, err
	}
	return &response.Data, nil
}

// DownloadCertificate 下载 tar 或 JSON 格式的证书内容到临时文件。
func (c *Client) DownloadCertificate(ctx context.Context, certKey string, format string) (*os.File, error) {
	request := c.api.CertificatesAPI.DownloadCertificate(c.authContext(ctx), certKey)
	if format != "" {
		request = request.Format(format)
	}
	file, _, err := request.Execute()
	if err != nil {
		return nil, err
	}
	return file, nil
}

// ApplyCertificate 提交新证书申请。
func (c *Client) ApplyCertificate(ctx context.Context, request ApplyCertificateRequest) (*CertificateActionData, error) {
	wrapped := ApplyCertificateRequestAsSubmitCertificateActionRequest(&request)
	return c.submit(ctx, wrapped)
}

// RenewCertificate 提交证书续订。
func (c *Client) RenewCertificate(ctx context.Context, request RenewCertificateRequest) (*CertificateActionData, error) {
	wrapped := RenewCertificateRequestAsSubmitCertificateActionRequest(&request)
	return c.submit(ctx, wrapped)
}

// RevokeCertificate 提交证书吊销。
func (c *Client) RevokeCertificate(ctx context.Context, request RevokeCertificateRequest) (*CertificateActionData, error) {
	wrapped := RevokeCertificateRequestAsSubmitCertificateActionRequest(&request)
	return c.submit(ctx, wrapped)
}

// DeleteCertificate 删除 ANSSL 平台证书记录。
func (c *Client) DeleteCertificate(ctx context.Context, request DeleteCertificateRequest) (*CertificateActionData, error) {
	wrapped := DeleteCertificateRequestAsSubmitCertificateActionRequest(&request)
	return c.submit(ctx, wrapped)
}

// submit 调用复用的生命周期操作端点并解包 data。
func (c *Client) submit(ctx context.Context, request SubmitCertificateActionRequest) (*CertificateActionData, error) {
	response, _, err := c.api.CertificatesAPI.SubmitCertificateAction(c.authContext(ctx)).SubmitCertificateActionRequest(request).Execute()
	if err != nil {
		return nil, err
	}
	return &response.Data, nil
}

// GetOperation 查询请求操作所在重试链的最新节点。
func (c *Client) GetOperation(ctx context.Context, operationID string) (*CertificateOperation, error) {
	response, _, err := c.api.CertificateOperationsAPI.GetCertificateOperation(c.authContext(ctx), operationID).Execute()
	if err != nil {
		return nil, err
	}
	return &response.Data, nil
}

// WaitOperation 轮询异步操作直到终态、超时或上下文取消。
func (c *Client) WaitOperation(ctx context.Context, operationID string, options WaitOptions) (*CertificateOperation, error) {
	interval := options.Interval
	if interval <= 0 {
		interval = 2 * time.Second
	}
	timeout := options.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	for {
		operation, err := c.GetOperation(ctx, operationID)
		if err != nil {
			return nil, err
		}
		switch operation.Status {
		case CERTIFICATEOPERATIONSTATUS_SUCCEEDED, CERTIFICATEOPERATIONSTATUS_FAILED, CERTIFICATEOPERATIONSTATUS_CANCELED:
			return operation, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline.C:
			return nil, context.DeadlineExceeded
		case <-time.After(interval):
		}
	}
}
