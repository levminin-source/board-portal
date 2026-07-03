"""
Площадка Совета директоров — REST API (MVP).

Запуск (из каталога backend):
    pip install -r requirements.txt
    python -m app.seed          # первый раз: создать БД и демо-пользователей
    uvicorn app.main:app --reload

Интерактивная документация API открывается на /docs (Swagger автоматически).
Фронтенд (каталог ../frontend) отдаётся этим же сервером на адресе /.
"""
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from . import models as M
from .security import authenticate, make_token, get_current_user, require_role

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_MB = 25
ALLOWED_EXT = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt"}

app = FastAPI(title="Площадка Совета директоров", version="0.1-MVP")


# ---------- служебные ----------

def log(db: Session, user: M.User | None, action: str):
    db.add(M.AuditLog(user_id=user.id if user else None,
                      user_name=user.full_name if user else "Система", action=action))
    db.commit()


def notify(db: Session, user_ids: list[int], text: str):
    """Внутреннее уведомление каждому адресату.
    ТОЧКА РАСШИРЕНИЯ: здесь же добавляется отправка на корпоративную почту."""
    for uid in user_ids:
        db.add(M.Notification(user_id=uid, text=text))
    db.commit()


def member_ids(db: Session) -> list[int]:
    return [u.id for u in db.query(M.User).filter(M.User.role == "member", M.User.is_active == True)]  # noqa: E712


# ---------- вход ----------

class LoginIn(BaseModel):
    login: str
    password: str


@app.post("/api/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = authenticate(db, data.login, data.password)
    log(db, user, "Вход в систему")
    return {"token": make_token(user),
            "user": {"id": user.id, "name": user.full_name, "role": user.role, "position": user.position}}


@app.get("/api/me")
def me(user: M.User = Depends(get_current_user)):
    return {"id": user.id, "name": user.full_name, "role": user.role, "position": user.position}


@app.get("/api/users")
def users(user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Справочник пользователей (для выбора исполнителя поручения и т.п.)."""
    return [{"id": u.id, "name": u.full_name, "role": u.role, "position": u.position}
            for u in db.query(M.User).filter(M.User.is_active == True)]  # noqa: E712


# ---------- заседания ----------

class MeetingIn(BaseModel):
    number: str
    form: str
    date: str
    vote_deadline: str = ""
    quorum: int = 3
    agenda: list[dict]                 # [{"title": ..., "speaker": ...}]
    schedule_options: list[str] = []   # варианты дат для согласования (необязательно)


def meeting_out(db: Session, m: M.Meeting, viewer: M.User) -> dict:
    users = {u.id: u.full_name for u in db.query(M.User)}
    agenda = []
    for a in sorted(m.agenda, key=lambda x: x.number):
        votes = db.query(M.Vote).filter(M.Vote.agenda_item_id == a.id).all()
        comments = db.query(M.Comment).filter(M.Comment.agenda_item_id == a.id).order_by(M.Comment.created_at).all()
        materials = db.query(M.Material).filter(M.Material.agenda_item_id == a.id).order_by(M.Material.uploaded_at).all()
        agenda.append({
            "id": a.id, "number": a.number, "title": a.title, "speaker": a.speaker,
            # промежуточные итоги открыты всем участникам (открытое голосование, п. 7.7 Положения)
            "votes": [{"user": users.get(v.user_id, "?"), "user_id": v.user_id, "value": v.value} for v in votes],
            "my_vote": next((v.value for v in votes if v.user_id == viewer.id), None),
            "comments": [{"user": users.get(c.user_id, "?"), "text": c.text,
                          "at": c.created_at.strftime("%d.%m %H:%M")} for c in comments],
            "materials": [{"id": f.id, "filename": f.filename, "version": f.version,
                           "at": f.uploaded_at.strftime("%d.%m.%Y")} for f in materials],
        })
    poll = db.query(M.SchedulePoll).filter(M.SchedulePoll.meeting_id == m.id).first()
    poll_out = None
    if poll:
        answers = db.query(M.SchedulePollAnswer).filter(M.SchedulePollAnswer.poll_id == poll.id).all()
        poll_out = {"options": poll.options.split(";"),
                    "answers": [{"user_id": a.user_id, "option": a.option_index} for a in answers],
                    "my_answer": next((a.option_index for a in answers if a.user_id == viewer.id), None)}
    return {"id": m.id, "number": m.number, "form": m.form, "date": m.date,
            "vote_deadline": m.vote_deadline, "status": m.status, "quorum": m.quorum,
            "protocol_file": m.protocol_file, "agenda": agenda, "schedule_poll": poll_out}


@app.get("/api/meetings")
def list_meetings(user: M.User = Depends(require_role("secretary", "member")), db: Session = Depends(get_db)):
    out = [meeting_out(db, m, user) for m in db.query(M.Meeting).order_by(M.Meeting.id.desc())]
    return out


@app.post("/api/meetings")
def create_meeting(data: MeetingIn, user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    m = M.Meeting(number=data.number, form=data.form, date=data.date,
                  vote_deadline=data.vote_deadline, quorum=data.quorum)
    db.add(m); db.flush()
    for i, item in enumerate(data.agenda, start=1):
        db.add(M.AgendaItem(meeting_id=m.id, number=i, title=item["title"], speaker=item.get("speaker", "")))
    if data.schedule_options:
        db.add(M.SchedulePoll(meeting_id=m.id, options=";".join(data.schedule_options)))
    db.commit()
    log(db, user, f"Создано заседание {m.number} ({m.form}, {m.date})")
    notify(db, member_ids(db), f"Создано заседание {m.number} от {m.date}. Ознакомьтесь с повесткой.")
    return {"id": m.id}


@app.post("/api/meetings/{mid}/status")
def set_meeting_status(mid: int, status: str = Form(...),
                       user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    if status not in ("planned", "voting", "closed"):
        raise HTTPException(400, "Недопустимый статус")
    m = db.get(M.Meeting, mid) or _404()
    m.status = status
    db.commit()
    log(db, user, f"Статус заседания {m.number}: {status}")
    if status == "voting":
        notify(db, member_ids(db), f"Начато голосование по заседанию {m.number}. Срок — до {m.vote_deadline or m.date}.")
    return {"ok": True}


def _404():
    raise HTTPException(404, "Не найдено")


# ---------- голосование и комментарии ----------

@app.post("/api/agenda/{aid}/vote")
def vote(aid: int, value: str = Form(...),
         user: M.User = Depends(require_role("member")), db: Session = Depends(get_db)):
    if value not in ("за", "против", "воздержался"):
        raise HTTPException(400, "Допустимые значения: за / против / воздержался")
    item = db.get(M.AgendaItem, aid) or _404()
    if item.meeting.status != "voting":
        raise HTTPException(409, "Голосование по этому заседанию не открыто")
    existing = db.query(M.Vote).filter(M.Vote.agenda_item_id == aid, M.Vote.user_id == user.id).first()
    if existing:
        raise HTTPException(409, "Голос уже подан и не может быть изменён")  # однократность голосования
    db.add(M.Vote(agenda_item_id=aid, user_id=user.id, value=value))
    db.commit()
    log(db, user, f"Голос «{value}» по вопросу {item.number} заседания {item.meeting.number}")
    return {"ok": True}


@app.post("/api/agenda/{aid}/comment")
def comment(aid: int, text: str = Form(...),
            user: M.User = Depends(require_role("member", "secretary")), db: Session = Depends(get_db)):
    item = db.get(M.AgendaItem, aid) or _404()
    db.add(M.Comment(agenda_item_id=aid, user_id=user.id, text=text.strip()))
    db.commit()
    log(db, user, f"Комментарий к вопросу {item.number} заседания {item.meeting.number}")
    return {"ok": True}


@app.post("/api/meetings/{mid}/schedule-vote")
def schedule_vote(mid: int, option: int = Form(...),
                  user: M.User = Depends(require_role("member")), db: Session = Depends(get_db)):
    poll = db.query(M.SchedulePoll).filter(M.SchedulePoll.meeting_id == mid).first() or _404()
    prev = db.query(M.SchedulePollAnswer).filter(
        M.SchedulePollAnswer.poll_id == poll.id, M.SchedulePollAnswer.user_id == user.id).first()
    if prev:
        prev.option_index = option    # выбор даты, в отличие от голоса, можно изменить
    else:
        db.add(M.SchedulePollAnswer(poll_id=poll.id, user_id=user.id, option_index=option))
    db.commit()
    log(db, user, f"Выбор даты заседания #{mid}: вариант {option + 1}")
    return {"ok": True}


# ---------- материалы и протокол ----------

def _check_file(f: UploadFile):
    ext = Path(f.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Недопустимый тип файла. Разрешены: {', '.join(sorted(ALLOWED_EXT))}")
    return ext


@app.post("/api/agenda/{aid}/materials")
async def upload_material(aid: int, file: UploadFile = File(...),
                          user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    item = db.get(M.AgendaItem, aid) or _404()
    ext = _check_file(file)
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"Файл больше {MAX_UPLOAD_MB} МБ")
    version = 1 + db.query(M.Material).filter(
        M.Material.agenda_item_id == aid, M.Material.filename == file.filename).count()
    stored = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored).write_bytes(content)
    db.add(M.Material(agenda_item_id=aid, filename=file.filename, stored_name=stored, version=version))
    db.commit()
    log(db, user, f"Загружен материал «{file.filename}» (v{version}) к вопросу {item.number} заседания {item.meeting.number}")
    notify(db, member_ids(db), f"Новый материал к заседанию {item.meeting.number}: {file.filename}")
    return {"ok": True, "version": version}


@app.get("/api/materials/{fid}")
def download_material(fid: int, user: M.User = Depends(require_role("secretary", "member")),
                      db: Session = Depends(get_db)):
    f = db.get(M.Material, fid) or _404()
    log(db, user, f"Скачан материал «{f.filename}» (v{f.version})")
    return FileResponse(UPLOAD_DIR / f.stored_name, filename=f.filename)


@app.post("/api/meetings/{mid}/protocol")
async def upload_protocol(mid: int, file: UploadFile = File(...),
                          user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    m = db.get(M.Meeting, mid) or _404()
    if m.status != "closed":
        raise HTTPException(409, "Протокол загружается после завершения заседания")
    _check_file(file)
    stored = f"protocol_{uuid.uuid4().hex}{Path(file.filename).suffix.lower()}"
    (UPLOAD_DIR / stored).write_bytes(await file.read())
    m.protocol_file = f"{stored}|{file.filename}"
    db.commit()
    log(db, user, f"Загружен протокол заседания {m.number}")
    notify(db, member_ids(db), f"Опубликован протокол заседания {m.number}.")
    return {"ok": True}


@app.get("/api/meetings/{mid}/protocol")
def download_protocol(mid: int, user: M.User = Depends(require_role("secretary", "member")),
                      db: Session = Depends(get_db)):
    m = db.get(M.Meeting, mid) or _404()
    if not m.protocol_file:
        _404()
    stored, original = m.protocol_file.split("|", 1)
    return FileResponse(UPLOAD_DIR / stored, filename=original)


# ---------- календарь ----------

def _to_iso(ru_date: str) -> str | None:
    """«10.07.2026» → «2026-07-10» для сортировки по дням календаря."""
    try:
        d, m, y = ru_date.strip().split(".")[:3]
        return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    except Exception:
        return None


@app.get("/api/calendar")
def calendar(user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Единая лента событий рабочего стола: заседания СД + сроки поручений +
    события, добавленные секретарём вручную (созвоны, интервью, прочее)."""
    items = []
    if user.role != "director":
        for m in db.query(M.Meeting).filter(M.Meeting.status != "closed"):
            iso = _to_iso(m.date)
            if iso:
                items.append({"date": iso, "kind": "meeting", "sub": m.status,
                              "title": f"Заседание {m.number}", "detail": m.form,
                              "ref": {"type": "meeting", "id": m.id}})
            if m.vote_deadline:
                iso_d = _to_iso(m.vote_deadline.split(" ")[0])
                if iso_d and iso_d != iso:
                    items.append({"date": iso_d, "kind": "deadline", "sub": "vote",
                                  "title": f"Окончание голосования — {m.number}",
                                  "detail": m.vote_deadline, "ref": {"type": "meeting", "id": m.id}})

    task_q = db.query(M.Task).filter(M.Task.status.in_(["new", "work", "done"]))
    if user.role == "director":
        task_q = task_q.filter(M.Task.assignee_id == user.id)
    users_map = {u.id: u.full_name for u in db.query(M.User)}
    for t in task_q:
        iso = _to_iso(t.deadline)
        if iso:
            items.append({"date": iso, "kind": "task", "sub": t.status,
                          "title": f"Срок поручения: {t.title[:60]}{'…' if len(t.title) > 60 else ''}",
                          "detail": users_map.get(t.assignee_id, "?"), "ref": {"type": "task", "id": t.id}})

    ev_q = db.query(M.Event)
    if user.role == "director":
        ev_q = ev_q.filter(M.Event.id < 0)  # директор организационные события СД не видит
    for e in ev_q:
        items.append({"date": e.date, "kind": e.kind, "sub": "",
                      "title": e.title, "detail": e.time, "note": e.note,
                      "ref": {"type": "event", "id": e.id}})
    return items


class EventIn(BaseModel):
    title: str
    kind: str = "other"      # call | interview | other
    date: str                 # YYYY-MM-DD
    time: str = ""
    note: str = ""


@app.post("/api/events")
def create_event(data: EventIn, user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    if data.kind not in ("call", "interview", "other"):
        raise HTTPException(400, "Недопустимый тип события")
    e = M.Event(title=data.title.strip(), kind=data.kind, date=data.date, time=data.time, note=data.note, created_by=user.id)
    db.add(e); db.commit()
    log(db, user, f"Добавлено событие календаря «{e.title}» на {e.date}")
    return {"id": e.id}


@app.delete("/api/events/{eid}")
def delete_event(eid: int, user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    e = db.get(M.Event, eid) or _404()
    db.delete(e); db.commit()
    log(db, user, f"Удалено событие календаря «{e.title}»")
    return {"ok": True}


# ---------- поручения ----------

class TaskIn(BaseModel):
    title: str
    assignee_id: int
    deadline: str
    basis: str = ""


@app.get("/api/tasks")
def list_tasks(user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(M.Task).order_by(M.Task.id.desc())
    # функциональный директор видит только свои поручения
    if user.role == "director":
        q = q.filter(M.Task.assignee_id == user.id)
    users = {u.id: u.full_name for u in db.query(M.User)}
    out = []
    for t in q:
        updates = db.query(M.TaskUpdate).filter(M.TaskUpdate.task_id == t.id).order_by(M.TaskUpdate.created_at)
        out.append({"id": t.id, "title": t.title, "assignee_id": t.assignee_id,
                    "assignee": users.get(t.assignee_id, "?"), "basis": t.basis,
                    "deadline": t.deadline, "status": t.status,
                    "updates": [{"user": users.get(u.user_id, "?"), "text": u.text,
                                 "at": u.created_at.strftime("%d.%m %H:%M")} for u in updates]})
    return out


@app.post("/api/tasks")
def create_task(data: TaskIn, user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    assignee = db.get(M.User, data.assignee_id) or _404()
    t = M.Task(title=data.title.strip(), assignee_id=assignee.id, deadline=data.deadline, basis=data.basis)
    db.add(t); db.commit()
    log(db, user, f"Создано поручение #{t.id} → {assignee.full_name}, срок {t.deadline}: {t.title[:80]}")
    notify(db, [assignee.id], f"Вам назначено поручение (срок {t.deadline}): {t.title[:100]}")
    return {"id": t.id}


VALID_TRANSITIONS = {  # кто и какие переходы статуса может выполнять
    "assignee": {("new", "work"), ("work", "done")},
    "secretary": {("done", "accepted"), ("done", "work")},  # принять или вернуть в работу
}


@app.post("/api/tasks/{tid}/status")
def task_status(tid: int, status: str = Form(...),
                user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.get(M.Task, tid) or _404()
    who = "secretary" if user.role == "secretary" else ("assignee" if t.assignee_id == user.id else None)
    if not who or (t.status, status) not in VALID_TRANSITIONS[who]:
        raise HTTPException(403, "Такой переход статуса вам недоступен")
    t.status = status
    db.commit()
    labels = {"work": "в работе", "done": "исполнено", "accepted": "принято секретарём"}
    log(db, user, f"Поручение #{t.id}: статус — {labels.get(status, status)}")
    if status == "done":
        secretary_ids = [u.id for u in db.query(M.User).filter(M.User.role == "secretary")]
        notify(db, secretary_ids, f"Поручение #{t.id} отмечено исполненным, требуется проверка.")
    return {"ok": True}


@app.post("/api/tasks/{tid}/update")
def task_update(tid: int, text: str = Form(...),
                user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.get(M.Task, tid) or _404()
    if user.role != "secretary" and t.assignee_id != user.id:
        raise HTTPException(403, "Комментировать может исполнитель или секретарь")
    db.add(M.TaskUpdate(task_id=tid, user_id=user.id, text=text.strip()))
    db.commit()
    log(db, user, f"Отчёт по поручению #{tid}")
    return {"ok": True}


# ---------- уведомления и журнал ----------

@app.get("/api/notifications")
def notifications(user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ns = db.query(M.Notification).filter(M.Notification.user_id == user.id).order_by(M.Notification.id.desc()).limit(50)
    return [{"id": n.id, "text": n.text, "is_read": n.is_read,
             "at": n.created_at.strftime("%d.%m %H:%M")} for n in ns]


@app.post("/api/notifications/{nid}/read")
def read_notification(nid: int, user: M.User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(M.Notification, nid) or _404()
    if n.user_id != user.id:
        raise HTTPException(403, "Чужое уведомление")
    n.is_read = True
    db.commit()
    return {"ok": True}


@app.get("/api/audit")
def audit(user: M.User = Depends(require_role("secretary")), db: Session = Depends(get_db)):
    rows = db.query(M.AuditLog).order_by(M.AuditLog.id.desc()).limit(300)
    return [{"at": r.created_at.strftime("%d.%m.%Y %H:%M"), "user": r.user_name, "action": r.action} for r in rows]


# ---------- фронтенд (статические файлы) ----------
FRONTEND = Path(__file__).resolve().parent.parent.parent / "frontend"
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
