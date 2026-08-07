# T-010 Benchmark

**첫 workflow 자동화 Task.** `start` → `run` → 검증 → `submit` 이 한 명령이 됐다.
**개선율을 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

필드 정의는 [TELEMETRY.md](TELEMETRY.md)에 있다.

| 항목 | 값 |
|---|---|
| Task | T-010 — Drive start, run, verify, and submit as one workflow command |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Quality

| 지표 | 값 | 종류 |
|---|---:|---|
| AC total / passed / failed | 87 / 87 / 0 | Measured |
| **AC Pass Rate** | **100.0%** | Derived |
| **Tests** | **129 / 129** | Measured — 99 → 129 |
| **Test Pass Rate** | **100.0%** | Derived |
| Reviewer 독립 검증 | **83 / 83** | Measured |
| Reviewer 회귀 검증 | **13 / 13** | Measured |
| Build result | SUCCESS | Measured |
| **First Review verdict** | **APPROVED** | Measured |
| Attempts | 1 | Measured |
| **Rework** | **Yes** | Measured — 두 Task 연속 |
| **Environment failures** | **1** | Measured — worker 내부 `spawn EPERM` |
| **Test regressions** | **1** | Measured — 129 중 1 fail |
| Review findings | 5 (Blocking 0 / Major 1 / Minor 1 / Info 3) | Measured |
| Scope violations | 0 | Measured |
| Ponytail violations | 0 | Measured |

## 2. Manual Intervention — 이 Task의 핵심 지표

| | T-009 | T-010 |
|---|---:|---:|
| **`human_command_count`** | **4** | **1** |
| 명령 | `task start` · `task run` · `npm test` · `task submit` | `task execute` |

**절대 수치만 기록한다.** 비교군이 없고 개선율로 환산하지 않는다.

**여전히 사람이 하는 것 (6단계)** — Review 실행 · verdict 판단 · 재작업 지시 ·
`task approve` · commit·push · README/Benchmark 갱신. **`IMPLEMENTED` 까지가
자동이고 그 이후는 전부 사람이다.**

## 3. Workflow 관측값 — Reviewer fixture

가짜 worker와 가짜 검증기로 측정했다. **실제 Codex를 호출하지 않았다.**

| 지표 | 정상 흐름 | 검증 실패 | worker 실패 | nested | probe 거부 |
|---|---:|---:|---:|---:|---:|
| `workflow_exit_reason` | `success` | `verification` | `worker_nonzero` | `nested_worker` | `environment` |
| exit code | 0 | 1 | 1 | 1 | 1 |
| `runner_invocations` | 1 | 1 | 1 | **0** | **0** |
| `verification_runs` | 1 | 1 | **0** | **0** | **0** |
| `verification_exit_code` | 0 | 1 | 미출력 | 미출력 | 미출력 |
| `lifecycle_transitions_caused` | **2** | **1** | 1 | **0** | **0** |
| `nested_worker_detected` | false | false | false | **true** | false |
| Task 최종 상태 | `IMPLEMENTED` | `IN_PROGRESS` | `IN_PROGRESS` | 불변 | 불변 |
| `TASK_SUBMITTED` | 1건 | **0건** | **0건** | 0건 | 0건 |
| worker 마커 파일 | 있음 | 있음 | 있음 | **없음** | **없음** |
| verifier 마커 파일 | 있음 | 있음 | **없음** | **없음** | **없음** |
| `.bcos/` 해시 | 변경 | 변경 | 변경 | **동일** | **동일** |

**`--verify-only`** — `runner_invocations=0`, worker 마커 없음, verifier만 실행,
`submit` 수행, `TASK_STARTED` 1건 유지.
**`IN_PROGRESS` 재개** — `start` 생략, `lifecycle_transitions_caused=1`.

**미출력은 0이 아니다.** 검증을 실행하지 않은 경로에서 `verification_exit_code` 와
`verification_duration_ms` 는 아예 나오지 않는다.

| 지표 | 값 | 종류 |
|---|---:|---|
| `workflow_duration_ms` (fixture 정상 흐름) | 수백 ms 대 | Measured |
| `verification_command` | `custom-verifier` / `npm-test` | Measured — **논리 값, 경로 아님** |
| Telemetry 출력의 절대경로 | **0건** | Measured |
| `workflow_started_at` · `workflow_completed_at` | RFC 3339 | Measured |

**fixture 실행 시간을 실제 Task 소요와 비교하지 않는다.** 가짜 worker는 즉시 종료하고
실제 Codex는 T-009에서 약 359초였다. **성격이 다른 값이다.**

## 4. Nested Codex — 두 번째 관측

**T-010에서도 일어났다.** worker가 자기 샌드박스 안에서 `npm test` 를 실행하려다
`spawn EPERM`(errno -4048)으로 실패했다. 테스트 파일 로드 전에 러너의 자식 프로세스
생성이 거부됐고, 격리를 끈 진단 실행에서는 129개를 선언했으나 테스트가 띄우는 CLI
자식이 전부 같은 이유로 거부됐다. **assertion이 하나도 평가되지 않았다.**

**정확히 기록한다 — 이번에 worker를 막은 것은 T-010의 guard가 아니다.**
worker는 `task execute` 가 아니라 `npm test` 를 직접 실행했다. T-010의 두 장치는
`task execute` 경로에만 걸린다.

| 장치 | 무엇을 잡는가 | Reviewer 확인 |
|---|---|---|
| capability probe | 자식 생성이 막힌 모든 환경 | 권한 모델로 재현, `environment` |
| `BCOS_WORKER_SESSION` | BCOS가 띄운 worker | 환경 변수 주입으로 재현, `nested_worker` |

**worker가 `npm test` 를 직접 실행하는 것은 BCOS가 막을 수 없다.**
T-010의 실질적 해법은 감지가 아니라 **검증 주체를 host로 옮긴 것**이다.

## 5. Host Verification

| 지표 | 값 | 종류 |
|---|---:|---|
| 검증 명령 결정 방식 | `package.json` 의 `scripts.test` | Measured |
| `scripts.test` 없을 때 | exit 1, `protocol` | Measured |
| `--verify-command` override | 동작 | Measured |
| 검증 stdout·stderr 전달 | 예 | Measured |
| 검증 실패 시 `submit` | **0건** | Measured |
| 검증 실패 시 Report | **보존** | Measured |

**worker 자기보고와 host 검증이 갈린 사례가 두 번 연속 나왔다** — T-009 99 중 3 실패,
T-010 129 중 1 실패. 둘 다 worker는 검증하지 못한 상태로 제출했다.

## 6. Rework 이력

| 단계 | 결과 | 분류 |
|---|---|---|
| worker 내부 `npm test` | `spawn EPERM` — 실행 불가 | **Environment Failure** |
| host `npm test` | 129 / 128 pass / **1 fail** | **Test Regression** |
| 재작업 후 | 129 / **129 pass** / 0 fail | Measured |

**실패한 테스트** — `task execute stops before lifecycle and runner when child
creation is denied`. `expected 'environment'`, `actual undefined`.

**원인은 제품 결함이었다.** Node 권한 모델에서 `spawnSync` 는 **예외를 던지고**
`{ error }` 를 반환하지 않는다. probe가 반환값만 검사해 예외가 `executeWorkflow` 를
빠져나갔고, exit 1은 나왔지만 `finish()` 가 실행되지 않아 **telemetry가 한 줄도
출력되지 않았다.** `workflow_exit_reason` 이 `undefined` 였던 것은 분류가 틀려서가
아니라 telemetry 블록 자체가 건너뛰어졌기 때문이다.

**수정은 `src/workflow.ts` 한 곳, +4줄** — 던져진 오류를 반환된 오류와 동일하게
다루도록 try/catch를 감쌌다. 테스트는 한 글자도 고치지 않았다.

**Task 계약 대조** — `ERR_ACCESS_DENIED` 는 `EPERM` 이 아니므로 계약상 값은
`environment` 다. **테스트가 옳았고 코드가 그것을 만들지 못했다.**

## 7. Change Size

| 지표 | 값 | 종류 |
|---|---:|---|
| **`src/workflow.ts`** | **178줄 (신규)** | Measured — 상한 200 |
| `src/cli.ts` | 358 → **393** (+36 / −1) | Measured |
| `src/runner.ts` | 245 → **248** (+3) | Measured — 환경 변수 주입 |
| `src/context.ts` | 165 → 165 (**무변경**) | Measured |
| `tests/cli.test.ts` | 1,314 → **1,584** (+270) | Measured |
| `docs/benchmarks/TELEMETRY.md` | +24줄, **삭제 0줄** | Measured |
| **`src/` 총 LOC** | **984** | Measured |
| Report LOC | 270 | Measured |
| **새 소스 파일** | **1** | Measured |
| `src/workflow.ts` 의 class 수 | **0** | Measured |
| `src/` 하위 디렉터리 | 0 | Measured |
| **Runtime dependencies** | **0** | Measured |
| devDependencies | 2 | Measured |

**`workflow.ts` 가 `events.jsonl` 이나 `state.json` 을 직접 쓰지 않는다** —
전이는 기존 `task start` / `task submit` 을 자식 프로세스로 재사용한다.
상태 전이 로직이 복제되지 않았다.

## 8. Telemetry

| 지표 | 값 | 종류 |
|---|---:|---|
| **TELEMETRY.md 필드 수** | **84 → 96** | Measured |
| 추가된 필드 행 | 13 (키 12개) | Measured |
| 요구된 새 키 | 11 | Measured |
| 추가된 blocked 키 | 1 (`workflow_resume_count`) | Measured — AC 70 요구 |
| 기존 필드 삭제 | **0줄** | Measured |
| 계산 필드 정의 | **0** | Measured |
| Runner + Orchestrator가 출력하는 필드 | 28 | Measured |
| 파일에 기록되는 Telemetry | **0** | Measured — stdout 전용 |

**여전히 `N/A` 인 것** — token 4개 · cost 4개 · `context_tokens`(T-012),
`review_start_time` · `rework_count` · Quality 산문 필드(blocked),
`human_*` 전체(manual), `workflow_resume_count`(blocked).

## 9. Context (Worker 측)

| 지표 | 값 | 종류 |
|---|---:|---|
| Files Allowed (Read List) | 8 | Measured |
| Files Read | 8 | Measured (자기보고) |
| **Read List 밖 접근** | **0** | Measured (자기보고) — 일곱 Task 연속 |
| Context files / chars (승인 시점) | 8 / 128,287 | Measured |
| Context SHA-256 | `04e5afbef66975bd…` | Measured |
| tracked 파일 수 | 75 | Measured |
| Read Scope Ratio | 10.7% | Derived — 8 / 75 |
| **hand-written Worker Prompt** | **0** | Measured — T-009 이후 첫 Task |

**T-010은 Task 문서와 `AGENTS.md` 만으로 실행된 첫 Task다.**
`.bcos/prompts/T-010-*` 가 존재하지 않는다.

## 10. 열 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-001 | T-002 | T-003 | T-005 | T-004 | T-006 | T-007 | T-008 | T-009 | T-010 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 성격 | 생성 | 2줄 | 전이1 | 버그 | 전이2 | 전이3 | Context | 실행 | 제거 | **묶기** |
| AC | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 | 24/24 | 32/32 | 46/46 | 62/62 | **87/87** |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | 31/31 | 46/46 | 66/66 | 90/90 | 99/99 | **129/129** |
| `src/` LOC | 18 | 18 | 154 | 159 | 234 | 303 | 483 | 729 | 768 | **984** |
| Attempts | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **Rework** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | **1** |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Env failures | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | **1** |
| 사후 복구 필요 | yes | yes | yes | yes | no | no | no | no | no | **no** |

**열 Task 연속 1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0.**
**재작업은 두 Task 연속이고 두 번 다 원인이 worker의 자기 검증 불가였다.**

## 11. 지금 쓸 수 있는 사실

- **한 명령으로 `start` → `run` → 검증 → `submit` 이 일어난다.** 사람이 입력한 명령은
  `task execute` 하나였다.
- **검증이 실패하면 제출되지 않는다.** Task는 `IN_PROGRESS` 로 남고 Report가 보존된다.
- **중첩 worker와 자식 생성 거부 환경에서 lifecycle이 전혀 움직이지 않는다.**
  worker·verifier 마커 파일이 생기지 않는 것으로 확인했다.
- **`--verify-only` 는 worker를 띄우지 않는다.** `runner_invocations=0` 이다.
- **`task run` 이 자식에게 `BCOS_WORKER_SESSION=1` 을 전달한다.**
- Telemetry 출력에 절대경로가 없고 `verification_command` 는 논리 값이다.
- 새 파일 1개, class 0개, 런타임 의존성 0, `src/` 하위 디렉터리 0.
- 테스트는 실제 Codex에 의존하지 않는다 — `PATH` 제거 후에도 129/129.

## 12. 아직 쓸 수 없는 주장

- **"workflow 자동화 완료"** — Review·verdict·재작업·`approve`·commit이 전부 사람이다.
- **"실제 Codex로 workflow를 완주했다"** — `task execute` 로 실제 Codex를 돌린 적이
  없다. T-010 자신도 T-009 방식으로 구현됐다.
- **"nested Codex 문제 해결"** — worker가 `npm test` 를 직접 실행하는 것은 막을 수 없다.
- **"토큰·비용 절감"** — 전 필드 `N/A` 다.
- **"사람 개입 N% 감소"** — 4 → 1은 절대 수치이며 비교군이 없다.

## 13. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| **Report 신뢰성** | Report가 실패를 선언해도 submit 통과 (Review F-1, **두 Task 연속**) | **T-011** 최우선 |
| **Report 소유권** | 재작업 피드백을 누가 어디 적는지 미정 (F-2, 두 번째) | **T-011** |
| Reviewer 자동화 | Review·verdict·재작업이 전부 사람 | **T-011** |
| `verify()` 예외 처리 | probe와 같은 결함이 남아 있음 (F-3) | T-011 또는 별도 정리 |
| `task execute` 실사용 | 실제 Codex로 돌린 적 없음 | 다음 Task를 `task execute` 로 실행 |
| token · cost | 전 필드 `N/A` | **T-012 Model Adapter** |
| 두 번째 worker | 없음 | **T-013** |
| Telemetry 저장 | stdout 전용 | **T-014 Benchmark Harness** |
| 공정성 6문제 | 미해결 | **T-014** 착수 조건 |
| 8,000자 기준 | 실측 다섯 건 모두 초과 (이번 128,287자) | 근거 축적 후 재조정 |
