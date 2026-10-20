# -*- coding: utf-8 -*-
"""Paedagogium 로고 — Athenaeum(앤티크 골드 스와시 A)·Horarium(골드 H) 과 한 식구로: 골드 P.

굵은 줄기 + 헤어라인 위·아래 보울 + 두꺼운 오른 곡선(디도 꼴 대비) + 줄기 아래에서 뻗는 펜 획(스와시).
python tools/make_logo.py  →  app/web/logo/ 에
  mark.svg        투명 배경 마크 (머리줄)
  favicon.svg     브라우저 탭
  icon-*.png, favicon.ico, paedagogium.ico   (Edge headless 로 그린 뒤 PIL 로 ico; 둘 중 하나가 없으면 svg 만)
모든 조각을 같은 회전 방향으로 그린다(겹친 곳이 nonzero 규칙으로 구멍 나지 않게).
"""
import io
import os
import subprocess
import tempfile
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "app", "web", "logo")
GOLD = "#C9A227"


def mark_d():
    """헤어라인 줄기 + 두꺼운 보울 오른 곡선 + 줄기를 가로질러 오른쪽 위로 뻗는 스와시 (Athenaeum 의 A 와 같은 문법)."""
    parts = []
    parts.append("M140,64 L152,64 L152,336 L140,336 Z")                                 # 헤어라인 줄기
    parts.append("M114,58 L152,58 L152,70 L140,70 Q128,66 114,70 Z")                    # 위 평 세리프
    parts.append("M110,330 Q126,326 140,324 L152,324 Q168,326 184,330 L184,342 L110,342 Z")   # 아래 평 세리프
    parts.append("M152,58 L228,58 C290,58 322,98 322,142 C322,188 288,226 228,226 L152,226 L152,214 L214,214 "
                 "C252,214 266,184 266,142 C266,100 252,70 214,70 L152,70 Z")            # 보울 (위·아래 헤어라인, 오른쪽 두껍게)
    parts.append("M112,272 C204,266 306,240 390,182 C312,254 214,290 112,288 Z")          # 스와시
    return " ".join(parts)


def mark_svg(color=GOLD, pad=0):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d"><path fill="%s" fill-rule="nonzero" d="%s"/></svg>'
            % (60 - pad, 30 - pad, 340 + 2 * pad, 340 + 2 * pad, color, mark_d()))


def edge():
    for p in (r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"):
        if os.path.exists(p):
            return p
    return shutil.which("msedge")


def raster(svg, size, out_png):
    exe = edge()
    if not exe:
        return False
    d = tempfile.mkdtemp(prefix="plogo")
    html = os.path.join(d, "m.html")
    io.open(html, "w", encoding="utf-8").write(
        '<html><body style="margin:0;background:transparent">%s</body></html>'
        % svg.replace("<svg ", '<svg width="%d" height="%d" ' % (size, size), 1))
    try:
        subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                        "--window-size=%d,%d" % (size, size), "--user-data-dir=" + os.path.join(d, "u"),
                        "--screenshot=" + out_png, "file:///" + html.replace("\\", "/")], capture_output=True, timeout=60)
        import time
        for _ in range(40):
            if os.path.exists(out_png) and os.path.getsize(out_png) > 0:
                break
            time.sleep(0.25)
        return os.path.exists(out_png)
    finally:
        pass


def main():
    os.makedirs(OUT, exist_ok=True)
    io.open(os.path.join(OUT, "mark.svg"), "w", encoding="utf-8").write(mark_svg())
    io.open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8").write(mark_svg(pad=0))
    pngs = []
    for s in (16, 32, 48, 64, 128, 256):
        p = os.path.join(OUT, "icon-%d.png" % s)
        if raster(mark_svg(pad=10 if s <= 32 else 0), s, p):
            pngs.append(p)
    try:
        from PIL import Image
        imgs = [Image.open(p).convert("RGBA") for p in pngs]
        if imgs:
            big = max(imgs, key=lambda im: im.size[0])
            big.save(os.path.join(OUT, "favicon.ico"), sizes=[im.size for im in imgs])
            big.save(os.path.join(OUT, "paedagogium.ico"), sizes=[im.size for im in imgs])
    except Exception as e:
        print("ico 를 만들지 못했습니다:", e)
    print("logo ->", OUT, len(pngs), "png")


if __name__ == "__main__":
    main()
