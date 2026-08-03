"""本体可视化编辑器 后端入口（FastAPI）。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .api import admin as admin_api
from .api import auth as auth_api
from .api import file as file_api
from .api import folder as folder_api
from .api import project as project_api
from .api import template as template_api
from .database import Base, engine
from .mcp_auth import ensure_mcp_token, get_mcp_token, verify_mcp_token
from .mcp_server import mcp as mcp_server


def migrate() -> None:
    """轻量迁移：为旧数据库补充新增列（create_all 不会修改已有表）。"""
    with engine.connect() as conn:
        proj_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(projects)"))]
        if "folder_id" not in proj_cols:
            conn.execute(text("ALTER TABLE projects ADD COLUMN folder_id VARCHAR(64)"))
        if "user_id" not in proj_cols:
            conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(64)"))
        folder_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(folders)"))]
        if "user_id" not in folder_cols:
            conn.execute(text("ALTER TABLE folders ADD COLUMN user_id VARCHAR(64)"))
        conn.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 启动时创建数据表并执行迁移
    Base.metadata.create_all(bind=engine)
    migrate()
    # 确保 MCP 令牌存在（自动生成并写入 backend/.mcp_token）
    if get_mcp_token() is None:
        ensure_mcp_token()
        print("[mcp] 已生成 MCP 访问令牌 -> backend/.mcp_token", flush=True)
    # MCP 会话管理器生命周期
    async with mcp_app.lifespan(_):
        yield


app = FastAPI(
    title="CostOntology Editor API",
    description="通用 OWL 本体可视化编辑器后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# 开发环境跨域（前端 Vite dev server 通过 /api 代理访问时不需要，直接访问时需要）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "cost-ontology-editor"}


app.include_router(project_api.router)
app.include_router(file_api.router)
app.include_router(folder_api.router)
app.include_router(auth_api.router)
app.include_router(template_api.router)
app.include_router(admin_api.router)

# MCP（Model Context Protocol）服务挂载：http://localhost:8000/mcp
mcp_app = mcp_server.http_app(path="/")
app.mount("/mcp", mcp_app)


@app.middleware("http")
async def mcp_auth_middleware(request: Request, call_next):
    """MCP 端点令牌认证：Authorization: Bearer <token>（未配置令牌时不启用）。"""
    if request.url.path.startswith("/mcp") and request.method != "OPTIONS":
        if not verify_mcp_token(request.headers.get("authorization")):
            return JSONResponse(status_code=401, content={"detail": "无效的 MCP 令牌"})
    return await call_next(request)
