---
task: T-011
---

# Review — T-011

## Attempt 1 — 2026-08-10T02:49:40Z — APPROVED

### Verification Method

Worker Report를 신뢰하지 않고 Reviewer 자신의 fixture를 만들어 독립 검증했다.
가짜 worker·가짜 검증기·**가짜 reviewer** 셋 다 실행되면 마커 파일을 남기게 해서
"실행되지 않았다"를 결과가 아니라 흔적으로 확인했다. **99개 항목을 검증했고 전부
통과했다.**

`npm run build`와 `npm test`를 직접 실행했고, `PATH`에서 Codex 진입점과 `claude.exe`를
모두 제거한 뒤 한 번 더 돌렸다.

**이번 Review는 T-011이 만든 자동 `--review` loop를 쓰지 않았다.** 자기 자신에게
소급 적용하지 않는다는 설계 경계를 지켰다.

### Lifecycle

| | |
|---|---|
| `TASK_STARTED` | `2026-08-10T02:19:06.608Z` — worker / codex-cli |
| `TASK_SUBMITTED` | `2026-08-10T02:29:05.020Z` — worker / codex-cli |

`status: IMPLEMENTED` · `attempt: 1` · `current_task: null` ·
`counts.IMPLEMENTED: 1` · `counts.DONE: 10`.
이벤트 집계 `{"TASK_STARTED":1,"TASK_SUBMITTED":1}` — `TASK_APPROVED` 0건,
`TASK_CHANGES_REQUESTED` 0건.

**두 시각이 workflow 실행 시각과 정확히 맞물린다.**
`workflow_started_at=02:19:06.428Z` → `TASK_STARTED` `.608Z`(180 ms 후),
`TASK_SUBMITTED` `02:29:05.020Z` → `workflow_completed_at` `.035Z`(15 ms 후).
**사후 복구가 아니라 실제 실행 흔적이다.** 이벤트를 수정하지 않았다.

### task execute dogfooding — 사람 명령 1개

사람이 입력한 BCOS lifecycle 명령은 **`task execute T-011 --worker codex
--actor-id codex-cli --timeout 5400` 하나**다. `task start`·`task run`·`npm test`·
`task submit`을 따로 입력하지 않았다.

workflow 로그와 이벤트·상태 파일이 일치한다.

```
workflow_exit_reason=success
lifecycle_transitions_caused=2
runner_invocations=1
verification_runs=1
verification_command=npm-test
verification_exit_code=0
verification_duration_ms=53984
```

`TODO` → `TASK_STARTED` → Codex worker(544,281 ms) → Report 생성 →
host verification(exit 0) → `TASK_SUBMITTED` → `IMPLEMENTED`.
**T-010 workflow의 첫 실제 dogfooding이며 설계대로 동작했다.**

### 독립 build / test

**`npm run build` exit 0. `npm test` 156 tests / 156 pass / 0 fail, exit 0.**

`PATH`에서 `@openai/codex/bin/codex.js`와 `claude.exe`를 모두 제거하고 재실행해도
**156/156 pass** — **어떤 테스트도 실제 모델 실행기에 의존하지 않는다.**

### request-changes 전이 — 17 / 17

RFC-001 §1.2 규정과 대조해 전부 확인했다.

| 검증 | 결과 |
|---|---|
| `IMPLEMENTED` → `IN_PROGRESS` | exit 0 |
| `TASK_CHANGES_REQUESTED` | 1건 |
| **attempt 1 → 2** | RFC §1.4대로 전이가 증가시킨다 |
| `state.json` counts·`current_task` | 갱신됨 |
| role `reviewer` / `human` | 허용 |
| role `worker` | **거부** |
| `IMPLEMENTED` 아닌 상태 | **거부** |
| `--help` | `request-changes` 노출 |

**G4 양방향을 확인했다.**

- Review 없음 → exit 1
- **`APPROVED` Review로 `request-changes` → exit 1**
- **`CHANGES_REQUESTED` Review로 `approve` → exit 1**

**판정과 전이가 어긋나면 양쪽 다 막힌다.** G5도 적용된다 — 제출자 자신이
`request-changes`를 시도하면 거부된다.

**거부된 다섯 경로 전부에서 `.bcos/` 재귀 해시가 동일했다.** partial write 0건.

### Reviewer runner — 26 / 26

`src/reviewer.ts` 103줄, class 0개.

| 검증 | 결과 |
|---|---|
| Claude 실행 형태 | `claude.exe`를 **`shell: false`로 직접 spawn** |
| argv | `["-p", "--output-format", "text"]` |
| cwd | fixture 루트 |
| stdout·stderr | 부모로 전달 |
| timeout | 적용됨 — 초과 시 이관 |
| **lifecycle 파일 직접 수정** | **없음** — `events.jsonl`·`state.json` 문자열 0건 |
| hand-written Prompt 파일 | **없음** |

**stdin 내용을 덤프해 직접 확인했다** — Task ID·attempt·reviewer·Review 경로 4종,
"Report를 신뢰하지 마라", **host 검증 증거 블록(`command`/`exit code`/`duration`)**,
**"테스트를 다시 실행하지 마라"**, 판정 2값과 "증거 없는 완료 주장은
CHANGES_REQUESTED", git·bcos·구현 수정·테스트 수정 금지, **Context Package 정확히 1회**,
타임스탬프 없음.

테스트에서 실제 Claude를 호출하지 않는다. `.js` override는 `process.execPath`로
실행되어 가짜 reviewer가 가능하다.

### Verdict contract — 새 스키마 없음

`src/reviewer.ts:70`이 판정을 읽는 유일한 지점이다.

```
^## Attempt <n> — .+ — (APPROVED|CHANGES_REQUESTED)$
```

`approveTask()`가 이미 쓰던 형태에서 **판정 부분만 캡처 그룹으로 바꾼 것**이다.
Review frontmatter 확장 없음, 별도 JSON artifact 없음, **산문 파서 없음.**

| 판정 | 동작 | 확인 |
|---|---|---|
| `APPROVED` | `approve` → `DONE` | 승인 actor가 `--reviewer-actor-id` |
| `CHANGES_REQUESTED` | `request-changes` → 재작업 | attempt 2 |
| **`BLOCKED`** | **정규식에 없어 `unreadable`** → 이관 | approve 0건, `IMPLEMENTED` 유지 |
| 항목 없음 | `unreadable` → 이관 | 전이 0건 |

**`BLOCKED`가 자동 승인이나 재작업으로 흐르지 않는다.** RFC §1.2에
`IMPLEMENTED → BLOCKED` 전이가 없으므로 사람에게 넘기는 것이 옳다.

### Report evidence 처리 — 설계 판단이 실증됐다

**worker Report가 또 완료를 주장하지 않았다.**

> "`npm test`가 실제로 통과하지 않았으므로 Acceptance Criteria 전체 충족을 주장하지
> 않는다." — worker sandbox의 `spawn EPERM` 때문에 156개 중 1개만 pass했다.

**세 Task 연속(T-009·T-010·T-011) 같은 현상이다.** 그런데 이번에는 결과가 달랐다.

| 증거 출처 | 결과 |
|---|---|
| **Worker self-test** | `spawn EPERM` — 실행 불가, AC 충족 주장 안 함 |
| **Host verification** | **156 / 156 pass, exit 0** |
| **Reviewer 독립 재실행** | **156 / 156 pass, exit 0** |

**두 증거가 갈렸고 host가 옳았다.** worker는 자기 샌드박스 때문에 볼 수 없었을 뿐이며,
**BCOS가 host에서 실행한 결과가 submit을 정당화했다.** T-010이 "검증 주체를 worker에서
host로 옮긴다"고 설계한 것이 실제 상황에서 값을 한 두 번째 사례다.

Reviewer가 Host evidence로 AC 충족을 독립 판단할 수 있는 구조인지도 확인했다 —
**가능하다.** `runReviewer()`가 검증 결과를 stdin 증거 블록으로 전달하고, Reviewer는
그것을 근거로 판단하도록 지시받는다.

**G3 자체는 여전히 Report의 존재만 본다.** T-011은 그것을 바꾸지 않았고, 대신
RFC-001 §4를 집행할 자동 Reviewer를 놓았다. 설계 의도대로다.

### Host / Reviewer 역할 분리

| 주체 | 책임 | 확인 |
|---|---|---|
| **BCOS host** | build·test 결정론적 실행, exit code 산출 | `verification_command=npm-test`, exit 0 |
| **Reviewer** | 코드·Task·AC·Scope·회귀 판단 | stdin에 증거 전달, 재실행 금지 지시 |

Reviewer stdin에 "테스트를 다시 실행하지 마라"가 들어 있음을 실측했다.
**sandbox 안에서 `npm test`를 다시 돌리도록 지시하지 않는다.**

### Rework loop — 12 / 12

가짜 fixture로 전체 흐름을 돌렸다. 이벤트 순서가 정확히 이랬다.

```
TASK_STARTED → TASK_SUBMITTED → TASK_CHANGES_REQUESTED → TASK_SUBMITTED → TASK_APPROVED
```

| 검증 | 결과 |
|---|---|
| **`TASK_STARTED` 재생성** | **없음 — 1건 유지** |
| attempt 증가 주체 | `request-changes` (2로) |
| worker 실행 횟수 | 2 (새 프로세스, 세션 기억 미의존) |
| **rework stdin에 Review 전문** | **포함** — `REVIEW OF PREVIOUS ATTEMPT` |
| attempt 1 stdin | Review 절 **없음** |
| hand-written Prompt | **없음** |
| `rework_invocations` / `feedback_handoff_count` / `rework_attempt` | 1 / 1 / 2 |
| rework 검증 실패 | `submit` 하지 않음 |

**SoD는 현재 attempt의 submit actor와만 비교한다** — rework 후에도 `codex-cli`(제출)와
`claude-code`(전이)가 달라 통과했다.

### max review cycles — 9 / 9

기본값 **2** 확인. `--max-review-cycles 1` override 동작.
**0 · 음수 · 소수 · 비숫자 전부 exit 1.**

계속 `CHANGES_REQUESTED`가 나오면 `review_cycle=2`에서
**`review_cycles_exhausted`로 멈추고 자동 승인하지 않는다.** 무한 loop가 없다.
`--timeout`(프로세스 상한)과 `--max-review-cycles`(반복 상한)가 별개로 유지된다.

### Human escalation — 16 / 16

| 경로 | 결과 |
|---|---|
| `reviewer_failed` (exit 2) | 이관, `IMPLEMENTED` 유지, 전이 0건 |
| `verdict_unreadable` (판정 없음) | 이관, approve·request-changes 0건 |
| `verdict_unreadable` (`BLOCKED`) | 이관, approve 0건 |
| `review_cycles_exhausted` | 이관, 자동 승인 0건 |
| `verification` | `submit` 0건, reviewer 미실행 |
| 없는 reviewer-command · 미지원 reviewer · actor-id 누락 | exit 1, lifecycle 무변경 |

이관 출력에 **멈춘 지점 · Task 상태 · 마지막 판정 · Review 경로 · 다음 행동**이
전부 있고 **절대경로가 없다.**

**어떤 이관 경로에서도 `approve`가 실행되지 않았고 상태를 추측해 바꾸지 않았다.**

### SoD — 6 / 6

`--actor-id codex-cli` 와 `--reviewer-actor-id codex-cli` 를 같게 주면
**workflow 시작 전에 거부된다.**

worker 마커 없음 · verifier 마커 없음 · reviewer 마커 없음 · `.bcos/` 해시 동일 ·
`events.jsonl` 0줄. **G5 위반을 loop 끝까지 가서 만나지 않는다.**

### Telemetry

**96 → 112.** 새 절 두 개(`## 11 Workflow Metrics`는 T-010, `## 12 Reviewer
Orchestration Metrics`가 이번). **기존 필드에서 삭제된 줄이 0줄이다.**

요구된 14개 키 전부 존재 — `reviewer_name` · `reviewer_runtime` ·
`reviewer_duration_ms` · `reviewer_exit_code` · `review_started_at` ·
`review_completed_at` · `review_verdict` · `review_cycle` · `reviewer_invocations` ·
`rework_invocations` · `rework_attempt` · `feedback_handoff_count` ·
`approval_transition_caused` · `human_escalation_reason`.

**계산 필드 정의 0건.** `--review` 없이 실행하면 reviewer 관련 필드가 **아예 출력되지
않는다**(0으로 채우지 않음).

### Regression — 14 / 14

`task start` · `submit`(G3) · `approve`(G4·G5) · `context` · `run` dry-run ·
`--version` · `--help` · unknown argument 전부 유지.

**`--review` 없는 `task execute`가 T-010과 동일하게 `IMPLEMENTED`에서 멈춘다.**
reviewer 미실행, reviewer 필드 미출력, `lifecycle_transitions_caused=2`.
`--verify-only`도 worker를 띄우지 않고 동작한다.

### Ponytail

**위반 없음.** `src/reviewer.ts` 103줄(상한 160) · `src/workflow.ts` 270줄(상한 300) ·
**두 파일 다 class 0개.** `src/context.ts` 무변경. `src/`는 다섯 파일, 하위 디렉터리 0.

`shell: true`·`cmd /c` 0건 · `--dangerously-skip-permissions` 0건 · 비율 계열 문자열
0건 · **`workflow.ts`·`reviewer.ts`가 상태 파일에 직접 쓰지 않음.**
런타임 의존성 0 · `package-lock.json` 없음 · `.bcos/prompts/T-011*` 0개.

### Findings

**F-1 — TELEMETRY.md 안에서 `rework_count` 가용성이 서로 어긋난다
(Minor, Specification)**

§7 표(158행)는 여전히 `rework_count`를 **`blocked`**로 두고, 165행은 사유를
"`request-changes` 전이가 아직 명령이 아니라 이벤트가 남지 않는다"로 적는다.
**이번 Task가 그 전이를 구현했으므로 사유가 거짓이 됐다.**

새 §12(279행)는 "`rework_count`는 `TASK_CHANGES_REQUESTED` 이벤트가 생겨 더 이상
blocked가 아니다"라고 옳게 적는다. **한 문서 안에서 같은 필드의 상태가 두 가지다.**

**구현 결함이 아니다.** T-011의 `Expected Files`가 "기존 96개와 다른 절은 그대로 둔다"고
지시했으므로 worker는 §7을 고칠 수 없었고, 새 절에 기록하는 것이 유일한 선택지였다.
**Task 명세가 만든 모순이다.**

측정 계약의 정확성 문제이므로 다음 Task에서 §7 행과 사유를 갱신할 것을 제안한다.
승인을 막지 않는다 — 최신 사실이 문서에 존재하고 실제 이벤트도 남는다.

**F-2 — Report의 Test Evidence가 host 결과와 다르다 (Info, Process, 세 번째 재발)**

Report는 `npm test` 실패(1/156)를 기록하고 AC 충족을 주장하지 않는다. host와
Reviewer는 156/156을 실측했다. **Report는 worker 소유라 수정하지 않았다.**

이번에는 이 불일치가 **위험이 아니라 설계가 작동한 증거**다. worker의 자기보고가
아니라 host 검증이 제출 여부를 결정했다. 다만 세 Task 연속 같은 일이 일어났으므로,
worker sandbox에서 테스트를 못 돌리는 것이 예외가 아니라 상수임을 기록한다.

**F-3 — Observability: 실행을 추적할 수단이 없다 (Major, Observability)**

이번 dogfooding은 **성공했는데 성공한 줄 몰랐다.**

- workflow는 부모 Claude Code 세션 종료 후에도 계속 실행돼 `EXIT=0`으로 완주했다
- `workflow_duration_ms=598607` — 약 10분
- 중간 스냅샷(`IN_PROGRESS`)이 "멈춤"으로 오인됐다
- **BCOS에는 실행 상태를 다시 조회할 명령이 없다** — `task status`·`inspect` 없음
- **telemetry는 stdout 전용**이라 창을 닫으면 사라진다
- 사후 확인이 가능했던 유일한 이유는 **로그를 파일로 리다이렉트해 뒀기 때문**이며,
  그것은 도구의 기능이 아니라 우연한 조치였다
- 로그에 fixture Task(`task_id=T-200`)의 telemetry가 실제 실행 telemetry와 섞여 있었다

**"한 명령으로 자동화됐다"와 "완료를 신뢰성 있게 관찰할 수 있다"는 다른 문제다.**
T-011은 전자를 진전시켰고 후자는 손대지 않았다.

**T-011 구현의 결함이 아니다.** Scope 밖이며 이번 Task에 넣지 않는 것이 옳다.
후속 후보로 기록한다 — persistent telemetry · workflow execution id ·
`task status` / `inspect` · fixture telemetry와 실제 telemetry 구분.

**F-4 — Reviewer 검증 방식이 문서와 어긋난다 (Minor, Policy)**

`CLAUDE.md`·`AGENTS.md`의 현행 운영 원칙은 Reviewer가 build·test를 직접 재실행하도록
한다. T-011의 Reviewer stdin은 반대로 **"테스트를 다시 실행하지 마라"**라고 지시한다.

**근거가 있는 변경이다** — worker sandbox의 `spawn EPERM`이 세 Task 연속 발생했고
Reviewer도 같은 방식으로 실행되므로 같은 결과가 예상된다.

**이번 Review에서 문서를 수정하지 않았다.** T-011 Task의 `Required Protocol / Policy
Changes`에 제안이 이미 기록돼 있다. 별도 승인 대상이다.

**F-5 — `BLOCKED` 판정에 갈 곳이 없다 (Info, Policy)**

RFC-001 §4는 판정을 셋으로 정의하지만 §1.2 전이표에 `IMPLEMENTED → BLOCKED`가 없다.
T-011은 이관으로 처리하며 프로토콜을 바꾸지 않았다. **올바른 선택이다.**
개정 여부는 별도 판단이다.

### Sensitive Information

`src/reviewer.ts` · `src/workflow.ts` · `src/cli.ts` · `tests/cli.test.ts` ·
`TELEMETRY.md` · Report 전부 **0건**. 이관 출력에도 절대경로가 없다.

### Verdict

**APPROVED**

Reviewer 독립 검증 99개, 테스트 156개가 전부 통과했다. Blocking Finding이 없다.

F-3이 가장 무겁지만 **관측 가능성 문제이지 이번 구현의 결함이 아니다.**
F-1은 명세가 만든 문서 모순이고, 나머지는 정보성이거나 이미 제안으로 기록돼 있다.

T-011은 계약대로 동작한다 — Reviewer가 자동 실행되고, 판정에 따라 승인하거나 재작업을
돌리며, 판정을 읽지 못하면 **절대 승인하지 않고 사람에게 넘긴다.**
