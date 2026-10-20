# -*- coding: utf-8 -*-
"""한글(hwp·hwpx) 공고문에서 글만 꺼내기 — 표준 라이브러리만.

교육청 구인 공고·임용 공고는 일정(면접·발표)과 제출 서류가 본문이 아니라 첨부한 .hwp 에만 있는 때가 많다.
  text_of(data, name)  -> str   (못 읽으면 '')

- .hwp (HWP 5.0) = OLE 복합 문서(CFB). BodyText/SectionN 스트림이 (보통 deflate 로 눌린) 레코드열이고
  PARA_TEXT(태그 67) 레코드에 UTF-16 글이 들어 있다. 표 안의 글도 같은 스트림에 차례대로 들어 있다.
  배포용 문서(ViewText, 암호화)와 암호 걸린 문서는 읽지 않는다(빈 글).
- .hwpx = zip 안의 Contents/sectionN.xml 의 <hp:t>.
- .pdf 는 PyMuPDF(fitz)가 있으면 그것으로, 없으면 ''.
"""
import io
import re
import struct
import zlib
import zipfile

MAX_BYTES = 8 * 1024 * 1024          # 이보다 큰 첨부는 읽지 않는다
MAX_CHARS = 60000


# ------------------------------------------------------------------ CFB (OLE 복합 문서)
class CFB(object):
    END, FREE = 0xFFFFFFFE, 0xFFFFFFFF

    def __init__(self, data):
        if data[:8] != b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1":
            raise ValueError("CFB 가 아님")
        self.d = data
        self.ssz = 1 << struct.unpack_from("<H", data, 0x1E)[0]
        self.mssz = 1 << struct.unpack_from("<H", data, 0x20)[0]
        nfat = struct.unpack_from("<I", data, 0x2C)[0]
        self.dir_start = struct.unpack_from("<I", data, 0x30)[0]
        self.cutoff = struct.unpack_from("<I", data, 0x38)[0]
        mfat_start = struct.unpack_from("<I", data, 0x3C)[0]
        difat_start = struct.unpack_from("<I", data, 0x44)[0]
        difat = list(struct.unpack_from("<109I", data, 0x4C))
        s, guard = difat_start, 0
        while s not in (self.END, self.FREE) and guard < 4096:     # DIFAT 사슬
            ents = struct.unpack_from("<%dI" % (self.ssz // 4), data, self._off(s))
            difat += ents[:-1]
            s = ents[-1]
            guard += 1
        fat_secs = [x for x in difat if x not in (self.END, self.FREE)][:nfat]
        self.fat = []
        for fs in fat_secs:
            self.fat += struct.unpack_from("<%dI" % (self.ssz // 4), data, self._off(fs))
        self.entries = self._dir()
        root = self.entries[0]
        self.ministream = self._chain(root["start"], root["size"]) if root["start"] not in (self.END, self.FREE) else b""
        self.mfat = []
        if mfat_start not in (self.END, self.FREE):
            raw = self._chain(mfat_start, None)
            self.mfat = list(struct.unpack("<%dI" % (len(raw) // 4), raw[:len(raw) // 4 * 4]))
        self.paths = {}
        self._walk(root["child"], "")

    def _off(self, sec):
        return (sec + 1) * self.ssz

    def _chain(self, start, size):
        out, s, seen = [], start, set()
        while s not in (self.END, self.FREE) and s < len(self.fat) and s not in seen:
            seen.add(s)
            out.append(self.d[self._off(s):self._off(s) + self.ssz])
            s = self.fat[s]
        b = b"".join(out)
        return b if size is None else b[:size]

    def _mini_chain(self, start, size):
        out, s, seen = [], start, set()
        while s not in (self.END, self.FREE) and s < len(self.mfat) and s not in seen:
            seen.add(s)
            out.append(self.ministream[s * self.mssz:(s + 1) * self.mssz])
            s = self.mfat[s]
        return b"".join(out)[:size]

    def _dir(self):
        raw = self._chain(self.dir_start, None)
        ents = []
        for i in range(len(raw) // 128):
            e = raw[i * 128:(i + 1) * 128]
            nlen = struct.unpack_from("<H", e, 0x40)[0]
            name = e[:max(0, nlen - 2)].decode("utf-16-le", "replace")
            ents.append({"name": name, "type": e[0x42], "left": struct.unpack_from("<I", e, 0x44)[0],
                         "right": struct.unpack_from("<I", e, 0x48)[0], "child": struct.unpack_from("<I", e, 0x4C)[0],
                         "start": struct.unpack_from("<I", e, 0x74)[0], "size": struct.unpack_from("<I", e, 0x78)[0]})
        return ents

    def _walk(self, idx, prefix, depth=0):
        stack = [idx]
        seen = set()
        while stack:
            i = stack.pop()
            if i == self.FREE or i >= len(self.entries) or i in seen or depth > 32:
                continue
            seen.add(i)
            e = self.entries[i]
            stack += [e["left"], e["right"]]
            path = prefix + e["name"]
            if e["type"] == 2:
                self.paths[path] = e
            elif e["type"] == 1:
                self._walk(e["child"], path + "/", depth + 1)

    def read(self, path):
        e = self.paths.get(path)
        if not e:
            return None
        if e["size"] < self.cutoff:
            return self._mini_chain(e["start"], e["size"])
        return self._chain(e["start"], e["size"])


# ------------------------------------------------------------------ HWP 5.0
_CHAR1 = {0, 10, 13} | set(range(24, 32))           # 한 글자짜리 제어 문자; 나머지 1~31 은 8글자(16바이트) 덩어리


def _para_text(b):
    """글자 단위(UTF-16)로 읽되, 보조 평면 글자(서로게이트 쌍)는 이어서 한꺼번에 푼다 — 하나씩 chr 로 바꾸면
    짝 잃은 서로게이트가 남아 UTF-8 로 쓸 때 터진다(2026-10-20 서울 시행계획 공고문)."""
    out, run, i, n = [], bytearray(), 0, len(b) // 2

    def flush():
        if run:
            out.append(run.decode("utf-16-le", "replace"))
            del run[:]
    while i < n:
        c = struct.unpack_from("<H", b, i * 2)[0]
        if c >= 32:
            run += b[i * 2:i * 2 + 2]
            i += 1
            continue
        flush()
        if c in _CHAR1:
            if c in (10, 13):
                out.append("\n")
            i += 1
        else:
            if c == 9:
                out.append("\t")
            i += 8
    flush()
    return "".join(out)


def _records(data):
    i, n = 0, len(data)
    while i + 4 <= n:
        h = struct.unpack_from("<I", data, i)[0]
        tag, size = h & 0x3FF, (h >> 20) & 0xFFF
        i += 4
        if size == 0xFFF:
            if i + 4 > n:
                break
            size = struct.unpack_from("<I", data, i)[0]
            i += 4
        yield tag, data[i:i + size]
        i += size


def hwp_text(data):
    f = CFB(data)
    head = f.read("FileHeader") or b""
    if not head.startswith(b"HWP Document File"):
        return ""
    props = struct.unpack_from("<I", head, 36)[0] if len(head) >= 40 else 0
    compressed, encrypted, distributed = props & 1, props & 2, props & 4
    if encrypted or distributed:
        return ""
    secs = sorted((p for p in f.paths if p.startswith("BodyText/Section")),
                  key=lambda p: int(re.sub(r"\D", "", p) or 0))
    parts = []
    for p in secs:
        raw = f.read(p) or b""
        if compressed:
            try:
                raw = zlib.decompress(raw, -15)
            except zlib.error:
                continue
        for tag, body in _records(raw):
            if tag == 67:                      # HWPTAG_PARA_TEXT
                parts.append(_para_text(body))
        if sum(len(x) for x in parts) > MAX_CHARS:
            break
    if not parts:                              # 본문이 비면 미리보기 글이라도
        prv = f.read("PrvText")
        if prv:
            return prv.decode("utf-16-le", "replace")
    return "\n".join(parts)


def hwpx_text(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    names = sorted((n for n in z.namelist() if re.match(r"Contents/section\d+\.xml$", n, re.I)),
                   key=lambda n: int(re.sub(r"\D", "", n) or 0))
    out = []
    for n in names:
        x = z.read(n).decode("utf-8", "replace")
        for para in re.findall(r"<hp:p\b.*?</hp:p>", x, re.S):
            t = "".join(re.findall(r"<hp:t\b[^>]*>(.*?)</hp:t>", para, re.S))
            t = re.sub(r"<[^>]+>", "", t)
            out.append(t.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&"))
    return "\n".join(out)


def pdf_text(data):
    try:
        import fitz                            # 있으면 쓴다(없어도 된다)
    except Exception:
        return ""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        t = "\n".join(doc[i].get_text() for i in range(min(len(doc), 12)))
        doc.close()
        return t
    except Exception:
        return ""


def tidy(t):
    t = t.encode("utf-16", "surrogatepass").decode("utf-16", "replace")      # 짝 잃은 서로게이트 정리
    t = t.replace("\r", "\n").replace(" ", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()[:MAX_CHARS]


def text_of(data, name=""):
    """첨부 파일 바이트 → 글. 형식은 내용으로 먼저 판단하고 이름은 거든다."""
    if not data or len(data) > MAX_BYTES:
        return ""
    low = (name or "").lower()
    try:
        if data[:8] == b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1":
            return tidy(hwp_text(data))
        if data[:2] == b"PK" and (low.endswith(".hwpx") or b"Contents/section" in data[:4096] or True):
            try:
                return tidy(hwpx_text(data))
            except Exception:
                return ""
        if data[:5] == b"%PDF-":
            return tidy(pdf_text(data))
    except Exception:
        return ""
    return ""


if __name__ == "__main__":                     # python hwptext.py 파일.hwp
    import sys
    b = open(sys.argv[1], "rb").read()
    sys.stdout.reconfigure(encoding="utf-8")
    print(text_of(b, sys.argv[1])[:3000])
