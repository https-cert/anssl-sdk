# ANSSL Go SDK

ANSSL 官方 Go SDK，module 为 `github.com/https-cert/anssl-sdk/packages/go`，要求 Go 1.23 或更高版本。

```go
client, err := anssl.NewClient(anssl.ClientOptions{
    AccessKey: os.Getenv("ANSSL_ACCESS_KEY"),
})
if err != nil {
    log.Fatal(err)
}

certificates, err := client.ListCertificates(context.Background(), anssl.ListOptions{})
```

`Client` 是稳定 facade；同包内生成的 `APIClient` 提供完整低级端点。生命周期写操作不会透明重试，调用方应提供 `requestKey`。异步操作使用字符串 ID，并可通过 `WaitOperation` 等待重试链最新节点进入终态。

测试：`go test ./...`
