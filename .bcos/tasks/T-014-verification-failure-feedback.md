---
protocol: "0.1"
id: T-014
title: Hand the previous host verification failure to the next worker automatically
status: DONE
attempt: 1
created: 2026-08-12T01:30:00Z
updated: 2026-08-12T05:37:34.588Z
---

# T-014 — Verification Failure Feedback

## Objective

**Host 검증이 실패하면 그 이유가 다음 Worker에게 자동으로 전달되어야 한다.**

T-012에서 실제로 겪었다. Worker가 구현하고, Host가 `npm test`를 돌려 **185/186**으로
실패했고, submit이 정확히 막혔고, Task는 `IN_PROGRESS`로 남았다. **여기까지는 옳았다.**

문제는 그다음이다. Worker는 자기 샌드박스에서 테스트를 돌리지 못하고(EPERM, 8개 Task 연속),
**실패 증거는 터미널에만 있었다.** 사람이 로그를 뒤져 원인을 찾고, 테스트를 고치고,
`--verify-only`로 복구했다.

**T-011이 Review 피드백에 대해 이미 푼 문제를, 검증 실패에 대해서는 아직 풀지 않았다.**
이 Task는 그 하나만 푼다.

## Scope

### 1. 조사 결과 — 저장소 실측

**① 검증 실패 증거는 지금 어디에 있는가**

| 정보 | 현재 위치 | 영속성 |
|---|---|---|
| stdout / stderr | **아무 데도 없다** — `verify()`가 `pipe()`로 흘려보낸다 | **휘발** |
| exit code | stdout telemetry `verification_exit_code` | **휘발** |
| duration | stdout telemetry `verification_duration_ms` | **휘발** |
| 논리 명령 이름 | run artifact `verification_command` | 영속 |
| 실패 여부 | run artifact `stages.verification = "failed"` | 영속 |
| **실패한 테스트 이름·메시지** | **아무 데도 없다** | — |

`src/workflow.ts` `verify()`는 `child.stdout.pipe(process.stdout)` · `child.stderr.pipe(process.stderr)`로
전달만 하고 **한 바이트도 붙잡지 않는다.** 반환값은 `{ code, duration, errorCode? }`뿐이다.

**즉 영속 기록에는 "실패했다"와 "어떤 명령이었나"만 있고 "왜"가 없다.**

**② 다음 Worker에게 줄 수 있는 최소 증거**

논리 명령 이름 · exit code · **한정된 출력 발췌** 셋이면 T-012의 실패를 진단하기에 충분했다.
당시 실제 실패 출력은 다음 두 줄이었다.

```
✖ a killed workflow leaves valid running observation
  'start' !== 'worker'
```

**③ 무엇을 넣으면 결정성이 깨지는가**

`duration_ms` · 타임스탬프 · `execution_id`는 실행마다 달라진다.
**Worker 입력에 넣지 않는다.** 발췌는 **파일에서 읽는다** — 다시 실행하지 않으므로
같은 저장소 상태에서 같은 stdin이 나온다.

**④ 재사용할 메커니즘**

`src/runner.ts:108-110`이 이미 조건부로 파일 내용을 stdin에 덧붙인다
(`attempt >= 2`이면 Review 첨부). **같은 모양을 그대로 쓴다.** 새 메커니즘을 만들지 않는다.

**⑤ 이미 있는 것**

- `readRuns(taskId, root)` — run artifact를 **시간순 정렬**로 반환한다 (`src/run.ts`)
- TELEMETRY.md `verification_command` · `verification_exit_code` · `verification_duration_ms` (T-010)

### 2. 증거 형식 — 후보 비교

| 후보 | 판정 |
|---|---|
| A. raw tail만 저장 | **기각.** 논리 명령과 exit code가 빠져 "무엇이 어떻게 실패했나"를 알 수 없다 |
| **B. 구조화 봉투 + 한정 발췌** | **채택.** 명령·exit code·발췌 셋이면 충분하고 그 이상은 필요 없다 |
| C. `.bcos/verification/` 별도 artifact | **기각.** run artifact가 이미 workflow 관측의 소유자다(T-012). 디렉터리를 늘릴 이유가 없다 |

### 3. Source of Truth — 기존 run artifact 확장

`RunRecord`에 **선택 필드 2개**만 더한다.

| 필드 | 뜻 |
|---|---|
| `verification_exit_code?: number` | 검증 프로세스 exit code |
| `verification_excerpt?: string` | 아래 §4 규칙으로 한정·정제한 출력 발췌 |

**검증이 실행된 경우에만 기록한다.** 실행되지 않았으면 두 필드 모두 **부재**다 —
빈 문자열·`0`으로 채우지 않는다.

기존 `RunRecord` 필드와 stage 8종은 **변경하지 않는다.**
**새 디렉터리·새 artifact 종류·새 이벤트 0개.**

### 4. 발췌의 경계 — 크기와 프라이버시

**크기** — 검증 출력의 **마지막 2,048 바이트**만 남긴다.
node 테스트 러너의 실패 요약과 실패 목록이 출력 끝에 오므로 꼬리가 맞는 선택이다.
잘렸으면 발췌 앞에 `…` 한 줄을 둔다.

**정제** — 저장 **전에** 다음을 치환한다.

| 대상 | 치환 |
|---|---|
| 저장소 루트 절대경로 | `<root>` |
| 사용자 홈 절대경로 | `<home>` |

**이것은 범용 비식별화가 아니다.** 두 경로 치환일 뿐이며 Task는 그렇게만 주장한다.
그 외 민감정보가 검증 출력에 섞이면 발췌에도 섞인다 — **알려진 한계로 기록한다.**

**stdout/stderr 전문을 저장하지 않는다.** 무제한 저장·전달 금지.

### 5. Staleness — 가장 최근 검증 결과만 본다

**규칙 한 줄** — `readRuns(taskId)`의 기록 중 **`stages.verification`이 `success` 또는
`failed`인 마지막 것**을 본다. 그것이 `failed`면 그 발췌를 전달하고, `success`면
아무것도 전달하지 않는다.

`not_started` · `skipped`는 **검증 결과가 아니므로 건너뛴다** — worker가 실패해 검증에
도달하지 못한 실행이 과거의 성공/실패를 덮지 않는다.

이 규칙이 요구된 시나리오를 그대로 만족한다.

```
fail → resume → 발췌 전달 → 수정 → verification success → submit
그다음 실행: 마지막 검증 결과가 success → 전달 없음
```

**event sourcing framework를 만들지 않는다.** `readRuns`는 이미 있다.

### 6. Worker 입력 — 순서와 결합

```
BCOS WORKER EXECUTION (preamble)
--- CONTEXT PACKAGE ---
--- REVIEW OF PREVIOUS ATTEMPT ---        (attempt >= 2일 때, 기존)
--- PREVIOUS HOST VERIFICATION FAILURE ---  (신규, 마지막)
```

**검증 실패 블록이 맨 뒤다.** 두 가지 이유가 있다.

1. **가장 최근이고 가장 실행 가능한 신호**다 — Worker가 지금 당장 고쳐야 할 것이다.
2. **없을 때 stdin이 지금과 바이트 단위로 동일**하다. 기존 블록의 위치가 변하지 않으므로
   회귀 위험이 최소다.

블록 내용은 다음뿐이다.

```
--- PREVIOUS HOST VERIFICATION FAILURE ---
command: npm-test
exit code: 1
<발췌>
```

**넣지 않는 것** — 타임스탬프 · duration · `execution_id` · attempt · 절대경로.
attempt를 넣지 않는 이유: 검증 실패는 attempt를 증가시키지 않고, `request-changes`는
`IMPLEMENTED`에서만 가능한데 그것은 검증 성공을 전제하므로,
**가장 최근 검증 실패는 언제나 현재 attempt의 것**이다.

**Review 피드백과 동시에 존재할 수 있다** — `request-changes`로 attempt 2에 진입한 뒤
Worker가 돌고 검증이 실패한 경우다. 그때 두 블록이 위 순서로 함께 들어간다.

### 7. attempt semantics — 바꾸지 않는다

| | attempt |
|---|---|
| `request-changes` | **증가** (RFC-001 §1.4, 현행) |
| **검증 실패** | **증가하지 않는다** — Task는 `IN_PROGRESS`에 그대로 남는다 |

발췌는 attempt가 아니라 **실행(run artifact)에 속한다.**
**검증 실패로 attempt를 올리지 않는다.**

### 8. `--verify-only`

Worker를 실행하지 않으므로 붙일 대상이 없다. **추가 처리 0.**
`runner_invocations=0`이 그대로 유지된다.

### 9. Telemetry — 새 키를 만들지 않는다

`verification_command` · `verification_exit_code` · `verification_duration_ms`가
이미 T-010부터 있다. **stdout telemetry에 새 키를 추가하지 않는다.**

`docs/benchmarks/TELEMETRY.md`에는 run artifact가 담는 두 필드를 **한 문단으로 기술**한다.
`feedback_handoff_count`(Review용)를 검증 피드백에 재사용하지 않는다 — 다른 것이다.

**비율·효율·절감률 금지.**

## Out of Scope

- Review feedback handoff 재설계 — 기존 메커니즘을 **모양만 재사용**한다
- `src/model.ts` · `src/context.ts` 수정
- Multi-model Switching (T-015) · Benchmark Harness (T-016) · Token/Cost
- 테스트 결과 parser framework · Jest/Vitest/JUnit 범용 parser
- 실패 원인을 LLM으로 요약하기
- stdout/stderr **전문** 영구 저장
- 범용 비식별화 엔진 — 경로 치환 2건뿐
- 새 telemetry 키 · 새 이벤트 · 새 lifecycle state · 새 전이
- 새 source file · class · registry · plugin · storage abstraction
- daemon · DB · queue · retry scheduler
- generic failure taxonomy
- 검증 실패 시 attempt 증가
- Context Package(`bcos task context`) 출력 변경

## Acceptance Criteria

### A. 증거 포착 (1–10)

1. `verify()`가 검증 자식 프로세스의 stdout·stderr를 **계속 부모로 전달**한다.
2. `verify()`가 그 출력의 **마지막 2,048 바이트**를 보관한다.
3. 2,048 바이트를 넘으면 잘리고 발췌 앞에 `…` 표시가 붙는다.
4. 2,048 바이트 이하면 잘림 표시가 **없다**.
5. 저장 전에 저장소 루트 절대경로가 `<root>`로 치환된다.
6. 저장 전에 홈 절대경로가 `<home>`으로 치환된다.
7. 검증이 실행되면 run artifact에 `verification_exit_code`가 기록된다.
8. 검증이 실행되면 run artifact에 `verification_excerpt`가 기록된다.
9. 검증이 **실행되지 않은** 실행의 artifact에는 두 필드가 **부재**다 — 빈 문자열·`0` 아님.
10. 검증 **성공** 시에도 두 필드가 기록된다 (exit code `0`).

### B. 전달 (11–20)

11. 직전 검증이 실패한 Task를 재개하면 Worker stdin에 `--- PREVIOUS HOST VERIFICATION FAILURE ---` 블록이 포함된다.
12. 블록에 **논리 명령 이름**이 포함된다 (`npm-test` · `custom-verifier`).
13. 블록에 **exit code**가 포함된다.
14. 블록에 **발췌**가 포함된다.
15. 블록에 타임스탬프·duration·`execution_id`·attempt가 **포함되지 않는다**.
16. 블록에 절대경로가 **포함되지 않는다**.
17. 블록은 Context Package **뒤**에 온다.
18. Review 블록이 있으면 검증 실패 블록은 그 **뒤**에 온다.
19. 직전 검증이 **성공**했으면 블록이 **없다**.
20. 검증 기록이 하나도 없으면 블록이 **없다**.

### C. Staleness (21–26)

21. `stages.verification`이 `success`/`failed`인 **마지막** 기록으로 판단한다.
22. `not_started`인 기록은 **건너뛴다**.
23. `skipped`인 기록은 **건너뛴다**.
24. 실패 뒤 성공한 실행이 있으면 **오래된 실패를 전달하지 않는다**.
25. 성공 뒤 실패한 실행이 있으면 **그 실패를 전달한다**.
26. 다른 Task의 run artifact는 영향을 주지 않는다.

### D. 결정성 · 프라이버시 (27–32)

27. **같은 저장소 상태 · 같은 발췌 → 같은 stdin SHA-256.**
28. 검증 실패 기록이 없을 때 worker stdin이 **T-014 이전과 바이트 단위로 동일**하다.
29. run artifact에 사용자 홈 절대경로가 **0건**이다.
30. run artifact에 환경변수 값이 **0건**이다.
31. Worker stdin에 홈 절대경로가 **0건**이다.
32. `bcos task context` 출력이 **변경되지 않는다**.

### E. Lifecycle 보존 (33–38)

33. 검증 실패로 **attempt가 증가하지 않는다**.
34. 검증 실패 시 submit이 **여전히 막힌다**.
35. 검증 실패 시 Task가 `IN_PROGRESS`로 남는다.
36. `--verify-only`에서 `runner_invocations=0`이 유지된다.
37. nested worker 가드가 그대로 동작한다.
38. 새 이벤트·새 상태·새 전이 **0개**.

### F. 경계 (39–45)

39. **새 source file 0개.**
40. `src/model.ts` · `src/context.ts` **무변경**.
41. `src/run.ts` **100줄 이하** · `src/workflow.ts` **330줄 이하** · `src/runner.ts` **200줄 이하**.
42. `class` · `interface` · registry · plugin **0건**.
43. `dependencies` 0개 · `devDependencies` 2개.
44. **새 stdout telemetry 키 0개.**
45. 기존 telemetry 키 집합이 **불변**이다.

### G. 회귀 · 품질 (46–51)

46. 기존 239개 테스트가 전부 통과한다.
47. `task execute` · `--review` · rework 루프 회귀 없음.
48. `task status` · run artifact(T-012) 회귀 없음.
49. `npm run build` exit 0.
50. `npm test` **실패 0건**, 총 **255개 이상**.
51. 테스트 삭제·skip **0건**.

**총 51개.**

## Expected Files

**수정**

- `src/workflow.ts` — `verify()`가 출력을 전달하면서 꼬리를 보관, 결과를 run artifact에 기록
- `src/run.ts` — `RunRecord`에 선택 필드 2개 + 발췌 한정·정제 헬퍼
- `src/runner.ts` — 직전 검증 실패를 찾아 stdin에 덧붙임
- `tests/cli.test.ts` — 신규 테스트
- `docs/benchmarks/TELEMETRY.md` — run artifact의 두 필드 기술 (한 문단)

**생성**

- `.bcos/reports/T-014-verification-failure-feedback.md`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-014-verification-failure-feedback.md` (이 파일)
- `docs/rfcs/RFC-001-task-protocol.md` — **§1.4 attempt · §6 Context Package. 읽기 전용**
- `docs/benchmarks/TELEMETRY.md`
- `src/workflow.ts`
- `src/run.ts`
- `src/runner.ts`
- `tests/cli.test.ts`
- `package.json`

**쓰기**

위 "수정"·"생성" 목록뿐이다. `docs/rfcs/`는 **읽기 전용**이다.

## Test Requirements

**현재 239개.** 신규 **16개 이상**, 목표 총 **255개**, AC 하한 **255개**.
(하한이 목표를 넘지 않는다.)

| # | 신규 테스트 |
|---|---|
| 1 | 검증 실패 시 submit이 일어나지 않는다 (기존 동작 유지 확인) |
| 2 | 검증 실행 후 artifact에 `verification_exit_code`·`verification_excerpt`가 기록된다 |
| 3 | 검증이 실행되지 않은 실행의 artifact에 두 필드가 **부재**다 |
| 4 | 재개한 Worker stdin에 실패 블록이 포함된다 |
| 5 | 블록에 논리 명령 이름이 포함된다 |
| 6 | 블록에 exit code가 포함된다 |
| 7 | 블록에 한정된 발췌가 포함된다 |
| 8 | 발췌·블록에 절대경로가 없다 |
| 9 | 발췌에 환경변수 값이 없다 |
| 10 | 2,048 바이트 초과 출력이 잘리고 잘림 표시가 붙는다 |
| 11 | 직전 검증이 성공이면 블록이 없다 (stale 미전달) |
| 12 | `not_started`/`skipped` 기록을 건너뛰고 그 이전 결과를 쓴다 |
| 13 | `--verify-only`에서 `runner_invocations=0` |
| 14 | Review 블록과 검증 실패 블록이 함께, **정해진 순서로** 들어간다 |
| 15 | 같은 발췌·같은 상태에서 stdin SHA-256이 동일하다 |
| 16 | **real-shape fixture** — 아래 참조 |

**real-shape fixture (필수)** — T-012에서 실제로 난 실패와 같은 모양을 쓴다.
합성 fixture만으로는 실제 출력 형태의 결함을 놓친다는 것을 **T-900 F-1에서 이미 겪었다.**

```
✖ a killed workflow leaves valid running observation
  'start' !== 'worker'
ℹ tests 186
ℹ pass 185
ℹ fail 1
```

이 형태가 발췌에 온전히 담기고 Worker stdin에 전달되는지 확인한다.

**회귀** — 기존 239개 전부 통과. 특히 `task execute forwards verifier stdout and stderr`가
계속 통과해야 한다 (전달 semantics 유지).

**금지** — 새 테스트 프레임워크 · 기존 assertion 완화 · 테스트 삭제/skip ·
실제 모델 호출 · 네트워크.

## Benchmark Telemetry

**새 stdout telemetry 키를 추가하지 않는다.** T-010의 `verification_command` ·
`verification_exit_code` · `verification_duration_ms`를 그대로 쓴다.

run artifact가 `verification_exit_code`와 `verification_excerpt`를 담게 되는 것을
`docs/benchmarks/TELEMETRY.md`에 **한 문단**으로 적는다.

token / cost는 T-013과 동일하게 **`blocked`**다. 추정값을 만들지 않는다.
**efficiency · improvement · savings · reduction 류를 기록하지 않는다.**

## Notes — 알려진 한계와 위험

**정제는 경로 치환 2건뿐이다.** 저장소 루트와 홈 경로를 치환할 뿐, 범용 비식별화가
아니다. 검증 출력에 다른 민감정보가 섞이면 발췌에도 섞인다. **그렇게만 주장한다.**

**발췌는 run artifact에 들어가고 run artifact는 커밋된다** (T-012에서 결정된 정책).
따라서 발췌 내용이 저장소 이력에 남는다. 2,048 바이트 상한과 경로 치환이 그 비용을
제한하는 장치다.

**가장 큰 회귀 위험은 `verify()`의 전달 방식 변경이다.** 현재 `pipe()`를
수동 write로 바꾸면 스트리밍이 미묘하게 달라질 수 있다. AC 1과 기존 테스트
`task execute forwards verifier stdout and stderr`가 이것을 잡는다.
**출력이 화면에 안 나오면 실패로 판정한다.**

**T-012 F-5의 fixture telemetry 혼입은 그대로 남는다.** `verify()`가 검증 자식의
stdout을 부모로 전달하기 때문이며, 이 Task는 그 동작을 **유지**한다. 해결하지 않는다.
