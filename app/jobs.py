# -*- coding: utf-8 -*-
"""정보(정보·컴퓨터) 과목 기간제·시간강사·사립 정규 구인 공고 수집 — 서울·경기 교육청 구인 포털.

경기 (2026-10-20 실측) https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do
  POST mi=10502 · srchOcptCd=A(기간제/사립교원)·B(초중등시간강사, 방과후 포함)·D(사립학교 교원정규채용) · srchEcptDl=Y(마감 제외) · pageIndex=50 · currPage
  사이트의 '과목명' 검색은 '정보' 를 못 찾는 때가 있어(10-20, 기간제 탭 0건) 탭마다 전부 받아 여기서 거른다.
  목록 <li><a href="javascript:goView('번호')"> … 상세 hnfpPbancInfoView.do?mi=10502&pbancSn=번호
서울 https://work.sen.go.kr/work/search/recInfo/BD_selectSrchRecInfo.do?q_searchWord=…&q_rowPerPage=50
  목록 li.flex_cont > a href BD_selectRecDetail.do?q_rcrtSn=번호, 칸은 p.tag_title + span
일정(면접·발표)은 대개 첨부 한글 공고문에만 있다 → 정보 과목 공고는 첨부를 받아 글을 꺼내 일정 줄을 뽑는다(hwptext).
"""
import io
import os
import re
import json
import time
import datetime
import threading
import urllib.parse

import net
import hwptext

GOE_LIST = "https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancList.do"
GOE_VIEW = "https://www.goe.go.kr/recruit/ad/func/pb/hnfpPbancInfoView.do?mi=10502&pbancSn={id}"
GOE_TABS = [("A", "기간제/사립교원", "기간제"), ("B", "초중등시간강사(자유학기활동강사 특기적성(방과후) 포함)", "시간강사"),
            ("D", "사립학교 교원정규채용", "사립 정규")]
SEN_LIST = "https://work.sen.go.kr/work/search/recInfo/BD_selectSrchRecInfo.do"
SEN_VIEW = "https://work.sen.go.kr/work/search/recInfo/BD_selectRecDetail.do?q_rcrtSn={id}"
SEN_WORDS = ["정보", "컴퓨터", "코딩", "소프트웨어", "인공지능"]
SOURCES = [{"name": "경기도교육청 구인구직", "url": GOE_LIST + "?mi=10502"},
           {"name": "서울교육일자리포털", "url": SEN_LIST}]
INTERVAL_H = 3

# 정보 과목: '정보'가 낱말로 서 있을 때만 (행정보조·개인정보·상업정보·정보공개는 아님)
_INFO = re.compile(r"정보\s*[·ㆍ.]?\s*컴퓨터|(?:^|[\s,(/·ㆍ\[<])정보(?:과|교과|\s*교사|\s*강사|\s*시간강사|\s*기간제)?(?=$|[\s,)/·ㆍ\]>\d])")
_NOT_INFO = re.compile(r"상업\s*정보|정보\s*공개|개인\s*정보|정보\s*보호\s*책임|정보\s*처리\s*기능사|행정\s*정보")
_RELATED = re.compile(r"코딩|로봇|소프트웨어|(?<![A-Za-z])SW(?![A-Za-z])|인공지능|컴퓨터|프로그래밍|디지털\s*리터러시")


def is_info(s):
    s = s or ""
    return bool(_INFO.search(s)) and not (_NOT_INFO.search(s) and not re.search(r"정보\s*[·ㆍ.]?\s*컴퓨터|(?:^|[\s(])정보(?:과|\s*교사)", s))


def school_level(school, kind_detail="", title=""):
    s = (school or "") + " " + (kind_detail or "")
    if re.search(r"고등학교", title or "") and not re.search(r"중학교|초등", title or ""):
        return "고등학교"                          # 법인 이름이 학교 칸에 들어간 사립 공고 (중앙기독초 칸에 '중앙기독고' 공고)
    if re.search(r"중학교", title or "") and not re.search(r"고등학교|초등", title or ""):
        return "중학교"
    if re.search(r"유치원", school or ""):
        return "유치원"
    if re.search(r"초등", school or "") or re.search(r"초등(?:교원|강사)", kind_detail or ""):
        return "초등학교"
    if re.search(r"고등학교|고$|공고|상고|과학고|외고|예고|체고|마이스터|소프트웨어고", school or ""):
        return "고등학교"
    if re.search(r"중학교|중$", school or ""):
        return "중학교"
    if re.search(r"특수|학교$", school or "") and "중등" in s:
        return "중등"
    if "중등" in s:
        return "중등"
    return ""


def tier_of(it):
    """core = 중·고 정보 과목 기간제·시간강사·사립 정규 / related = 방과후·초등 컴퓨터·코딩 / skip."""
    subj, title = it.get("subject") or "", it.get("title") or ""
    lvl = it.get("school_level") or ""
    info = is_info(subj) or is_info(title)
    after = re.search(r"방과후|돌봄|늘봄|특기적성|자유학기|외부\s*강사|수익자", title + " " + subj)
    if info and lvl not in ("유치원", "초등학교") and not after:
        return "core"
    if info or _RELATED.search(subj + " " + title):
        return "related"
    return "skip"


def mismatch_note(it):
    subj, title = it.get("subject") or "", it.get("title") or ""
    if is_info(subj) and not is_info(title) and not re.search(r"컴퓨터", title):
        m = re.search(r"\(([^()]{1,14})\)", title)
        other = m.group(1) if m and not re.search(r"\d차|공고|재공고|중|고|초", m.group(1)) else ""
        if other:
            return "제목은 '%s' 공고인데 과목 칸에는 '%s'로 적혀 있음 — 학교에 확인 필요" % (other, subj)
    return None


# ------------------------------------------------------------------ 경기
def _goe_fields(body):
    f = {}
    for m in re.finditer(r'<em class="btm_tit">\s*([^<]+?)\s*</em>(.*?)</p>', body, re.S):
        f[net.text(m.group(1))] = net.text(m.group(2))
    return f


def parse_goe_list(html, kind):
    out = []
    for sn, body in re.findall(r"goView\('(\d+)'\);\">(.*?)</a>\s*</li>", html, re.S):
        top = [net.text(x) for x in re.findall(r"<span>(.*?)</span>", re.search(r'class="cont_top">(.*?)</div>', body, re.S).group(1))] \
            if re.search(r'class="cont_top">', body) else []
        title_html = re.search(r'class="cont_tit">(.*?)</p>', body, re.S)
        title = net.text(re.sub(r'<span class="krds-badge[^"]*">.*?</span>', "", title_html.group(1), flags=re.S)) if title_html else ""
        f = _goe_fields(body)
        school = top[0] if top else ""
        phone = next((x for x in top if re.match(r"^[\d\-]{8,}$", x)), "")
        posted = net.ymd(next((x for x in top if "등록일" in x), ""))
        pay_area = [x.strip() for x in (f.get("모집정보") or "").split("|")]
        ap = [net.ymd(x) for x in (f.get("접수기간") or "").split("~")] + ["", ""]
        wk = [net.ymd(x) for x in (f.get("채용기간") or "").split("~")] + ["", ""]
        out.append({"id": "goe-" + sn, "sn": sn, "region": "경기", "school": school, "phone": phone, "posted": posted,
                    "title": title, "pay": pay_area[0] if pay_area else "", "area": pay_area[1] if len(pay_area) > 1 else "",
                    "headcount": f.get("채용인원") or "", "subject": f.get("직무분야") or "",
                    "apply": {"start": ap[0], "start_time": None, "end": ap[1], "end_time": None},
                    "work": {"start": wk[0], "end": wk[1]}, "kind": kind, "url": GOE_VIEW.format(id=sn)})
    return out


def fetch_goe(errors):
    items = []
    for code, name, kind in GOE_TABS:
        page = 1
        while page <= 12:
            try:
                html = net.fetch(GOE_LIST, data={"mi": "10502", "currPage": str(page), "srchEcptDl": "Y", "srchOcptCd": code,
                                                 "srchOcptNm": name, "pageIndex": "50", "searchType": "", "searchValue": ""})
            except Exception as e:
                errors.append("경기 %s %d쪽: %s" % (kind, page, e))
                break
            part = parse_goe_list(html, kind)
            items += part
            tot = re.search(r'검색건수\s*<strong[^>]*>([\d,]+)', html)
            total = int(tot.group(1).replace(",", "")) if tot else 0
            if not part or page * 50 >= total:
                break
            page += 1
            time.sleep(net.SLEEP)
    return items


def _label_values(text, labels):
    """줄 글에서 '이름 줄 → 값 줄들' 을 모은다 (상세 페이지의 정의 목록)."""
    lines = [l.strip() for l in text.split("\n") if l.strip() and l.strip() != "-->"]
    out, cur = {}, None
    for l in lines:
        if l in labels:
            cur = l
            out.setdefault(cur, [])
            continue
        if cur and len(out[cur]) < 6:
            out[cur].append(l)
    return dict((k, " ".join(v).strip()) for k, v in out.items())


GOE_LABELS = ["채용직종", "채용인원", "과목", "채용기간", "접수기간", "학교급", "근무형태", "근무시간", "복리후생", "근무지역", "주소",
              "전화번호", "자격요건", "경력", "학력", "우대사항", "채용방법 및 일정", "온라인접수", "접수방법", "제출서류", "상세요강",
              "참고파일", "유의사항", "채용담당자", "이름", "연락처", "뒤로가기"]


def detail_goe(it):
    html = net.fetch(it["url"])
    i = html.find("채용조건")
    region = html[max(0, i - 3000):] if i >= 0 else html
    region = re.sub(r"<(script|style)\b.*?</\1>", " ", region, flags=re.S | re.I)
    t = net.block_text(region)
    v = _label_values(t, GOE_LABELS)
    files = []
    for m in re.finditer(r"previewAjax\('([^']+)','([^']+)'\)", html):
        files.append({"name": net.text(m.group(2)), "url": m.group(1)})
    return {"kind_detail": v.get("채용직종", ""), "school_level_raw": v.get("학교급", ""), "hours": v.get("근무시간", ""),
            "how": v.get("접수방법", ""), "online": v.get("온라인접수", ""), "docs": v.get("제출서류", ""),
            "prefer": v.get("우대사항", ""), "address": v.get("주소", ""), "subject_full": v.get("과목", ""), "files": files}


# ------------------------------------------------------------------ 서울
def parse_sen_list(html):
    out = []
    for body in re.findall(r'<li class="flex_cont">(.*?)</li>', html, re.S):
        sn = re.search(r"q_rcrtSn=(\d+)", body)
        if not sn:
            continue
        stitle = net.text((re.search(r'class="s_title">(.*?)</span>', body, re.S) or re.search(r"()", "")).group(1))
        parts = [x.strip() for x in stitle.split("|")]
        f = {}
        for m in re.finditer(r'<p class="tag_title">\s*(.*?)\s*</p>\s*<span[^>]*>(.*?)</span>', body, re.S):
            f[net.text(m.group(1))] = net.text(m.group(2))
        ap = (f.get("접수기간") or "").split("~") + ["", ""]
        wk = (f.get("채용기간") or "").split("~") + ["", ""]
        kd = f.get("직무분야") or ""
        kind = "기간제" if "기간제교원" in kd else "시간강사" if "시간강사" in kd else "사립 정규" if "정규교원" in kd else "기타"
        title = net.text((re.search(r'class="list_title">(.*?)</h4>', body, re.S) or re.search(r"()", "")).group(1))
        out.append({"id": "sen-" + sn.group(1), "sn": sn.group(1), "region": "서울", "school": parts[0] if parts else "",
                    "phone": parts[1] if len(parts) > 1 and re.match(r"^[\d\-]{8,}$", parts[1]) else "",
                    "posted": net.ymd(stitle), "title": title, "pay": f.get("보수/임금") or "", "area": f.get("모집정보") or "",
                    "headcount": f.get("채용인원") or "", "subject": f.get("과목(담당업무)") or "", "kind_detail": kd,
                    "apply": {"start": net.ymd(ap[0]), "start_time": net.hm(ap[0]), "end": net.ymd(ap[1]), "end_time": net.hm(ap[1])},
                    "work": {"start": net.ymd(wk[0]), "end": net.ymd(wk[1])}, "kind": kind, "url": SEN_VIEW.format(id=sn.group(1))})
    return out


def fetch_sen(errors):
    items, seen = [], set()
    for w in SEN_WORDS:
        for page in (1, 2):
            q = urllib.parse.urlencode({"q_searchWord": w, "q_rowPerPage": "50", "q_currPage": str(page)})
            try:
                html = net.fetch(SEN_LIST + "?" + q)
            except Exception as e:
                errors.append("서울 '%s': %s" % (w, e))
                break
            part = parse_sen_list(html)
            for it in part:
                if it["id"] not in seen:
                    seen.add(it["id"])
                    items.append(it)
            time.sleep(net.SLEEP)
            if len(part) < 50:
                break
    return items


SEN_LABELS = ["채용직종", "채용인원", "과목", "(담당업무)", "채용기간", "접수기간", "근무조건 및 접수방법", "근무시간", "보수/임금", "접수방법",
              "제출서류", "상세요강", "참고파일", "근무지역", "주소", "지도 보기", "채용담당자", "이름", "연락처"]


def detail_sen(it):
    html = net.fetch(it["url"])
    i = html.find("채용조건")
    region = re.sub(r"<(script|style)\b.*?</\1>", " ", html[i:] if i >= 0 else html, flags=re.S | re.I)
    v = _label_values(net.block_text(region), SEN_LABELS)
    files = []
    for m in re.finditer(r'href="(/component/file/ND_fileDownload\.do\?[^"]+)"[^>]*title="([^"]+?)\s*Download"', html):
        files.append({"name": net.text(m.group(2)), "url": "https://work.sen.go.kr" + net.text(m.group(1))})
    how = re.sub(r"\(\s*", "(", re.sub(r"\s*\)", ")", v.get("접수방법", "")))
    return {"hours": v.get("근무시간", ""), "how": how, "docs": v.get("제출서류", ""),
            "address": v.get("주소", ""), "files": files}


# ------------------------------------------------------------------ 첨부 공고문에서 일정 줄
_SCHED_KEY = re.compile(r"면접|심사|실연|발표|통보|접수|서류\s*전형|시험|합격|평가")
_SCHED_DATE = re.compile(r"(?:20\d\d\s*\.\s*)?\d{1,2}\s*\.\s*\d{1,2}\s*\.?(?:\s*\([월화수목금토일]\w*\))?|\d{1,2}\s*월\s*\d{1,2}\s*일")


def schedule_lines(text):
    out = []
    for raw in (text or "").split("\n"):
        l = re.sub(r"\s+", " ", raw).strip()
        if 8 <= len(l) <= 140 and _SCHED_KEY.search(l) and _SCHED_DATE.search(l) and not re.search(r"제\d+조|법률|시행령", l):
            if l not in out:
                out.append(l)
        if len(out) >= 8:
            break
    return out


def pay_line(text):
    for raw in (text or "").split("\n"):
        l = raw.strip()
        if re.search(r"(?:시간당|시급|강사비|강사료|보수)\s*[:：]?\s*[\d,]{4,}\s*원", l) and len(l) < 80:
            return re.sub(r"\s+", " ", l)
    return ""


def _attachment_text(it):
    for f in it.get("files") or []:
        if not re.search(r"\.(hwpx?|pdf)$", f.get("name", ""), re.I) or re.search(r"지원서|양식|신청서|동의서|서식", f.get("name", "")):
            continue
        try:
            time.sleep(net.SLEEP)
            raw, _h = net.fetch(f["url"], binary=True, referer=it.get("url"))
            t = hwptext.text_of(raw, f["name"])
            if t:
                return t
        except Exception:
            continue
    # 공고문이 양식 이름으로만 올라온 때: 첫 한글 파일이라도
    for f in it.get("files") or []:
        if re.search(r"\.hwpx?$", f.get("name", ""), re.I):
            try:
                raw, _h = net.fetch(f["url"], binary=True, referer=it.get("url"))
                return hwptext.text_of(raw, f["name"])
            except Exception:
                return ""
    return ""


# ------------------------------------------------------------------ 저장·동기화
class Store(object):
    def __init__(self, path):
        self.path = path
        self.lock = threading.RLock()

    def load(self):
        with self.lock:
            try:
                with io.open(self.path, encoding="utf-8") as f:
                    d = json.load(f)
            except (OSError, ValueError):
                d = {}
            d.setdefault("items", {})
            return d

    def save(self, d):
        with self.lock:
            tmp = self.path + ".%d.tmp" % threading.get_ident()
            with io.open(tmp, "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)


def sync(store, now=None, detail_budget=40):
    """두 포털을 받아 정보 과목 공고만 남긴다. 새 공고는 상세·첨부까지 (한 번에 detail_budget 개까지)."""
    now = float(now or time.time())
    today = datetime.date.fromtimestamp(now).strftime("%Y-%m-%d")
    errors = []
    found = []
    try:
        found += fetch_goe(errors)
    except Exception as e:
        errors.append("경기: %s" % e)
    try:
        found += fetch_sen(errors)
    except Exception as e:
        errors.append("서울: %s" % e)
    keep = []
    for it in found:
        it["school_level"] = school_level(it.get("school"), it.get("kind_detail"), it.get("title"))
        it["tier"] = tier_of(it)
        if it["tier"] != "skip":
            keep.append(it)
    with store.lock:
        d = store.load()
        items = d["items"]
        fresh = set()
        for it in keep:
            old = items.get(it["id"])
            fresh.add(it["id"])
            if old:
                for k in ("title", "apply", "work", "pay", "area", "headcount", "subject", "tier", "school_level", "phone", "kind"):
                    if it.get(k):
                        old[k] = it[k]
                old["seen"] = now
            else:
                it["first_seen"] = now
                it["seen"] = now
                items[it["id"]] = it
        # 지난 공고: 마감 7일이 지난 것은 지운다 (목록에서 사라졌어도 마감 전이면 남김 — 사이트가 일찍 내릴 때가 있다)
        cut = (datetime.date.fromtimestamp(now) - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
        for k in [k for k, v in items.items() if (v.get("apply") or {}).get("end") and v["apply"]["end"] < cut]:
            items.pop(k, None)
        d["fetched"] = now
        d["errors"] = errors
        store.save(d)
        todo = [v for v in items.values() if not v.get("detail_t")]
    todo.sort(key=lambda v: (v.get("tier") != "core", (v.get("apply") or {}).get("end") or "9999"))
    done = 0
    for v in todo[:detail_budget]:
        try:
            time.sleep(net.SLEEP)
            extra = detail_goe(v) if v["region"] == "경기" else detail_sen(v)
            v2 = dict(v, **extra)
            att = _attachment_text(v2) if v2.get("tier") == "core" else ""
            sched = schedule_lines(att)
            pay = pay_line(att)
        except Exception as e:
            errors.append("%s 상세: %s" % (v.get("school"), e))
            continue
        with store.lock:
            d = store.load()
            cur = d["items"].get(v["id"])
            if not cur:
                continue
            cur.update(extra)
            if sched:
                cur["schedule"] = sched
            if pay and not re.search(r"\d", cur.get("pay") or ""):
                cur["pay_note"] = pay
            if extra.get("school_level_raw") and not cur.get("school_level"):
                cur["school_level"] = extra["school_level_raw"]
            cur["note"] = mismatch_note(cur)
            cur["detail_t"] = time.time()
            store.save(d)
        done += 1
    with store.lock:
        d = store.load()
        d["errors"] = errors
        store.save(d)
    return {"found": len(found), "kept": len(keep), "details": done, "errors": errors, "today": today}


def public(store):
    d = store.load()
    items = sorted(d["items"].values(), key=lambda v: ((v.get("apply") or {}).get("end") or "9999", v.get("school") or ""))
    return {"generated_at": d.get("fetched"), "errors": d.get("errors") or [], "items": items, "sources": SOURCES}
