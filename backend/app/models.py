"""
Модели данных площадки Совета директоров.

Роли пользователей (User.role):
  secretary — корпоративный секретарь (администратор площадки);
  member    — член Совета директоров (голосует, видит заседания и материалы);
  director  — функциональный директор (исполнитель поручений; заседания СД не видит).

Промежуточные итоги голосования по проектному решению видны всем участникам
заседания до его закрытия (открытое голосование, п. 7.7 Положения о СД).
"""
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    full_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(16))          # secretary | member | director
    position: Mapped[str] = mapped_column(String(128), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)   # защита от перебора
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32))        # «СД-07/2026»
    form: Mapped[str] = mapped_column(String(64))          # очная / заочная (опросным путём)
    date: Mapped[str] = mapped_column(String(32))
    vote_deadline: Mapped[str] = mapped_column(String(32), default="")  # срок приёма голосов (заочная форма)
    status: Mapped[str] = mapped_column(String(16), default="planned")  # planned | voting | closed
    quorum: Mapped[int] = mapped_column(Integer, default=3)             # настраивается на заседание
    protocol_file: Mapped[str] = mapped_column(String(256), default="") # имя загруженного протокола
    agenda: Mapped[list["AgendaItem"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")


class AgendaItem(Base):
    __tablename__ = "agenda_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    speaker: Mapped[str] = mapped_column(String(128), default="")
    meeting: Mapped[Meeting] = relationship(back_populates="agenda")


class Material(Base):
    """Материал к вопросу повестки. Файлы хранятся в каталоге uploads/;
    при переносе в контур каталог заменяется на корпоративное файловое хранилище."""
    __tablename__ = "materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    agenda_item_id: Mapped[int] = mapped_column(ForeignKey("agenda_items.id"))
    filename: Mapped[str] = mapped_column(String(256))
    stored_name: Mapped[str] = mapped_column(String(256))  # имя файла на диске (uuid)
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Vote(Base):
    __tablename__ = "votes"
    id: Mapped[int] = mapped_column(primary_key=True)
    agenda_item_id: Mapped[int] = mapped_column(ForeignKey("agenda_items.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    value: Mapped[str] = mapped_column(String(16))          # за | против | воздержался
    voted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    agenda_item_id: Mapped[int] = mapped_column(ForeignKey("agenda_items.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SchedulePoll(Base):
    """Согласование даты заседания: варианты через «;», ответы — в SchedulePollAnswer."""
    __tablename__ = "schedule_polls"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), unique=True)
    options: Mapped[str] = mapped_column(Text)


class SchedulePollAnswer(Base):
    __tablename__ = "schedule_poll_answers"
    id: Mapped[int] = mapped_column(primary_key=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("schedule_polls.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    option_index: Mapped[int] = mapped_column(Integer)


class Task(Base):
    """Поручение. Исполнители — в первую очередь функциональные директора,
    но модель допускает назначение любому пользователю (в т.ч. члену СД)."""
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    assignee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    basis: Mapped[str] = mapped_column(String(256), default="")   # основание: решение СД, поручение председателя
    deadline: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="new")  # new | work | done | accepted
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TaskUpdate(Base):
    __tablename__ = "task_updates"
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """Внутренние уведомления. Точка расширения: при переносе в контур здесь же
    вызывается отправка на корпоративную почту (SMTP/Exchange) — см. README."""
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Event(Base):
    """Событие календаря, не привязанное к заседанию: рабочий созвон, интервью,
    иное важное событие. Заседания СД и сроки поручений в эту таблицу не
    дублируются — они собираются на лету (см. /api/calendar в main.py).
    Таблица нужна только для событий, которые секретарь вносит вручную."""
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(256))
    kind: Mapped[str] = mapped_column(String(24), default="other")  # call | interview | other
    date: Mapped[str] = mapped_column(String(10))              # YYYY-MM-DD
    time: Mapped[str] = mapped_column(String(5), default="")   # HH:MM, необязательно
    note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))


class AuditLog(Base):
    """Журнал действий. Записи только добавляются, API их изменения не предусматривает."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    user_name: Mapped[str] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
