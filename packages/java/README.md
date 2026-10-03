# ANSSL Java SDK

ANSSL 官方 Java SDK，Maven 坐标为 `cn.anssl:anssl-sdk`，运行时要求 Java 11 或更高版本。

```java
AnsslClient client = new AnsslClient(System.getenv("ANSSL_ACCESS_KEY"));
CertificateListData certificates = client.listCertificates(1, 20, null, null);
```

`AnsslClient` 是稳定同步 facade；`cn.anssl.sdk.api` 提供生成的完整低级端点。生命周期写操作不会透明重试，调用方应提供 `requestKey`。

测试：`./gradlew test --no-daemon --max-workers=1`
