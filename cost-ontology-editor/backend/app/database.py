"""数据库连接配置（SQLite，开发友好，零配置）。"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 数据文件默认放在 backend 目录下，可通过环境变量覆盖
DB_PATH = os.environ.get("COST_ONTOLOGY_DB", os.path.join(os.path.dirname(os.path.dirname(__file__)), "cost_ontology.db"))

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},  # FastAPI 多线程访问 SQLite 需要
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI 依赖：每请求一个数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
