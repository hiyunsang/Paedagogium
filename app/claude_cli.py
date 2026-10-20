# -*- coding: utf-8 -*-
"""Claude 부르기 — Athenaeum(paper-search/server.py)과 같은 방식: 구독 사용량으로 도는 `claude -p`.

- API 키가 없다. 이 PC 의 Claude Code 로그인(또는 설정의 전용 계정 폴더 = CLAUDE_CONFIG_DIR)을 쓴다.
- 창이 뜨지 않게(_no_window) — 안 그러면 검은 cmd 창이 떠서 사용자의 타이핑을 끊는다.
- 프로그램 밖의 빈 폴더(%TEMP%\\paedagogium_claude)에서 부른다 — 저장소 안에서 부르면 개발용 CLAUDE.md 를 호출마다 같이 읽는다.
- 같은 긴 배경(튜터 원칙 등)은 system 으로 준다: 글자 하나까지 같으면 캐시에서 읽혀 값이 1/10 이다.
- on_text 를 주면 stream-json 으로 받아 답이 쓰이는 대로 넘긴다(질문하기의 실시간 답).
- job 이름을 주면 cancel(job) 으로 끊을 수 있다(「멈추기」).
"""
import io
import os
import re
import json
import time
import shutil
import tempfile
import threading
import subprocess

STATE = {"err": "", "t": 0}          # 마지막 실패 이유(로그인 만료·한도). 성공하면 지운다
_PROCS, _CANCELLED = {}, {}
_LOCK = threading.Lock()
CONFIG_DIR = {"path": ""}            # 서버가 설정에서 채운다 (전용 계정 폴더)

MISSING_MSG = ("Claude Code 가 설치되어 있지 않거나 claude 명령을 찾을 수 없습니다. "
               "https://claude.com/claude-code 에서 설치한 뒤 터미널에서 claude → /login 으로 로그인하세요.")


def _registry_path():
    if os.name != "nt":
        return ""
    try:
        import winreg
        parts = []
        for root, sub in ((winreg.HKEY_CURRENT_USER, "Environment"),
                          (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")):
            try:
                with winreg.OpenKey(root, sub) as k:
                    parts.append(os.path.expandvars(winreg.QueryValueEx(k, "Path")[0]))
            except OSError:
                pass
        return os.pathsep.join(parts)
    except Exception:
        return ""


def find_claude():
    """claude 실행 파일. 지금 PATH → Claude Code 가 설치하는 알려진 폴더 → 레지스트리 PATH (매번 다시 찾는다)."""
    names = ("claude", "claude.cmd", "claude.exe")
    for c in names:
        p = shutil.which(c)
        if p:
            return p
    if os.name == "nt":
        home = os.path.expanduser("~")
        known = [os.path.join(home, ".local", "bin"), os.path.join(os.environ.get("APPDATA", ""), "npm"),
                 os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "claude")]
        extra = os.pathsep.join(d for d in known if d and os.path.isdir(d))
        for path in (extra, _registry_path()):
            if not path:
                continue
            for c in names:
                p = shutil.which(c, path=path)
                if p:
                    return p
    return None


def available():
    return find_claude() is not None


def _no_window():
    kw = {}
    if os.name == "nt":
        kw["creationflags"] = 0x08000000      # CREATE_NO_WINDOW
        try:
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0
            kw["startupinfo"] = si
        except Exception:
            pass
    return kw


def work_dir():
    d = os.path.join(tempfile.gettempdir(), "paedagogium_claude")
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        return None
    return d


def _env():
    d = (CONFIG_DIR.get("path") or "").strip()
    if not d:
        return None
    env = dict(os.environ)
    env["CLAUDE_CONFIG_DIR"] = d
    return env


def logged_in(d):
    return bool(d) and os.path.isfile(os.path.join(d, ".credentials.json"))


def _kill_tree(p):
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True, **_no_window())
        else:
            p.kill()
    except Exception:
        pass


def cancel(job):
    """돌고 있는 호출을 이름으로 끊는다. 아직 뜨기 전이면 뜰 때 바로 끝난다."""
    if not job:
        return False
    with _LOCK:
        _CANCELLED[job] = time.time()
        for k in [k for k, t in _CANCELLED.items() if time.time() - t > 3600]:
            _CANCELLED.pop(k, None)
        p = _PROCS.get(job)
    if p:
        _kill_tree(p)
        return True
    return False


def _was_cancelled(job):
    with _LOCK:
        return _CANCELLED.pop(job, None) is not None if job else False


def _note(ok, out, err=""):
    """실패 이유를 기억한다 — 조용히 None 만 돌려주지 않게."""
    if ok:
        STATE.update(err="", t=time.time())
        return
    s = (out or "") + " " + (err or "")
    low = s.lower()
    if "oauth" in low and "expired" in low or "/login" in low or "not logged in" in low or "invalid api key" in low:
        msg = "Claude 로그인이 만료되었거나 로그인되어 있지 않습니다. 터미널에서 claude → /login 으로 다시 로그인하세요."
    elif "limit" in low and ("usage" in low or "reached" in low or "rate" in low):
        msg = "Claude 사용 한도에 걸렸습니다. 한도가 풀린 뒤 다시 시도하세요."
    elif "timed out" in low or "timeout" in low:
        msg = "Claude 응답이 너무 오래 걸려 끊었습니다."
    else:
        msg = "Claude 를 부르지 못했습니다: " + re.sub(r"\s+", " ", s).strip()[:200]
    STATE.update(err=msg, t=time.time())


def last_error():
    return STATE.get("err") or ""


def _usage(d):
    usage = d.get("modelUsage") or {}
    main = max(usage, key=lambda k: (usage[k] or {}).get("outputTokens", 0)) if usage else ""
    num = lambda u, k: int((u or {}).get(k) or 0)
    cached = sum(num(u, "cacheReadInputTokens") for u in usage.values())
    tin = cached + sum(num(u, "inputTokens") + num(u, "cacheCreationInputTokens") for u in usage.values())
    tout = sum(num(u, "outputTokens") for u in usage.values())
    return main, ({"in": tin, "cached": cached, "out": tout} if tin else None)


def run(prompt, system=None, model="opus", effort=None, timeout=600, job=None, on_text=None):
    """claude -p 한 번. 돌려주는 것: {text, model, tok, sec} · 실패 {error} · 끊김 {cancelled: True, text}.
    on_text(지금까지의 글) 을 주면 stream-json 으로 받아 쓰이는 대로 부른다."""
    exe = find_claude()
    if not exe:
        STATE.update(err=MISSING_MSG, t=time.time())
        return {"error": MISSING_MSG}
    t0 = time.time()
    stream = on_text is not None
    args = [exe, "-p", "--model", model, "--tools", "", "--no-session-persistence"]
    args += ["--output-format", "stream-json", "--verbose", "--include-partial-messages"] if stream else ["--output-format", "json"]
    if effort:
        args += ["--effort", effort]
    kw = dict(_no_window(), cwd=work_dir())
    env = _env()
    if env:
        kw["env"] = env
    sysf = None
    try:
        if system:
            d = os.path.join(tempfile.gettempdir(), "paedagogium_claude_sys")
            os.makedirs(d, exist_ok=True)
            sysf = os.path.join(d, "%d_%d.txt" % (os.getpid(), int(time.time() * 1e6)))
            with io.open(sysf, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(system)
            args += ["--system-prompt-file", sysf]
        if job:
            with _LOCK:
                if job in _CANCELLED:
                    _CANCELLED.pop(job, None)
                    return {"cancelled": True, "text": ""}
        p = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)
        if job:
            with _LOCK:
                _PROCS[job] = p
        try:
            if stream:
                text, final, err = _read_stream(p, prompt, timeout, on_text)
            else:
                out, errb = p.communicate(prompt.encode("utf-8"), timeout=timeout)
                out, err = out.decode("utf-8", "replace"), errb.decode("utf-8", "replace")
                try:
                    final = json.loads(out[out.index("{"):out.rindex("}") + 1])
                except ValueError:
                    final = {}
                text = str(final.get("result") or "").strip()
                if not final:
                    err = out + err
        except subprocess.TimeoutExpired:
            _kill_tree(p)
            try:
                p.communicate(timeout=5)
            except Exception:
                pass
            _note(False, "", "timed out")
            return {"error": STATE["err"]}
        finally:
            if job:
                with _LOCK:
                    if _PROCS.get(job) is p:
                        _PROCS.pop(job, None)
        if _was_cancelled(job):
            return {"cancelled": True, "text": text if stream else ""}
        if not text or final.get("is_error"):
            _note(False, text or json.dumps(final, ensure_ascii=False)[:400], err)
            return {"error": STATE["err"]}
        _note(True, text)
        main, tok = _usage(final)
        return {"text": text, "model": main, "tok": tok, "sec": round(time.time() - t0, 1)}
    except Exception as e:
        _note(False, "", repr(e))
        return {"error": STATE["err"]}
    finally:
        if sysf:
            try:
                os.remove(sysf)
            except OSError:
                pass


def _read_stream(p, prompt, timeout, on_text):
    """stream-json 줄을 읽으며 text_delta 를 모은다. 마지막 result 줄이 끝 상태."""
    errbuf = []

    def pump_err():
        try:
            errbuf.append(p.stderr.read().decode("utf-8", "replace"))
        except Exception:
            pass
    te = threading.Thread(target=pump_err, daemon=True)
    te.start()
    try:
        p.stdin.write(prompt.encode("utf-8"))
        p.stdin.close()
    except Exception:
        pass
    deadline = time.time() + timeout
    killer = threading.Timer(timeout, lambda: _kill_tree(p))
    killer.daemon = True
    killer.start()
    parts, final, last_push = [], {}, 0.0
    try:
        for raw in iter(p.stdout.readline, b""):
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("{"):
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            t = d.get("type")
            if t == "stream_event":
                ev = d.get("event") or {}
                delta = ev.get("delta") or {}
                if ev.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                    parts.append(delta.get("text") or "")
                    now = time.time()
                    if now - last_push > 0.25:
                        last_push = now
                        try:
                            on_text("".join(parts))
                        except Exception:
                            pass
            elif t == "result":
                final = d
        p.wait(timeout=max(1, deadline - time.time()))
    finally:
        killer.cancel()
    te.join(timeout=2)
    if time.time() > deadline:
        raise subprocess.TimeoutExpired(p.args, timeout)
    text = str(final.get("result") or "".join(parts)).strip()
    try:
        on_text(text)
    except Exception:
        pass
    return text, final, "".join(errbuf)


def run_json(prompt, system=None, model="opus", effort=None, timeout=600, job=None):
    """JSON 객체 하나를 기대하는 호출 → (dict|None, 결과)."""
    r = run(prompt, system=system, model=model, effort=effort, timeout=timeout, job=job)
    return parse_json(r.get("text") or ""), r


def parse_json(text):
    if not text:
        return None
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        return json.loads(s)
    except ValueError:
        pass
    i, j = s.find("{"), s.rfind("}")
    if i >= 0 and j > i:
        try:
            return json.loads(s[i:j + 1])
        except ValueError:
            return None
    return None
