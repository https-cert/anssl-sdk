package anssl

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestNewClientRejectsBlankAccessKey 验证纯空格凭据不会进入网络层。
func TestNewClientRejectsBlankAccessKey(t *testing.T) {
	if _, err := NewClient(ClientOptions{AccessKey: "  "}); err == nil {
		t.Fatal("空 AccessKey 应返回错误")
	}
}

// TestListCertificatesInjectsBearerAndUnwrapsData 验证 Go facade 注入鉴权并返回 data。
func TestListCertificatesInjectsBearerAndUnwrapsData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("Authorization=%q, want Bearer test-key", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"message":"success","data":{"certs":[],"total":0,"page":1,"size":20}}`))
	}))
	defer server.Close()

	client, err := NewClient(ClientOptions{AccessKey: "test-key", BaseURL: server.URL})
	if err != nil {
		t.Fatalf("创建客户端失败: %v", err)
	}
	data, err := client.ListCertificates(context.Background(), ListOptions{})
	if err != nil {
		t.Fatalf("查询证书失败: %v", err)
	}
	if data.Total != 0 || data.Page != 1 || data.Size != 20 {
		t.Fatalf("列表数据异常: %+v", data)
	}
}
