"""本体可视化编辑器 后端入口（FastAPI）。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .api import auth as auth_api
from .api import file as file_api
from .api import folder as folder_api
from .api import project as project_api
from .database import Base, engine


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
