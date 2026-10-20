# -*- coding: utf-8 -*-
"""실행 전 점검 (Athenaeum 의 launch_check.py 와 같은 일) — 같은 포트에 다른 판의 Paedagogium 서버가 남아 있으면 끈다.
명령줄에 Paedagogium 의 server.py 가 있는 프로세스만 끈다. 같은 판이면 그대로 둔다(bat 이 창만 연다)."""
import io
import os
import json
import socket
import subprocess
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PAEDAGOGIUM_PORT") or 8772)
NO_WINDOW = 0x08000000


def local_version():
    try:
        return io.open(os.path.join(BASE, "VERSION"), encoding="utf-8").read().strip()
    except OSError:
        return "?"


def port_open(port):
    s = socket.socket()
    s.settimeout(1)
    try:
        return s.connect_ex(("127.0.0.1", port)) == 0
    finally:
        s.close()


def running_version(port):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/api/version" % port, timeout=4) as r:
            return str(json.load(r).get("version") or "?")
    except Exception:
        return "?"


def _ps(cmd):
    r = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, timeout=60, creationflags=NO_WINDOW)
    return r.stdout.decode("utf-8", "replace")


def stop_port(port):
    out = _ps("Get-NetTCPConnection -LocalPort %d -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess }" % port)
    n = 0
    for pid in sorted({int(x) for x in out.split() if x.strip().isdigit()}):
        cl = _ps("(Get-CimInstance Win32_Process -Filter 'ProcessId=%d').CommandLine" % pid).lower()
        if "server.py" in cl and "paedagogium" in cl:
            subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, creationflags=NO_WINDOW)
            n += 1
    return n


if __name__ == "__main__":
    if port_open(PORT) and running_version(PORT) != local_version():
        stop_port(PORT)
