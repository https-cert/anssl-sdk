# ANSSL PHP SDK

ANSSL 官方 PHP SDK，Composer 包名为 `anssl/sdk`，要求 PHP 8.2 或更高版本。

```php
<?php

use Anssl\AnsslClient;

$client = new AnsslClient($_ENV['ANSSL_ACCESS_KEY']);
$certificates = $client->listCertificates();
```

`AnsslClient` 是稳定同步 facade；`Anssl\Api` 提供生成的完整低级端点。生命周期写操作不会透明重试，调用方应提供 `requestKey`。

测试：`composer test`
