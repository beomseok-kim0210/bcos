---
protocol: "0.1"
id: T-010
title: Drive start, run, verify, and submit as one workflow command
status: DONE
attempt: 1
created: 2026-08-07T05:00:00Z
updated: 2026-08-07T06:05:53.007Z
---

## Objective

T-009에서 BCOS가 실제 Codex를 처음 돌렸다. 그런데 사람은 여전히 **네 개의 명령을
순서대로 기억해서 입력했다.**

```
node dist/cli.js task start T-009 --actor-role worker --actor-id codex-cli
node dist/cli.js task run T-009 --worker codex
npm test
node dist/cli.js task submit T-009 --actor-role worker --actor-id codex-cli
```

T-010은 이것을 하나로 묶는다.

```
node dist/cli.js task execute T-010 --worker codex --actor-id codex-cli
```

**이 Task가 제거하는 수동 단계는 셋이다** — 명령 순서를 기억하는 일, 검증을 손으로
실행하는 일, 검증 결과를 보고 제출을 판단하는 일.

**Orchestrator는 Reviewer가 아니다.** Review를 실행하지 않고, `approve`하지 않고,
재작업 루프를 만들지 않는다. `IMPLEMENTED`까지만 간다. 그다음은 T-011이다.

### T-009가 남긴 두 가지 사실

**하나 — worker 안에서는 프로세스를 띄울 수 없다.** T-009의 worker가 자기 샌드박스
안에서 `npm test`를 실행하려다 `spawn EPERM`(errno -4048)으로 실패했다. 실행 구조가
`Codex → BCOS → Codex → npm test`가 되면 안 된다. **`Host Shell → BCOS → Codex`여야 한다.**

**둘 — 검증은 host에서 해야 의미가 있다.** worker의 자기보고는 통과했지만 host에서
돌리자 99개 중 3개가 실패했다. **검증을 실행하는 주체가 worker가 아니어야 한다.**

## Scope

`src/workflow.ts`를 새로 만들고 `src/cli.ts`에서 라우팅한다.

- [ ] `task execute <id> --worker codex --actor-id <id> [옵션]` 파싱
- [ ] **환경 검증** — 자식 프로세스를 만들 수 있는지 실제로 시험한다
- [ ] **중첩 worker 거부** — BCOS가 띄운 worker 안이면 실패한다
- [ ] Task 상태를 보고 시작 지점을 정한다
- [ ] `TODO`면 `task start` 수행
- [ ] `task run` 수행
- [ ] worker 종료 코드 확인
- [ ] Report 존재 확인
- [ ] **host 검증 명령 실행**
- [ ] 검증이 통과했을 때만 `task submit` 수행
- [ ] 실행 요약과 Telemetry 출력

### 환경 검증 — 추측하지 않고 실제로 시험한다

Codex 패키지를 정적 조사한 결과 `CODEX_MANAGED_BY_NPM` · `CODEX_MANAGED_BY_PNPM` ·
`CODEX_MANAGED_BY_BUN` · `CODEX_MANAGED_PACKAGE_ROOT` 네 개만 나왔다. **전부 설치
방식을 나타내는 값이고 "지금 Codex 세션 안이다"를 뜻하지 않는다.** 다른 안정적인
runtime marker는 없었다.

`process.stdin.isTTY`도 신호가 되지 못한다 — 파이프로 넘긴 정상 실행과 구분되지 않는다.
부모 프로세스 이름 조회는 Windows에서 셸이 필요해 금지 대상이다.

**그래서 환경을 추측하지 않고 필요한 능력을 직접 시험한다.**

```
spawnSync(process.execPath, ["-e", ""], { shell: false, stdio: "ignore" })
```

실패하면(`error.code`가 `EPERM` 등) workflow를 시작하지 않고 종료한다.
**약 81 ms가 든다.** 어느 샌드박스인지 알 필요 없이 막힌 사실만 확인한다.

### 중첩 worker 거부 — BCOS가 자기 자식을 표시한다

`task run`이 worker를 띄울 때 환경 변수 하나를 넣는다.

```
BCOS_WORKER_SESSION=1
```

`task execute`는 이 값이 있으면 거부한다.

```
Workflow execution is not allowed inside a BCOS worker session.
Run this command from the host shell.
```

**BCOS가 만든 worker만 정확히 잡는다.** 사람이 직접 연 Codex 세션 안에서 실행하는
경우는 잡지 못한다 — 그 경우는 환경 검증이 막는다.

Runner는 지금 `env` 옵션 없이 spawn하므로 부모 환경을 그대로 물려준다.
`env: { ...process.env, BCOS_WORKER_SESSION: "1" }` 한 줄이 전부다.

### host 검증 — `package.json`의 `test` 스크립트

Task 산문을 파싱하지 않는다. 설정 파일도 만들지 않는다.
**`package.json`의 `scripts.test`를 읽어 실행한다.** 없으면 실패한다.

Windows에서 `npm`은 `.cmd` shim이라 `shell:false`로 실행할 수 없다. T-008이 Codex에
쓴 방법을 그대로 쓴다 — `process.env.PATH`에서 `node_modules/npm/bin/npm-cli.js`를
찾아 `process.execPath`로 실행한다.

```
spawn(process.execPath, [<npm-cli.js>, "test"], { shell: false, cwd: <repo root> })
```

`--verify-command <path>` 로 덮어쓸 수 있다. **테스트는 이 옵션으로 가짜 검증기를
가리킨다.** 셸을 켜지 않고 `PATH`는 문자열 분할과 `existsSync`로만 다룬다.

**실행에는 실제 경로를 쓰되 출력에는 남기지 않는다.** `telemetry verification_command`
는 논리 값만 낸다 — `scripts.test` 를 쓰면 `npm-test`, `--verify-command` 를 쓰면
`custom-verifier`. **npm 설치 절대경로나 사용자 홈 경로를 Git이 추적하는 문서와
Telemetry 출력에 남기지 않는다.** 이 저장소는 공개된다.

같은 이유로 `command` · `args` 를 그대로 출력하지 않는다. 그 값들은 사용자 홈 아래
경로를 담는다.

### 시작 지점과 재개

| Task 상태 | 동작 |
|---|---|
| `TODO` | `start` → `run` → 검증 → `submit` |
| `IN_PROGRESS` | **`start`를 건너뛰고** `run` → 검증 → `submit` |
| 그 밖 | exit 1 |

`--verify-only` 를 주면 `start`와 `run`을 건너뛰고 **검증과 `submit`만** 수행한다.
T-009에서 실제로 필요했던 경우다 — 검증만 실패해 사람이 테스트를 고친 뒤 6분짜리
worker를 다시 돌릴 이유가 없다.

`--verify-only`는 `IN_PROGRESS`에서만 허용하고 Report가 없으면 거부한다.

### 실패 분류 — 기계적으로 확실한 것만

| `workflow_exit_reason` | 판정 근거 |
|---|---|
| `success` | 검증 exit 0 이후 `submit` 성공 |
| `nested_worker` | `BCOS_WORKER_SESSION` 존재 |
| `permission` | spawn 오류 `code === "EPERM"` |
| `environment` | 환경 검증 실패 또는 spawn 오류 `EPERM` 아님 |
| `protocol` | 상태·Context·Report·옵션 검사 실패 (worker 실행 전) |
| `worker_nonzero` | worker exit code ≠ 0, timeout 아님 |
| `timeout` | Runner가 timeout으로 종료 |
| `verification` | 검증 명령 exit code ≠ 0 |
| `unknown` | 위 어디에도 해당하지 않음 |

**전부 exit code와 error code로만 정한다.** 출력 문자열을 해석하지 않는다.

**Environment/Permission 실패와 Verification 실패를 같은 것으로 집계하지 않는다.**
T-009에서 전자는 `spawn EPERM`, 후자는 99개 중 3개 실패였다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **Reviewer 자동 실행 · Claude Code 호출 · Review 파싱 · verdict 해석**
- **`task approve` 자동 실행 · `CHANGES_REQUESTED` 처리 · rework 루프 · feedback 전달**
- commit · push · git 명령
- Model Adapter · 두 번째 worker · multi-model switching
- benchmark 비교 · token/cost 수집
- **Transaction engine · rollback framework** — workflow는 atomic하지 않다
- **`WorkflowEngine` class · StateMachine · Pipeline framework · Step registry ·
  Event bus · Job scheduler · retry framework · plugin · provider · DI container**
- **Task 산문 파싱** — Test Requirements에서 명령을 뽑지 않는다
- **범용 test command 탐색** — `scripts.test` 하나만 본다
- **LLM 기반 오류 분류 · 정규식 taxonomy 엔진** — exit code로만 분류한다
- **Report 내용 해석** — 존재만 확인한다 (T-009 Review F-2는 T-011)
- 상태 전이 로직 복제 — 기존 `start`/`submit` 구현을 재사용한다
- 새 lifecycle 이벤트 · RFC-001 수정
- background daemon · queue · worktree · 병렬 worker
- **셸 실행** — `shell: true`, `cmd /c`, 셸 문자열 조립
- 새 파일 — `src/workflow.ts` **하나만**
- **`src/context.ts` 수정**
- **runtime dependency 추가** · `package-lock.json` 생성
- **기존 `task start` / `submit` / `approve` / `context` / `run` 동작 변경** —
  `run`은 자식 환경 변수 추가만 예외다
- 이 저장소의 실제 `.bcos/` 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- **테스트에서 실제 Codex 호출 · 실제 `npm test` 호출** — 가짜 fixture를 쓴다
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- **`docs/benchmarks/TELEMETRY.md` 의 기존 84개 필드 수정·삭제·개명** —
  새 필드 11개 추가만 허용한다
- **TELEMETRY.md의 다른 절 수정** — 공정성 6문제·공개 지표·human 한계·절대 규칙은
  그대로 둔다
- `.bcos/prompts/` 에 파일 추가 — **T-009가 없앴다**

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. `task execute <id> --worker codex --actor-id <id>` 가 라우팅된다.
3. `--worker` 가 없으면 exit 1이다.
4. `--actor-id` 가 없으면 exit 1이다.
5. `--worker` 가 `codex` 가 아니면 exit 1이다.
6. 알 수 없는 옵션이면 exit 1이다.
7. `--help` 에 `execute` 가 나온다.

**환경 검증**

8. 자식 프로세스를 만들 수 있으면 workflow가 진행된다.
9. 자식 프로세스 생성이 막히면 exit 1이고 `workflow_exit_reason=environment` 또는
   `permission` 이다.
10. 환경 검증 실패 시 Task·`events.jsonl`·`state.json`이 변하지 않는다.
11. 환경 검증 실패 시 worker가 실행되지 않는다.

**중첩 worker 거부**

12. `BCOS_WORKER_SESSION=1` 이면 exit 1이다.
13. 그 메시지가 host shell에서 실행하라고 말한다.
14. `workflow_exit_reason=nested_worker` 다.
15. 거부 시 Task·`events.jsonl`·`state.json` 변경이 **0건**이다.
16. 거부 시 worker가 실행되지 않는다.
17. **`task run` 이 자식에게 `BCOS_WORKER_SESSION=1` 을 전달한다** — 자식이 값을 출력해 확인한다.
18. `task run` 의 그 밖 동작은 변하지 않는다 — stdin 해시가 T-009와 동일하다.

**정상 흐름**

19. `TODO` Task에서 `start` → `run` → 검증 → `submit` 이 순서대로 수행된다.
20. 최종 상태가 `IMPLEMENTED` 다.
21. `TASK_STARTED` 가 정확히 1건이다.
22. `TASK_SUBMITTED` 가 정확히 1건이다.
23. `TASK_APPROVED` 가 **0건**이다.
24. `attempt` 가 1이다.
25. 두 이벤트의 `actor_id` 가 `--actor-id` 값과 같다.
26. `workflow_exit_reason=success` 다.

**worker 실패**

27. worker exit code가 0이 아니면 `submit` 을 하지 않는다.
28. 그때 Task가 `IN_PROGRESS` 로 남는다.
29. `workflow_exit_reason=worker_nonzero` 다.
30. `TASK_SUBMITTED` 가 0건이다.
31. worker timeout이면 `submit` 하지 않고 `workflow_exit_reason=timeout` 이다.
32. worker 실패 후에도 `TASK_STARTED` 는 1건 그대로다.

**Report 확인**

33. Report가 없으면 검증을 실행하지 않고 exit 1이다.
34. 그때 `workflow_exit_reason=protocol` 이고 `submit` 하지 않는다.

**host 검증**

35. `package.json` 의 `scripts.test` 를 읽어 실행한다.
36. `scripts.test` 가 없으면 exit 1이고 `workflow_exit_reason=protocol` 이다.
37. `--verify-command <path>` 가 그것을 덮어쓴다.
38. `--verify-command` 가 가리키는 파일이 없으면 exit 1이다.
39. 검증 명령의 stdout·stderr가 부모로 전달된다.
40. 검증 명령의 cwd가 저장소 루트다.
41. **검증 exit code가 0이 아니면 `submit` 하지 않는다.**
42. 그때 Task가 `IN_PROGRESS` 로 남고 `TASK_SUBMITTED` 가 0건이다.
43. 그때 Report 파일이 그대로 남는다.
44. `workflow_exit_reason=verification` 이다.
45. 검증 exit code가 0이면 `submit` 한다.

**재개**

46. `IN_PROGRESS` Task에서 실행하면 `start` 를 건너뛴다 — `TASK_STARTED` 가 늘지 않는다.
47. `TODO` 도 `IN_PROGRESS` 도 아니면 exit 1이다.
48. `--verify-only` 는 `start` 와 `run` 을 건너뛰고 검증부터 한다.
49. `--verify-only` 는 `IN_PROGRESS` 가 아니면 exit 1이다.
50. `--verify-only` 는 Report가 없으면 exit 1이다.
51. `--verify-only` 로 검증이 통과하면 `submit` 하고 `TASK_STARTED` 가 늘지 않는다.

**Telemetry**

52. `telemetry workflow_exit_reason=<값>` 이 모든 경로에서 출력된다.
53. `workflow_started_at` · `workflow_completed_at` 이 RFC 3339로 출력된다.
54. `workflow_duration_ms` 가 숫자로 출력된다.
55. `nested_worker_detected` 가 `true` 또는 `false` 로 출력된다.
56. `verification_exit_code` 와 `verification_duration_ms` 가 검증을 실행한 경우에만 나온다.
57. **검증을 실행하지 않은 경로에서는 그 두 필드가 나오지 않는다** — 0으로 채우지 않는다.
58. `verification_runs` 가 실제 검증 실행 횟수와 같다 (0 또는 1).
59. `lifecycle_transitions_caused` 가 실제 전이 수와 같다 — 정상 흐름에서 2, 검증 실패에서 1.
60. `runner_invocations` 가 worker 실행 횟수와 같다.
61. **`verification_command` 가 논리 값이다** — `npm-test` 또는 `custom-verifier`.
62. **Telemetry 출력 어디에도 사용자 홈 경로가 없다** — `verification_command` 를 포함해
    출력 전체에 절대경로가 나타나지 않는다.
63. **Telemetry가 어떤 파일에도 기록되지 않는다.**
64. **비율 계산 키가 없다** — `_rate` · `_ratio` · `efficiency` · `improvement` ·
    `savings` · `reduction` 문자열이 소스에 없다.

**TELEMETRY.md 갱신**

65. `docs/benchmarks/TELEMETRY.md` 에 위 11개 키가 추가돼 있다.
66. 각 키에 단위·출처·가용성이 적혀 있고 가용성 표기가 기존 다섯 값 중 하나다.
67. `verification_command` 의 정의가 **논리 값이며 경로가 아님**을 명시한다.
68. **추가된 내용에 비율 계산 키가 없다** — `*_rate` · `*_ratio` · `efficiency` ·
    `improvement` · `savings` · `reduction` 을 필드로 정의하지 않는다.
69. **없는 값을 0으로 채우지 않는다**는 기존 규칙이 새 필드에도 적용된다고 적혀 있다.
70. `workflow_resume_count` 가 **`blocked`** 로 표시되고 그 사유가 적혀 있다.
71. 기존 84개 필드가 하나도 삭제·개명되지 않았다.
72. TELEMETRY.md의 다른 절(공정성 6문제·공개 지표·human 한계)이 수정되지 않았다.

**회귀**

73. `task start` 정상 1건 + 실패 1건.
74. `task submit` 정상 1건 + 실패 1건 (G3).
75. `task approve` 정상 1건 + 실패 1건 (G5 SoD).
76. `task context` 정상 1건 + 실패 1건.
77. `task run` 정상 1건 + 실패 1건.
78. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.

**품질**

79. `npm test` 가 통과하며 **125개 이상**의 테스트가 pass한다.
80. `package.json` 에 `dependencies` 키가 없고 `devDependencies` 가 기존 2개 그대로다.
81. `src/` 에 `cli.ts` · `context.ts` · `runner.ts` · `workflow.ts` **네 파일만** 존재하고
    하위 디렉터리가 없다.
82. `src/workflow.ts` 가 **200줄을 넘지 않는다.**
83. `src/workflow.ts` 에 class가 없다 — 함수만 export한다.
84. **테스트가 실제 Codex와 실제 `npm test` 를 한 번도 호출하지 않는다.**
85. 소스에 `shell: true`, `cmd /c`, 셸 문자열 조립이 없다.
86. **상태 전이 로직이 복제되지 않았다** — `workflow.ts` 가 `events.jsonl` 이나
    `state.json` 에 직접 쓰지 않는다.
87. `git status` 기준 변경 파일이 `src/cli.ts`, `src/runner.ts`, `src/workflow.ts`,
    `tests/cli.test.ts`, `docs/benchmarks/TELEMETRY.md`, Report **6개뿐**이다.
    `package-lock.json` 이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**생성**

- `src/workflow.ts`

**수정**

- `src/cli.ts` — 라우팅과 옵션 파싱
- `src/runner.ts` — 자식 환경 변수 추가 **한 곳만**
- `tests/cli.test.ts`
- `docs/benchmarks/TELEMETRY.md` — **새 필드 11개 추가만.** 기존 84개와 다른 절은 그대로 둔다

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-010-workflow-orchestrator-poc.md` (이 파일)
- `docs/benchmarks/TELEMETRY.md` (Telemetry 계약 — 읽고 **추가**한다)
- `src/cli.ts`
- `src/runner.ts`
- `src/context.ts`
- `tests/cli.test.ts`
- `package.json`

**쓰기**

- `.bcos/reports/T-010-workflow-orchestrator-poc.md`

**실행 프롬프트 파일이 없다.** T-009가 hand-written prompt 의존을 없앴으므로
**이 Task는 Task 문서와 `AGENTS.md`만으로 실행되는 첫 사례다.**
`.bcos/prompts/` 에 파일을 만들지 않는다.

**Codex CLI와 npm 진입점은 이미 조사됐다.** 위 Scope의 경로 탐색 방식이 실측 결과다.
`codex --help` 나 `npm --help` 를 실행하지 않는다.

**TELEMETRY.md는 세 arm 공통 Measurement Contract다.** T-009가 그렇게 정의했으므로
Runner가 실제로 내는 키는 반드시 여기에 정의돼 있어야 한다. **정의 없는 키를 출력하면
계약이 깨진다.** 그래서 이 Task는 TELEMETRY.md를 읽기만 하지 않고 **추가**한다.

추가는 새 절 하나로 끝낸다. **기존 필드를 건드리지 않고, 계산 필드를 만들지 않고,
없는 값을 0으로 채우지 않는다는 규칙을 새 필드에도 적용한다.**

`src/workflow.ts` 는 **오케스트레이션만** 한다. 상태 전이는 `src/cli.ts` 의 기존
구현을 재사용하고, worker 실행은 `src/runner.ts` 의 `runCodexWorker()` 를 호출한다.
**전이 로직을 다시 쓰지 않는다.**

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**실제 Codex와 실제 `npm test` 를 절대 호출하지 않는다.** 임시 디렉터리에 가짜 worker
`.js` 와 가짜 검증기 `.js` 를 만들고 `--worker-command` · `--verify-command` 로 가리킨다.

가짜 worker가 할 수 있어야 하는 것 — Report 파일 쓰기, 지정한 exit code로 종료,
지정한 시간 대기, `BCOS_WORKER_SESSION` 값 출력.
가짜 검증기가 할 수 있어야 하는 것 — stdout·stderr 출력, 지정한 exit code로 종료.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 fixture를 만들고
`spawnSync` 의 `cwd` 옵션으로 CLI를 실행한다. **이 저장소의 실제 `.bcos/` 나 실제
소스를 읽거나 쓰는 테스트는 금지한다.**

| # | 대상 | 기대 |
|---|---|---|
| 1–99 | 기존 테스트 99개 | 전부 그대로 통과 |
| 100 | 정상 흐름 | `TODO` → `IMPLEMENTED`, 전이 2건, approve 0건 |
| 101 | 정상 흐름 | `actor_id` 가 두 이벤트에 기록됨 |
| 102 | 중첩 거부 | `BCOS_WORKER_SESSION=1` → exit 1, lifecycle 변경 0, worker 미실행 |
| 103 | 중첩 거부 | 메시지가 host shell 실행을 안내 |
| 104 | 환경 검증 | 자식 생성 불가 시 exit 1, 변경 0 |
| 105 | worker 환경 변수 | 자식이 `BCOS_WORKER_SESSION=1` 을 받는다 |
| 106 | `task run` 회귀 | stdin 해시가 T-009와 동일 |
| 107 | worker 실패 | exit ≠ 0 → submit 0건, `IN_PROGRESS` 유지 |
| 108 | worker timeout | submit 0건, `workflow_exit_reason=timeout` |
| 109 | Report 없음 | 검증 미실행, exit 1, `protocol` |
| 110 | 검증 실패 | exit ≠ 0 → submit 0건, `IN_PROGRESS` 유지, Report 보존 |
| 111 | 검증 성공 | submit 수행, `IMPLEMENTED` |
| 112 | 검증 명령 결정 | `scripts.test` 사용, 없으면 exit 1 |
| 113 | 검증 출력 | stdout·stderr 전달, cwd가 fixture 루트 |
| 114 | 재개 | `IN_PROGRESS` 에서 `TASK_STARTED` 가 늘지 않음 |
| 115 | 재개 | `TODO`·`IN_PROGRESS` 외 상태는 exit 1 |
| 116 | `--verify-only` | start·run 건너뜀, 검증 통과 시 submit |
| 117 | `--verify-only` | `IN_PROGRESS` 아니거나 Report 없으면 exit 1 |
| 118 | 옵션 검증 | `--worker` · `--actor-id` 누락, 잘못된 worker, 알 수 없는 옵션 |
| 119 | Telemetry | 모든 경로에서 `workflow_exit_reason` 출력 |
| 120 | Telemetry | `lifecycle_transitions_caused` 가 실제 전이 수와 일치 |
| 121 | Telemetry | 파일 기록 0건, 비율 키 0건 |
| 122 | 모든 실패 경로 | fixture `.bcos/` 해시가 실행 전후 동일 |
| 123 | Lifecycle 회귀 | `start`·`submit`·`approve`·`context`·`run` 정상·실패 각 1건 |
| 124 | 환경 검증 실패 | **`runner_invocations=0`** — worker가 실행되지 않았음을 직접 확인 |
| 125 | `--verify-only` 성공 | **`runner_invocations=0`** — worker를 건너뛰었음을 직접 확인 |
| 126 | Telemetry 개인정보 | 출력 전체에 절대경로 없음, `verification_command` 가 논리 값 |
| 127 | TELEMETRY.md | 새 키 11개 존재, 기존 84개 보존, 계산 키 0건 |

**신규 28개, 총 127개를 목표로 한다.** AC는 **125개 이상 pass / 0 fail**을 요구하므로
목표가 요구를 넘는다. 숫자를 채우려고 테스트를 쪼개지 않는다.

**124·125가 왜 따로 필요한가** — 기존 104번은 "exit 1, 변경 0"만 보고 106·116번은
`submit` 결과만 본다. **worker가 실제로 돌지 않았다는 것**은 어느 쪽도 증명하지 않는다.
`runner_invocations=0` 이 그 증거이고, 이 값이 틀리면 T-010의 두 절약(환경 검증으로
헛돈 안 쓰기, `--verify-only`로 6분 안 쓰기)이 전부 거짓이 된다.

**126은 이번에 새로 생긴 위험**이다. 검증 명령은 사용자 홈 아래 npm 경로를 담는데
그것이 공개 저장소의 Telemetry 출력에 새어 나가면 안 된다.

**127은 계약 검증**이다. Runner가 내는 키가 TELEMETRY.md에 없으면 세 arm 비교의
전제가 깨진다.

**증거:** Report의 `Test Evidence` 에 `npm run build` 와 `npm test` 의 출력 전문,
정상 흐름 요약 전문, 중첩 거부 메시지, 검증 실패 시 상태, `telemetry` 줄 전문,
lifecycle 회귀 결과를 붙여넣는다. "통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join` 을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used` 에 읽은 파일 수, Read List 밖에서 읽은 파일,
완료 후 `src/workflow.ts` 줄 수와 `src/cli.ts` · `src/runner.ts` 증감을 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·환경 변수 값을 Report에 남기지 않는다.

## Benchmark Telemetry

필드 정의는 [docs/benchmarks/TELEMETRY.md](../../docs/benchmarks/TELEMETRY.md)에 있다.
**이번 Task는 그 문서에 11개 키를 추가한다** — Runner가 내는 키가 계약에 없으면
세 arm 비교의 전제가 깨지기 때문이다. 84 → 95가 된다.

**이번에 추가되는 필드**

| key | 왜 지금 가능한가 |
|---|---|
| `workflow_started_at` · `workflow_completed_at` | Orchestrator가 자기 시작·종료 시각을 안다 |
| `workflow_duration_ms` | 위 둘의 차 |
| `workflow_exit_reason` | exit code와 error code로만 정한다 |
| `nested_worker_detected` | 환경 변수 존재 여부 |
| `verification_command` | **논리 값** — `npm-test` 또는 `custom-verifier`. 경로가 아니다 |
| `verification_exit_code` · `verification_duration_ms` | 검증 프로세스에서 직접 관측 |
| `verification_runs` | 이번 실행에서 검증을 몇 번 돌렸는지 (PoC에서는 0 또는 1) |
| `runner_invocations` | worker를 몇 번 띄웠는지 (PoC에서는 0 또는 1) |
| `lifecycle_transitions_caused` | Orchestrator가 일으킨 전이 수 |

**`lifecycle_transitions_caused` 는 `runner_transitions_caused` 와 다르다.**
Runner는 여전히 0이어야 하고, 전이를 일으키는 것은 Orchestrator다.

**이번에도 불가능한 것**

| key | 왜 |
|---|---|
| `workflow_resume_count` | 실행 간 상태를 저장해야 안다. 이번 실행이 재개인지만 알 수 있고 **누적은 모른다**. TELEMETRY.md에 `blocked` 로 적는다 |
| `handoff_count` · `worker_switch_count` | 사람이 적는다. 도구가 관측할 수 없다 |
| token · cost 전체 | worker 출력을 해석해야 한다 — T-012 |
| `rework_count` | `request-changes` 전이가 없다 |

**Human step baseline (T-009 실측)**

| | T-009 | T-010 목표 |
|---|---:|---:|
| `human_command_count` | **4** | **1** |
| 명령 | `start` · `run` · `npm test` · `submit` | `task execute` |

**T-009 실제 Codex 실행 baseline** — runtime 약 359초 · Context files 8 ·
Context chars 99,522 · stdin chars 105,551 · stdin lines 3,013 · stdout 663 bytes ·
stderr 750,989 bytes · worker 내부 테스트 `spawn EPERM` · host 검증 첫 결과 96/99 ·
최종 99/99.

**개선율을 계산하지 않는다.** 단계 수와 관측값만 남긴다.

## Notes — 이번 Task가 해결하지 않는 것

**workflow는 atomic하지 않다.** `start` 가 성공한 뒤 worker가 실패하면 Task는 이미
`IN_PROGRESS` 다. 이것을 되돌리는 rollback을 만들지 않는다. 대신 각 단계가 끝난
상태를 정확히 남기고 `workflow_exit_reason` 으로 어디서 멈췄는지 밝힌다.

**T-009 Review F-2는 이번에 다루지 않는다.** Report가 스스로 완료를 주장하지 않아도
`submit` 이 통과하는 문제는 남는다. 이번에는 **host 검증을 gate로 쓴다** — Report의
주장 대신 실제 실행 결과가 제출을 막는다. Report 의미 검증은 T-011이며,
RFC-001 §3 변경이 필요할 수 있다. **이 Task에서 RFC를 수정하지 않는다.**

**사람이 직접 연 Codex 세션 안에서 `task execute` 를 실행하는 경우**는 환경 변수
표지로 잡히지 않는다. 그 경우 환경 검증이 막을 가능성이 높지만 보장하지 않는다.
**보장하지 못한다는 사실을 숨기지 않는다.**
