// 교과교육학: 공식 문서와 원 논문을 확인해 요지를 정리. 서술형 연습 문항은 content_pedagogy_practice.js(자체 제작).
(function () {
  var P = window.PRACTICE || {};
  var KEDI = { label: "SW교육 교수학습 모델 개발 연구 (CR 2015-35)", url: "https://edpolicy.kedi.re.kr/cmm/fileDownload.do?nTbBoardArticleFileSeq=10358" };
  var LEVELRPT = { label: "평가원 2022 개정 중·고 정보과 성취수준 개발 연구 (CRC 2024-22)", url: "https://ncic.re.kr/bbs/download.do?articleIdx=774&fileName=1725499655442.pdf" };
  var LEVELMID = { label: "2022 개정 중학교 정보과 성취수준 (PDF)", url: "https://ncic.re.kr/bbs/download.do?articleIdx=774&fileName=1725499748614.pdf" };
  var CURR = { label: "2022 개정 정보과 교육과정 원문 PDF", url: "https://ncic.re.kr/inv/org/download.do?year=2022&seq=10004240&orgType=ogi4" };
  var WING = { label: "Wing (2006) Computational Thinking, CACM 49(3)", url: "https://www.cs.cmu.edu/~15110-s13/Wing06-ct.pdf" };
  var MOE2022 = { label: "교육부: 2022 개정 교육과정 확정·발표", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=93459&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N" };

  window.CONTENT_PEDAGOGY = {
    lead: "전공A·B에서 교과교육학은 보통 배점의 30~35%입니다. 기출에서 가장 많이 나온 순서(평가 → 교육과정·역량 → 교수·학습 모형)로 꼭 알아야 할 내용을 정리하고, 근거가 되는 공식 문서와 원 논문을 함께 붙였습니다. 각 주제 끝의 서술형 연습 문항은 이 앱이 직접 만든 것이며, 답안을 쓰면 Claude가 4점 만점 기준으로 채점해 줍니다.",
    themes: [
      {
        id: "ct", short: "성격·CT·역량", title: "정보 교과의 성격, 컴퓨팅 사고력, 교과 역량",
        summary: "정보과는 컴퓨팅 사고력으로 실생활과 여러 학문의 문제를 해결하는 교과이고, 2022 개정 총론에서 디지털 소양은 언어·수리 소양과 함께 모든 교과의 바탕이 되는 ==기초소양==입니다.",
        points: [
          "Wing(2006): 컴퓨팅 사고력(CT)은 컴퓨터 과학자만이 아니라 ==모든 사람이 갖춰야 할 분석적 기초 능력==이다. 핵심은 추상화와 분해, 그 결과를 자동화하는 것이다.",
          "교육부·KERIS 「소프트웨어 교육 운영지침」(2015)을 반영한 연구 보고서는 CT를 ‘일상의 문제를 컴퓨팅의 기본 개념과 원리를 바탕으로 효율적으로 해결하는 사고 능력’으로 정의하고, 구성 요소로 ==자료 수집, 자료 분석, 구조화, 분해, 추상화(모델링), 알고리즘, 자동화(코딩), 시뮬레이션, 일반화==를 든다.",
          "2015 개정 정보과는 ==추상화와 자동화==를 CT의 두 축으로 강조했고, 교과 역량은 정보문화소양·컴퓨팅 사고력·협력적 문제해결력이었다.",
          "2022 개정 정보과의 교과 역량은 ==컴퓨팅 사고력, 디지털 문화 소양, 인공지능 소양==이다. 각 역량의 정확한 정의 문장은 교육과정 원문의 ‘성격 및 목표’에서 확인해 그대로 외운다.",
          "중학교 ‘정보’는 디지털 민주시민이 갖춰야 할 ==디지털 소양의 근본==이 되도록 구성되었다(평가원 성취수준 연구).",
          "기출: 교과 역량과 CT 하위 요소는 2018~2026학년도 사이 여러 번 나왔다(2023 A1 2015 역량, 2024 A1 2022 역량, 2026 A9 CT 하위 요소)."
        ],
        sources: [WING, KEDI, CURR, LEVELRPT, MOE2022],
        practice: P.ct
      },
      {
        id: "sw-models", short: "SW교육 5모형", title: "SW교육 교수·학습 모형 (KEDI·KERIS 2015)",
        summary: "한국교육개발원 수탁 연구(CR 2015-35, KERIS 김진숙 외)가 개발한 다섯 모형입니다. 이름과 약어, 단계 순서, 기반 교수법을 짝지어 외우세요. 흔히 쓰는 ‘DBL’이나 ‘NDM’은 원문의 약어가 아니며, 디자인 중심 모형의 공식 약어는 ==NDIS==입니다.",
        models: [
          { name: "시연 중심 모형 (DMM)", tag: "직접교수 기반", stages: ["시연 Demonstration", "모방 Modeling", "제작 Making"], desc: "교사가 설명하고 시범을 보이면 학생이 따라 하며 질문·대답하고, 단계적·독립적 연습으로 넘어간다. 프로그래밍 도구나 문법을 처음 익힐 때 알맞다." },
          { name: "재구성 중심 모형 (UMC)", tag: "발견학습 기반", stages: ["놀이 Use", "수정 Modify", "재구성 reCreate"], desc: "완성된 프로그램을 체험·관찰하고, 교사가 의도적으로 바꿔 둔 모듈이나 알고리즘을 수정한 뒤, 자기만의 프로그램을 설계·제작한다." },
          { name: "개발 중심 모형 (DDD)", tag: "탐구학습 기반", stages: ["탐구 Discovery", "설계 Design", "개발 Development"], desc: "문제를 탐구하고 알고리즘을 계획한 뒤 구현하며 피드백을 받는다." },
          { name: "디자인 중심 모형 (NDIS)", tag: "프로젝트학습·디자인 사고 기반", stages: ["요구 분석 Needs", "디자인 Design", "구현 Implementation", "공유 Share"], desc: "사용자 중심으로 요구를 분석하고, 분해·패턴·알고리즘으로 설계해 프로그래밍·피지컬 컴퓨팅으로 구현한 다음, 결과를 공유하며 피드백과 성찰을 한다." },
          { name: "CT 요소 중심 모형 (DPAA(P))", tag: "문제해결학습 기반", stages: ["분해", "패턴 인식", "추상화", "알고리즘", "(프로그래밍)"], desc: "CT 요소를 차례로 밟아 문제를 해결한다. 마지막 프로그래밍 단계는 선택적이다." }
        ],
        points: [
          "같은 보고서는 모형마다 함께 쓸 전략으로 도제식, ==짝 프로그래밍==, 디버깅, 언플러그드, 디지로그, 디자인 사고, 창의성, 제한 문제 해결, 스토리텔링 기법을 연결한다.",
          "기반 교수법 짝: DMM–직접교수, UMC–발견학습, DDD–탐구학습, NDIS–프로젝트학습, DPAA(P)–문제해결학습."
        ],
        sources: [KEDI, { label: "양권우(2021) 디자인 중심 모형 연구, 정보교육학회논문지 25(1)", url: "https://koreascience.or.kr/article/JAKO202115463148799.pdf" }, { label: "전미연 외(2018) UDDPAAP 모델", url: "https://koreascience.kr/article/CFKO201821464986616.pdf" }],
        practice: (P.models || []).slice(1, 2)
      },
      {
        id: "intl", short: "PRIMM·언플러그드·짝", title: "프로그래밍 수업 방법: PRIMM, Use–Modify–Create, 언플러그드, 짝 프로그래밍, 피지컬 컴퓨팅",
        summary: "2022 개정 교육과정은 문제기반·프로젝트기반·디자인기반 학습, 짝 프로그래밍, 탐구학습을 교수·학습 방법으로 명시합니다. 아래 방법들은 수업 설계 문항에서 근거로 쓰기 좋습니다.",
        models: [
          { name: "PRIMM (Sentance, Waite & Kallia, 2019)", stages: ["예측 Predict", "실행 Run", "조사 Investigate", "수정 Modify", "제작 Make"], desc: "코드를 쓰기 전에 먼저 읽고 결과를 예측하게 해 인지 부담을 줄인다. 조사 단계에서 추적표·주석·디버깅 활동을 하고 짝 토론을 활용한다.", sources: [{ label: "Raspberry Pi Foundation: Using PRIMM (Quick Read)", url: "https://static.raspberrypi.org/files/curriculum/quickreads/11-Pedagogy_Summary_PRIMM_V4_2023.pdf" }, { label: "Sentance et al. (2019) CSE 29(2-3)", url: "https://doi.org/10.1080/08993408.2019.1608781" }] },
          { name: "Use–Modify–Create (Lee et al., 2011)", stages: ["사용 Use", "수정 Modify", "창작 Create"], desc: "남이 만든 산출물을 써 보고, 고쳐 보고, 새로 만드는 순서로 학습자의 주도권과 난이도를 점점 높인다. KEDI의 UMC(재구성 중심) 모형과 같은 발상이다.", sources: [{ label: "Lee et al. (2011) ACM Inroads 2(1)", url: "https://doi.org/10.1145/1929887.1929902" }] },
          { name: "언플러그드 (CS Unplugged, Bell 외)", desc: "컴퓨터 없이 카드·놀이·신체 활동으로 이진수, 정렬, 오류 검출 같은 컴퓨터 과학 개념을 익힌다. 원리 이해 뒤 프로그래밍(플러그드) 활동으로 이어 붙이는 설계가 흔히 권장된다. 기출 2020 A5.", sources: [{ label: "CS Unplugged (캔터베리대)", url: "https://www.csunplugged.org/en/" }] },
          { name: "짝 프로그래밍", desc: "드라이버(입력)와 내비게이터(검토·안내)가 일정 시간마다 역할을 바꾼다. 프로그램 품질, 자신감, 학업 지속에 효과가 보고되었다. 교육과정이 명시한 방법이며 2026 B7에 나왔다.", sources: [{ label: "McDowell et al. (2006) CACM 49(8)", url: "https://doi.org/10.1145/1145287.1145293" }, { label: "박윤미·이효종(2020) 중학교 정보 짝 프로그래밍", url: "https://koreascience.or.kr/article/JAKO202026061058094.do" }] },
          { name: "피지컬 컴퓨팅", desc: "센서·액추에이터·보드(예: 아두이노)로 실제 세계와 상호작용하는 시스템을 만든다. 성취기준 [[9정01-02]]·[[9정01-03]], 고교 사물인터넷 [[12정01-02]]·[[12정01-03]]과 연결된다. 기출 2019 A11, 2023 B5, 2025 A8.", sources: [{ label: "이동규·이영준(2018) 피지컬 컴퓨팅 메타분석", url: "https://www.koreascience.or.kr/article/CFKO201831342441230.page" }] }
        ],
        sources: [CURR],
        practice: [(P.models || [])[0], (P.models || [])[2], (P.models || [])[3]].filter(Boolean)
      },
      {
        id: "general", short: "일반 교수이론", title: "기출에 나온 일반 교수·학습 이론",
        summary: "정보과 기출은 교육학의 교수 이론을 정보 수업 장면에 붙여 묻습니다. 이름·단계·핵심 개념을 정확히 쓰는 것이 관건입니다. 아래 이론들은 교육학 표준 교재에서 다루는 내용이며, 괄호 안은 해당 이론이 나온 기출입니다.",
        table: {
          head: ["이론", "핵심 단계·요소", "정보 수업 적용 포인트"],
          rows: [
            ["==켈러 ARCS== (2014 A2, 2021 A11, 2022 B3)", "주의(Attention) → 관련성(Relevance) → 자신감(Confidence) → 만족감(Satisfaction). 하위 전략: 주의(지각적 각성, 탐구적 각성, 다양성), 관련성(친밀성, 목적 지향성, 필요·동기 부합), 자신감(학습 요건 제시, 성공 기회, 개인적 조절감), 만족감(내재적 강화, 외재적 보상, 공정성)", "흥미로운 실행 결과 시연으로 주의, 학생 생활 문제로 관련성, 단계별 과제로 자신감, 작품 공유로 만족감"],
            ["==가네의 9가지 수업 사태== (2021 A11)", "주의 획득 → 학습 목표 제시 → 선수 학습 회상 → 자극 자료 제시 → 학습 안내 → 수행 유도 → 피드백 → 수행 평가 → 파지와 전이 증진", "‘학습 안내’ 단계에 예제 코드·힌트, ‘피드백’ 단계에 실행 결과와 오류 메시지 해석"],
            ["==ASSURE== (2014 A서술1, 2024 B3)", "학습자 분석 → 목표 진술 → 방법·매체·자료 선정 → 매체와 자료 활용 → 학습자 참여 요구 → 평가와 수정", "교육용 프로그래밍 언어·피지컬 컴퓨팅 도구를 고르는 근거를 학습자 분석과 목표에서 끌어온다"],
            ["==문제기반학습(PBL)== (2014 B논술1, 2024 A7)", "비구조화된 실제 문제 제시 → 문제 확인(아는 것·모르는 것·학습 과제) → 자기 주도 학습 → 해결안 구안·재검토 → 발표와 평가. 교사는 촉진자·인지적 코치", "실생활 데이터 문제를 주고 모둠이 알고리즘·프로그램으로 해결안을 만든다"],
            ["==협동학습 JIGSAW I·II== (2024 B5)", "I: 모집단 → 전문가 집단 학습 → 모집단으로 돌아가 서로 가르침 → 개별 평가(집단 보상 없음). II: 모두가 전체 자료를 읽고, 개별 평가의 향상 점수로 집단 보상", "정렬 알고리즘을 한 명씩 전문가로 맡아 서로 가르치기"],
            ["==TGT(토너먼트형)·STAD== (2021 B5)", "TGT: 교사 수업 → 팀 학습 → 능력이 비슷한 학생끼리 토너먼트 → 팀 점수 인정. STAD: 수업 → 팀 학습 → 개별 퀴즈 → 향상 점수 → 팀 보상", "코드 추적 퀴즈 토너먼트"],
            ["==백워드 설계== (2022 A7)", "바라는 결과 확인 → 수용 가능한 증거(평가) 결정 → 학습 경험과 수업 계획 (Wiggins & McTighe)", "성취기준에서 출발해 평가 과제를 먼저 정하고 수업 활동을 짠다"],
            ["==타일러의 목표 진술== (2024 B4)", "목표를 ==내용과 행동==의 두 차원으로 함께 진술한다", "‘배열을 활용하여(내용) 성적 처리 프로그램을 작성할 수 있다(행동)’"],
            ["==역할놀이== (2023 A6)", "샤프텔의 9단계: 집단 분위기 조성 → 참가자 선정 → 무대 설정 → 관찰자 준비 → 실연 → 토론과 평가 → 재실연 → 토론과 평가 → 경험 공유와 일반화", "인공지능 윤리 딜레마 상황을 역할로 나눠 토론"],
            ["==페퍼트의 구성주의(constructionism)== (2022 B4)", "학습자가 공유할 수 있는 의미 있는 산출물을 직접 만들며 지식을 구성한다. LOGO, ‘생각할 거리가 되는 대상’", "학생이 자기 프로젝트(게임, 시뮬레이션)를 만들고 공유"],
            ["==디자인 기반 학습== (2026 A9)", "2022 개정 교육과정이 명시한 방법. 사용자 요구에서 출발해 설계–구현–공유·성찰을 반복한다. 국내 SW교육 모형으로는 디자인 중심 모형(NDIS)이 대응한다", "기출에서 어떤 단계 명칭을 썼는지는 2026학년도 시험지 원문으로 확인"]
          ]
        },
        points: [
          "출처 메모: ARCS(Keller), 9가지 수업 사태(Gagné), ASSURE(Heinich 외), PBL(Barrows), JIGSAW(Aronson; II는 Slavin), TGT·STAD(DeVries·Slavin), 백워드 설계(Wiggins·McTighe), 목표 진술(Tyler), 역할놀이(Shaftel), 구성주의(Papert)는 교육학 교재의 표준 내용입니다. 교육학 1교시 공부와 겹치므로 같은 노트로 정리하세요."
        ]
      },
      {
        id: "assess", short: "평가", title: "평가: 과정 중심 평가, 성취수준, 채점 기준",
        summary: "기출에서 교과교육학 중 가장 많이 나온 주제(약 15회)입니다. 평가 방향, 평가 도구 개발 절차, 채점 기준 진술, 피드백까지 한 흐름으로 쓸 수 있어야 합니다.",
        points: [
          "2022 개정 총론의 평가 방향: 성취기준에 근거해 ==수업과 평가를 일관되게== 운영하고, 결과뿐 아니라 ==학습 과정==을 확인해 환류하며, 학생에게 자기평가 기회를 준다. 배울 기회를 주지 않은 내용은 평가하지 않고, 수행평가를 내실화하며 서술형·논술형을 확대하고, 지능정보기술을 활용한 맞춤형 평가를 활성화한다.",
          "정보과 평가 방향(교육과정 원문): 세 교과 역량의 하위 요소를 기준으로 과정 중심·다면 평가, 학생과 함께 루브릭 만들기, 포트폴리오·관찰·서술형·수행·자기·동료평가, 자동 평가 시스템·LMS 활용 시 사전 안내, 정량·정성 평가 병행.",
          "평가원은 ‘평가기준’ 대신 ==성취수준==이라는 말을 쓴다. 성취기준별·영역별 성취수준을 지식·이해, 과정·기능, 가치·태도로 진술하고, 학기 단위 성취수준은 A~E(또는 A~C)로 진술한다.",
          "평가 도구 개발 절차: ==성취기준 분석 → 평가 요소 도출 → 수행 과제 설정 → 채점 기준(루브릭) 개발 → 피드백 방안 마련==. 평가원 예시에는 [[9정03-07]] 함수·디버깅, 정렬 알고리즘 수행평가가 있고, 프로그래밍 과제에는 온라인 저지 같은 자동 평가 활용을 권한다.",
          "채점 기준 진술: 수준(상·중·하 등)마다 ==관찰 가능한 행동==으로 쓰고, 수준 사이 차이가 한 가지 기준으로 구분되게 한다. 기출 2018 A9는 채점 기준표의 문제점을, 2026 A5는 학습 부진 학생을 위한 평가 기준 세분화를 물었다.",
          "CT 평가: Brennan & Resnick(2012)의 3차원(계산적 개념, 계산적 실천, 계산적 관점)과 포트폴리오 분석·산출물 기반 인터뷰·디자인 시나리오, Dr. Scratch 자동 분석.",
          "기본 용어도 함께: 진단·형성·총괄 평가, 규준참조·준거참조(성취평가제는 준거참조), 타당도(내용 타당도는 2014 A서술2)와 신뢰도."
        ],
        sources: [LEVELRPT, LEVELMID, CURR, { label: "Brennan & Resnick (2012) CT 평가 틀", url: "https://www.media.mit.edu/publications/new-frameworks-for-studying-and-assessing-the-development-of-computational-thinking/" }, { label: "Dr. Scratch (2015)", url: "https://revistas.um.es/red/article/view/240251" }, { label: "학생평가지원포털", url: "https://stas.moe.go.kr/" }],
        practice: P.assess
      },
      {
        id: "policy", short: "교육과정 운영·정책", title: "교육과정 운영과 정보교육 정책",
        summary: "교육과정 재구성(영역 연계, 블록타임, 학교자율시간)과 최근 정책은 2차 면접에도 그대로 나옵니다.",
        points: [
          "2022 개정 교육과정 확정(2022.12.22): 언어·수리·==디지털 기초소양== 강화, 정보교육 확대, ==학교자율시간== 도입(지역 연계, 과목 개설), 학점 기반의 유연한 고교 교육과정.",
          "정보 시수: 초등 실과 정보 17 → 34시간 이상, 중학교 정보 34 → ==68시간 이상==. 늘어난 시간은 학교자율시간 등을 활용해 확보한다.",
          "「디지털 인재양성 종합방안」(2022.8.22): 2026년까지 디지털 인재 100만 명 양성, 정보 수업 시수 2배 이상.",
          "「모두를 위한 AI 인재양성 방안」(2025.11.10): 정보 교과 안에서 AI 교육 확대, AI 중점학교를 2028년까지 2,000교로, 국가교육위원회와 교육과정 개정 추진(일정 미정). 2026년 3월 AI 중점학교 1,141교 선정(중점학교 기준: 초 68시간 이상, 중 102시간 이상, 고 매 학기 편성).",
          "AI 디지털교과서: 2025.8.14 「초·중등교육법」 개정으로 ==교과서에서 교육자료로== 지위가 바뀌었다. 학교장이 기준에 따라 학교운영위원회 심의를 거쳐 선정한다. 교육부는 2025.12.30 학습지원 소프트웨어 선정 기준을 안내했다.",
          "교육과정 재구성 기출: 블록타임 재구성(2020 A7), 영역 연계 교과 내 재구성(2019 B8 논술), 영역 연계 재구성·백워드 설계(2022 A7)."
        ],
        sources: [MOE2022, { label: "교육부 디지털 인재양성 종합방안", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=92346&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N" }, { label: "정책브리핑: 모두를 위한 AI 인재양성 방안", url: "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156727284" }, { label: "정책브리핑: AI 중점학교 1,141교 선정", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148960557" }, { label: "교육부: 학습지원 소프트웨어 선정 기준 안내", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=105007&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N" }],
        practice: P.curriculum
      },
      {
        id: "ethics", short: "정보윤리", title: "정보윤리, 디지털 시민성, 저작권·개인정보",
        summary: "‘디지털 문화’ 영역과 인공지능 영역의 윤리 내용은 교과교육학과 내용학 양쪽으로 출제됩니다(2021 A1 잊힐 권리, 2021 B7 CCL, 2023 A6 AI 윤리, 2024 B1 AI 사회적 영향).",
        points: [
          "성취기준: [[9정05-01]] 디지털 사회의 특성과 직업 변화, [[9정05-02]] 안전 규칙의 민주적 논의와 실천, [[9정05-03]] 개인정보·저작권 보호 실천. 인공지능 영역 [[9정04-05]] 데이터 윤리.",
          "교육부 「교육분야 인공지능 윤리원칙」(2022.8.11): 대원칙은 ==사람의 성장을 지원하는 인공지능==. 교육기본법 제17조의3에 근거.",
          "교육부 「디지털 교육 규범(시안)」(2024.3.27): 시안 단계 자료입니다. 최종본 여부는 확인하지 못했습니다.",
          "CCL(크리에이티브 커먼즈 라이선스) 구성 요소: ==저작자 표시(BY), 비영리(NC), 변경 금지(ND), 동일 조건 변경 허락(SA)==. 조합에 따라 허용 범위가 달라진다.",
          "수업 자료: 한국저작권위원회 저작권 교육 시스템, 개인정보보호위원회 개인정보 배움터(아동·청소년 과정)."
        ],
        sources: [CURR, { label: "교육부: 교육분야 인공지능 윤리원칙", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&lev=0&statusYN=W&s=moe&m=020402&opType=N&boardSeq=92297" }, { label: "교육부: 디지털 교육 규범(시안)", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=98477&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N" }, { label: "한국저작권위원회 저작권 교육", url: "https://www.copyright.or.kr/offedu/web/main/mainPage.do" }, { label: "개인정보 배움터", url: "https://edu.privacy.go.kr/" }],
        practice: P.ethics
      }
    ],
    libraryNote: "모두 직접 열어 확인한 자료입니다. 파일을 이 앱에 복사해 두지 않고 원래 발행 기관의 주소로 연결합니다. 공식 문서가 개정되면 원문이 바로 반영되고, 저작권 문제도 생기지 않기 때문입니다.",
    library: [
      { title: "2022 개정 정보과 교육과정 원문 PDF ([별책 10], 제2022-33호)", url: "https://ncic.re.kr/inv/org/download.do?year=2022&seq=10004240&orgType=ogi4", org: "교육부·NCIC", year: 2022, use: "성취기준, 내용 체계, 교수·학습 및 평가 방향의 원문" },
      { title: "NCIC 원문 인벤토리 (중·고 정보, 총론, 총론 해설)", url: "https://ncic.re.kr/inv/org/list.do", org: "국가교육과정정보센터", year: 2026, use: "교육과정 원문과 총론 해설서 열람" },
      { title: "2015 개정 정보과 교육과정 PDF (제2015-74호)", url: "https://ncic.re.kr/inv/org/download.do?year=2015&seq=10003028&orgType=ogi4", org: "교육부·NCIC", year: 2015, use: "개정 비교 문항 대비" },
      { title: "2022 개정 중·고 정보과 성취수준 및 연구보고서 (CRC 2024-22)", url: "https://ncic.re.kr/bbs/download.do?articleIdx=774&fileName=1725499655442.pdf", org: "한국교육과정평가원", year: 2024, use: "평가 방향, 성취수준, 평가 도구 개발 절차와 예시. 사실상 무료 교과교육론 교재" },
      { title: "2022 개정 중학교 정보과 성취수준 (PDF)", url: "https://ncic.re.kr/bbs/download.do?articleIdx=774&fileName=1725499748614.pdf", org: "한국교육과정평가원", year: 2024, use: "성취기준별 성취수준 진술 예시" },
      { title: "SW교육 교수학습 모델 개발 연구 (CR 2015-35)", url: "https://edpolicy.kedi.re.kr/cmm/fileDownload.do?nTbBoardArticleFileSeq=10358", org: "한국교육개발원·KERIS", year: 2015, use: "DMM·UMC·DDD·NDIS·DPAA(P) 다섯 모형과 CT 정의, 부록 수업 자료" },
      { title: "표시과목별 교사 자격 기준과 평가 영역 및 평가 내용 요소 (정보·컴퓨터)", url: "https://www.kice.re.kr/boardCnts/view.do?boardID=10011&boardSeq=2126283&lev=0&m=040108&s=kice", org: "한국교육과정평가원·한국컴퓨터교육학회", year: 2016, use: "출제 범위의 공식 기준. 첨부 zip의 ‘5.정보컴퓨터.pdf’" },
      { title: "교원임용시험 기출 게시판", url: "https://www.kice.re.kr/boardCnts/list.do?boardID=1500212&m=030306&s=kice&searchType=S&searchStr=%EC%BB%B4%ED%93%A8%ED%84%B0", org: "한국교육과정평가원", year: 2026, use: "정보·컴퓨터 전공A·B 문제지 (2014학년도 이후 정답 비공개)" },
      { title: "2022 개정 교육과정 확정·발표 보도자료", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=93459&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N", org: "교육부", year: 2022, use: "총론 핵심(기초소양, 학교자율시간)" },
      { title: "디지털 인재양성 종합방안", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=92346&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=020402&opType=N", org: "교육부", year: 2022, use: "정보 시수 확대 정책 근거" },
      { title: "모두를 위한 AI 인재양성 방안", url: "https://www.korea.kr/briefing/policyBriefingView.do?newsId=156727284", org: "교육부(정책브리핑)", year: 2025, use: "최신 AI 교육 정책, 2차 면접 대비" },
      { title: "교육분야 인공지능 윤리원칙", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&lev=0&statusYN=W&s=moe&m=020402&opType=N&boardSeq=92297", org: "교육부", year: 2022, use: "AI 윤리 수업·면접" },
      { title: "Computational Thinking (Wing, CACM 49(3))", url: "https://www.cs.cmu.edu/~15110-s13/Wing06-ct.pdf", org: "Communications of the ACM", year: 2006, use: "CT 개념의 출발점" },
      { title: "Using PRIMM to structure programming lessons", url: "https://static.raspberrypi.org/files/curriculum/quickreads/11-Pedagogy_Summary_PRIMM_V4_2023.pdf", org: "Raspberry Pi Foundation", year: 2023, use: "PRIMM 단계와 수업 예시" },
      { title: "CS Unplugged", url: "https://www.csunplugged.org/en/", org: "캔터베리대 CSERG", year: "", use: "언플러그드 활동 자료(CC BY-SA)" },
      { title: "CSTA PK–12 CS Standards (2026판)", url: "https://csteachers.org/k12standards/", org: "CSTA", year: 2026, use: "국제 비교 참고" },
      { title: "K–12 Computer Science Framework", url: "https://k12cs.org/", org: "ACM·Code.org·CSTA 외", year: 2016, use: "국제 비교 참고" },
      { title: "정보소프트웨어 교육방법 (KOCW)", url: "http://www.kocw.net/home/cview.do?cid=3281d688b9eea95a", org: "고려사이버대", year: "", use: "무료 교과교육론 강의" },
      { title: "컴퓨터교재연구 및 지도법 (KOCW)", url: "http://www.kocw.net/home/cview.do?cid=696239", org: "성균관대", year: 2012, use: "무료 교과교육론 강의" },
      { title: "2022 개정 ‘알고리즘과 프로그래밍’ 단계별 학습 요소 (김자미)", url: "https://koreascience.or.kr/article/JAKO202415036521152.pdf", org: "인터넷정보학회논문지", year: 2024, use: "2022 개정 프로그래밍 영역 내용 분석" },
      { title: "언플러그드 활동 국내외 연구 비교 (강두봉)", url: "https://www.koreascience.or.kr/article/JAKO201926072347983.page", org: "컴퓨터교육학회논문지", year: 2019, use: "언플러그드 연구 동향" }
    ]
  };
})();
