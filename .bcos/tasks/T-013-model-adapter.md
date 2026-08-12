---
protocol: "0.1"
id: T-013
title: Move process execution behind one boundary so worker and reviewer runtimes are selectable
status: DONE
attempt: 2
created: 2026-08-11T04:12:00Z
updated: 2026-08-12T00:27:01.738Z
---

# T-013 — Model Adapter

## Objective

**모델 CLI를 실행하는 방법**과 **BCOS가 그 실행으로 무엇을 하는가**를 분리한다.

지금 BCOS는 프로세스를 두 곳에서 서로 다르게 띄운다. `src/runner.ts`는 Codex를,
`src/reviewer.ts`는 Claude를 띄운다. 두 곳 모두 executable을 찾고, argv를 만들고,
`spawn`하고, stdin을 밀어넣고, 타임아웃을 걸고, 종료 코드를 해석한다.
**같은 일을 두 번 구현했고, 그 두 구현의 관측 능력이 서로 다르다.**

T-013은 그 실행 메커니즘 하나를 `src/model.ts`로 옮긴다.
Adapter는 **프로세스를 어떻게 띄우는가만** 안다.
Task 상태 · Review verdict · Report · lifecycle 전이 · Context Package는 **모른다**.

**이 Task의 목표는 multi-model 전략이 아니다.** 경계를 만드는 것이다.
Worker를 실제로 Claude로 바꾸는 기능은 T-015다.

## Scope

### 1. 현재 중복 — 실측 (설계 단계 조사 결과)

실행 메커니즘에 쓰인 비어 있지 않은 줄:

| 위치 | 줄 |
|---|---:|
| `src/runner.ts` `findWorkerCommand` (43–61) | 18 |
| `src/runner.ts` spawn Promise (188–251) | 63 |
| `src/reviewer.ts` `reviewerCommand` (12–25) | 14 |
| `src/reviewer.ts` spawn Promise (87–101) | 15 |
| **합계** | **110** |

**9개 관심사를 3분류로 나눈 결과 — 겉보기 유사와 실제 중복을 구분한다.**

| 관심사 | runner | reviewer | 판정 |
|---|---|---|---|
| executable resolution | PATH 순회 + override resolve/exists/throw | 동일 형태 | **실제 중복** (탐색 대상만 다름) |
| spawn 호출 | `spawn(cmd,args,{cwd,shell:false,stdio:pipe×3})` | 동일 | **실제 중복** |
| stdin 전달 | `stdin.on("error")` + `stdin.end(s,"utf8")` | 동일 | **실제 중복** |
| timeout | `setTimeout` → `kill()` | 동일 | **실제 중복** |
| duration | `Date.now()` 차 | 동일 | **실제 중복** |
| exit 확정 | `settled` 가드 + `clearTimeout` + `close`/`error` | 동일 | **실제 중복** |
| stdout/stderr 처리 | `on("data")` — 바이트 계수 + 전달 | `pipe()` — **계수 없음** | **중복 아님 — 능력 격차** |
| first response | 측정함 | **측정 안 함** | **중복 아님 — 능력 격차** |
| environment | `BCOS_WORKER_SESSION=1` | **스탬프 없음** | **중복 아님 — 역할 차이** |

실측 근거: `grep -c stdoutBytes src/reviewer.ts` = 0 ·
`grep -c firstResponse src/reviewer.ts` = 0 ·
`grep -c BCOS_WORKER_SESSION src/reviewer.ts` = 0 ·
`grep -c verdict src/runner.ts` = 0.

**실제 중복 6건 · 능력 격차 2건 · 역할 차이 1건.**

능력 격차는 통합하면 **저절로 메워진다** — reviewer가 stdout/stderr 바이트와
first response를 갖게 된다. 이것은 부작용이 아니라 T-013이 만드는 값이다.

역할 차이는 **유지한다.** `env`는 Adapter 입력이고 호출자가 정한다.

### 2. 왜 dedup만으로는 부족한가 — 두 번째 근거

Adapter가 필요한 이유는 중복 110줄만이 아니다.
**runtime마다 다른 방식으로만 얻을 수 있는 값이 이미 존재한다.**

| | Codex | Claude |
|---|---|---|
| entry | `node_modules/@openai/codex/bin/codex.js` — **JS** | `claude.exe` — **네이티브** |
| 실행 | 반드시 `process.execPath` 경유 | 직접 실행 |
| cwd 전달 | `--cd <dir>` 플래그 **있음** | 플래그 **없음** — spawn `cwd` 상속 |
| non-interactive | `exec` 서브커맨드 | `-p` 플래그 |
| stdin | `exec -` (`-`가 stdin 지시) | `-p` + 파이프 (인자 없음) |
| version 취득 | `package.json` 읽기 — **spawn 0회** | `--version` **spawn 필요** |

**같은 질문("이 실행기의 버전은?")에 대한 답이 한쪽은 파일 읽기, 한쪽은 프로세스 실행이다.**
이 비대칭을 호출자가 알아야 한다면 경계가 없는 것이다. Adapter가 흡수한다.

### 3. 구조 선택 — B (`src/model.ts` 1개)

| 후보 | 판정 |
|---|---|
| A. runner/reviewer 안에서 공통 함수만 추출 | **기각.** 중복은 줄지만 경계가 없다. 두 파일이 계속 spawn을 소유하고, T-015가 다시 두 곳을 고쳐야 한다 |
| **B. `src/model.ts` 1개** | **채택.** 실행 메커니즘 1곳. 새 source file 1개 제한 충족 |
| C. `src/adapters/` 폴더 | **기각.** runtime 2개에 디렉터리. 파일당 40줄 미만이 된다 |
| D. class 기반 interface | **기각.** 상태 없는 함수 2개에 계층. 기존 신규 파일 class 0개 원칙 위반 |
| E. registry / plugin | **기각.** 닫힌 집합 2개에 동적 등록. Out of Scope 명시 항목 |

### 4. `src/model.ts` 계약

**입력**

| 필드 | 뜻 |
|---|---|
| `runtime` | `"codex"` \| `"claude"` |
| `cwd` | 작업 디렉터리 |
| `stdin` | 프로세스에 밀어넣을 문자열 |
| `timeoutSeconds` | 양의 정수 |
| `env` | 추가 환경변수 (선택). 호출자가 정한다 |
| `commandOverride` | 테스트/대체 실행 파일 경로 (선택) |
| `onTimeout` | 타임아웃 시 호출자 콜백 (선택) |

**출력**

| 필드 | 뜻 |
|---|---|
| `exitCode` | 정수 |
| `durationMs` | 정수 |
| `stdoutBytes` / `stderrBytes` | 정수 |
| `firstResponseMs` | 정수 (출력이 없었으면 부재) |
| `timedOut` | boolean |
| `error` | `"not_found"` \| `"spawn_failed"` \| 부재 |
| `errorCode` | OS 오류 코드 (`EPERM` 등). 있을 때만 |
| `runtime` | 입력 그대로 |
| `runtimeKind` | `"node"` \| `"native"` — 어떻게 띄웠는가 |
| `version` | 아래 §5 |

**Adapter가 하지 않는 것 (AC로 강제)**

- Task 상태 · attempt · lifecycle 전이를 읽거나 쓰지 않는다
- Review verdict를 해석하지 않는다
- Report를 읽거나 쓰지 않는다
- Context Package를 만들지 않는다
- `.bcos/` 아래 어떤 파일도 읽거나 쓰지 않는다
- telemetry 키를 출력하지 않는다 — 값만 반환한다
- run artifact를 쓰지 않는다

### 5. version 취득

| 경로 | 값 |
|---|---|
| Codex, override 없음 | `@openai/codex/package.json`의 `version` (예: `0.146.0`). **spawn 0회** |
| Claude, override 없음 | `claude --version` stdout의 선행 semver (예: `2.1.220`). spawn 1회, 모델 호출 아님 |
| `--worker-command` / `--reviewer-command` 지정 | **`override`** — 실제 runtime이 아니므로 버전을 주장하지 않는다 |
| 취득 실패 (파일 없음 · 스폰 거부 · 파싱 실패) | **`unknown`** |

**version 취득은 절대 실행을 막지 않는다.** 실패는 `unknown`이지 오류가 아니다.
`override`를 지정한 실행에서는 version 프로브를 **아예 시도하지 않는다** —
fixture를 `--version`으로 띄우는 일이 없어야 한다.

### 6. role · runtime · version · actor_id 분리

**네 개는 다른 축이다. 코드에서 서로 대입하지 않는다.**

| 축 | 값 | 소유자 |
|---|---|---|
| `role` | `worker` \| `reviewer` | **Workflow가 정한다** |
| `runtime` | `codex` \| `claude` | Adapter가 실행한다 |
| `version` | 실제 CLI 버전 | Adapter가 관측한다 |
| `actor_id` | `codex-cli` \| `claude-code` | **lifecycle SoD identity.** RFC-001 G5 |

`actor_id`는 모델 이름이 **아니다.** `--actor-id`에 무엇이 오든 Adapter는 모른다.

**T-013에서 실제 조합은 바뀌지 않는다.** worker=codex · reviewer=claude 그대로다.
구조적으로 반대 조합이 가능해지지만 **이번 Task는 그것을 열지 않는다** (T-015).
`--worker claude` 거부 · `--reviewer codex` 거부는 **현행 유지**한다.

### 7. CLI — 변경 없음

조사 결과 현행 옵션은 `src/cli.ts:375-376`에 있다.

```
--worker --actor-id --timeout --worker-command --verify-command
--verify-only --review --reviewer --reviewer-actor-id
--max-review-cycles --reviewer-command
```

**새 옵션을 추가하지 않는다.** `--worker codex` · `--reviewer claude`를 그대로 둔다.
이 값들이 이미 runtime 식별자이므로 용어 변경도 하지 않는다.
바뀌는 것은 내부 구현뿐이다. **CLI contract 변경 0건.**

### 8. Observability 연동

**Adapter는 run artifact를 쓰지 않는다.** Workflow가 관찰 데이터를 소유한다.

`RunRecord`에 다음 4개 선택 필드를 더한다. Workflow가 각 stage 이후 채운다.

| 필드 | 시점 |
|---|---|
| `worker_runtime` · `worker_version` | worker stage 종료 후 |
| `reviewer_runtime` · `reviewer_version` | review stage 종료 후 |

**telemetry에만 남기지 않는다.** stdout은 휘발한다 — T-012가 정확히 그 이유로 만들어졌다.
버전을 터미널에만 남기면 T-012가 고친 문제를 되풀이하는 것이다.

기존 `RunRecord` 필드와 stage 8종은 **변경하지 않는다.**

### 9. Token / Cost — 조사 결과와 판정

**조사는 실제 설치본을 읽기 전용으로 수행했다. 모델은 실행하지 않았다.**

바이너리 문자열 스캔 결과, 두 CLI 모두 machine-readable 사용량 필드를 **가지고 있다**.

| runtime | 확인된 필드 | 필요한 argv |
|---|---|---|
| Codex 0.146.0 | `input_tokens` · `cached_input_tokens` · `output_tokens` · `reasoning_output_tokens` · `total_token_usage` · `last_token_usage` | `codex exec --json` (JSONL) |
| Claude 2.1.220 | `input_tokens` · `output_tokens` · `cache_read_input_tokens` · `cache_creation_input_tokens` · `total_cost_usd` | `claude -p --output-format json` |

**그런데 BCOS의 현재 argv는 둘 다 그 형식을 요청하지 않는다.**
Codex는 평문, Claude는 `--output-format text`다.

**판정: token / cost 모두 T-013에서 `N/A`. 이유를 TELEMETRY.md에 기록한다.**

이유는 "불가능"이 아니라 **"argv를 바꿔야 하고, argv 변경은 worker 출력 형식 변경이다"**다.
출력 형식이 바뀌면 stdout 스트리밍 · 바이트 수 · 사람이 보는 화면이 전부 바뀐다.
그것은 실행 경계를 만드는 이번 Task의 목적과 다른 변경이다.

**추정값을 만들지 않는다.** `context_chars ÷ 4` 같은 값을 measured로 쓰지 않는다.
**pricing table을 코드에 넣지 않는다.**

### 10. TELEMETRY.md의 낡은 전방 참조 정정

현재 `docs/benchmarks/TELEMETRY.md` §4와 §10은 token/cost 필드의 가용성을
**`T-010`**으로 적고 있고, §4는 **"T-010 Model Adapter"**라고 쓰고 있다.

**T-010은 Workflow Orchestrator로 출하됐다. Model Adapter는 T-013이다.**
문서가 현실과 어긋난 상태다 — CLAUDE.md가 금지하는 조용한 이탈이다.

T-013은 이 두 절을 정정한다. **없는 능력을 있다고 쓰지 않는다** — §9 판정대로
`N/A` + `blocked` + 사유를 적는다.

## Out of Scope

**하지 않는다. 하나라도 하면 범위 이탈이다.**

- plugin system · dynamic plugin loading · provider discovery
- registry framework · DI framework
- Adapter class hierarchy · interface 상속
- config file system (모델 설정 파일)
- API client · cloud model API 직접 호출
- fallback routing · automatic model selection · load balancing
- **worker를 실제로 Claude로 바꾸는 기능** (T-015)
- **`--worker claude` / `--reviewer codex` 허용** — 현행 거부 유지
- parallel workers · worktree · queue · scheduler · daemon · retry engine
- benchmark 계산 · pricing engine · token estimation engine
- prompt framework · RAG · embeddings
- **Verification Failure Feedback (T-012 F-1)** — 별도 Task (§Roadmap)
- 새 CLI 옵션 추가
- `src/context.ts` 수정
- worker/reviewer에게 보내는 **stdin 내용 변경** (아래 참조)
- `codex exec --json` / `claude --output-format json` 도입
- RFC-001 개정
- `.bcos/prompts/` 아래 hand-written prompt 작성
- 새 런타임 의존성 추가
- `shell: true` · `cmd /c` · `--dangerously-skip-permissions` · sandbox 우회

**stdin 불변이 이번 Task의 안전장치다.** T-013은 리팩터링이다.
worker에게 가는 바이트가 1비트라도 달라지면 그것은 리팩터링이 아니다.

## Acceptance Criteria

### A. Adapter 경계 (1–12)

1. `src/model.ts`가 존재하고 **140줄 이하**다.
2. `src/model.ts`에 `class` 키워드가 없다.
3. `src/model.ts`가 `node:child_process` · `node:fs` · `node:path`만 쓴다. 새 의존성 0개.
4. `src/model.ts`가 `./context.js` · `./run.js` · `./workflow.js`를 import하지 않는다.
5. `src/model.ts`에 `.bcos` 문자열이 **0건**이다.
6. `src/model.ts`에 `attempt` · `verdict` · `APPROVED` · `CHANGES_REQUESTED` · `Report` · `lifecycle` 문자열이 **0건**이다.
7. `src/model.ts`에 `console.log("telemetry` 형태의 출력이 **0건**이다.
8. `src/model.ts`가 파일을 쓰지 않는다 — `writeFileSync` · `renameSync` · `mkdirSync` **0건**.
9. `src/runner.ts`에 `spawn(` 직접 호출이 **0건**이다.
10. `src/reviewer.ts`에 `spawn(` 직접 호출이 **0건**이다.
11. `src/runner.ts` · `src/reviewer.ts` 어디에도 `setTimeout(...kill` 형태의 자체 타임아웃이 없다.
12. `src/runner.ts` + `src/reviewer.ts` 합계 줄 수가 **356줄(현재 253+103)보다 작다.**

### B. Codex 실행 (13–20)

13. Codex 실행 argv가 `["<codex.js>", "exec", "-", "--cd", "<root>"]`로 **현행과 동일**하다.
14. Codex는 `process.execPath`로 띄운다 — `runtimeKind === "node"`.
15. `--worker-command` override가 있으면 그 경로를 쓰고, 없으면 PATH를 순회한다.
16. override 경로가 없으면 명확한 오류로 실패한다.
17. PATH에서 Codex를 못 찾으면 `error === "not_found"`다.
18. worker 실행 env에 `BCOS_WORKER_SESSION=1`이 **여전히 포함**된다.
19. worker의 `cwd`가 저장소 루트다.
20. Codex version이 override 없을 때 `@openai/codex/package.json`에서 온다 — **spawn 0회**.

### C. Claude 실행 (21–28)

21. Claude 실행 argv가 `["-p", "--output-format", "text"]`로 **현행과 동일**하다.
22. 네이티브 실행 파일은 직접 띄운다 — `runtimeKind === "native"`.
23. `.js` override는 `process.execPath` 경유로 띄운다 — `runtimeKind === "node"`.
24. PATH에서 Claude를 못 찾으면 `error === "not_found"`다.
25. reviewer의 `cwd`가 저장소 루트다 — Claude에 cwd 플래그가 없으므로 spawn `cwd`로 전달됨을 확인한다.
26. reviewer 실행 env에 `BCOS_WORKER_SESSION`이 **포함되지 않는다** (현행 유지).
27. Claude version이 override 없을 때 `--version` 프로브에서 온다.
28. reviewer가 stdin으로 프롬프트를 받는다 — argv에 프롬프트가 실리지 않는다.

### D. 공통 결과 형태 (29–40)

29. worker와 reviewer가 **같은 결과 타입**을 받는다.
30. `exitCode`가 정수다.
31. `durationMs`가 정수이고 0 이상이다.
32. `stdoutBytes`가 worker에서 관측된다.
33. **`stdoutBytes`가 reviewer에서도 관측된다** (신규 능력).
34. **`stderrBytes`가 reviewer에서도 관측된다** (신규 능력).
35. **`firstResponseMs`가 reviewer에서도 관측된다** (신규 능력).
36. 출력이 전혀 없으면 `firstResponseMs`가 **부재**다 — 0으로 채우지 않는다.
37. `timedOut`이 boolean이다.
38. stdout이 호출자 stdout으로 **계속 전달**된다 — 스트리밍이 죽지 않는다.
39. stderr가 호출자 stderr로 **계속 전달**된다.
40. 결과 객체에 절대 경로가 담기지 않는다.

### E. Error Contract (41–47)

41. `not_found` · `spawn_failed` · timeout · nonzero exit · exit 0 **다섯 가지가 서로 구분**된다.
42. `spawn_failed`가 nonzero exit와 **다른 값**으로 표현된다.
43. `errorCode`(`EPERM` 등)가 있을 때만 실린다 — 없으면 부재.
44. Adapter가 오류를 workflow의 `ExitReason`으로 **번역하지 않는다** — `src/model.ts`에 `nested_worker` · `verdict_unreadable` · `review_cycles_exhausted` 문자열 0건.
45. timeout 시 자식 프로세스가 kill되고 `timedOut === true`다.
46. timeout 시 `onTimeout` 콜백이 호출된다.
47. **환경 실패를 숨기지 않는다** — EPERM이 성공으로 보고되지 않는다.

### F. 보안 · 프라이버시 (48–53)

48. 모든 spawn이 `shell: false`다 — `src/model.ts`에 `shell: true` 0건.
49. `src/model.ts`에 `cmd /c` · `powershell` · `/bin/sh` 문자열이 0건이다.
50. `src/model.ts`에 `--dangerously-skip-permissions` · `bypassPermissions` · `danger-full-access` 문자열이 0건이다.
51. telemetry 출력에 사용자 홈 절대 경로가 **0건**이다.
52. run artifact에 사용자 홈 절대 경로가 **0건**이다.
53. run artifact에 프롬프트 · Context Package · stdout 본문이 **0건**이다.

### G. role / runtime / actor 분리 (54–60)

54. `--worker claude`가 거부된다 (현행 유지).
55. `--reviewer codex`가 거부된다 (현행 유지).
56. `--reviewer-actor-id`가 `--actor-id`와 같으면 거부된다 (현행 유지, RFC-001 G5).
57. `src/model.ts`에 `worker` · `reviewer` 역할 이름이 **분기 조건으로 등장하지 않는다**.
58. `src/model.ts`에 `actor_id` · `actorId` 문자열이 0건이다.
59. run artifact가 `worker_runtime`과 `reviewer_runtime`을 **별도 필드로** 담는다.
60. `worker_version` · `reviewer_version`이 override 실행에서 `override`다.

### H. Observability (61–68)

61. `RunRecord`의 기존 필드와 stage 8종이 **변경되지 않는다**.
62. worker stage 이후 run artifact에 `worker_runtime`이 기록된다.
63. review stage 이후 run artifact에 `reviewer_runtime`이 기록된다.
64. review를 쓰지 않은 실행의 artifact에 `reviewer_runtime`이 **부재**다 — 빈 문자열로 채우지 않는다.
65. version 취득 실패 시 `unknown`이 기록되고 실행은 계속된다.
66. `src/model.ts`가 `.bcos/runs/`에 쓰지 않는다 (AC 8과 함께 검증).
67. `task status <id>`가 worker runtime과 version을 출력한다.
68. `task status <id>`가 reviewer가 없던 실행에서는 reviewer 줄을 출력하지 않는다.

### I. 회귀 — 행동 불변 (69–80)

69. **stdin SHA-256이 worker에서 리팩터링 전후 동일**하다 (`--dry-run`으로 확인).
70. `--dry-run` 출력의 `command` · `args` · `cwd`가 현행과 동일하다.
71. `task run` telemetry 키 집합이 **변경되지 않는다**.
72. `task execute` telemetry 키 집합이 변경되지 않는다.
73. `task execute --review` telemetry 키 집합이 변경되지 않는다.
74. request-changes / rework 루프가 그대로 동작한다.
75. `--verify-only`가 worker를 재실행하지 않는다 (`runner_invocations=0`).
76. `--max-review-cycles` 동작이 그대로다.
77. nested worker 가드(`BCOS_WORKER_SESSION`)가 그대로 동작한다.
78. spawn capability probe(T-010)가 그대로 동작한다.
79. `task status` · run artifact(T-012) 회귀 없음.
80. `src/context.ts`가 **변경되지 않는다**.

### J. 구조 · 검증 (81–89)

81. 새 source file이 **`src/model.ts` 1개뿐**이다.
82. `src/` 아래 디렉터리가 생기지 않는다.
83. `src/workflow.ts`가 **325줄 이하**다 (상한 310 → 325로 상향. §Notes 참조).
84. `src/run.ts`가 **90줄 이하**다.
85. `src/cli.ts`가 **495줄 이하**다.
86. `package.json`의 `dependencies`가 없고 `devDependencies`가 2개다.
87. `npm run build`가 exit 0이다.
88. `npm test`가 **exit 0이고 실패 0건**이며 총 테스트 수가 **214개 이상**이다.
89. 테스트를 삭제하거나 `skip` 처리한 건이 **0건**이다.

### K. 문서 (90–94)

90. `docs/benchmarks/TELEMETRY.md` §4·§10의 `T-010` 전방 참조가 정정된다.
91. token/cost가 `N/A` + 사유(argv가 machine-readable 출력을 요청하지 않음)로 기록된다.
92. TELEMETRY.md에 **pricing table이 없다**.
93. 기존 TELEMETRY.md 키가 **삭제되지 않는다** (현재 107개 이상 유지).
94. `docs/architecture.md`에 `src/model.ts`가 한 줄로 추가된다.

**총 94개.**

## Expected Files

**생성**

- `src/model.ts` — 실행 경계. **140줄 이하**
- `.bcos/reports/T-013-model-adapter.md`

**수정**

- `src/runner.ts` — spawn/타임아웃/스트림 제거, Adapter 호출로 대체. Context·preamble·telemetry는 유지
- `src/reviewer.ts` — 동일. 프롬프트·verdict 파싱은 유지
- `src/run.ts` — `RunRecord`에 선택 필드 4개
- `src/workflow.ts` — Adapter 결과를 run artifact에 기록
- `src/cli.ts` — `task status`에 runtime/version 출력
- `tests/cli.test.ts` — 신규 테스트
- `docs/benchmarks/TELEMETRY.md` — §4·§10 정정
- `docs/architecture.md` — `src/model.ts` 한 줄

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-013-model-adapter.md` (이 파일)
- `docs/rfcs/RFC-001-task-protocol.md` — **§4 증거 · §7 소유권. 읽기 전용**
- `docs/benchmarks/TELEMETRY.md`
- `docs/architecture.md`
- `src/cli.ts`
- `src/workflow.ts`
- `src/runner.ts`
- `src/reviewer.ts`
- `src/run.ts`
- `tests/cli.test.ts`
- `package.json`

**쓰기**

위 "생성"·"수정" 목록뿐이다. **`src/context.ts`는 읽지도 쓰지도 않는다.**

## Test Requirements

**현재 186개.** 신규 **28개 이상**, 목표 총 **216개**, AC 하한 **214개**.
(하한 214 < 목표 216 — 하한이 계획을 넘지 않는다.)

**실제 Codex / Claude를 테스트에서 호출하지 않는다.** 기존 fake `.js` fixture 구조를 쓴다.

| # | 신규 테스트 |
|---|---|
| 1 | Codex argv가 `exec - --cd <root>` 형태다 |
| 2 | Codex가 `process.execPath`로 실행된다 (`runtimeKind` node) |
| 3 | Claude argv가 `-p --output-format text`다 |
| 4 | 네이티브 reviewer가 직접 실행된다 (`runtimeKind` native) |
| 5 | `.js` reviewer override가 node 경유로 실행된다 |
| 6 | worker stdin이 자식에게 그대로 도달한다 |
| 7 | reviewer stdin이 자식에게 그대로 도달한다 |
| 8 | worker cwd가 저장소 루트다 |
| 9 | reviewer cwd가 저장소 루트다 |
| 10 | worker env에 `BCOS_WORKER_SESSION=1`이 있다 |
| 11 | reviewer env에 `BCOS_WORKER_SESSION`이 없다 |
| 12 | reviewer `stdoutBytes`가 관측된다 (신규 능력) |
| 13 | reviewer `stderrBytes`가 관측된다 (신규 능력) |
| 14 | reviewer `firstResponseMs`가 관측된다 (신규 능력) |
| 15 | 출력 없는 실행에서 `firstResponseMs`가 부재다 |
| 16 | worker exit 0 |
| 17 | worker exit nonzero |
| 18 | reviewer exit nonzero |
| 19 | worker timeout → `timedOut` true + kill |
| 20 | reviewer timeout → `timedOut` true |
| 21 | executable 없음 → `not_found` |
| 22 | spawn 실패가 nonzero exit와 구분된다 |
| 23 | `shell:false` — 셸 메타문자가 확장되지 않는다 |
| 24 | telemetry에 홈 절대 경로가 없다 |
| 25 | run artifact에 `worker_runtime`이 기록된다 |
| 26 | run artifact에 `reviewer_runtime`이 기록된다 |
| 27 | review 없는 실행에 `reviewer_runtime`이 부재다 |
| 28 | override 실행에서 version이 `override`다 |
| 29 | `task status`가 worker runtime/version을 출력한다 |
| 30 | worker `--dry-run` stdin SHA-256이 리팩터링 전 값과 같다 |

**회귀 — 기존 186개가 전부 통과해야 한다.** 특히 `task run` · `task execute` ·
`--review` · request-changes/rework · `task status` · run artifact.

**금지** — 새 테스트 프레임워크 도입 · 기존 assertion 완화 · 테스트 삭제/skip ·
실제 모델 호출 · 네트워크 접근.

## Benchmark Telemetry

**새 telemetry 키를 추가하지 않는다.** 기존 키의 값이 정확해지는 것이 이번 변화다.

| 기존 키 | T-013에서의 변화 |
|---|---|
| `worker_runtime` | 하드코딩 `"node"` → Adapter의 `runtimeKind` 관측값 |
| `reviewer_runtime` | 기존 유지 |

**run artifact 신규 필드 4개** (§Scope 8): `worker_runtime` · `worker_version` ·
`reviewer_runtime` · `reviewer_version`.

**token / cost = `N/A`.** 사유는 §Scope 9. **추정값을 measured로 쓰지 않는다.**
**efficiency · improvement · savings · reduction 같은 계산 결과를 기록하지 않는다.**

## Required Protocol / Policy Notes

- **RFC-001 개정 없음.** 실행 방식은 프로토콜 규격이 아니다.
- **G5 불변** — `actor_id`는 runtime과 무관하다. Adapter는 `actor_id`를 모른다.
- **run artifact 소유권 불변** — Workflow가 관찰 데이터를 소유한다 (T-012).
- **`.bcos/reports/`는 worker 소유** — Adapter는 접근하지 않는다.

## Notes — 상한 상향과 위험

### `src/workflow.ts` 상한 310 → 325

T-012 종료 시점 306줄로 **여유가 4줄**이다. run artifact에 runtime/version 4개를
기록하려면 부족하다. **상한을 올린다는 사실을 숨기지 않고 여기 적는다.**

조건: 상향분은 **run artifact 기록에만** 쓴다. 모델별 분기를
`workflow.ts`에 넣는 데 쓰면 T-013의 목적에 반한다 —
`workflow.ts`에 `codex` · `claude` 문자열이 **현재보다 늘어나면 안 된다**.

### 이번 Task의 가장 큰 위험 — reviewer 통합이 관측을 바꾼다

reviewer는 지금 `pipe()`로 출력을 흘려보낸다. Adapter는 `on("data")`로 계수한다.
**스트리밍 동작이 미묘하게 달라질 수 있다.** AC 38·39가 이것을 잡는다.
출력이 화면에 안 나오면 실패로 판정한다.

### 알려진 격차 — 기록만 하고 고치지 않는다

reviewer 자식 프로세스에는 `BCOS_WORKER_SESSION` 스탬프가 없다.
따라서 reviewer가 `bcos task execute`를 호출해도 nested 가드가 잡지 못한다.
프롬프트로만 금지하고 있다. **T-013에서 고치지 않는다** —
env 변수 이름이 `WORKER`라 reviewer에 붙이면 의미가 틀리고,
이름 변경은 문서화된 환경변수의 파괴적 변경이다. 별도 판단이 필요하다.

## Notes — dogfooding 경계

T-013은 **T-012 이후 첫 full observable workflow**다. 설계 커밋·push 이후
구현 단계에서 `task execute --review`를 실제로 사용한다.

```
node dist/cli.js task execute T-013 --worker codex --actor-id codex-cli --review --reviewer claude --reviewer-actor-id claude-code --timeout 5400
```

**동시에 최초로 검증되는 것들**

| | 최초 여부 |
|---|---|
| persistent run artifact 전 구간 | **최초** (T-012는 부트스트랩 때문에 부분만) |
| 실제 Claude reviewer | **최초** — 지금까지 fake fixture로만 검증됨 |
| 자동 approve 또는 rework | **최초** |

### 실제 Claude reviewer 최초 실행 위험

조사 결과 저장소의 `.claude/settings.json`에 **permission allow 규칙이 없다.**
`-p` 모드의 Claude는 대화형 승인을 띄울 수 없다.
따라서 reviewer가 `.bcos/reviews/`에 파일을 쓰지 못할 가능성이 있다.
그 경우 verdict는 `unreadable`이 된다.

**이때 절대 하지 않을 것**

- `--dangerously-skip-permissions` 추가
- `--permission-mode bypassPermissions` 추가
- verdict를 손으로 써넣고 approve
- **강제 approve**

**할 것** — T-011의 human escalation semantics를 그대로 따른다.
`unreadable`이면 workflow가 멈추고 사람이 판단한다.
Reviewer가 예상 밖 형식을 내면 그것도 escalation이다.

`--permission-mode acceptEdits`는 우회가 아닌 정당한 중간값이지만
**argv 변경이므로 T-013 범위 밖이다.** 필요하다고 판명되면 별도 Task로 낸다.

### 위험 완화

`--review` 없이 `task execute`를 먼저 돌려 worker·검증·artifact를 확인하고,
그 다음 `--review`를 붙이는 2단계 진행을 **권장**한다.
두 신규 축을 동시에 최초 검증하지 않는다 — T-012에서 쓴 것과 같은 원칙이다.
