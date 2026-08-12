---
task: T-013
---

# Review — T-013 Model Adapter

## Attempt 1 — 2026-08-11T05:23:54Z — CHANGES_REQUESTED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli`
**Separation of Duties:** satisfied — 승인자와 제출자가 다르다 (RFC-001 G5).

리팩터링 자체는 견고하다. 경계는 정확히 요구한 자리에 생겼고, worker stdin은
바이트 단위로 불변이며, 테스트는 214/214 통과한다. **그럼에도 CHANGES_REQUESTED다.**
확인된 두 결함이 모두 데이터 계약과 AC 보장에 관한 것이기 때문이다.

---

## 판정 요약

| | |
|---|---|
| **Verdict** | **CHANGES_REQUESTED** |
| Blocking | **2** (F-1 data contract defect · F-2 AC coverage defect) |
| Major | 0 |
| Minor | 2 |
| Info | 3 |
| Host Verification (독립 재현) | build exit 0 · **214 / 214 pass · fail 0 · skip 0 · todo 0** |
| Expected Files 밖 변경 | **0건** |

---

## F-1 — `worker_runtime` / `reviewer_runtime` semantic collision (**Blocking**)

**분류: data contract defect. naming 문제가 아니다.**

### 각 값의 정확한 출처

| 위치 | 코드 | 값 |
|---|---|---|
| stdout telemetry | `src/runner.ts:179` `worker_runtime: result.runtimeKind` | **`node`** |
| run artifact | `src/workflow.ts:226,286` `run.worker_runtime = workerResult.runtime` | **`codex`** |
| stdout telemetry | `src/workflow.ts:131` `fields.reviewer_runtime = reviewResult.runtime` → `src/reviewer.ts:80` `runtime: result.runtimeKind` | **`native`** \| `node` |
| run artifact | `src/workflow.ts:262` `run.reviewer_runtime = options.reviewer` | **`claude`** |

`src/model.ts:9`가 두 개념을 **정확히 분리해 정의**하고 있다 —
`runtime: ModelRuntime` (`codex` \| `claude`, 어느 실행기인가)와
`runtimeKind: "node" | "native"` (어떻게 띄웠는가). Adapter 내부는 옳다.

**문제는 두 개념이 파일 밖으로 나갈 때 같은 키 이름을 쓴다는 것이다.**

### 기존 telemetry 계약이 이미 이 이름을 정의하고 있다

`docs/benchmarks/TELEMETRY.md:133-134` — **T-009에서 확정된 규범**이다.

```
| `worker_name`    | 문자열 | `--worker` 값                        | now    |
| `worker_runtime` | 문자열 | worker 실행 형태. 예: `node <codex.js>` | T-009 |
```

`docs/benchmarks/TELEMETRY.md:276-277`도 같은 구조다 —
`reviewer_name` = `--reviewer` 값, `reviewer_runtime` = "reviewer 실행 형태".

**즉 `worker_runtime`은 "실행 형태"라는 규범 정의를 이미 가지고 있고,
`codex`라는 값에 해당하는 규범 키는 `worker_name`이다.**

### 판정

**stdout telemetry는 결백하다.** `worker_runtime=node`는 T-009 정의 그대로이고,
값도 리팩터링 전(하드코딩 `"node"`)과 동일하다. `reviewer_runtime`도 동일하다.
**기존 telemetry 계약은 100% 보존됐다** (AC 71·72·73 충족).

**결함은 전적으로 신규 run artifact 쪽이다.** artifact의 `worker_runtime` /
`reviewer_runtime`은 **TELEMETRY.md가 `worker_name` / `reviewer_name`에 부여한 값**을
담고 있다. 같은 이름, 다른 의미다.

### Task Contract가 의도한 의미 — 결함의 출처는 설계다

T-013 Task `Scope §6` 표는 `runtime` = `codex` \| `claude`로 정의했고,
`Scope §8`은 artifact 필드 이름을 `worker_runtime`으로 지정했다.

**worker는 Task Contract를 정확히 구현했다.** 결함은 설계가 `worker_runtime`이라는
이름이 TELEMETRY.md에서 이미 다른 뜻으로 확정돼 있다는 사실을 확인하지 않고
그 이름을 재사용한 데 있다. **worker의 판단 착오가 아니다.**

### T-016 Benchmark Harness에서의 ambiguity — 실재한다

T-012가 확립한 원칙은 **stdout은 휘발하고 artifact가 영속 기록**이라는 것이다.
따라서 Benchmark Harness는 **artifact를 읽는다.** 그때 harness는
`worker_runtime` 키에서 `codex`를 읽고, TELEMETRY.md는 그 키가
`node <codex.js>` 형태의 값이라고 말한다.

**충돌하지 않고 조용히 어긋난다.** 예외도 파싱 오류도 나지 않는다.
arm을 runtime으로 분류하는 순간 결과가 틀어지고, 그 사실이 드러나지 않는다.
T-015 이후 worker가 실제로 교체되면 `node` / `native`와 `codex` / `claude`가
같은 컬럼에 섞여 들어간다.

### 최소 수정안 (Review에서 코드는 수정하지 않았다)

**artifact 필드 이름을 값의 의미에 맞춘다. 값과 로직은 그대로 둔다.**

| 파일 | 변경 |
|---|---|
| `src/run.ts` | `RunRecord`의 `worker_runtime?` → `worker_name?`, `reviewer_runtime?` → `reviewer_name?`. `worker_version?` · `reviewer_version?`는 **그대로** (충돌 없는 신규 키) |
| `src/workflow.ts:226,286` | `run.worker_name = workerResult.runtime` — **우변 불변** |
| `src/workflow.ts:262` | `run.reviewer_name = options.reviewer` — **우변 불변** |
| `src/cli.ts:440-441` | 읽는 필드명만 교체. 출력 라벨 `Worker:` / `Reviewer:`는 **그대로** |
| `docs/benchmarks/TELEMETRY.md` | run artifact가 `worker_name` · `worker_version` · `reviewer_name` · `reviewer_version`을 담고, `*_name`의 뜻이 telemetry의 동명 키와 **같다**고 명시 |

**대안 기각 근거** — artifact 값을 `runtimeKind`(`node`)로 바꾸는 방향은,
artifact만으로 codex와 claude를 구별할 수 없게 만들어 Task `Scope §8`의 목적
자체를 무효화한다. 채택하지 않는다.

`runtimeKind`를 artifact에 별도 필드로 추가하는 것도 **하지 마라.** 벤치마크에
필요한 것은 "어느 실행기를 어느 버전으로 썼는가"이고, 그것은 `*_name` +
`*_version`으로 충분하다. 필드를 늘리는 것은 Ponytail 위반이다.

### 보존해야 할 것

- stdout telemetry의 `worker_runtime` / `reviewer_runtime` 키와 값 — **손대지 마라.**
  T-009·T-011 계약이고 `telemetryKeys` 테스트가 지키고 있다.
- `src/model.ts`의 `runtime` / `runtimeKind` 구분 — **정확하다.** 그대로 둔다.
- `worker_version` / `reviewer_version` 이름과 `override` · `unknown` 규칙.

---

## F-2 — run artifact 통합에 자동 검증이 전혀 없다 (**Blocking**)

### 계획 대비 실제

Task `Test Requirements`는 30개 행동을 번호로 지정했다. 실제 신규는 28개이며,
**지정된 30개 중 25개 구현 · 5개 누락 · 미지정 3개 추가**다.

| 계획 | 행동 | 실제 |
|---|---|---|
| #25 | run artifact에 `worker_runtime`이 기록된다 | **없음** |
| #26 | run artifact에 `reviewer_runtime`이 기록된다 | **없음** |
| #27 | review 없는 실행에 `reviewer_runtime`이 부재다 | **없음** |
| #29 | `task status`가 worker runtime/version을 출력한다 | **없음** |
| #30 | `--dry-run` stdin SHA-256이 리팩터링 전 값과 같다 | **없음** |

실측 근거:

```
tests/cli.test.ts   worker_runtime   1건 — 1215행 telemetryKeys 목록 (T-009 기존)
                    worker_version   0건
                    reviewer_runtime 0건
                    reviewer_version 0건
                    "Worker: "       0건
```

**신규 28개는 전부 `modelCommand()` / `runModel()`을 직접 호출하는 단위 테스트다.**
`task execute` → workflow → artifact → `task status` 경로를 타는 것이 하나도 없다.

### 왜 하한 충족으로 승인할 수 없는가

Task는 "신규 28개 이상"이라는 수치 하한과 30개 행동 표를 **함께** 규정했다.
수치 하한은 충족됐다. 그러나 누락된 5개는 **다음 6개 AC의 유일한 검증 수단**이었다.

| AC | 내용 | 현재 증거 |
|---|---|---|
| 59 | artifact가 worker/reviewer runtime을 별도 필드로 담는다 | **없음** |
| 62 | worker stage 이후 `worker_runtime` 기록 | **없음** |
| 63 | review stage 이후 `reviewer_runtime` 기록 | **없음** |
| 64 | review 없는 실행에서 `reviewer_runtime` 부재 | **없음** |
| 65 | version 실패 시 `unknown`이고 실행은 계속 | **없음** |
| 67·68 | `task status`의 Worker / Reviewer 출력 | **없음** |

**6개 AC가 충족으로 보고됐으나 회귀를 잡을 장치가 하나도 없다.**

더 나쁜 것은 실행 증거도 없다는 점이다. T-013 자신의 run artifact
(`20260811T024107822Z-5508931f.json`)에는 **그 필드들이 아예 없다.**
따라서 제출 시점에 이 기능이 동작한다는 증거는 코드 읽기 외에 존재하지 않았다.

Reviewer가 격리 미러에서 신 빌드로 직접 실행해 동작을 확인했다 —
`"worker_runtime": "codex"`, `"worker_version": "override"`,
`reviewer_runtime` 부재, `task status` → `Worker: codex override`.
**기능은 동작한다. 그러나 그것을 확인하는 데 수동 실험이 필요했다는 사실 자체가
AC 보장이 비어 있다는 증거다.**

### Report 미기재

Report `Deviations`는 EPERM만 다루고 **계획 테스트 5개 누락을 언급하지 않는다.**
"Added worker/reviewer runtime and version fields to workflow run records and
status output"이라고만 적혀 있어, 그 경로가 미검증이라는 사실이 드러나지 않는다.
RFC-001 §4의 증거 원칙상 이것은 기재됐어야 한다.

### 최소 수정안

`tests/cli.test.ts`에 **통합 경로 테스트 5개**를 추가한다. 기존 `task execute`
fixture 헬퍼(`runExecute` · `workflowRun` · `workflowRunFiles`)를 재사용한다.
**새 헬퍼도 새 프레임워크도 만들지 마라.**

1. `task execute`(fake worker) 후 artifact에 `worker_name`이 `codex`, `worker_version`이 `override`다
2. `task execute --review`(fake reviewer) 후 artifact에 `reviewer_name`이 `claude`다
3. review 없는 실행의 artifact에 `reviewer_name` · `reviewer_version`이 **부재**다 (빈 문자열·`null`·`0` 아님)
4. `task status`가 `Worker: codex override`를 출력한다
5. `task status`가 reviewer 없는 실행에서 `Reviewer:` 줄을 출력하지 않는다

계획 #30(stdin SHA 기준선)은 **테스트로 만들지 마라.** 고정 SHA는 Read List가
바뀔 때마다 깨지는 취약한 단언이다. Reviewer가 이미 동등한 검증을 수행했고
(아래 B절), 그 증거를 Report에 인용하는 것으로 충분하다. **계획을 그대로 되살리는
대신 이 판단을 기록한다.**

목표 총계는 **219개**가 된다 (214 + 5). AC 88의 하한 214는 그대로 만족한다.

### 보존해야 할 것

- 신규 28개 단위 테스트 — **훌륭하다. 하나도 건드리지 마라.**
- 기존 186개 — 삭제·skip·완화 금지.
- fixture는 실제 Codex / Claude를 호출하지 않는다.

---

## 독립 검증 A — Model Adapter boundary

**통과.** `src/model.ts` 113줄 / 상한 140.

금지 문자열 **20종 전부 0건** — `class` · `interface` · `extends` · `implements` ·
`registry` · `plugin` · `inject` · `container` · `.bcos` · `attempt` · `verdict` ·
`APPROVED` · `CHANGES_REQUESTED` · `lifecycle` · `actor_id` · `actorId` ·
`console.log("telemetry` · `writeFileSync` · `renameSync` · `mkdirSync`.

import는 `node:child_process` · `node:fs` · `node:path` **3개뿐.**
`nested_worker` · `verdict_unreadable` 등 workflow ExitReason 문자열 0건 —
**모델 오류를 상태 머신으로 번역하지 않는다** (AC 44 충족).

**spawn 중복 실제 제거 확인** — `spawn(` 직접 호출: `runner.ts` **0** ·
`reviewer.ts` **0** · `model.ts` **1**. `runner.ts` + `reviewer.ts` 합계
**356 → 267줄 (−89)**. src 순증은 +34줄뿐이다 (113줄 신규 파일 대비).

registry / plugin / DI / class hierarchy **생기지 않았다.**

---

## 독립 검증 B — Behavioral compatibility

**통과.** 핵심 증거는 리팩터링 **전**에 확보한 기준선이다.

구현 착수 전 저장소 사본에 T-013을 `IN_PROGRESS`로 두고 구 빌드로 `--dry-run`을
실행해 지문을 떴다. 구현 후 **같은 사본(구 소스 그대로)에 새 빌드만 넣어** 재측정했다.

```
구 dist  b43847245009b4470e90b27603226f111d411c2d8ce3bc7ca55b263aa57ac651
신 dist  b43847245009b4470e90b27603226f111d411c2d8ce3bc7ca55b263aa57ac651
196,454자 · 4,892줄 · Context SHA 동일
```

**동일 입력에 대해 바이트 단위로 일치한다.** Context Package에 절대경로가 0건이라
이 SHA는 경로 독립이며, 따라서 비교가 성립한다.

argv도 `["<codex.js>","exec","-","--cd","<root>"]`로 동일하다.
stdout/stderr 전달은 `src/model.ts:98-99`에서 `process.stdout.write` /
`process.stderr.write`로 유지된다. timeout · exit · first response · byte counting은
신규 단위 테스트 19–22, 12–15가 직접 검증한다. **회귀 없음.**

CLI contract 변경 0건 — 새 옵션 없음, `--worker claude` 거부 유지,
`--reviewer codex` 거부 유지 (AC 54·55).

---

## 독립 검증 C — Observability

**부분 통과.**

**T-012 이후 최초로 workflow 시작 시점부터 artifact가 생성됐다.** 워크플로 시작
직후 `start: success` · `worker: running`으로 파일이 존재했고, 5개 stage가
`success`로 끝까지 기록됐다. **T-012가 자신에게 적용하지 못했던 부트스트랩 공백은
닫혔다.**

**최초 실행 artifact에 runtime/version이 없는 것은 실제 부트스트랩 특성이다 — 확인함.**
`dist/workflow.js` 재빌드 시각은 `2026-08-11 11:49:28 KST` = **02:49:28 UTC**이고,
워크플로 프로세스는 **02:41:07 UTC**에 구 코드를 적재한 채 02:52:22까지 실행됐다.
이미 로드된 프로세스는 새 코드를 쓰지 않는다. **구현 결함이 아니다.**

**새 빌드에서 기록은 정상 동작한다 — 격리 미러에서 확인함** (F-2 참조).

**빈 값을 0이나 임의 값으로 채우지 않는다 — 확인함.** review를 쓰지 않은 실행의
artifact에 `reviewer_runtime` · `reviewer_version`이 **부재**하고, 빈 문자열이나
`null`로 채워지지 않는다. `task status`도 해당 줄을 출력하지 않는다.
`firstResponseMs`도 출력이 없으면 부재다 (신규 테스트 15).

**단, C의 이 결론들은 전부 Reviewer의 수동 실험에 의존한다** — 이것이 F-2다.

---

## 독립 검증 D — Scope

**통과.** `src/*.ts` 전체 기준.

| 금지 항목 | 실측 |
|---|---|
| Token 수집 (`input_tokens` · `output_tokens`) | **0건** |
| Cost (`total_cost` · `pricing`) | **0건** |
| `--json` · `output-format json` | **0건** |
| Verification Failure Feedback | **0건** |
| Multi-model switching | 미개방 — `worker !== "codex"` · `reviewer !== "claude"` 거부 유지 |
| dependency | **0개** (devDeps 2, `package-lock.json` 변경 0건) |

TELEMETRY.md는 token/cost를 `blocked` + 사유로 정정했고 **pricing table이 없다.**
낡은 `T-010 Model Adapter` 전방 참조 **0건**. 고유 키 **103 → 103, 삭제 0건**
(표 행 107 → 106은 `T-010` 가용성 범례 행이 `blocked`로 흡수된 것이며 키 삭제가 아니다).

**Ponytail 위반 없음.** 새 source file 1개, 디렉터리 0개, class 0개,
`workflow.ts` 313 / 상한 325, `run.ts` 70 / 90, `cli.ts` 476 / 495.
상한 상향 조건도 충족한다 — `workflow.ts`의 `codex`/`claude` 문자열 **3 → 3, 불변.**

Expected Files 밖 변경 **0건.** `src/context.ts` 무변경 (AC 80).

---

## 독립 검증 E — Regression

**Reviewer가 직접 실행했다.**

```text
npm.cmd run build   → Exit code 0
npm.cmd test        → tests 214 · pass 214 · fail 0 · skipped 0 · todo 0
```

**214 / 214 독립 재현 완료.** 삭제·skip 0건.

---

## Minor / Info

**M-1 (Minor)** — Report `Deviations`가 계획 테스트 5개 누락을 기재하지 않았다.
EPERM은 정직하게 기재했고 "must not be reported as complete"라고까지 적었으나,
계획 대비 축소는 누락됐다. RFC-001 §4 증거 원칙상 기재 대상이다.

**M-2 (Minor)** — AC 38·39(부모 stdout/stderr 전달)를 **직접** 검증하는 테스트가 없다.
신규 12·13은 바이트 계수만 단언한다. 다만 `model.ts:98-99`는 worker와 reviewer가
공유하는 단일 경로이고 기존 `task execute` 테스트가 worker 출력을 통해 이를
간접 검증하므로 실질 위험은 낮다. **F-2 수정 시 함께 다룰 필요는 없다.**

**I-1** — Worker 샌드박스 `spawn EPERM` **6개 Task 연속.** 이번에도 worker는 suite를
돌리지 못했고 Report에 그대로 적었다. 환경 실패이지 코드 실패가 아니다.
Host 검증이 대신했다. 반복되는 이 조건은 별도 판단 대상이다.

**I-2** — `reviewer_runtime`이 telemetry에서 `native`\|`node`인데 `reviewer_name`은
`claude`다. F-1 수정 후에는 artifact와 telemetry가 `*_name`에서 일치하고
`*_runtime`은 telemetry에만 남는다. **이것이 올바른 최종 형태다.**

**I-3** — 이번 실행의 run artifact는 T-013 구현 이전 코드가 썼으므로,
**전 구간이 새 코드로 관측되는 첫 workflow는 다음 실행이다.** T-012에서 기록한
부트스트랩 한계가 한 단계 좁아진 형태로 재현됐다. 재작업 실행이 그것을 해소한다.

---

## Required Changes (최소 범위)

1. **`src/run.ts`** — `RunRecord`: `worker_runtime?` → `worker_name?`,
   `reviewer_runtime?` → `reviewer_name?`. `*_version`은 그대로.
2. **`src/workflow.ts:226,262,286`** — 좌변 필드명만 교체. **우변 표현식 불변.**
3. **`src/cli.ts:440-441`** — 읽는 필드명만 교체. 출력 라벨 불변.
4. **`docs/benchmarks/TELEMETRY.md`** — run artifact가 담는 4개 필드를 명시하고,
   `*_name`이 telemetry 동명 키와 같은 뜻임을 적는다.
5. **`tests/cli.test.ts`** — 통합 테스트 5개 추가 (F-2에 목록). 총 **219개**.

**하지 마라** — stdout telemetry 키·값 변경 · `model.ts`의 `runtime`/`runtimeKind`
구분 변경 · artifact에 `runtimeKind` 필드 추가 · 기존 테스트 수정 · 새 헬퍼나
프레임워크 도입 · Token/Cost 착수 · Verification Failure Feedback 착수 ·
multi-model switching 개방 · RFC-001 개정.

**재작업 범위는 위 5개 파일뿐이다.** `src/model.ts` · `src/runner.ts` ·
`src/reviewer.ts` · `src/context.ts`는 **건드리지 마라 — 옳다.**

---

## 총평

**리팩터링으로서 이 구현은 성공했다.** 110줄의 실행 메커니즘이 113줄짜리 파일
하나로 모였고 runner·reviewer에서 89줄이 사라졌다. 경계는 새지 않는다 —
Adapter는 Task도 lifecycle도 verdict도 actor_id도 모르고, `.bcos`에 손대지 않는다.
worker에게 가는 바이트는 완전히 동일하다. 능력 격차 두 개(reviewer의 바이트 계수와
first response)는 설계가 예상한 대로 통합의 부산물로 메워졌다.

**막는 것은 리팩터링이 아니라 그 위에 새로 얹은 관측 필드다.**
이름 하나가 이미 다른 뜻으로 확정돼 있었고, 그 사실을 설계가 놓쳤다.
그리고 그 필드들을 지키는 테스트가 하나도 없어서, 동작한다는 것을 확인하는 데
Reviewer의 수동 실험이 필요했다.

두 결함 모두 **값이나 로직이 아니라 이름과 증거의 문제**다. 수정 범위는 작다.

---

## Attempt 2 — 2026-08-11T06:07:51Z — BLOCKED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli` (SoD 충족, G5)

**이 판정은 구현 품질에 대한 것이 아니다.** Attempt 2의 구현은 요구한 대로 정확하다.
판정이 `BLOCKED`인 이유는 **현재 프로토콜로는 이 상태에서 합법적인
`APPROVED` / `CHANGES_REQUESTED`를 낼 수 없기 때문**이다. 근거는 §12–§13에 있다.

**주의 — `BLOCKED`는 RFC-001 §4가 정의한 세 판정 중 하나지만,
§1.2 전이표에 `IMPLEMENTED → BLOCKED`가 없다.** 따라서 이 판정은
lifecycle 명령으로 집행할 수 없으며, **집행하지 않았다.**
`approve`도 `request-changes`도 실행하지 않았다. Task는 `IMPLEMENTED / attempt 2`
그대로다. 이 문서는 사람의 판단을 요청하는 기록이다.

---

## 1. Attempt 2 Rework 검증 — Required Changes 대조

| Attempt 1 Review 요구 | 실제 | 판정 |
|---|---|---|
| `worker_runtime` → `worker_name` | `src/run.ts` `RunRecord.worker_name?` | 충족 |
| `reviewer_runtime` → `reviewer_name` | `RunRecord.reviewer_name?` | 충족 |
| `*_version` 유지 | `worker_version?` · `reviewer_version?` 그대로 | 충족 |
| workflow 우변 값 불변 | `run.worker_name = workerResult.runtime` (226·286) · `run.reviewer_name = options.reviewer` (262) — **우변 표현식 동일** | 충족 |
| `task status` 라벨 유지 | `Worker:` · `Reviewer:` (cli.ts 440-441) 라벨 불변 | 충족 |
| TELEMETRY.md 의미 명시 | 266–270행에 artifact 4필드와 `*_name` = telemetry 동명 키 명시 | 충족 |
| integration test 5개 | 추가됨 (§5) | 충족 |

**금지 파일 4개 무변경 — mtime으로 확인.** `src/model.ts` 11:49 · `src/runner.ts` 11:46 ·
`src/reviewer.ts` 11:46 · `src/context.ts` 2026-08-06.
Attempt 2 작업 창은 **14:39**이며 이 넷은 그 창에 걸리지 않는다.
수정된 것은 허용된 5개 파일뿐이다.

---

## 4. Semantic collision 해결 여부 — **해결됨**

| 매체 | 키 | 값 | 뜻 |
|---|---|---|---|
| stdout telemetry | `worker_name` | `codex` | 실행기 정체 (`--worker` 값) |
| stdout telemetry | `worker_runtime` | `node` | **실행 형태** — TELEMETRY.md:134 정의 그대로 |
| run artifact | `worker_name` | `codex` | 실행기 정체 — telemetry 동명 키와 **같은 뜻** |
| run artifact | `worker_version` | `0.146.0` (실측) / `override` | CLI 버전 |

**새 빌드에서 `artifact.worker_runtime`은 더 이상 생성되지 않는다** — 격리 실행으로
실물 artifact를 만들어 확인했다: `worker_runtime` **0건**, `worker_name: "codex"`,
`worker_version: "override"`, `task status` → `Worker: codex override`.

**같은 이름이 두 의미를 갖던 상태는 사라졌다.** F-1 해소.

`reviewer_name`도 telemetry(`workflow.ts:129`)와 artifact(`262`)가 **동일하게
`options.reviewer`** 에서 온다 — 값의 출처까지 일치한다.

---

## 5. Integration coverage — **단위 테스트 위장 아님**

신규 5개는 모두 `runExecute` / `runReviewExecute`(실제 `task execute` CLI 실행) →
`workflowRun`(실제 artifact 파일 읽기) → `runStatus`(실제 `task status` stdout)를 탄다.
`modelCommand()` / `runModel()` 직접 호출은 **한 건도 없다.**
경로 `CLI → workflow → model adapter → run artifact → task status`가 실제로 통과된다.

부재 검증도 정확하다 — `assert.equal("reviewer_name" in record, false)`는
**필드 자체의 부재**를 본다. 빈 문자열·null·0 허용이 아니다.

---

## 3. Feedback handoff — 검증됨

`src/runner.ts:108-110`이 `attempt >= 2`에서 Review 파일을
`--- REVIEW OF PREVIOUS ATTEMPT ---`로 자동 첨부한다.

실행 **전** 산술 검증: context 204,506자 + review 13,065자 + 구분자 37자 +
preamble 510자 = **218,118자 = dry-run 실측 stdin**.
실행 **후** 대조: 사전 dry-run의 `stdin_sha256 = 9d74ce6c…` 가 실제 worker
telemetry의 값과 **일치**. 즉 Review 원문이 그대로 worker에게 갔다.

**사람의 재요약·수동 전달·hand-written prompt는 0건이다.**

request-changes 이후 lifecycle도 프로토콜과 일치한다 —
`TASK_STARTED` 추가 **0건**, attempt **1 → 2** (§1.4: `request-changes`도 attempt를
증가시킨다), run artifact의 `start` stage = **`skipped`**.

---

## 7. Observability — attempt 2 run artifact

`execution_id 20260811T053859394Z-ea0e2943` · attempt 2 · `workflow_status success` ·
`current_stage submit` · stage 5개 success · `start` skipped ·
`worker_version 0.146.0` (**실제 Codex 버전이 실물 artifact에 처음 기록됨**).
artifact와 `task status` 출력이 모든 필드에서 일치한다.

**단, 이번 artifact의 키는 아직 `worker_runtime`이다.** 워크플로 프로세스가
rename 이전 빌드를 적재한 채 시작했기 때문이며 (attempt 1과 동일한 부트스트랩),
구현 결함이 아니다. 새 빌드 산출물은 위 §4에서 확인했다.

---

## 8. Task Contract에 남은 old naming — 실측 위치

| 행 | 내용 |
|---|---|
| 187 | Scope §8 표 — `worker_runtime` · `worker_version` |
| **337** | **AC 59** — artifact가 `worker_runtime`과 `reviewer_runtime`을 별도 필드로 담는다 |
| **343** | **AC 62** — worker stage 이후 artifact에 `worker_runtime`이 기록된다 |
| **344** | **AC 63** — review stage 이후 artifact에 `reviewer_runtime`이 기록된다 |
| 458 | Test Requirements #25 |
| 477·480 | Benchmark Telemetry 절 |

---

## 9–11. 규범 조사 (추측 없음, 원문 인용)

**RFC-001 §2.3 본문 동결**

> Task 본문과 `title`은 **첫 `TASK_STARTED` 시점에 동결된다.**
> 이후 변경 가능한 필드는 `status`, `attempt`, `updated`, `blocked_reason`뿐이다.
> 동결 후 명세를 바꿔야 하면 **새 Task를 만든다.**

**→ Task 본문 수정은 금지다.** "지금 Task를 `worker_name`으로 고치면 된다"는 해법은
프로토콜 위반이다. 규정된 구제책은 **새 Task**이며, 새 Task는 T-013의 AC를
소급해 바꾸지 못한다.

**동결은 실제로 지켜졌다** — Task 파일 diff는 `status` · `attempt` · `updated`
세 필드뿐이다. 본문 변경 0건. T-001~T-012의 관행도 이와 같다.

**RFC-001 §8.3 불일치 해소**

> **언제나 `tasks/*.md`가 이긴다.** `state.json`은 재생성하고, 이벤트 로그는 경고만 한다.

**→ 유일한 precedence 문장이지만 범위가 `state.json`·이벤트 로그다.**
Task ↔ TELEMETRY.md나 Task ↔ Review는 다루지 않는다.
문자 그대로 확장하면 **Task가 이긴다** — 즉 구현이 틀린 것이 된다.

**RFC-001 §4 Review Schema**

> 판정은 3개다 — `APPROVED` · `CHANGES_REQUESTED` · `BLOCKED`
> `Criteria Assessment`는 **모든** Acceptance Criteria를 항목별로 다뤄야 한다 (**MUST**).
> `APPROVED`인데 `FAIL` 항목이 있으면 모순이다 (`E_SCHEMA`).

**RFC-001 §1.2** — `block` 전이는 `TODO`·`IN_PROGRESS` → `BLOCKED`뿐이다.
`IMPLEMENTED → BLOCKED`는 표에 없고, **"표에 없는 전이는 전부 금지한다."**

**AGENTS.md:6** — "규범은 RFC-001 Core다."
**AGENTS.md:74** — worker는 재작업 시 "`Required Changes`를 읽고 3번부터 다시 한다."
**→ worker는 지시받은 대로 정확히 행동했다. worker에게 책임이 없다.**

**TELEMETRY.md** — 스스로를 규범이라 선언하지 않는다. CLAUDE.md의 문서 표에도
**등재되어 있지 않다**(0건). 다만 서두에 "**필드 정의가 Task 문서가 아니라 여기에
있다**"는 소유권 주장이 있고, 그 근거는 arm 간 비교 가능성이다.

**조사 결론 — 다음 중 어느 것도 규정되어 있지 않다.**

| 질문 | 규정 여부 |
|---|---|
| Task가 항상 Review보다 우선하는가 | **없음** |
| Review가 Task의 specification defect를 수정할 수 있는가 | **없음** |
| Human/Reviewer가 Task Contract exception을 승인할 수 있는가 | **없음** |
| Attempt 중 Task body를 수정할 수 있는가 | **금지 (§2.3)** |
| Task contract amendment 절차가 존재하는가 | **없음** — 구제책은 "새 Task"뿐 |

---

## 12. Specification conflict 분석

**사실관계**

1. TELEMETRY.md는 T-009부터 `worker_runtime` = "실행 형태", `worker_name` =
   "`--worker` 값"으로 정의해 왔다.
2. T-013 Task는 artifact 필드명을 `worker_runtime`으로 지정했다 — **설계 착오이며,
   그 착오는 Attempt 1 Review가 스스로 인정하고 기록했다.**
3. Attempt 1 Review는 `worker_name`으로 변경을 요구했다.
4. Attempt 2 구현은 3을 따랐고, 그 결과 **AC 59 · 62 · 63이 문자 그대로 FAIL**이다.

**두 가지 독법이 모두 성립한다.**

- **문자 독법** — AC 62는 "artifact에 `worker_runtime`이 기록된다"는 **관찰 가능한
  문장**(§2.2)이다. 그런 이름의 필드는 없다. **FAIL.**
- **의도 독법** — AC가 겨냥한 행동(artifact가 worker/reviewer 실행기 정체를 별도
  필드로 보존)은 충족된다. **PASS.**

**의도 독법을 택하는 것 자체가 "Review가 Task의 문언을 대체할 수 있다"는
precedence를 새로 만드는 행위다.** §5의 조사 결과 그런 권한은 어디에도 없다.
Reviewer가 그것을 스스로 부여하면, 이 프로토콜이 막으려는 바로 그 임의 판단이 된다.

**동시에 문자 독법을 강제할 수도 없다.** `worker_runtime`으로 되돌리면
T-009부터의 TELEMETRY 정의를 깨고, F-1을 재도입한다. 그런 `Required Changes`는
**의도적으로 결함을 복구하라는 지시**이므로 낼 수 없다.

---

## 13. 현재 Protocol로 해결 가능한가 — **불가능**

| 경로 | 차단 사유 |
|---|---|
| `APPROVED` | §4 — FAIL 항목이 있는데 APPROVED는 `E_SCHEMA` 모순 |
| `CHANGES_REQUESTED` | 유일하게 가능한 Required Changes가 "TELEMETRY 규범을 깨라"가 된다 |
| Task 본문 수정 | §2.3 위반 |
| 새 Task 생성 | §2.3이 지정한 구제책이지만 **T-013의 AC를 소급 변경하지 못한다** |
| `BLOCKED` 집행 | §1.2에 `IMPLEMENTED → BLOCKED` 전이가 **없다** |

**네 개의 문이 모두 잠겨 있다. 이것은 구현의 문제가 아니라 프로토콜의 공백이다.**

---

## 14. Findings

**F-3 (Blocking · Protocol)** — **Task specification defect에 대한 정정 절차가 없다.**
RFC-001은 구현 결함(→ `request-changes`)과 명세 변경(→ 새 Task)은 다루지만,
**이미 시작된 Task의 명세 자체가 상위 정의와 충돌할 때**를 정의하지 않는다.
이번이 그 첫 사례다. 후속 개선 후보는 `TASK_SPEC_AMENDED` 이벤트 ·
`task amend-spec` 명령 · 원본 불변 + amendment artifact · Human 승인 예외 등이며,
**이번 Review에서 구현하지 않는다. 범용 amendment framework를 선제 설계하지도 않는다.**

**F-4 (Blocking · Protocol)** — **`IMPLEMENTED`에서 `BLOCKED`로 가는 전이가 없다.**
§4는 `BLOCKED`를 판정으로 정의하지만 §1.2 전이표는 `TODO`·`IN_PROGRESS`에서만
`block`을 허용한다. 따라서 Reviewer가 `BLOCKED`로 판정해도 집행할 방법이 없다.
판정 어휘와 전이표가 어긋나 있다.

**F-5 (Major · Reviewer 자신의 결함)** — **Attempt 1 Review는 RFC-001 §4의 MUST를
위반했다.** `Criteria Assessment`(모든 AC 항목별 표)가 없었다.
그 표를 만들었다면 AC 59·62·63과 Required Changes의 충돌이 **Attempt 1에서**
드러났을 것이고, 이 교착은 재작업 전에 발견됐을 것이다.
이번 Attempt 2 Review는 아래에 전체 AC 표를 포함한다.

**F-6 (Minor)** — Worker 샌드박스 `spawn EPERM` **7개 Task 연속.** 이번에도 worker는
suite를 돌리지 못했고 Report에 정직하게 기재했다. 환경 실패이며 코드 실패가 아니다.

**F-7 (Info)** — TELEMETRY.md는 "필드 정의가 Task 문서가 아니라 여기에 있다"고
소유권을 주장하지만, CLAUDE.md 문서 표에 등재되어 있지 않고 스스로를 규범이라
선언하지도 않는다. 이 문서의 지위를 명확히 하는 것이 F-3 해결의 전제다.

---

## Criteria Assessment (RFC-001 §4 MUST — 94항목 전수)

증거 표기: `M` 기계 검증(grep/wc/실행) · `T` 테스트 · `R` 실행 기록 · `X` 격리 실행

| # | 판정 | 근거 |
|---|---|---|
| 1 | PASS | M `model.ts` 113줄 ≤140 |
| 2 | PASS | M `class` 0건 |
| 3 | PASS | M import = `node:child_process`·`node:fs`·`node:path` 3개, deps 0 |
| 4 | PASS | M `./context.js`·`./run.js`·`./workflow.js` import 0건 |
| 5 | PASS | M `.bcos` 0건 |
| 6 | PASS | M `attempt`·`verdict`·`APPROVED`·`CHANGES_REQUESTED`·`lifecycle` 각 0건 |
| 7 | PASS | M `console.log("telemetry` 0건 |
| 8 | PASS | M `writeFileSync`·`renameSync`·`mkdirSync` 0건 |
| 9 | PASS | M `runner.ts` `spawn(` 0건 |
| 10 | PASS | M `reviewer.ts` `spawn(` 0건 |
| 11 | PASS | M 자체 타임아웃 0건 (`model.ts`가 유일 소유) |
| 12 | PASS | M 267줄 < 356 |
| 13 | PASS | M+X dry-run argv `["<codex.js>","exec","-","--cd","<root>"]` |
| 14 | PASS | T `runtimeKind === "node"` |
| 15 | PASS | T override 사용 / 미지정 시 PATH 순회 |
| 16 | PASS | T 부재 override → 오류 |
| 17 | PASS | T `not_found` |
| 18 | PASS | T worker env `BCOS_WORKER_SESSION=1` |
| 19 | PASS | T worker cwd |
| 20 | PASS | R 실물 artifact `worker_version 0.146.0` (spawn 0회 경로) |
| 21 | PASS | T Claude argv `["-p","--output-format","text"]` |
| 22 | PASS | T native 직접 실행 |
| 23 | PASS | T `.js` override → node 경유 |
| 24 | PASS | T `not_found` |
| 25 | PASS | T reviewer cwd |
| 26 | PASS | T reviewer env에 스탬프 없음 |
| 27 | PASS | M `--version` 프로브 경로 존재 (실 Claude 미실행 — F-7 인접) |
| 28 | PASS | T stdin 전달, argv에 프롬프트 없음 |
| 29 | PASS | T 공통 결과 형태 테스트 |
| 30 | PASS | T `exitCode` 정수 |
| 31 | PASS | T duration 정수 0 이상 |
| 32 | PASS | R `worker_stdout_bytes=543` |
| 33 | PASS | T reviewer stdoutBytes |
| 34 | PASS | T reviewer stderrBytes |
| 35 | PASS | T reviewer firstResponse |
| 36 | PASS | T 출력 없으면 부재 |
| 37 | PASS | T boolean |
| 38 | PASS | M `process.stdout.write` (model.ts:99) + R 실행 중 출력 도달 |
| 39 | PASS | M `process.stderr.write` (model.ts:98) + R stderr 448,476 B 전달 |
| 40 | PASS | M 결과 객체에 절대경로 없음 |
| 41 | PASS | T 5종 구분 |
| 42 | PASS | T spawn 실패와 nonzero exit 구분 |
| 43 | PASS | T `errorCode` 있을 때만 |
| 44 | PASS | M `nested_worker`·`verdict_unreadable`·`review_cycles_exhausted` 0건 |
| 45 | PASS | T kill + `timedOut` |
| 46 | PASS | T `onTimeout` 호출 |
| 47 | PASS | M EPERM 분기 유지 |
| 48 | PASS | M `shell: false` 2건 / `shell: true` 0건 |
| 49 | PASS | M `cmd /c`·`powershell`·`/bin/sh` 0건 |
| 50 | PASS | M 우회 옵션 문자열 0건 |
| 51 | PASS | R telemetry 라인 내 홈 경로 0건 |
| 52 | PASS | R artifact 홈 경로 0건 |
| 53 | PASS | R 프롬프트·Context·stdout 본문 0건 |
| 54 | PASS | M+T `--worker claude` 거부 유지 |
| 55 | PASS | M+T `--reviewer codex` 거부 유지 |
| 56 | PASS | M actor id 동일 시 거부 유지 |
| 57 | PASS | M 역할 이름 분기 0건 |
| 58 | PASS | M `actor_id`·`actorId` 0건 |
| **59** | **FAIL (문자)** | artifact 필드명이 `worker_name`/`reviewer_name`이다. **의도 독법으로는 PASS** — §12 |
| 60 | PASS | T+X override 실행에서 `override` |
| 61 | PASS | M T-012 기존 필드·stage 8종 불변 |
| **62** | **FAIL (문자)** | `worker_name`으로 기록된다. **의도 독법 PASS** — §12 |
| **63** | **FAIL (문자)** | `reviewer_name`으로 기록된다. **의도 독법 PASS** — §12 |
| 64 | PASS | T `"reviewer_name" in record === false` — 빈 값 아님 |
| 65 | PASS | M `unknown` 폴백 존재, 실행 차단 없음 |
| 66 | PASS | M `model.ts` 파일 쓰기 0건 |
| 67 | PASS | T+X `Worker: codex override` |
| 68 | PASS | T reviewer 없으면 `Reviewer:` 줄 없음 |
| 69 | PASS | X stdin SHA `b438472…` **양 attempt 모두 기준선과 동일** |
| 70 | PASS | X command·args·cwd 동일 |
| 71 | PASS | T `telemetryKeys` 목록 불변 |
| 72 | PASS | T execute telemetry 키 불변 |
| 73 | PASS | T `--review` 키 불변 |
| 74 | PASS | **R 실제 dogfooding** — request-changes → rework → submit 성공 |
| 75 | PASS | T `runner_invocations=0` |
| 76 | PASS | T 기존 테스트 유지 |
| 77 | PASS | T nested 가드 |
| 78 | PASS | M `spawnSync` probe 3건 유지 |
| 79 | PASS | T+R T-012 회귀 없음 |
| 80 | PASS | M `context.ts` diff 0건 |
| 81 | PASS | M 신규 source file 1개 |
| 82 | PASS | M src 하위 디렉터리 0개 |
| 83 | PASS | M workflow 313 ≤325 |
| 84 | PASS | M run 70 ≤90 |
| 85 | PASS | M cli 476 ≤495 |
| 86 | PASS | M deps 0 / devDeps 2 |
| 87 | PASS | **Reviewer 직접 실행** — build exit 0 |
| 88 | PASS | **Reviewer 직접 실행** — 219 tests, 219 pass, 0 fail (214 이상) |
| 89 | PASS | M skip/todo 0건 |
| 90 | PASS | M `T-010 Model Adapter` 0건 |
| 91 | PASS | M token/cost `blocked` + 사유 기재 |
| 92 | PASS | M pricing table 0건 |
| 93 | PASS | M 고유 키 103 → 103, 삭제 0건 |
| 94 | PASS | M architecture에 `model.ts` 1건 |

**집계 — PASS 91 · FAIL 3 (문자 독법) · 의도 독법 적용 시 FAIL 0.**
FAIL 3건은 모두 동일 원인(§12)이며 서로 독립적이지 않다.

---

## Required Changes

**없다 — 의도적으로 비워 둔다.**

RFC-001 §4는 `CHANGES_REQUESTED`에 `Required Changes`를 요구하지만,
**이 판정은 `CHANGES_REQUESTED`가 아니다.** 구현에 고칠 것이 없기 때문이다.
worker에게 내릴 수 있는 유일한 지시가 "TELEMETRY 규범을 깨라"이므로 지시하지 않는다.

**필요한 것은 코드 변경이 아니라 사람의 결정이다.**

---

## Verdict

**BLOCKED — HUMAN / PROTOCOL ESCALATION**

구현은 기술적으로 옳다. 그러나 **현재 프로토콜만으로는 합법적인 `APPROVED` 판단을
내릴 수 없다.** AC 59·62·63이 문자 그대로 FAIL이고, §4는 FAIL이 있는 APPROVED를
`E_SCHEMA` 모순으로 규정하며, 그 FAIL을 없앨 모든 경로가 §2.3 또는 §1.2에 막혀 있다.

**사람이 선택할 수 있는 것(이 Review는 어느 것도 선택하지 않는다)**

1. **Human이 예외를 승인한다** — `actor_role: human`으로 이 Task에 한해 AC 59·62·63을
   상위 규범 충돌에 따른 무효로 선언하고, Human 명의의 `APPROVED` Review 항목을
   추가한 뒤 `approve`한다. **이 경로를 쓰려면 그 권한이 어디서 오는지 함께
   기록해야 한다 — 현재 RFC에 없다.**
2. **RFC-001을 먼저 개정한다** — F-3(명세 정정 절차)과 F-4(`IMPLEMENTED → BLOCKED`)를
   메운 뒤 그 절차로 T-013을 처리한다. 프로토콜 우선 원칙에 가장 충실하다.
3. **T-013을 여기서 종료하고 후속 Task로 넘긴다** — §2.3이 지정한 "새 Task" 경로.
   다만 T-013 자체의 최종 상태를 어떻게 둘지는 여전히 미정의다.

**이 Review는 어떤 lifecycle 명령도 실행하지 않았다.**
Task는 `IMPLEMENTED / attempt 2`, `TASK_APPROVED` 0건 그대로다.

---

## Attempt 2 — 2026-08-12T00:45:00Z — APPROVED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli` — SoD 충족 (G5)

**이 항목은 위 `BLOCKED` 판정을 대체하지 않는다. 그 뒤에 덧붙는다.**
`BLOCKED` 기록은 그대로 남으며, 무엇이 왜 막혔었는지가 저장소에 보존된다.

### 무엇이 바뀌었는가 — 구현이 아니라 계약이다

`BLOCKED` 판정의 사유는 **구현 결함이 아니라 Task 명세 결함**이었다.
그 결함을 정정할 절차가 프로토콜에 없어 어떤 판정도 합법이 아니었다.

**T-900 Protocol Hotfix(DONE, attempt 2)가 그 절차를 만들었고**,
이 Review는 그 절차를 T-013에 처음 적용한다.

**Attempt 2의 구현은 한 줄도 바뀌지 않았다.** worker 재실행 없음, attempt 3 없음.

### Effective Contract

```
Effective Contract = 동결된 원본 T-013 Task + Human 승인 Amendment A001
```

| | |
|---|---|
| Amendment | `.bcos/amendments/T-013-A001.md` |
| `proposed_by` / `approved_by` | `claude-code` / `human` — **서로 다름** (SoD) |
| `effectiveAmendments("T-013")` | **1건** — 형식 4조건 통과 |
| Superseded 참조 인식 | **`["59","62","63"]`** — 셋 다 |
| 원본 Task 본문 | **바이트 동일** (`sha256 098c29a0…`, Amendment 전후 불변) |

**AC는 삭제되지 않았다.** 원문은 Amendment의 `## Original`에 그대로 인용되어 있고,
아래 Criteria Assessment는 원문과 정정문을 나란히 평가한다.

**correction이지 scope change가 아니다** — Objective·Scope의 목적이 그대로이고,
기록되는 값(`codex`·`claude`·버전)도 그대로다. **키 이름만 바뀐다.**
AC 총수 94개도 변하지 않는다.

### 검증 유지

| | |
|---|---|
| Host Verification | **219 / 219 pass · fail 0 · skip 0** (Attempt 2 시점) |
| 구현 변경 | **0** — `src/` 어느 파일도 이 Review로 인해 바뀌지 않았다 |
| worker attempt 3 | **없음** |
| `TASK_STARTED` | 1건 유지 |

### Criteria Assessment — Effective Contract 기준 94항목

`SUPERSEDED` 3건은 A001이 근거이며, 각각 정정된 요구를 별도 행으로 평가한다.
그 외 91개는 Attempt 2 Review의 평가를 그대로 유지한다.

| # | 판정 | 근거 |
|---|---|---|
| 1–58 | **PASS** | Attempt 2 Review 참조 — Adapter 경계 12 · Codex 실행 8 · Claude 실행 8 · 공통 결과 12 · Error Contract 7 · 보안·프라이버시 6 · role 분리 5. 전 항목 기계·테스트·격리 실행으로 확인 |
| **59** | **SUPERSEDED by A001** | 원문은 `worker_runtime`·`reviewer_runtime`을 요구. TELEMETRY.md가 그 이름에 다른 뜻을 이미 부여 |
| **59′** | **PASS** | 정정 요구 — artifact가 `worker_name`·`reviewer_name`을 별도 필드로 담는다. 실물 artifact `"worker_name": "codex"` 확인 |
| 60 | PASS | override 실행에서 `worker_version: "override"` |
| 61 | PASS | T-012 기존 필드·stage 8종 불변 |
| **62** | **SUPERSEDED by A001** | 원문은 `worker_runtime` 기록 요구 |
| **62′** | **PASS** | 정정 요구 — worker stage 이후 `worker_name` 기록. 실물 artifact `worker_version: "0.146.0"`와 함께 확인 |
| **63** | **SUPERSEDED by A001** | 원문은 `reviewer_runtime` 기록 요구 |
| **63′** | **PASS** | 정정 요구 — review stage 이후 `reviewer_name` 기록. 통합 테스트 `review workflow records the reviewer name and override version` |
| 64 | PASS | review 없는 실행에서 identity 필드 **부재** — 빈 문자열·`null`·`0` 아님 |
| 65 | PASS | version 취득 실패 시 `unknown`, 실행 계속 |
| 66 | PASS | `model.ts`가 `.bcos/runs/`에 쓰지 않음 |
| 67 | PASS | `task status` → `Worker: codex override` |
| 68 | PASS | reviewer 없으면 `Reviewer:` 줄 없음 |
| 69 | PASS | worker stdin SHA-256 `b438472…` — 리팩터링 전후 동일 |
| 70 | PASS | dry-run command·args·cwd 동일 |
| 71–73 | PASS | `task run`·`task execute`·`--review` telemetry 키 집합 불변 |
| 74 | PASS | request-changes / rework 루프 — **실제 dogfooding으로 확인** |
| 75 | PASS | `--verify-only` → `runner_invocations=0` |
| 76 | PASS | `--max-review-cycles` 동작 유지 |
| 77 | PASS | nested worker 가드 유지 |
| 78 | PASS | spawn capability probe 유지 |
| 79 | PASS | `task status` · run artifact 회귀 없음 |
| 80 | PASS | `src/context.ts` 무변경 |
| 81 | PASS | 새 source file 1개 (`src/model.ts`) |
| 82 | PASS | `src/` 하위 디렉터리 0개 |
| 83 | PASS | `workflow.ts` 313 ≤ 325 |
| 84 | PASS | `run.ts` 70 ≤ 90 |
| 85 | PASS | `cli.ts` 476 ≤ 495 (T-013 종료 시점) |
| 86 | PASS | deps 0 / devDeps 2 |
| 87 | PASS | `npm run build` exit 0 |
| 88 | PASS | `npm test` 219 / 219, fail 0 (하한 214 충족) |
| 89 | PASS | 테스트 삭제·skip 0건 |
| 90 | PASS | TELEMETRY.md의 낡은 `T-010` 전방 참조 0건 |
| 91 | PASS | token/cost `blocked` + 사유 기재 |
| 92 | PASS | pricing table 0건 |
| 93 | PASS | 고유 telemetry 키 103 → 103, 삭제 0건 |
| 94 | PASS | `docs/architecture.md`에 `src/model.ts` 1건 |

**집계 — PASS 91 + 정정 3 = 94 · SUPERSEDED 3 · FAIL 0.**

`SUPERSEDED`는 `FAIL`이 아니므로 RFC-001 §4의
*"`APPROVED`인데 `FAIL` 항목이 있으면 모순(`E_SCHEMA`)"* 에 걸리지 않는다.

### Findings

**F-1 (해소)** — data contract collision. Attempt 2가 `worker_name`/`reviewer_name`으로
정정했고, A001이 그 정정을 계약에 반영했다.

**F-2 (해소)** — run artifact 통합 테스트 부재. Attempt 2가 통합 테스트 5개를
추가했다 (`task execute` → artifact 파일 → `task status` 경로).

**F-3 · F-4 (Protocol, 이관)** — 명세 정정 절차 부재와 `IMPLEMENTED → BLOCKED`
전이 부재. **T-900이 전자를 해결했다.** 후자는 T-900이 "BLOCKED는 전이 없는
판정"으로 정의해 우회했으며, RFC 반영은 별도 Manager/Human 단계로 남는다.

**F-5 (해소)** — Attempt 1 Review의 `Criteria Assessment` 누락.
Attempt 2 Review와 이 항목 모두 94항목 전수 표를 포함한다.

**Blocking 0 · Major 0.**

### Required Changes

**없다.**

### Verdict

**APPROVED**

구현은 Attempt 2에서 이미 옳았고 219/219가 통과했다.
막고 있던 것은 코드가 아니라 **동결된 Task 문언과 상위 data contract의 충돌**이었으며,
Human 승인 Amendment A001이 그 충돌을 감사 가능한 형태로 정정했다.

**원본 Task는 수정되지 않았고, `BLOCKED` 이력은 삭제되지 않았으며,
worker attempt 3는 만들지 않았다.**
