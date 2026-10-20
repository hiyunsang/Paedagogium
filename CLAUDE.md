# Paedagogium — 개발 안내 (Claude Code 가 자동으로 읽는 파일)

**정보·컴퓨터 중등 임용 서재.** 2028학년도(2027년 11월) 1차를 목표로 하는 노베이스 수험생의 공부·정보 프로그램.
claude.ai 판(https://claude.ai/artifact/8qS9SBAPKHKTH19D9SgAiR, 2026-10-19)을 **Athenaeum(Documents\MAENG_paper) 과 같은 꼴의 로컬 프로그램**으로 옮겼고(2026-10-20),
공지 수집은 **Horarium(Documents\MAENG_worklog) 의 notices.py §16·§17 방식**을 임용 쪽으로 가져왔다. 기능 목록은 claude.ai 판의 FEATURES.md 를 따른다.

사용자와의 대화·UI 문구·커밋 메시지·코드 주석은 **한국어**.

## 1. 구조

```
Paedagogium\                 저장소 루트 (github.com/hiyunsang/Paedagogium, 공개)
  app\                       프로그램
    server.py                표준 라이브러리 ThreadingHTTPServer (127.0.0.1:8772). 라우트·내 기록·설정·Claude 작업·수집 스케줄
    claude_cli.py            `claude -p` 부르기 (창 없이 · 빈 작업 폴더 %TEMP%\paedagogium_claude · CLAUDE_CONFIG_DIR · stream-json · 취소)
    tutor.py                 튜터 시스템 프롬프트(TUTOR — 캐시가 맞게 바뀌는 것을 넣지 않는다)·질문 모드(질문/답안 만들기/문제 만들기)·채점·오답 해설 물음
    notices.py               중요 공지: 교육청 임용 게시판·평가원 기출/공지·한능검 공지 → 갈래(top/info/hide)·꼬리표·마감일 → 공지 하나를 Claude 가 정리
    jobs.py                  구인 공고: 서울교육일자리포털·경기 구인구직에서 정보 과목만 (core/related) + 상세·첨부 공고문의 일정 줄
    hwptext.py               .hwp(OLE+BodyText 레코드)·.hwpx(zip XML)·.pdf(fitz 있으면) → 글. 표준 라이브러리만
    net.py                   받기(재시도·DNS 한 번 실패 대비)·HTML → 글
    launch_check.py          같은 포트의 다른 판 서버 끄기 (명령줄에 paedagogium 과 server.py 가 있는 것만)
    Paedagogium_실행.bat     실행 (ASCII 만 — Athenaeum 의 bat 규칙)
    VERSION
    web\                     화면 (외부 리소스 0)
      index.html  app.css  app.js
      content\content_*.js   공부 자료 (claude.ai 판 그대로 — window.CONTENT_*)
      fonts\                 Pretendard (OFL, Athenaeum 에서 복사)
      logo\                  골드 P (tools\make_logo.py 가 만든다)
  tools\  restart_server.py · make_logo.py
  data\   (git 제외) store.json 내 기록 · settings.json · notices.json · jobs.json · backup\store-날짜.json(14개) · server.log
  _origin\ (git 제외) claude.ai 판 원본 파일
```

### 내 기록 (`data\store.json` = `{docs: {id: doc}}`)
claude.ai 판의 Store 꼴 그대로 (`type` 으로 가른다): `settings`(done 진도 맵·targetDate·events 내 일정) · `note`(오답: stage·nextReview·history·explain{gist,wrong,concept,trap,variant}) ·
`thread`(질문하기 대화: turns[{role,content,t,mode,model,tok,sec,stopped}]·pending) · `grade:<연습 id>`(채점 last·history) · `drafts`(서술형 쓰던 답안).
서버는 Claude 를 기다리는 동안 화면이 다른 것을 저장해도 지키도록 **파일을 다시 읽어 그 문서만 고친다**(`store_update`). 저장은 호출마다 다른 임시 이름 → os.replace (Athenaeum 2026-09-30 사고).

### 주요 라우트
GET `/api/version`(ui = 화면 파일 수정 시각 → 열어 둔 창이 옛 화면이면 알림) `/api/status` `/api/store` `/api/backup` `/api/settings` `/api/job?id=` `/api/notices` `/api/jobs`
POST `/api/store {op: put|del|import}` `/api/settings` `/api/claude {task: ask|grade|explain}` → `{job}` · `/api/job/cancel` · `/api/notices {op: refresh|read|unread|readall|analyze}` · `/api/jobs {op: refresh}`

## 2. 실행·재시작·시험
- 실행: 바탕화면 `Paedagogium` 아이콘(= `app\Paedagogium_실행.bat`, 최소화 창) → 서버가 없으면 pythonw 로 켜고 앱 창(chrome/msedge --app)
- 코드를 고친 뒤: `python tools\restart_server.py` (공지·구인 수집 중이면 거절, `--force`). 열어 둔 창은 왼쪽 아래 '새로 고침' 알림
- 다른 포트·자료 폴더로 시험: `PAEDAGOGIUM_PORT=8790`, `PAEDAGOGIUM_DATA=<폴더>`, 창을 안 띄우려면 `PAEDAGOGIUM_NOBROWSER=1`
- **Bash 에서 `python server.py` 로 띄운 서버는 명령줄에 경로가 없어 launch_check 가 못 끈다** — 시험 서버는 restart_server.py 로 띄울 것(전체 경로가 들어간다)
- Python 3.8.6(개발 PC) · 표준 라이브러리만. PyMuPDF(fitz)는 있으면 PDF 첨부를 읽는 데만 쓴다
- Claude 호출은 `claude_cli.run` 만 거칠 것 (창 없이·빈 폴더·전용 계정 폴더). 시스템 프롬프트(tutor.TUTOR)는 글자 하나까지 같아야 캐시가 맞는다

## 3. 수집 (공지·구인) — 2026-10-20 실측
| 출처 | 목록 | 상세·첨부 |
|---|---|---|
| 서울 교원임용시험안내 | `BD_selectBbsList.do?q_rowPerPage=30&q_bbsSn=1094&q_currPage=1…` (**q_currPage 만 주면 빈 목록** — q_rowPerPage·q_sort* 를 같이) | `BD_selectBbs.do?q_bbsSn=1094&q_bbsDocNo=`, 첨부 `ND_fileDownload.do` 의 title 은 '… 다운로드' |
| 경기 교원 시험공고 | `selectNttList.do?mi=11038&bbsId=2583` a.nttInfoBtn data-id | `selectNttInfo.do?…&nttSn=`, 첨부 `goFileDown('키')` → `/goe/na/ntt/comm/nttFileDownload.do?fileKey=` |
| 평가원 기출(컴퓨터 검색) | `list.do?boardID=1500212…&searchStr=컴퓨터` goView('1500212','번호') | 정보·컴퓨터 문제지가 올라오면 '꼭 볼 것' |
| 평가원 공지 | boardID=10023 — 임용 낱말 없는 글은 숨김 | |
| 한능검 공지 | `pst/list.do?bbs=noti` fn_goDetail | `pst/view.do?bbs=noti&pst_sno=`, 첨부 `/atchFile/FileDown.do?atch_file_id=` |
| 경기 구인 | POST `hnfpPbancList.do` mi=10502·srchOcptCd A/B/D·pageIndex 50 — **사이트의 과목 검색은 '정보'를 놓친다**(기간제 0건) → 탭 전부 받아 여기서 거른다 | `hnfpPbancInfoView.do?mi=10502&pbancSn=`, 첨부 `previewAjax('url','이름')` |
| 서울 구인 | `BD_selectSrchRecInfo.do?q_searchWord=정보|컴퓨터|코딩|소프트웨어|인공지능&q_rowPerPage=50` | `BD_selectRecDetail.do?q_rcrtSn=`, 첨부 title '… Download' |

- 갈래: 유치원·초등(유·초)만의 임용 공고는 숨김, '한국사' 는 꼭 볼 것(응시 요건), 'n일차·접수현황' 은 참고. 정보 과목 판정은 `jobs.is_info` (행정보조·상업정보·개인정보는 아님)
- **면접·발표 일정은 첨부 한글 공고문에만 있다** → hwptext 로 읽어 `schedule_lines`. HWP 의 UTF-16 을 한 글자씩 chr 하면 짝 잃은 서로게이트가 남아 JSON 저장이 터진다 → `_para_text` 는 이어진 글자를 한꺼번에 디코드, `tidy` 가 한 번 더 정리
- 공지 정리(Claude, 기본 Sonnet): 본문 + 첨부 앞 두 개(긴 공고문은 `focus_excerpt` = 앞 9천 자 + 정보·컴퓨터·일정·자격 낱말 둘레) → `{summary, relevance 꼭 볼 것|참고|관계없음|확인 필요, why, dates[], todo[], caution}`. 시험: 서울 2027 시행계획 → 정보·컴퓨터 26명(일반 24·장애 2)·사립 위탁 법인별 정보 선발·1·2차 날짜 6개, 45초
- 서버 예의: 같은 사이트 사이 0.4초, 공지 6시간·구인 3시간마다(설정에서 끌 수 있다)

## 4. 화면 규칙
- **Athenaeum 의 ui.css 토큰**을 app.css 맨 위에 그대로 (Pretendard, 강조색 #1f4fd1 하나, 1px 구분선, 고스트 동작 `.act`, 카드·그림자·이모지 금지). 골드(#C9A227)는 로고와 D-day 숫자에만
- 학습 화면은 **한눈에 먼저**(사용자 2026-10-16): 채점 = 점수·총평 → 된 것/빠진 것 → 고쳐 쓴 답안은 접기, 오답 해설 = 한 줄 요지·틀린 지점·자주 하는 실수 → 개념·변형 문제는 접기. 화면 안에 따로 스크롤되는 칸을 만들지 않는다
- 문제 만들기의 '정답과 채점 요소' 절은 `md()` 가 접는다(<details class="ans">)
- 상태 클래스 이름은 ui.css 공용 이름(act·sel·chip·on)과 겹치지 않게

## 5. 커밋
기능 단위로 커밋하고 `git push origin main`. 메시지는 한국어로 무엇을 왜. 저장소는 **공개**다 — data\(내 기록·공지·설정)·_origin\ 은 절대 올리지 않는다(.gitignore 확인).
