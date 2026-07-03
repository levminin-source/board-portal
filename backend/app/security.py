"""
Аутентификация и разграничение доступа.

MVP: логин/пароль + JWT-токен. Пароли хранятся только в виде bcrypt-хэшей.
Защита от перебора: после 5 неудачных попыток учётная запись блокируется на 15 минут.

Точка замены для закрытого контура: функции authenticate() и get_current_user()
заменяются на проверку через корпоративный AD/LDAP или SSO (Kerberos/SAML),
остальной код от способа аутентификации не зависит.
"""
import os
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from .db import get_db
from .models import User

# В бою секрет задаётся переменной окружения и не хранится в коде.
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_TTL_HOURS = 10
MAX_FAILED = 5
LOCK_MINUTES = 15

bearer = HTTPBearer(auto_error=False)


def hash_password(p: str) -> str:
    return bcrypt.hash(p)


def authenticate(db: Session, login: str, password: str) -> User:
    user = db.query(User).filter(User.login == login, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(401, "Неверный логин или пароль")
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(423, "Учётная запись временно заблокирована после неудачных попыток входа. Повторите позже.")
    if not bcrypt.verify(password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= MAX_FAILED:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCK_MINUTES)
            user.failed_logins = 0
        db.commit()
        raise HTTPException(401, "Неверный логин или пароль")
    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    return user


def make_token(user: User) -> str:
    payload = {"sub": str(user.id), "exp": datetime.utcnow() + timedelta(hours=JWT_TTL_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(401, "Требуется вход в систему")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Сессия истекла, войдите заново")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(401, "Пользователь не найден или отключён")
    return user


def require_role(*roles: str):
    """Зависимость-ограничитель: доступ только указанным ролям."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Недостаточно прав для этого действия")
        return user
    return checker
