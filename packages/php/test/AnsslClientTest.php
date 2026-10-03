<?php
/** Tests for the stable ANSSL PHP facade. */

namespace Anssl\Test;

use Anssl\AnsslClient;
use PHPUnit\Framework\TestCase;

/** AnsslClientTest 验证稳定 facade 的本地参数约束。 */
final class AnsslClientTest extends TestCase
{
    /** testEmptyAccessKeyFailsBeforeNetwork 验证空凭据不会进入网络层。 */
    public function testEmptyAccessKeyFailsBeforeNetwork(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new AnsslClient('  ');
    }
}

