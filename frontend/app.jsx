/* Площадка Совета директоров — фронтенд MVP (подключён к REST API бэкенда).
   Фирменный стиль MARSHALL: тёмно-синий + алый. Роли: секретарь / член СД / функциональный директор. */

const { useState, useEffect, useMemo } = React;

const C = { navy:"#132441", navyDeep:"#0D1B33", red:"#E4173F", redSoft:"#FCE8EC",
  paper:"#F5F6F8", card:"#FFF", ink:"#1C2536", soft:"#5A6478", mute:"#8B93A5",
  line:"#E4E7ED", lineStrong:"#C8CEDA", ok:"#1E7A4F", okSoft:"#E5F2EB", warn:"#B07A12", warnSoft:"#FBF3DE" };
const disp = "'Montserrat',sans-serif", sans = "'PT Sans',sans-serif";

/* Цвет и подпись по типу события календаря */
const KIND = {
  meeting:  { color: C.red,    soft: C.redSoft,    label: "Заседание СД" },
  deadline: { color: C.warn,   soft: C.warnSoft,   label: "Срок голосования" },
  task:     { color: C.violet, soft: C.violetSoft, label: "Срок поручения" },
  call:     { color: C.navy,   soft: "#E7EBF3",     label: "Созвон" },
  interview:{ color: C.gold,   soft: C.goldSoft,    label: "Интервью" },
  other:    { color: C.soft,   soft: C.paper,       label: "Событие" },
};
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const pad2 = n => String(n).padStart(2, "0");
const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const todayIso = isoOf(new Date());

/* ---- вызовы API ---- */
let TOKEN = sessionStorage.getItem("token") || "";
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
  if (opts.json) { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
  const r = await fetch("/api" + path, { ...opts, headers });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || "Ошибка " + r.status); }
  return r.json();
}
const form = (obj) => { const f = new FormData(); Object.entries(obj).forEach(([k, v]) => f.append(k, v)); return f; };

/* ---- атомы ---- */
const Chip = ({ children, tone = "mute", solid }) => (
  <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:3, fontSize:11.5, fontWeight:700,
    letterSpacing:".06em", textTransform:"uppercase",
    background: solid ? C[tone] : ({ok:C.okSoft, warn:C.warnSoft, red:C.redSoft}[tone] || C.paper),
    color: solid ? "#fff" : ({ok:C.ok, warn:C.warn, red:C.red}[tone] || C.soft),
    border: solid ? "none" : `1px solid ${C.line}` }}>{children}</span>);

const Btn = ({ children, onClick, primary, ghost, small, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{ fontFamily:sans, fontSize:small?12.5:14, fontWeight:700,
    cursor:disabled?"default":"pointer", padding:small?"6px 14px":"9px 20px", borderRadius:4,
    border:primary?"none":`1.5px solid ${ghost?"rgba(255,255,255,.5)":C.lineStrong}`,
    background:primary?C.red:"transparent", color:primary?"#fff":ghost?"#fff":C.ink, opacity:disabled?.45:1 }}>{children}</button>);

const Sect = ({ title, children, extra, accent }) => (
  <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:8, marginBottom:20, overflow:"hidden" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"13px 20px",
      borderBottom:`2px solid ${accent?C.red:C.line}` }}>
      <div style={{ fontFamily:disp, fontSize:14, fontWeight:800, letterSpacing:".05em", textTransform:"uppercase", color:C.navy }}>{title}</div>
      {extra}</div>
    <div style={{ padding:20 }}>{children}</div>
  </div>);

const Label = ({ children }) => <div style={{ fontSize:11, fontWeight:700, letterSpacing:".1em",
  textTransform:"uppercase", color:C.mute, marginBottom:8 }}>{children}</div>;
const inp = { fontFamily:sans, fontSize:14, padding:"9px 12px", border:`1.5px solid ${C.lineStrong}`,
  borderRadius:4, width:"100%", boxSizing:"border-box", background:"#fff", color:C.ink };

/* ---- вход ---- */
function Login({ onDone }) {
  const [l, setL] = useState(""), [p, setP] = useState(""), [err, setErr] = useState("");
  const go = async () => {
    try { const r = await api("/login", { method:"POST", json:{ login:l, password:p } });
      TOKEN = r.token; sessionStorage.setItem("token", TOKEN); onDone(r.user);
    } catch (e) { setErr(e.message); }
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:`radial-gradient(ellipse 70% 90% at 50% 30%, #1E3B66 0%, ${C.navy} 55%, ${C.navyDeep} 100%)` }}>
      <div style={{ background:"#fff", borderRadius:10, padding:"36px 40px", width:360, boxShadow:"0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, width:"fit-content", marginBottom:18 }}>
          <img src="/assets/logo.png" alt="MARSHALL" style={{ width:34, height:34, borderRadius:4 }} />
          <span style={{ fontFamily:disp, fontSize:19, fontWeight:800, color:C.navy, letterSpacing:".03em" }}>MARSHALL</span>
        </div>
        <div style={{ fontFamily:disp, fontSize:17, fontWeight:800, textTransform:"uppercase", color:C.navy, marginBottom:4 }}>Совет директоров</div>
        <div style={{ fontSize:13, color:C.soft, marginBottom:22 }}>Рабочая площадка. Вход для участников.</div>
        <Label>Логин</Label>
        <input style={{ ...inp, marginBottom:14 }} value={l} onChange={e=>setL(e.target.value)} autoFocus />
        <Label>Пароль</Label>
        <input style={{ ...inp, marginBottom:18 }} type="password" value={p}
          onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} />
        {err && <div style={{ color:C.red, fontSize:13, marginBottom:12 }}>{err}</div>}
        <Btn primary onClick={go}>Войти</Btn>
        <div style={{ fontSize:11.5, color:C.mute, marginTop:16, lineHeight:1.5 }}>
          Демо-доступ: secretary / minina / fin_dir · пароль demo123</div>
      </div>
    </div>);
}

/* ---- приложение ---- */
function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("dash");
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [notif, setNotif] = useState([]);
  const [audit, setAudit] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [err, setErr] = useState("");
  const [calendar, setCalendar] = useState([]);

  const isSec = user?.role === "secretary", isMem = user?.role === "member", isDir = user?.role === "director";

  const reload = async (u = user) => {
    if (!u) return;
    try {
      const jobs = [api("/tasks").then(setTasks), api("/notifications").then(setNotif),
        api("/users").then(setUsers), api("/calendar").then(setCalendar)];
      if (u.role !== "director") jobs.push(api("/meetings").then(setMeetings));
      if (u.role === "secretary") jobs.push(api("/audit").then(setAudit));
      await Promise.all(jobs); setErr("");
    } catch (e) { if (String(e.message).includes("Сессия")) { setUser(null); TOKEN=""; } else setErr(e.message); }
  };

  useEffect(() => { // восстановление сессии после перезагрузки страницы
    if (TOKEN) api("/me").then(u => { setUser(u); reload(u); }).catch(() => { TOKEN=""; sessionStorage.removeItem("token"); });
  }, []);

  const act = (fn) => async (...args) => { try { await fn(...args); await reload(); } catch (e) { alert(e.message); } };
  const vote = act((aid, v) => api(`/agenda/${aid}/vote`, { method:"POST", body:form({ value:v }) }));
  const comment = act((aid, t) => api(`/agenda/${aid}/comment`, { method:"POST", body:form({ text:t }) }));
  const pickDate = act((mid, i) => api(`/meetings/${mid}/schedule-vote`, { method:"POST", body:form({ option:i }) }));
  const setMStatus = act((mid, s) => api(`/meetings/${mid}/status`, { method:"POST", body:form({ status:s }) }));
  const setTStatus = act((tid, s) => api(`/tasks/${tid}/status`, { method:"POST", body:form({ status:s }) }));
  const taskNote = act((tid, t) => api(`/tasks/${tid}/update`, { method:"POST", body:form({ text:t }) }));
  const readN = act((nid) => api(`/notifications/${nid}/read`, { method:"POST" }));
  const addEvent = act((data) => api("/events", { method:"POST", json:data }));
  const delEvent = act((eid) => api(`/events/${eid}`, { method:"DELETE" }));
  const uploadFile = act(async (url, file) => { const f = new FormData(); f.append("file", file);
    await api(url, { method:"POST", body:f }); });
  const download = async (url, fallbackName) => {
    const r = await fetch("/api" + url, { headers:{ Authorization:"Bearer " + TOKEN } });
    if (!r.ok) { alert("Не удалось скачать файл"); return; }
    const blob = await r.blob(); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fallbackName; a.click(); URL.revokeObjectURL(a.href);
  };

  if (!user) return <Login onDone={u => { setUser(u); reload(u); }} />;

  const open = meetings.find(m => m.id === openId);
  const meetChip = m => m.status==="voting" ? <Chip tone="red" solid>Идёт голосование</Chip>
    : m.status==="planned" ? <Chip tone="warn">Планируется</Chip> : <Chip tone="ok">Завершено</Chip>;
  const taskChip = t => t.status==="new" ? <Chip tone="red">Новое</Chip> : t.status==="work" ? <Chip tone="warn">В работе</Chip>
    : t.status==="done" ? <Chip tone="ok">Исполнено</Chip> : <Chip tone="ok" solid>Принято</Chip>;

  const myActions = useMemo(() => {
    const a = [];
    meetings.forEach(m => {
      if (m.status === "voting") {
        const pending = m.agenda.filter(q => !q.my_vote).length;
        if (isMem && pending) a.push({ t:`Проголосовать по ${pending} вопрос(ам) — ${m.number}`, s:`Срок: ${m.vote_deadline}`, go:()=>{setOpenId(m.id);setTab("meet");} });
        if (isSec) { const got = m.agenda.reduce((s,q)=>s+q.votes.length,0);
          a.push({ t:`Сбор голосов — ${m.number}: получено ${got}`, s:`Срок: ${m.vote_deadline}`, go:()=>{setOpenId(m.id);setTab("meet");} }); }
      }
      if (m.schedule_poll && m.schedule_poll.my_answer === null && isMem)
        a.push({ t:`Согласовать дату заседания ${m.number}`, s:"Выберите вариант", go:()=>{setOpenId(m.id);setTab("meet");} });
      if (m.status === "closed" && !m.protocol_file && isSec)
        a.push({ t:`Загрузить протокол — ${m.number}`, s:"Голосование завершено", go:()=>{setOpenId(m.id);setTab("meet");} });
    });
    tasks.forEach(t => {
      if (t.assignee_id === user.id && (t.status === "new" || t.status === "work"))
        a.push({ t:`Поручение: ${t.title.slice(0,70)}…`, s:`Срок: ${t.deadline}`, go:()=>setTab("tasks") });
      if (isSec && t.status === "done")
        a.push({ t:`Проверить исполнение: ${t.title.slice(0,60)}…`, s:`Исполнитель: ${t.assignee}`, go:()=>setTab("tasks") });
    });
    return a;
  }, [meetings, tasks, user]);

  const nav = [["dash","Рабочий стол"],
    ...(!isDir ? [["meet","Заседания"]] : []),
    ["tasks","Поручения"],
    ...(!isDir ? [["arch","Архив"]] : []),
    ...(isSec ? [["audit","Журнал"]] : [])];

  return (
    <div style={{ minHeight:"100vh", background:C.paper, color:C.ink }}>
      {/* шапка */}
      <div style={{ background:`radial-gradient(ellipse 60% 120% at 50% 0%, #1E3B66 0%, ${C.navy} 55%, ${C.navyDeep} 100%)`, color:"#fff" }}>
        <div style={{ maxWidth:1120, margin:"0 auto", padding:"18px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <img src="/assets/logo.png" alt="MARSHALL" style={{ width:36, height:36, borderRadius:4, flexShrink:0 }} />
              <span style={{ fontFamily:disp, fontWeight:800, fontSize:20, letterSpacing:".03em", color:"#fff" }}>MARSHALL</span>
            </div>
            <div style={{ borderLeft:"1px solid rgba(255,255,255,.25)", paddingLeft:14 }}>
              <div style={{ fontFamily:disp, fontSize:18, fontWeight:800, letterSpacing:".06em", textTransform:"uppercase" }}>Совет директоров</div>
              <div style={{ fontSize:12.5, color:"rgba(255,255,255,.65)" }}>Рабочая площадка · корпоративное управление</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{user.name}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.6)" }}>{user.position}</div>
            </div>
            <Btn small ghost onClick={() => { TOKEN=""; sessionStorage.removeItem("token"); setUser(null); }}>Выйти</Btn>
          </div>
        </div>
        <div style={{ maxWidth:1120, margin:"0 auto", padding:"14px 24px 0", display:"flex", gap:2, overflowX:"auto" }}>
          {nav.map(([k,label]) => (
            <button key={k} onClick={() => { setTab(k); if (k!=="meet") setOpenId(null); }} style={{
              fontFamily:disp, fontSize:12.5, fontWeight:800, letterSpacing:".07em", textTransform:"uppercase",
              padding:"11px 18px", cursor:"pointer", border:"none", whiteSpace:"nowrap",
              background:tab===k?C.paper:"transparent", color:tab===k?C.navy:"rgba(255,255,255,.75)",
              borderRadius:"6px 6px 0 0", boxShadow:tab===k?`inset 0 3px 0 ${C.red}`:"none" }}>{label}</button>))}
        </div>
      </div>

      <div style={{ maxWidth:1120, margin:"0 auto", padding:24 }}>
        {err && <div style={{ background:C.redSoft, border:`1px solid ${C.red}`, borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:13.5 }}>{err}</div>}

        {tab === "dash" && <Dashboard {...{ myActions, meetings, tasks, notif, readN, meetChip, taskChip, setTab, setOpenId, isDir, calendar, isSec, addEvent, delEvent }} />}
        {tab === "meet" && !open && <MeetingList {...{ meetings, meetChip, setOpenId, isSec, reload }} />}
        {tab === "meet" && open && <MeetingCard {...{ m:open, user, isSec, isMem, vote, comment, pickDate, setMStatus, uploadFile, download, meetChip, back:()=>setOpenId(null) }} />}
        {tab === "tasks" && <Tasks {...{ tasks, users, user, isSec, taskChip, setTStatus, taskNote, reload }} />}
        {tab === "arch" && <Archive {...{ meetings, download }} />}
        {tab === "audit" && isSec && <Audit audit={audit} />}

        <div style={{ textAlign:"center", fontSize:12, color:C.mute, padding:"8px 0 28px" }}>
          MARSHALL · Важна каждая деталь · MVP</div>
      </div>
    </div>);
}

/* ---- рабочий стол ---- */
/* ---- построение сетки месяца (недели начинаются с понедельника) ---- */
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0=Пн
  const gridStart = new Date(year, month, 1 - startOffset);
  const weeks = [];
  let cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: new Date(cursor), iso: isoOf(cursor), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getMonth() !== month && w >= 4) break; // не показываем лишнюю 6-ю неделю, если она уже за пределами месяца
  }
  return weeks;
}

function Calendar({ items, isSec, onAddEvent, onDelEvent, meetings, tasks, setTab, setOpenId }) {
  const now = new Date();
  const [vy, setVy] = useState(now.getFullYear());
  const [vm, setVm] = useState(now.getMonth());
  const [sel, setSel] = useState(todayIso);
  const [showAdd, setShowAdd] = useState(false);
  const [nf, setNf] = useState({ title:"", kind:"call", time:"" });

  const byDate = useMemo(() => { const m = {}; items.forEach(it => { (m[it.date] ||= []).push(it); }); return m; }, [items]);
  const weeks = useMemo(() => buildMonthGrid(vy, vm), [vy, vm]);
  const shift = (n) => { let m = vm + n, y = vy; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setVm(m); setVy(y); };

  const dayItems = (byDate[sel] || []).slice().sort((a,b) => (a.detail||"").localeCompare(b.detail||""));
  const selDate = new Date(sel + "T00:00:00");

  const goto = (it) => {
    if (it.ref.type === "meeting") { setOpenId(it.ref.id); setTab("meet"); }
    else if (it.ref.type === "task") setTab("tasks");
  };

  const addEvent = () => {
    if (!nf.title.trim()) { alert("Укажите название события."); return; }
    onAddEvent({ title: nf.title.trim(), kind: nf.kind, date: sel, time: nf.time, note: "" });
    setNf({ title:"", kind:"call", time:"" }); setShowAdd(false);
  };

  return (
    <div className="calendar-layout" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 300px", gap:20, marginBottom:20 }}>
      {/* сетка месяца */}
      <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:8, overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`2px solid ${C.red}` }}>
          <div style={{ fontFamily:disp, fontSize:16, fontWeight:800, color:C.navy, textTransform:"uppercase", letterSpacing:".04em" }}>
            {MONTHS[vm]} {vy}
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <Btn small onClick={()=>{ setVy(now.getFullYear()); setVm(now.getMonth()); setSel(todayIso); }}>Сегодня</Btn>
            <Btn small onClick={()=>shift(-1)}>←</Btn>
            <Btn small onClick={()=>shift(1)}>→</Btn>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${C.line}` }}>
          {WEEKDAYS.map((w,i) => (
            <div key={w} style={{ padding:"8px 0", textAlign:"center", fontSize:11.5, fontWeight:700, letterSpacing:".05em",
              color: i>=5 ? C.mute : C.soft, textTransform:"uppercase" }}>{w}</div>))}
        </div>
        <div>
          {weeks.map((week,wi) => (
            <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom: wi<weeks.length-1?`1px solid ${C.line}`:"none" }}>
              {week.map(cell => {
                const evs = byDate[cell.iso] || [];
                const isToday = cell.iso === todayIso, isSel = cell.iso === sel;
                return (
                  <div key={cell.iso} onClick={()=>setSel(cell.iso)} style={{
                    minHeight:78, padding:"6px 7px", cursor:"pointer", borderRight:`1px solid ${C.line}`,
                    background: isSel ? C.redSoft : "transparent", opacity: cell.inMonth ? 1 : 0.35,
                    boxShadow: isSel ? `inset 0 0 0 1.5px ${C.red}` : "none", position:"relative" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:13, fontWeight: isToday?800:600, color: isToday?C.red:C.ink,
                        width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center",
                        borderRadius:"50%", background: isToday ? "#fff" : "transparent",
                        boxShadow: isToday ? `0 0 0 1.5px ${C.red}` : "none" }}>{cell.date.getDate()}</span>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:2, marginTop:4 }}>
                      {evs.slice(0,3).map((e,i) => (
                        <div key={i} style={{ fontSize:10.5, fontWeight:700, color:"#fff", background:KIND[e.kind]?.color || C.mute,
                          borderRadius:2, padding:"1px 5px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {e.title}</div>))}
                      {evs.length > 3 && <div style={{ fontSize:10, color:C.mute, fontWeight:700 }}>+ ещё {evs.length-3}</div>}
                    </div>
                  </div>);
              })}
            </div>))}
        </div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", padding:"12px 20px", borderTop:`1px solid ${C.line}` }}>
          {Object.entries(KIND).map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.soft }}>
              <span style={{ width:9, height:9, borderRadius:2, background:v.color, display:"inline-block" }} />{v.label}</div>))}
        </div>
      </div>

      {/* панель выбранного дня */}
      <div style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:8, padding:18, alignSelf:"start" }}>
        <div style={{ fontFamily:disp, fontSize:14, fontWeight:800, color:C.navy, textTransform:"uppercase", marginBottom:2 }}>
          {selDate.toLocaleDateString("ru-RU", { day:"numeric", month:"long" })}
          {sel === todayIso && <span style={{ color:C.red }}> · сегодня</span>}
        </div>
        <div style={{ fontSize:12.5, color:C.mute, marginBottom:14 }}>
          {selDate.toLocaleDateString("ru-RU", { weekday:"long" })}</div>

        {!dayItems.length && <div style={{ fontSize:13.5, color:C.mute, marginBottom:14 }}>На этот день событий нет.</div>}
        {dayItems.map((it,i) => (
          <div key={i} onClick={()=> it.ref.type!=="event" && goto(it)} style={{
            padding:"9px 11px", marginBottom:8, borderRadius:5, background:KIND[it.kind]?.soft || C.paper,
            borderLeft:`3px solid ${KIND[it.kind]?.color || C.mute}`, cursor: it.ref.type!=="event" ? "pointer":"default" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:6 }}>
              <div style={{ fontSize:13.5, fontWeight:700, lineHeight:1.35 }}>{it.title}</div>
              {isSec && it.ref.type==="event" && (
                <button onClick={(e)=>{e.stopPropagation(); onDelEvent(it.ref.id);}} title="Удалить" style={{
                  border:"none", background:"none", color:C.mute, cursor:"pointer", fontSize:14, padding:0, lineHeight:1 }}>✕</button>)}
            </div>
            <div style={{ fontSize:12, color:C.soft, marginTop:2 }}>
              {it.detail && <span>{it.detail}</span>}{it.detail && it.time ? " · " : ""}{it.time && <span>{it.time}</span>}
            </div>
          </div>))}

        {isSec && (showAdd ? (
          <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.line}` }}>
            <Label>Название</Label>
            <input style={{ ...inp, marginBottom:8 }} value={nf.title} onChange={e=>setNf({...nf,title:e.target.value})}
              placeholder="Например: созвон с аудитором" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 90px", gap:8, marginBottom:10 }}>
              <select style={inp} value={nf.kind} onChange={e=>setNf({...nf,kind:e.target.value})}>
                <option value="call">Созвон</option><option value="interview">Интервью</option><option value="other">Иное событие</option>
              </select>
              <input style={inp} placeholder="ЧЧ:ММ" value={nf.time} onChange={e=>setNf({...nf,time:e.target.value})} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn small primary onClick={addEvent}>Добавить</Btn>
              <Btn small onClick={()=>setShowAdd(false)}>Отмена</Btn>
            </div>
          </div>
        ) : (
          <Btn small onClick={()=>setShowAdd(true)}>+ Добавить событие на этот день</Btn>
        ))}
      </div>
    </div>);
}

function Dashboard({ myActions, meetings, tasks, notif, readN, meetChip, taskChip, setTab, setOpenId, isDir, calendar, isSec, addEvent, delEvent }) {
  return (<>
    <Calendar items={calendar} isSec={isSec} onAddEvent={addEvent} onDelEvent={delEvent}
      meetings={meetings} tasks={tasks} setTab={setTab} setOpenId={setOpenId} />

    <Sect title="Требует вашего действия" extra={<Chip tone="red" solid>{myActions.length}</Chip>}>
      {!myActions.length && <div style={{ color:C.mute, fontSize:14 }}>Все действия выполнены. Новых задач нет.</div>}
      {myActions.map((a,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:14,
          padding:"13px 16px", marginBottom:8, background:C.redSoft, borderLeft:`4px solid ${C.red}`, borderRadius:"0 6px 6px 0" }}>
          <div><div style={{ fontWeight:700, fontSize:14.5, lineHeight:1.35 }}>{a.t}</div>
            <div style={{ fontSize:12.5, color:C.soft, marginTop:3 }}>{a.s}</div></div>
          <Btn small primary onClick={a.go}>Перейти</Btn>
        </div>))}
    </Sect>

    <Sect title="Уведомления" extra={<Chip>{notif.filter(n=>!n.is_read).length} новых</Chip>}>
      {notif.map(n => (
        <div key={n.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.line}` }}>
          <span style={{ width:8, height:8, borderRadius:8, background:n.is_read?C.line:C.red, flexShrink:0 }} />
          <div style={{ fontSize:14, color:n.is_read?C.mute:C.ink, flex:1 }}>{n.text} <span style={{ fontSize:11.5, color:C.mute }}>· {n.at}</span></div>
          {!n.is_read && <Btn small onClick={()=>readN(n.id)}>Прочитано</Btn>}
        </div>))}
      {!notif.length && <div style={{ color:C.mute, fontSize:14 }}>Уведомлений нет.</div>}
    </Sect>
  </>);
}

/* ---- реестр заседаний + форма создания ---- */
function MeetingList({ meetings, meetChip, setOpenId, isSec, reload }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ number:"", form:"Заочная (опросным путём)", date:"", vote_deadline:"", quorum:3, agendaText:"", schedText:"" });
  const create = async () => {
    const agenda = f.agendaText.split("\n").map(s=>s.trim()).filter(Boolean).map(title=>({ title }));
    if (!f.number || !f.date || !agenda.length) { alert("Заполните номер, дату и хотя бы один вопрос повестки (каждый — с новой строки)."); return; }
    try {
      await api("/meetings", { method:"POST", json:{ number:f.number, form:f.form, date:f.date, vote_deadline:f.vote_deadline,
        quorum:Number(f.quorum), agenda, schedule_options:f.schedText.split("\n").map(s=>s.trim()).filter(Boolean) } });
      setShow(false); setF({ ...f, number:"", date:"", agendaText:"", schedText:"" }); reload();
    } catch (e) { alert(e.message); }
  };
  return (
    <Sect title="Реестр заседаний" extra={isSec && <Btn small primary onClick={()=>setShow(v=>!v)}>{show?"Свернуть":"+ Новое заседание"}</Btn>}>
      {isSec && show && (
        <div style={{ background:C.paper, border:`1px solid ${C.line}`, borderRadius:6, padding:18, marginBottom:18 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <div><Label>Номер</Label><input style={inp} placeholder="СД-09/2026" value={f.number} onChange={e=>setF({...f,number:e.target.value})}/></div>
            <div><Label>Форма</Label><select style={inp} value={f.form} onChange={e=>setF({...f,form:e.target.value})}>
              <option>Заочная (опросным путём)</option><option>Очная</option></select></div>
            <div><Label>Дата</Label><input style={inp} placeholder="ДД.ММ.ГГГГ" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></div>
            <div><Label>Голоса до</Label><input style={inp} placeholder="ДД.ММ.ГГГГ ЧЧ:ММ" value={f.vote_deadline} onChange={e=>setF({...f,vote_deadline:e.target.value})}/></div>
          </div>
          <Label>Повестка (каждый вопрос — с новой строки)</Label>
          <textarea rows={3} style={{ ...inp, resize:"vertical", marginBottom:12 }} value={f.agendaText} onChange={e=>setF({...f,agendaText:e.target.value})}/>
          <Label>Варианты даты для согласования (необязательно, каждый — с новой строки)</Label>
          <textarea rows={2} style={{ ...inp, resize:"vertical", marginBottom:14 }} value={f.schedText} onChange={e=>setF({...f,schedText:e.target.value})}/>
          <Btn primary onClick={create}>Создать заседание</Btn>
        </div>)}
      {meetings.map(m => (
        <div key={m.id} onClick={()=>setOpenId(m.id)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"14px 2px", borderBottom:`1px solid ${C.line}`, cursor:"pointer", gap:10 }}>
          <div><div style={{ fontFamily:disp, fontSize:15, fontWeight:800, color:C.navy }}>{m.number}</div>
            <div style={{ fontSize:13, color:C.soft, marginTop:2 }}>{m.form} · {m.date}{m.vote_deadline?` · голоса до ${m.vote_deadline}`:""}</div></div>
          {meetChip(m)}
        </div>))}
    </Sect>);
}

/* ---- карточка заседания ---- */
function MeetingCard({ m, user, isSec, isMem, vote, comment, pickDate, setMStatus, uploadFile, download, meetChip, back }) {
  const [txt, setTxt] = useState({});
  const fileRef = React.useRef({});
  return (<>
    <button onClick={back} style={{ border:"none", background:"none", color:C.red, fontSize:13.5, fontWeight:700, cursor:"pointer", padding:0, marginBottom:14, fontFamily:sans }}>← К реестру заседаний</button>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:18 }}>
      <div>
        <div style={{ fontFamily:disp, fontSize:22, fontWeight:800, color:C.navy, textTransform:"uppercase" }}>Заседание {m.number}</div>
        <div style={{ fontSize:14, color:C.soft, marginTop:5 }}>{m.form} · {m.date}{m.vote_deadline?` · приём голосов до ${m.vote_deadline}`:""} · Кворум: {m.quorum}</div>
      </div>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        {meetChip(m)}
        {isSec && m.status==="planned" && <Btn small primary onClick={()=>setMStatus(m.id,"voting")}>Открыть голосование</Btn>}
        {isSec && m.status==="voting" && <Btn small onClick={()=>setMStatus(m.id,"closed")}>Завершить голосование</Btn>}
      </div>
    </div>

    {m.schedule_poll && (
      <Sect title="Согласование даты заседания" accent>
        {m.schedule_poll.options.map((opt,i) => {
          const cnt = m.schedule_poll.answers.filter(a=>a.option===i).length;
          const mine = m.schedule_poll.my_answer === i;
          return (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 2px", borderBottom:`1px solid ${C.line}`, gap:10 }}>
              <div style={{ fontSize:14.5, fontWeight:mine?700:400 }}>{opt} {mine && <Chip tone="red">Ваш выбор</Chip>}</div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:12.5, color:C.soft }}>{cnt} голос(ов)</span>
                {isMem && <Btn small primary={!mine} disabled={mine} onClick={()=>pickDate(m.id,i)}>Выбрать</Btn>}
              </div>
            </div>);
        })}
      </Sect>)}

    {m.agenda.map(q => {
      const za = q.votes.filter(v=>v.value==="за").length, pr = q.votes.filter(v=>v.value==="против").length,
            vz = q.votes.filter(v=>v.value==="воздержался").length;
      return (
        <div key={q.id} style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius:8, marginBottom:16, overflow:"hidden" }}>
          <div style={{ display:"flex", gap:16, padding:"16px 20px", borderBottom:`1px solid ${C.line}`, alignItems:"flex-start" }}>
            <div style={{ background:C.navy, color:"#fff", fontFamily:disp, fontWeight:800, fontSize:16, borderRadius:4, padding:"6px 11px", flexShrink:0 }}>{q.number}</div>
            <div><div style={{ fontSize:15.5, fontWeight:700, lineHeight:1.4, color:C.navy }}>{q.title}</div>
              {q.speaker && <div style={{ fontSize:12.5, color:C.mute, marginTop:4 }}>Докладчик: {q.speaker}</div>}</div>
          </div>
          <div style={{ padding:20 }}>
            <Label>Материалы</Label>
            {!q.materials.length && <div style={{ fontSize:13.5, color:C.mute, marginBottom:10 }}>Материалы ещё не загружены.</div>}
            {q.materials.map(f => (
              <div key={f.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px dashed ${C.line}`, fontSize:14, gap:8 }}>
                <div>📄 <a href="#" onClick={e=>{e.preventDefault();download(`/materials/${f.id}`, f.filename);}} style={{ color:C.navy, fontWeight:700 }}>{f.filename}</a> <Chip>v{f.version}</Chip></div>
                <span style={{ color:C.mute, fontSize:12.5 }}>{f.at}</span>
              </div>))}
            {isSec && (<div style={{ marginTop:10 }}>
              <input type="file" ref={el=>fileRef.current[q.id]=el} style={{ display:"none" }}
                onChange={e=>{ if(e.target.files[0]) uploadFile(`/agenda/${q.id}/materials`, e.target.files[0]); e.target.value=""; }} />
              <Btn small onClick={()=>fileRef.current[q.id]?.click()}>+ Загрузить материал</Btn>
            </div>)}

            <div style={{ marginTop:18 }}><Label>Вопросы и комментарии до заседания</Label></div>
            {!q.comments.length && <div style={{ fontSize:13.5, color:C.mute }}>Комментариев нет.</div>}
            {q.comments.map((c,i) => (
              <div key={i} style={{ fontSize:14, padding:"10px 14px", background:C.paper, borderLeft:`3px solid ${C.navy}`, borderRadius:"0 4px 4px 0", marginBottom:6, lineHeight:1.45 }}>
                <b>{c.user}</b> <span style={{ color:C.mute, fontSize:12 }}>· {c.at}</span><br/>{c.text}
              </div>))}
            {(isMem || isSec) && m.status!=="closed" && (
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <input style={{ ...inp, flex:1 }} placeholder="Вопрос или комментарий к материалам…" value={txt[q.id]||""}
                  onChange={e=>setTxt(t=>({...t,[q.id]:e.target.value}))} />
                <Btn small onClick={()=>{ if((txt[q.id]||"").trim()){ comment(q.id, txt[q.id]); setTxt(t=>({...t,[q.id]:""})); } }}>Добавить</Btn>
              </div>)}

            <div style={{ marginTop:18 }}><Label>Голосование</Label></div>
            <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              {m.status==="voting" && isMem && (q.my_vote
                ? <Chip tone="ok" solid>Ваш голос: {q.my_vote}</Chip>
                : ["за","против","воздержался"].map(v =>
                    <Btn key={v} small primary={v==="за"} onClick={()=>vote(q.id,v)}>{v[0].toUpperCase()+v.slice(1)}</Btn>))}
              <span style={{ fontSize:13.5, color:C.soft }}>Голосов: <b style={{ color:C.ink }}>{q.votes.length}</b> · за — {za} · против — {pr} · возд. — {vz}</span>
              {q.votes.length >= m.quorum ? <Chip tone="ok">Кворум есть</Chip> : <Chip tone="warn">Кворум не набран</Chip>}
            </div>
            {isSec && q.votes.length > 0 && (
              <div style={{ marginTop:10, fontSize:13, color:C.soft }}>
                Проголосовали: {q.votes.map(v=>`${v.user} («${v.value}»)`).join(", ")}.</div>)}
          </div>
        </div>);
    })}

    <Sect title="Протокол заседания">
      {m.protocol_file
        ? <div style={{ fontSize:14.5, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            📄 <a href="#" onClick={e=>{e.preventDefault();download(`/meetings/${m.id}/protocol`, "Протокол " + m.number + ".pdf");}}
              style={{ color:C.navy, fontWeight:700 }}>Протокол {m.number}</a>
            <Chip tone="ok" solid>Решения зафиксированы</Chip></div>
        : m.status==="closed"
          ? isSec
            ? (<div><input type="file" id="protocolFile" style={{ display:"none" }}
                 onChange={e=>{ if(e.target.files[0]) uploadFile(`/meetings/${m.id}/protocol`, e.target.files[0]); e.target.value=""; }} />
               <Btn primary onClick={()=>document.getElementById("protocolFile").click()}>Загрузить протокол</Btn></div>)
            : <div style={{ color:C.mute, fontSize:14 }}>Протокол готовится корпоративным секретарём.</div>
          : <div style={{ color:C.mute, fontSize:14 }}>Протокол загружается секретарём после завершения заседания.</div>}
    </Sect>
  </>);
}

/* ---- поручения ---- */
function Tasks({ tasks, users, user, isSec, taskChip, setTStatus, taskNote, reload }) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title:"", assignee_id:"", deadline:"", basis:"" });
  const [note, setNote] = useState({});
  // исполнители: в первую очередь функциональные директора, затем члены СД
  const assignees = [...users.filter(u=>u.role==="director"), ...users.filter(u=>u.role==="member")];
  const create = async () => {
    if (!f.title.trim() || !f.deadline.trim() || !f.assignee_id) { alert("Заполните формулировку, исполнителя и срок."); return; }
    try { await api("/tasks", { method:"POST", json:{ ...f, assignee_id:Number(f.assignee_id) } });
      setShow(false); setF({ title:"", assignee_id:"", deadline:"", basis:"" }); reload();
    } catch (e) { alert(e.message); }
  };
  return (<>
    <Sect title="Организационные вопросы и поручения" accent
      extra={isSec && <Btn small primary onClick={()=>setShow(v=>!v)}>{show?"Свернуть форму":"+ Новое поручение"}</Btn>}>
      {isSec && show && (
        <div style={{ background:C.paper, border:`1px solid ${C.line}`, borderRadius:6, padding:18, marginBottom:20 }}>
          <Label>Формулировка поручения</Label>
          <textarea rows={2} style={{ ...inp, resize:"vertical", marginBottom:12 }} value={f.title}
            placeholder="Например: подготовить справку о судебной практике по оспариванию решений СД…"
            onChange={e=>setF({...f,title:e.target.value})}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
            <div><Label>Исполнитель</Label>
              <select style={inp} value={f.assignee_id} onChange={e=>setF({...f,assignee_id:e.target.value})}>
                <option value="">— выберите —</option>
                {assignees.map(u=><option key={u.id} value={u.id}>{u.name} — {u.position}</option>)}
              </select></div>
            <div><Label>Срок исполнения</Label><input style={inp} placeholder="ДД.ММ.ГГГГ" value={f.deadline} onChange={e=>setF({...f,deadline:e.target.value})}/></div>
            <div><Label>Основание</Label><input style={inp} placeholder="Решение СД / поручение председателя…" value={f.basis} onChange={e=>setF({...f,basis:e.target.value})}/></div>
          </div>
          <Btn primary onClick={create}>Создать поручение</Btn>
        </div>)}

      {tasks.map(t => (
        <div key={t.id} style={{ border:`1px solid ${C.line}`, borderRadius:6, padding:16, marginBottom:12, background:"#fff" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start", flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:260 }}>
              <div style={{ fontSize:14.5, fontWeight:700, lineHeight:1.4, color:C.navy }}>{t.title}</div>
              <div style={{ fontSize:12.5, color:C.soft, marginTop:6 }}>
                Исполнитель: <b style={{ color:C.ink }}>{t.assignee}</b> · Срок: <b style={{ color:C.ink }}>{t.deadline}</b>{t.basis?` · Основание: ${t.basis}`:""}</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              {taskChip(t)}
              {t.assignee_id===user.id && t.status==="new" && <Btn small onClick={()=>setTStatus(t.id,"work")}>Взять в работу</Btn>}
              {t.assignee_id===user.id && t.status==="work" && <Btn small primary onClick={()=>setTStatus(t.id,"done")}>Отметить исполненным</Btn>}
              {isSec && t.status==="done" && (<>
                <Btn small primary onClick={()=>setTStatus(t.id,"accepted")}>Принять исполнение</Btn>
                <Btn small onClick={()=>setTStatus(t.id,"work")}>Вернуть в работу</Btn></>)}
            </div>
          </div>
          {t.updates.length > 0 && (
            <div style={{ marginTop:12 }}>{t.updates.map((u,i) => (
              <div key={i} style={{ fontSize:13.5, padding:"8px 12px", background:C.paper, borderLeft:`3px solid ${C.lineStrong}`, borderRadius:"0 4px 4px 0", marginBottom:5, lineHeight:1.4 }}>
                <b>{u.user}</b> <span style={{ color:C.mute, fontSize:11.5 }}>· {u.at}</span><br/>{u.text}</div>))}
            </div>)}
          {(t.assignee_id===user.id || isSec) && t.status!=="accepted" && (
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <input style={{ ...inp, flex:1 }} placeholder="Отчёт о ходе исполнения / комментарий…" value={note[t.id]||""}
                onChange={e=>setNote(n=>({...n,[t.id]:e.target.value}))}/>
              <Btn small onClick={()=>{ if((note[t.id]||"").trim()){ taskNote(t.id, note[t.id]); setNote(n=>({...n,[t.id]:""})); } }}>Добавить</Btn>
            </div>)}
        </div>))}
      {!tasks.length && <div style={{ color:C.mute, fontSize:14 }}>Поручений нет.</div>}
    </Sect>
    <div style={{ fontSize:12.5, color:C.mute, margin:"-8px 0 20px 4px" }}>
      Жизненный цикл: <b>Новое → В работе → Исполнено → Принято секретарём</b>. Секретарь может вернуть поручение в работу. Все изменения фиксируются в журнале.</div>
  </>);
}

/* ---- архив и журнал ---- */
function Archive({ meetings, download }) {
  const [q, setQ] = useState("");
  const closed = meetings.filter(m => m.status === "closed" &&
    (m.number + " " + m.agenda.map(a=>a.title).join(" ")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Sect title="Архив заседаний и документов"
      extra={<input placeholder="Поиск по номеру, теме…" style={{ ...inp, width:280, padding:"7px 12px" }} value={q} onChange={e=>setQ(e.target.value)}/>}>
      {closed.map(m => (
        <div key={m.id} style={{ padding:"13px 2px", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
            <div style={{ fontFamily:disp, fontSize:15, fontWeight:800, color:C.navy }}>{m.number} · {m.date}</div>
            <Chip tone="ok">Завершено</Chip></div>
          <div style={{ fontSize:13.5, color:C.soft, marginTop:5, lineHeight:1.45 }}>{m.agenda.map(a=>`${a.number}. ${a.title}`).join("  ·  ")}</div>
          {m.protocol_file && <div style={{ fontSize:13.5, marginTop:6 }}>
            📄 <a href="#" onClick={e=>{e.preventDefault();download(`/meetings/${m.id}/protocol`, "Протокол " + m.number + ".pdf");}}
              style={{ color:C.navy, fontWeight:700 }}>Протокол {m.number}</a></div>}
        </div>))}
      {!closed.length && <div style={{ color:C.mute }}>Ничего не найдено.</div>}
    </Sect>);
}

function Audit({ audit }) {
  return (
    <Sect title="Журнал действий (аудит-лог)">
      <div style={{ fontSize:12.5, color:C.mute, marginBottom:14 }}>Фиксируются все значимые действия. Журнал доступен только для чтения.</div>
      {audit.map((a,i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"140px 200px 1fr", gap:12, fontSize:13.5, padding:"9px 0", borderBottom:`1px solid ${C.line}` }}>
          <span style={{ color:C.mute }}>{a.at}</span>
          <b style={{ color:C.navy }}>{a.user}</b>
          <span>{a.action}</span>
        </div>))}
    </Sect>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
