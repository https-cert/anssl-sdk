"""Tests for the stable ANSSL Python facade."""

from unittest.mock import patch

from anssl.client import AnsslClient
from anssl.models.certificate_operation import CertificateOperation
from anssl.models.certificate_operation_status import CertificateOperationStatus


def test_client_rejects_empty_access_key() -> None:
    """空 AccessKey 必须在任何网络请求前被拒绝。"""
    try:
        AnsslClient("  ")
    except ValueError:
        return
    raise AssertionError("empty access key should fail")


def test_wait_operation_accepts_generated_terminal_enum() -> None:
    """生成器返回的字符串枚举进入终态后必须立即结束轮询。"""
    client = AnsslClient("test-key")
    operation = CertificateOperation.model_construct(status=CertificateOperationStatus.SUCCEEDED)
    try:
        with patch.object(client, "get_operation", return_value=operation):
            assert client.wait_operation("1", interval=0, timeout=0) is operation
    finally:
        client.close()
