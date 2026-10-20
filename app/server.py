# -*- coding: utf-8 -*-
"""Paedagogium — 정보·컴퓨터 임용 서재. 로컬 서버(http://localhost:8772) + 브라우저 화면.

Athenaeum(MAENG_paper) 과 같은 꼴: 표준 라이브러리 ThreadingHTTPServer, 데이터는 이 폴더의 data\\ 에만,
Claude 는 구독 사용량으로 `claude -p` (claude_cli.py). 외부 패키지 없음.

  GET  /                    화면 (web/index.html)
  GET  /api/version         판·화면 파일 수정 시각 (열어 둔 창이 옛 화면인지 알리기)
  GET  /api/status          Claude·공지·구인 상태, 오늘 복습 수
  GET  /api/store           내 기록 전부 (오답 노트·진도·설정·대화)
  POST /api/store           {op: put|del|import, …}
  GET  /api/backup          기록 파일 내려받기
  GET|POST /api/settings    프로그램 설정 (Claude 계정·모델·공지 분석의 내 정보)
  POST /api/claude          {task: ask|grade|explain, …} → {job}
  GET  /api/job?id=         {status, text, result, …}   POST /api/job/cancel {id}
  GET  /api/notices         중요 공지      POST /api/notices {op: refresh|read|readall|analyze, key}
  GET  /api/jobs            구인 공고      POST /api/jobs {op: refresh}
"""
import io
import os
import re
import sys
import json
import time
import shutil
import threading
import traceback
import mimetypes
import datetime
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import claude_cli  # noqa: E402
import notices     # noqa: E402
import jobs        # noqa: E402
import tutor       # noqa: E402

ROOT = os.path.dirname(HERE)
WEB = os.path.join(HERE, "web")
DATA = os.environ.get("PAEDAGOGIUM_DATA") or os.path.join(ROOT, "data")
os.makedirs(os.path.join(DATA, "backup"), exist_ok=True)
PORT = int(os.environ.get("PAEDAGOGIUM_PORT") or 8772)
try:
    APP_VERSION = io.open(os.path.join(HERE, "VERSION"), encoding="utf-8").read().strip()
except OSError:
    APP_VERSION = "?"

STORE_PATH = os.path.join(DATA, "store.json")
SETTINGS_PATH = os.path.join(DATA, "settings.json")
NOTICE_STORE = notices.Store(os.path.join(DATA, "notices.json"))
JOB_STORE = jobs.Store(os.path.join(DATA, "jobs.json"))
_LOCK = threading.RLock()
ATHENAEUM_DIR = os.path.join(os.path.expanduser("~"), ".claude-athenaeum")


# ------------------------------------------------------------------ 파일
def load_json(path, default):
    for _ in range(5):
        try:
            with io.open(path, encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return default
        except PermissionError:
            time.sleep(0.05)                      # 바꿔치기 순간
        except ValueError:
            return default
    return default


def save_json(path, obj):
    tmp = "%s.%d.%d.tmp" % (path, os.getpid(), threading.get_ident())   # 호출마다 다른 임시 이름 (Athenaeum 2026-09-30 사고)
    with io.open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    for _ in range(10):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05)
    os.replace(tmp, path)


# ------------------------------------------------------------------ 내 기록 (오답 노트·진도·대화)
def store_load():
    d = load_json(STORE_PATH, {})
    d.setdefault("docs", {})
    return d


def store_save(d):
    d["t"] = time.time()
    save_json(STORE_PATH, d)
    _daily_backup()


def _daily_backup():
    """하루에 한 번 기록 사본을 data\\backup 에 (14개까지)."""
    try:
        name = os.path.join(DATA, "backup", "store-%s.json" % time.strftime("%Y%m%d"))
        if not os.path.exists(name) and os.path.exists(STORE_PATH):
            shutil.copyfile(STORE_PATH, name)
            olds = sorted(f for f in os.listdir(os.path.join(DATA, "backup")) if f.startswith("store-"))
            for f in olds[:-14]:
                os.remove(os.path.join(DATA, "backup", f))
    except OSError:
        pass


def store_put(doc_id, doc):
    with _LOCK:
        d = store_load()
        doc = dict(doc or {})
        doc["id"] = doc_id
        d["docs"][doc_id] = doc
        store_save(d)
        return doc


def store_del(doc_id):
    with _LOCK:
        d = store_load()
        d["docs"].pop(doc_id, None)
        store_save(d)


def store_update(doc_id, fn):
    """파일을 다시 읽어 그 문서만 고친다 (Claude 를 기다리는 동안 화면이 다른 것을 저장해도 지키게)."""
    with _LOCK:
        d = store_load()
        cur = d["docs"].get(doc_id)
        new = fn(dict(cur) if cur else None)
        if new is None:
            return cur
        new["id"] = doc_id
        d["docs"][doc_id] = new
        store_save(d)
        return new


def store_import(docs, mode):
    """백업 파일이나 claude.ai 판의 기록(localStorage 'imyong-store' 꼴 {id: doc})을 들인다."""
    if isinstance(docs, dict) and "docs" in docs and isinstance(docs["docs"], dict):
        docs = docs["docs"]
    if not isinstance(docs, dict):
        raise ValueError("기록 꼴이 아닙니다")
    good = dict((k, v) for k, v in docs.items() if isinstance(v, dict) and v.get("type"))
    with _LOCK:
        d = store_load()
        if mode == "replace":
            d["docs"] = {}
        added = 0
        for k, v in good.items():
            if mode == "merge" and k in d["docs"]:
                old = d["docs"][k]
                if k == "settings":                              # 진도 표시는 합친다
                    done = dict(old.get("done") or {}); done.update(v.get("done") or {})
                    v = dict(old, **v); v["done"] = done
                elif (old.get("updatedAt") or old.get("createdAt") or "") > (v.get("updatedAt") or v.get("createdAt") or ""):
                    continue
            v = dict(v); v["id"] = k
            d["docs"][k] = v
            added += 1
        store_save(d)
    return added


# ------------------------------------------------------------------ 설정
DEFAULT_SETTINGS = {
    "claude_account": "default",        # default | athenaeum | custom
    "claude_config_dir": "",
    "model_chat": "opus", "effort_chat": "",
    "model_grade": "opus",
    "model_notice": "sonnet",
    "profile": notices.DEFAULT_PROFILE,
    "auto_fetch": True,
}


def settings():
    s = dict(DEFAULT_SETTINGS)
    s.update(load_json(SETTINGS_PATH, {}) or {})
    return s


def apply_claude_account(s=None):
    s = s or settings()
    acc = s.get("claude_account")
    path = ATHENAEUM_DIR if acc == "athenaeum" else (s.get("claude_config_dir") or "").strip() if acc == "custom" else ""
    claude_cli.CONFIG_DIR["path"] = path
    return path


def settings_view():
    s = settings()
    path = apply_claude_account(s)
    s["claude_dir_effective"] = path
    s["claude_logged_in"] = claude_cli.logged_in(path) if path else None
    s["athenaeum_dir"] = ATHENAEUM_DIR
    s["athenaeum_logged_in"] = claude_cli.logged_in(ATHENAEUM_DIR)
    return s


def settings_save(patch):
    s = load_json(SETTINGS_PATH, {}) or {}
    for k in ("claude_account", "claude_config_dir", "model_chat", "effort_chat", "model_grade", "model_notice", "auto_fetch"):
        if k in patch:
            s[k] = patch[k]
    if isinstance(patch.get("profile"), dict):
        s["profile"] = dict((str(k)[:20], str(v)[:300]) for k, v in patch["profile"].items() if str(k).strip())
    save_json(SETTINGS_PATH, s)
    return settings_view()


MODELS = {"opus": "opus", "sonnet": "sonnet", "haiku": "haiku", "fable": "fable"}


def model_of(key):
    return MODELS.get(settings().get(key) or "", "opus")


# ------------------------------------------------------------------ 배경 작업 (Claude 호출)
JOBS = {}
_JLOCK = threading.Lock()


def job_new(kind, meta=None):
    jid = "%s-%d" % (kind, int(time.time() * 1000))
    with _JLOCK:
        JOBS[jid] = {"id": jid, "kind": kind, "status": "running", "text": "", "t0": time.time(), "meta": meta or {}}
        for k in [k for k, v in JOBS.items() if time.time() - v["t0"] > 3 * 3600]:
            JOBS.pop(k, None)
    return jid


def job_set(jid, **kw):
    with _JLOCK:
        if jid in JOBS:
            JOBS[jid].update(kw)


def job_get(jid):
    with _JLOCK:
        j = JOBS.get(jid)
        if not j:
            return None
        out = dict(j)
    out["elapsed"] = round((out.get("t1") or time.time()) - out["t0"], 1)
    return out


def _run_thread(fn, *a):
    t = threading.Thread(target=fn, args=a, daemon=True)
    t.start()


def start_ask(body):
    q = (body.get("question") or "").strip()
    if not q:
        raise ValueError("물음이 비었습니다")
    mode = body.get("mode") if body.get("mode") in tutor.MODES else "ask"
    tid = body.get("thread") or "thread-%d" % int(time.time() * 1000)
    now = datetime.datetime.now().isoformat(timespec="seconds")

    def add_q(cur):
        cur = cur or {"type": "thread", "title": tutor.title_of(q), "turns": [], "createdAt": now, "mode": mode}
        cur["turns"] = list(cur.get("turns") or []) + [{"role": "user", "content": q, "t": now, "mode": mode}]
        cur["updatedAt"] = now
        cur["pending"] = True
        return cur
    doc = store_update(tid, add_q)
    turns = doc["turns"][:-1]
    jid = job_new("ask", {"thread": tid})
    model = model_of("model_chat")
    effort = settings().get("effort_chat") or None
    prompt = tutor.ask_prompt(turns, q, mode)

    def work():
        r = claude_cli.run(prompt, system=tutor.TUTOR, model=model, effort=effort, timeout=900, job=jid,
                           on_text=lambda t: job_set(jid, text=t))
        text = (r.get("text") or "").strip()
        stamp = datetime.datetime.now().isoformat(timespec="seconds")

        def add_a(cur):
            cur = cur or {"type": "thread", "turns": []}
            cur["pending"] = False
            if text:
                cur["turns"] = list(cur.get("turns") or []) + [{"role": "assistant", "content": text, "t": stamp, "model": r.get("model"),
                                                                "tok": r.get("tok"), "sec": r.get("sec"), "stopped": bool(r.get("cancelled"))}]
            cur["updatedAt"] = stamp
            return cur
        store_update(tid, add_a)
        if r.get("cancelled"):
            job_set(jid, status="cancelled", text=text, t1=time.time())
        elif r.get("error"):
            job_set(jid, status="error", error=r["error"], t1=time.time())
        else:
            job_set(jid, status="done", text=text, model=r.get("model"), tok=r.get("tok"), t1=time.time())
    _run_thread(work)
    return {"job": jid, "thread": tid}


def start_grade(body):
    ans = (body.get("answer") or "").strip()
    if not ans:
        raise ValueError("답안을 먼저 적어 주세요")
    pid = body.get("pid") or ""
    prompt = tutor.grade_prompt(body.get("theme"), body.get("q"), body.get("a"), ans)
    jid = job_new("grade", {"pid": pid})

    def work():
        r = claude_cli.run(prompt, system=tutor.TUTOR, model=model_of("model_grade"), timeout=600, job=jid)
        d = claude_cli.parse_json(r.get("text") or "")
        if r.get("cancelled"):
            return job_set(jid, status="cancelled", t1=time.time())
        if not isinstance(d, dict):
            return job_set(jid, status="error", error=r.get("error") or "채점 결과를 읽지 못했습니다. 다시 시도해 주세요.", t1=time.time())
        try:
            sc = float(d.get("score"))
            d["score"] = max(0.0, min(4.0, round(sc * 2) / 2))
        except (TypeError, ValueError):
            d["score"] = None
        res = {"result": d, "answer": ans, "t": datetime.datetime.now().isoformat(timespec="seconds"), "model": r.get("model")}
        if pid:
            store_update("grade:" + pid, lambda cur: dict(cur or {}, type="grade", pid=pid,
                                                           history=((cur or {}).get("history") or [])[-9:] + [res], last=res))
        job_set(jid, status="done", result=res, t1=time.time())
    _run_thread(work)
    return {"job": jid}


def start_explain(body):
    nid = body.get("note") or ""
    note = store_load()["docs"].get(nid)
    if not note:
        raise ValueError("오답 노트를 찾지 못했습니다")
    jid = job_new("explain", {"note": nid})

    def work():
        r = claude_cli.run(tutor.explain_prompt(note), system=tutor.TUTOR, model=model_of("model_grade"), timeout=600, job=jid)
        d = claude_cli.parse_json(r.get("text") or "")
        if r.get("cancelled"):
            return job_set(jid, status="cancelled", t1=time.time())
        if not isinstance(d, dict):
            return job_set(jid, status="error", error=r.get("error") or "해설을 읽지 못했습니다. 다시 시도해 주세요.", t1=time.time())
        d["t"] = datetime.datetime.now().isoformat(timespec="seconds")
        d["model"] = r.get("model")
        job_set(jid, status="done", result=d, t1=time.time())
    _run_thread(work)
    return {"job": jid}


def start_notice_analysis(key):
    d = NOTICE_STORE.load()
    item = d["items"].get(key)
    if not item:
        raise ValueError("공지를 찾지 못했습니다")
    jid = job_new("notice", {"key": key})

    def work():
        try:
            job_set(jid, stage="본문과 첨부 공고문 받는 중")
            det = item.get("detail")
            if not det or not det.get("body") or det.get("v") != 2 or time.time() - (det.get("t") or 0) > 86400:
                det = notices.fetch_detail(item)
                with NOTICE_STORE.lock:
                    dd = NOTICE_STORE.load()
                    if key in dd["items"]:
                        dd["items"][key]["detail"] = det
                        NOTICE_STORE.save(dd)
            job_set(jid, stage="Claude 가 읽는 중")
            prompt = notices.build_prompt(item, det, settings().get("profile"))
            r = claude_cli.run(prompt, model=model_of("model_notice"), timeout=600, job=jid)
            if r.get("cancelled"):
                return job_set(jid, status="cancelled", t1=time.time())
            a = notices.normalize(claude_cli.parse_json(r.get("text") or ""))
            if not a:
                return job_set(jid, status="error", error=r.get("error") or "정리 결과를 읽지 못했습니다. 다시 시도해 주세요.", t1=time.time())
            a["model"] = r.get("model")
            a["att"] = det.get("att_names") or []
            with NOTICE_STORE.lock:
                dd = NOTICE_STORE.load()
                if key in dd["items"]:
                    dd["items"][key]["analysis"] = a
                    dd["items"][key]["analysis_t"] = time.time()
                    dd["items"][key]["read"] = True
                    NOTICE_STORE.save(dd)
            job_set(jid, status="done", result=a, t1=time.time())
        except Exception as e:
            job_set(jid, status="error", error="공지를 읽지 못했습니다: %s" % e, t1=time.time())
    _run_thread(work)
    return {"job": jid}


# ------------------------------------------------------------------ 공지·구인 수집 (배경)
SYNC = {"notices": {"running": False, "last": None, "result": None}, "jobs": {"running": False, "last": None, "result": None}}


def run_sync(which):
    st = SYNC[which]
    if st["running"]:
        return False
    st["running"] = True

    def work():
        try:
            st["result"] = notices.sync(NOTICE_STORE) if which == "notices" else jobs.sync(JOB_STORE)
        except Exception as e:
            st["result"] = {"errors": [repr(e)]}
            traceback.print_exc()
        finally:
            st["last"] = time.time()
            st["running"] = False
    _run_thread(work)
    return True


def scheduler():
    """켤 때 한 번(오래됐으면) + 공지 6시간·구인 3시간마다."""
    time.sleep(4)
    while True:
        try:
            if settings().get("auto_fetch", True):
                nd, jd = NOTICE_STORE.load(), JOB_STORE.load()
                if time.time() - (nd.get("fetched") or 0) > notices.INTERVAL_H * 3600:
                    run_sync("notices")
                if time.time() - (jd.get("fetched") or 0) > jobs.INTERVAL_H * 3600:
                    run_sync("jobs")
        except Exception:
            traceback.print_exc()
        time.sleep(300)


# ------------------------------------------------------------------ 상태
def ui_stamp():
    t = 0
    for base, _dirs, files in os.walk(WEB):
        for f in files:
            if f.endswith((".html", ".js", ".css")):
                try:
                    t = max(t, os.path.getmtime(os.path.join(base, f)))
                except OSError:
                    pass
    return int(t)


def status():
    nd, jd = NOTICE_STORE.load(), JOB_STORE.load()
    unread_top = sum(1 for v in nd["items"].values() if v.get("tier") == "top" and not v.get("read"))
    today = time.strftime("%Y-%m-%d")
    soon = 0
    for v in jd["items"].values():
        end = (v.get("apply") or {}).get("end") or ""
        if v.get("tier") == "core" and end and today <= end <= (datetime.date.today() + datetime.timedelta(days=3)).strftime("%Y-%m-%d"):
            soon += 1
    return {"version": APP_VERSION, "claude": {"available": claude_cli.available(), "error": claude_cli.last_error()},
            "notices": {"fetched": nd.get("fetched"), "running": SYNC["notices"]["running"], "unread_top": unread_top,
                        "errors": nd.get("errors") or []},
            "jobs": {"fetched": jd.get("fetched"), "running": SYNC["jobs"]["running"], "soon": soon, "errors": jd.get("errors") or []}}


# ------------------------------------------------------------------ HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "Paedagogium/" + APP_VERSION
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _err(self, code, msg):
        self._send(code, {"error": msg})

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode("utf-8")) if raw else {}
        except ValueError:
            return {}

    def _static(self, rel):
        rel = urllib.parse.unquote(rel).lstrip("/") or "index.html"
        path = os.path.normpath(os.path.join(WEB, rel))
        if not path.startswith(WEB) or not os.path.isfile(path):
            return self._err(404, "없음")
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json", "image/svg+xml"):
            ctype += "; charset=utf-8"
        if path.endswith(".woff2"):
            ctype = "font/woff2"
        with open(path, "rb") as f:
            data = f.read()
        cache = {"Cache-Control": "max-age=86400"} if path.endswith((".woff2", ".png", ".ico")) else None
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", (cache or {}).get("Cache-Control", "no-cache"))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        q = dict(urllib.parse.parse_qsl(url.query))
        p = url.path
        try:
            if p == "/api/version":
                return self._send(200, {"version": APP_VERSION, "ui": ui_stamp()})
            if p == "/api/status":
                return self._send(200, status())
            if p == "/api/store":
                return self._send(200, store_load())
            if p == "/api/backup":
                d = json.dumps(store_load(), ensure_ascii=False, indent=1)
                name = "Paedagogium-기록-%s.json" % time.strftime("%Y%m%d")
                return self._send(200, d, "application/json; charset=utf-8",
                                  {"Content-Disposition": "attachment; filename*=UTF-8''" + urllib.parse.quote(name)})
            if p == "/api/settings":
                return self._send(200, settings_view())
            if p == "/api/job":
                j = job_get(q.get("id", ""))
                return self._send(200, j) if j else self._err(404, "작업을 찾지 못했습니다 (서버가 다시 켜졌을 수 있음)")
            if p == "/api/notices":
                d = notices.public_list(NOTICE_STORE)
                d["running"] = SYNC["notices"]["running"]
                return self._send(200, d)
            if p == "/api/jobs":
                d = jobs.public(JOB_STORE)
                d["running"] = SYNC["jobs"]["running"]
                return self._send(200, d)
            if p == "/favicon.ico":
                return self._static("logo/favicon.ico")
            if p.startswith("/api/"):
                return self._err(404, "없는 주소")
            return self._static(p)
        except Exception as e:
            traceback.print_exc()
            return self._err(500, repr(e))

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        p = url.path
        b = self._body()
        try:
            if p == "/api/store":
                op = b.get("op")
                if op == "put":
                    if not b.get("id") or not isinstance(b.get("doc"), dict):
                        return self._err(400, "id·doc 이 필요합니다")
                    return self._send(200, {"ok": True, "doc": store_put(str(b["id"])[:120], b["doc"])})
                if op == "del":
                    store_del(str(b.get("id")))
                    return self._send(200, {"ok": True})
                if op == "import":
                    n = store_import(b.get("docs"), b.get("mode") or "merge")
                    return self._send(200, {"ok": True, "added": n})
                return self._err(400, "op?")
            if p == "/api/settings":
                return self._send(200, settings_save(b))
            if p == "/api/claude":
                task = b.get("task")
                if task == "ask":
                    return self._send(200, start_ask(b))
                if task == "grade":
                    return self._send(200, start_grade(b))
                if task == "explain":
                    return self._send(200, start_explain(b))
                return self._err(400, "task?")
            if p == "/api/job/cancel":
                ok = claude_cli.cancel(b.get("id"))
                return self._send(200, {"ok": ok})
            if p == "/api/notices":
                op = b.get("op")
                if op == "refresh":
                    return self._send(200, {"started": run_sync("notices")})
                if op in ("read", "unread", "readall"):
                    with NOTICE_STORE.lock:
                        d = NOTICE_STORE.load()
                        keys = list(d["items"]) if op == "readall" else [b.get("key")]
                        for k in keys:
                            if k in d["items"]:
                                d["items"][k]["read"] = op != "unread"
                        NOTICE_STORE.save(d)
                    return self._send(200, {"ok": True})
                if op == "analyze":
                    return self._send(200, start_notice_analysis(b.get("key")))
                return self._err(400, "op?")
            if p == "/api/jobs":
                if b.get("op") == "refresh":
                    return self._send(200, {"started": run_sync("jobs")})
                return self._err(400, "op?")
            return self._err(404, "없는 주소")
        except ValueError as e:
            return self._err(400, str(e))
        except Exception as e:
            traceback.print_exc()
            return self._err(500, repr(e))


def main():
    apply_claude_account()
    threading.Thread(target=scheduler, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.daemon_threads = True
    print("Paedagogium %s — http://localhost:%d" % (APP_VERSION, PORT))
    srv.serve_forever()


if __name__ == "__main__":
    main()
