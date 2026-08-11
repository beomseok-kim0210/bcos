---
task: T-012
---

# Review — T-012

## Attempt 1 — 2026-08-11T02:05:00Z — APPROVED

### 핵심 질문에 대한 답

> T-012가 T-011에서 드러난 "workflow는 성공했는데 사용자가 그것을 신뢰성 있게
> 관찰할 수 없었던 문제"를 최소한의 구조로 해결했는가?

**해결했다.** `src/run.ts` **69줄**, class 0개, 의존성 0개, 새 명령 1개.
daemon도 서버도 데이터베이스도 없다.

**다만 한 가지를 과장하지 않는다** — T-012 자신의 최초 실행은 기록되지 않았다.
아래 `Bootstrap limitation` 에 그대로 적었다.

### Verification Method

Worker Report를 신뢰하지 않고 Reviewer 자신의 fixture로 독립 검증했다.
`npm run build` 와 `npm test` 를 직접 실행했고, 실행 기록·중단 의미·조회 명령·
개인정보를 각각 별도 fixture로 확인했다.

**이번 Review는 T-012가 만든 기능을 자기 자신에게 소급 적용하지 않았다.**
`task execute --review` 를 쓰지 않은 수동 Review다.

### Lifecycle

| | |
|---|---|
| `TASK_STARTED` | `2026-08-10T03:16:23.972Z` — worker / codex-cli |
| `TASK_SUBMITTED` | `2026-08-11T01:30:52.481Z` — worker / codex-cli |

`status: IMPLEMENTED` · `attempt: 1` · `current_task: null` ·
`counts.IMPLEMENTED: 1` · `counts.DONE: 11`.
집계 `{"TASK_STARTED":1,"TASK_SUBMITTED":1}` — `TASK_APPROVED` 0건,
`TASK_CHANGES_REQUESTED` 0건. **이벤트를 수정하지 않았다.**

**두 실행이 정확히 구분된다.**

| | 최초 `task execute` | `--verify-only` |
|---|---|---|
| 시각 | `03:16:23.808Z` → `03:24:09.791Z` | `01:29:39.239Z` → `01:30:52.499Z` |
| `worker_exit_code` | **0** (396,705 ms) | — |
| `runner_invocations` | **1** | **0** |
| `verification_exit_code` | **1** | **0** |
| `workflow_exit_reason` | **verification** | **success** |
| `lifecycle_transitions_caused` | 1 (`start`) | 1 (`submit`) |

**최초 실행에서 `TASK_STARTED` 가 생기고 검증 실패로 submit이 막혔으며,
`--verify-only` 가 `TASK_STARTED` 를 추가하지 않고 `TASK_SUBMITTED` 만 만들었다.**
attempt는 1로 유지됐다. Report 서술이 아니라 이벤트·telemetry 로그로 확인했다.

### 독립 build / test

**`npm run build` exit 0. `npm test` 186 tests / 186 pass / 0 fail, exit 0.**

**기존 156개가 그대로 유지된다** — 삭제된 `test(` 0건, `.skip`·`.only`·`todo` 0건,
총 선언 186개(156 + 30).

**모델 실행기 미의존 — 정적으로 완전히 증명했다.**

테스트 안에서 CLI를 띄우는 `task run` · `task execute` 호출 12건을 전부 뽑아
분류했다. 옵션 검증에서 즉시 종료되는 것(`--worker` 누락, `--actor-id` 누락,
미지원 worker, 알 수 없는 옵션, `--dry-run`)을 제외하면 **worker spawn에 도달할 수
있는 호출은 6건이고, 6건 모두 `--worker-command` 로 fixture `.js` 를 지정한다.**
**`--review` 를 쓰는 호출 중 `--reviewer-command` 를 빠뜨린 것은 0건이다.**

`@openai` 참조 0건, `claude.exe` 참조 0건. **어떤 경로로도 실제 Codex나 Claude에
도달할 수 없다.**

`--verify-command` 를 생략한 2건은 `scripts.test` 와 npm 진입점 해석을 시험하는
T-010 테스트이며 npm을 부른다 — **모델 실행기가 아니라 검증 도구이고 그것이
시험 대상이다.**

`PATH` 에서 두 실행기를 제거한 전체 재실행도 시도했으나 12분 뒤에도 끝나지 않아
결과를 얻지 못했다 — `PATH` 를 통째로 비우면 자식 프로세스의 도구 해석이 굶는다.
**결과가 없으므로 그 실행이 통과했다고 적지 않는다.** 위 정적 증명이 그보다 강하고
완전하므로 결론은 바뀌지 않는다.

### 테스트 동기화 수정 검증

문제였던 테스트의 수정 내용을 직접 읽었다.

```
+    const observedStage = () => {
+      const names = workflowRunFiles(fixture_);
+      try { return workflowRun(fixture_, names[0]).current_stage; } catch { return undefined; }
+    for (let index = 0; index < 50 && observedStage() !== "worker"; index += 1) {
```

| 검증 | 결과 |
|---|---|
| `expected "worker"` 유지 | ✓ — `assert.equal(record.current_stage, "worker")` 그대로 |
| assertion 완화 | **없음** |
| 제품 코드 변경 | **없음** — `src/` diff에 해당 없음 |
| 테스트 삭제·skip | **0건** |
| 대기 조건 변경 | "artifact 존재" → **"`current_stage === "worker"` 도달"** |
| 기존 helper 재사용 | ✓ — `workflowRunFiles` · `workflowRun` |
| 새 범용 framework | **없음** — 테스트 안의 지역 화살표 함수 |
| loop bound | 50 × 20 ms 그대로 |

**수정이 옳은 이유를 독립 재현으로 확인했다.** `current_stage` 가 `worker` 가 될
때까지 폴링하면 **250 ms** 만에 도달하고, 그 시점에 죽이면 기록이 테스트가 기대하는
값을 정확히 담는다. 원래 테스트는 artifact 생성 시점(=`start` 단계)에 바로 죽였으므로
**5회 중 5회 결정적으로 실패**했다. **제품은 자기가 실제로 있던 단계를 옳게 기록했다.**

### Run artifact 구조

실제 저장소 기록 전문(612 bytes):

```
execution_id  20260811T012939320Z-6e0b63f5
task_id       T-012
attempt       1
started_at / updated_at / completed_at
workflow_status  success
workflow_exit_reason  success
current_stage    submit
verification_command  npm-test
stages { start, worker, report_check, verification, submit,
         review, approve, request_changes }
```

요구된 항목이 전부 있다. worker·verification 결과는 stage 상태와
`verification_command` 로, reviewer 결과는 `review` stage로 표현된다.
마지막 lifecycle 이벤트는 artifact가 복제하지 않고 **`task status` 가 `events.jsonl`
에서 읽어 보여준다** — 중복 저장을 피한 옳은 선택이다.

**`status` 나 `task_status` 필드가 없다.** lifecycle SSOT를 소유하지 않는다.

### Lifecycle SSOT 분리

**`src/run.ts` 와 `src/workflow.ts` 에 `events.jsonl` · `state.json` 문자열이 0건이다.**
전이는 여전히 기존 CLI 명령을 자식 프로세스로 호출해 일어난다.
`task status` 는 읽기만 하며 쓰기 호출이 0건이다.

**두 값은 다른 의미다.**

| | 값 | 뜻 |
|---|---|---|
| Task `status` | `IMPLEMENTED` | 프로토콜 상태. `tasks/*.md` 가 소유 |
| `workflow_status` | `success` | **한 번의 실행 관찰.** `.bcos/runs/` 가 소유 |

같은 저장소에서 Task `IN_PROGRESS` / run `failed` 조합도 관측했다.
**run artifact를 읽어 lifecycle을 재구성하거나 변경하는 코드가 없다.**

### Execution ID

`20260811T012939320Z-6e0b63f5` — UTC 압축 타임스탬프에 **밀리초 포함**, 8자리 hex.
정규식 `^[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}$` 부합.

**파일명 사전순이 곧 시간순**이므로 최신 선택에 파싱이 필요 없다.
같은 밀리초 충돌은 hex 4바이트가 막는다 — 20,000회 생성 시 충돌 1건이 나오지만
**그것은 같은 밀리초에 2만 번 실행할 때의 값**이고 실제로는 도달하지 않는다.
사용자 정보나 경로가 id에 없다.

### Stage model

`src/run.ts:5` 의 `stageNames` 가 여덟이고, `src/workflow.ts` 의 `markStage` 호출
순서가 그것과 일치한다 — `start`(207) · `worker`(213) · `report_check`(230) ·
`verification`(234) · `submit`(241) · `review`(251) · `approve`(265) ·
`request_changes`(271), 그리고 재작업 루프에서 `worker`(277)로 되돌아간다.
**임의 enum이 아니라 실제 호출 순서다.**

어휘 다섯(`not_started` · `skipped` · `running` · `success` · `failed`)이
실행과 일치한다. **실제 T-012 `--verify-only` 기록이 정확히 이렇다.**

```
start: skipped     worker: skipped
report_check: success   verification: success   submit: success
review: not_started   approve: not_started   request_changes: not_started
```

**`skipped` 와 `not_started` 가 구분되고 0으로 채워지지 않는다.**

### Interruption semantics — 9 / 9

`current_stage === "worker"` 도달을 기다렸다가 강제 종료했다.

| 검증 | 결과 |
|---|---|
| `workflow_status` 가 `running` 유지 | **PASS** |
| `failed` 로 자동 전환 | **없음** |
| `success` 로 위조 | **없음** |
| `completed_at` | **없음** |
| `interrupted` · `unknown` 파일 저장 | **없음** |
| `current_stage` 보존 | `worker` |
| 유효 JSON · temp 잔존 0 | **PASS** |

`task status` 표현:

```
Workflow status: running
Completed: not observed
Exit reason: not observed
```

**살아 있다고 주장하지 않는다.** `running` 은 "마지막으로 관측된 상태"이고,
종료를 보지 못했다는 사실을 별도로 말한다. **모르는 것을 아는 척하지 않는 설계다.**

### task status CLI

**A. 기록이 있는 Task** — 실제 저장소에서 exit 0, Task id·lifecycle status·
execution id·attempt·workflow status·current stage·started·completed·exit reason·
**마지막 lifecycle 이벤트**·stage 8개가 모두 출력된다.

**B. 기록 없는 Task** — `task status T-001` → **exit 0**,
`Task T-001 (DONE) has no workflow execution records.`
**기록 없음을 오류로 취급하지 않는다.**

**C. 여러 execution** — `Execution:` 줄이 최신을 가리키고 하단에
`Executions: 2; other execution ids: …` 가 붙는다.

**D. explicit execution** — `--execution <id>` 정확 조회 exit 0, 없는 id exit 1.

**조회는 artifact를 수정하지 않는다** — 실행 전후 파일 수 변화 0.

### 최신 execution 선택

파일명 정렬 마지막이 최신이며 실제로 그렇게 동작한다.
**출력에 오래된 id가 보이는 것은 `other execution ids` 표시이지 오선택이 아니다** —
이 구분을 하지 않으면 오판하게 된다. 첫 검증에서 내가 그 실수를 했고 바로잡았다.

### Persistent telemetry

**기존 키 삭제·개명 0건.** T-009~T-011 키가 그대로 나온다.

신규 5개가 `TELEMETRY.md` 와 실제 출력에 모두 있다 —
`execution_id` · `workflow_status` · `current_stage` · `stage_status` ·
`run_record_path`. **stdout의 `execution_id` 와 artifact의 값이 일치한다.**

계산 필드 정의 0건.

### Fixture isolation — 과장 없이

**혼입이 사라지지 않았다.** `verify()` 는 여전히 검증 자식의 stdout을 부모로
전달하고, 그것이 T-010의 계약이며 테스트가 단언한다.

**바뀐 것은 두 가지다.**

1. **권위 있는 출처가 stdout에서 옮겨졌다.** fixture 실행은 자기 임시 저장소의
   `.bcos/runs/` 에만 쓴다. 실제 저장소 기록과 **구조적으로 섞이지 않는다.**
   테스트가 이것을 단언한다 — `guards create no execution records`.
2. **stdout 줄에 `execution_id` 가 붙어 귀속이 가능해졌다.**

**"구분 가능 + authoritative source 분리"이지 "혼입 제거"가 아니다.**
Task 문서가 이 표현을 그대로 쓰고 있고, 구현이 그것과 일치한다.

### Atomic write

`src/run.ts:20-27` 이 temp 작성 후 `renameSync` 다. temp 이름에 `process.pid` 가
들어가 동시 실행 충돌을 피한다. **`src/cli.ts` 의 기존 관행을 그대로 재사용했다.**

정상 실행 후 temp 0건, 강제 종료 후에도 temp 0건이고 artifact가 유효 JSON이다.
**트랜잭션·WAL·잠금 프레임워크가 없다.**

### Privacy

실제 저장소 artifact 전문(612 bytes)을 검사했다.

```
절대경로 false · 홈경로 false · command line false · 환경변수 false
프롬프트 false · Context Package false · stdout/stderr 전문 false · 이메일 false
```

저장되는 것은 논리 명령 이름(`npm-test`)·타임스탬프·task id·execution id·
stage 상태뿐이다.

### Bootstrap limitation — 숨기지 않는다

**T-012 attempt 1의 최초 workflow에는 run artifact가 없다.**

그 실행(worker 396,705 ms)은 이 Task가 만든 코드가 들어가기 **전의 `dist/`** 로
시작됐으므로 기록 코드가 로드되지 않았다. 현재 저장소에 있는
`20260811T012939320Z-6e0b63f5.json` 은 **새 build 이후 `--verify-only` 재검증에서
생성된 것**이다.

따라서 **이 구현을 만든 약 6분 37초짜리 worker 실행의 저장소 기록은 없다.**
그 실행의 유일한 증거는 리다이렉트한 로그이며, **그것이 정확히 T-012가 없애려던
상황**이다.

**구현 결함이 아니라 부트스트랩 특성이다.** 기능을 만드는 실행 자체가 그 기능의
혜택을 받을 수 없다.

**처음부터 끝까지 persistent run artifact로 기록되는 첫 workflow는 T-013이다.**

### Source structure / Ponytail

| | 값 | 상한 |
|---|---:|---:|
| `src/run.ts` | **69** | 120 |
| `src/workflow.ts` | **306** | 310 |
| `src/cli.ts` | 474 | — |

class 0개 · `RunManager` 없음 · storage abstraction 없음 · DB·SQLite 없음 ·
OpenTelemetry 없음 · daemon·HTTP·heartbeat·supervisor 없음 · 의존성 0 ·
`package-lock.json` 없음.

**`src/context.ts` · `src/runner.ts` · `src/reviewer.ts` 가 변경되지 않았다.**

### TELEMETRY.md / architecture.md

**112 → 118.** 삭제 0줄. 신규 5개 키가 추가만 됐다. 계산 필드 0건.

`docs/architecture.md` 배치 목록에 한 줄이 추가됐다.

```
+│   ├── runs/                 # workflow 실행 관찰 기록
```

**책임 경계가 문서와 코드에서 일치한다** — 문서는 "실행 관찰 기록"이라 적었고,
코드는 lifecycle 상태를 소유하지 않는다.

### Regression

**186개 전부 통과.** 핵심 가드가 그대로다 —
`request-changes` G4·G5·상태·role 8건, nested worker guard 3건, capability probe,
SoD 사전 검사, reviewer loop, rework loop, `task execute --verify-only`,
`task start`·`submit`·`approve`·`context`·`run`, `--version`·`--help`·unknown.

**guard 거부 경로가 실행 기록을 만들지 않는다** — `guards create no execution
records` · `invalid execute options create no execution records` 가 통과한다.
`bcosSnapshot` 57개 단언이 그대로 유지된다.

### Findings

**F-1 — 검증 실패 후 재개에 피드백 통로가 없다 (Major, Implementation gap)**

host 검증이 실패하면 Task가 `IN_PROGRESS` 로 남는 것은 옳다. 그러나 이어지는 단순
`task execute` 재개에서 worker는 **어떤 테스트가 왜 실패했는지 전달받지 못한다.**
verification exit code도, 실패 증거도 Context에 들어가지 않는다.

T-011이 `request-changes` 경로에는 Review 전문을 붙였지만 **검증 실패 재개에는
같은 통로가 없다.** worker는 자기 샌드박스에서 테스트를 돌리지도 못하므로(네 Task
연속) 스스로 발견할 수도 없다.

**이번에는 사람이 진단하고 테스트를 고친 뒤 `--verify-only` 로 해결했다.**
그 개입이 없었다면 재개는 같은 실패를 반복했을 가능성이 높다.

**T-012 Blocking이 아니다** — Scope 밖이고 T-012가 만든 문제도 아니다.
후속 요구사항 후보로 기록한다: **Verification Failure Feedback Handoff** —
host 검증 실패 증거를 다음 worker 재개 Context에 전달.

**F-2 — AC 87이 실행 기록의 존재를 예상하지 않았다 (Minor, Specification)**

AC 87은 변경 파일을 7개로 못 박고 "이 저장소의 `.bcos/` 내용이 변경되지 않았다"고
요구한다. 그러나 **`task execute` 를 실제로 돌리면 정의상 `.bcos/runs/` 에 파일이
생긴다.** T-012 자신의 dogfooding이 그것을 만들었다.

**worker의 산출물은 AC 87을 지켰다** — `.bcos/runs/` 는 worker가 아니라 재검증
실행이 만들었다. 그러나 **`task execute` 를 dogfooding하는 모든 이후 Task에서 이
형식의 AC는 구조적으로 충족 불가능하다.** T-013부터 문구를 고쳐야 한다.

명세를 쓴 쪽의 누락이며 구현 결함이 아니다.

**F-3 — `workflow_resume_count` 가 여전히 `blocked` 다 (Minor, Specification)**

`TELEMETRY.md:246` 이 `blocked` 로 두고 249행이 "실행 간 상태를 저장해야 누적할 수
있지만 현재 Orchestrator는 그 상태를 저장하지 않는다"고 적는다.
**T-012가 바로 그 상태를 저장하기 시작했다** — `.bcos/runs/` 를 세면 재개 횟수를
알 수 있다.

**T-012 Scope 밖이므로 고치지 않은 것이 옳다.** Task가 "추가만 허용"이라고 못 박았다.
T-011의 `rework_count` 와 같은 종류의 이월이며, 다음 Task에서 §7·§11의 가용성 표기를
함께 정리할 것을 제안한다.

**F-4 — `PATH` 제거 실행은 완료되지 않았다 (Info, Process)**

`PATH` 에서 두 실행기를 제거한 전체 재실행이 12분 뒤에도 끝나지 않았다.
`PATH` 를 통째로 비우면 자식 프로세스의 도구 해석이 굶기 때문이며, **T-011에서
쓴 방법이 186개 규모에서는 적절하지 않다는 것이 이번에 드러났다.**

**결론은 바뀌지 않는다** — worker spawn에 도달 가능한 호출 6건이 전부
`--worker-command` 를 지정하고 `--review` 호출이 전부 `--reviewer-command` 를
지정한다는 정적 증명이 그 실행보다 강하고 완전하다.

다음 Review부터는 `PATH` 를 비우는 대신 이 정적 증명을 기본 검증으로 쓸 것을 제안한다.

**F-5 — stdout fixture 혼입은 여전히 가능하다 (Info, 설계상 수용)**

`verify()` 의 stdout 전달은 T-010 계약이므로 유지됐고, `npm test` 를 검증 명령으로
쓰면 fixture telemetry가 여전히 부모 stdout에 섞인다.

**T-012는 이것을 없앴다고 주장하지 않는다.** 권위 있는 출처를 파일로 옮기고
`execution_id` 로 귀속을 가능하게 했다. **문서와 구현이 그 표현에서 일치한다.**

**F-6 — `src/workflow.ts` 여유가 4줄이다 (Info)**

306 / 310. 다음 Task가 workflow에 손대면 곧바로 상한에 닿는다.
**지금 분할할 이유는 없다** — 상한은 비대화를 막으려는 신호이지 그 자체가 목표가
아니다. 다음 Task 설계 때 상한을 재검토하거나 책임을 나눌 지점을 정하면 된다.

### Git artifact 정책 — 결정과 근거

**`.bcos/runs/` 를 Git에 추적한다. `.gitignore` 에 넣지 않는다.**

**근거 1 — 저장소에 명시된 정책이 있다.** `.gitignore` 말미에 이렇게 적혀 있다.

> `.bcos/` 는 커밋한다. 프로젝트의 기억이 곧 저장소다.
> state.json 도 커밋한다 — 파생물이지만 클론 직후 status가 동작해야 한다.

**"파생물이지만 클론 직후 동작해야 한다"는 근거가 실행 기록에도 그대로 적용된다.**
이 정책을 조용히 뒤집는 것은 CLAUDE.md가 금지하는 "구현이 조용히 이탈하는 것"이다.

**근거 2 — T-014·T-015 Benchmark Harness의 원시 자료다.** `TELEMETRY.md` 는 세 arm
비교를 위한 측정 계약이고, 실행 기록은 그 계약이 요구하는 값이 실제로 남는 유일한
장소다. 무시하면 harness가 모을 원시 출처가 사라진다.

**근거 3 — 크기가 문제가 아니다.** 실행당 612 bytes다.

**대신 두 가지 비용을 인정한다.**

- **모든 `task execute` 실행이 working tree를 더럽힌다.** F-2가 그 첫 결과다.
- **무한히 쌓인다.** 지금은 무시할 수준이지만 보존 정책이 언젠가 필요하다.

**보존 정책은 이번에 만들지 않는다** — 아직 겪지 않은 문제다. 파일 수가 실제로
불편해질 때 판단한다. `.gitignore` 변경도 하지 않는다.

### Sensitive Information

`src/run.ts` · `src/workflow.ts` · `src/cli.ts` · `tests/cli.test.ts` ·
`TELEMETRY.md` · `architecture.md` · Report · 실제 run artifact 전부 **0건**.

### Verdict

**APPROVED**

Blocking Finding이 없다. 186개 테스트가 전부 통과하고, 요구된 관찰 항목이 실제 파일과
명령 출력으로 확인됐다.

가장 무거운 F-1은 **T-012가 만든 문제가 아니라 T-012가 드러낸 구조적 공백**이며
Scope 밖이다. F-2·F-3은 명세 이월이고, F-4는 이번에 확인하지 못한 항목을 확인한
것처럼 적지 않기 위해 남긴 기록이다.

**T-012는 계약대로 동작한다** — 실행마다 기록이 남고, 조회 명령 하나로 읽히며,
관측하지 못한 종료를 추측하지 않는다.
