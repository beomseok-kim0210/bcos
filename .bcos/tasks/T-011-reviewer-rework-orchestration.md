---
protocol: "0.1"
id: T-011
title: Run the reviewer, act on the verdict, and loop until approval
status: TODO
attempt: 0
created: 2026-08-07T06:20:00Z
updated: 2026-08-07T06:20:00Z
---

## Objective

T-010의 `task execute` 는 `IMPLEMENTED` 에서 멈춘다. 그 뒤로 사람이 여덟 가지를 한다 —
Reviewer 실행 · Review 프롬프트 전달 · 결과 확인 · Finding을 Worker에게 전달 ·
재작업 지시 · 검증 재실행 · 필요하면 재리뷰 · `task approve`.

T-011은 이 loop를 자동화한다.

```
node dist/cli.js task execute T-011 --worker codex --actor-id codex-cli \
  --review --reviewer claude --reviewer-actor-id claude-code
```

**`APPROVED` 면 `approve`, `CHANGES_REQUESTED` 면 `request-changes` 후 재작업.**
사람은 최종 결과와 Review 증거만 확인한다.

### 이 Task가 해결하는 반복된 결함

T-009와 T-010에서 **같은 Process Finding이 두 번** 나왔다. worker Report가
"모든 Acceptance Criteria 완료를 주장하지 않는다"고 명시했는데도 `submit` 이 통과했다.
G3는 Report의 존재만 검사하기 때문이다.

**해법은 이미 프로토콜에 있다.** RFC-001 §4가 명령한다.

> **증거 없는 완료 주장은 `CHANGES_REQUESTED`로 판정한다** (**MUST**).

**빠져 있던 것은 규칙이 아니라 그 규칙을 실행하는 주체다.** Reviewer가 사람이라
매번 실행되지 않았을 뿐이다. T-011은 Reviewer를 자동 실행해 그 MUST를 발동시킨다.

**새 marker도, 새 artifact도, Report 파서도 만들지 않는다.**

## Scope

`src/reviewer.ts` 를 새로 만들고 `src/workflow.ts` 와 `src/cli.ts` 를 확장한다.

- [ ] `task request-changes <id>` 명령 추가 — RFC-001의 미구현 전이
- [ ] `task execute` 에 `--review` · `--reviewer` · `--reviewer-actor-id` ·
      `--max-review-cycles` · `--reviewer-command` 추가
- [ ] Reviewer 프로세스 실행과 stdin 조립
- [ ] Review artifact에서 현재 attempt의 판정을 읽는다
- [ ] `APPROVED` → `task approve`
- [ ] `CHANGES_REQUESTED` → `task request-changes` → worker 재실행 → 검증 → `submit`
- [ ] cycle 한도 도달·판정 불가·실행 실패 시 **사람에게 넘긴다**
- [ ] Telemetry 출력

### `request-changes` — RFC에 이미 규정돼 있다

**RFC-001 §1.2를 그대로 구현한다. 프로토콜을 바꾸지 않는다.**

| 항목 | RFC 규정 |
|---|---|
| From → To | `IMPLEMENTED` → `IN_PROGRESS` |
| 허용 role | `reviewer` · `human` |
| 가드 | **G4, G5** |
| 이벤트 | `TASK_CHANGES_REQUESTED` |

**G4** — 현재 attempt의 Review 항목이 존재하고 **판정이 요청한 전이와 일치**한다.
`approve` 가 `APPROVED` 를 요구하듯 `request-changes` 는 `CHANGES_REQUESTED` 를 요구한다.
**G5** — 전이를 수행하는 `actor_id` 가 그 attempt를 제출한 `actor_id` 와 달라야 한다.

**RFC-001 §1.4** — `attempt` 는 `IN_PROGRESS` 에 진입할 때마다 1 증가한다.
`start` 와 `request-changes` **양쪽 모두**. 따라서 재작업 후 attempt는 자동으로 2가
되고 **`attempt ≥ 2` 는 재작업이 있었다는 뜻**이다. 별도 계산을 만들지 않는다.

구현은 **기존 `approveTask()` 를 그대로 본떠 만든다.** 판정 문자열과 이벤트 이름,
목표 상태만 다르다. 새 전이 엔진을 만들지 않는다.

### Reviewer 실행 — Claude Code CLI

**조사 결과(읽기 전용, 버전 2.1.220).**

| 항목 | 결과 |
|---|---|
| 비대화형 | **`-p` / `--print`** 지원 |
| 출력 형식 | `--output-format text \| json \| stream-json` |
| 입력 형식 | `--input-format text \| stream-json` — **stdin 지원** |
| 작업 디렉터리 | 전용 플래그 없음 → **spawn의 `cwd` 옵션**을 쓴다 |
| 권한 | `--permission-mode` · `--allowedTools` · `--disallowedTools` |
| 실행 형태 | **네이티브 `.exe`** — Node 진입점이 아니다 |
| timeout 플래그 | 없음 → **BCOS가 Runner와 같은 방식으로 건다** |

**`.exe` 는 `shell: false` 로 직접 spawn할 수 있다.** Node의 `.cmd` 제약은 배치 파일에만
적용된다. Codex에 쓴 `process.execPath` + JS 진입점 우회가 **여기서는 필요 없다.**

```
spawn(<claude 실행 파일>, ["-p", "--output-format", "text"],
      { shell: false, cwd: <repo root> })
```

`--reviewer-command <path>` 로 덮어쓸 수 있다. **테스트는 이 옵션으로 가짜 reviewer를
가리킨다.** `PATH` 탐색은 문자열 분할과 `existsSync` 로만 한다. 셸을 켜지 않는다.

**`--dangerously-skip-permissions` 를 쓰지 않는다.** Reviewer의 권한을 BCOS가 임의로
넓히지 않는다.

**`--output-format json` 이 사용량을 담을 가능성이 있으나 이번에 읽지 않는다.**
토큰·비용은 T-012다.

### Reviewer stdin

Runner의 preamble과 같은 원칙 — 고정 문장과 값 몇 개, Context Package.

```
BCOS REVIEW EXECUTION

  task:     <id>
  attempt:  <n>
  reviewer: <name>
  review:   .bcos/reviews/<Task 파일명>

너는 이 저장소의 reviewer다. actor_role: reviewer.

CONTEXT PACKAGE 안에 Task 문서와 Report가 있다. Report를 신뢰하지 마라.
Task의 Acceptance Criteria를 하나씩 직접 확인하라.

호스트 검증은 BCOS가 이미 실행했다. 결과는 아래에 있다.
그 결과를 증거로 쓰고 테스트를 다시 실행하지 마라.

판정은 APPROVED 또는 CHANGES_REQUESTED 둘 중 하나다.
증거 없는 완료 주장은 CHANGES_REQUESTED다.
CHANGES_REQUESTED면 Required Changes에 "어느 파일의 무엇을 무엇으로"를 적어라.

git 명령을 실행하지 마라. bcos 명령을 실행하지 마라.
구현을 수정하지 마라. 테스트를 수정하지 마라.

--- HOST VERIFICATION EVIDENCE ---
  command:   <npm-test | custom-verifier>
  exit code: <n>
  duration:  <n> ms

--- CONTEXT PACKAGE ---
<buildContextPackage() 출력 전문>
```

**타임스탬프를 넣지 않는다.** 같은 입력이면 같은 바이트여야 한다.

**Review 경로는 Task 파일명에서 유도한다** — `.bcos/reviews/<Task 파일명>`.

### Reviewer는 테스트를 다시 돌리지 않는다

**T-009와 T-010에서 worker가 자기 샌드박스 안에서 `spawn EPERM` 으로 테스트를 실행하지
못했다. 두 번이다.** Reviewer도 같은 방식으로 실행되므로 같은 일이 일어날 수 있다.

**그래서 역할을 나눈다.**

| 주체 | 책임 |
|---|---|
| **BCOS host** | build·test를 실제로 실행하고 **exit code를 산출한다** (T-010이 이미 한다) |
| **Reviewer** | 코드·Task·AC·Scope·회귀를 판단하고, **host 검증 결과를 증거로 받는다** |

**Reviewer가 테스트를 실행할 수 없어도 리뷰는 성립한다.** 실행 결과는 이미 있다.
Reviewer가 판단하는 것은 "그 결과가 이 Task의 AC를 충족하는가"다.

이것은 운영 원칙의 변경이며 **문서 개정이 필요하다. 이 Task에서 수정하지 않고
`Required Protocol / Policy Changes` 에 제안만 남긴다.**

### 판정 읽기 — 새 형식을 만들지 않는다

`approve` 가 이미 쓰는 방식을 그대로 쓴다.

Review 본문의 Attempt heading이 판정을 담는다. `H2` 다음에 `Attempt <n>`, em dash로
구분된 RFC 3339 시각, 다시 em dash 다음에 판정 — `APPROVED` 또는 `CHANGES_REQUESTED`.
`approveTask()` 의 기존 정규식이 판정 문자열만 바꿔 그대로 쓰인다.

**이 문서는 그 heading을 예시로 옮겨 적지 않는다.** 줄 첫머리의 `H2` 는 Task 검증기가
섹션 경계로 읽으므로, 코드 블록 안이라도 필수 6섹션 검사를 망가뜨린다. T-005가 고친
결함과 같은 종류다. 정확한 형태는 `src/cli.ts` 의 `approveTask()` 와 RFC-001 §4에 있다.

**Review frontmatter를 확장하지 않고, 별도 결과 파일을 만들지 않고, 산문을 파싱하지
않는다.** 판정은 이미 기계가 읽을 수 있다.

현재 attempt 항목이 없거나 두 판정 중 어느 것도 아니면 **판정 불가로 처리하고 사람에게
넘긴다.** 추측하지 않는다.

`BLOCKED` 판정은 이번에 다루지 않는다 — RFC 표에 `IMPLEMENTED → BLOCKED` 전이가
없다. 판정 불가와 같이 사람에게 넘긴다.

### 재작업 — worker에게 무엇을 주는가

`request-changes` 후 attempt가 2가 되면 **같은 worker를 새 프로세스로** 실행한다.
세션 기억에 의존하지 않는다.

**Review artifact를 stdin에 포함한다.** Task마다 Read List에 자기 review 파일을
적게 하지 않는다 — `task run` 이 **attempt ≥ 2 이고 Review 파일이 있으면** Context
Package 뒤에 붙인다.

```
--- REVIEW OF PREVIOUS ATTEMPT ---
<Review 파일 전문>
```

**주지 않는 것** — 대화 기록 · Reviewer 내부 추론 · 저장소 재탐색 지시 ·
새로 손으로 쓴 프롬프트. **T-009 원칙을 유지한다: Task + AGENTS.md + 결정론적 산출물.**

### loop와 종료 조건

```
IMPLEMENTED → review → APPROVED           → approve → DONE
                     → CHANGES_REQUESTED  → request-changes → run → verify → submit
                                          → review …
```

**`--max-review-cycles` 기본값 2.** 근거는 관측이다 — T-009와 T-010이 각각 재작업
**1회**로 끝났다. 2는 관측된 필요를 덮고 한 번의 여유를 둔다. **추측한 값이 아니며
사용자가 덮어쓸 수 있다.**

**cycle과 timeout은 다른 것이다.** `--timeout` 은 한 프로세스의 상한이고
`--max-review-cycles` 는 review 반복 횟수의 상한이다. 재시도 엔진을 만들지 않는다.

### 사람에게 넘기는 조건

| 조건 | `workflow_exit_reason` |
|---|---|
| reviewer 프로세스 실패 (exit ≠ 0) | `reviewer_failed` |
| 현재 attempt 판정을 읽을 수 없음 | `verdict_unreadable` |
| `BLOCKED` 판정 | `verdict_unreadable` |
| `--max-review-cycles` 초과 | `review_cycles_exhausted` |
| 재작업 후 host 검증 실패 | `verification` |
| reviewer 환경 실패 | `environment` · `permission` |

**추측하거나 강제로 승인하지 않는다.** 멈춘 지점 · Task 상태 · 마지막 판정 ·
Review 파일 경로 · 사람이 해야 할 일을 출력한다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **Model Adapter · 두 번째 worker · multi-model switching** — T-012·T-013
- **Claude-only / Codex-only benchmark 비교** — T-014·T-015
- token · cost 수집 — `--output-format json` 을 읽지 않는다
- **commit · push · git 명령 · PR 자동화**
- **Report 산문 파서 · Review 산문 파서 · LLM 기반 판정 해석**
- **Review frontmatter 확장 · 별도 결과 artifact** — 판정은 Attempt heading에서 읽는다
- **Report에 completion marker 추가** — RFC-001 §2 변경이 필요하다
- **RFC-001 · CLAUDE.md · AGENTS.md 수정** — 제안만 남긴다
- **새 상태·새 이벤트 · 기존 상태 우회 사용** — `request-changes` 는 RFC에 이미 있다
- **전이 로직 복제** — `approve` · `submit` · `start` · `request-changes` 를 자식
  프로세스로 재사용한다
- **`--dangerously-skip-permissions`** — Reviewer 권한을 임의로 넓히지 않는다
- **Reviewer가 테스트를 실행하도록 지시** — host 검증 결과를 증거로 준다
- **자동 승인** — 판정을 읽지 못하면 멈춘다
- 무제한 retry · retry 엔진 · queue · daemon · 병렬 worker · worktree
- Agent framework · Pipeline framework · Event bus · scheduler · plugin · DI
- 외부 DB · RAG · embeddings · 범용 프롬프트 프레임워크
- **셸 실행** — `shell: true`, `cmd /c`, 셸 문자열 조립
- 새 파일 — `src/reviewer.ts` **하나만**
- **`src/context.ts` 수정**
- **runtime dependency 추가** · `package-lock.json` 생성
- **`--review` 없이 실행한 `task execute` 의 동작 변경** — T-010 동작을 그대로 둔다
- 이 저장소의 실제 `.bcos/` 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- **테스트에서 실제 Claude Code·실제 Codex·실제 `npm test` 호출**
- `.bcos/prompts/` 에 파일 추가

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.

**`task request-changes`**

2. `task request-changes <id> --actor-role reviewer --actor-id <id>` 가 라우팅된다.
3. `IMPLEMENTED` Task를 `IN_PROGRESS` 로 바꾼다.
4. `TASK_CHANGES_REQUESTED` 이벤트를 1건 남긴다.
5. **`attempt` 가 1 증가한다** — RFC-001 §1.4.
6. `state.json` 의 counts와 `current_task` 가 갱신된다.
7. **G4** — 현재 attempt Review가 없으면 exit 1이다.
8. **G4** — 판정이 `CHANGES_REQUESTED` 가 아니면 exit 1이다.
9. **G5** — 전이 actor가 제출 actor와 같으면 exit 1이다.
10. `IMPLEMENTED` 가 아닌 상태에서는 exit 1이다.
11. `--actor-role` 이 `reviewer` 나 `human` 이 아니면 exit 1이다.
12. 거부된 경우 Task·`events.jsonl`·`state.json` 이 **하나도 바뀌지 않는다.**
13. `--help` 에 `request-changes` 가 나온다.

**Reviewer 실행**

14. `--review` 없이 실행하면 T-010 동작 그대로 `IMPLEMENTED` 에서 멈춘다.
15. `--review` 를 주면 `submit` 이후 reviewer가 실행된다.
16. `--reviewer` 가 `claude` 가 아니면 exit 1이다.
17. `--reviewer-actor-id` 가 없으면 exit 1이다.
18. **`--reviewer-actor-id` 가 `--actor-id` 와 같으면 exit 1이다** — G5를 미리 막는다.
19. `--reviewer-command <path>` 가 실행 파일을 덮어쓴다.
20. 그 경로가 없으면 exit 1이다.
21. reviewer를 `shell: false` 로 실행한다.
22. reviewer의 cwd가 저장소 루트다.
23. reviewer의 stdout·stderr가 부모로 전달된다.
24. reviewer에 `--timeout` 이 적용된다.
25. reviewer가 timeout되면 사람에게 넘긴다.

**Reviewer stdin**

26. Task ID · attempt · reviewer 이름 · Review 경로가 포함된다.
27. "Report를 신뢰하지 마라" 지시가 포함된다.
28. **host 검증 증거(명령·exit code·소요 시간)가 포함된다.**
29. **"테스트를 다시 실행하지 마라" 지시가 포함된다.**
30. 판정 두 값과 "증거 없는 완료 주장은 CHANGES_REQUESTED" 지시가 포함된다.
31. git 금지·bcos 금지·구현 수정 금지·테스트 수정 금지 지시가 포함된다.
32. Context Package가 **정확히 한 번** 포함된다.
33. **타임스탬프가 없다** — 같은 입력이면 stdin SHA-256이 같다.
34. **stdin 본문이 어떤 로그·파일에도 기록되지 않는다.**

**판정 처리**

35. 현재 attempt 항목이 `APPROVED` 면 `task approve` 를 실행한다.
36. 그 결과 `DONE` 이 되고 `TASK_APPROVED` 가 1건이다.
37. 승인 actor가 `--reviewer-actor-id` 값이다.
38. 현재 attempt 항목이 `CHANGES_REQUESTED` 면 `task request-changes` 를 실행한다.
39. 그 결과 `IN_PROGRESS` 가 되고 attempt가 2가 된다.
40. 현재 attempt 항목이 없으면 사람에게 넘기고 `verdict_unreadable` 이다.
41. `BLOCKED` 판정이면 사람에게 넘기고 `verdict_unreadable` 이다.
42. 판정을 읽지 못한 경우 **`approve` 도 `request-changes` 도 실행하지 않는다.**
43. reviewer exit ≠ 0이면 판정을 읽지 않고 `reviewer_failed` 다.
44. 그때 Task가 `IMPLEMENTED` 로 남는다.

**Rework loop**

45. `CHANGES_REQUESTED` 후 worker가 새 프로세스로 재실행된다.
46. 재실행 stdin에 **Review 파일 전문이 포함된다.**
47. Review 파일이 없거나 attempt가 1이면 그 절이 붙지 않는다.
48. 재작업 후 host 검증이 실행된다.
49. 검증이 통과하면 `submit` 되어 `IMPLEMENTED` 가 된다.
50. 그 다음 reviewer가 다시 실행된다.
51. 두 번째 판정이 `APPROVED` 면 `approve` 되어 `DONE` 이 된다.
52. 재작업 중 검증이 실패하면 `submit` 하지 않고 사람에게 넘긴다.
53. **`--max-review-cycles` 기본값이 2다.**
54. 한도를 넘으면 `review_cycles_exhausted` 로 멈춘다.
55. 그때 Task 상태가 마지막 전이 결과 그대로 남는다.
56. `--max-review-cycles` 가 양의 정수가 아니면 exit 1이다.
57. **어떤 경로에서도 판정 없이 `approve` 가 실행되지 않는다.**

**사람에게 넘기기**

58. 멈춘 지점이 출력된다.
59. Task의 현재 상태가 출력된다.
60. 마지막 판정(또는 읽지 못했다는 사실)이 출력된다.
61. Review 파일 경로가 출력된다.
62. **사람이 해야 할 다음 행동이 출력된다.**
63. 출력에 사용자 홈 경로가 없다.

**Telemetry**

64. `reviewer_name` · `reviewer_runtime` 이 출력된다.
65. `reviewer_duration_ms` · `reviewer_exit_code` 가 숫자로 출력된다.
66. `review_started_at` · `review_completed_at` 이 RFC 3339로 출력된다.
67. `review_verdict` 가 출력된다 — 읽지 못하면 `unreadable`.
68. `review_cycle` 이 실제 반복 횟수와 같다.
69. `reviewer_invocations` 가 reviewer 실행 횟수와 같다.
70. `rework_invocations` · `rework_attempt` 가 실제 값과 같다.
71. `feedback_handoff_count` 가 Review를 worker에게 전달한 횟수와 같다.
72. `approval_transition_caused` 가 `true` 또는 `false` 다.
73. `human_escalation_reason` 이 넘긴 경우에만 출력된다.
74. **`--review` 없이 실행하면 reviewer 관련 필드가 나오지 않는다** — 0으로 채우지 않는다.
75. `lifecycle_transitions_caused` 가 실제 전이 수와 같다 — 승인까지 갔으면 3.
76. **비율 계산 키가 소스에 없다** — `_rate` · `_ratio` · `efficiency` ·
    `improvement` · `savings` · `reduction`.
77. **Telemetry가 어떤 파일에도 기록되지 않는다.**
78. `docs/benchmarks/TELEMETRY.md` 에 새 키가 추가돼 있고 기존 96개가 보존된다.
79. 추가된 내용에 계산 필드가 없고 `blocked` 사유가 적혀 있다.

**회귀**

80. `task start` · `submit` · `approve` · `context` · `run` 정상 1건 + 실패 1건.
81. `task execute` (`--review` 없음) 정상·실패 — **T-010 테스트가 그대로 통과한다.**
82. nested worker guard와 capability probe가 그대로 동작한다.
83. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.

**품질**

84. `npm test` 가 통과하며 **155개 이상**의 테스트가 pass한다.
85. `package.json` 에 `dependencies` 키가 없고 `devDependencies` 가 2개 그대로다.
86. `src/` 에 `cli.ts` · `context.ts` · `runner.ts` · `workflow.ts` · `reviewer.ts`
    **다섯 파일만** 존재하고 하위 디렉터리가 없다.
87. `src/reviewer.ts` 가 **160줄을 넘지 않는다.**
88. `src/workflow.ts` 가 **300줄을 넘지 않는다.**
89. 두 파일에 class가 없다 — 함수만 export한다.
90. **테스트가 실제 Claude Code·실제 Codex·실제 `npm test` 를 호출하지 않는다.**
91. 소스에 `shell: true` · `cmd /c` · 셸 문자열 조립이 없다.
92. 소스에 `--dangerously-skip-permissions` 가 없다.
93. **`workflow.ts` 와 `reviewer.ts` 가 `events.jsonl` · `state.json` 에 직접 쓰지 않는다.**
94. `git status` 기준 변경 파일이 `src/cli.ts` · `src/runner.ts` · `src/workflow.ts` ·
    `src/reviewer.ts` · `tests/cli.test.ts` · `docs/benchmarks/TELEMETRY.md` · Report
    7개뿐이다. `package-lock.json` 이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**생성**

- `src/reviewer.ts`

**수정**

- `src/cli.ts` — `request-changes` 라우팅과 `execute` 옵션
- `src/workflow.ts` — review·rework loop
- `src/runner.ts` — attempt ≥ 2일 때 Review 첨부 **한 곳만**
- `tests/cli.test.ts`
- `docs/benchmarks/TELEMETRY.md` — **새 필드 추가만.** 기존 96개와 다른 절은 그대로 둔다

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-011-reviewer-rework-orchestration.md` (이 파일)
- `docs/rfcs/RFC-001-task-protocol.md` — **§1.2 전이 · §1.3 가드 · §1.4 attempt ·
  §4 Review 규격. 읽기 전용**
- `docs/benchmarks/TELEMETRY.md`
- `src/cli.ts`
- `src/workflow.ts`
- `src/runner.ts`
- `src/context.ts`
- `tests/cli.test.ts`
- `package.json`

**쓰기**

- `.bcos/reports/T-011-reviewer-rework-orchestration.md`

**실행 프롬프트 파일이 없다.** T-009가 없앴다. `.bcos/prompts/` 에 파일을 만들지 않는다.

**Claude Code CLI는 이미 조사됐다.** 위 Scope의 플래그와 실행 형태가 버전 2.1.220
실측 결과다. **`claude --help` 를 다시 실행하지 않는다.**

`src/reviewer.ts` 는 **reviewer 프로세스 실행과 stdin 조립만** 한다. loop는
`src/workflow.ts` 가 갖고, 상태 전이는 `src/cli.ts` 의 기존 명령을 자식 프로세스로
재사용한다. **`approve` 로직을 복제하지 않는다.**

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**실제 Claude Code·실제 Codex·실제 `npm test` 를 절대 호출하지 않는다.**
임시 디렉터리에 가짜 worker·가짜 검증기·**가짜 reviewer** `.js` 를 만들고
`--worker-command` · `--verify-command` · `--reviewer-command` 로 가리킨다.

가짜 reviewer가 할 수 있어야 하는 것 — **stdin을 파일로 덤프**, 지정한 판정으로
Review 파일 작성(또는 작성하지 않음), stdout·stderr 출력, 지정한 exit code로 종료,
지정한 시간 대기.

**worker·verifier·reviewer 모두 실행되면 마커 파일을 남긴다** — "실행되지 않았다"를
결과가 아니라 흔적으로 확인한다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 fixture를 만들고
`spawnSync` 의 `cwd` 옵션으로 CLI를 실행한다. **이 저장소의 실제 `.bcos/` 나 실제
소스를 읽거나 쓰는 테스트는 금지한다.**

| # | 대상 | 기대 |
|---|---|---|
| 1–129 | 기존 테스트 129개 | 전부 그대로 통과 |
| 130 | `request-changes` 정상 | `IMPLEMENTED` → `IN_PROGRESS`, attempt +1, 이벤트 1건 |
| 131 | `request-changes` G4 | Review 없음 / 판정 불일치 → 각각 exit 1 |
| 132 | `request-changes` G5 | 제출자 자신 → exit 1 |
| 133 | `request-changes` 상태·role | 잘못된 상태·role → exit 1 |
| 134 | `request-changes` 거부 | `.bcos/` 해시 동일 |
| 135 | `--review` 없음 | T-010 동작 유지, reviewer 미실행, reviewer 필드 미출력 |
| 136 | reviewer 실행 | 마커 존재, cwd·shell·stdout·stderr |
| 137 | reviewer stdin | 식별·불신뢰·검증증거·재실행금지·판정지시·금지사항 |
| 138 | reviewer stdin | Context 정확히 1회, 타임스탬프 없음, 2회 해시 동일 |
| 139 | `APPROVED` | `approve` 실행, `DONE`, 승인 actor = reviewer actor |
| 140 | `CHANGES_REQUESTED` | `request-changes` 실행, `IN_PROGRESS`, attempt 2 |
| 141 | 판정 없음 / `BLOCKED` | `verdict_unreadable`, 전이 0건 |
| 142 | reviewer exit ≠ 0 | `reviewer_failed`, `IMPLEMENTED` 유지, 전이 0건 |
| 143 | reviewer timeout | 사람에게 넘김, 전이 0건 |
| 144 | rework loop | 재실행 → 검증 → `submit` → 재리뷰 → `APPROVED` → `DONE` |
| 145 | rework stdin | Review 전문 포함, attempt 1이면 미포함 |
| 146 | rework 검증 실패 | `submit` 0건, 사람에게 넘김 |
| 147 | cycle 한도 | 기본 2, 초과 시 `review_cycles_exhausted` |
| 148 | 잘못된 `--max-review-cycles` | exit 1 |
| 149 | SoD 사전 검사 | reviewer actor == worker actor → exit 1 |
| 150 | 사람에게 넘김 출력 | 지점·상태·판정·Review 경로·다음 행동 |
| 151 | Telemetry | reviewer·review·rework 필드 값 일치 |
| 152 | Telemetry | 승인까지 `lifecycle_transitions_caused=3` |
| 153 | Telemetry | 절대경로 0건, 파일 기록 0건 |
| 154 | TELEMETRY.md | 새 키 존재, 기존 96개 보존, 계산 키 0건 |
| 155 | 모든 실패 경로 | fixture `.bcos/` 해시 동일 |
| 156 | Lifecycle 회귀 | 기존 6개 명령 정상·실패 각 1건 |

**기존 129 + 신규 27 = 156을 계획한다.** AC 84의 하한은 **155**이며 계획이 하한을
넘는다. **숫자를 맞추려고 테스트를 쪼개지 않는다** — 하한이 계획보다 크면 충족 불가능한
명세가 되고, T-010 설계에서 실제로 그 오류를 냈다.

**증거:** Report의 `Test Evidence` 에 `npm run build` 와 `npm test` 의 출력 전문,
`APPROVED` 경로와 rework 경로의 이벤트 나열, reviewer stdin 해시 2회 일치,
사람에게 넘긴 출력 전문, `telemetry` 줄 전문, 회귀 결과를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join` 을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used` 에 읽은 파일 수, Read List 밖에서 읽은 파일,
완료 후 `src/reviewer.ts` 줄 수와 `src/workflow.ts` · `src/cli.ts` · `src/runner.ts`
증감을 기록한다. **이 저장소는 공개된다.** 개인 홈 경로·이메일·환경 변수 값을
Report에 남기지 않는다.

## Benchmark Telemetry

필드 정의는 [docs/benchmarks/TELEMETRY.md](../../docs/benchmarks/TELEMETRY.md)에 있다.
**이번 Task는 그 문서에 새 절 하나를 추가한다.**

**이번에 추가되는 필드**

| key | 출처 |
|---|---|
| `reviewer_name` · `reviewer_runtime` | 선택된 reviewer와 실행 형태 |
| `reviewer_duration_ms` · `reviewer_exit_code` | reviewer 프로세스에서 직접 관측 |
| `review_started_at` · `review_completed_at` | Orchestrator가 재는 시각 |
| `review_verdict` | Attempt heading에서 읽은 값 또는 `unreadable` |
| `review_cycle` · `reviewer_invocations` | 실제 반복·실행 횟수 |
| `rework_invocations` · `rework_attempt` | 재작업 실행 횟수와 그때의 attempt |
| `feedback_handoff_count` | Review를 worker에게 전달한 횟수 |
| `approval_transition_caused` | `approve` 를 실행했는가 |
| `human_escalation_reason` | 사람에게 넘긴 사유. 넘기지 않았으면 미출력 |

**기존 필드와의 관계**

| 기존 | 관계 |
|---|---|
| `handoff_count` (manual) | `feedback_handoff_count` 는 그중 **도구가 관측한 부분집합**이다. 둘을 더하지 않는다 |
| `human_actions` (manual) | T-011이 자동화한 단계만큼 줄어들지만 **여전히 사람이 센다** |
| `worker_switch_count` (manual) | worker는 여전히 하나다. T-011과 무관 |
| `review_start_time` (blocked) | **여전히 blocked다.** `REVIEW_STARTED` 이벤트가 없다. 새로 생기는 `review_started_at` 은 **이번 실행 중 관측값**이며 이벤트 로그에 남지 않는다 |
| `rework_count` (blocked) | **해제된다.** `TASK_CHANGES_REQUESTED` 이벤트가 생기므로 셀 수 있다 |
| `review_findings_*` (manual) | **여전히 manual이다.** 세려면 Review 산문을 파싱해야 한다 |

**계산 금지** — 비율·개선율·절감률·효율·ROI를 만들지 않는다.
**없는 값을 0으로 채우지 않는다** — `--review` 없이 실행하면 reviewer 필드를 출력하지
않는다.

**T-010 baseline**

| | T-010 실측 |
|---|---|
| `IMPLEMENTED` 까지 사용자 명령 | **1** (`task execute`) |
| 그 이후 사람이 하는 일 | **8단계** — reviewer 실행·프롬프트 전달·결과 확인·Finding 전달·재작업 지시·검증 재실행·재리뷰·`approve` |
| Tests 최종 | 129 / 129 |
| 첫 host 검증 | 128 / 129 |
| 제품 결함 재작업 | 1 |
| Report 완료 증거 문제 | **재발 (T-009·T-010 두 번)** |
| worker 내부 `spawn EPERM` | **재발 (T-009·T-010 두 번)** |

**T-011의 목표는 위 8단계를 줄이는 것이다.** 단계 수만 기록하고 개선율로 환산하지 않는다.

## Required Protocol / Policy Changes

**이 Task에서 아래를 수정하지 않는다. 제안만 남긴다.**

**1. `CLAUDE.md` / `AGENTS.md` — Reviewer의 검증 방식 (필요)**

현재 운영 원칙은 Reviewer가 build·test를 직접 재실행하도록 한다. 그러나 T-009와
T-010에서 worker가 자기 샌드박스 안에서 `spawn EPERM` 으로 테스트를 실행하지 못한
사례가 **두 번** 나왔고, 자동 Reviewer도 같은 방식으로 실행되므로 같은 일이 예상된다.

제안 — **"Reviewer는 host 검증 결과를 증거로 받는다. 직접 실행할 수 있으면 하되
필수가 아니다. 직접 실행하지 못한 경우 그 사실을 Review에 적는다."**

**2. RFC-001 §1.2 — `IMPLEMENTED` 에서 `BLOCKED` 로 가는 길이 없다 (선택)**

§4는 판정을 셋(`APPROVED` · `CHANGES_REQUESTED` · `BLOCKED`)으로 정의하는데,
§1.2 전이표의 `block` 은 `TODO` · `IN_PROGRESS` 에서만 출발한다. **`IMPLEMENTED` 에서
`BLOCKED` 판정이 나오면 갈 곳이 없다.** T-011은 이 경우를 사람에게 넘기는 것으로
처리하고 프로토콜을 바꾸지 않는다. 개정 여부는 별도 판단이다.

**3. RFC-001 §4 — Review 항목의 H3 섹션 (관측)**

§4는 `Criteria Assessment` · `Findings` · `Required Changes` · `Verdict` 네 개를
요구한다. T-006 이후 실제로 작성된 Review들은 이 이름을 그대로 쓰지 않았다.
**T-011은 Attempt heading의 판정만 읽으므로 영향이 없지만**, 자동 Reviewer에게
어떤 형식을 요구할지는 정해야 한다. 지금은 §4를 그대로 따르도록 지시한다.

## Notes — bootstrap 경계

**T-011은 `task execute` 로 구현되는 첫 Task다.**

```
node dist/cli.js task execute T-011 --worker codex --actor-id codex-cli
```

`task start` · `task run` · `npm test` · `task submit` 을 따로 입력하지 않는다.

**그러나 T-011의 Review와 approve는 마지막으로 수동이다.** `--review` 는 이 Task가
만드는 기능이므로 자기 자신에게 쓸 수 없다.

| Task | 실행 방식 |
|---|---|
| T-010 | `task execute` 이전 마지막 Task — 명령 4개 |
| **T-011** | **`task execute` 로 구현. Review·approve는 수동** |
| T-012 | Reviewer orchestration까지 dogfood 가능한 첫 후보 |
