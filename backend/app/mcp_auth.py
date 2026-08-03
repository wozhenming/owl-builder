"""MCP 令牌认证。

令牌来源（优先级）：
1. 环境变量 COST_ONTOLOGY_MCP_TOKEN
2. backend/.mcp_token 文件（首次启动自动生成随机令牌并落盘）

未配置令牌时认证不启用（向后兼容）；配置后：
- HTTP 端点 /mcp 必须携带 Authorization: Bearer <token>
- stdio 模式通过 --token <token> 参数校验
"""

import os
import secrets
from pathlib import Path

TOKEN_FILE = Path(__file__).resolve().parent.parent / ".mcp_token"


def get_mcp_token() -> str | None:
    env = os.environ.get("COST_ONTOLOGY_MCP_TOKEN")
    if env:
        return env.strip()
    try:
        if TOKEN_FILE.exists():
            token = TOKEN_FILE.read_text(encoding="utf-8").strip()
            if token:
                return token
    except OSError:
        pass
    return None


def ensure_mcp_token() -> str:
    """确保令牌存在（未配置时生成随机令牌写入文件），返回当前令牌。"""
    token = get_mcp_token()
    if token:
        return token
    token = secrets.token_urlsafe(32)
    try:
        TOKEN_FILE.write_text(token, encoding="utf-8")
    except OSError:
        pass  # 写入失败仅影响后续进程的令牌一致性
    return token


def verify_mcp_token(authorization: str | None, provided: str | None = None) -> bool:
    """校验令牌。未配置令牌时返回 True（不启用认证）。"""
    expected = get_mcp_token()
    if not expected:
        return True
    candidate = provided
    if candidate is None and authorization:
        # 支持 Authorization: Bearer <token> 或直接传 token
        if authorization.lower().startswith("bearer "):
            candidate = authorization.split(" ", 1)[1].strip()
        else:
            candidate = authorization.strip()
    return bool(candidate) and secrets.compare_digest(candidate, expected)
