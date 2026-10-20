/* Paedagogium 화면 — claude.ai 판(2026-10-19)의 화면 논리를 Athenaeum 꼴의 로컬 프로그램으로 옮긴 것.
   기록은 서버(data\store.json)에, Claude 는 서버가 `claude -p` 로 부른다(/api/claude → /api/job 폴링).
   화면 원칙(사용자 2026-10-16): 한눈에 먼저(요지·정답 근거를 맨 위), 긴 설명은 접기, 상자 안에서 또 스크롤하는 칸은 만들지 않는다. */
(function () {
  "use strict";
  const C = Object.assign({}, window.CONTENT_BASE || {}, {
    guide: window.CONTENT_GUIDE, sprint: window.CONTENT_SPRINT, standard: window.CONTENT_STANDARD,
    curriculum: window.CONTENT_CURRICULUM, exams: window.CONTENT_EXAMS, pedagogy: window.CONTENT_PEDAGOGY
  });
  const DAY = 86400000, WD = ["일", "월", "화", "수", "목", "금", "토"];
  const REVIEW_STEPS = [1, 3, 7, 14, 30];
  const VIEWS = [
    { g: "오늘" },
    { id: "home", t: "개요" }, { id: "notices", t: "중요 공지" }, { id: "jobs", t: "구인 공고" },
    { g: "공부" },
    { id: "guide", t: "공부 길잡이" }, { id: "standard", t: "임용 표준안" }, { id: "curriculum", t: "교육과정 요약" },
    { id: "exams", t: "기출 정리" }, { id: "pedagogy", t: "교과교육학" },
    { g: "연습" },
    { id: "notes", t: "오답 노트" }, { id: "ask", t: "질문하기" },
    { g: "도움" },
    { id: "help", t: "이용법" }, { id: "data", t: "기록·설정" }
  ];

  // ------------------------------------------------------------ 도구
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function rich(s) { return esc(s).replace(/==(.+?)==/g, "<mark>$1</mark>").replace(/\[\[(.+?)\]\]/g, '<code>$1</code>'); }
  function link(s) {
    if (!s) return "";
    const t = s.label || s.title || s.url;
    if (!s.url) return esc(t);
    if (s.url.charAt(0) === "#") return '<a href="' + esc(s.url) + '">' + esc(t) + "</a>";
    return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(t) + " ↗</a>";
  }
  function srcLine(list) { list = [].concat(list || []).filter(Boolean); return list.length ? '<p class="src">출처: ' + list.map(link).join(" · ") + "</p>" : ""; }
  function todayStr() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function addDays(s, n) { const p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10); }
  function diffDays(a, b) { const pa = a.split("-"), pb = b.split("-"); return Math.round((Date.UTC(+pa[0], +pa[1] - 1, +pa[2]) - Date.UTC(+pb[0], +pb[1] - 1, +pb[2])) / DAY); }
  function fmt(s) { if (!s) return ""; const p = s.split("-"); return p[0] + "." + (+p[1]) + "." + (+p[2]) + "(" + WD[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()] + ")"; }
  function mdw(s) { if (!s) return ""; const p = s.split("-"); return (+p[1]) + "." + (+p[2]) + "(" + WD[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()] + ")"; }
  function uid(p) { return (p || "n") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nowIso() { return new Date().toISOString(); }
  function ago(ts) {
    if (!ts) return "아직 받지 않음 —";
    const s = Math.round(Date.now() / 1000 - ts);
    if (s < 90) return "방금";
    if (s < 3600) return Math.round(s / 60) + "분 전";
    if (s < 86400) return Math.round(s / 3600) + "시간 전";
    return Math.round(s / 86400) + "일 전";
  }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); }
  async function api(path, body) {
    const opt = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    const r = await fetch(path, opt);
    let d = null;
    try { d = await r.json(); } catch (e) { d = null; }
    if (!r.ok) throw new Error((d && d.error) || ("서버 오류 " + r.status));
    return d;
  }
  function armed(btn, label) {   // 지우기 같은 동작은 두 번 눌러야
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = label || "한 번 더 누르면 지웁니다";
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; } }, 4000);
    return false;
  }

  // ------------------------------------------------------------ 마크다운 (Claude 의 답)
  function md(src) {
    const lines = String(src || "").replace(/\r/g, "").split("\n");
    let out = [], i = 0, list = null;
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
      .replace(/==(.+?)==/g, "<mark>$1</mark>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const closeList = () => { if (list) { out.push("</" + list + ">"); list = null; } };
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) {
        closeList(); const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>"); i++; continue;
      }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { closeList(); out.push("<h" + Math.max(2, m[1].length) + ">" + inline(m[2]) + "</h" + Math.max(2, m[1].length) + ">"); i++; continue; }
      if (/^\s*([-*_])\1\1+\s*$/.test(l)) { closeList(); out.push("<hr>"); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        closeList();
        const row = s => s.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));
        const head = row(l); i += 2; const body = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
        out.push('<div class="tw"><table><thead><tr>' + head.map(h => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" +
          body.map(r => "<tr>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
        continue;
      }
      if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); i++; continue; }
      if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)$/))) { if (list !== "ol") { closeList(); out.push('<ol start="' + m[1] + '">'); list = "ol"; } out.push("<li>" + inline(m[2]) + "</li>"); i++; continue; }
      if ((m = l.match(/^>\s?(.*)$/))) { closeList(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); i++; continue; }
      if (!l.trim()) { closeList(); i++; continue; }
      closeList();
      const para = [l];
      while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#{1,4}\s|```|\s*[-*•]\s|\s*\d+[.)]\s|>|\s*\|)/.test(lines[i + 1])) para.push(lines[++i]);
      out.push("<p>" + para.map(inline).join("<br>") + "</p>"); i++;
    }
    closeList();
    let html = out.join("\n");
    // '정답…' 절은 접는다 (문제 만들기: 답을 먼저 보지 않게)
    html = html.replace(/<h([23])>((?:정답|답과|해답)[^<]*)<\/h\1>([\s\S]*?)(?=<h[23]>|$)/g, (all, lv, title, rest) => '<details class="ans"><summary>' + title + " — 눌러서 보기</summary>" + rest + "</details>");
    return html;
  }

  // ------------------------------------------------------------ 기록 (서버)
  const Store = {
    docs: {}, chains: {},
    async load() { const d = await api("/api/store"); this.docs = d.docs || {}; },
    get(id) { return this.docs[id] || null; },
    all(type) { return Object.values(this.docs).filter(x => x && x.type === type); },
    put(id, doc) {
      doc = JSON.parse(JSON.stringify(doc)); doc.id = id; this.docs[id] = doc;
      const prev = this.chains[id] || Promise.resolve();
      const next = prev.then(() => api("/api/store", { op: "put", id, doc })).catch(e => toast("저장 실패: " + e.message));
      this.chains[id] = next; return next;
    },
    remove(id) {
      delete this.docs[id];
      const prev = this.chains[id] || Promise.resolve();
      const next = prev.then(() => api("/api/store", { op: "del", id })).catch(e => toast("지우기 실패: " + e.message));
      this.chains[id] = next; return next;
    }
  };
  function settings() { return Store.get("settings") || { type: "settings", done: {} }; }
  function saveSettings(patch) { const s = Object.assign({}, settings(), patch, { type: "settings" }); return Store.put("settings", s); }
  function examDate() { return settings().targetDate || (C.exam && C.exam.date) || null; }
  function dueNotes() { const t = todayStr(); return Store.all("note").filter(n => n.nextReview && n.nextReview <= t && !n.mastered); }
  function toggleDone(id, on) { const d = Object.assign({}, settings().done || {}); if (on) d[id] = true; else delete d[id]; return saveSettings({ done: d }); }

  // ------------------------------------------------------------ 상태 (공지·구인·Claude)
  let ST = { notices: {}, jobs: {}, claude: {} };
  let NOTICES = null, JOBS = null;
  async function refreshStatus() {
    try { ST = await api("/api/status"); } catch (e) { return; }
    const t = $("#topstate");
    const run = ST.notices.running || ST.jobs.running;
    const bad = !ST.claude.available || ST.claude.error;
    t.innerHTML = (run ? '<span title="공지·구인 공고를 받는 중"><span class="dot run"></span>받는 중</span>' : "") +
      (bad ? ' <a href="#data" title="' + esc(ST.claude.error || "Claude Code 를 찾지 못했습니다") + '"><span class="dot bad"></span>Claude 확인</a>' : "");
    nav();
  }

  // ------------------------------------------------------------ Claude 작업 (폴링)
  function runJob(body, h) {
    let stopped = false, jid = null;
    const ctl = { cancel() { stopped = true; if (jid) api("/api/job/cancel", { id: jid }).catch(() => {}); } };
    (async () => {
      let r;
      try { r = await api(body.url || "/api/claude", body.data || body); } catch (e) { h.error && h.error(e.message); return; }
      jid = r.job; ctl.job = jid; h.started && h.started(r);
      let last = "";
      while (true) {
        await new Promise(res => setTimeout(res, 700));
        let j;
        try { j = await api("/api/job?id=" + encodeURIComponent(jid)); } catch (e) { h.error && h.error(e.message); return; }
        if (j.text && j.text !== last) { last = j.text; h.text && h.text(j.text, j); }
        if (j.stage && h.stage) h.stage(j.stage, j);
        if (h.tick) h.tick(j);
        if (j.status === "done") { h.done && h.done(j); return; }
        if (j.status === "error") { h.error && h.error(j.error || "실패했습니다"); return; }
        if (j.status === "cancelled") { h.cancelled && h.cancelled(j); return; }
      }
    })();
    return ctl;
  }
  function waitingHtml(label) { return '<div class="waiting"><span class="pbar"><i></i></span><span>' + esc(label) + ' <span class="el"></span></span></div>'; }
  function tickEl(el, j) { const e = el && el.querySelector(".el"); if (e) e.textContent = "· " + Math.round(j.elapsed) + "초"; }

  // ------------------------------------------------------------ 목차
  function current() { const h = (location.hash || "").replace("#", "").split("?")[0]; return VIEWS.some(v => v.id === h) ? h : "home"; }
  function nav() {
    const cur = current(), due = dueNotes().length;
    const cnt = {
      notes: due ? '<span class="cnt hot" title="오늘 복습할 오답">' + due + "</span>" : "",
      notices: ST.notices.unread_top ? '<span class="cnt new" title="새로 온 꼭 볼 공지">' + ST.notices.unread_top + "</span>" : "",
      jobs: ST.jobs.soon ? '<span class="cnt hot" title="3일 안에 마감하는 정보 과목 공고">' + ST.jobs.soon + "</span>" : "",
      guide: sprintActive() ? '<span class="cnt">' + pct(sprintTasks()) + "%</span>" : '<span class="cnt">' + pct(guideTasks()) + "%</span>",
      standard: '<span class="cnt">' + pct(standardIds()) + "%</span>"
    };
    $("#side").innerHTML = VIEWS.map(v => v.g ? '<div class="grp">' + esc(v.g) + "</div>" :
      '<a href="#' + v.id + '"' + (v.id === cur ? ' aria-current="page"' : "") + "><span>" + esc(v.t) + "</span>" + (cnt[v.id] || "") + "</a>").join("") +
      '<div class="foot">' + (C.updated ? "자료 기준일 " + esc(C.updated) + "<br>" : "") + "Paedagogium " + esc(ST.version || "") + "</div>";
    const ed = examDate(), dd = ed ? diffDays(ed, todayStr()) : null;
    $("#topdday").innerHTML = ed ? (dd > 0 ? "D-" + dd : dd === 0 ? "D-day" : "시험 끝") + "<small>1차 " + esc(mdw(ed)) + "</small>" : "";
  }
  const rendered = {};
  function show() {
    const cur = current();
    VIEWS.forEach(v => { if (v.id) $("#v-" + v.id).hidden = v.id !== cur; });
    RENDER[cur]();
    rendered[cur] = true;
    nav();
    window.scrollTo(0, 0);
  }
  function rerender() { const cur = current(); if (!typing()) RENDER[cur](); nav(); }
  function typing() {
    const a = document.activeElement;
    return a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type === "text")) && a.value.trim();
  }
  const RENDER = {};

  // ------------------------------------------------------------ 진도 도우미
  function pct(ids) { if (!ids.length) return 0; const d = settings().done || {}; return Math.round(ids.filter(i => d[i]).length / ids.length * 100); }
  function sprintTasks() { const S = C.sprint; if (!S) return []; const o = []; S.weeks.forEach(w => w.tasks.forEach(x => o.push(x.id))); (S.after ? S.after.tasks : []).forEach(x => o.push(x.id)); return o; }
  function sprintActive() { const S = C.sprint; return !!S && todayStr() <= addDays(S.examDate, 3); }
  function curWeek() { const t = todayStr(), S = C.sprint; return S && S.weeks.filter(w => t >= w.range[0] && t <= w.range[1])[0]; }
  function guideTasks() { const o = []; ((C.guide || {}).phases || []).forEach(p => (p.tasks || []).forEach(t => o.push(t.id))); return o; }
  function standardIds() {
    const T = C.standard; if (!T) return [];
    const ids = T.pedagogy.areas.map((a, i) => "std-p-" + i);
    T.content.forEach((s, si) => s.areas.forEach((a, ai) => ids.push("std-c-" + si + "-" + ai)));
    return ids;
  }
  function taskHtml(x, done) { return '<label class="task' + (done[x.id] ? " done" : "") + '"><input type="checkbox" data-task="' + esc(x.id) + '"' + (done[x.id] ? " checked" : "") + "><span>" + rich(x.text) + "</span></label>"; }
  function bindTasks(el) { $$("input[data-task]", el).forEach(cb => cb.addEventListener("change", () => { toggleDone(cb.dataset.task, cb.checked); cb.closest(".task").classList.toggle("done", cb.checked); nav(); })); }

  // ------------------------------------------------------------ 개요
  RENDER.home = function () {
    const E = C.exam || {}, ed = examDate(), t = todayStr(), dd = ed ? diffDays(ed, t) : null, el = $("#v-home");
    const due = dueNotes().length, total = Store.all("note").length;
    const wk = curWeek(), done = settings().done || {};
    let h = '<div class="vhead"><span class="eyebrow">' + esc(E.name || "중등교사 임용시험") + '</span><h1>오늘</h1><p class="lead">' + rich(C.homeLead || "") + "</p></div>";
    h += '<section class="hero"><div class="big">' + (ed ? (dd > 0 ? "<small>D-</small>" + dd : dd === 0 ? "D-day" : "끝") : "—") + '</div><div class="meta">' +
      "<b>1차 시험 " + esc(ed ? fmt(ed) : "날짜 미정") + "</b>" +
      (ed && dd > 0 ? '<span class="when">' + Math.floor(dd / 7) + "주 " + (dd % 7) + "일 남았습니다" + (sprintActive() ? " · 이번 시험은 경험, 실제 목표는 2027년 11월" : "") + "</span>" : "") +
      (settings().targetDate ? '<span class="hint">직접 정한 날짜입니다.</span>' : (E.dateNote ? '<span class="hint">' + rich(E.dateNote) + "</span>" : "")) +
      '<span class="hint">목표일 바꾸기 <input type="date" id="target-date" value="' + esc(settings().targetDate || "") + '"> ' +
      (settings().targetDate ? '<button class="act" id="target-reset">공고 날짜로</button>' : "") + "</span></div></section>";
    const unread = (NOTICES && NOTICES.items || []).filter(x => x.tier === "top" && !x.read);
    h += '<div class="stats">' +
      '<a class="stat" href="#notes"><span class="k">오늘 복습할 오답</span><span class="v' + (due ? " hot" : "") + '">' + due + '</span><span class="d">전체 ' + total + "개</span></a>" +
      (sprintActive() ? '<a class="stat" href="#guide"><span class="k">40일 경험 계획</span><span class="v">' + pct(sprintTasks()) + '%</span><span class="d">' + esc(wk ? "이번 주: " + wk.title : "시험 뒤 복기") + "</span></a>"
        : '<a class="stat" href="#guide"><span class="k">로드맵 진도</span><span class="v">' + pct(guideTasks()) + '%</span><span class="d">단계별 체크리스트</span></a>') +
      '<a class="stat" href="#notices"><span class="k">새 중요 공지</span><span class="v">' + (ST.notices.unread_top || 0) + '</span><span class="d">' + (ST.notices.fetched ? esc(ago(ST.notices.fetched)) + " 받음" : "받는 중") + "</span></a>" +
      '<a class="stat" href="#jobs"><span class="k">3일 안 마감 구인</span><span class="v' + (ST.jobs.soon ? " hot" : "") + '">' + (ST.jobs.soon || 0) + '</span><span class="d">서울·경기 정보 과목</span></a></div>';
    // 오늘 할 일
    h += '<section class="sec"><div class="sh"><h2>이번 주 할 일</h2><span class="r">' + (wk ? esc(mdw(wk.range[0]) + " ~ " + mdw(wk.range[1])) : "") + "</span></div><div class=\"today\"><div>";
    if (wk) h += wk.tasks.map(x => taskHtml(x, done)).join("");
    else h += '<p class="hint" style="padding:8px 0">' + (sprintActive() ? "시험 뒤 복기 주간입니다. 공부 길잡이에서 확인하세요." : '로드맵은 <a href="#guide">공부 길잡이</a>에 있습니다.') + "</p>";
    if (due) h += '<p style="margin-top:8px"><a href="#notes">오답 ' + due + "개를 오늘 복습하기 →</a></p>";
    h += '</div><div><h3 class="sub" style="margin-top:4px">꼭 볼 공지</h3>';
    h += unread.length ? '<ul class="clean">' + unread.slice(0, 5).map(x => '<li><a href="#notices?k=' + encodeURIComponent(x.key) + '">' + esc((t2 => t2.length > 52 ? t2.slice(0, 50) + "…" : t2)(shortTitle(x.title))) + "</a> <span class=\"hint\">" + esc(x.src_name) + "</span></li>").join("") + "</ul>"
      : '<p class="hint">새로 온 꼭 볼 공지가 없습니다. <a href="#notices">공지 전체</a></p>';
    const soonJobs = (JOBS && JOBS.items || []).filter(x => x.tier === "core" && x.apply && x.apply.end && x.apply.end >= t).slice(0, 3);
    if (soonJobs.length) h += '<h3 class="sub">마감이 가까운 정보 과목 구인</h3><ul class="clean">' + soonJobs.map(x => '<li><a href="#jobs">' + esc(x.school) + "</a> " + esc(x.kind) + ' <span class="tag hot">~' + esc(mdw(x.apply.end)) + "</span></li>").join("") + "</ul>";
    h += "</div></div></section>";
    h += upcomingHtml();
    const sched = (E.schedule || []).slice(); let nextIdx = -1;
    sched.forEach((s, i) => { if (nextIdx < 0 && s.date && s.date >= t) nextIdx = i; });
    if (sched.length) h += '<section class="sec"><div class="sh"><h2>임용 1차 일정 (2027학년도)</h2></div><ul class="timeline">' + sched.map((s, i) =>
      '<li class="' + (s.date && s.date < t ? "past" : i === nextIdx ? "next" : "") + '"><span class="d">' + esc(s.date ? fmt(s.date) : s.dateText || "") + "</span><span>" + rich(s.label) + (s.note ? ' <span class="hint">' + rich(s.note) + "</span>" : "") + "</span></li>").join("") + "</ul>" + srcLine(E.scheduleSources) + "</section>";
    if (E.structure) h += '<section class="sec"><div class="sh"><h2>1차 시험 구성</h2></div><div class="tw"><table><thead><tr><th>교시</th><th>과목</th><th>시간</th><th>문항</th><th>배점</th></tr></thead><tbody>' +
      E.structure.map(r => "<tr><td>" + esc(r.session) + "</td><td>" + rich(r.subject) + "</td><td>" + esc(r.time) + "</td><td>" + rich(r.items) + '</td><td class="num">' + esc(r.points) + "</td></tr>").join("") +
      "</tbody></table></div>" + (E.rules ? '<ul class="clean small">' + E.rules.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul>" : "") + srcLine(E.structureSources) + "</section>";
    if (E.ratio) h += '<section class="sec"><div class="sh"><h2>전공 출제 비율</h2></div><div class="ratio"><span class="p" style="width:' + (E.ratio.pedagogyWidth || 30) + '%">교과교육학 ' + esc(E.ratio.pedagogy) + '</span><span class="c">교과내용학 ' + esc(E.ratio.content) + '</span></div><p class="small muted">' + rich(E.ratio.note || "") + "</p>" + srcLine(E.ratio.sources) + "</section>";
    if (E.areas) h += '<section class="sec"><div class="sh"><h2>공식 출제 범위 (평가 영역)</h2></div><div class="tw"><table><thead><tr><th>교과교육학 평가 영역</th><th>평가 내용 요소</th></tr></thead><tbody>' +
      E.areas.pedagogy.map(r => "<tr><td>" + esc(r[0]) + '</td><td class="small">' + esc(r[1]) + "</td></tr>").join("") + '</tbody></table></div><p class="small" style="margin-top:8px"><b>교과내용학 기본이수과목</b> · ' + esc(E.areas.content) + "</p></section>";
    if (E.quota && E.quota.length) h += '<section class="sec"><div class="sh"><h2>정보·컴퓨터 선발 예정 인원</h2></div><div class="tw"><table><thead><tr><th>지역</th><th>학년도</th><th>인원</th><th>비고</th></tr></thead><tbody>' +
      E.quota.map(q => "<tr><td>" + esc(q.region) + "</td><td>" + esc(q.year) + '</td><td class="num"><b>' + esc(q.n) + '</b></td><td class="small">' + rich(q.note || "") + (q.source ? " " + link(q.source) : "") + "</td></tr>").join("") + "</tbody></table></div></section>";
    if (C.officialLinks) h += '<section class="sec"><div class="sh"><h2>공식 자료 바로가기</h2></div><div class="links">' + C.officialLinks.map(l => '<div class="lk">' + link(l) + "<p>" + rich(l.desc || "") + "</p></div>").join("") + "</div></section>";
    el.innerHTML = h;
    const inp = $("#target-date", el);
    inp.addEventListener("change", () => { saveSettings({ targetDate: inp.value || null }); RENDER.home(); nav(); });
    const rs = $("#target-reset", el); if (rs) rs.addEventListener("click", () => { saveSettings({ targetDate: null }); RENDER.home(); nav(); });
    bindTasks(el); bindUpcoming(el);
  };

  // 다가오는 시험 (임용 + 자격시험 + 직접 추가)
  function upcoming() {
    const builtin = (C.myExams || []).map(x => Object.assign({ builtin: true }, x));
    const mine = (settings().events || []).map(x => Object.assign({ builtin: false, status: "직접 추가" }, x));
    return builtin.concat(mine).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }
  function upcomingHtml() {
    const t = todayStr();
    const rows = upcoming().filter(x => !x.date || x.date >= addDays(t, -2)).map(x => {
      const d = x.date ? diffDays(x.date, t) : null;
      const badge = d === null ? '<span class="badge warn">미발표</span>' : d > 0 ? '<span class="badge ' + (d <= 14 ? "hot" : "acc") + '">D-' + d + "</span>" : d === 0 ? '<span class="badge hot">D-day</span>' : '<span class="badge dim">지남</span>';
      return "<li><span class=\"d\">" + badge + "</span><span><b>" + esc(x.name) + '</b> <span class="hint">' + esc(x.date ? fmt(x.date) : (x.dateText || "날짜 미정")) + (x.status && !/확정|미발표/.test(x.status) ? " · " + esc(x.status) : "") + "</span>" +
        (x.note ? '<br><span class="small muted">' + rich(x.note) + "</span>" : "") + (x.url ? ' <span class="small">' + link({ label: x.urlLabel || "공식 일정", url: x.url }) + "</span>" : "") +
        (x.builtin ? "" : ' <button class="act warn" data-del-event="' + esc(x.id) + '">지우기</button>') + "</span></li>";
    }).join("");
    return '<section class="sec"><div class="sh"><h2>다가오는 시험·일정</h2></div><ul class="timeline">' + (rows || '<li><span></span><span class="hint">등록된 일정이 없습니다.</span></li>') + "</ul>" +
      '<details class="reveal"><summary>일정 직접 추가</summary><form id="ev-form" class="nform"><div class="two"><label>이름<input type="text" id="ev-name" placeholder="예: 정보처리기사 1회 필기 접수"></label>' +
      '<label>날짜<input type="date" id="ev-date"></label></div><label>메모<input type="text" id="ev-note" placeholder="선택"></label><div><button class="primary" type="submit">추가</button></div></form></details>' +
      (C.myExamsNote ? '<p class="src" style="margin-top:6px">' + rich(C.myExamsNote) + "</p>" : "") + "</section>";
  }
  function addEvent(ev) { const list = (settings().events || []).concat([Object.assign({ id: uid("e") }, ev)]); return saveSettings({ events: list }); }
  function bindUpcoming(el) {
    const f = $("#ev-form", el);
    if (f) f.addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#ev-name", el).value.trim(), date = $("#ev-date", el).value;
      if (!name || !date) { $("#ev-name", el).focus(); return; }
      addEvent({ name, date, note: $("#ev-note", el).value.trim() }); RENDER.home();
    });
    $$("[data-del-event]", el).forEach(b => b.addEventListener("click", () => {
      if (!armed(b)) return;
      saveSettings({ events: (settings().events || []).filter(x => x.id !== b.dataset.delEvent) }); RENDER.home();
    }));
  }

  // ------------------------------------------------------------ 중요 공지
  let noticeFilter = "top", openNotice = null;
  async function loadNotices() { try { NOTICES = await api("/api/notices"); } catch (e) { NOTICES = NOTICES || { items: [], errors: [e.message] }; } }
  RENDER.notices = function () {
    const el = $("#v-notices");
    const m = location.hash.match(/k=([^&]+)/); if (m) { openNotice = decodeURIComponent(m[1]); noticeFilter = "all"; }
    if (!NOTICES || (ST.notices.fetched && NOTICES.fetched !== ST.notices.fetched && !NOTICES.running)) {
      if (!NOTICES) el.innerHTML = waitingHtml("공지를 불러오는 중");
      loadNotices().then(() => { if (current() === "notices") RENDER.notices(); }); if (!NOTICES) return;
    }
    const N = NOTICES, items = N.items || [];
    const groups = { all: items, top: items.filter(x => x.tier === "top"), unread: items.filter(x => !x.read && x.tier === "top"),
      imyong: items.filter(x => x.group === "임용"), past: items.filter(x => x.group === "기출"), cert: items.filter(x => x.group === "자격") };
    const list = groups[noticeFilter] || items;
    let h = '<div class="vhead"><span class="eyebrow">서울·경기 교육청 · 평가원 · 한국사능력검정시험</span><h1>중요 공지</h1>' +
      '<p class="lead">시험 공고 게시판을 6시간마다 살펴 새 글을 모읍니다. 제목으로 ‘꼭 볼 것’을 가르고, 공지를 열어 <b>할 일 정리</b>를 누르면 Claude 가 본문과 첨부 공고문을 읽고 정보·컴퓨터 수험생이 언제 무엇을 해야 하는지 정리합니다.</p></div>';
    h += '<div class="filters" style="margin-top:0"><div class="chips">' + [["top", "꼭 볼 것"], ["unread", "새 글"], ["all", "전체"], ["imyong", "임용"], ["past", "기출 문제지"], ["cert", "한능검"]]
      .map(f => '<button class="chip" data-nf="' + f[0] + '" aria-pressed="' + (noticeFilter === f[0]) + '">' + f[1] + '<span class="n">' + groups[f[0]].length + "</span></button>").join("") + "</div>" +
      '<span style="margin-left:auto" class="hint">' + (N.running ? '<span class="dot run"></span>받는 중…' : (N.fetched ? esc(ago(N.fetched)) + " 받음" : "아직 받지 않음")) + '</span><button class="ghostbtn" id="nf-refresh"' + (N.running ? " disabled" : "") + ">지금 새로 받기</button>" +
      (groups.unread.length ? '<button class="act" id="nf-readall">모두 읽음</button>' : "") + "</div>";
    if ((N.errors || []).length) h += '<div class="note-box"><b>일부 게시판을 받지 못했습니다.</b> ' + N.errors.map(esc).join(" · ") + "</div>";
    h += '<div class="rows">' + (list.length ? list.map(noticeRow).join("") : '<div class="empty">' + (items.length ? "이 조건에 맞는 공지가 없습니다." : "아직 받은 공지가 없습니다. ‘지금 새로 받기’를 누르세요.") + "</div>") + "</div>";
    h += '<p class="src" style="margin-top:12px">게시판: ' + (N.sources || []).map(s => '<a href="' + esc(s.home) + '" target="_blank" rel="noopener">' + esc(s.name) + " ↗</a>").join(" · ") +
      ". 제목 규칙으로 유치원·초등만의 공고와 평가원의 수능·검정고시 공지는 숨깁니다. 판단은 원문 공고로 꼭 다시 확인하세요.</p>";
    el.innerHTML = h;
    $$("[data-nf]", el).forEach(b => b.addEventListener("click", () => { noticeFilter = b.dataset.nf; RENDER.notices(); }));
    $("#nf-refresh", el).addEventListener("click", async () => { await api("/api/notices", { op: "refresh" }); NOTICES.running = true; RENDER.notices(); pollSync("notices"); });
    const ra = $("#nf-readall", el); if (ra) ra.addEventListener("click", async () => { await api("/api/notices", { op: "readall" }); await loadNotices(); refreshStatus(); RENDER.notices(); });
    $$(".row[data-key]", el).forEach(bindNoticeRow);
    if (openNotice) { const r = $('.row[data-key="' + CSS.escape(openNotice) + '"]', el); if (r) r.scrollIntoView({ block: "center" }); }
  };
  function shortTitle(t) {   // 임용 공고의 긴 꼬리를 줄인다 (원래 제목은 툴팁에)
    return String(t || "").replace(/,?\s*(?:특수\s*\(중등\)|보건|영양|사서|전문상담)(?:\s*[·ㆍ]\s*(?:특수\s*\(중등\)|보건|영양|사서|전문상담))+\s*(?:교사)?/g, "")
      .replace(/임용후보자\s*선정경쟁시험/g, "임용시험").replace(/\s{2,}/g, " ").trim();
  }
  function relBadge(rel) { return '<span class="badge ' + ({ "꼭 볼 것": "hot", "참고": "acc", "관계없음": "dim", "확인 필요": "warn" }[rel] || "dim") + '">' + esc(rel) + "</span>"; }
  function noticeRow(x) {
    const t = todayStr(), open = openNotice === x.key;
    const dl = x.deadline ? (x.deadline >= t ? '<span class="badge ' + (diffDays(x.deadline, t) <= 3 ? "hot" : "warn") + '">' + (x.deadline === t ? "오늘 마감" : "~" + esc(mdw(x.deadline))) + "</span>" : '<span class="badge dim">마감 ' + esc(mdw(x.deadline)) + "</span>") : "";
    const tagc = x.tier === "top" ? (/정보|기출/.test(x.tag) ? "acc" : "hot") : "";
    let h = '<div class="row' + (open ? " open" : "") + '" data-key="' + esc(x.key) + '"><div class="line1">' +
      (x.tag ? '<span class="tag ' + tagc + '">' + esc(x.tag) + "</span>" : "") + '<span class="ttl' + (!x.read && x.tier === "top" ? " unread" : "") + '" title="' + esc(x.title) + '">' + esc(shortTitle(x.title)) + "</span>" + dl +
      (x.analysis ? relBadge(x.analysis.relevance) : "") + '</div><div class="meta"><span>' + esc(x.src_name) + "</span><span>" + esc(x.posted ? fmt(x.posted) : "") + "</span></div>";
    if (open) {
      h += '<div class="acts" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><a class="ghostbtn" href="' + esc(x.url) + '" target="_blank" rel="noopener">원문 열기 ↗</a>' +
        '<button class="primary" data-analyze>' + (x.analysis ? "다시 정리" : "할 일 정리 (Claude)") + "</button>" +
        '<button class="act" data-unread>' + (x.read ? "안 읽음으로" : "읽음으로") + "</button></div><div data-out>" + (x.analysis ? anaHtml(x) : "") + "</div>";
    }
    return h + "</div>";
  }
  function anaHtml(x) {
    const a = x.analysis; if (!a) return "";
    const t = todayStr();
    return '<div class="ana"><div>' + relBadge(a.relevance) + " " + esc(a.summary) + "</div>" + (a.why ? '<div class="hint" style="margin-top:3px">' + esc(a.why) + "</div>" : "") +
      "<dl>" + (a.todo && a.todo.length ? "<dt>할 일</dt><dd><ul class=\"clean\" style=\"margin:0\">" + a.todo.map(s => "<li>" + esc(s) + "</li>").join("") + "</ul></dd>" : "") +
      (a.dates && a.dates.length ? "<dt>날짜</dt><dd><ul class=\"dates\">" + a.dates.map((d, i) => '<li><span class="dd">' + esc(fmt(d.date)) + "</span><span>" + esc(d.label) + "</span>" +
        (d.date >= t ? ' <button class="act ready" data-addev="' + i + '">일정에 추가</button>' : "") + "</li>").join("") + "</ul></dd>" : "") +
      (a.caution ? "<dt>주의</dt><dd>" + esc(a.caution) + "</dd>" : "") +
      (a.att && a.att.length ? "<dt>읽은 첨부</dt><dd class=\"hint\">" + a.att.map(esc).join(", ") + "</dd>" : "") + "</dl>" +
      '<div class="hint" style="margin-top:8px">' + esc(a.model || "Claude") + " 정리 · 원문 공고가 기준입니다</div></div>";
  }
  function bindNoticeRow(row) {
    const key = row.dataset.key, x = (NOTICES.items || []).find(i => i.key === key);
    $(".ttl", row).addEventListener("click", async () => {
      openNotice = openNotice === key ? null : key;
      if (openNotice && !x.read) { x.read = true; api("/api/notices", { op: "read", key }).then(refreshStatus); }
      history.replaceState(null, "", "#notices"); RENDER.notices();
    });
    const an = $("[data-analyze]", row);
    if (an) an.addEventListener("click", () => {
      const out = $("[data-out]", row); an.disabled = true;
      out.innerHTML = waitingHtml("본문과 첨부 공고문을 받는 중");
      runJob({ url: "/api/notices", data: { op: "analyze", key } }, {
        stage: s => { const w = $(".waiting span:last-child", out); if (w) w.firstChild.textContent = s + " "; },
        tick: j => tickEl(out, j),
        done: async j => { x.analysis = j.result; x.read = true; an.disabled = false; an.textContent = "다시 정리"; out.innerHTML = anaHtml(x); bindAna(row, x); refreshStatus(); },
        error: m => { an.disabled = false; out.innerHTML = '<div class="note-box">' + esc(m) + "</div>"; }
      });
    });
    const ur = $("[data-unread]", row);
    if (ur) ur.addEventListener("click", async () => { x.read = !x.read; await api("/api/notices", { op: x.read ? "read" : "unread", key }); refreshStatus(); RENDER.notices(); });
    bindAna(row, x);
  }
  function bindAna(row, x) {
    $$("[data-addev]", row).forEach(b => b.addEventListener("click", () => {
      const d = x.analysis.dates[+b.dataset.addev];
      addEvent({ name: d.label, date: d.date, note: x.src_name + " · " + x.title.slice(0, 60), url: x.url, urlLabel: "공지" });
      b.textContent = "추가됨"; b.disabled = true; toast("다가오는 일정에 넣었습니다");
    }));
  }
  function pollSync(which) {
    const loop = async () => {
      await refreshStatus();
      if (ST[which].running) return setTimeout(loop, 2500);
      if (which === "notices") { await loadNotices(); if (current() === "notices") RENDER.notices(); }
      else { await loadJobs(); if (current() === "jobs") RENDER.jobs(); }
      toast(which === "notices" ? "공지를 새로 받았습니다" : "구인 공고를 새로 받았습니다");
    };
    setTimeout(loop, 2000);
  }

  // ------------------------------------------------------------ 구인 공고
  let jobState = { region: "all", kind: "all", closed: false };
  try { jobState = Object.assign(jobState, JSON.parse(localStorage.getItem("p_jobs_filter") || "{}")); } catch (e) {}
  async function loadJobs() { try { JOBS = await api("/api/jobs"); } catch (e) { JOBS = JOBS || { items: [], errors: [e.message] }; } }
  function kst(date, time) { return new Date(date + "T" + (time || "23:59") + ":00+09:00"); }
  function jobDeadline(it) { return it.apply && it.apply.end ? kst(it.apply.end, it.apply.end_time) : null; }
  function jobStatus(it) {
    const d = jobDeadline(it), now = new Date(), today = todayStr();
    if (!d) return { cls: "", dd: "상시" };
    const ms = d - now, days = diffDays(it.apply.end, today);
    if (ms < 0) return { cls: "closed", dd: "마감", closed: true };
    if (days === 0) { const hh = Math.floor(ms / 3600000), mm = Math.floor(ms % 3600000 / 60000); return { cls: "today", dd: "D-day", left: (hh ? hh + "시간 " : "") + mm + "분 남음" }; }
    return { cls: days <= 3 ? "soon" : "", dd: "D-" + days };
  }
  RENDER.jobs = function () {
    const el = $("#v-jobs");
    if (!JOBS || (ST.jobs.fetched && JOBS.generated_at !== ST.jobs.fetched && !JOBS.running)) {
      if (!JOBS) el.innerHTML = waitingHtml("구인 공고를 불러오는 중");
      loadJobs().then(() => { if (current() === "jobs") RENDER.jobs(); }); if (!JOBS) return;
    }
    const data = JOBS, all = data.items || [];
    const match = it => (jobState.region === "all" || it.region === jobState.region) && (jobState.kind === "all" || it.kind === jobState.kind);
    const core = all.filter(it => it.tier === "core" && match(it));
    const open = core.filter(it => !jobStatus(it).closed);
    let shown = (jobState.closed ? core : open).slice().sort((a, b) => {
      const ca = jobStatus(a).closed ? 1 : 0, cb = jobStatus(b).closed ? 1 : 0; if (ca !== cb) return ca - cb;
      return (jobDeadline(a) || Infinity) - (jobDeadline(b) || Infinity);
    });
    const related = all.filter(it => it.tier === "related" && match(it) && !jobStatus(it).closed);
    const allCore = all.filter(it => it.tier === "core"), openAll = allCore.filter(it => !jobStatus(it).closed);
    const todayN = openAll.filter(it => jobStatus(it).cls === "today").length, weekN = openAll.filter(it => jobDeadline(it) && jobDeadline(it) - new Date() < 7 * DAY).length;
    let h = '<div class="vhead"><span class="eyebrow">서울특별시교육청 · 경기도교육청 · 계약제교원 · 사립 정규</span><h1>정보과 구인 공고</h1>' +
      '<p class="lead">두 교육청 구인 포털에서 정보(정보·컴퓨터) 과목 기간제·시간강사와 사립학교 정규교원 공고만 모아 마감이 가까운 순서로 보여 줍니다. 3시간마다 새로 받고, 첨부 한글 공고문에서 면접·발표 일정을 뽑아 둡니다.</p></div>';
    h += '<div class="jsum"><span><b>' + openAll.length + "</b>건 접수 중</span><span class=\"hot\"><b>" + todayN + "</b>건 오늘 마감</span><span><b>" + weekN + "</b>건 7일 안 마감</span>" +
      "<span><b>" + openAll.filter(it => it.region === "서울").length + "</b>서울 · <b>" + openAll.filter(it => it.region === "경기").length + "</b>경기</span>" +
      '<span style="margin-left:auto">' + (data.running ? '<span class="dot run"></span>받는 중…' : (data.generated_at ? esc(ago(data.generated_at)) + " 받음" : "아직 받지 않음")) + ' <button class="ghostbtn" id="jb-refresh"' + (data.running ? " disabled" : "") + ">지금 새로 받기</button></span></div>";
    if ((data.errors || []).length) h += '<div class="note-box"><b>일부를 받지 못했습니다.</b> ' + data.errors.slice(0, 4).map(esc).join(" · ") + "</div>";
    h += '<section class="sec" style="margin-top:20px"><div class="sh"><h2>이번 주 일정</h2></div><div class="week">' + weekHtml(all) + '</div><div class="legend"><span><i style="background:var(--red-bg)"></i>접수 마감</span><span><i style="background:var(--accent-bg)"></i>면접·수업시연</span><span><i style="background:var(--amber-bg)"></i>합격 발표·통보</span></div></section>';
    h += '<div class="filters"><div class="chips">' + [["all", "전체"], ["서울", "서울"], ["경기", "경기"]].map(f => '<button class="chip" data-jr="' + f[0] + '" aria-pressed="' + (jobState.region === f[0]) + '">' + f[1] + "</button>").join("") + '</div><div class="chips">' +
      [["all", "모든 유형"], ["기간제", "기간제"], ["시간강사", "시간강사"], ["사립 정규", "사립 정규"]].map(f => '<button class="chip" data-jk="' + f[0] + '" aria-pressed="' + (jobState.kind === f[0]) + '">' + f[1] + "</button>").join("") +
      '</div><label class="hint"><input type="checkbox" id="jb-closed"' + (jobState.closed ? " checked" : "") + "> 마감된 공고도 보기</label></div>";
    h += '<div class="rows">' + (shown.length ? shown.map(jobCard).join("") : '<div class="empty">조건에 맞는 접수 중 공고가 없습니다.' + (core.length ? " ‘마감된 공고도 보기’를 켜면 " + core.length + "건이 보입니다." : "") + "</div>") + "</div>";
    if (related.length) h += '<details class="reveal" style="margin-top:18px"><summary>참고: 방과후·초등 컴퓨터·코딩 강사 공고 ' + related.length + '건</summary><div class="rows" style="margin-top:8px">' + related.map(jobCard).join("") + "</div></details>";
    h += '<p class="src" style="margin-top:16px">출처: ' + (data.sources || []).map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + " ↗</a>").join(" · ") +
      ". 목록은 받은 때의 모습입니다. 지원 전에 원문 공고와 첨부 공고문에서 일정·제출서류·자격을 꼭 확인하세요. 접수 기간이 긴 상시 공고는 채용되면 일찍 마감될 수 있습니다.</p>";
    el.innerHTML = h;
    $$("[data-jr]", el).forEach(b => b.addEventListener("click", () => { jobState.region = b.dataset.jr; saveJobState(); RENDER.jobs(); }));
    $$("[data-jk]", el).forEach(b => b.addEventListener("click", () => { jobState.kind = b.dataset.jk; saveJobState(); RENDER.jobs(); }));
    $("#jb-closed", el).addEventListener("change", e => { jobState.closed = e.target.checked; saveJobState(); RENDER.jobs(); });
    $("#jb-refresh", el).addEventListener("click", async () => { await api("/api/jobs", { op: "refresh" }); JOBS.running = true; RENDER.jobs(); pollSync("jobs"); });
    $$("[data-copy]", el).forEach(b => b.addEventListener("click", () => { navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = "복사됨"; setTimeout(() => { b.textContent = "복사"; }, 1500); }); }));
  };
  function saveJobState() { try { localStorage.setItem("p_jobs_filter", JSON.stringify(jobState)); } catch (e) {} }
  function jobCard(it) {
    const st = jobStatus(it), reg = it.region === "서울" ? "seoul" : "gg";
    const hrs = (it.hours || "").trim();
    const facts = [];
    if (it.subject) facts.push(["과목", it.subject]);
    if (it.work && it.work.start) facts.push(["근무 기간", mdw(it.work.start) + " ~ " + mdw(it.work.end)]);
    if (it.apply && it.apply.start) facts.push(["접수 기간", mdw(it.apply.start) + (it.apply.start_time ? " " + it.apply.start_time : "") + " ~ " + mdw(it.apply.end) + " " + (it.apply.end_time || "")]);
    if (hrs && hrs !== "시간") facts.push(["근무 시간", hrs]);
    if (it.pay || it.pay_note) facts.push(["보수", [it.pay, it.pay_note].filter(Boolean).join(" · ")]);
    if (it.how) facts.push(["접수 방법", it.how]);
    if (it.docs && it.docs !== "-") facts.push(["제출 서류", it.docs]);
    const long = it.apply && it.apply.start && it.apply.end && diffDays(it.apply.end, it.apply.start) > 30;
    return '<article class="job' + (st.closed ? " closed" : "") + '"><div class="due ' + st.cls + '"><span class="dd">' + esc(st.dd) + "</span>" +
      (it.apply && it.apply.end ? '<span class="w">' + esc(mdw(it.apply.end)) + "<br>" + esc(it.apply.end_time || "시각은 공고문") + "</span>" : "") + (st.left ? '<span class="left">' + esc(st.left) + "</span>" : "") + "</div>" +
      '<div class="body"><div class="school"><span class="rg ' + reg + '">' + esc(it.region) + "</span><span>" + esc(it.school) + "</span>" + (it.area ? "<span>" + esc(it.area) + "</span>" : "") +
      '<span class="tag acc">' + esc(it.kind) + "</span>" + (it.school_level ? "<span>" + esc(it.school_level) + "</span>" : "") + (long ? '<span class="tag warn">상시 · 조기 마감 가능</span>' : "") +
      (it.posted ? '<span class="hint">등록 ' + esc(mdw(it.posted)) + "</span>" : "") + "</div><h3>" + esc(it.title) + "</h3>" +
      (it.note ? '<div class="warnline">' + esc(it.note) + "</div>" : "") +
      '<dl class="facts">' + facts.map(f => "<dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd>").join("") + "</dl>" +
      (it.schedule && it.schedule.length ? '<ul class="sched">' + it.schedule.map(s => "<li>" + esc(s) + "</li>").join("") + "</ul>" : "") +
      '<div class="acts"><a href="' + esc(it.url) + '" target="_blank" rel="noopener"><b>원문 공고 ↗</b></a>' +
      (it.files || []).slice(0, 3).map(f => '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name.length > 40 ? f.name.slice(0, 38) + "…" : f.name) + "</a>").join("") +
      (it.phone ? '<span>교무실 <span class="phone">' + esc(it.phone) + '</span> <button class="act" data-copy="' + esc(it.phone) + '">복사</button></span>' : "") + "</div></div></article>";
  }
  function jobEvents(all) {
    const out = [];
    all.forEach(it => {
      if (it.tier !== "core" || jobStatus(it).closed) return;
      if (it.apply && it.apply.end) out.push({ day: it.apply.end, type: "deadline", time: it.apply.end_time, label: it.school + " 마감" });
      (it.schedule || []).forEach(line => {
        const type = /면접|시연|심층/.test(line) ? "interview" : /발표|통보|합격/.test(line) ? "result" : null;
        if (!type) return;
        const m = line.match(/(?:(20\d\d)\s*\.\s*)?(\d{1,2})\s*\.\s*(\d{1,2})\.?\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})?/);
        if (!m) return;
        const y = m[1] || (it.apply.end || todayStr()).slice(0, 4);
        out.push({ day: y + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2), type, time: m[4] || "", label: it.school + (type === "interview" ? " 면접" : " 발표") });
      });
    });
    return out;
  }
  function weekHtml(all) {
    const ev = jobEvents(all), t = todayStr(), cells = [];
    for (let i = 0; i < 7; i++) {
      const key = addDays(t, i), list = ev.filter(e => e.day === key).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
      cells.push('<div class="day' + (i === 0 ? " today" : "") + '"><span class="dn">' + esc(mdw(key)) + (i === 0 ? " 오늘" : "") + "</span>" +
        list.map(e => '<span class="ev ' + e.type + '">' + (e.time ? esc(e.time) + " " : "") + esc(e.label) + "</span>").join("") + "</div>");
    }
    return cells.join("");
  }

  // ------------------------------------------------------------ 공부 길잡이
  RENDER.guide = function () {
    const G = C.guide || {}, done = settings().done || {}, el = $("#v-guide");
    let h = '<div class="vhead"><span class="eyebrow">노베이스 출발</span><h1>공부 길잡이</h1><p class="lead">' + rich(G.lead || "") + "</p></div>";
    if (G.reality) h += '<div class="note-box"><b>' + rich(G.reality.title) + "</b>" + G.reality.body.map(p => '<p style="margin-top:6px">' + rich(p) + "</p>").join("") + "</div>";
    if (sprintActive()) h += sprintHtml(done);
    if (G.map) h += '<section class="sec"><div class="sh"><h2>' + esc(G.map.title) + '</h2></div><div class="cols2">' + G.map.items.map(m => '<div class="area"><div class="ah"><b>' + rich(m.name) + '</b></div><p class="small muted" style="margin-top:4px">' + rich(m.desc) + "</p></div>").join("") + "</div></section>";
    const gp = pct(guideTasks());
    h += '<section class="sec"><div class="sh"><h2>6단계 로드맵</h2><span class="r">진도 ' + gp + '%</span></div><div class="prog" style="margin:8px 0 4px"><i style="width:' + gp + '%"></i></div>';
    (G.phases || []).forEach((p, i) => {
      h += '<div class="phase"><div class="no">' + (i + 1) + '</div><div><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h3>' + rich(p.title) + '</h3><span class="tag">' + esc(p.when) + '</span></div><p class="muted small" style="margin:4px 0 6px">' + rich(p.goal) + "</p>" +
        (p.tasks || []).map(t => taskHtml(t, done)).join("") + (p.resources && p.resources.length ? '<p class="src" style="margin-top:4px">자료: ' + p.resources.map(link).join(" · ") + "</p>" : "") + "</div></div>";
    });
    h += "</section>";
    if (G.week) h += '<section class="sec"><div class="sh"><h2>' + esc(G.week.title) + '</h2></div><div class="tw"><table><thead><tr><th>요일</th><th>오전</th><th>오후</th><th>저녁</th></tr></thead><tbody>' + G.week.rows.map(r => "<tr><td>" + esc(r[0]) + "</td><td>" + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td><td>" + rich(r[3]) + "</td></tr>").join("") + "</tbody></table></div>" + (G.week.note ? '<p class="small muted">' + rich(G.week.note) + "</p>" : "") + "</section>";
    if (G.writing) h += '<section class="sec"><div class="sh"><h2>' + esc(G.writing.title) + '</h2></div><ul class="clean">' + G.writing.items.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></section>";
    el.innerHTML = h; bindTasks(el);
  };
  function sprintHtml(done) {
    const S = C.sprint; if (!S) return "";
    const t = todayStr(), p = pct(sprintTasks());
    let h = '<section class="sec"><div class="sh"><h2>' + esc(S.title) + '</h2><span class="r">진도 ' + p + '%</span></div><p class="small muted" style="margin:6px 0">' + rich(S.lead) + '</p><div class="prog" style="margin-bottom:6px"><i style="width:' + p + '%"></i></div>';
    S.weeks.forEach((w, i) => {
      const cur = t >= w.range[0] && t <= w.range[1], past = t > w.range[1];
      h += '<div class="wk' + (cur ? " cur" : "") + '"><div class="wh"><span class="tag' + (cur ? " acc" : "") + '">' + (i + 1) + "주차 · " + esc(mdw(w.range[0])) + " ~ " + esc(mdw(w.range[1])) + "</span><b>" + esc(w.title) + "</b>" + (cur ? '<span class="badge hot">이번 주</span>' : past ? '<span class="badge dim">지남</span>' : "") + "</div>" + w.tasks.map(x => taskHtml(x, done)).join("") + "</div>";
    });
    if (S.dayOf) h += '<div class="wk"><div class="wh"><b>' + esc(S.dayOf.title) + '</b></div><ul class="clean small">' + S.dayOf.items.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></div>";
    if (S.after) h += '<div class="wk"><div class="wh"><b>' + esc(S.after.title) + "</b></div>" + S.after.tasks.map(x => taskHtml(x, done)).join("") + "</div>";
    return h + "</section>";
  }

  // ------------------------------------------------------------ 임용 표준안
  function examCount(areas) { let n = 0; ((C.exams || {}).years || []).forEach(y => (y.items || []).forEach(it => { if (areas.indexOf(it.area) >= 0) n++; })); return n; }
  function stdBlock(title, examAreas, areas, prefix, done) {
    const n = examAreas.length ? examCount(examAreas) : 0, ids = areas.map((a, i) => prefix + i), dn = ids.filter(id => done[id]).length;
    return '<div class="std-subj"><div class="sh2"><b>' + esc(title) + "</b>" + (examAreas.length ? '<span class="tag acc">기출 ' + n + "문항</span>" : '<span class="tag">기출 영역 없음</span>') +
      '<span class="hint">' + dn + "/" + areas.length + " 정리</span></div>" +
      areas.map((a, i) => { const id = prefix + i; return '<label class="task' + (done[id] ? " done" : "") + '"><input type="checkbox" data-task="' + esc(id) + '"' + (done[id] ? " checked" : "") + "><span><b>" + esc(a.name) + '</b><br><span class="small muted">' + esc(a.items.join(" · ")) + "</span></span></label>"; }).join("") + "</div>";
  }
  RENDER.standard = function () {
    const T = C.standard || {}, done = settings().done || {}, el = $("#v-standard"), p = pct(standardIds());
    let h = '<div class="vhead"><span class="eyebrow">한국교육과정평가원 · 2016.7.22.</span><h1>임용 표준안</h1><p class="lead">' + rich(T.lead || "") + "</p>" + srcLine(T.sources) + "</div>";
    if (T.facts) h += '<section class="sec" style="margin-top:0"><div class="sh"><h2>문서 개요</h2></div><ul class="clean small">' + T.facts.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></section>";
    if (T.cautions) h += '<div class="note-box"><b>공부할 때 주의할 점</b><ul class="clean">' + T.cautions.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></div>";
    h += '<section class="sec"><div class="sh"><h2>평가 영역 정리 진도</h2><span class="r">' + p + '%</span></div><div class="prog" style="margin:8px 0"><i style="width:' + p + '%"></i></div><p class="hint">기출 문항 수는 기출 정리의 2014·2016~2026학년도 269문항을 영역별로 센 값입니다.</p></section>';
    if (T.pedagogy) h += '<section class="sec"><div class="sh"><h2>교과교육학</h2></div>' + stdBlock(T.pedagogy.subject, T.pedagogy.examAreas, T.pedagogy.areas, "std-p-", done) + "</section>";
    if (T.content) h += '<section class="sec"><div class="sh"><h2>교과내용학 (기본이수과목 15)</h2></div>' + T.content.map((s, si) => stdBlock(s.subject, s.examAreas, s.areas, "std-c-" + si + "-", done)).join("") + "</section>";
    el.innerHTML = h; bindTasks(el);
  };

  // ------------------------------------------------------------ 교육과정 요약
  RENDER.curriculum = function () {
    const K = C.curriculum || {}, el = $("#v-curriculum");
    let h = '<div class="vhead"><span class="eyebrow">' + esc(K.eyebrow || "2022 개정 교육과정") + '</span><h1>교육과정 요약</h1><p class="lead">' + rich(K.lead || "") + "</p>" + srcLine(K.sources) + "</div>";
    if (K.subjects) h += '<div class="toc">' + K.subjects.map(s => '<a class="chip" href="#curriculum" data-jump="cur-' + esc(s.id) + '">' + rich(s.title) + "</a>").join("") + '<a class="chip" href="#curriculum" data-jump="cur-compare">2015 개정과 비교</a></div>';
    if (K.keyPoints) h += '<section class="sec" style="margin-top:12px"><div class="sh"><h2>먼저 외울 것</h2></div><ul class="clean">' + K.keyPoints.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></section>";
    (K.subjects || []).forEach(s => {
      h += '<section class="sec" id="cur-' + esc(s.id) + '"><div class="sh"><h2>' + rich(s.title) + '</h2><span class="r">' + (s.meta || []).map(esc).join(" · ") + "</span></div>" + (s.goal ? '<p class="small muted" style="margin:8px 0">' + rich(s.goal) + "</p>" : "");
      (s.areas || []).forEach(a => {
        h += '<div class="area"><div class="ah"><b>' + rich(a.name) + "</b></div>" + (a.idea ? '<div class="idea">' + rich(a.idea) + "</div>" : "") +
          (a.standards && a.standards.length ? '<div class="std">' + a.standards.map(x => '<span class="code">' + esc(x.code) + "</span><span>" + rich(x.text) + "</span>").join("") + "</div>" : "") +
          (a.note ? '<p class="hint">' + rich(a.note) + "</p>" : "") + "</div>";
      });
      h += srcLine(s.sources) + "</section>";
    });
    if (K.compare) h += '<section class="sec" id="cur-compare"><div class="sh"><h2>2015 개정과 무엇이 달라졌나</h2></div><div class="tw"><table><thead><tr><th>항목</th><th>2015 개정</th><th>2022 개정</th></tr></thead><tbody>' + K.compare.map(r => "<tr><td>" + rich(r[0]) + '</td><td class="muted">' + rich(r[1]) + "</td><td>" + rich(r[2]) + "</td></tr>").join("") + "</tbody></table></div>" + srcLine(K.compareSources) + "</section>";
    if (K.teaching) h += '<section class="sec"><div class="sh"><h2>교수·학습과 평가 방향 요점</h2></div><div class="cols2">' + K.teaching.map(b => '<div class="area"><div class="ah"><b>' + rich(b.title) + '</b></div><ul class="clean small">' + b.items.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></div>").join("") + "</div>" + srcLine(K.teachingSources) + "</section>";
    el.innerHTML = h; bindJumps(el);
  };
  function bindJumps(el) { $$("[data-jump]", el).forEach(a => a.addEventListener("click", e => { e.preventDefault(); const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); })); }

  // ------------------------------------------------------------ 기출 정리
  const examFilter = { year: "all", kind: "all" };
  RENDER.exams = function () {
    const X = C.exams || {}, years = X.years || [], el = $("#v-exams");
    let h = '<div class="vhead"><span class="eyebrow">한국교육과정평가원 출제</span><h1>기출 정리</h1><p class="lead">' + rich(X.lead || "") + "</p>" + srcLine(X.sources) + "</div>";
    const counts = {}, ped = {};
    years.forEach(y => (y.items || []).forEach(it => { counts[it.area] = (counts[it.area] || 0) + 1; if (it.ped) ped[it.area] = true; }));
    const areas = Object.keys(counts).sort((a, b) => counts[b] - counts[a]), max = Math.max.apply(null, areas.map(a => counts[a]).concat([1]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (areas.length) h += '<section class="sec" style="margin-top:0"><div class="sh"><h2>영역별 출제 빈도</h2><span class="r">' + total + '문항 · <span style="color:#c79a2e">■</span> 교과교육학 <span style="color:var(--accent)">■</span> 교과내용학</span></div><div class="bars">' + areas.map(a =>
      '<div class="bar' + (ped[a] ? " ped" : "") + '"><span>' + esc(a) + '</span><span class="track"><i style="width:' + (counts[a] / max * 100).toFixed(1) + '%"></i></span><span class="n">' + counts[a] + "</span></div>").join("") + '</div><p class="hint">' + esc(X.freqNote || "") + "</p></section>";
    if (X.trends) h += '<section class="sec"><div class="sh"><h2>출제 경향 메모</h2></div><ul class="clean">' + X.trends.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul></section>";
    h += '<section class="sec"><div class="sh"><h2>연도별 문항 주제</h2></div><div class="chips" style="margin:8px 0 2px"><button class="chip" data-y="all">전체</button>' + years.map(y => '<button class="chip" data-y="' + esc(y.year) + '">' + esc(y.year) + "</button>").join("") +
      '</div><div class="chips"><button class="chip" data-k="all">모든 영역</button><button class="chip" data-k="ped">교과교육학만</button><button class="chip" data-k="con">교과내용학만</button></div><div id="yr-list"></div></section>';
    el.innerHTML = h;
    const draw = () => {
      $$("[data-y]", el).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.y === examFilter.year)));
      $$("[data-k]", el).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === examFilter.kind)));
      $("#yr-list", el).innerHTML = years.filter(y => examFilter.year === "all" || y.year === examFilter.year).map(y => {
        const items = (y.items || []).filter(it => examFilter.kind === "all" || (examFilter.kind === "ped" ? it.ped : !it.ped));
        return '<div class="yr"><div class="yh"><b>' + esc(y.year) + "</b>" + (y.links || []).map(l => '<span class="small">' + link(l) + "</span>").join(" ") + "</div>" + (y.note ? '<p class="hint">' + rich(y.note) + "</p>" : "") +
          (items.length ? '<div class="tw"><table><thead><tr><th style="width:62px">문항</th><th style="width:150px">영역</th><th>핵심 주제</th><th style="width:84px"></th></tr></thead><tbody>' + items.map(it =>
            '<tr><td class="num">' + esc(it.q) + '</td><td><span class="tag ' + (it.ped ? "ped" : "con") + '">' + esc(it.area) + "</span></td><td>" + rich(it.kw) + '</td><td><button class="act" data-addnote="' + esc(y.year + "|" + it.q + "|" + it.area + "|" + it.kw) + '">오답 노트에</button></td></tr>').join("") + "</tbody></table></div>"
            : '<p class="hint">이 조건에 맞는 문항이 없습니다.</p>') + "</div>";
      }).join("") || '<div class="empty">기출 자료가 없습니다.</div>';
    };
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.y) { examFilter.year = b.dataset.y; draw(); }
      else if (b.dataset.k) { examFilter.kind = b.dataset.k; draw(); }
      else if (b.dataset.addnote) { const p = b.dataset.addnote.split("|"); openNoteForm({ source: p[0] + " " + p[1] + "번", area: p[2], topic: p[3] }); }
    });
    draw();
  };

  // ------------------------------------------------------------ 교과교육학
  let drafts = null, draftTimer = null;
  function getDrafts() { if (!drafts) drafts = Object.assign({}, (Store.get("drafts") || {}).d || {}); return drafts; }
  function saveDrafts() { clearTimeout(draftTimer); draftTimer = setTimeout(() => Store.put("drafts", { type: "drafts", d: drafts, updatedAt: nowIso() }), 900); }
  RENDER.pedagogy = function () {
    const P = C.pedagogy || {}, el = $("#v-pedagogy");
    let h = '<div class="vhead"><span class="eyebrow">전공A·B 교과교육학</span><h1>교과교육학</h1><p class="lead">' + rich(P.lead || "") + "</p></div>";
    const areas = C.exam && C.exam.areas && C.exam.areas.pedagogy;
    if (areas) h += '<div class="info-box"><b>평가원이 정한 교과교육학(컴퓨터 교육론) 평가 영역 6가지</b><ul class="clean small">' + areas.map(r => "<li><b>" + esc(r[0]) + "</b> — " + esc(r[1]) + "</li>").join("") + "</ul></div>";
    if (P.themes) h += '<div class="toc">' + P.themes.map(t => '<a class="chip" href="#pedagogy" data-jump="ped-' + esc(t.id) + '">' + esc(t.short || t.title) + "</a>").join("") + (P.library ? '<a class="chip" href="#pedagogy" data-jump="ped-library">공인 자료 목록</a>' : "") + "</div>";
    const d = getDrafts();
    (P.themes || []).forEach(t => {
      h += '<section class="sec" id="ped-' + esc(t.id) + '"><div class="sh"><h2>' + rich(t.title) + "</h2></div>" + (t.summary ? '<p style="margin:8px 0">' + rich(t.summary) + "</p>" : "");
      if (t.points) h += '<ul class="clean">' + t.points.map(x => "<li>" + rich(x) + "</li>").join("") + "</ul>";
      if (t.models) h += t.models.map(m => '<div class="model"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b>' + rich(m.name) + "</b>" + (m.tag ? '<span class="tag">' + esc(m.tag) + "</span>" : "") + "</div>" + (m.stages ? '<ol class="steps">' + m.stages.map(s => "<li>" + esc(s) + "</li>").join("") + "</ol>" : "") + (m.desc ? '<p class="small">' + rich(m.desc) + "</p>" : "") + srcLine(m.sources) + "</div>").join("");
      if (t.table) h += '<div class="tw"><table><thead><tr>' + t.table.head.map(x => "<th>" + esc(x) + "</th>").join("") + "</tr></thead><tbody>" + t.table.rows.map(r => "<tr>" + r.map(c => "<td>" + rich(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
      h += srcLine(t.sources);
      (t.practice || []).forEach((q, qi) => {
        const pid = t.id + "-" + qi, g = Store.get("grade:" + pid);
        h += '<div class="practice" data-pid="' + esc(pid) + '"><div style="display:flex;gap:10px;align-items:baseline"><span class="tag ped">서술형 연습</span><span class="hint">자체 제작 문항 · 4점</span></div><p class="q">' + rich(q.q) + "</p>" +
          '<textarea data-pa="' + esc(pid) + '" placeholder="답안을 적고 채점을 받아 보세요. 쓰던 답안은 저장됩니다.">' + esc(d[pid] || "") + "</textarea>" +
          '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><button class="primary" data-grade="' + esc(pid) + '">Claude에게 채점 받기</button>' +
          '<details class="reveal" style="margin:0"><summary>모범 답안 요소 보기</summary><div class="answer">' + rich(q.a) + "</div></details></div>" +
          '<div data-gout="' + esc(pid) + '">' + (g && g.last ? gradeHtml(g.last, g.history) : "") + "</div></div>";
      });
      h += "</section>";
    });
    if (P.library) h += '<section class="sec" id="ped-library"><div class="sh"><h2>공인 자료 목록</h2><span class="r">' + P.library.length + '건</span></div><p class="hint" style="margin:6px 0">' + rich(P.libraryNote || "") + '</p><div class="tw"><table><thead><tr><th>자료</th><th>발행</th><th>연도</th><th>쓰임</th></tr></thead><tbody>' +
      P.library.map(l => "<tr><td>" + link(l) + "</td><td>" + esc(l.org) + '</td><td class="num">' + esc(l.year || "") + '</td><td class="small">' + rich(l.use || "") + "</td></tr>").join("") + "</tbody></table></div></section>";
    el.innerHTML = h; bindJumps(el);
    $$("textarea[data-pa]", el).forEach(ta => ta.addEventListener("input", () => { getDrafts()[ta.dataset.pa] = ta.value; saveDrafts(); }));
    $$("[data-grade]", el).forEach(b => b.addEventListener("click", () => gradePractice(b.dataset.grade, b)));
  };
  function findPractice(pid) {
    const parts = pid.split("-"), qi = +parts.pop(), tid = parts.join("-");
    const t = ((C.pedagogy || {}).themes || []).find(x => x.id === tid);
    return t && t.practice && t.practice[qi] ? { theme: t, item: t.practice[qi] } : null;
  }
  function gradeHtml(r, hist) {
    const d = r.result || {}, prev = (hist || []).slice(0, -1).map(x => x.result && x.result.score).filter(x => x != null);
    return '<div class="grade"><div class="gtop"><span class="score">' + (d.score != null ? d.score : "?") + "<small> / 4</small></span><div><b>" + esc(d.verdict || "") + '</b><div class="hint">' + esc(r.model || "Claude") + " 채점 · " + esc((r.t || "").replace("T", " ").slice(0, 16)) +
      (prev.length ? " · 지난 점수 " + prev.slice(-4).join(" → ") : "") + "</div></div></div>" +
      '<div class="cols"><div><b>점수가 된 요소</b><ul class="got">' + (d.got || []).map(x => "<li>" + esc(x) + "</li>").join("") + '</ul></div><div><b>빠졌거나 틀린 요소</b><ul class="miss">' + (d.missing || []).map(x => "<li>" + esc(x) + "</li>").join("") + "</ul></div></div>" +
      ((d.tips || []).length ? '<p class="small" style="margin-top:6px"><b>다음엔</b> ' + d.tips.map(esc).join(" · ") + "</p>" : "") +
      (d.rewrite ? '<details class="reveal"><summary>고쳐 쓴 모범 답안</summary><div class="answer">' + esc(d.rewrite) + "</div></details>" : "") + "</div>";
  }
  function gradePractice(pid, btn) {
    const f = findPractice(pid); if (!f) return;
    const ta = $('textarea[data-pa="' + CSS.escape(pid) + '"]'), out = $('[data-gout="' + CSS.escape(pid) + '"]');
    const answer = ta.value.trim();
    if (!answer) { out.innerHTML = '<p class="hint" style="margin-top:8px">답안을 먼저 적어 주세요.</p>'; ta.focus(); return; }
    btn.disabled = true; out.innerHTML = waitingHtml("채점하는 중");
    runJob({ task: "grade", pid, theme: f.theme.title, q: f.item.q, a: f.item.a, answer }, {
      tick: j => tickEl(out, j),
      done: async j => { btn.disabled = false; await Store.load(); const g = Store.get("grade:" + pid); out.innerHTML = gradeHtml(j.result, g && g.history); },
      error: m => { btn.disabled = false; out.innerHTML = '<div class="note-box">' + esc(m) + "</div>"; }
    });
  }

  // ------------------------------------------------------------ 오답 노트
  let noteFilter = "due", notePrefill = null;
  function openNoteForm(prefill) { notePrefill = prefill || {}; noteFilter = "all"; if (current() === "notes") RENDER.notes(); else location.hash = "notes"; }
  RENDER.notes = function () {
    const el = $("#v-notes"), all = Store.all("note").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const due = dueNotes(), t = todayStr();
    const list = noteFilter === "due" ? due : noteFilter === "mastered" ? all.filter(n => n.mastered) : noteFilter === "all" ? all : all.filter(n => n.area === noteFilter);
    const areas = {}; all.forEach(n => { if (n.area) areas[n.area] = (areas[n.area] || 0) + 1; });
    const pre = notePrefill || {};
    const opts = C.noteAreas || ["교과교육학", "프로그래밍", "운영체제", "기타"];
    let h = '<div class="vhead"><span class="eyebrow">간격 반복 1·3·7·14·30일</span><h1>오답 노트</h1><p class="lead">틀린 문제와 헷갈린 개념을 적어 두면 복습할 날을 알아서 잡아 줍니다. 복습할 때 기억났으면 <b>기억남</b>, 헷갈렸으면 <b>헷갈림</b>, 틀렸으면 <b>다시 틀림</b>.</p></div>' +
      '<details class="reveal"' + (notePrefill ? " open" : "") + ' style="border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:10px 0"><summary style="font-size:14px;font-weight:600">＋ 새 오답 적기</summary><form id="note-form" class="nform">' +
      '<div class="two"><label>출처<input type="text" id="nf-source" placeholder="예: 2025학년도 전공B 7번, 모의고사" value="' + esc(pre.source || "") + '"></label>' +
      '<label>영역<select id="nf-area">' + opts.map(a => "<option" + (a === pre.area ? " selected" : "") + ">" + esc(a) + "</option>").join("") + (pre.area && opts.indexOf(pre.area) < 0 ? "<option selected>" + esc(pre.area) + "</option>" : "") + "</select></label></div>" +
      '<label>주제·개념<input type="text" id="nf-topic" placeholder="예: 페이지 교체 LRU 계산" value="' + esc(pre.topic || "") + '"></label>' +
      '<label>문제 요지 (원문을 옮기지 말고 내 말로)<textarea id="nf-q"></textarea></label>' +
      '<div class="two"><label>내가 쓴 답<textarea id="nf-my"></textarea></label><label>맞는 답·핵심<textarea id="nf-right"></textarea></label></div>' +
      '<label>왜 틀렸나 (개념 부족 / 실수 / 시간 부족 / 용어 혼동 …)<input type="text" id="nf-why"></label>' +
      '<div style="display:flex;gap:10px;align-items:center"><button class="primary" type="submit">저장하고 내일 복습</button><span class="hint" id="nf-status"></span></div></form></details>';
    h += '<div class="chips" style="margin:12px 0 4px"><button class="chip" data-f="due">오늘 복습<span class="n">' + due.length + '</span></button><button class="chip" data-f="all">전체<span class="n">' + all.length + "</span></button>" +
      Object.keys(areas).map(a => '<button class="chip" data-f="' + esc(a) + '">' + esc(a) + '<span class="n">' + areas[a] + "</span></button>").join("") + '<button class="chip" data-f="mastered">졸업<span class="n">' + all.filter(n => n.mastered).length + "</span></button></div>";
    h += '<div class="rows">' + (list.length ? list.map(n => noteCard(n, t)).join("") : '<div class="empty">' + (noteFilter === "due" ? (all.length ? "오늘 복습할 오답이 없습니다. 다음 복습일까지 쉬거나 ‘전체’를 보세요." : "아직 적은 오답이 없습니다. ‘새 오답 적기’를 열거나 기출 정리 표에서 ‘오답 노트에’를 눌러 시작하세요.") : "이 조건에 맞는 오답이 없습니다.") + "</div>") + "</div>";
    el.innerHTML = h; notePrefill = null;
    $$("[data-f]", el).forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.f === noteFilter)); b.addEventListener("click", () => { noteFilter = b.dataset.f; RENDER.notes(); }); });
    $("#note-form", el).addEventListener("submit", e => {
      e.preventDefault();
      const g = id => $(id, el).value.trim();
      if (!g("#nf-topic") && !g("#nf-q")) { $("#nf-status", el).textContent = "주제나 문제 요지 중 하나는 적어 주세요."; return; }
      Store.put(uid("n"), { type: "note", createdAt: nowIso(), source: g("#nf-source"), area: $("#nf-area", el).value, topic: g("#nf-topic"), question: g("#nf-q"), myAnswer: g("#nf-my"), correct: g("#nf-right"), reason: g("#nf-why"), stage: 0, nextReview: addDays(todayStr(), 1), history: [] });
      noteFilter = "all"; RENDER.notes(); nav(); toast("저장했습니다 — 내일 복습 목록에 나옵니다");
    });
    $$(".ncard", el).forEach(bindNote);
  };
  function expHtml(x, saved) {
    if (!x) return "";
    return '<div class="exp"><div class="gist">' + esc(x.gist || "") + "</div>" + (x.wrong ? '<div class="wrong">' + esc(x.wrong) + "</div>" : "") +
      (x.trap ? '<p class="small" style="margin-top:6px"><span class="tag hot">자주 하는 실수</span> ' + esc(x.trap) + "</p>" : "") +
      '<details class="reveal"><summary>핵심 개념 · 변형 문제</summary>' + ((x.concept || []).length ? '<ul class="clean">' + x.concept.map(c => "<li>" + esc(c) + "</li>").join("") + "</ul>" : "") +
      (x.variant ? '<div class="lbl">변형 문제</div><p>' + esc(x.variant.q) + '</p><details class="reveal"><summary>답 보기</summary><div class="answer">' + esc(x.variant.a) + "</div></details>" : "") + "</details>" +
      '<div class="hint" style="margin-top:6px">' + (saved ? "저장한 해설" : "방금 받은 해설") + " · " + esc(x.model || "Claude") + "</div></div>";
  }
  function noteCard(n, t) {
    const overdue = n.nextReview && n.nextReview < t ? diffDays(t, n.nextReview) : 0;
    const badge = n.mastered ? '<span class="badge ok">졸업</span>' : n.nextReview <= t ? '<span class="badge hot">' + (overdue ? overdue + "일 밀림" : "오늘 복습") + "</span>" : '<span class="badge dim">' + esc(mdw(n.nextReview)) + " 복습</span>";
    const ex = typeof n.explain === "object" ? n.explain : null;
    return '<article class="ncard" data-id="' + esc(n.id) + '"><div class="nt">' + badge + '<span class="tag ' + (/교육|교수|평가/.test(n.area || "") ? "ped" : "con") + '">' + esc(n.area || "") + '</span><span class="hint">' + esc(n.source || "") + '</span><span class="hint">' + (n.stage || 0) + "/" + REVIEW_STEPS.length + "단계</span></div>" +
      "<h4>" + esc(n.topic || (n.question || "").slice(0, 40)) + "</h4><dl>" + (n.question ? "<dt>문제 요지</dt><dd>" + esc(n.question) + "</dd>" : "") +
      (n.myAnswer ? "<dt>내 답</dt><dd>" + esc(n.myAnswer) + "</dd>" : "") + (n.correct ? "<dt>맞는 답</dt><dd>" + esc(n.correct) + "</dd>" : "") + (n.reason ? "<dt>틀린 이유</dt><dd>" + esc(n.reason) + "</dd>" : "") + "</dl>" +
      (ex ? expHtml(ex, true) : (n.explain ? '<details class="reveal"><summary>저장한 Claude 해설</summary><div class="answer">' + esc(n.explain) + "</div></details>" : "")) +
      '<div data-out></div><div class="acts">' + (n.mastered ? '<button class="ghostbtn" data-act="revive">다시 복습 목록에</button>' :
        '<button class="primary" data-act="good">기억남</button><button class="ghostbtn" data-act="hard">헷갈림</button><button class="ghostbtn" data-act="again">다시 틀림</button>') +
      '<button class="act ready" data-act="explain">' + (ex ? "해설 다시 받기" : "Claude 해설 받기") + '</button><button class="act warn" data-act="delete">지우기</button></div></article>';
  }
  function bindNote(card) {
    card.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      let n = Store.get(card.dataset.id); if (!n) return;
      n = JSON.parse(JSON.stringify(n));
      const t = todayStr(), act = b.dataset.act;
      if (act === "delete") { if (armed(b)) { Store.remove(n.id); RENDER.notes(); nav(); } return; }
      if (act === "explain") return explainNote(n, card, b);
      n.history = (n.history || []).concat([{ at: t, result: act }]);
      if (act === "good") { n.stage = (n.stage || 0) + 1; if (n.stage >= REVIEW_STEPS.length) { n.mastered = true; n.nextReview = null; } else n.nextReview = addDays(t, REVIEW_STEPS[n.stage]); }
      else if (act === "hard") n.nextReview = addDays(t, Math.max(1, Math.ceil(REVIEW_STEPS[n.stage || 0] / 2)));
      else if (act === "again") { n.stage = 0; n.nextReview = addDays(t, 1); }
      else if (act === "revive") { n.mastered = false; n.stage = 0; n.nextReview = addDays(t, 1); }
      n.updatedAt = nowIso();
      Store.put(n.id, n); RENDER.notes(); nav();
      toast(act === "good" ? (n.mastered ? "졸업했습니다" : mdw(n.nextReview) + "에 다시 봅니다") : act === "hard" ? mdw(n.nextReview) + "에 다시 봅니다" : "내일 다시 봅니다");
    });
  }
  function explainNote(n, card, btn) {
    const out = $("[data-out]", card);
    btn.disabled = true; out.innerHTML = waitingHtml("해설을 쓰는 중");
    runJob({ task: "explain", note: n.id }, {
      tick: j => tickEl(out, j),
      done: j => {
        btn.disabled = false; out.innerHTML = expHtml(j.result, false) + '<button class="act ready" data-save>이 해설 저장</button>';
        $("[data-save]", out).addEventListener("click", ev => { const cur = JSON.parse(JSON.stringify(Store.get(n.id) || n)); cur.explain = j.result; cur.updatedAt = nowIso(); Store.put(n.id, cur); ev.target.textContent = "저장됨"; ev.target.disabled = true; });
      },
      error: m => { btn.disabled = false; out.innerHTML = '<div class="note-box">' + esc(m) + "</div>"; }
    });
  }

  // ------------------------------------------------------------ 질문하기
  let askThread = null, askMode = "ask", askCtl = null;
  const MODE_LABEL = { ask: "질문", answer: "답안 만들기", make: "문제 만들기" };
  const MODE_SUGGEST = {
    ask: C.askSuggestions || [],
    answer: ["(기출 문항을 그대로 붙여 넣으세요) 아래 문항의 모범 답안과 채점 요소를 만들어 줘", "이 C 코드의 실행 결과를 묻는 문항인데 답과 추적 과정을 보여 줘:", "교육학 논술 문항이야. 답안 개요와 핵심 문장을 써 줘:"],
    make: ["운영체제 페이지 교체(LRU·FIFO) 서술형 2문항", "2022 개정 정보과 성취기준을 묻는 단답형 3문항", "SQL 조인·집계 서술형 1문항 + 정규화 서술형 1문항", "PRIMM·짝 프로그래밍 수업 장면을 주고 묻는 교과교육학 서술형 2문항"]
  };
  function threads() { return Store.all("thread").sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); }
  RENDER.ask = function () {
    const el = $("#v-ask"), ths = threads();
    if (askThread && !Store.get(askThread)) askThread = null;
    if (askThread === null && ths.length && !RENDER.ask.fresh) askThread = ths[0].id;
    const th = askThread ? Store.get(askThread) : null;
    let h = '<div class="vhead"><span class="eyebrow">Claude 튜터 · 구독 사용량으로 돕니다</span><h1>질문하기</h1><p class="lead">교육과정·교과교육학·전공 내용을 묻거나, 답이 없는 문항의 <b>답안</b>을 만들거나, 원하는 영역의 <b>문제</b>를 만들어 받습니다. 대화는 이 컴퓨터에 저장됩니다.</p></div>';
    h += '<div class="askwrap"><div class="threads"><button class="ghostbtn" id="ask-new" style="width:100%;margin-bottom:8px">＋ 새 대화</button>' +
      (ths.length ? ths.map(x => '<a class="th' + (x.id === askThread ? " on" : "") + '" data-th="' + esc(x.id) + '">' + esc(x.title || "대화") + "<small>" + esc(MODE_LABEL[x.mode] || "질문") + " · " + esc((x.updatedAt || "").slice(5, 16).replace("T", " ")) + (x.pending ? " · 답 쓰는 중" : "") + "</small></a>").join("") : '<p class="hint">아직 대화가 없습니다.</p>') + "</div>";
    h += '<div class="chat"><div id="chat-log">' + (th ? (th.turns || []).map(turnHtml).join("") : '<div class="empty" style="border:0">왼쪽에서 대화를 고르거나, 아래에 물어보세요.</div>') +
      (th && th.pending && !askCtl ? '<div class="msg" id="pending-msg">' + waitingHtml("답을 쓰는 중 (다른 창에서 물은 것)") + "</div>" : "") + "</div>" +
      '<div class="composer"><div class="modes" role="group" aria-label="물음 종류">' + Object.keys(MODE_LABEL).map(m => '<button data-mode="' + m + '" aria-pressed="' + (askMode === m) + '">' + MODE_LABEL[m] + "</button>").join("") + "</div>" +
      '<div class="suggest">' + (MODE_SUGGEST[askMode] || []).map(s => '<button data-sug="' + esc(s) + '">' + esc(s) + "</button>").join("") + "</div>" +
      '<textarea id="ask-input" placeholder="' + esc(askMode === "answer" ? "문항을 그대로 붙여 넣으세요 (보기·코드 포함). 그림이 있으면 말로 설명해 주세요." : askMode === "make" ? "영역·주제·문항 수를 적으세요. 예: 네트워크 서브넷 계산 서술형 2문항" : "예: 2022 개정 중학교 정보의 인공지능 영역 성취기준을 정리해 줘") + '"></textarea>' +
      '<div class="crow"><button class="primary" id="ask-send">보내기</button><button class="ghostbtn" id="ask-stop" hidden>멈추기</button>' +
      '<span class="hint">Ctrl+Enter 로 보내기 · ' + esc(ST.claude && ST.claude.available === false ? "Claude Code 를 찾지 못했습니다" : "") + "</span>" +
      (th ? '<button class="act warn" id="ask-del" style="margin-left:auto">이 대화 지우기</button>' : "") + "</div></div></div></div>";
    el.innerHTML = h;
    $("#ask-new", el).addEventListener("click", () => { askThread = null; RENDER.ask.fresh = true; RENDER.ask(); $("#ask-input").focus(); });
    $$("[data-th]", el).forEach(a => a.addEventListener("click", () => { askThread = a.dataset.th; RENDER.ask.fresh = false; const t = Store.get(askThread); if (t && t.mode) askMode = t.mode; RENDER.ask(); }));
    $$("[data-mode]", el).forEach(b => b.addEventListener("click", () => { const v = $("#ask-input").value; askMode = b.dataset.mode; RENDER.ask(); $("#ask-input").value = v; }));
    $$("[data-sug]", el).forEach(b => b.addEventListener("click", () => { const i = $("#ask-input"); i.value = b.dataset.sug + (askMode === "answer" ? "\n\n" : ""); i.focus(); }));
    const input = $("#ask-input", el);
    input.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendAsk(); } });
    $("#ask-send", el).addEventListener("click", sendAsk);
    $("#ask-stop", el).addEventListener("click", () => { if (askCtl) askCtl.cancel(); });
    const del = $("#ask-del", el); if (del) del.addEventListener("click", () => { if (!armed(del)) return; Store.remove(askThread); askThread = null; RENDER.ask(); });
    if (th && th.pending && !askCtl) waitPending(askThread);
    const log = $("#chat-log", el); if (log.lastElementChild) log.lastElementChild.scrollIntoView({ block: "nearest" });
  };
  function turnHtml(m) {
    if (m.role === "user") return '<div class="msg me"><div class="b">' + (m.mode && m.mode !== "ask" ? '<span class="mode">' + esc(MODE_LABEL[m.mode]) + "</span>" : "") + esc(m.content) + "</div></div>";
    const tok = m.tok ? " · 토큰 " + Math.round((m.tok.in || 0) / 100) / 10 + "천" + (m.tok.cached ? " (캐시 " + Math.round(m.tok.cached / 100) / 10 + "천)" : "") : "";
    return '<div class="msg"><div class="who"><span>' + esc(m.model || "Claude") + "</span>" + (m.sec ? "<span>" + Math.round(m.sec) + "초</span>" : "") + "<span>" + esc(tok.replace(/^ · /, "")) + "</span>" + (m.stopped ? '<span class="tag warn">멈춤</span>' : "") + '</div><div class="md">' + md(m.content) + "</div></div>";
  }
  function waitPending(tid) {
    const loop = async () => {
      await Store.load();
      const t = Store.get(tid);
      if (t && t.pending && current() === "ask" && askThread === tid) return setTimeout(loop, 3000);
      if (current() === "ask") RENDER.ask();
    };
    setTimeout(loop, 3000);
  }
  function sendAsk() {
    const input = $("#ask-input"), q = input.value.trim();
    if (!q || askCtl) return;
    const log = $("#chat-log"), send = $("#ask-send"), stop = $("#ask-stop");
    const empty = $(".empty", log); if (empty) empty.remove();
    log.insertAdjacentHTML("beforeend", turnHtml({ role: "user", content: q, mode: askMode }));
    log.insertAdjacentHTML("beforeend", '<div class="msg" id="live"><div class="who"><span>Claude</span><span class="el"></span></div><div class="md">' + waitingHtml("생각하는 중") + "</div></div>");
    const live = $("#live"); live.scrollIntoView({ block: "nearest" });
    input.value = ""; send.disabled = true; stop.hidden = false;
    askCtl = runJob({ task: "ask", thread: askThread, question: q, mode: askMode }, {
      started: r => { askThread = r.thread; RENDER.ask.fresh = false; },
      text: t => { $(".md", live).innerHTML = md(t); },
      tick: j => { const e = $(".el", live); if (e) e.textContent = Math.round(j.elapsed) + "초"; },
      done: async () => { askCtl = null; await Store.load(); if (current() === "ask") RENDER.ask(); },
      cancelled: async () => { askCtl = null; await Store.load(); if (current() === "ask") RENDER.ask(); toast("멈췄습니다"); },
      error: async m => { askCtl = null; send.disabled = false; stop.hidden = true; $(".md", live).innerHTML = '<div class="note-box">' + esc(m) + "</div>"; await Store.load(); }
    });
  }

  // ------------------------------------------------------------ 이용법
  RENDER.help = function () {
    const el = $("#v-help");
    const rows = [
      ["개요", "D-day, 이번 주 할 일(40일 계획의 이번 주), 꼭 볼 공지, 마감이 가까운 구인, 다가오는 시험과 임용 일정·구성·선발 인원을 한 화면에. 목표일과 내 일정을 바꾸고 더할 수 있습니다."],
      ["중요 공지", "서울·경기 교육청 임용 게시판, 평가원 기출 게시판(정보·컴퓨터 문제지), 한국사능력검정시험 공지를 6시간마다 받습니다. 공지를 열고 ‘할 일 정리’를 누르면 Claude 가 본문과 첨부 한글 공고문을 읽고 정보·컴퓨터에 해당하는 숫자·날짜·할 일을 정리합니다. 날짜는 ‘일정에 추가’로 개요의 일정에 넣습니다."],
      ["구인 공고", "서울교육일자리포털과 경기도교육청 구인구직에서 정보 과목 기간제·시간강사·사립 정규 공고만 3시간마다 모읍니다. 첨부 공고문에서 면접·발표 일정을 뽑아 이번 주 달력에 올립니다."],
      ["공부 길잡이·표준안·교육과정·기출·교과교육학", "읽고 체크하는 공부 자료입니다. 체크한 진도는 목차 옆 %로 보입니다. 기출 표의 ‘오답 노트에’는 그 문항으로 오답 노트를 엽니다. 교과교육학의 서술형 연습은 답안을 쓰면 Claude 가 4점 만점으로 채점합니다(쓰던 답안은 저장)."],
      ["오답 노트", "저장하면 다음 날 ‘오늘 복습’에 나옵니다. 기억남 → 3·7·14·30일 뒤, 다섯 번째에 졸업. 헷갈림 → 간격의 절반 뒤. 다시 틀림 → 내일부터 처음부터. ‘Claude 해설 받기’는 한 줄 요지·틀린 지점·자주 하는 실수를 먼저, 개념과 변형 문제는 접어서 보여 줍니다."],
      ["질문하기", "세 가지: 질문(튜터), 답안 만들기(답이 공개되지 않은 기출·문제집 문항을 붙여 넣으면 모범 답안·채점 요소·확신도), 문제 만들기(영역·주제를 말하면 임용 형식 문항, 정답은 접혀 있음). 답은 쓰이는 대로 보이고 ‘멈추기’로 끊을 수 있습니다."],
      ["기록·설정", "모든 기록은 이 컴퓨터의 Paedagogium\\data 폴더에만 있습니다(매일 자동 사본). 백업 파일을 내려받거나 불러올 수 있고, Claude 계정(Athenaeum 전용 계정과 같이 쓰기)과 모델을 고릅니다."]
    ];
    el.innerHTML = '<div class="vhead"><span class="eyebrow">처음 쓰는 사람을 위한 안내</span><h1>이용법</h1><p class="lead">Paedagogium 은 이 컴퓨터에서 도는 작은 서버(localhost:8772)와 이 화면으로 되어 있습니다. Athenaeum 처럼 바탕화면의 아이콘이나 <code>Paedagogium_실행.bat</code> 으로 켭니다.</p></div>' +
      '<section class="sec" style="margin-top:0"><div class="sh"><h2>처음 30분</h2></div><ol class="clean" style="padding-left:1.4em"><li><a href="#home">개요</a>에서 D-day 와 이번 주 할 일을 봅니다.</li><li><a href="#notices">중요 공지</a>에서 ‘꼭 볼 것’을 열어 할 일 정리를 한 번 받아 봅니다.</li><li><a href="#guide">공부 길잡이</a>의 40일 계획 이번 주 항목을 체크합니다.</li><li><a href="#exams">기출 정리</a>에서 2026학년도 문항 주제를 훑고, 막힌 것을 ‘오답 노트에’ 넣습니다.</li><li><a href="#pedagogy">교과교육학</a>의 서술형 연습 하나를 쓰고 채점을 받습니다.</li></ol></section>' +
      '<section class="sec"><div class="sh"><h2>화면별로 할 수 있는 일</h2></div>' + rows.map(r => '<div class="srow"><div class="k">' + esc(r[0]) + '</div><div class="v" style="display:block">' + esc(r[1]) + "</div></div>").join("") + "</section>" +
      '<section class="sec"><div class="sh"><h2>자주 묻는 것</h2></div><div class="srow"><div class="k">Claude 가 안 돼요</div><div class="v" style="display:block">Claude Code 가 이 컴퓨터에 설치·로그인되어 있어야 합니다. 터미널에서 <code>claude</code> → <code>/login</code>. 토큰을 따로 쓰고 싶으면 <a href="#data">기록·설정</a>에서 Athenaeum 전용 계정을 고릅니다.</div></div>' +
      '<div class="srow"><div class="k">공지가 안 들어와요</div><div class="v" style="display:block">교육청 사이트가 잠깐 막히면 다음 차례(6시간 뒤)에 다시 받습니다. ‘지금 새로 받기’로 바로 받을 수 있고, 실패한 게시판은 화면 위에 이유가 나옵니다.</div></div>' +
      '<div class="srow"><div class="k">집에서도 쓰고 싶어요</div><div class="v" style="display:block">연구실 PC 에서 도는 서버라 밖에서는 바로 열리지 않습니다. Horarium·Athenaeum 과 같은 Tailscale 통로가 준비되면 같이 열 수 있습니다.</div></div></section>' +
      '<p class="src" style="margin-top:18px">자료 원칙: 시험 정보·교육과정·기출·출제 범위는 공식 출처(교육청 공고, 평가원, NCIC, 교육부)에 연결합니다. 공식 문서와 기출 원문은 복사하지 않고 발행 기관 주소로 연결하며, 기출은 영역과 주제만 요약합니다. 아직 발표되지 않은 날짜는 ‘예상’이나 ‘미발표’로 적습니다.</p>';
  };

  // ------------------------------------------------------------ 기록·설정
  RENDER.data = async function () {
    const el = $("#v-data");
    let S = {};
    try { S = await api("/api/settings"); } catch (e) { S = {}; }
    const docs = Store.docs, n = k => Object.values(docs).filter(x => x.type === k).length;
    const theme = (() => { try { return localStorage.getItem("p_theme") || "system"; } catch (e) { return "system"; } })();
    const sel = (id, opts, v) => '<select id="' + id + '">' + opts.map(o => '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
    const models = [["opus", "Opus (꼼꼼함)"], ["sonnet", "Sonnet (빠름·절약)"], ["haiku", "Haiku (가장 가벼움)"], ["fable", "Fable"]];
    const prof = S.profile || {};
    let h = '<div class="vhead"><span class="eyebrow">이 컴퓨터에만 저장됩니다</span><h1>기록·설정</h1></div>';
    h += '<section class="sec" style="margin-top:0"><div class="sh"><h2>기록</h2></div>' +
      '<div class="srow"><div class="k">저장된 것<small>Paedagogium\\data\\store.json · 하루 한 번 data\\backup 에 사본</small></div><div class="v">오답 ' + n("note") + "개 · 대화 " + n("thread") + "개 · 채점 " + n("grade") + "개 · 진도 체크 " + Object.keys(settings().done || {}).length + "개 · 내 일정 " + (settings().events || []).length + "개</div></div>" +
      '<div class="srow"><div class="k">백업 파일 만들기</div><div class="v"><a class="ghostbtn" href="/api/backup">기록 내려받기 (.json)</a></div></div>' +
      '<div class="srow"><div class="k">백업 불러오기<small>Paedagogium 백업, 또는 claude.ai 판에서 옮긴 기록(JSON)</small></div><div class="v"><input type="file" id="imp-file" accept=".json,application/json"> ' +
      sel("imp-mode", [["merge", "지금 기록과 합치기"], ["replace", "지금 기록을 바꾸기"]], "merge") + ' <button class="ghostbtn" id="imp-go">불러오기</button><span class="hint" id="imp-st"></span></div></div>' +
      '<div class="srow"><div class="k">붙여 넣어 옮기기<small>claude.ai 판에서 복사한 기록 글</small></div><div class="v" style="display:block"><textarea id="imp-text" placeholder="{ … } 꼴의 기록 글을 붙여 넣으세요" style="min-height:60px"></textarea><button class="ghostbtn" id="imp-text-go" style="margin-top:6px">붙여 넣은 기록 합치기</button></div></div></section>';
    h += '<section class="sec"><div class="sh"><h2>Claude</h2><span class="r">' + (ST.claude && ST.claude.available ? '<span class="dot ok"></span>Claude Code 찾음' : '<span class="dot bad"></span>Claude Code 없음') + "</span></div>" +
      (ST.claude && ST.claude.error ? '<div class="note-box"><b>마지막 문제</b> ' + esc(ST.claude.error) + "</div>" : "") +
      '<div class="srow"><div class="k">계정<small>Athenaeum 전용 계정을 고르면 터미널의 claude 와 다른 계정의 사용량으로 돕니다</small></div><div class="v">' +
      sel("cl-acc", [["default", "이 PC 의 기본 로그인"], ["athenaeum", "Athenaeum 전용 계정과 같이 쓰기"], ["custom", "다른 폴더 (CLAUDE_CONFIG_DIR)"]], S.claude_account || "default") +
      '<input type="text" id="cl-dir" placeholder="C:\\Users\\…\\.claude-…" value="' + esc(S.claude_config_dir || "") + '" style="min-width:260px' + (S.claude_account === "custom" ? "" : ";display:none") + '">' +
      '<span class="hint">' + (S.claude_account === "athenaeum" ? (S.athenaeum_logged_in ? "Athenaeum 전용 계정에 로그인되어 있습니다" : "Athenaeum 전용 계정 폴더에 아직 로그인이 없습니다 — Athenaeum ⚙ 설정 → Claude → 로그인 창 열기") : S.claude_account === "custom" ? (S.claude_logged_in ? "로그인됨" : "그 폴더에 로그인이 없습니다") : "") + "</span></div></div>" +
      '<div class="srow"><div class="k">모델</div><div class="v">질문하기 ' + sel("m-chat", models, S.model_chat) + " 채점·해설 " + sel("m-grade", models, S.model_grade) + " 공지 정리 " + sel("m-notice", models, S.model_notice) + "</div></div></section>";
    h += '<section class="sec"><div class="sh"><h2>공지 정리에 쓰는 내 정보</h2><span class="r">Claude 가 ‘나에게 해당하는지’ 판단할 때 씁니다</span></div><div class="srow"><div class="k">내 상황<small>사실과 다르면 고치세요. 모르는 것은 ‘확인 필요’로</small></div><div class="v"><div class="prof">' +
      Object.keys(prof).map(k => '<span class="hint" style="padding-top:6px">' + esc(k) + '</span><input type="text" data-prof="' + esc(k) + '" value="' + esc(prof[k]) + '">').join("") + '</div><button class="ghostbtn" id="prof-save">저장</button><span class="hint" id="prof-st"></span></div></div></section>';
    h += '<section class="sec"><div class="sh"><h2>화면·수집</h2></div><div class="srow"><div class="k">테마</div><div class="v">' + sel("ui-theme", [["system", "시스템 설정 따르기"], ["light", "밝게"], ["dark", "어둡게"]], theme) + "</div></div>" +
      '<div class="srow"><div class="k">공지·구인 자동 수집<small>켜 두면 공지 6시간, 구인 3시간마다</small></div><div class="v"><label><input type="checkbox" id="auto-fetch"' + (S.auto_fetch !== false ? " checked" : "") + "> 켜기</label></div></div>" +
      '<div class="srow"><div class="k">판</div><div class="v">Paedagogium ' + esc(S.version || ST.version || "") + ' · <a href="https://claude.ai/artifact/8qS9SBAPKHKTH19D9SgAiR" target="_blank" rel="noopener">claude.ai 판 ↗</a></div></div></section>';
    el.innerHTML = h;
    const saveS = async patch => { try { await api("/api/settings", patch); toast("저장했습니다"); RENDER.data(); refreshStatus(); } catch (e) { toast(e.message); } };
    $("#cl-acc", el).addEventListener("change", e => saveS({ claude_account: e.target.value }));
    $("#cl-dir", el).addEventListener("change", e => saveS({ claude_config_dir: e.target.value.trim() }));
    $("#m-chat", el).addEventListener("change", e => saveS({ model_chat: e.target.value }));
    $("#m-grade", el).addEventListener("change", e => saveS({ model_grade: e.target.value }));
    $("#m-notice", el).addEventListener("change", e => saveS({ model_notice: e.target.value }));
    $("#auto-fetch", el).addEventListener("change", e => saveS({ auto_fetch: e.target.checked }));
    $("#prof-save", el).addEventListener("click", () => { const p = {}; $$("[data-prof]", el).forEach(i => { p[i.dataset.prof] = i.value.trim(); }); saveS({ profile: p }); });
    $("#ui-theme", el).addEventListener("change", e => { const v = e.target.value; try { localStorage.setItem("p_theme", v); } catch (er) {} if (v === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v; });
    const doImport = async (text, mode, st) => {
      let obj; try { obj = JSON.parse(text); } catch (e) { st.textContent = "JSON 꼴이 아닙니다"; return; }
      try { const r = await api("/api/store", { op: "import", docs: obj, mode }); await Store.load(); drafts = null; st.textContent = r.added + "개를 들였습니다"; nav(); toast("기록을 불러왔습니다"); } catch (e) { st.textContent = e.message; }
    };
    $("#imp-go", el).addEventListener("click", () => { const f = $("#imp-file", el).files[0], st = $("#imp-st", el); if (!f) { st.textContent = "파일을 고르세요"; return; } const rd = new FileReader(); rd.onload = () => doImport(rd.result, $("#imp-mode", el).value, st); rd.readAsText(f, "utf-8"); });
    $("#imp-text-go", el).addEventListener("click", () => doImport($("#imp-text", el).value, "merge", $("#imp-st", el)));
  };

  // ------------------------------------------------------------ 열어 둔 창이 옛 화면인지 (Athenaeum ui.js 와 같음)
  (function () {
    let mine = null, told = false;
    function check() {
      fetch("/api/version").then(r => r.json()).then(v => {
        if (!v.ui) return; if (mine === null) { mine = v.ui; return; }
        if (v.ui !== mine && !told) {
          told = true; const d = document.createElement("div"); d.id = "uiStale";
          d.innerHTML = "<span>프로그램이 업데이트되었습니다 — 이 창은 옛 화면입니다.</span><button class='act ready'>새로 고침</button><button class='act'>나중에</button>";
          document.body.appendChild(d); d.children[1].onclick = () => location.reload(); d.children[2].onclick = () => d.remove();
        }
      }).catch(() => {});
    }
    check(); window.addEventListener("focus", check); setInterval(check, 180000);
  })();

  // ------------------------------------------------------------ 시작
  window.addEventListener("hashchange", show);
  window.addEventListener("focus", async () => { if (typing() || askCtl) return; await Store.load(); await refreshStatus(); if (["home", "notes", "guide", "standard"].indexOf(current()) >= 0) rerender(); });
  (async function start() {
    try { await Store.load(); } catch (e) { document.body.insertAdjacentHTML("afterbegin", '<div class="note-box" style="margin:0">서버에 닿지 못했습니다: ' + esc(e.message) + "</div>"); }
    await refreshStatus();
    show();
    Promise.all([loadNotices(), loadJobs()]).then(() => { if (current() === "home") RENDER.home(); });
    setInterval(async () => {
      const was = { n: ST.notices.running, j: ST.jobs.running };
      await refreshStatus();
      if (was.n && !ST.notices.running) { await loadNotices(); if (["notices", "home"].indexOf(current()) >= 0 && !typing()) RENDER[current()](); }
      if (was.j && !ST.jobs.running) { await loadJobs(); if (["jobs", "home"].indexOf(current()) >= 0 && !typing()) RENDER[current()](); }
    }, 30000);
  })();
})();
