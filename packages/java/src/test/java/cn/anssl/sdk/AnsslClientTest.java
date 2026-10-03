package cn.anssl.sdk;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

/** AnsslClientTest 验证稳定 Java facade 的本地参数约束。 */
class AnsslClientTest {
    /** emptyAccessKeyFailsBeforeNetwork 验证空凭据不会进入网络层。 */
    @Test
    void emptyAccessKeyFailsBeforeNetwork() {
        assertThrows(IllegalArgumentException.class, () -> new AnsslClient("  "));
    }
}

