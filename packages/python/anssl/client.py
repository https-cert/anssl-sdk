"""Stable high-level facade for the generated ANSSL Python client."""

from __future__ import annotations

import time
from typing import Optional

from anssl.api.certificate_operations_api import CertificateOperationsApi
from anssl.api.certificates_api import CertificatesApi
from anssl.api_client import ApiClient
from anssl.configuration import Configuration
from anssl.models.apply_certificate_request import ApplyCertificateRequest
from anssl.models.certificate_action_data import CertificateActionData
from anssl.models.certificate_detail import CertificateDetail
from anssl.models.certificate_list_data import CertificateListData
from anssl.models.certificate_operation import CertificateOperation
from anssl.models.certificate_operation_status import CertificateOperationStatus
from anssl.models.certificate_status import CertificateStatus
from anssl.models.check_domain_data import CheckDomainData
from anssl.models.check_domain_request import CheckDomainRequest
from anssl.models.delete_certificate_request import DeleteCertificateRequest
from anssl.models.renew_certificate_request import RenewCertificateRequest
from anssl.models.revoke_certificate_request import RevokeCertificateRequest
from anssl.models.submit_certificate_action_request import SubmitCertificateActionRequest


class AnsslClient:
    """ANSSL Python SDK 的稳定同步客户端。"""

    def __init__(self, access_key: str, base_url: str = "https://anssl.cn/openapi/v1") -> None:
        """使用非空 AccessKey 和可选 API 根地址创建客户端。"""
        if not access_key.strip():
            raise ValueError("access_key must not be empty")
        self._api_client = ApiClient(Configuration(host=base_url.rstrip("/"), access_token=access_key))
        self._api_client.user_agent = "anssl-python/0.1.0"
        self.certificates = CertificatesApi(self._api_client)
        self.operations = CertificateOperationsApi(self._api_client)

    def list_certificates(self, page: int = 1, size: int = 20, keyword: Optional[str] = None, status: Optional[CertificateStatus] = None) -> CertificateListData:
        """查询当前用户的证书分页列表并返回 envelope data。"""
        return self.certificates.list_certificates(page=page, size=size, keyword=keyword, status=status).data

    def get_certificate(self, cert_key: str) -> CertificateDetail:
        """查询指定 certKey 的证书详情。"""
        return self.certificates.get_certificate(cert_key).data

    def check_domains(self, request: CheckDomainRequest) -> CheckDomainData:
        """查询 DNS-01 CNAME 记录和解析状态。"""
        return self.certificates.check_certificate_domains(request).data

    def download_certificate(self, cert_key: str, format: str = "tar") -> bytes:
        """下载 tar 或 JSON 格式的证书原始字节。"""
        return self.certificates.download_certificate(cert_key, format=format)

    def apply_certificate(self, request: ApplyCertificateRequest) -> CertificateActionData:
        """提交新证书申请，写操作不会被透明重试。"""
        return self._submit(SubmitCertificateActionRequest(actual_instance=request))

    def renew_certificate(self, request: RenewCertificateRequest) -> CertificateActionData:
        """提交证书续订，写操作不会被透明重试。"""
        return self._submit(SubmitCertificateActionRequest(actual_instance=request))

    def revoke_certificate(self, request: RevokeCertificateRequest) -> CertificateActionData:
        """提交证书吊销，写操作不会被透明重试。"""
        return self._submit(SubmitCertificateActionRequest(actual_instance=request))

    def delete_certificate(self, request: DeleteCertificateRequest) -> CertificateActionData:
        """同步删除 ANSSL 平台证书记录。"""
        return self._submit(SubmitCertificateActionRequest(actual_instance=request))

    def _submit(self, request: SubmitCertificateActionRequest) -> CertificateActionData:
        """调用复用的生命周期端点并返回 envelope data。"""
        return self.certificates.submit_certificate_action(request).data

    def get_operation(self, operation_id: str) -> CertificateOperation:
        """查询请求操作所在自动重试链的最新节点。"""
        return self.operations.get_certificate_operation(operation_id).data

    def wait_operation(self, operation_id: str, interval: float = 2.0, timeout: float = 600.0) -> CertificateOperation:
        """轮询异步操作直到终态或超过总等待时间。"""
        deadline = time.monotonic() + timeout
        while True:
            operation = self.get_operation(operation_id)
            if operation.status in {
                CertificateOperationStatus.SUCCEEDED,
                CertificateOperationStatus.FAILED,
                CertificateOperationStatus.CANCELED,
            }:
                return operation
            if time.monotonic() + interval > deadline:
                raise TimeoutError("operation wait timed out")
            time.sleep(interval)

    def close(self) -> None:
        """关闭底层连接池并释放网络资源。"""
        self._api_client.rest_client.pool_manager.clear()

    def __enter__(self) -> "AnsslClient":
        """进入上下文管理器并返回当前客户端。"""
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        """退出上下文管理器时关闭底层连接池。"""
        self.close()
