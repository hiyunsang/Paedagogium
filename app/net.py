# -*- coding: utf-8 -*-
"""웹에서 받기 — 표준 라이브러리만. 공지·구인 수집이 같이 쓴다.

교육청 사이트는 가끔 DNS 조회가 한 번 실패한다(2026-10-20 goe.go.kr: getaddrinfo failed 뒤 바로 성공) → 두 번 더 시도한다.
인증서 사슬이 불완전한 공공 사이트가 있어 검증에 실패하면 그 사이트만 검증 없이 다시 받는다(읽기만 하므로).
"""
import re
import ssl
import time
import html as _html
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Safari/537.36 Paedagogium/1.0")
TIMEOUT = 20
SLEEP = 0.4                      # 같은 사이트에 연달아 보낼 때 사이 간격 (서버 예의)


def _open(req, timeout):
    try:
        return urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context())
    except urllib.error.URLError as e:
        if isinstance(getattr(e, "reason", None), ssl.SSLError):
            return urllib.request.urlopen(req, timeout=timeout, context=ssl._create_unverified_context())
        raise


def fetch(url, data=None, timeout=TIMEOUT, tries=3, referer=None, binary=False):
    """GET(또는 data 가 있으면 POST form) → 글(또는 bytes). 실패하면 마지막 예외를 올린다."""
    if isinstance(data, dict):
        data = urllib.parse.urlencode(data)
    if isinstance(data, str):
        data = data.encode("utf-8")
    headers = {"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9",
               "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"}
    if referer:
        headers["Referer"] = referer
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    last = None
    for i in range(tries):
        try:
            r = _open(urllib.request.Request(url, data=data, headers=headers), timeout)
            raw = r.read()
            if binary:
                return raw, r.headers
            cs = r.headers.get_content_charset()
            if not cs:
                m = re.search(rb'charset=["\']?([\w-]+)', raw[:4000])
                cs = m.group(1).decode("ascii", "replace") if m else "utf-8"
            try:
                return raw.decode(cs, "replace")
            except LookupError:
                return raw.decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


_ZW = re.compile(u"[​‌‍⁠﻿]")
_BLOCK = re.compile(r"<(?:br|/p|p|/div|div|/li|li|/tr|tr|/h\d|h\d|/table|table)\b[^>]*>", re.I)


def text(fragment):
    """HTML 조각 → 한 줄 글."""
    s = re.sub(r"<[^>]*>", " ", fragment or "")
    s = _ZW.sub("", _html.unescape(s))
    return re.sub(r"\s+", " ", s).strip()


def block_text(fragment):
    """HTML 조각 → 줄을 살린 글 (본문 읽기용). 줄 안의 span 조각은 붙인다."""
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", fragment or "", flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"</t[dh]>", "\t", s, flags=re.I)
    s = _BLOCK.sub("\n", s)
    s = re.sub(r"<[^>]*>", "", s)
    s = _ZW.sub("", _html.unescape(s)).replace(" ", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def ymd(s):
    """'2026/10/20', '2026.10.20', '2026-10-20' → '2026-10-20' (없으면 '')."""
    m = re.search(r"(20\d\d)\s*[./\-년]\s*(\d{1,2})\s*[./\-월]\s*(\d{1,2})", s or "")
    return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3))) if m else ""


def hm(s):
    m = re.search(r"(\d{1,2}):(\d{2})", s or "")
    return "%02d:%s" % (int(m.group(1)), m.group(2)) if m else None
