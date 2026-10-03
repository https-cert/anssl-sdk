# ANSSL C# SDK

ANSSL 官方 C# SDK，NuGet 包名为 `Anssl`，目标框架为 .NET 8。

```csharp
var client = new AnsslClient(Environment.GetEnvironmentVariable("ANSSL_ACCESS_KEY")!);
var certificates = await client.ListCertificatesAsync();
```

`AnsslClient` 是稳定异步 facade；`Anssl.Api` 提供生成的完整低级端点。生命周期写操作不会透明重试，调用方应提供 `requestKey`。轮询方法支持 `CancellationToken`。

测试与打包：`dotnet test tests/Anssl.Tests/Anssl.Tests.csproj && dotnet pack src/Anssl/Anssl.csproj -c Release`
