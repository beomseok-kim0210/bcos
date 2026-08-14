---
task: T-016
---

# Review — T-016

## Attempt 2 — 2026-08-14T05:20:00Z — APPROVED

Reviewer: `claude-code` (worker `codex-cli`와 다름 — G5 충족)

**Worker/Manager의 self-check를 근거로 삼지 않았다.** 아래 판정은 Reviewer가
저장소·빌드된 코드·실제 실행에서 직접 재현한 값이다. 파일 개수는 본문 문자열이 아니라
파서 결과로, trial 검증은 빌드된 `readTrials()`를 직접 호출해 측정했다.

### Criteria Assessment

**A. RunRecord 측정값 영속화**

| AC | 판정 | 근거 (Reviewer 실측) |
|---|---|---|
| 1 | **PASS** | `src/run.ts:16-18` — 9개가 §1 표와 같은 이름으로 **전부 optional** |
| 2 | **PASS** | 제외 18키 혼입 **0건** (실제 실행 artifact 직접 확인) |
| 3 | **PASS** | 정상 완료 실행에서 **9/9 존재** |
| 4 | **PASS** | 9개 전부 `telemetry === persisted` — **불일치 0건** |
| 5 | **PASS** | 1회 실행 `worker_invocations=1`. **재작업 루프 실행에서 `=2`이고 `79+76=155`(duration), `1438+1683=3121`(stdin) 합산 일치** |
| 6 | **PASS** | worker exit 3 실행에서 worker 단계 측정값 **8/9 보존**. 미도달 단계인 `verification_duration_ms`만 부재 — 정확한 동작 |
| 7 | **PASS** | `--dry-run` 관찰에 context 측정값 존재 (신규 테스트 + 실행 확인) |

**B. 경계 보존**

| AC | 판정 | 근거 |
|---|---|---|
| 8 | **PASS** | `src/model.ts` diff **0줄** |
| 9 | **PASS** | `cli.ts`·`context.ts`·`reviewer.ts` diff **각 0줄** → 새 CLI command **0** |
| 10 | **PASS** | `verificationExcerpt` 치환 2개 그대로 (`run.ts` diff는 타입 3줄뿐) |

**C. Trial record 스키마** — 전부 빌드된 `readTrials()` 직접 호출로 확인

| AC | 판정 | 근거 |
|---|---|---|
| 11 | **PASS** | `.bcos/benchmarks/` JSON 1파일 = trial 1건 |
| 12 | **PASS** | 유효 trial 배열 반환 |
| 13 | **PASS** | `measurement_version` ≠ `"0.1"` 거부 |
| 14 | **PASS** | `bcos_claude` → `arm is invalid` |
| 15 | **PASS** | `repetition` 정수≥1 아니면 거부 |
| 16 | **PASS** | 39자리 → `repository_base_commit must be 40 hex characters` |
| 17 | **PASS** | 64자리 hex 강제 |
| 18 | **PASS** | 7값 닫힌 집합 (`statuses` Set) |

**D. Provenance**

| AC | 판정 | 근거 |
|---|---|---|
| 19 | **PASS** | `numericFields()`가 전체를 순회. **bare number 거부 실측** — `trial.outcome.attempt_count must use provenance` |
| 20 | **PASS** | `guessed` → `source is invalid`. 닫힌 5값 |
| 21 | **PASS** | `unavailable`+`0` → `unavailable requires null`. `unavailable`+값도 거부 |
| 22 | **PASS** | `measured`+`null` → `available source requires a value` |
| 23 | **PASS** | `system_usage`(배열) / `evaluation_usage`(객체) **별도 최상위 필드** |
| 24 | **PASS** | `tokens()`가 `source === "proxy"`를 token 필드에서 **거부**. proxy→token 대입 코드 **0건** |

**E. 거부와 침묵 금지**

| AC | 판정 | 근거 |
|---|---|---|
| 25 | **PASS** | `fail()`이 throw. 유효1+무효1 → **예외 발생**, 조용한 누락 없음 |
| 26 | **PASS** | 메시지 형식 `${filename}: ${rule}` — 실측 `CASE-B-nope-1.json: arm is invalid` |

**F. Arm 대칭과 참조**

| AC | 판정 | 근거 |
|---|---|---|
| 27 | **PASS** | `^T-\d{3,}$` 강제 |
| 28 | **PASS** | baseline+`bcos` → `baseline trial must not contain bcos` |
| 29 | **PASS** | bcos+`proxies` → `bcos trial must not contain proxies` |
| 30 | **PASS** | `execution_ids`가 **실제 `.bcos/runs/<id>.json` 존재를 요구**(`existsSync`), 빈 배열 거부 |

**G. 실패 · Human · Privacy**

| AC | 판정 | 근거 |
|---|---|---|
| 31 | **PASS** | 7 status **전부 보존**. `readTrials()`에 status 필터·성공률·정렬 우선순위 **없음** |
| 32 | **PASS** | `human` 두 필드가 provenance. `unavailable`+`null` 허용, 정수 강제 |
| 33 | **PASS** | 테스트 내 사용자명 **0건**, `C:\Users` **0건** |

**H. Canonical trial identity**

| AC | 판정 | 근거 |
|---|---|---|
| 34 | **PASS** | 정규식 하나로 소문자·`/`·공백·`.` **전부 거부 실측**. 별도 문자 차단 규칙 없음 |
| 35 | **PASS** | `expected = ${case_id}-${arm}-${repetition}.json` **조립 후 비교**. 하이픈 split **없음**. `CASE-FE-001` 정확 처리, zero-padding `-01.json` 거부 |

**I. Capture ownership**

| AC | 판정 | 근거 |
|---|---|---|
| 36 | **PASS** | `benchmark.ts`에 spawn/spawnSync/exec/execFile/fork **0건**, writeFileSync/renameSync/mkdirSync **0건**. import는 `existsSync`·`readdirSync`·`readFileSync`뿐 |
| 37 | **PASS** | 측정값은 `workflow.ts`가 기존 `updateRun()` 경로로 기록. **새 writer 함수·모듈 0** |
| 38 | **PASS** | baseline trial이 `.bcos/runs/` 없이 통과 — 직접 재현 |

**J. Component-level system usage**

| AC | 판정 | 근거 |
|---|---|---|
| 39 | **PASS** | 배열 + `phases`/`runtimes` 닫힌 Set. 밖의 값 각각 거부 실측 |
| 40 | **PASS** | component token에 `tokens()` → §5 규칙 그대로 적용 |
| 41 | **PASS** | bcos+`single_agent` → `component phase contradicts arm`. baseline+`planning`도 거부 |
| 42 | **PASS** | `codex_only`+`single_agent/claude` → `component runtime contradicts arm` |
| 43 | **PASS** | `benchmark.ts`에 `reduce`·`total`·`sum`·`average`·`ratio`·`rank` **0건**. 반환 객체에 total 필드 **없음** |

**K. 회귀**

| AC | 판정 | 근거 |
|---|---|---|
| 44 | **PASS** | 기존 278 **삭제·개명 0건**, skip/todo **0건**. Reviewer 독립 실행 **289/289** |
| 45 | **PASS** | Reviewer 독립 `npm run build` **exit 0** |
| 46 | **PASS** | `run.ts` 86/100 · `runner.ts` 201/210 · `workflow.ts` **340/340** · `benchmark.ts` 90/110 |

**집계 — PASS 46 · FAIL 0 · SUPERSEDED 0**

### Independent Verification

**Frozen Contract 무결성** — body **37,148 bytes로 lock commit `724383b`와 바이트 동일**.
변경된 frontmatter 키는 `status`·`attempt`·`updated` **셋뿐**.

**Diff** — production 변경은 `run.ts +3` · `runner.ts +12` · `workflow.ts +20`,
신규 production source는 **`src/benchmark.ts` 1개뿐**. `git diff --check` exit 0.

**Reviewer 독립 회귀**

```
npm run build → exit 0
npm test      → tests 289 · pass 289 · fail 0 · skipped 0 · todo 0
```

**Legitimate zero vs unavailable — 분리 검증**

| 구분 | 실측 |
|---|---|
| raw 0 | stderr 미출력 worker 실행 → `worker_stderr_bytes` **persisted=0 · telemetry=0 · type number · 생략/ null 변환 없음** |
| provenance | `measured`+0 **허용** · `unavailable`+null **허용** · `unavailable`+0 **거부** · `unavailable`+값 **거부** · `measured`+null **거부** · 미지 source **거부** |

두 개념이 코드에서 **분리되어 있음을 확인**했다.

**Lifecycle 전체 재구성**

```
a1: TASK_STARTED → (context protocol failure, run artifact 보존) → TASK_BLOCKED
    T-901 hotfix DONE
    TASK_UNBLOCKED
a2: TASK_STARTED → 1차 실행 verification 실패(run 보존)
    → same-attempt 재실행(start skipped) → 2차 성공 → TASK_SUBMITTED → IMPLEMENTED
```

`{"TASK_STARTED a1":1, "TASK_BLOCKED a1":1, "TASK_UNBLOCKED a1":1, "TASK_STARTED a2":1, "TASK_SUBMITTED a2":1}`
**attempt 3 이벤트 0건.** a1 실패 run **1건**, a2 run **2건(실패+성공)** 모두 보존.

**기존 회귀 테스트 변경 — 약화가 아니다**

```diff
-  assert.match(text, /failed/); assert.match(text, /not_started/); assert.doesNotMatch(text, /:0(?:[,}])/);
+  assert.match(text, /failed/); assert.match(text, /not_started/);
+  assert.doesNotMatch(JSON.stringify(workflowRun(fixture_).stages), /:0(?:[,}])/);
```

`failed`·`not_started` 어휘 검사는 **전체 JSON에 그대로 유지**되고, `:0` 금지만 `.stages`로 좁혔다.
**stage numeric-zero sentinel 보호는 그대로다** — 단계 상태가 0으로 기록되면 여전히 실패한다.
삭제 0 · 개명 0 · skip 0 · todo 0. **green을 만들려 테스트를 약화한 것이 아니다.**

### Findings

**BLOCKING 0 · MAJOR 0 | MINOR 1 · INFO 2**

**M-1 (MINOR) — `src/workflow.ts`가 상한에 정확히 도달했다**

340/340줄로 **여유가 0이다.** AC 46은 충족하지만 다음 Task가 이 파일을 한 줄이라도
건드리면 즉시 상한을 넘는다. 이번 변경의 결함은 아니며 **후속 Task 설계 시 고려할 사항**이다.

**I-1 (INFO) — Contract §15 예시와 실제 스키마가 다르다 (구현이 더 엄격하다)**

Contract 예시는 `attempt_count: 1`을 bare number로 적었지만 구현은 provenance를 요구한다
(`trial.outcome.attempt_count must use provenance`). **Contract §15가 "그대로 채택하지 말고
검토할 것"이라고 명시했고 AC 19가 "모든 수치 필드가 `{value, source}` 형태"를 요구하므로
구현이 옳다.** 다만 예시를 그대로 쓰려는 사람은 거부를 만나게 된다.

**I-2 (INFO) — same-attempt Report append 문제는 이번에 개선됐다**

T-901에서 MINOR로 기록했던 "같은 attempt 재실행이 이전 Report를 덮어쓴다"가
이번에는 발생하지 않았다 — `## Attempt 2`와 `## Attempt 2 verification retry` **두 블록이
공존**한다. 다만 RFC-001 §3은 여전히 "attempt마다 한 항목"을 전제하므로
**Known Product Gap 자체는 남아 있다.**

### Report 정직성 평가

**숨기지 않았다.** Report는 1차 a2 Host Verification의 `fail 1`, worker 샌드박스의
`spawn EPERM`("this is environment evidence, not a passing full-suite claim"),
그리고 retry 블록에서 legitimate zero를 허용하도록 회귀 테스트를 좁혔다는 사실을 적었다.
**"처음부터 전부 통과"로 읽히게 쓰지 않았고**, 전체 스위트 통과를 자기 근거로 주장하지 않았다.

### Scope · Ponytail

| 항목 | 실측 |
|---|---|
| `model.ts`·`cli.ts`·`context.ts`·`reviewer.ts` diff | **각 0줄** |
| 새 production source | **1개** (`src/benchmark.ts`) |
| 새 추상화 | **0** — type 3개 + `readTrials()` 1개. registry·factory·writer wrapper 없음 |
| 의존성 | **0** |
| 새 CLI command | **0** |
| Case Registry · benchmark executor · baseline runner · LLM-as-Judge | **0** |
| DB/SQLite · dashboard · provider registry · role template | **0** |
| README · docs · RFC · CLAUDE.md · AGENTS.md | **무변경** |
| T-017 | **0건** |

**Ponytail 위반 없음.** `benchmark.ts` 90줄에 불필요한 추상화가 없다.
`numericFields()`의 재귀 순회는 "모든 수치 경로에 provenance"라는 AC 19를 **한 곳에서**
강제하는 방식이며, 필드별 검사를 나열하는 것보다 작다.
`phases`/`runtimes`/`arms`/`statuses` Set은 확장 지점이 아니라 **닫힌 리터럴**이다.

테스트 165줄/11건도 과다가 아니다 — 각각 다른 invariant를 증명하고,
실제 T-016 Task와 실제 run artifact를 참조하는 real-shape fixture를 포함한다.

### Verdict

**APPROVED**

AC 46개 전부 PASS, BLOCKING·MAJOR 0건. 동결 계약 본문이 바이트 단위로 보존됐고,
production 변경은 기존 파일 3개 소폭 + 신규 모듈 1개이며 경계 4파일은 diff 0줄이다.
9개 측정값이 stdout telemetry와 정확히 일치하고, 실패 execution과 다중 invocation 합산까지
직접 재현으로 확인했다. raw 0과 `unavailable`이 코드에서 분리되어 있으며
집계·writer·baseline 실행은 존재하지 않는다.

MINOR 1건은 `workflow.ts`가 상한에 도달했다는 후속 설계 고려사항이고,
INFO 2건은 Contract 예시와 구현의 엄격도 차이 및 이미 알려진 Report gap이다.
**어느 것도 이번 변경의 정확성을 훼손하지 않는다.**
