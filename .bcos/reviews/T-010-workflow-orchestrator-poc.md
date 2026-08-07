---
task: T-010
---

# Review — T-010

## Attempt 1 — 2026-08-07T06:02:56Z — APPROVED

### Verification Method

Worker Report를 신뢰하지 않고 Reviewer 자신의 fixture를 만들어 독립 검증했다.
`os.tmpdir()` 아래에 저장소 fixture와 가짜 worker·가짜 검증기를 만들고, **둘 다
실행되면 마커 파일을 남기게 해서** "실행되지 않았다"를 결과가 아니라 흔적으로 확인했다.
**83개 항목을 검증했고 전부 통과했다.**

`npm run build`와 `npm test`도 직접 실행했고, `PATH`에서 Codex 진입점을 제거한 뒤
한 번 더 돌렸다.

### Lifecycle

| | |
|---|---|
| `TASK_STARTED` | `2026-08-07T05:19:15.716Z` — worker / codex-cli |
| `TASK_SUBMITTED` | `2026-08-07T05:55:22.769Z` — worker / codex-cli |

**사후 복구 흔적이 없다.** 밀리초가 `.716` / `.769`로 임의값이고 간격이 36분 7초다.
`.001`/`.002` 패턴이 아니며 순서와 시각이 자연스럽다. **여섯 Task 연속 실시간 기록이다.**

`status: IMPLEMENTED` · `attempt: 1` · `current_task: null` ·
`counts.IMPLEMENTED: 1` · `counts.DONE: 9`. 두 이벤트를 수정하지 않았다.

### 독립 build / test

**`npm run build` exit 0. `npm test` 129 tests / 129 pass / 0 fail, exit 0.**
Worker의 재작업 후 보고와 일치한다.

`PATH`에서 `@openai/codex/bin/codex.js`를 포함한 디렉터리를 전부 제거하고 다시 돌려도
**129/129 pass** — 어떤 테스트도 실제 Codex에 의존하지 않는다.

### Workflow 검증 — 83 / 83

**정상 흐름 (20/20)**

`TODO` → `start` → `run` → 검증 → `submit` 이 실제로 순서대로 일어났다.
최종 `IMPLEMENTED`, 이벤트가 정확히 `["TASK_STARTED", "TASK_SUBMITTED"]`,
`TASK_APPROVED` **0건**, `attempt` 1, 두 이벤트의 `actor_id`가 `--actor-id` 값과 일치.

`workflow_exit_reason=success` · `lifecycle_transitions_caused=2` ·
`runner_invocations=1` · `verification_runs=1` · `verification_exit_code=0` ·
`verification_command=custom-verifier`.

**worker와 verifier 둘 다 마커 파일을 남겼다** — 실제로 실행됐다.
verifier의 stdout·stderr가 부모로 전달됐다.

**`task run` 이 자식에게 `BCOS_WORKER_SESSION=1` 을 전달한다** — 가짜 worker가 그 값을
파일에 적어 직접 확인했다.

**nested worker guard (8/8)**

`BCOS_WORKER_SESSION=1` 로 실행하니 exit 1, `workflow_exit_reason=nested_worker`,
`nested_worker_detected=true`, 메시지가 host shell 실행을 안내했다.
**`.bcos/` 해시 동일, worker·verifier 마커 파일 없음, `runner_invocations=0`,
`lifecycle_transitions_caused=0`.**

**capability probe (6/6)**

Node 권한 모델(`--permission --allow-fs-read=* --allow-fs-write=*`)로 자식 생성을
막고 실행했다. exit 1, **`workflow_exit_reason=environment`**, worker·verifier 미실행,
`.bcos/` 무변경, `verification_exit_code` **미출력**(0으로 채우지 않았다).

이것이 재작업으로 고쳐진 지점이다. 권한 모델에서 `spawnSync`는 **예외를 던지고**
`{ error }`를 반환하지 않는데, 원래 코드는 반환값만 검사해 예외가 `executeWorkflow`를
빠져나갔다. exit 1은 나왔지만 telemetry가 한 줄도 나오지 않았다. try/catch 추가로
해결됐고 **Reviewer가 같은 조건을 재현해 확인했다.**

**verification gate (8/8)**

검증 exit ≠ 0 → exit 1, `workflow_exit_reason=verification`, **`submit` 0건**,
`IN_PROGRESS` 유지, `TASK_STARTED` 1건 그대로, **Report 파일 보존**,
`verification_exit_code=1`, `lifecycle_transitions_caused=1`.

**T-009에서 실제로 일어난 96/99 상황이면 제출되지 않는다.**

**worker 실패 / timeout (7/7)**

worker exit 3 → `worker_nonzero`, submit 0건, `IN_PROGRESS` 유지, **verifier 미실행**.
`--timeout 1` + 10초 worker → `timeout`, submit 0건.

**`--verify-only` / 재개 (11/11)**

`--verify-only` 는 **worker 마커 파일을 남기지 않았고** `runner_invocations=0` 이었다.
verifier만 돌고 `submit` 이 수행돼 `IMPLEMENTED` 가 됐으며 `TASK_STARTED` 는 1건 그대로다.
`TODO` 에서는 거부, Report 없으면 `protocol` 로 거부.

`IN_PROGRESS` 재개에서 `start` 를 건너뛰어 `TASK_STARTED` 가 늘지 않았고
`lifecycle_transitions_caused=1` 이었다. `DONE` 같은 종료 상태는 거부됐다.

**Report·설정·옵션 (10/10)**

Report 없음 → `protocol`, **검증기 미실행**. `scripts.test` 없음 → `protocol`,
`verification_command` 미출력. `--worker`·`--actor-id` 누락, allow list 위반,
알 수 없는 옵션 전부 exit 1. `--help` 에 `execute` 포함.

**Telemetry 개인정보** — 성공 경로 telemetry 줄 전체에 **절대경로가 없다.**
`verification_command` 가 `custom-verifier` 논리 값으로 나왔다.

### Regression — 13 / 13

`start` 정상·실패 · `submit` 정상·**G3 거부** · `approve` 정상·**G4 거부**·
**G5(SoD) 거부** · `context` 정상·실패(stdout 0바이트) · `task run` dry-run 정상·실패 ·
`--version` · unknown argument. **T-001~T-009 기능이 하나도 깨지지 않았다.**

### TELEMETRY.md

**84 → 96.** 필드 행 13개가 추가됐고 그중 키는 12개다 —
요구된 11개(`workflow_started_at` · `workflow_completed_at` · `workflow_duration_ms` ·
`workflow_exit_reason` · `nested_worker_detected` · `verification_command` ·
`verification_exit_code` · `verification_duration_ms` · `verification_runs` ·
`runner_invocations` · `lifecycle_transitions_caused`)와 **AC 70이 요구한
`workflow_resume_count`(blocked)** 다.

**기존 84개에서 삭제된 줄이 0줄이다.** 공정성 6문제·공개 지표·human 한계·절대 규칙
어느 절도 수정되지 않았다. **계산 필드 정의 0건.** 새 절 첫머리에 "관측하지 않은 값은
0으로 채우지 않는다"가 명시돼 있고 `verification_command` 가 **논리 값이며 파일 경로가
아님**을 적었다.

### Ponytail

**위반 없음.** `src/workflow.ts` 178줄로 AC의 200줄 상한을 지켰고 **class가 0개**다.
WorkflowEngine · StateMachine · Pipeline · Step registry · Event bus · Job scheduler ·
retry · plugin · provider · DI가 하나도 없다.

**`workflow.ts` 가 `events.jsonl` 이나 `state.json` 을 직접 쓰지 않는다** — 전이는
기존 `task start` / `task submit` 구현을 자식 프로세스로 재사용한다. 상태 전이 로직이
복제되지 않았다.

`src/context.ts` **무변경**. `src/` 는 네 파일이고 하위 디렉터리가 없다.
런타임 의존성 0, `devDependencies` 2개, `package-lock.json` 없음.
`shell: true` · `cmd /c` 0건, 비율 계열 문자열 0건.

### Findings

**F-1 — Report가 완료를 주장하지 않는데 submit이 통과했다 (Major, Process, 재발)**

worker의 `Known Risks`가 이렇게 적었다 — "Acceptance Criteria 8–78 ... remain
unverified until `npm test` is run from a host shell"과 "The implementation is
therefore not claimed complete."

그런데 `task submit` 은 통과했다. **T-009 Review F-2와 같은 문제이고 이번이 두 번째다.**

**이번에는 결과가 달랐다.** T-009에서는 낡은 assertion 3개였지만 T-010에서는 **실제
제품 결함**이 리뷰 단계까지 왔다 — 권한 모델에서 `spawnSync` 가 던지는 예외를 처리하지
않아 telemetry가 통째로 누락되는 결함이었다. 검증되지 않은 제출이 실제로 결함을
통과시킨다는 것이 관측됐다.

**규격대로 동작한 것이므로 구현 결함이 아니다.** G3는 Report의 존재만 검사한다.
**T-011의 최우선 요구사항으로 기록한다.**

**F-2 — Report 소유권 예외 (Info, Process, 재발)**

Report의 `### Re-verification` 절을 `claude-code` 가 사용자 지시로 작성했다.
CLAUDE.md 규칙 2는 manager의 Report 수정을 금지한다.

**은폐되지 않았다.** 절 첫머리에 작성자와 사유가 명시돼 있고 worker 원문
(`### Context Used` 까지)은 수정되지 않았으며 추가는 append뿐이다.
T-009에 이어 두 번째다. **T-011에서 재작업 피드백의 소유권과 기록 위치를 정해야 한다.**

**F-3 — `verify()` 에 같은 결함이 남아 있다 (Minor)**

`src/workflow.ts` 의 `verify()` 는 `spawn` 을 try/catch 없이 호출한다. 권한이 실행
중에 회수되면 probe와 동일하게 예외가 빠져나가 telemetry가 누락된다.

**probe가 앞에서 막으므로 실무상 도달 불가다.** worker가 이 사실을 Report에 기록하고
재작업 범위를 최소로 유지하려 고치지 않았다 — **말없이 남긴 것이 아니라 밝히고 남겼다.**
승인을 막지 않는다. T-011 또는 별도 정리 대상.

**F-4 — 사람이 직접 연 worker 세션은 표지로 잡히지 않는다 (Info, 설계상 한계)**

`BCOS_WORKER_SESSION` 은 BCOS가 만든 자식만 표시한다. 사람이 직접 Codex를 열고 그
안에서 `task execute` 를 실행하면 표지가 없다. **capability probe가 막을 가능성이
높지만 보장하지 않는다.** Task 문서 `Notes` 에 그렇게 적혀 있고 숨기지 않았다.

**F-5 — 설계 노트의 필드 수 산술이 하나 어긋났다 (Info)**

Task의 `Benchmark Telemetry` 절은 "84 → 95"라고 적었으나 실제는 **84 → 96**이다.
차이는 `workflow_resume_count` 이며 이것은 **AC 70이 명시적으로 요구한 필드**다.
**구현이 옳고 설계 노트의 숫자가 틀렸다.** 산출물에 영향이 없어 정보로만 기록한다.

### ① T-010이 실제로 workflow를 자동화했는가

**했다. 관측으로 확인했다.**

한 명령으로 `start` → `run` → 검증 → `submit` 이 순서대로 일어나고, 이벤트 두 건이
정확히 기록되며, 검증이 실패하면 제출이 막힌다. Reviewer fixture에서 사람이 입력한
명령은 **`task execute` 하나뿐**이었다.

T-009에서 사람이 입력한 명령은 넷이었다 — `task start` · `task run` · `npm test` ·
`task submit`. **4 → 1.** 절대 수치이며 개선율로 환산하지 않는다.

### ② Nested Codex 문제가 이번에 실제로 어떻게 동작했는가

**또 일어났다.** T-010의 worker도 자기 샌드박스 안에서 `npm test` 를 실행하려다
`spawn EPERM`(errno -4048)으로 실패했다. 테스트 파일을 로드하기도 전에 러너의 자식
프로세스 생성이 거부됐고, 격리를 끈 진단 실행에서는 129개를 선언했지만 테스트들이
띄우는 CLI 자식이 같은 이유로 전부 거부됐다. **assertion이 하나도 평가되지 않았다.**

**정확히 구분해 기록한다.** 이번에 worker를 막은 것은 T-010의 guard가 아니다.
worker는 `task execute` 를 실행한 것이 아니라 `npm test` 를 직접 실행했다.
**T-010의 두 장치는 `task execute` 를 통과하는 경로에만 걸린다.**

- **capability probe** — worker 안에서 `task execute` 를 돌렸다면 자식 생성 시험이
  실패해 `environment` 로 즉시 멈추고 lifecycle을 건드리지 않았을 것이다.
  Reviewer가 권한 모델로 그 조건을 재현해 확인했다.
- **`BCOS_WORKER_SESSION`** — BCOS가 띄운 worker 안에서 `task execute` 를 돌리면
  잡힌다. Reviewer가 확인했다.

**그러나 worker가 `npm test` 를 직접 실행하는 것은 BCOS가 막을 수 없다.**
그래서 T-010의 진짜 해법은 감지가 아니라 **검증 주체를 host로 옮긴 것**이다.
worker가 자기를 검증하지 못해도 `task execute` 가 host에서 검증한다.

### ③ 지금 어디까지 자동화됐고 어디부터 사람이 필요한가

| 단계 | 상태 |
|---|---|
| Task 설계 | **사람 + Claude Code** |
| `task start` | **자동** (T-010) |
| Context 조립·전달 | **자동** (T-007·T-008) |
| Worker Prompt 작성 | **불필요** (T-009) |
| Worker 실행 | **자동** (T-008) |
| Report 존재 확인 | **자동** (T-010) |
| host 검증 실행 | **자동** (T-010) |
| 검증 결과로 제출 판단 | **자동** (T-010) |
| `task submit` | **자동** (T-010) |
| **Review 실행** | **사람** — T-011 |
| **verdict 판단** | **사람** — T-011 |
| **재작업 지시·루프** | **사람** — T-011 |
| **`task approve`** | **사람** — T-011 |
| **commit · push** | **사람** |
| **README·Benchmark 갱신** | **사람** |

**`IMPLEMENTED` 까지가 자동이고 그 이후는 전부 사람이다.** T-010은 설계대로
Reviewer가 아니며, 그 경계를 넘지 않았다.

### Sensitive Information

`src/workflow.ts` · `tests/cli.test.ts` · `TELEMETRY.md` · Report 전부 **0건**.
성공 경로 telemetry 출력에도 절대경로가 없다.

### Verdict

**APPROVED**

Reviewer 독립 검증 83개, 회귀 13개, 테스트 129개가 전부 통과했다.
Blocking Finding이 없다.

F-1이 가장 무겁지만 **프로토콜 설계 문제이지 이번 구현의 결함이 아니며**, T-010은
오히려 그 문제를 다른 방향에서 완화한다 — Report의 주장 대신 host 검증 결과가
제출을 막는다. 나머지 넷은 Minor 이하이고 전부 문서에 이미 밝혀져 있다.
