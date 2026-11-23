"use strict";
// On lemonadestand.ee the API lives on the Worker; elsewhere (workers.dev, localhost) it is same-origin.
const API = location.hostname.endsWith("lemonadestand.ee") ? "https://fyysika.tervis-nutrition.workers.dev" : "";
const $app = document.getElementById("app");
const $nav = document.getElementById("nav");

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("fy_" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("fy_" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("fy_" + k); } catch {} },
};
let META = null;

// ------------------------------------------------------------ api
async function api(path, body) {
  const headers = { "Content-Type": "application/json" };
  const tok = store.get("token");
  if (tok) headers.Authorization = "Bearer " + tok;
  const res = await fetch(API + "/api" + path, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/login") { logout(); throw new Error("Logi uuesti sisse"); }
  if (!res.ok) throw new Error(data.error || "Viga " + res.status);
  return data;
}

// Streams tutor text into onText; resolves with the full reply.
async function tutor(body, onText) {
  const res = await fetch(API + "/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + store.get("token") },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error("Õpetajaga ei saanud ühendust");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (!line.startsWith("data:")) continue;
      const ev = JSON.parse(line.slice(5));
      if (ev.t) { full += ev.t; onText(full); }
      if (ev.error) throw new Error(ev.error);
    }
  }
  return full;
}

// ------------------------------------------------------------ rendering helpers
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// Markdown + LaTeX: protect math from the markdown parser, then let KaTeX render it.
function rich(text) {
  const math = [];
  let s = String(text || "").replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m) => { math.push(m); return `@@M${math.length - 1}@@`; });
  s = window.marked ? marked.parse(s, { breaks: true }) : esc(s).replace(/\n/g, "<br>");
  return s.replace(/@@M(\d+)@@/g, (_, i) => esc(math[+i]));
}
function typeset(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });
  }
}
function setRich(el, text) { el.innerHTML = rich(text); typeset(el); }

const fmtNum = (x) => String(Number(Number(x).toPrecision(3))).replace(".", ",");
const pct = (rating) => Math.max(0, Math.min(100, Math.round(((rating - 0.5) / 5) * 100)));
const levelName = (r) => (r < 1.5 ? "algaja" : r < 2.5 ? "põhitase" : r < 3.5 ? "kooliolümpiaad" : r < 4.5 ? "piirkonnavoor" : "lõppvoor");
const daysTo = (d) => Math.ceil((new Date(d + "T09:00:00+02:00") - Date.now()) / 86400e3);

// ------------------------------------------------------------ active-time heartbeat
let lastInput = Date.now();
["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => addEventListener(e, () => (lastInput = Date.now()), { passive: true }));
setInterval(() => {
  if (!store.get("token") || document.hidden) return;
  if (Date.now() - lastInput > 3 * 60e3) return; // idle: reading a long explanation still counts for 3 min
  api("/heartbeat", { seconds: 30 }).catch(() => {});
}, 30e3);

// ------------------------------------------------------------ router
function logout() { store.del("token"); store.del("me"); META = null; location.hash = "#/login"; }

async function route() {
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs || "");
  const me = store.get("me");
  if (!store.get("token") && path !== "/login") { location.hash = "#/login"; return; }
  if (store.get("token") && !META) {
    try { META = await api("/meta"); } catch (e) { $app.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  }
  renderNav(path, me);
  window.scrollTo(0, 0);
  try {
    if (path === "/login") return await viewLogin();
    if (path === "/practice") return await viewPractice(params);
    if (path === "/cards") return viewCards(params);
    if (path === "/ask") return viewAsk();
    if (path === "/parent") return await viewParent();
    return me?.role === "parent" && !params.has("own") ? await viewParent() : await viewHome();
  } catch (e) {
    $app.innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p><button onclick="location.reload()">Proovi uuesti</button></div>`;
  }
}
function renderNav(path, me) {
  if (!me) { $nav.innerHTML = ""; return; }
  const links = me.role === "parent"
    ? [["/parent", "Ülevaade"], ["/?own=1", "Proovi ise"], ["/cards", "Teooria"]]
    : [["/", "Kodu"], ["/cards", "Teooria"], ["/ask", "Küsi"]];
  $nav.innerHTML = links.map(([href, label]) => `<a href="#${href}" class="${path === href.split("?")[0] ? "on" : ""}">${label}</a>`).join("");
}
addEventListener("hashchange", route);
addEventListener("DOMContentLoaded", route);

// ------------------------------------------------------------ login
async function viewLogin() {
  const profiles = await api("/profiles");
  $app.innerHTML = `<h1>Kes õpib?</h1><div class="profiles">${profiles.map((p) =>
    `<button data-id="${esc(p.id)}">${esc(p.name)}<small>${p.role === "student" ? "õpilane" : "vanem"}${p.has_pin ? "" : " · uus"}</small></button>`).join("")}</div>`;
  $app.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => pinStep(profiles.find((p) => p.id === b.dataset.id))));
}
function pinStep(p) {
  $app.innerHTML = `<h1>${esc(p.name)}</h1>
    <div class="card"><p>${p.has_pin ? "Sisesta oma PIN." : "Esimene kord: vali endale PIN (4–8 numbrit). Jäta see meelde!"}</p>
    <input class="pin" id="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="8">
    ${p.has_pin ? "" : `<input class="pin" id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" placeholder="korda" maxlength="8" style="margin-top:8px">`}
    <p class="err" id="perr"></p><button class="block" id="go">${p.has_pin ? "Sisene" : "Salvesta PIN"}</button>
    <p class="center"><a href="#/login" class="muted small" onclick="setTimeout(route)">← tagasi</a></p></div>`;
  const pin = document.getElementById("pin");
  pin.focus();
  const go = async () => {
    const err = document.getElementById("perr");
    if (!p.has_pin && pin.value !== document.getElementById("pin2").value) { err.textContent = "PIN-id ei ühti"; return; }
    try {
      const r = await api("/login", { profile: p.id, pin: pin.value });
      store.set("token", r.token); store.set("me", r.profile); META = null;
      location.hash = r.profile.role === "parent" ? "#/parent" : "#/";
    } catch (e) { err.textContent = e.message; pin.value = ""; pin.focus(); }
  };
  document.getElementById("go").onclick = go;
  $app.querySelectorAll(".pin").forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }));
}

// ------------------------------------------------------------ home
async function viewHome() {
  const me = store.get("me");
  const s = await api("/summary");
  const next = META.events.find((e) => daysTo(e.date) >= 0);
  const mins = Math.round(s.today.seconds / 60);
  const p = Math.min(100, Math.round((mins / s.today.goalMin) * 100));
  const subsByTopic = {};
  for (const [k, sub] of Object.entries(META.subtopics)) (subsByTopic[sub.topic] ||= []).push([k, sub]);

  $app.innerHTML = `
    <h1>Tere, ${esc(me.name)}!</h1>
    <div class="card row">
      <div class="ring" style="--p:${p}"><div>${mins}<small>/ ${s.today.goalMin} min</small></div></div>
      <div class="grow">
        ${next ? `<div><b>${esc(next.title)}</b> <span class="muted">${daysTo(next.date)} päeva pärast</span></div>` : ""}
        <div class="muted small">${s.streak ? `🔥 ${s.streak} päeva järjest` : "Täna on hea päev alustamiseks"}${s.dueReviews ? ` · ${s.dueReviews} kordamist ootab` : ""}</div>
        <a class="btn block accent" style="margin-top:10px" href="#/practice">${mins ? "Jätka trenni" : "Alusta tänast trenni"}</a>
      </div>
    </div>
    ${Object.entries(subsByTopic).map(([t, subs]) => `
      <h2>${esc(META.topics[t])}</h2>
      <div class="card">
        ${subs.map(([k, sub]) => { const st = s.subtopics[k]; return `
          <a class="sub" href="#/practice?subtopic=${k}">
            <div class="row"><span class="grow">${esc(sub.title)}</span><span class="muted small">${levelName(st.rating)}</span></div>
            <div class="bar"><i style="width:${pct(st.rating)}%"></i></div>
            <div class="muted small">${st.done}/${st.total} lahendatud</div>
          </a>`; }).join("")}
        <a class="btn ghost block" style="margin-top:8px" href="#/practice?topic=${t}">Harjuta kõike: ${esc(META.topics[t].toLowerCase())}</a>
      </div>`).join("")}
    <h2>Nädal</h2>
    <div class="card grid2">
      <div><div class="stat">${s.week.minutes}</div><div class="muted small">minutit</div></div>
      <div><div class="stat">${s.week.solved}</div><div class="muted small">ülesannet${s.week.cleanRate != null ? `, ${Math.round(s.week.cleanRate * 100)}% puhtalt` : ""}</div></div>
    </div>
    <p class="center muted small"><a href="#" id="out" class="muted">Logi välja</a></p>`;
  document.getElementById("out").onclick = (e) => { e.preventDefault(); logout(); };
}

// ------------------------------------------------------------ practice
async function viewPractice(params) {
  const qs = new URLSearchParams();
  if (params.get("topic")) qs.set("topic", params.get("topic"));
  if (params.get("subtopic")) qs.set("subtopic", params.get("subtopic"));
  const { q, review } = params.get("id") ? await api("/question?id=" + params.get("id")) : await api("/next?" + qs);
  const sub = META.subtopics[q.subtopic];
  const card = META.cards.find((c) => c.subtopic === q.subtopic);
  const st = { tries: 0, hints: 0, wrong: [], start: Date.now(), done: false, chat: [] };

  $app.innerHTML = `
    <div class="row wrap small" style="margin-bottom:6px">
      <span class="badge">Tase ${q.level}</span>${review ? `<span class="badge review">Kordamine</span>` : ""}
      <span class="muted">${esc(sub.title)}</span>
    </div>
    <div class="card">
      <div class="qtext" id="qt"></div>
      <div class="answer-row" id="ansrow">
        <input id="ans" inputmode="decimal" autocomplete="off" placeholder="Vastus">
        <span class="unit">${esc(q.unit)}</span>
        <button id="check">Kontrolli</button>
      </div>
      <div id="fb"></div>
      <div class="tools" id="tools">
        <button class="soft" data-mode="hint">💡 Vihje</button>
        <button class="soft" data-mode="teach">🧑‍🏫 Õpeta mind</button>
        <button class="ghost" id="reveal">Näita lahendust</button>
      </div>
      <div id="after"></div>
      <div class="chat" id="chat"></div>
      <div class="ask-row"><textarea id="askq" placeholder="Küsi midagi selle ülesande kohta…"></textarea><button id="asksend">Saada</button></div>
    </div>
    ${card ? `<details class="card"><summary><b>Teooria: ${esc(card.title)}</b></summary><div id="cardbody" style="margin-top:8px"></div></details>` : ""}
    <p class="small muted center">${q.source && q.source !== "koostatud" ? "Allikas: " + esc(q.source) : ""}</p>`;
  setRich(document.getElementById("qt"), q.text);
  if (card) setRich(document.getElementById("cardbody"), card.body);

  const $ans = document.getElementById("ans"), $fb = document.getElementById("fb"), $chat = document.getElementById("chat");
  const ctx = () => ({ wrong: st.wrong, hints: st.hints });

  async function ask(mode, text) {
    if (text) { st.chat.push({ role: "user", content: text }); $chat.append(h(`<div class="msg me">${esc(text)}</div>`)); }
    const bubble = h(`<div class="msg tutor cursor">…</div>`);
    $chat.append(bubble);
    bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setBusy(true);
    try {
      const reply = await tutor({ qid: q.id, mode: st.done ? "explain" : mode, ctx: ctx(), messages: st.chat }, (t) => setRich(bubble, t));
      st.chat.push({ role: "assistant", content: reply });
    } catch (e) { bubble.innerHTML = `<span class="err">${esc(e.message)}</span>`; st.chat.pop(); }
    bubble.classList.remove("cursor");
    setBusy(false);
  }
  function setBusy(b) { $app.querySelectorAll("#tools button, #asksend").forEach((x) => (x.disabled = b)); }

  async function finish(outcome) {
    st.done = true;
    const r = await api("/complete", { qid: q.id, outcome, tries: Math.max(1, st.tries), hints: st.hints, wrong: st.wrong, seconds: Math.round((Date.now() - st.start) / 1000) });
    document.getElementById("ansrow").style.display = "none";
    document.getElementById("tools").innerHTML = `<button class="soft" data-x="simpler">Selgita lihtsamalt</button><button class="soft" data-x="why">Miks just nii?</button><button class="soft" data-x="more">Räägi rohkem</button>`;
    const prompts = { simpler: "Selgita seda lahendust palun lihtsamalt, nagu sõbrale.", why: "Miks tuli just nii lahendada? Kuidas ma järgmine kord ise selle peale tulen?", more: "Räägi mulle selle teema kohta rohkem. Kus seda päriselus kasutatakse?" };
    document.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => ask("explain", prompts[b.dataset.x])));
    const after = document.getElementById("after");
    after.innerHTML = `
      <div class="solution"><b>Vastus: ${fmtNum(r.answer.value)} ${esc(r.answer.unit)}</b><div id="sol"></div></div>
      <p class="small muted" style="margin-top:8px">Tase: ${levelName(r.rating)} ${r.delta >= 0 ? "▲" : "▼"}</p>
      <a class="btn block" id="nextq" href="#">Järgmine ülesanne →</a>`;
    setRich(document.getElementById("sol"), r.solution);
    document.getElementById("nextq").onclick = (e) => { e.preventDefault(); route(); };
  }

  document.getElementById("check").onclick = async () => {
    const v = $ans.value.trim();
    if (!v) return $ans.focus();
    try {
      const r = await api("/check", { qid: q.id, value: v });
      st.tries++;
      if (r.correct) {
        $fb.innerHTML = `<div class="feedback good">Õige! ${st.tries === 1 && !st.hints ? "Esimese korraga 🎯" : ""}</div>`;
        await finish("correct");
      } else {
        st.wrong.push(v + " " + q.unit);
        $fb.innerHTML = `<div class="feedback bad">Pole päris õige (${st.tries}. katse). Kontrolli ühikuid ja arvutust või küsi vihjet.</div>`;
        $ans.select();
      }
    } catch (e) { $fb.innerHTML = `<div class="feedback bad">${esc(e.message)}</div>`; }
  };
  $ans.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("check").click(); });
  document.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
    if (b.dataset.mode === "hint") st.hints++;
    else st.hints += 2; // a full lesson counts as two hints for the level estimate
    ask(b.dataset.mode, b.dataset.mode === "hint" ? (st.hints > 1 ? "Anna palun veel üks vihje." : "Anna palun vihje.") : "Mul pole aimugi, kust alustada. Õpeta mind, aga ära ütle vastust.");
  }));
  document.getElementById("reveal").onclick = () => { if (confirm("Näidata lahendust? Ülesanne tuleb hiljem kordamiseks tagasi.")) finish("revealed"); };
  const $askq = document.getElementById("askq");
  document.getElementById("asksend").onclick = () => { const t = $askq.value.trim(); if (t) { $askq.value = ""; ask("chat", t); } };
}

// ------------------------------------------------------------ theory cards
function viewCards(params) {
  const open = params.get("id");
  $app.innerHTML = `<h1>Teooria</h1>` + Object.entries(META.topics).map(([t, title]) => `
    <h2>${esc(title)}</h2>` + META.cards.filter((c) => META.subtopics[c.subtopic].topic === t).map((c) => `
    <details class="card" ${open === c.id ? "open" : ""}><summary><b>${esc(c.title)}</b></summary>
      <div data-card="${c.id}" style="margin-top:8px"></div>
      <div class="row" style="margin-top:10px"><a class="btn ghost grow" href="#/practice?subtopic=${c.subtopic}">Harjuta</a><a class="btn ghost grow" href="#/ask?about=${c.id}">Küsi selle kohta</a></div>
    </details>`).join("")).join("");
  $app.querySelectorAll("[data-card]").forEach((el) => setRich(el, META.cards.find((c) => c.id === el.dataset.card).body));
}

// ------------------------------------------------------------ free chat
function viewAsk() {
  const about = new URLSearchParams(location.hash.split("?")[1] || "").get("about");
  const card = META.cards.find((c) => c.id === about);
  const chat = [];
  $app.innerHTML = `<h1>Küsi õpetajalt</h1>
    <p class="muted">Küsi ükskõik mida füüsika või matemaatika kohta. Näiteks: „Mis vahe on soojusel ja temperatuuril?“</p>
    <div class="chat" id="chat"></div>
    <div class="ask-row"><textarea id="askq" placeholder="Sinu küsimus…"></textarea><button id="asksend">Saada</button></div>`;
  const $chat = document.getElementById("chat"), $q = document.getElementById("askq"), $b = document.getElementById("asksend");
  if (card) $q.value = `Selgita mulle teemat „${card.title}“ lihtsalt ja too näide.`;
  $b.onclick = async () => {
    const t = $q.value.trim();
    if (!t) return;
    $q.value = "";
    chat.push({ role: "user", content: t });
    $chat.append(h(`<div class="msg me">${esc(t)}</div>`));
    const bubble = h(`<div class="msg tutor cursor">…</div>`);
    $chat.append(bubble);
    $b.disabled = true;
    try { chat.push({ role: "assistant", content: await tutor({ mode: "free", messages: chat }, (x) => setRich(bubble, x)) }); }
    catch (e) { bubble.innerHTML = `<span class="err">${esc(e.message)}</span>`; chat.pop(); }
    bubble.classList.remove("cursor");
    $b.disabled = false;
  };
}

// ------------------------------------------------------------ parent
async function viewParent() {
  const me = store.get("me");
  if (me.role !== "parent") { location.hash = "#/"; return; }
  const { students } = await api("/parent");
  const profiles = await api("/profiles");
  $app.innerHTML = students.map((s) => {
    const sm = s.summary;
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() + 2 * 3600e3 - i * 86400e3).toISOString().slice(0, 10);
      const m = Math.round((sm.days[d] || 0) / 60);
      days.push(`<i class="${m >= s.daily_goal_min ? "goal" : ""}" title="${d}: ${m} min" style="height:${Math.min(100, (m / Math.max(s.daily_goal_min, 1)) * 100)}%"></i>`);
    }
    return `
    <h1>${esc(s.name)}</h1>
    <div class="card advice ${sm.advice.level}"><b>Soovitus</b><p>${esc(sm.advice.text)}</p></div>
    <div class="card grid2">
      <div><div class="stat">${Math.round(sm.today.seconds / 60)} / ${s.daily_goal_min}</div><div class="muted small">min täna</div></div>
      <div><div class="stat">${sm.week.minutes}</div><div class="muted small">min 7 päevaga</div></div>
      <div><div class="stat">${sm.week.solved}</div><div class="muted small">ülesannet 7 päevaga</div></div>
      <div><div class="stat">${sm.week.cleanRate == null ? "–" : Math.round(sm.week.cleanRate * 100) + "%"}</div><div class="muted small">puhtalt lahendatud</div></div>
    </div>
    <div class="card"><h3>Minutid 14 päeva jooksul</h3><div class="days">${days.join("")}</div><p class="small muted">Roheline: päeva eesmärk täis. 🔥 ${sm.streak} päeva järjest.</p></div>
    <div class="card"><h3>Tase teemade kaupa</h3>${Object.entries(sm.subtopics).map(([k, st]) => `
      <div class="sub"><div class="row"><span class="grow">${esc(META.subtopics[k].title)}</span><span class="small muted">${levelName(st.rating)} · ${st.done}/${st.total}</span></div><div class="bar"><i style="width:${pct(st.rating)}%"></i></div></div>`).join("")}</div>
    <div class="card"><h3>Viimased ülesanded</h3>${s.recent.length ? `<table><tr><th>Ül.</th><th>Tase</th><th>Tulemus</th><th>Aeg</th></tr>${s.recent.map((r) => `
      <tr><td>${esc(r.qid)}</td><td>${r.level ?? ""}</td><td>${r.outcome === "correct" ? (r.tries === 1 && !r.hints ? "✅ puhtalt" : `✅ ${r.tries}. katse${r.hints ? ", " + r.hints + " vihjet" : ""}`) : "👀 vaatas lahendust"}</td><td>${Math.round(r.seconds / 60)} min</td></tr>`).join("")}</table>` : `<p class="muted">Veel pole midagi lahendatud.</p>`}</div>
    <div class="card"><h3>Mida ta õpetajalt küsis</h3>${s.chats.length ? s.chats.map((c) => `<p class="small"><span class="muted">${esc(c.created_at.slice(5, 16))}</span> ${esc(c.content.slice(0, 160))}</p>`).join("") : `<p class="muted">Veel küsimusi pole.</p>`}</div>`;
  }).join("") + `
    <h2>Seaded</h2>
    <div class="card">
      <h3>Päeva eesmärk (minutit)</h3>
      <div class="row"><input id="goal" type="number" min="15" max="240" value="${students[0]?.daily_goal_min ?? 60}"><button id="savegoal">Salvesta</button></div>
      <h3 style="margin-top:14px">Profiilid</h3>
      ${profiles.map((p) => `<div class="row" style="margin-bottom:8px"><input data-name="${esc(p.id)}" value="${esc(p.name)}"><button class="ghost" data-rename="${esc(p.id)}">Nimeta</button><button class="ghost" data-reset="${esc(p.id)}" title="Nulli PIN">PIN ⟲</button></div>`).join("")}
      <p class="small muted">PIN-i nullimisel saab profiil järgmisel sisselogimisel uue PIN-i valida.</p>
    </div>
    <p class="center"><a href="#" id="out" class="muted small">Logi välja</a></p>`;
  document.getElementById("out").onclick = (e) => { e.preventDefault(); logout(); };
  document.getElementById("savegoal").onclick = async () => { await api("/goal", { minutes: +document.getElementById("goal").value }); route(); };
  $app.querySelectorAll("[data-rename]").forEach((b) => (b.onclick = async () => {
    await api("/rename", { profile: b.dataset.rename, name: $app.querySelector(`[data-name="${b.dataset.rename}"]`).value });
    if (b.dataset.rename === me.id) store.set("me", { ...me, name: $app.querySelector(`[data-name="${me.id}"]`).value });
    route();
  }));
  $app.querySelectorAll("[data-reset]").forEach((b) => (b.onclick = async () => { if (confirm("Nullida selle profiili PIN?")) { await api("/reset-pin", { profile: b.dataset.reset }); alert("Tehtud"); } }));
}

if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
