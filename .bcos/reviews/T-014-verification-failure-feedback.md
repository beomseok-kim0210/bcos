---
task: T-014
---

# Review — T-014 Verification Failure Feedback

## Attempt 1 — 2026-08-12T05:35:06Z — APPROVED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli` — SoD 충족 (G5)

**T-012에서 사람이 손으로 하던 일이 자동화됐다.** 검증이 실패하면 그 출력의 꼬리가
run artifact에 남고, 같은 Task를 재개한 Worker의 stdin 끝에 논리 명령·exit code와 함께
붙는다. 실제 T-012 실패 형태로 확인했고, 실패한 테스트 이름과 assertion이 온전히 전달된다.

**검증 실패 기록이 없을 때 Worker stdin은 구현 전과 바이트 단위로 동일하다** —
Reviewer가 독립적으로 재현했다.

---

## 판정 요약

| | |
|---|---|
| **Verdict** | **APPROVED** |
| Blocking **0** · Major **0** | Minor 1 · Info 4 |
| Reviewer 독립 재현 | build exit 0 · **256 / 256 pass · fail 0 · skip 0 · todo 0** |
| AC | **PASS 51 / 51** |
| 새 source file · 새 telemetry 키 · 새 이벤트 | **각 0** |

---

## 1. Lifecycle Ground Truth — 일치

| | |
|---|---|
| status / attempt | **IMPLEMENTED / 1** ✓ |
| `TASK_STARTED` / `TASK_SUBMITTED` | **1 / 1** ✓ |
| `TASK_APPROVED` / `TASK_CHANGES_REQUESTED` | **0 / 0** ✓ |
| `current_task` | **null** ✓ · counts IMPLEMENTED 1 / DONE 14 |

**`task execute`가 start를 소유했다.** run artifact `started_at 04:53:21.986Z`가
`TASK_STARTED 04:53:22.116Z`보다 **앞선다** — 워크플로가 기록을 열고 전이를 수행한 순서다.
사람이 별도로 `task start`를 실행한 흔적은 없다.

## 2. Independent Build / Test

```
npm run build → exit 0
npm test      → tests 256 · pass 256 · fail 0 · skipped 0 · todo 0
```

기존 239개 유지, 신규 **17개**. 삭제·skip **0건**.
신규 테스트는 staleness · 경계 · 정제 · 순서 · 결정성 · verify-only ·
**실제 T-012 실패 형태**를 각각 독립 행동으로 검증한다. 숫자 채우기가 아니다.

## 3. Pre-T-014 Failure Path — 재확인

구현 전 구조를 증거로 재구성했다.

| 정보 | 구현 전 위치 | 영속성 |
|---|---|---|
| stdout / stderr | **없음** — `verify()`가 `pipe()`로만 전달 | 휘발 |
| exit code · duration | stdout telemetry | **휘발** |
| 논리 명령 이름 | run artifact `verification_command` | 영속 |
| 실패 여부 | `stages.verification = "failed"` | 영속 |
| **왜 실패했는가** | **없음** | — |

기존 run artifact 5개 중 `verification_exit_code` 보유 **0건**.
**"실패했다"는 알 수 있었고 "왜"는 영속적으로 알 수 없었다** — Worker 서술이 정확하다.

## 4. RunRecord Contract

```ts
verification_exit_code?: number; verification_excerpt?: string;
```

| 상황 | 결과 |
|---|---|
| 검증 실행 + 실패 | exit code `1` · 발췌 기록 ✓ |
| 검증 실행 + 성공 | exit code `0` · 발췌 기록 ✓ |
| **검증 미실행** (worker 실패) | **두 필드 모두 부재** — `0`·`""` 아님 ✓ |
| `verification_command` | 미실행에도 유지 (기존 동작) ✓ |

기존 필드·stage 8종 불변. lifecycle SSOT 침범 없음 — artifact에 Task 상태 필드 없음.

## 5. Verification Capture Semantics

```ts
child.stdout.on("data", capture);   // 수집
child.stderr.on("data", capture);
child.stdout.pipe(process.stdout);  // 전달 — pipe() 그대로
child.stderr.pipe(process.stderr);
```

**독립 fixture로 전달 회귀를 확인했다** — `VERIFIER-STDOUT-MARK`와
`VERIFIER-STDERR-MARK`가 **부모 출력에 그대로 나타나고 발췌에도 수집된다.**

*(Reviewer 자신의 첫 fixture는 셸 이스케이프 때문에 worker가 SyntaxError로 죽어
검증 단계에 도달하지 못했고, 순간 회귀로 오독했다. 원인을 규명해 정정한다 —
**제품에 회귀는 없다.**)*

`shell: true` · `cmd /c` · `powershell` **각 0건**. 별도 wrapper·전문 저장·로깅
framework 없음.

## 6. 2,048-byte Contract — **Reviewer 직접 측정, 위반 아님**

Worker 보고를 신뢰하지 않고 ASCII 전용 출력으로 직접 쟀다.

```
verification_excerpt 필드 전체 : 2052 bytes
  잘림 표시(marker) "…\n"      :    4 bytes
  출력 tail(payload)           : 2048 bytes
```

**계약 원문 판정**

| 질문 | 답 |
|---|---|
| 계약이 excerpt **전체**를 ≤2048로 요구하는가 | **아니다.** AC 2는 *"그 출력의 마지막 2,048 바이트를 보관한다"* — 제약 대상은 **보관하는 출력 tail**이다 |
| 2052가 literal AC violation인가 | **아니다.** payload가 정확히 2048이다 |
| payload 2048 + 별도 marker를 허용하는가 | **그렇다.** AC 3이 *"발췌 **앞에** `…` 표시가 붙는다"*, Scope §4가 *"발췌 앞에 `…` 한 줄을 둔다"* — marker는 **덧붙는 것**으로 명시돼 있다 |
| marker가 필드 안인가 밖인가 | **안**이다. 그래서 필드 총량이 2052가 된다 |

**계약이 요구한 그대로다.** AC 4(2048 이하면 표시 없음)도 확인 — 짧은 출력 필드 6 bytes,
잘림 표시 없음.

## 7. UTF-8 Boundary — **Minor Finding (M-1)**

경계가 문자 중간에 걸리도록 3바이트·4바이트 문자로 측정했다.

| 입력 | payload | U+FFFD | JSON | payload ≤2048 |
|---|---:|---:|---|---|
| 한글(3B) pad 0·1·2 | **2052 B** | **2개** | 유효 | **아니오 (+4)** |
| emoji(4B) pad 0·1·2 | 2048 B | 0개 | 유효 | 예 |

**cut이 문자 중간에 걸리면 잘린 바이트가 U+FFFD로 디코딩되어 payload가 2048을 넘는다**
(3바이트 문자에서 +4 B). 4바이트 문자는 이 fixture에서 경계가 정렬돼 발생하지 않았다.

**판정 — Minor.** 근거:
- **JSON은 유효**하고 artifact가 깨지지 않는다.
- 손상은 **이미 잘린 발췌의 맨 앞 2글자**이며, 그 앞에 `…` 표시가 이미 있다.
- 초과분이 **상수 수준(+4 B)**으로 유계다.
- **Task Contract는 UTF-8 경계 처리를 규정하지 않는다.** AC 2의 대상은
  `verify()`가 보관하는 **버퍼**(정확히 2048)이고, 디코딩 후 문자열 크기는 규정 밖이다.

Unicode framework를 요구하지 않는다. 후속에서 다룬다면 경계를 문자 단위로 맞추는
몇 줄이면 충분하다.

## 8. Privacy Sanitization

| | |
|---|---|
| 역슬래시 홈 경로 `C:\Users\…` | **미포함** ✓ |
| 슬래시 변형 `C:/Users/…` | **미포함** ✓ |
| `<home>` 치환 | 두 변형 모두 **2/2 치환** ✓ |
| artifact 전체 | 홈 경로 **0건** ✓ |
| 실제 저장소 run artifact 6개 | 홈 경로 **0건** ✓ |

**범용 sanitizer로 평가하지 않는다.** Task 범위는 두 경로 치환뿐이며,
Task·Report·TELEMETRY.md **셋 다 그 한계를 명시**한다 —
*"이 두 경로 외의 민감정보를 비식별화하지는 않는다."* 주장과 구현이 일치한다.

## 9. Latest Relevant Verification Selection

```ts
readRuns(taskId, root)
  .filter(r => r.stages.verification === "success" || r.stages.verification === "failed")
  .at(-1)
```

fixture로 직접 구성해 확인했다.

| 이력 | 선택 | 결과 |
|---|---|---|
| `failed → not_started` | **failed** | 이전 실패 전달 ✓ |
| `failed → success → not_started → success` | **success** | **전달 없음** ✓ |

`not_started`가 이전 결과를 덮지 않는다. `readRuns`는 파일명 정렬이 곧 시간순이며
`task_id`로 필터하므로 다른 Task의 기록이 섞이지 않는다.

## 10. Stale Failure

`fail → success` 이후 Worker에 **옛 실패가 전달되지 않는다.**
동시에 **실패 artifact는 이력에 그대로 남는다** — 삭제·clear 이벤트·cleanup 없이
**선택 semantics만으로** 해소한다.

## 11. Failure Feedback Block — 실제 Worker stdin 캡처

```
--- PREVIOUS HOST VERIFICATION FAILURE ---
command: custom-verifier
exit code: 1
✖ a killed workflow leaves valid running observation
  'start' !== 'worker'
ℹ tests 186
ℹ pass 185
ℹ fail 1
```

논리 명령·exit code·발췌 **포함**. `execution_id` · 타임스탬프 · duration ·
절대경로 · raw env · 전문 **각 0건**.

## 12. Input Ordering

| fixture | 결과 |
|---|---|
| Context only | 블록 없음 ✓ |
| Context + Verification | `CONTEXT < VERIFICATION` ✓ |
| Context + Review + Verification | **`CONTEXT(480) < REVIEW(1011) < VERIFICATION(1157)`** ✓ |

동일 artifact에서 재조립한 stdin SHA가 일치한다(§13-A).

## 13. Capture Determinism — **A와 B를 구분한다**

**A. 저장된 artifact 재조립** — **결정적이다.**
같은 artifact로 3회 재조립한 stdin SHA가 모두 `39d80e908bf9ff0a…`로 일치했다.
**Task AC 27이 요구하는 것이 이것이며 충족된다.**

**B. verifier 재실행 시 stdout/stderr interleaving** — **결정적이지 않다.**
같은 verifier를 5회 실행해 두 stream을 도착순으로 한 버퍼에 모은 결과가
**4종으로 갈렸다.** stdout과 stderr는 서로 다른 OS pipe이므로 chunk 도착 순서가
실행마다 달라질 수 있다.

**Task는 B를 요구하지 않는다.** 발췌는 **한 번 파일에 저장되고 이후 읽기만** 하므로
Worker 입력의 결정성은 A에만 의존한다. **B는 한계로만 기록한다 (I-2).**
두 가지를 같은 "결정적"이라는 말로 뭉개지 않는다.

## 14. No-Failure Regression — 독립 재현

Worker가 구현 **전**에 확보한 기준선을, Reviewer가 **구 소스 미러 + 신 dist**로 재현했다.

```
Worker 기준선  60176e4fb0e1398ffec475bd34fc81b6a316e902b8435c2ace963770d6c1bb49 / 181,412자
Reviewer 재현  60176e4fb0e1398ffec475bd34fc81b6a316e902b8435c2ace963770d6c1bb49 / 181,412자
```

**검증 실패 기록이 없을 때 T-014는 Worker stdin을 한 바이트도 바꾸지 않는다.**

## 15. Review + Verification Feedback

둘이 함께 존재하는 fixture에서 **양쪽 모두 stdin에 있고** 순서가 결정적이다.
Review가 verification에 덮이지 않고, verification이 Review 때문에 빠지지도 않는다.
중복 제거 framework 없음.

## 16. Attempt Semantics

검증 **2회 연속 실패** fixture에서 `attempt = 1` 유지, `status = IN_PROGRESS`,
`TASK_SUBMITTED` **0건**. `request-changes`(attempt 증가)와 명확히 구분된다.
기존 lifecycle semantics 보존.

## 17. `--verify-only`

`runner_invocations = 0` · Worker 실행 흔적 **없음** · `worker` stage `skipped` ·
검증 성공도 exit code `0` 기록. **failure block 때문에 Worker가 잘못 실행되는 회귀 없음.**

## 18. Real-shape Fixture

T-012 실제 형태(`✖ … / 'start' !== 'worker' / ℹ tests 186 …`)로 확인했다 —
**failing test name과 assertion evidence가 artifact와 Worker stdin에 모두 온전**하다.
synthetic 한 줄 fixture로만 판단하지 않았다. 신규 테스트에도
`real-shape verification failure is handed to the worker intact`가 포함돼 있다.

## 19. Telemetry Contract — **collision 없음**

| 매체 | 값 출처 |
|---|---|
| stdout telemetry | `fields.verification_exit_code = verificationResult.code` |
| run artifact | `run.verification_exit_code = result.code` |

**같은 이름, 같은 출처, 같은 뜻**(검증 프로세스 exit code)이다.
T-013의 `worker_runtime` 사건과 **반대 구조**다.

새 stdout telemetry 키 **0개**. TELEMETRY.md 고유 키 **103 → 103, 삭제·추가 0건**.
추가된 것은 run artifact 두 필드를 기술한 **한 문단**뿐이다.

## 20. Source Boundaries / LOC

| 파일 | 실측 | 상한 |
|---|---:|---:|
| `src/workflow.ts` | **326** | 330 |
| `src/run.ts` | **83** | 100 |
| `src/runner.ts` | **192** | 200 |

새 source file **0** · class · interface · registry · plugin **각 0건** ·
dependency **0** / devDeps 2 · `package-lock.json` 변경 **0건** ·
`src/model.ts` · `src/context.ts` **무변경**.
storage abstraction · parser framework · generic sanitizer **없음**.

## 21. Bootstrap Limitation — 구현 누락 아님

| | |
|---|---|
| workflow 시작 | `04:53:21Z` (13:53 KST) |
| `dist/workflow.js` 재빌드 | **13:59:22 KST — 실행 도중** |
| workflow 종료 | `05:01:27Z` (14:01 KST) |

부모 프로세스가 **구 코드를 메모리에 들고** 끝까지 실행했다.
따라서 T-014 자신의 artifact에는 신규 필드가 없다.

**신 build fixture에서는 정상 기록된다** — §4·§5·§6에서 반복 확인했다.
T-012·T-013과 동일한 부트스트랩 특성이며 구현 결함이 아니다.
**실제 T-014 lifecycle을 억지로 실패시켜 증명하려 하지 않은 판단도 옳다.**

## 22. Partial Write / Artifact Safety

정상·실패 fixture 모두에서 run artifact **전부 유효 JSON**, temp 잔존 **0건**,
`events.jsonl` 각 줄 유효 JSON, `state.json` 유효.
실제 저장소도 artifact 6개 유효 · temp 0건.
검증 발췌 수집이 events/state를 훼손하지 않는다.

## 23. Regression

기존 239개 전부 통과. `task start` · `submit` · `approve` · `request-changes` ·
`context` · `run` · `execute` · `status` · Reviewer loop · rework · Amendment ·
last verdict · observability · Model Adapter · nested worker guard ·
verification gate 모두 유지.

특히 `task execute forwards verifier stdout and stderr`가 계속 통과한다.

---

## Criteria Assessment (RFC-001 §4 MUST — 51항목 전수)

증거: `M` 기계 검증 · `T` 테스트 · `X` 격리 실행 · `R` 실행 기록 · `B` 직접 바이트 측정

| # | 판정 | 근거 |
|---|---|---|
| 1 | PASS | X `VERIFIER-STDOUT/STDERR-MARK`가 부모 출력에 도달 |
| 2 | PASS | **B payload 정확히 2048 bytes** |
| 3 | PASS | B 초과 시 `…\n` 4 bytes 선두 표시 |
| 4 | PASS | B 짧은 출력 6 bytes, 표시 없음 |
| 5 | PASS | X `<root>` 치환 (fixture root) |
| 6 | PASS | X `<home>` 치환 — 역슬래시·슬래시 양쪽 |
| 7 | PASS | X 실패·성공 모두 `verification_exit_code` 기록 |
| 8 | PASS | X `verification_excerpt` 기록 |
| 9 | PASS | X worker 실패 run에 두 필드 **부재** (`in` 연산자로 확인) |
| 10 | PASS | X 성공 시 exit code `0` 기록 |
| 11 | PASS | X Worker stdin에 블록 포함 |
| 12 | PASS | X `command: custom-verifier` |
| 13 | PASS | X `exit code: 1` |
| 14 | PASS | X real-shape 발췌 포함 |
| 15 | PASS | X `execution_id`·타임스탬프·duration 0건 |
| 16 | PASS | X 절대경로 0건 |
| 17 | PASS | X `CONTEXT(480) < VERIFICATION` |
| 18 | PASS | X `REVIEW(1011) < VERIFICATION(1157)` |
| 19 | PASS | X 직전 성공 시 블록 없음 |
| 20 | PASS | X 기록 없으면 블록 없음 (기준선 stdin 동일) |
| 21 | PASS | M `.filter(success\|failed).at(-1)` |
| 22 | PASS | X `failed → not_started` → failed 선택 |
| 23 | PASS | M+T `skipped` 동일 분기 · 테스트 존재 |
| 24 | PASS | X `failed → success` 후 미전달 |
| 25 | PASS | M 성공 뒤 실패면 그 실패가 마지막 relevant |
| 26 | PASS | M `readRuns`가 `task_id`로 필터 |
| 27 | PASS | X 동일 artifact 3회 재조립 SHA 일치 |
| 28 | PASS | **X 기준선 `60176e4f…` 독립 재현 일치** |
| 29 | PASS | X+M artifact 홈 경로 0건 (fixture·실저장소) |
| 30 | PASS | T `home environment value is removed…` |
| 31 | PASS | X stdin 홈 경로 0건 |
| 32 | PASS | M `src/context.ts` diff 0건 |
| 33 | PASS | X 2회 실패 후 attempt 1 유지 |
| 34 | PASS | X `TASK_SUBMITTED` 0건 |
| 35 | PASS | X `status: IN_PROGRESS` |
| 36 | PASS | X `runner_invocations=0` · Worker 흔적 없음 |
| 37 | PASS | T nested worker 가드 테스트 유지 |
| 38 | PASS | M 새 이벤트·상태·전이 0 |
| 39 | PASS | M 새 source file 0 |
| 40 | PASS | M `model.ts`·`context.ts` diff 0 |
| 41 | PASS | M 326/330 · 83/100 · 192/200 |
| 42 | PASS | M class·interface·registry·plugin 0건 |
| 43 | PASS | M deps 0 / devDeps 2 |
| 44 | PASS | M `fields.` 추가 0건 |
| 45 | PASS | M TELEMETRY 고유 키 103 → 103 |
| 46 | PASS | 기존 239개 통과 |
| 47 | PASS | T execute·`--review`·rework 회귀 없음 |
| 48 | PASS | T `task status`·run artifact 회귀 없음 |
| 49 | PASS | **Reviewer 직접** build exit 0 |
| 50 | PASS | **Reviewer 직접** 256 pass / 0 fail (≥255) |
| 51 | PASS | M skip·todo 0건 |

**집계 — PASS 51 · FAIL 0 · SUPERSEDED 0 · N/A 0.**
T-014에는 Amendment가 없으므로 `SUPERSEDED`를 쓰지 않았다.

---

## Findings

| | 등급 | 유형 | 내용 |
|---|---|---|---|
| **M-1** | **Minor** | Implementation | **UTF-8 경계 절단.** cut이 문자 중간에 걸리면 U+FFFD가 생기고 3바이트 문자에서 payload가 **2052 B(+4)**가 된다. JSON 유효, 손상은 이미 잘린 발췌의 맨 앞 2글자, 초과분 유계. **Contract가 UTF-8 경계를 규정하지 않으므로 AC 위반은 아니다.** 후속에서 경계를 문자 단위로 맞추면 몇 줄로 해소된다 |
| I-1 | Info | Specification | 발췌 필드 **2052 B = payload 2048 + marker 4**. AC 2의 제약 대상이 "보관하는 출력 tail"이고 AC 3이 marker를 "발췌 앞에" 붙는 것으로 명시하므로 **계약대로다**. 수치를 남긴다 |
| I-2 | Info | Architecture | **capture 결정성 B는 보장되지 않는다.** 같은 verifier 5회 실행 → interleaving **4종**. stdout/stderr가 별개 pipe이기 때문이다. Task는 A(저장본 재조립)만 요구하고 그것은 3/3 일치한다 |
| I-3 | Info | — | `src/workflow.ts` **326/330**, 여유 4줄 |
| I-4 | Info | Privacy | 정제는 **경로 2건 치환뿐**이다. Task·Report·TELEMETRY.md 셋 다 그 한계를 명시하므로 주장과 구현이 일치한다. 범용 secret/PII sanitizer가 아니다 |
| I-5 | Info | Process | **부트스트랩** — T-014 자신의 artifact에는 신규 필드가 없다. dist가 실행 도중 재빌드됐기 때문이며 구현 누락이 아니다 |

**Blocking 0 · Major 0.**

---

## Required Changes

**없다.**

---

## Verdict

**APPROVED**

Task Contract 51개 AC를 전부 충족하고, Host Verification 256/256을 Reviewer가
독립 재현했으며, Blocking·Major Finding이 없다.

**T-012가 남긴 실제 문제가 실제로 해결됐다** — 검증 실패의 이유가 이제 영속 기록에
남고 다음 Worker에게 자동으로 전달된다. 새 파일 0개, 새 명령 0개, 새 이벤트 0개,
새 telemetry 키 0개, 의존성 0개로 끝냈다.

**두 가지를 특히 평가한다.** 첫째, 실패 기록이 없을 때 Worker stdin이 바이트 단위로
불변이라는 점 — 회귀 위험을 설계 단계에서 제거했다. 둘째, 정제의 한계를
과장 없이 세 문서에 동일하게 적은 점 — "완전한 비식별화"라고 주장하지 않는다.

M-1(UTF-8 경계)은 후속 Task에서 다룰 후보로 남긴다.
