"""
Подключение к базе данных.

MVP использует SQLite (файл board.db рядом с проектом) — ноль настройки.
Для переноса в закрытый контур достаточно заменить DATABASE_URL на строку
подключения к корпоративному PostgreSQL, например:
    postgresql+psycopg://user:password@db-host:5432/board_portal
и добавить psycopg в requirements.txt. Модели SQLAlchemy совместимы с обоими.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./board.db")

engine = create_engine(
    DATABASE_URL,
    # check_same_thread нужен только для SQLite; для PostgreSQL параметр игнорируется через условие
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI-зависимость: сессия БД на время запроса."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
