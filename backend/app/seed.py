"""
Первичное наполнение базы демо-данными.
Запуск: python -m app.seed   (из каталога backend)

Создаёт пользователей (пароли для демо, СМЕНИТЬ перед реальным использованием):
  секретарь:   secretary / demo123
  члены СД:    kuznetsov / demo123, minina / demo123, orlov / demo123, safonova / demo123
  директора:   fin_dir / demo123 (финансовый), it_dir / demo123 (ИТ)
"""
from .db import Base, engine, SessionLocal
from . import models as M
from .security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(M.User).count():
    print("БД уже наполнена, повторный запуск не требуется.")
    raise SystemExit

users = [
    M.User(login="secretary", full_name="Корпоративный секретарь", role="secretary", position="Корпоративный секретарь"),
    M.User(login="kuznetsov", full_name="Кузнецов А. В.", role="member", position="Председатель СД"),
    M.User(login="minina", full_name="Минина Е. С.", role="member", position="Член СД"),
    M.User(login="orlov", full_name="Орлов Д. И.", role="member", position="Член СД"),
    M.User(login="safonova", full_name="Сафонова Н. П.", role="member", position="Член СД"),
    M.User(login="fin_dir", full_name="Громов П. С.", role="director", position="Финансовый директор"),
    M.User(login="it_dir", full_name="Ершова К. Л.", role="director", position="Директор по ИТ"),
]
for u in users:
    u.password_hash = hash_password("demo123")
    db.add(u)
db.flush()

m = M.Meeting(number="СД-07/2026", form="Заочная (опросным путём)", date="10.07.2026",
              vote_deadline="09.07.2026 18:00", status="voting", quorum=3)
db.add(m); db.flush()
db.add(M.AgendaItem(meeting_id=m.id, number=1, speaker="Кузнецов А. В.",
       title="Об одобрении сделки свыше 100 млн ₽ — договор поставки с ООО «Автодеталь-Восток»"))
db.add(M.AgendaItem(meeting_id=m.id, number=2, speaker="Сафонова Н. П.",
       title="Об утверждении бюджета маркетинга на III квартал 2026 г."))

m2 = M.Meeting(number="СД-08/2026", form="Очная", date="24.07.2026", status="planned", quorum=3)
db.add(m2); db.flush()
db.add(M.AgendaItem(meeting_id=m2.id, number=1, speaker="Кузнецов А. В.",
       title="О стратегии выхода на рынок Узбекистана"))
db.add(M.SchedulePoll(meeting_id=m2.id, options="22.07 (ср), 11:00;24.07 (пт), 10:00;27.07 (пн), 15:00"))

fin = next(u for u in users if u.login == "fin_dir")
it = next(u for u in users if u.login == "it_dir")
db.add(M.Task(title="Подготовить сравнительный анализ условий поставки по трём конкурирующим предложениям",
              assignee_id=fin.id, basis="Решение СД-06/2026, вопрос 1", deadline="15.07.2026", status="work"))
db.add(M.Task(title="Организовать презентацию IT-стратегии на очном заседании СД-08/2026",
              assignee_id=it.id, basis="План работы СД на 2026 г.", deadline="22.07.2026", status="new"))

sec = next(u for u in users if u.login == "secretary")
db.add(M.Event(title="Созвон с аудитором по итогам ревизии рисков", kind="call",
               date="2026-07-08", time="11:00", note="Zoom, ссылка в почте", created_by=sec.id))
db.add(M.Event(title="Интервью с кандидатом на позицию независимого директора", kind="interview",
               date="2026-07-14", time="15:30", note="Переговорная 3", created_by=sec.id))
db.add(M.Event(title="Дедлайн подачи документов в реестр для годового собрания", kind="other",
               date="2026-07-17", time="", note="", created_by=sec.id))

db.add(M.AuditLog(user_name="Система", action="База данных создана, загружены демо-данные"))
db.commit()
print("Готово. Демо-пользователи созданы (пароль у всех: demo123).")
