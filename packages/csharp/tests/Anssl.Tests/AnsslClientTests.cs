using System;
using Xunit;

namespace Anssl.Tests
{
    /// <summary>验证稳定 C# facade 的本地参数约束。</summary>
    public sealed class AnsslClientTests
    {
        /// <summary>空 AccessKey 必须在任何网络请求前被拒绝。</summary>
        [Fact]
        public void EmptyAccessKeyFailsBeforeNetwork()
        {
            Assert.Throws<ArgumentException>(() => new AnsslClient("  "));
        }
    }
}
