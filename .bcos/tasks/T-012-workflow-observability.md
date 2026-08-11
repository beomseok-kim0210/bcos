---
protocol: "0.1"
id: T-012
title: Record each workflow execution so a finished run can be inspected later
status: DONE
attempt: 1
created: 2026-08-10T03:06:09Z
updated: 2026-08-11T02:08:05.559Z
---

## Objective

T-011의 실제 dogfooding은 **성공했다.** workflow가 약 10분 실행돼 exit 0으로 끝났고
T-011은 `IMPLEMENTED`까지 자동으로 갔다.

**그런데 우리는 그것이 멈춘 줄 알았다.** 상위 세션이 종료되며 추적이 끊겼고, 중간
스냅샷의 `IN_PROGRESS`를 "중단"으로 읽었다. 사실을 밝혀낸 것은 BCOS가 아니라
**우연히 파일로 리다이렉트해 둔 출력**이었다.

**실행은 자동화됐는데 관찰이 자동화되지 않았다.**

T-012는 workflow 실행마다 저장소에 작은 기록을 남기고, 그것을 조회하는 명령 하나를
만든다. 사용자가 터미널이나 상위 세션을 잃어도 **저장소만으로** 답을 얻는다.

```
node dist/cli.js task status T-012
```

**daemon도, 서버도, 데이터베이스도 만들지 않는다.**

## Scope

`src/run.ts` 를 새로 만들고 `src/workflow.ts` · `src/cli.ts` 를 확장한다.

- [ ] execution id를 만들고 실행 기록 파일을 연다
- [ ] 각 stage 경계에서 기록을 갱신한다
- [ ] 종료 시 최종 상태와 사유를 기록한다
- [ ] `task status <id>` 로 조회한다
- [ ] stdout telemetry에 `execution_id` 를 더한다

### 저장소 조사 결과 — 설계의 근거

**telemetry는 정확히 두 곳에서 나오고 둘 다 `console.log` 다** —
`src/runner.ts:166`, `src/workflow.ts:136`. **저장되는 곳이 없다.**

**실행 신원 개념이 코드에 전혀 없다** — `execution_id` · `run_id` · `session_id`
문자열이 `src/` 에 0건이다.

**`state.json` 으로 알 수 있는 것** — 상태별 Task 수, `current_task`, 마지막 갱신 시각.
**알 수 없는 것** — workflow가 돌았는지, 어느 stage였는지, 어떻게 끝났는지.

**`events.jsonl` 로 알 수 있는 것** — lifecycle 전이의 시각·actor·from·to.
**알 수 없는 것** — 한 실행의 경계, worker·verification·reviewer 결과, 실패 사유.
`TASK_STARTED` 만 있고 `TASK_SUBMITTED` 가 없을 때 **아직 도는 중인지 죽었는지 구분할
수 없다.** T-011에서 정확히 그 상황이었다.

### 저장 구조 — `.bcos/runs/<execution-id>.json`

| 후보 | 판단 |
|---|---|
| `events.jsonl` 확장 | **배제.** RFC-001 §5의 append-only 감사 로그이고 전이만 담는다. 실행 관찰을 섞으면 스키마가 깨진다 |
| `state.json` 확장 | **배제.** ADR-002가 "`tasks/` 에서 재생성 가능한 파생 인덱스"로 정의한다. 실행 이력은 재생성 불가다 |
| `.bcos/runs.jsonl` 단일 append 파일 | 손상 위험은 없으나 현재 상태를 알려면 전체를 재생해야 하고 Task별 분리가 없다 |
| **`.bcos/runs/<execution-id>.json`** | **채택.** 한 파일 = 한 실행. 읽기는 파싱 한 번. `reports/` · `reviews/` 와 같은 배치 |

**ADR-002와 충돌하지 않는다** — 평문 파일이고 SQLite를 쓰지 않는다.
`docs/architecture.md` 의 배치 목록에 `runs/` 를 한 줄 추가한다.

### execution id

```
<UTC 압축 타임스탬프>-<8자리 hex>
20260810T021906428Z-a1b2c3d4
```

밀리초까지 넣어 **파일명 사전순 정렬이 곧 시간순**이다. "가장 최근 실행"을 고르는 데
파일을 열 필요가 없다. hex 8자리는 같은 밀리초 충돌을 막는다.
`node:crypto` 만 쓴다 — 이미 `src/runner.ts` 가 import한다.

### 기록을 여는 시점 — guard를 통과한 뒤

**중요한 제약을 조사에서 찾았다.** `tests/cli.test.ts` 의 `bcosSnapshot()` 은
`.bcos/` **전체 트리**를 비교하며 **57곳에서 쓰인다.** nested worker 거부와 capability
probe 거부 테스트가 그것으로 "`.bcos/` 무변경"을 단언한다.

**그래서 기록은 빠른 guard가 전부 끝난 뒤에 연다.** 구체적으로 Task 상태 검사가
끝나고 `start`·worker·verification 중 첫 stage가 시작되기 직전이다.

**guard에서 거부된 실행은 기록을 남기지 않는다.** 의도된 경계다 —
그 실패들은 **즉시·동기적으로 터미널에 보이고**, T-012가 푸는 문제는
**오래 도는 분리된 실행**이다. 그리고 기존 57개 단언을 깨지 않는다.

### stage — `src/workflow.ts` 실행 순서에서 뽑는다

임의로 정하지 않았다. 아래는 현재 코드의 실제 순서다.

| stage | 근거 |
|---|---|
| `start` | `lifecycle("start", …)` — `TODO` 일 때만 |
| `worker` | `runCodexWorker(…)` — `--verify-only` 면 건너뜀 |
| `report_check` | `hasReport(…)` |
| `verification` | `verify(command)` |
| `submit` | `lifecycle("submit", …)` |
| `review` | `runReviewer(…)` — `--review` 일 때만 |
| `approve` | `lifecycle("approve", …)` — 판정이 `APPROVED` |
| `request_changes` | `lifecycle("request-changes", …)` — 판정이 `CHANGES_REQUESTED` |

`--review` 없는 실행은 `submit` 에서 끝난다. 있는 실행은 `review` 이후로 이어지고
재작업이면 `worker` 로 되돌아간다.

**stage 상태 어휘**

| 값 | 뜻 |
|---|---|
| `not_started` | 이 실행에서 도달하지 않았다 |
| `skipped` | 조건 때문에 건너뛰었다 (`--verify-only` 의 worker, 재개 시 `start`) |
| `running` | 시작했고 끝을 관측하지 못했다 |
| `success` | 끝났고 성공했다 |
| `failed` | 끝났고 실패했다 |

**`not_started` 와 `skipped` 와 `failed` 를 구분한다. 0으로 채우지 않는다.**

### 중단 의미 — 추론하지 않는다

프로세스가 강제 종료되면 기록은 `running` 으로 남는다.
**그것을 자동으로 `failed` 로 바꾸지 않는다.**

저장하는 `workflow_status` 는 **BCOS가 관측한 것만** 담는다 — `running` · `success` ·
`failed` 셋이다. `interrupted` 나 `unknown` 을 파일에 쓰지 않는다.

**조회 명령이 그 구분을 표현한다.** `running` 인데 마지막 갱신이 오래됐으면
`last known: running` 과 경과 시간을 보여주고 **BCOS가 종료를 관측하지 못했다**고
말한다. 살아 있다고 단정하지도, 죽었다고 단정하지도 않는다.

**heartbeat도 process supervisor도 만들지 않는다.**

### 갱신 시점과 원자적 쓰기

기록을 쓰는 지점은 **stage 경계뿐**이다 — 기록 생성 시 1회, 각 stage 시작 시,
각 stage 종료 시, workflow 종료 시. 한 실행에서 대략 6–12회다.

**기존 관행을 그대로 쓴다.** `src/cli.ts:131-137` 이 Task 파일과 `state.json` 에
쓰는 방식이 temp 파일 작성 후 `renameSync` 다. **같은 방식을 쓴다.**
트랜잭션·WAL·잠금 프레임워크를 만들지 않는다.

### 조회 명령 — `task status <id>` 하나

| 후보 | 판단 |
|---|---|
| **`task status <id>`** | **채택.** 사용자의 실제 질문이 Task 기준이다 |
| `task inspect <id>` | 같은 일에 다른 이름 |
| `run inspect <execution-id>` | 실행 id를 알아야 물을 수 있다. 사용자는 그것을 모른다 |

**명령은 하나만 만든다.** 특정 실행을 보려면 `--execution <execution-id>` 를 쓴다.
그 Task의 실행이 여럿이면 **파일명 정렬 마지막**이 최신이고, 출력 끝에 총 실행 수와
나머지 execution id를 한 줄로 보여준다. 목록 전용 명령을 만들지 않는다.

Task가 없으면 exit 1. Task는 있는데 실행 기록이 없으면 **exit 0**이고 그렇게 말한다 —
기록이 없는 것은 오류가 아니다.

### fixture telemetry 혼입 — 정확한 경로와 처리

**경로를 특정했다.** `src/workflow.ts:72-73` 의 `verify()` 가 검증 자식의 stdout을
부모 stdout으로 `pipe` 한다. 검증 명령이 `npm test` 면 테스트가 CLI fixture를 21곳에서
띄우고, **그 fixture들이 내는 `telemetry …` 줄이 파이프를 타고 부모 stdout에 섞인다.**

**stdout 전달을 stderr로 바꾸지 않는다.** `tests/cli.test.ts:1599` 가
`task execute forwards verifier stdout and stderr` 로 그 계약을 단언한다.
T-010의 AC를 깨는 변경이 된다.

**대신 두 가지로 처리한다.**

1. **권위 있는 출처를 stdout에서 옮긴다.** fixture 실행은 자기 임시 저장소의
   `.bcos/runs/` 에 쓰므로 실제 저장소 기록과 **구조적으로 섞이지 않는다.**
2. **stdout telemetry에 `execution_id` 를 더한다.** 섞인 줄도 어느 실행 것인지 붙는다.

**stdout 혼입 자체를 없앴다고 주장하지 않는다.** 권위를 옮기고 귀속을 가능하게 했을 뿐이다.

### 무엇을 저장하지 않는가

**절대 저장하지 않는다** — 사용자 홈 절대경로 · 전체 command line · 환경 변수 ·
프롬프트 전문 · Context Package 전문 · stdout·stderr 전문 · 자격증명.

기존 telemetry 관행대로 **해시 · 바이트 수 · 논리 이름**만 담는다.
`verification_command` 는 이미 `npm-test` 같은 논리 값이다. 같은 규칙을 따른다.

### lifecycle SSOT를 침범하지 않는다

**Task 상태의 단일 진실 원천은 그대로 `tasks/*.md` 다.** 실행 기록은 그것을 소유하지
않고 복제하지 않는다.

| | 뜻 | 소유 |
|---|---|---|
| Task `status` | 프로토콜 상태 (`IMPLEMENTED` 등) | `tasks/*.md` |
| `workflow_status` | **한 번의 실행 관찰** (`success` 등) | `.bcos/runs/` |

**둘은 다른 정보다.** Task가 `IMPLEMENTED` 인데 그 실행은 `failed` 일 수 있고,
`DONE` 인데 마지막 실행 기록은 `running` 으로 남아 있을 수 있다.
실행 기록은 **참고 자료이지 상태의 근거가 아니다.**

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **daemon · background service · process supervisor · heartbeat**
- **web dashboard · HTTP server · 외부 로깅 시스템 · cloud telemetry**
- **database · SQLite · WAL · 트랜잭션 시스템 · 파일 잠금 프레임워크**
- **OpenTelemetry · tracing SDK · message queue · event bus · plugin**
- **generic storage abstraction · repository pattern · `RunManager` class 계층 ·
  schema framework · migration framework**
- **retry engine · multi-machine 실행**
- **Model Adapter · Claude/Codex switching · benchmark 계산** — T-013 이후
- **`events.jsonl` 에 비전이 레코드 추가** — RFC-001 §5 위반
- **`state.json` 에 실행 이력 추가** — ADR-002의 재생성 가능성 위반
- **실행 기록이 lifecycle 상태를 소유하거나 대체**
- **`running` 을 `failed` 로 자동 전환** — 관측하지 않은 것을 단정하지 않는다
- **`interrupted` · `unknown` 을 파일에 저장** — 그것은 읽기 시점의 해석이다
- **stdout telemetry 제거·개명** — 추가만 한다
- **`verify()` 의 stdout 전달 방향 변경** — T-010 계약이다
- **`TELEMETRY.md` 의 기존 112개 필드 수정·삭제·개명** — 추가만 허용한다
- **RFC-001 · CLAUDE.md · AGENTS.md 수정** — 필요하면 제안만 남긴다
- **조회 명령 2개 이상** · 목록 전용 명령 · 실행 기록 삭제·정리 명령
- **절대경로 · 프롬프트 · Context · 출력 전문 저장**
- **셸 실행** — `shell: true`, `cmd /c`, 셸 문자열 조립
- **runtime dependency 추가** · `package-lock.json` 생성
- **`src/context.ts` · `src/runner.ts` · `src/reviewer.ts` 수정**
- 이 저장소의 실제 `.bcos/` 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- **테스트에서 실제 Codex·실제 Claude·실제 `npm test` 호출**
- `.bcos/prompts/` 에 파일 추가

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.

**실행 기록 생성**

2. 성공한 `task execute` 실행 후 `.bcos/runs/` 에 파일이 정확히 1개 생긴다.
3. 파일 이름이 `<타임스탬프>-<8자리 hex>.json` 형태다.
4. 파일 내용이 유효한 JSON이다.
5. `execution_id` 가 파일 이름과 일치한다.
6. `task_id` · `attempt` 가 기록된다.
7. `started_at` · `updated_at` 이 RFC 3339다.
8. 성공하면 `completed_at` 과 `workflow_status=success` 가 기록된다.
9. **두 번 실행하면 파일이 2개가 되고 `execution_id` 가 서로 다르다.**
10. **파일명 사전순 정렬이 시간순과 일치한다.**

**stage 기록**

11. `--review` 없는 성공 실행에서 `start` · `worker` · `report_check` ·
    `verification` · `submit` 이 `success` 로 기록된다.
12. 그 실행에서 `review` · `approve` · `request_changes` 가 `not_started` 다.
13. `current_stage` 가 마지막으로 진행한 stage를 가리킨다.
14. `--verify-only` 실행에서 `worker` 가 **`skipped`** 다.
15. `IN_PROGRESS` 재개 실행에서 `start` 가 **`skipped`** 다.
16. **`not_started` · `skipped` · `failed` 가 서로 다른 값으로 구분된다.**
17. 어떤 stage도 값 `0` 으로 채워지지 않는다.

**실패 기록**

18. worker 실패 시 `worker` 가 `failed` 이고 `workflow_status=failed` 다.
19. 그때 `verification` 이 `not_started` 다.
20. verification 실패 시 `verification` 이 `failed` 이고 `submit` 이 `not_started` 다.
21. Report 없음으로 실패하면 `report_check` 가 `failed` 다.
22. worker timeout 시 `workflow_exit_reason=timeout` 이 기록된다.
23. reviewer 실패 시 `review` 가 `failed` 이고 `workflow_exit_reason=reviewer_failed` 다.
24. 판정 불가 시 `workflow_exit_reason=verdict_unreadable` 이 기록된다.
25. cycle 소진 시 `workflow_exit_reason=review_cycles_exhausted` 가 기록된다.
26. 모든 실패 경로에서 `workflow_status=failed` 다.

**review / rework**

27. `--review` 승인 실행에서 `review` 와 `approve` 가 `success` 다.
28. 재작업 실행에서 **`execution_id` 가 하나로 유지된다** — 파일이 늘지 않는다.
29. 재작업 후 기록의 `attempt` 가 2다.
30. 재작업 실행에서 `request_changes` 가 `success` 로 기록된다.
31. 재작업 후 `worker` 가 다시 `success` 가 된다 — 이전 상태를 덮어쓴다.

**중단 의미**

32. 실행 중에는 `workflow_status=running` 이고 `completed_at` 이 **없다.**
33. **프로세스를 강제 종료해도 기록이 `failed` 로 바뀌지 않는다.**
34. 그때 마지막 `updated_at` 과 `current_stage` 가 남아 있다.
35. **파일에 `interrupted` 나 `unknown` 이 저장되지 않는다.**
36. 강제 종료 후에도 파일이 유효한 JSON이다.

**조회 명령**

37. `task status <id>` 가 exit 0으로 최신 실행을 출력한다.
38. 출력에 Task · execution id · attempt · 상태 · stage · 시각 · 종료 사유가 있다.
39. 출력에 worker · verification · reviewer stage 결과가 있다.
40. 출력에 **마지막 lifecycle 이벤트**가 있다.
41. 실행이 여럿이면 **가장 최근 것**을 보여준다.
42. 그때 총 실행 수를 알려준다.
43. `--execution <id>` 로 특정 실행을 볼 수 있다.
44. 없는 `--execution` 값이면 exit 1이다.
45. 없는 Task면 exit 1이다.
46. 실행 기록이 없는 Task면 **exit 0**이고 그렇게 말한다.
47. `workflow_status=running` 인데 오래된 기록이면 **관측하지 못했다고 표시한다.**
48. 그 표시가 살아 있다고도 죽었다고도 단정하지 않는다.
49. **`task status` 가 어떤 파일도 쓰지 않는다** — `.bcos/` 해시 불변.
50. `--help` 에 `status` 가 나온다.

**SSOT 비침범**

51. 실행 기록에 Task `status` 를 소유하는 필드가 없다.
52. Task 상태와 `workflow_status` 가 다를 수 있고 둘 다 읽힌다.
53. 실행 기록이 `events.jsonl` 이나 `state.json` 을 수정하지 않는다.
54. `events.jsonl` 에 전이가 아닌 레코드가 추가되지 않는다.

**guard 경계**

55. **nested worker 거부 시 `.bcos/runs/` 에 파일이 생기지 않는다.**
56. capability probe 거부 시에도 생기지 않는다.
57. 옵션 검증 실패 시에도 생기지 않는다.
58. **그 경로들에서 `.bcos/` 전체 해시가 불변이다** — 기존 단언을 깨지 않는다.

**개인정보 / 재현성**

59. 기록에 절대경로가 없다.
60. 기록에 프롬프트 전문·Context Package 전문이 없다.
61. 기록에 stdout·stderr 전문이 없다.
62. 기록에 환경 변수·자격증명이 없다.
63. `verification_command` 가 논리 값이다.

**원자적 쓰기**

64. 기록 갱신이 temp 파일 작성 후 rename으로 이뤄진다.
65. 갱신 후 `.bcos/runs/` 에 temp 파일이 남지 않는다.
66. 각 stage 이후 파일이 항상 유효한 JSON이다.

**stdout telemetry**

67. 기존 telemetry 키가 하나도 사라지지 않는다.
68. **`telemetry execution_id=<값>` 이 추가된다.**
69. 그 값이 기록 파일의 `execution_id` 와 같다.
70. 비율 계산 키가 소스에 없다 — `_rate` · `_ratio` · `efficiency` ·
    `improvement` · `savings` · `reduction`.
71. `docs/benchmarks/TELEMETRY.md` 에 새 키가 추가되고 기존 112개가 보존된다.
72. 추가된 내용에 계산 필드가 없다.
73. `docs/architecture.md` 배치 목록에 `runs/` 가 추가된다.

**회귀**

74. `task start` · `submit` · `approve` · `request-changes` · `context` · `run` ·
    `execute` 정상 1건 + 실패 1건.
75. `task execute --review` 승인·재작업 경로가 그대로 동작한다.
76. nested guard · capability probe · SoD 사전 검사가 그대로 동작한다.
77. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.

**품질**

78. `npm test` 가 통과하며 **175개 이상**의 테스트가 pass한다.
79. `package.json` 에 `dependencies` 키가 없고 `devDependencies` 가 2개 그대로다.
80. `src/` 에 `cli.ts` · `context.ts` · `runner.ts` · `workflow.ts` · `reviewer.ts` ·
    `run.ts` **여섯 파일만** 존재하고 하위 디렉터리가 없다.
81. `src/run.ts` 가 **120줄을 넘지 않는다.**
82. `src/workflow.ts` 가 **310줄을 넘지 않는다.**
83. `src/run.ts` 에 class가 없다 — 함수만 export한다.
84. **테스트가 실제 Codex·실제 Claude·실제 `npm test` 를 호출하지 않는다.**
85. 소스에 `shell: true` · `cmd /c` · 셸 문자열 조립이 없다.
86. `src/context.ts` · `src/runner.ts` · `src/reviewer.ts` 가 변경되지 않는다.
87. `git status` 기준 변경 파일이 `src/run.ts` · `src/workflow.ts` · `src/cli.ts` ·
    `tests/cli.test.ts` · `docs/benchmarks/TELEMETRY.md` · `docs/architecture.md` ·
    Report **7개뿐**이다. `package-lock.json` 이 없고 이 저장소의 `.bcos/` 내용이
    변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**생성**

- `src/run.ts`

**수정**

- `src/workflow.ts` — 기록 생성·stage 갱신·종료 기록
- `src/cli.ts` — `task status` 라우팅과 출력
- `tests/cli.test.ts`
- `docs/benchmarks/TELEMETRY.md` — **새 필드 추가만.** 기존 112개와 다른 절은 그대로 둔다
- `docs/architecture.md` — 배치 목록에 `runs/` **한 줄 추가만**

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-012-workflow-observability.md` (이 파일)
- `docs/rfcs/RFC-001-task-protocol.md` — **§5 Event · §7 소유권. 읽기 전용**
- `docs/benchmarks/TELEMETRY.md`
- `docs/architecture.md`
- `src/cli.ts`
- `src/workflow.ts`
- `src/runner.ts` — **읽기 전용.** telemetry 출력 방식 확인용
- `src/reviewer.ts` — **읽기 전용.** review 결과 형태 확인용
- `tests/cli.test.ts`
- `package.json`

**쓰기**

- `.bcos/reports/T-012-workflow-observability.md`

**`src/run.ts` 가 필요한 근거 — 줄 수와 책임.**
`src/workflow.ts` 는 현재 270줄이고 T-011이 정한 상한이 300이다. 기록 생성·stage
갱신·종료 기록을 그 안에 넣으면 상한을 넘는다. 그리고 **읽는 쪽은 `src/cli.ts` 다** —
같은 파일 형식을 두 곳이 알아야 하므로 공용 모듈이 전체적으로 더 작다.
`src/run.ts` 는 **기록의 형태와 읽고 쓰기만** 담당하며 workflow 로직을 갖지 않는다.

**실행 프롬프트 파일이 없다.** T-009가 없앴다.

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**실제 Codex·실제 Claude·실제 `npm test` 를 절대 호출하지 않는다.**
기존 fixture 방식(`--worker-command` · `--verify-command` · `--reviewer-command`)을
그대로 쓴다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 fixture를 만들고
`spawnSync` 의 `cwd` 옵션으로 CLI를 실행한다. **이 저장소의 실제 `.bcos/` 를 읽거나
쓰는 테스트는 금지한다.**

**기존 `bcosSnapshot()` 을 바꾸지 마라.** `.bcos/` 전체를 비교하며 57곳에서 쓰인다.
guard 거부 경로가 기록을 남기지 않으므로 그대로 통과해야 한다.

**중단 테스트 방법** — 오래 걸리는 가짜 worker를 두고 부모 프로세스를 죽인 뒤
`.bcos/runs/` 파일을 읽는다. 타이머로 `kill` 하며, daemon을 만들지 않는다.

| # | 대상 | 기대 |
|---|---|---|
| 1–156 | 기존 테스트 156개 | 전부 그대로 통과 |
| 157 | 성공 실행 | 기록 파일 1개, 유효 JSON, id가 파일명과 일치 |
| 158 | 식별 | 두 번 실행 → 파일 2개, id 상이 |
| 159 | 정렬 | 파일명 사전순 = 시간순 |
| 160 | stage 성공 | `--review` 없음: 5개 stage `success`, 나머지 `not_started` |
| 161 | `current_stage` | 마지막 진행 stage를 가리킴 |
| 162 | `--verify-only` | `worker` 가 `skipped` |
| 163 | 재개 | `start` 가 `skipped` |
| 164 | worker 실패 | `worker` `failed`, `verification` `not_started` |
| 165 | verification 실패 | `verification` `failed`, `submit` `not_started` |
| 166 | Report 없음 | `report_check` `failed` |
| 167 | reviewer 실패 | `review` `failed`, 사유 기록 |
| 168 | 판정 불가 · cycle 소진 | 각 사유 기록 |
| 169 | review 승인 | `review`·`approve` `success` |
| 170 | rework | **execution_id 유지**, 파일 1개, `attempt` 2, `request_changes` `success` |
| 171 | 중단 | 강제 종료 후 `running` 유지, `failed` 아님, 유효 JSON |
| 172 | 중단 | `interrupted`·`unknown` 이 파일에 없음 |
| 173 | `task status` 정상 | exit 0, 필수 항목 전부 출력 |
| 174 | `task status` 최신 선택 | 실행 3개 중 최신, 총 개수 표시 |
| 175 | `--execution` | 특정 실행 조회, 없는 값은 exit 1 |
| 176 | `task status` 경계 | 없는 Task exit 1, 기록 없는 Task exit 0 |
| 177 | `task status` 무쓰기 | `.bcos/` 해시 불변 |
| 178 | 오래된 `running` | 관측 못 했다고 표시, 생사 단정 없음 |
| 179 | SSOT | Task 상태와 `workflow_status` 가 달라도 둘 다 읽힘, events 비전이 0건 |
| 180 | guard 경계 | nested·probe·옵션 실패에서 기록 파일 0개, `.bcos/` 해시 불변 |
| 181 | 개인정보 | 절대경로·프롬프트·Context·출력 전문 0건 |
| 182 | 원자성 | temp 파일 잔존 0건, 각 stage 후 유효 JSON |
| 183 | stdout telemetry | 기존 키 보존, `execution_id` 추가, 기록 파일과 일치 |
| 184 | TELEMETRY.md | 새 키 존재, 기존 112개 보존, 계산 키 0건 |
| 185 | Lifecycle 회귀 | 기존 7개 명령 정상·실패 각 1건 |

**신규 29개, 총 185개를 목표로 한다.** AC 78의 하한은 **175**이며 계획이 하한을 넘는다.
**숫자를 맞추려고 테스트를 쪼개지 않는다.**

**증거:** Report의 `Test Evidence` 에 `npm run build` 와 `npm test` 의 출력 전문,
성공 실행 기록 파일 전문, 실패 경로 기록 파일, 중단 후 기록 파일,
`task status` 출력 전문, `telemetry` 줄 전문, 회귀 결과를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join` 을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used` 에 읽은 파일 수, Read List 밖에서 읽은 파일,
완료 후 `src/run.ts` 줄 수와 `src/workflow.ts` · `src/cli.ts` 증감을 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·환경 변수 값을 Report에 남기지 않는다.

## Benchmark Telemetry

필드 정의는 [docs/benchmarks/TELEMETRY.md](../../docs/benchmarks/TELEMETRY.md)에 있다.
**이번 Task는 그 문서에 새 절 하나를 추가한다.**

**이번에 추가되는 필드**

| key | 출처 |
|---|---|
| `execution_id` | Orchestrator가 만드는 실행 식별자 |
| `workflow_status` | `running` · `success` · `failed` — **관측한 것만** |
| `current_stage` | 마지막으로 진행한 stage |
| `stage_status` | `not_started` · `skipped` · `running` · `success` · `failed` |
| `run_record_path` | 기록 파일의 **저장소 상대 경로** |

**기존 필드와의 관계**

| 기존 | 관계 |
|---|---|
| `session_id` (manual) | **다르다.** 사람의 연속 작업 단위이고 `execution_id` 는 workflow 한 번이다 |
| `workflow_exit_reason` (T-010) | 그대로 쓴다. 기록 파일에도 같은 값이 담긴다 |
| `workflow_resume_count` (blocked) | **해제 후보다.** 실행 기록이 남으므로 셀 수 있다. 다만 이번에 계산하지 않는다 |
| `current_state` (now) | Task 상태다. `workflow_status` 와 **섞지 않는다** |

**계산 금지** — 비율·개선율·절감률·효율·ROI를 만들지 않는다.
**없는 값을 0으로 채우지 않는다** — 도달하지 않은 stage는 `not_started` 다.

**T-011 baseline**

| | T-011 실측 |
|---|---|
| 사람이 입력한 lifecycle 명령 | 1 |
| workflow 실행 시간 | 598,607 ms |
| 실행 중 상태 조회 수단 | **없음** |
| 사후 확인 수단 | **우연히 남긴 리다이렉트 로그** |
| 저장소에 남은 실행 증거 | **0** |
| stdout에 섞인 fixture telemetry | 관측됨 |

**T-012의 목표는 마지막 두 줄을 바꾸는 것이다.** 단계 수나 시간을 개선율로 환산하지 않는다.

## Required Protocol / Policy Notes

**이 Task에서 아래를 수정하지 않는다.**

**1. `docs/architecture.md` 배치 목록 (이번에 수정한다)**

`.bcos/` 하위에 `runs/` 를 한 줄 추가한다. **ADR을 새로 쓰지 않는다** — ADR-002가 정한
"평문 파일, SQLite 없음"에 부합하고, `tasks/*.md` 가 단일 진실 원천이라는 저장 모델을
바꾸지 않는다. 배치 사실을 문서에 반영하는 것뿐이다.

**2. RFC-001 (수정하지 않는다)**

실행 기록은 프로토콜 아티팩트가 아니다. Task·Report·Review·Event 어디에도 속하지
않으며 **관찰 자료**다. RFC 개정이 필요 없다. 다만 `.bcos/` 아래 다섯 번째 아티팩트가
생기므로, 프로토콜 아티팩트와 관찰 자료의 구분을 RFC에 한 줄 명시할지는 별도 판단이다.

## Notes — dogfooding 경계

**T-012는 `task execute --review` 로 실행되는 첫 후보다.**

현재 CLI가 받는 옵션을 실측했다 — `--worker` · `--actor-id` · `--timeout` ·
`--worker-command` · `--verify-command` · `--verify-only` · `--review` · `--reviewer` ·
`--reviewer-actor-id` · `--reviewer-command` · `--max-review-cycles`.

**다만 실제 Claude reviewer는 한 번도 실행된 적이 없다.** T-011의 검증은 전부 가짜
reviewer였다. `--review` 로 돌리면 **Claude의 판정이 `approve` 를 자동 실행한다** —
사람의 검토 없이 승인이 일어난다는 뜻이다. **그 자율성을 허용할지는 사람이 정한다.**

`--review` 없이 `IMPLEMENTED` 까지만 가고 Review는 수동으로 하는 선택지도 그대로 있다.
