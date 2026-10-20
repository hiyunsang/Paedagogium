# -*- coding: utf-8 -*-
"""코드를 고친 뒤 서버 다시 켜기: python tools\\restart_server.py [--force]
Claude 작업(질문 답·채점·공지 정리)이나 공지·구인 수집이 도는 중이면 멈추지 않고 알려 준다. 끊어도 되면 --force."""
import os
import sys
import json
import time
import subprocess
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
sys.path.insert(0, APP)
import launch_check  # noqa: E402

PORT = launch_check.PORT


def busy():
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/api/status" % PORT, timeout=4) as r:
            s = json.load(r)
        out = []
        if s["notices"]["running"]:
            out.append("공지 수집")
        if s["jobs"]["running"]:
            out.append("구인 수집")
        return out
    except Exception:
        return []


def main():
    force = "--force" in sys.argv
    b = busy()
    if b and not force:
        print("지금 도는 작업이 있어 다시 켜지 않습니다:", ", ".join(b), "— 끊어도 되면 --force")
        return 1
    n = launch_check.stop_port(PORT)
    print("옛 서버 종료:", n)
    pyw = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    exe = pyw if os.path.exists(pyw) else sys.executable
    log = open(os.path.join(ROOT, "data", "server.log"), "ab")
    subprocess.Popen([exe, os.path.join(APP, "server.py")], cwd=APP, stdout=log, stderr=log,
                     creationflags=0x8 | 0x200 | 0x08000000)
    for _ in range(30):
        if launch_check.port_open(PORT):
            print("다시 켰습니다: http://localhost:%d (판 %s)" % (PORT, launch_check.running_version(PORT)))
            return 0
        time.sleep(0.5)
    print("서버가 뜨지 않았습니다 — data\\server.log 를 보세요")
    return 1


if __name__ == "__main__":
    sys.exit(main())
