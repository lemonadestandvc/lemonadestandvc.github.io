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
// Streak as a row of masks: one filled per day in the current 7-day stretch.
const MASK = `<path fill-rule="evenodd" d="M8 2 C3.5 2 1.5 5.5 1.5 9.5 C1.5 14 4.5 17 8 17 C11.5 17 14.5 14 14.5 9.5 C14.5 5.5 12.5 2 8 2 Z M5.5 7.5 a1.4 2.4 0 1 0 0.01 0 Z M10.5 7.5 a1.4 2.4 0 1 0 0.01 0 Z M3 4 L2 0.5 L5.5 3 Z M13 4 L14 0.5 L10.5 3 Z"/>`;
function masks(streak) {
  const on = streak % 7 || (streak ? 7 : 0);
  let out = "";
  for (let i = 0; i < 7; i++) out += `<svg viewBox="0 0 16 18" class="${i < on ? "on" : "off"}">${MASK}</svg>`;
  return `<div class="masks" aria-label="${streak} päeva järjest">${out}${streak >= 7 ? `<span class="small" style="color:var(--gold);margin-left:4px">×${Math.floor(streak / 7)} nädalat</span>` : ""}</div>`;
}
const daysTo = (d) => Math.ceil((new Date(d + "T09:00:00+02:00") - Date.now()) / 86400e3);

// ------------------------------------------------------------ study time
// Two ways time is counted:
// 1. While a question is open, the time from opening it to answering counts, up to a cap
//    by level (work on paper counts even if the phone is locked). The server adds it on answer.
// 2. Elsewhere (theory, chat, solutions) 30 s heartbeats count while the page is visible
//    and touched in the last 2 minutes, so a sandwich break is not counted.
let lastInput = Date.now();
let openQuestion = null; // { start, level }
["pointerdown", "keydown", "scroll", "touchstart"].forEach((e) => addEventListener(e, () => (lastInput = Date.now()), { passive: true }));
setInterval(() => {
  if (!store.get("token") || document.hidden || openQuestion) return;
  if (Date.now() - lastInput > 2 * 60e3) return;
  api("/heartbeat", { seconds: 30 }).catch(() => {});
}, 30e3);
function startQuestion(level) { openQuestion = { start: Date.now(), level }; }
function questionSeconds() { return openQuestion ? Math.round((Date.now() - openQuestion.start) / 1000) : 0; }
// Leaving a question unanswered still credits the (capped) time spent on it.
function abandonQuestion() {
  if (!openQuestion) return;
  const seconds = questionSeconds(), level = openQuestion.level;
  openQuestion = null;
  if (seconds > 20) api("/heartbeat", { seconds, level, question: true }).catch(() => {});
}

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
  abandonQuestion();
  renderNav(path, me);
  window.scrollTo(0, 0);
  try {
    if (path === "/login") return await viewLogin();
    if (path === "/practice") return await viewPractice(params);
    if (path === "/test") return await viewTest();
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
  const [s, diag] = await Promise.all([api("/summary"), api("/diag/status")]);
  const next = META.events.find((e) => daysTo(e.date) >= 0);
  const testCard = diag.status === "done" ? "" : `
    <div class="card advice">
      <h3>${diag.status === "open" ? "Tasemetest on pooleli" : "Alusta tasemetestiga"}</h3>
      <p class="small">${diag.status === "open"
        ? `Vastatud ${diag.progress.answered} küsimust umbes ${diag.progress.estimate}-st.`
        : "Umbes 19 ülesannet (45–60 min, võib teha mitmes osas), vihjeid ei ole. Iga vastus mõjutab, kui raske on järgmine küsimus. Selle järgi valib äpp, kust alustada."}</p>
      <a class="btn block accent" href="#/test">${diag.status === "open" ? "Jätka testi" : "Tee tasemetest"}</a>
    </div>`;
  const mins = Math.round(s.today.seconds / 60);
  const p = Math.min(100, Math.round((mins / s.today.goalMin) * 100));
  const subsByTopic = {};
  for (const [k, sub] of Object.entries(META.subtopics)) (subsByTopic[sub.topic] ||= []).push([k, sub]);

  $app.innerHTML = `
    <h1>Tere, ${esc(me.name)}!</h1>
    ${testCard}
    <div class="card row">
      <div class="vessel" style="--p:${p}" title="Tänased minutid"><div>${mins}<small>/ ${s.today.goalMin} min</small></div></div>
      <div class="grow">
        ${next ? `<div><b class="serif">${esc(next.title)}</b> <span class="muted">${daysTo(next.date)} päeva pärast</span></div>` : ""}
        ${masks(s.streak)}
        <div class="muted small">${s.streak ? `${s.streak} päeva järjest` : "Täna on hea päev alustamiseks"}${s.dueReviews ? ` · ${s.dueReviews} kordamist ootab` : ""}</div>
        <a class="btn block ${diag.status === "done" ? "accent" : "ghost"}" style="margin-top:10px" href="#/practice">${mins ? "Jätka trenni" : "Alusta tänast trenni"}</a>
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
    <p class="center muted small">${diag.status === "done" ? `<a href="#/test?again=1" class="muted">Tee tasemetest uuesti</a> · ` : ""}<a href="#" id="out" class="muted">Logi välja</a></p>`;
  document.getElementById("out").onclick = (e) => { e.preventDefault(); logout(); };
}

// ------------------------------------------------------------ placement test
async function viewTest() {
  const again = new URLSearchParams(location.hash.split("?")[1] || "").get("again");
  const st = await api("/diag/status");
  if (st.status === "open") return testQuestion(st.q, st.progress);
  if (st.status === "done" && !again) return testResults(st.results);
  $app.innerHTML = `<h1>Tasemetest</h1>
    <div class="card">
      <p>Test näitab, kui kaugel sa soojusõpetuses, elektriõpetuses, mehaanikas ja optikas oled. Umbes 19 ülesannet, 45–60 minutit. Võid teha mitmes osas.</p>
      <ul>
        <li>Vihjeid ja õpetajat testi ajal ei ole.</li>
        <li>Kui vastad õigesti, on järgmine ülesanne raskem; kui valesti, lihtsam. Seega on raskeid ülesandeid tavaline mitte osata.</li>
        <li>Kui sa ei tea, vajuta „Ei oska“. Arvamine teeb tulemuse ebatäpsemaks.</li>
        <li>Pane valmis paber, pliiats ja kalkulaator. Testi võib pooleli jätta ja hiljem jätkata.</li>
      </ul>
      <button class="block accent" id="start">Alusta</button>
    </div>`;
  document.getElementById("start").onclick = async () => { const r = await api("/diag/start", {}); testQuestion(r.q, r.progress); };
}

function testQuestion(q, progress) {
  startQuestion(q.level);
  const sub = META.subtopics[q.subtopic];
  $app.innerHTML = `
    <div class="row small" style="margin-bottom:6px"><span class="badge">Tasemetest</span><span class="muted grow">${progress.answered + 1}. küsimus (umbes ${progress.estimate}-st)</span></div>
    <div class="bar" style="margin-bottom:12px"><i style="width:${Math.round((progress.answered / progress.estimate) * 100)}%"></i></div>
    <div class="card">
      <p class="muted small">${esc(sub.title)}</p>
      <div class="qtext" id="qt"></div>
      ${figure(q)}
      <div class="answer-row"><input id="ans" inputmode="decimal" autocomplete="off" placeholder="Vastus"><span class="unit">${esc(q.unit)}</span></div>
      <p class="err" id="terr"></p>
      <div class="grid2" style="margin-top:10px"><button class="ghost" id="skip">Ei oska</button><button id="send">Vasta</button></div>
    </div>
    <p class="center"><a href="#/" class="muted small">Jätka hiljem</a></p>`;
  setRich(document.getElementById("qt"), q.text);
  const $ans = document.getElementById("ans");
  const submit = async (skip) => {
    if (!skip && !$ans.value.trim()) return $ans.focus();
    $app.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      const r = await api("/diag/answer", { qid: q.id, value: $ans.value.trim(), skip, seconds: questionSeconds() });
      openQuestion = null;
      window.scrollTo(0, 0);
      r.done ? testResults(r.results) : testQuestion(r.q, r.progress);
    } catch (e) {
      document.getElementById("terr").textContent = e.message;
      $app.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  };
  document.getElementById("send").onclick = () => submit(false);
  document.getElementById("skip").onclick = () => submit(true);
  $ans.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(false); });
}

function testResults(results) {
  const weakest = [...results].sort((a, b) => a.rating - b.rating)[0];
  $app.innerHTML = `<h1>Tasemetesti tulemus</h1>
    <div class="card">${results.map((r) => `
      <div class="sub"><div class="row"><span class="grow">${esc(r.title)}</span><span class="small muted">${levelName(r.rating)}</span></div>
      <div class="bar"><i style="width:${pct(r.rating)}%"></i></div></div>`).join("")}</div>
    <div class="card advice"><p>Äpp alustab sinu tasemel ja keskendub enim teemale <b>${esc(weakest.title.toLowerCase())}</b>. Valesti läinud testiülesanded tulevad homme kordamiseks tagasi.</p>
    <p class="small muted">Tasemed: algaja → põhitase → kooliolümpiaad → piirkonnavoor → lõppvoor.</p></div>
    <a class="btn block accent" href="#/practice">Alusta trenni</a>`;
}

// ------------------------------------------------------------ practice
async function viewPractice(params) {
  const qs = new URLSearchParams();
  if (params.get("topic")) qs.set("topic", params.get("topic"));
  if (params.get("subtopic")) qs.set("subtopic", params.get("subtopic"));
  const { q, review } = params.get("id") ? await api("/question?id=" + params.get("id")) : await api("/next?" + qs);
  const sub = META.subtopics[q.subtopic];
  const card = META.cards.find((c) => c.subtopic === q.subtopic);
  const st = { tries: 0, hints: 0, wrong: [], done: false, chat: [] };
  startQuestion(q.level);

  $app.innerHTML = `
    <div class="row wrap small" style="margin-bottom:6px">
      <span class="badge">Tase ${q.level}</span>${review ? `<span class="badge review">Kordamine</span>` : ""}
      <span class="muted">${esc(sub.title)}</span>
    </div>
    <div class="card">
      <div class="qtext" id="qt"></div>
      ${figure(q)}
      <div class="answer-row" id="ansrow">
        <input id="ans" inputmode="decimal" autocomplete="off" placeholder="Vastus">
        <span class="unit">${esc(q.unit)}</span>
        <button id="check">Kontrolli</button>
      </div>
      <div id="fb"></div>
      <div class="tools" id="tools">
        <button class="soft" data-mode="hint">💡 Vihje</button>
        <button class="soft" data-mode="teach">🧑‍🏫 Õpeta mind</button>
        <button class="soft" data-photo>📷 Hinda mu lahendust</button>
        <button class="ghost" id="reveal">Näita lahendust</button>
      </div>
      <input type="file" id="photo" accept="image/*" multiple hidden>
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
    const seconds = questionSeconds();
    openQuestion = null;
    const r = await api("/complete", { qid: q.id, outcome, tries: Math.max(1, st.tries), hints: st.hints, wrong: st.wrong, seconds });
    document.getElementById("ansrow").style.display = "none";
    document.getElementById("tools").innerHTML = `<button class="soft" data-x="simpler">Selgita lihtsamalt</button><button class="soft" data-x="why">Miks just nii?</button><button class="soft" data-x="more">Räägi rohkem</button><button class="soft" data-photo>📷 Hinda mu lahendust</button>`;
    const prompts = { simpler: "Selgita seda lahendust palun lihtsamalt, nagu sõbrale.", why: "Miks tuli just nii lahendada? Kuidas ma järgmine kord ise selle peale tulen?", more: "Räägi mulle selle teema kohta rohkem. Kus seda päriselus kasutatakse?" };
    document.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => ask("explain", prompts[b.dataset.x])));
    bindPhoto();
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
        const why = r.note === "sign" ? "Arv on õige, aga märk mitte. Mõtle, kas suurus peaks olema negatiivne."
          : r.note === "unit" ? `Arvutus näib õige, aga vastus on vales ühikus. Vastus peab olema ühikutes <b>${esc(q.unit)}</b>.`
          : "Kontrolli arvutust või küsi vihjet.";
        $fb.innerHTML = `<div class="feedback bad">Pole päris õige (${st.tries}. katse). ${why}</div>`;
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

  // Photo of the handwritten solution, marked like the olympiad jury does.
  const $photo = document.getElementById("photo");
  function bindPhoto() { $app.querySelectorAll("[data-photo]").forEach((b) => (b.onclick = () => { $photo.value = ""; $photo.click(); })); }
  bindPhoto();
  $photo.onchange = async () => {
    const files = [...$photo.files].slice(0, 3);
    if (!files.length) return;
    const bubble = h(`<div class="msg tutor cursor">Vaatan su lahendust läbi…</div>`);
    $chat.append(bubble);
    bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setBusy(true);
    try {
      const images = await Promise.all(files.map(shrinkImage));
      const g = await api("/grade", { qid: q.id, images, done: st.done });
      bubble.classList.remove("cursor");
      bubble.innerHTML = gradeHtml(g);
      typeset(bubble);
      // Let follow-up questions in the chat know what the marker said.
      st.chat.push({ role: "user", content: "Saatsin foto oma lahendusest." }, { role: "assistant", content: `Hinnang ${g.score}/10. ${g.summary} ${g.steps.map((s) => (s.ok ? "✓ " : "✗ ") + s.text).join(" ")} Soovitus: ${g.next_step}` });
      if (g.final_answer_correct && !st.done) {
        st.tries++;
        $fb.innerHTML = `<div class="feedback good">Lõppvastus on õige!</div>`;
        await finish("correct");
      }
    } catch (e) { bubble.classList.remove("cursor"); bubble.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
    setBusy(false);
  };
  const $askq = document.getElementById("askq");
  document.getElementById("asksend").onclick = () => { const t = $askq.value.trim(); if (t) { $askq.value = ""; ask("chat", t); } };
}

function figure(q) {
  return q.image ? `<a href="${esc(q.image)}" target="_blank" class="fig${q.image.endsWith(".svg") ? " svg" : ""}" title="Ava suurelt"><img src="${esc(q.image)}" alt="Ülesande joonis" loading="lazy"></a>` : "";
}

// Phone photos are 3–5 MB; scale to max 1600 px JPEG before sending.
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  const img = bmp || await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Pilti ei saanud avada")); i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return { mediaType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.82).split(",")[1] };
}

function gradeHtml(g) {
  if (!g.readable) return `<b>Fotolt ei saa lahendust lugeda.</b><p>${rich(g.summary)}</p>`;
  return `<div class="row"><b class="serif grow">Hinnang: ${g.score}/10</b>${g.final_answer_seen ? `<span class="small muted">vastus: ${esc(g.final_answer_seen)} ${g.final_answer_correct ? "✓" : "✗"}</span>` : ""}</div>
    <div class="bar"><i style="width:${g.score * 10}%"></i></div>
    <ul class="steps">${g.steps.map((s) => `<li class="${s.ok ? "ok" : "no"}">${rich(s.text).replace(/^<p>|<\/p>\s*$/g, "")}</li>`).join("")}</ul>
    <div>${rich(g.summary)}</div><div class="small"><b>Järgmine samm:</b> ${rich(g.next_step).replace(/^<p>|<\/p>\s*$/g, "")}</div>`;
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
  // Suggestions are tap-to-send chips, so the text field is always empty and ready for typing.
  const ideas = card
    ? [`Selgita mulle teemat „${card.title}“ lihtsalt ja too näide.`, `Millised on tüüpilised vead teemas „${card.title}“?`, `Anna mulle üks harjutusülesanne teemal „${card.title}“.`]
    : ["Mis vahe on soojusel ja temperatuuril?", "Miks rööpühenduses kogutakistus väheneb?", "Kuidas olümpiaadiülesannet lahendama hakata?"];
  $app.innerHTML = `<h1>Küsi õpetajalt</h1>
    <p class="muted">Küsi ükskõik mida füüsika või matemaatika kohta.</p>
    <div class="chips" id="chips">${ideas.map((t) => `<button class="chip">${esc(t)}</button>`).join("")}</div>
    <div class="chat" id="chat"></div>
    <div class="ask-row"><textarea id="askq" placeholder="Sinu küsimus…"></textarea><button id="asksend">Saada</button></div>`;
  const $chat = document.getElementById("chat"), $q = document.getElementById("askq"), $b = document.getElementById("asksend");
  $app.querySelectorAll(".chip").forEach((c) => (c.onclick = () => { $q.value = c.textContent; document.getElementById("chips").remove(); $b.click(); }));
  $b.onclick = async () => {
    const t = $q.value.trim();
    if (!t) return;
    document.getElementById("chips")?.remove();
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
    <div class="card"><h3>Tasemetest</h3>${s.diag
      ? `<p class="small muted">Tehtud ${esc(s.diag.finished_at.slice(0, 10))}</p>${s.diag.results.map((r) => `<div class="row small"><span class="grow">${esc(r.title)}</span><span>${levelName(r.rating)}</span></div>`).join("")}`
      : `<p class="muted">Veel tegemata. Test ilmub ${esc(s.name)} avalehel esimese asjana.</p>`}</div>
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
      <tr><td>${esc(r.qid)}</td><td>${r.level ?? ""}</td><td>${r.outcome === "wrong" ? "❌ tasemetest" : r.outcome === "correct" ? (r.tries === 1 && !r.hints ? "✅ puhtalt" : `✅ ${r.tries}. katse${r.hints ? ", " + r.hints + " vihjet" : ""}`) : "👀 vaatas lahendust"}</td><td>${Math.round(r.seconds / 60)} min</td></tr>`).join("")}</table>` : `<p class="muted">Veel pole midagi lahendatud.</p>`}</div>
    <div class="card"><h3>Pildistatud lahendused</h3>${s.solutions.length ? s.solutions.map((x) => `
      <details class="sol"><summary><b>${esc(x.qid)}: ${x.score}/10</b> ${x.final_correct ? "✓" : "✗"} <span class="muted small">${esc(x.created_at.slice(5, 16))}</span><br><span class="small">${esc(x.summary)}</span></summary>
        <div class="thumbs">${x.photos.map((k) => `<a data-photo-key="${esc(k)}" href="#"><img alt="Lahenduse foto"></a>`).join("")}</div>
        <ul class="steps small">${(x.steps || []).map((st) => `<li class="${st.ok ? "ok" : "no"}">${esc(st.text)}</li>`).join("")}</ul>
        ${x.next_step ? `<p class="small"><b>Soovitus:</b> ${esc(x.next_step)}</p>` : ""}
      </details>`).join("") : `<p class="muted">Veel pole ühtegi lahendust pildistatud.</p>`}</div>
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
  // Photos need the auth header, so load them as blobs when a solution is opened.
  $app.querySelectorAll("details.sol").forEach((d) => d.addEventListener("toggle", () => {
    if (!d.open) return;
    d.querySelectorAll("[data-photo-key]").forEach(async (a) => {
      if (a.dataset.loaded) return;
      a.dataset.loaded = "1";
      const res = await fetch(API + "/api/photo?key=" + encodeURIComponent(a.dataset.photoKey), { headers: { Authorization: "Bearer " + store.get("token") } });
      if (!res.ok) { a.textContent = "Foto puudub"; return; }
      const src = URL.createObjectURL(await res.blob());
      a.querySelector("img").src = src;
      a.href = src; a.target = "_blank";
    });
  }));
  document.getElementById("savegoal").onclick = async () => { await api("/goal", { minutes: +document.getElementById("goal").value }); route(); };
  $app.querySelectorAll("[data-rename]").forEach((b) => (b.onclick = async () => {
    await api("/rename", { profile: b.dataset.rename, name: $app.querySelector(`[data-name="${b.dataset.rename}"]`).value });
    if (b.dataset.rename === me.id) store.set("me", { ...me, name: $app.querySelector(`[data-name="${me.id}"]`).value });
    route();
  }));
  $app.querySelectorAll("[data-reset]").forEach((b) => (b.onclick = async () => { if (confirm("Nullida selle profiili PIN?")) { await api("/reset-pin", { profile: b.dataset.reset }); alert("Tehtud"); } }));
}

if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
