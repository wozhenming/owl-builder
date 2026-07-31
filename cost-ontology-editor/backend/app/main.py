"""CostOntology Editor 后端入口（FastAPI）。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import file as file_api
from .api import project as project_api
from .database import Base, engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 启动时创建数据表
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="CostOntology Editor API",
    description="公路工程造价本体可视化编辑器后端服务",
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
