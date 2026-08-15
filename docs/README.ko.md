# BCOS

BCOS는 Claude Code와 Codex 같은 AI 코딩 도구가 Task, Report, Review, Git 기록을 기준으로
협업하도록 만드는 Git 기반 개발 운영 도구다.

지금은 실험 단계다. 프로토콜 버전은 `0.1`이고 호환성을 약속하지 않는다.

영문 문서가 공식 진입점이다 — [README.md](../README.md)

---

## BCOS를 만든 이유

AI에게 코드를 짜게 하는 것과, AI가 참여하는 프로젝트의 상태를 관리하는 것은 다른 문제다.
전자는 이미 잘 된다. 후자가 잘 안 된다.

이 프로젝트도 그 문제를 직접 겪었다.

첫 두 개의 작업(T-001, T-002)에서 구현은 성공했고 리뷰도 통과했다. 그런데 두 번 모두
**상태 전이 기록이 누락됐다.** Task 파일은 `TODO`인 채로 남았고, 이벤트 로그는 비어 있었고,
상태 인덱스는 낡은 값이었다. 나중에 손으로 되돌려야 했다.

원인을 따져보니 Worker의 성능 문제가 아니었다. 전이 하나를 기록하려면 사람이 파일 세 개를
각각 열어 고쳐야 했고, 두 번 다 그중 일부를 잊었을 뿐이다. **절차를 강제하는 도구가 없었다.**

BCOS는 이 반복된 결함에서 출발했다. 그래서 목표가 "AI를 더 똑똑하게"가 아니라
"프로젝트 상태를 저장소가 소유하게"다.

## 어떻게 동작하나

```
사람이 목표 결정
→ Claude Code가 Task 설계
→ Codex가 구현하고 Report 작성
→ Claude Code가 독립 Review
→ BCOS가 상태와 이벤트 관리
→ 사람이 최종 승인
```

여기서 중요한 규칙이 하나 있다. **제출한 주체는 승인할 수 없다.** 승인을 수행하는
`actor_id`는 해당 시도를 제출한 `actor_id`와 달라야 한다. 구현한 쪽이 스스로 완료를
선언할 수 있으면 리뷰 단계가 형식만 남기 때문이다.

`start`부터 `approve`까지가 이제 `task execute --review` 한 명령으로 이어진다.
Reviewer가 자동으로 실행되고 판정에 따라 승인하거나 작업을 되돌린다.
**다만 판정을 읽지 못하면 절대 승인하지 않고 사람에게 넘긴다.**
Task 설계와 commit은 여전히 사람이 한다.

## ClawDev와 무엇이 다른가

BCOS 이전에 ClawDev라는 실험을 했다. 역할별로 Agent 인스턴스를 따로 두는 방식이었고,
동작은 했다. 다만 역할을 하나 늘릴 때마다 Agent와 시스템 프롬프트, 그리고 API 비용이
같이 늘었다.

BCOS는 역할 분리라는 아이디어는 그대로 가져오고, 역할이 Agent에 묶여 있던 부분만 끊었다.

| | ClawDev | BCOS |
|---|---|---|
| 역할이 있는 곳 | Agent 인스턴스 | Task Contract |
| 역할을 추가하는 비용 | Agent + 프롬프트 + API 비용 | 문서 한 장 |
| 상태가 있는 곳 | Agent의 대화 이력 | Git 아티팩트 |
| 방향 | Agent가 Task를 받는다 | Task가 Worker를 정의한다 |

같은 Codex 실행기라도 어떤 Task를 받았느냐에 따라 백엔드 Worker가 되기도 하고 테스트
Worker가 되기도 한다. 세션에는 기억을 남기지 않으므로 언제 종료해도 잃는 것이 없다.

근거는 [ADR-003](decisions/ADR-003-task-centric-workers.md)에 정리해 두었다.

## 현재 구현된 기능

- `--version`, `--help`, 알 수 없는 인자에 대한 오류 처리
- `bcos task start <id> --actor-role <role> --actor-id <id>` — `TODO → IN_PROGRESS`
- `bcos task submit <id> --actor-role <role> --actor-id <id>` — `IN_PROGRESS → IMPLEMENTED`
- `bcos task approve <id> --actor-role <role> --actor-id <id>` — `IMPLEMENTED → DONE`
- 세 명령 모두 Task frontmatter, 이벤트 로그, 상태 인덱스를 한 번에 갱신한다
- 쓰기를 시작하기 전에 lifecycle guard를 먼저 검사한다
- **`submit`은 현재 attempt의 Report가 있어야만 통과한다.** 증거 없는 제출을 도구가 막는다
- **`approve`는 현재 attempt의 Review 판정이 `APPROVED`여야 하고, 승인하는 `actor_id`가
  그 attempt를 제출한 `actor_id`와 달라야 한다.** 제출자가 자기 작업을 승인하려 하면 거부되고
  파일은 하나도 바뀌지 않는다
- 거부된 전이는 파일을 하나도 바꾸지 않는다 — 실패 경로 11종에서 확인했다
- `bcos task context <id>` — Task의 Read List에 적힌 파일들을 하나의 패키지로 묶어
  stdout에 출력한다. **같은 입력이면 같은 바이트가 나온다.** 타임스탬프를 넣지 않고,
  중복을 제거하며, 기재 순서를 그대로 유지한다
- 저장소 밖 경로·바이너리·과대 파일·자격증명처럼 보이는 파일명은 거부한다.
  거부되면 stdout에 한 바이트도 나오지 않는다
- `bcos task run <id> --worker codex` — 고정 preamble과 Context Package를 하나의
  결정론적 입력으로 조립해 Codex 프로세스의 stdin에 넣는다. **사람이 복사하지 않는다.**
  `--dry-run`은 프로세스를 띄우지 않고 command·args·해시만 출력하며 **입력 본문은
  출력하지 않는다.** `shell: false`로 실행하고 **Task ID를 `argv`에 넣지 않아**
  ID에 셸 메타문자가 들어와도 실행되지 않는다
- **Runner는 lifecycle을 소유하지 않는다.** `start`·`submit`·`approve`를 대신 실행하지
  않고, Worker 출력을 해석하지 않으며, 성공·실패·timeout 어느 경로에서도
  `events.jsonl`을 바꾸지 않는다
- **Task마다 프롬프트를 손으로 쓰지 않는다.** Runner가 고정 preamble에 값 세 개
  (Task ID·worker·Report 경로)만 채워 Context Package와 함께 보낸다. Task 문서가
  계약 전부이고 그것이 이미 패키지 안에 있으므로, Task별 프롬프트 파일은 worker가
  이미 받은 문서의 요약본이었을 뿐이다. 서로 다른 두 Task의 preamble은 그 값 줄
  외에는 글자 하나도 다르지 않다
- Read List에 자기 Task 파일이 없으면 실행을 거부하고 **빠진 경로를 출력한다.**
  없으면 worker에게 계약이 전달되지 않는다
- `task run` 기본 timeout은 1,800초다. `--timeout`으로 덮어쓰며 0·음수·소수·비숫자는
  **기본값으로 조용히 대체되지 않고 거부된다**
- `telemetry <key>=<value>` 형식의 원시 측정값을 stdout에 출력한다 — Context·stdin
  식별, 설정된 timeout, worker 첫 응답, 소요 시간, 종료 코드, timeout 여부, 바이트 수.
  **측정만 한다** — 비율·개선율을 어디서도 계산하지 않고, dry-run은 실행 관련 필드를
  0으로 채우는 대신 아예 출력하지 않는다
- `bcos task execute <id> --worker codex --actor-id <id>` — `start`·worker 실행·검증·
  `submit`을 **한 명령으로** 수행하고 `IMPLEMENTED`에서 멈춘다. `TODO`면 처음부터,
  `IN_PROGRESS`면 start 없이 재개하며, `--verify-only`는 검증만 다시 돌릴 때 worker를
  아예 띄우지 않는다
- **제출 여부를 검증 결과가 결정한다.** Orchestrator가 host에서 `package.json`의 test
  스크립트를 돌리고 exit이 0이 아니면 제출하지 않는다. Task는 `IN_PROGRESS`로,
  Report는 그대로 남는다. **worker가 자기 작업을 검증됐다고 선언하지 못한다**
- **BCOS가 띄운 worker 안에서는 workflow를 돌릴 수 없다.** `task run`이 자식에게
  `BCOS_WORKER_SESSION`을 찍고 `task execute`가 그것을 보면 거부한다. 별도로
  Orchestrator는 아무것도 하기 전에 빈 프로세스를 한 번 띄워본다 — 자식 생성이 막혀
  있으면 거기서 멈추며 Task 파일·이벤트 로그·worker 어느 것도 건드리지 않는다
- `bcos task request-changes <id> --actor-role <role> --actor-id <id>` — RFC-001이
  규정한 `IMPLEMENTED → IN_PROGRESS` 전이. G4·G5로 보호되고 `TASK_CHANGES_REQUESTED`를
  남긴다. 현재 attempt의 Review 판정이 `CHANGES_REQUESTED`여야 하고, 되돌아가면서
  attempt가 올라간다 — 그래서 **`attempt ≥ 2`는 재작업이 있었다는 뜻이다.**
  **일곱 전이 중 넷이 명령이 됐다**
- `task execute --review --reviewer claude --reviewer-actor-id <id>` — submit 뒤에
  reviewer를 실행하고 판정에 따라 움직인다. `APPROVED`면 승인하고,
  `CHANGES_REQUESTED`면 작업을 되돌린 뒤 worker·검증·리뷰를 다시 돈다.
  **reviewer actor는 worker actor와 달라야 하며 시작 전에 검사한다**
- **판정을 읽지 못하면 절대 승인하지 않는다.** 판정 불가·`BLOCKED`·reviewer 실패·
  cycle 소진·재검증 실패는 전부 멈추고 **어디서 멈췄는지·Task 상태·마지막 판정·
  Review 경로·사람이 할 일**을 출력한다. cycle 기본값은 2다
- 재작업은 Review를 worker에게 되돌려 준다. **두 번째 attempt부터 이전 Review 전문이
  worker 입력에 붙는다.** 대화 기록도, 저장소 재탐색도, 손으로 쓴 프롬프트도 없다 —
  Task 계약과 `AGENTS.md`, 결정론적 산출물이 인수인계의 전부다
- **workflow 실행마다 `.bcos/runs/` 에 기록이 남는다.** 실행당 작은 JSON 하나이고,
  파일명에 밀리초 타임스탬프가 들어가 **정렬이 곧 시간순**이다. 각 단계가 어디까지
  갔는지·언제 시작하고 마지막으로 바뀌었는지·어떻게 끝났는지만 담는다 —
  절대경로도, command line도, 프롬프트도, Context도, 출력 전문도 저장하지 않는다
- `bcos task status <id>` — 그 Task의 최신 실행을 읽어 execution id·attempt·
  workflow 상태·단계별 결과·시각·종료 사유·마지막 lifecycle 이벤트를 출력한다.
  `--execution <id>` 로 특정 실행을 본다. **아무것도 쓰지 않는다**
- **BCOS가 끝을 보지 못한 실행은 `running` 으로 남는다.** 절대 `failed` 로 바꾸지 않고
  `interrupted`·`unknown` 도 저장하지 않는다 — 그건 추측이기 때문이다. 대신 조회할 때
  `Completed: not observed` 라고 말한다. **살아 있다고도 주장하지 않는다**
- **실행 기록은 lifecycle 상태를 소유하지 않는다.** Task가 `IMPLEMENTED` 인데 마지막
  실행은 `failed` 일 수 있고, 둘 다 서로 다른 것에 대해 참이다. Task 상태는 그대로
  `tasks/*.md` 에 있고, 기록기는 `events.jsonl` 에도 `state.json` 에도 쓰지 않는다
- **검증 실패는 다음 worker에게 전달된다.** 실행 기록이 검증 exit code와 출력의
  마지막 2,048바이트를 보관하고, 같은 Task를 재개한 worker는 논리 명령 이름·exit code·
  그 발췌를 입력 끝에서 받는다. 사람이 실패 원인을 다시 설명하지 않아도 된다.
  출력은 예전처럼 터미널로 계속 흐르며, 발췌는 저장된 로그가 아니라 한정된 꼬리다
- **고쳐진 실패는 더 이상 전달되지 않는다.** 실제로 검증에 도달한 가장 최근 실행을
  보므로, 이후 실행이 통과하면 옛 실패는 붙지 않는다. **삭제하지는 않는다** —
  실패 기록은 `.bcos/runs/` 에 그대로 남는다
- 발췌의 저장소 루트·홈 경로는 `<root>` · `<home>` 으로 치환된다.
  **경로 두 건 치환일 뿐 비식별화가 아니다** — 그 밖의 내용은 그대로 실린다.
  전달할 실패가 없으면 worker 입력은 이 기능이 생기기 전과 **바이트 단위로 같다**
- Model Adapter는 기본 `codex`와 선택 가능한 `claude` worker를 지원한다. 기본 운영
  정책은 Claude Manager/Reviewer + Codex Worker이며, `--worker claude`는 기본값이 아니다
- workflow telemetry는 Run과 Benchmark 아티팩트에 저장된다. T-016은 비교 가능한
  증거를 기록하는 measurement harness이며 controlled trial 결과는 아니다
- 상태 전이 테스트는 임시 디렉터리에서만 실행되며 저장소의 실제 `.bcos/`를 건드리지 않는다
- 모든 작업에 대해 Report, Review, Benchmark 기록을 남긴다

## 아직 구현하지 않은 기능

일곱 전이 중 넷이 자동화됐다 — `start`·`submit`·`approve`·`request-changes`.
`block`·`unblock`은 아직 명령이 없다.

`actor_id`는 자기 신고 값이므로 SoD는 신뢰 환경을 전제한다. 다른 문자열을 넣으면
통과한다. 인증은 프로토콜 `0.1`의 알려진 한계이며 별도 RFC의 대상이다.

**`task run`이 실제 Codex를 한 번 돌렸다.** T-009는 BCOS가 직접 띄운 Codex 프로세스가
구현했다 — 붙여넣은 프롬프트 0, 복사한 Context 0, 약 359초 만에 exit 0. **한 번의
관측이지 성공률이 아니다.** 테스트는 여전히 전부 가짜 worker를 쓴다. 토큰을 쓰거나
네트워크에 나가지 않게 하려는 의도적 선택이다.

그 실행이 남긴 실패도 함께 기록한다. Codex는 자기 샌드박스 안에서 자식 프로세스를
띄우지 못해(`spawn EPERM`) worker의 `npm test`가 실행되지 않았다. 다음 작업에서도
같은 일이 일어났고, 그때는 host 실행이 실제 결함을 찾아냈다.

T-010이 이 문제에 답했지만 감지로 답한 것은 아니다. worker가 `npm test`를 직접
실행하는 것은 BCOS가 막을 수 없다. 달라진 것은 **`task execute`가 검증을 host에서
돌린다**는 점이다 — 자기를 검증하지 못하는 worker가 자기 작업의 제출 여부를 정하지
못하게 됐다. 중첩 guard와 spawn probe는 workflow 명령 자체가 worker 안에서 실행되는
더 좁은 경우를 막는다.

**Report가 스스로 실패를 선언해도 `submit`은 통과한다** — 가드가 Report의 존재만
검사하고 내용은 보지 않기 때문이다. 달라진 것은 그 뒤에 자동 Reviewer가 서고,
RFC-001이 **증거 없는 완료 주장을 `CHANGES_REQUESTED`로 판정하라고 요구한다는** 점이다.

**이제 한 명령이 Task를 `TODO`에서 `DONE`까지 끌고 갈 수 있다.** Task 설계와 commit은
여전히 사람이 하고, 실행을 시작할지 결정하는 것도 사람이다.

**다만 `task execute --review`를 실제 Claude reviewer로 돌려본 적은 아직 없다.**
검증은 전부 가짜 reviewer로 했고, T-011 자신의 Review도 사람이 했다.

`task create`·`list`·`show`·`block`·`unblock`, 새 프로젝트에 `.bcos/` 구조를 만드는
`init`, project-global `status`, `reindex`는 아직 없다. `actor_id`는 자기 신고이며,
직접 token 값은 `unavailable`일 수 있다. same-attempt Report append semantics도 완전히
정해지지 않았다. T-016은 harness일 뿐 controlled result가 아니고, canonical case와
공통 evaluation gate도 아직 없다.

구현 시점은 약속하지 않는다. 필요가 확인된 순서대로 만든다.

## T-001부터 T-012까지의 역사적 기준선

첫 열두 개 작업이 프로토콜 전 과정을 통과한 기록이다. 이후 Core Task의 현재 기능은
위의 "현재 구현된 기능"에 반영하고, 이 표는 당시의 역사적 기준선으로 보존한다.

| | 한 일 | AC | 테스트 |
|---|---|---:|---:|
| **T-001** | CLI 골격 구성 | 9/9 | 3/3 |
| **T-002** | Node 지원 버전 선언을 실제 검증 범위에 맞춤 | 11/11 | 3/3 |
| **T-003** | `task start` 자동화 | 15/15 | 11/11 |
| **T-005** | 정상 Markdown을 거부하던 검증 버그 수정 | 18/18 | 23/23 |
| **T-004** | `task submit` 자동화 | 16/16 | 31/31 |
| **T-006** | `task approve` 자동화, SoD를 코드로 강제 | 24/24 | 46/46 |
| **T-007** | `task context` — 결정론적 Context Package 생성 | 32/32 | 66/66 |
| **T-008** | `task run` — 조립한 입력을 Worker stdin으로 전달 | 46/46 | 90/90 |
| **T-009** | 손으로 쓰던 Worker Prompt 제거 + Telemetry 정의 | 62/62 | 99/99 |
| **T-010** | `task execute` — start·run·검증·submit을 한 명령으로 | 87/87 | 129/129 |
| **T-011** | reviewer 자동 실행·판정 처리·재작업 loop | 94/94 | 156/156 |
| **T-012** | 실행 기록 저장 + `task status` 조회 | 87/87 | 186/186 |

세 전이 작업은 자동화한 대상을 직접 측정했다. 전이 한 건을 완료하는 데 사람이 편집해야
하는 파일이 **3개에서 0개로** 바뀌었고, 수동 단계는 `start`가 6→1, `submit`이 5→1,
`approve`가 5→1로 줄었다. 실패 경로에서 **부분 쓰기는 한 건도 관측되지 않았다**
(`start` 5종, `submit` 6종, `approve` 11종).

T-008은 전이 대신 **전달**을 측정했다. Context를 Worker에게 넘기는 사람의 단계가
**2에서 1로** 줄었고, 실패 15종에서 부분 쓰기가 0건이었으며, Runner가 일으킨 lifecycle
전이는 **0건**이었다. Reviewer는 worker 테스트를 믿지 않고 자체 fixture로 88개 항목을
독립 검증했고, `PATH`에서 Codex 진입점을 제거한 뒤 테스트를 다시 돌려 90개가 그대로
통과하는 것으로 **실제 Codex 미호출**을 확인했다.

T-004부터는 전이가 **사후 복구 없이 실제 실행 시각으로 기록**된다. 그 이전 네 작업은
기록을 나중에 손으로 채워 넣어야 했다.

**T-006이 가장 중요한 전환점이다.** 그때까지 "제출한 주체는 승인할 수 없다"는 규칙은
문서에 적힌 약속이었고 사람이 지켰다. 이제 도구가 거부한다.

**마지막 두 작업이 재작업을 거쳤고 원인이 같다** — worker가 자기 샌드박스 안에서
테스트를 실행하지 못해 host 실행이 첫 검증이 됐다. T-009에서는 낡은 assertion 세 개가,
T-010에서는 **실제 결함**이 드러났다. 자식 생성이 막힌 환경에서 probe가 던져진 예외를
놓쳐 telemetry가 한 줄도 나오지 않는 결함이었다. **T-010의 host 검증이 잡으려던 것이
바로 이 패턴이다.**

T-010은 사람이 입력하는 명령을 **4개에서 1개로** 바꿨다. `task start`·`task run`·
`npm test`·`task submit`이 `task execute` 하나가 됐다. Reviewer는 가짜 worker와 가짜
검증기가 **실행되면 마커 파일을 남기도록** 만들어, "실행되지 않았다"를 결과가 아니라
흔적으로 확인했다 — 중첩 거부와 probe 거부 경로에서 마커가 하나도 생기지 않았다.

**T-011은 BCOS가 스스로 끌고 간 첫 작업이다.** `task execute` 한 번이 start·worker
실행·host 검증·submit을 전부 수행했다. 사람이 친 BCOS 명령은 **하나**였다.

그 실행에서 worker는 또 자기 샌드박스 안에서 테스트를 돌리지 못했다 — **세 작업
연속이다.** worker는 그 사실을 Report에 적고 완료를 주장하지 않았다. 그런데 host에서
돌린 결과는 **156개 전부 통과**였고, 그것이 submit을 정당화했다. **host 검증을 둔
이유가 바로 이 상황이다.**

**T-012는 실행 기록을 남기기 시작했다.** 실행마다 612바이트짜리 기록이 생기고 `task status` 하나로 읽힌다. 강제로 죽여도 `running` 이 유지되고 `interrupted`·`unknown` 을 지어내지 않는다.

열두 작업 모두 한 번의 시도로 승인됐고, 범위 이탈과 과설계 위반은 0건이었다.

다만 이 수치들을 생산성 향상률로 환산하지는 않는다. 열두 작업은 성격이 전부 다르고
비교군이 없다. 위 단계 수는 관찰된 절대값일 뿐이다.

## 직접 실행해 보기

Node.js 24 이상이 필요하다. 런타임 의존성은 없다.

```bash
npm install
```
```bash
npm run build
```
```bash
npm test
```
```bash
node dist/cli.js --version
```
```bash
node dist/cli.js --help
```
```bash
node dist/cli.js task context T-007
```

`task run`은 `IN_PROGRESS` Task가 필요한데 이 저장소는 전부 `DONE`이라 실행할 대상이
없다. 아래는 그대로 붙여넣는 명령이 아니라 자기 Task에 쓰는 형식이다. `--dry-run`은
프로세스를 띄우지 않고 command·args·해시만 출력한다.

```
node dist/cli.js task run <IN_PROGRESS인 Task ID> --worker codex --dry-run
```

`task` 명령들은 현재 작업 디렉터리의 `.bcos/`를 대상으로 동작한다. 이 저장소에는
`.bcos/tasks/`, `.bcos/events.jsonl`, `.bcos/state.json`이 이미 있어서 바로 실행되지만,
아직 `init` 명령이 없으므로 **새 프로젝트에서는 이 구조를 직접 만들어야 한다.**
`.bcos/tasks/`·`reports/`·`reviews/`·`runs/`, 빈 `events.jsonl`, protocol·counts·
`current_task`를 담은 `state.json`, `AGENTS.md`, 그리고 자기 Task와 허용 파일을 Read
List에 넣은 Task 계약을 만든다. 그 프로젝트를 cwd로 두고 현재 build의 절대경로로 다음을
실행한다.

```text
node <BCOS 경로>/dist/cli.js task context T-001
node <BCOS 경로>/dist/cli.js task start T-001 --actor-role worker --actor-id codex-cli
node <BCOS 경로>/dist/cli.js task run T-001 --worker codex --dry-run
node <BCOS 경로>/dist/cli.js task status T-001
```

`--dry-run`이므로 model process와 network 호출은 없다.

## 프로젝트 구조

```
.bcos/tasks/          Task 명세. 단일 진실 원천
.bcos/reports/        Worker가 쓰는 구현 보고서
.bcos/reviews/        Reviewer가 쓰는 검토 기록
.bcos/events.jsonl    상태 변경 이력. 추가만 가능
.bcos/state.json      Task 파일에서 다시 만들 수 있는 파생 인덱스
docs/rfcs/            프로토콜 명세
docs/decisions/       설계 결정 기록
docs/benchmarks/      작업별 측정값
src/                  CLI 구현
```

## 관련 문서

| 문서 | 내용 |
|---|---|
| [RFC-001 Core](rfcs/RFC-001-task-protocol.md) | 프로토콜 규범. Task·Report·Review·Event 규격 |
| [RFC-001 Appendix](rfcs/RFC-001-task-protocol-appendix.md) | 설계 근거와 엣지 케이스. 규범 아님 |
| [Vision](vision.md) | 문제 정의와 원칙, 단계별 계획 |
| [Architecture](architecture.md) | 저장소 배치와 실행 환경 제약 |
| [ADR-001](decisions/ADR-001-language.md) | Node.js를 고르고 런타임 의존성을 두지 않은 이유 |
| [ADR-002](decisions/ADR-002-storage.md) | SQLite 대신 텍스트 파일을 쓰는 이유 |
| [ADR-003](decisions/ADR-003-task-centric-workers.md) | 역할을 Task에 두는 이유 |
| [Git Convention](git-convention.md) | 커밋 규약 |
| [Telemetry](benchmarks/TELEMETRY.md) | 세 arm 공통 측정 계약. 필드 118개 |

## 앞으로의 방향

핵심 세 전이, Context 생성, Worker 실행, 프롬프트 제거, workflow 묶기,
reviewer·재작업 loop, 실행 관측, Model Adapter 경계, 검증 실패 피드백까지 끝났다.

| | |
|---|---|
| **Role-based Task Templates** | 실제 역할 사례가 생긴 뒤 재사용 기본값 제공 |
| **Worktree Parallelism** | 필요가 입증된 뒤 격리된 병렬 worker 지원 |
| **Controlled Benchmark** | canonical case와 공통 evaluation gate를 먼저 정의 |

T-014로 검증 실패가 다음 worker에게 전달되고, `request-changes`도 구현됐다. T-013은
Model Adapter 경계를, T-016은 telemetry persistence와 measurement harness를 추가했다.
Core는 외부 dogfood가 가능한 상태지만 새 프로젝트 부트스트랩은 수동이다.

## 기여하기

[CONTRIBUTING.md](../CONTRIBUTING.md)를 참고한다. 아직 실험 단계라 프로토콜이 예고 없이
바뀔 수 있다.

## 라이선스

[MIT License](../LICENSE)
