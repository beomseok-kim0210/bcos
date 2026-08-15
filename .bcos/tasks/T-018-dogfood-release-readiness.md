---
protocol: "0.1"
id: T-018
title: Make the active documentation match the built CLI before external dogfooding
status: TODO
attempt: 0
created: 2026-08-14T13:40:00Z
updated: 2026-08-14T13:40:00Z
---

# T-018 — Dogfood Release Readiness

## Objective

**현재 구현과 살아 있는 문서를 일치시키고, 외부 실제 프로젝트에 BCOS를 시험 적용할 수
있음을 기능 추가 없이 검증한다.**

Core 18개 Task가 끝났지만 **문서는 T-001 시점에 멈춰 있다.** 실측 결과:

| 문서 | 실제와 어긋나는 것 |
|---|---|
| `README.md` | **이미 DONE인 T-013·T-014·T-016이 "Planned"에 있다.** 구현된 `task request-changes`도 미구현 목록에 있다 |
| `CLAUDE.md` | *"구현 착수 전"* · *"대기 Task: T-001 착수 승인됨"* · `Node 22+`(실제 `>=24`) |
| `AGENTS.md` | **존재하지 않는 `bcos task show`·`bcos task block`을 Worker에게 실행하라고 지시한다** |
| `docs/architecture.md` | **존재하지 않는 `src/core/`·`src/util/`** 를 현재 구조로 그린다. 다이어그램에 `bcos task show` |
| `docs/vision.md` | *"BCOS는 LLM을 직접 호출하지 않는다"* · *"자동 Codex 실행 불가 → v0.1 제외"* — T-008 이후 거짓 |
| `docs/v0.1-scope.md` | `bcos init`·`status`·`reindex`·`task create/list` 표 — **역사 문서인데 현재 명세로 읽힌다** |

**가장 위험한 것은 `AGENTS.md`다.** Worker가 막혔을 때 `bcos task block`을 실행하라고 하는데
**그 command는 존재하지 않는다.** 실제로 T-016이 막혔을 때 사람이 수동으로 전이해야 했다.

### 이 Task가 하지 않는 일 — 기능 추가

**문서가 없는 기능을 말하는 것을 발견해도, 그 기능을 만들지 않는다.**
문서를 사실에 맞추거나 Known Limitation으로 적는다. `bcos init`을 만들어
Quick Start를 매끄럽게 하려는 유혹이 이 Task의 가장 큰 실패 경로다.

### 조사 결과 — 외부 dogfooding은 이미 가능하다

**실측했다.** 임시 디렉터리에 target project를 손으로 만들고 현재 바이너리를
그 cwd에서 실행했다. 네트워크·모델 추론 없음.

```
mkdir -p .bcos/{tasks,reports,reviews,runs}
touch .bcos/events.jsonl
write .bcos/state.json          # protocol·counts·current_task
write AGENTS.md                 # worker 지침 (Codex가 자동으로 읽는다)
write .bcos/tasks/T-001-<slug>.md

node <bcos>/dist/cli.js task context T-001                    → exit 0, files 3
node <bcos>/dist/cli.js task start   T-001 --actor-role worker --actor-id codex-cli  → exit 0
node <bcos>/dist/cli.js task run     T-001 --worker codex --dry-run  → exit 0, stdin_bytes 1809
node <bcos>/dist/cli.js task status  T-001                    → exit 0
```

Context Package는 **target 프로젝트 파일만** 담았고 BCOS 저장소 파일이 섞이지 않았으며
절대경로·사용자명이 노출되지 않았다. `init`·`status`·`reindex`·`task show`·`task block`은
**전부 exit 1로 정직하게 실패한다.**

**따라서 "Dogfood Ready"는 억지 선언이 아니다.** 다만 **부트스트랩이 수동이라는 사실을
문서가 정확히 말해야 한다.**

## Scope

### 1. 문서별로 무엇을 고치는가

| 문서 | 조치 |
|---|---|
| `README.md` | Planned에서 **이미 구현된 것을 제거**하고 Current로 옮긴다. Planned에는 **진짜 미구현만** 남긴다 |
| `docs/README.ko.md` | 영문 README와 **같은 사실**을 말하게 한다 |
| `CLAUDE.md` | "현재 상태"를 실제 상태로. Node 버전 정정 |
| `AGENTS.md` | **존재하지 않는 command 제거.** 실제 자동 경로를 반영 |
| `docs/architecture.md` | **실제 8개 평면 모듈**로 교체. 다이어그램의 `task show` 정정 |
| `docs/vision.md` | 실행 능력 서술을 현재 사실로. **철학은 그대로 둔다** |
| `docs/v0.1-scope.md` | 상단에 **역사 문서 표시** 추가. 본문은 다시 쓰지 않는다 |

**`CONTRIBUTING.md`는 손대지 않는다.** 조사 결과 명백한 drift가 없었다 —
`docs/benchmarks/`를 언급하는데 그 디렉터리는 실재하고 15건이 들어 있다.
**고칠 것이 확인되지 않은 파일은 Write List에 넣지 않는다.**

### 2. Current capability와 Planned를 섞지 않는다

**이것이 이 Task의 핵심 불변조건이다.**

**Current (실측 — 8개 subcommand)**

```
bcos task start · submit · approve · request-changes · context · run · execute · status
bcos --version · --help
```

**Known Missing (실측 — cli.ts에 문자열조차 0건)**

```
bcos init · bcos status(project-global) · bcos reindex
bcos task create · list · show · block · unblock
Role-based Task Templates · Worktree parallelism
controlled benchmark result · canonical benchmark case 정의
common external evaluation gate · 신뢰할 수 있는 직접 token 측정
```

**이미 구현되어 Planned에서 빠져야 하는 것** — Model adapter(T-013) ·
telemetry persistence(T-016) · verification failure feedback(T-014) ·
`task request-changes`(구현됨).

### 3. 역할 정책과 능력을 분리한다

| | 내용 |
|---|---|
| **기본 운영 정책** | Claude = Manager · Architect · Reviewer / **Codex = Worker** |
| **선택 가능한 능력** | T-015 이후 `--worker claude`도 받는다 |

**"Claude Worker가 기본"이라고 쓰지 않는다.**
동시에 **"BCOS는 Claude Worker를 지원하지 않는다"고도 쓰지 않는다** — 거짓이다.

**한 세션이 자기 구현을 자기가 승인하지 않는다**는 규칙은 그대로 유지한다(G5).

### 4. Benchmark 문구 — 넘지 말아야 할 선

T-016은 **측정 하네스**다. 결과가 아니다.

**금지** — `BCOS is faster` · `cheaper` · `more efficient` · `beats single-agent`,
그리고 이에 준하는 한국어 표현.

**허용** — *"BCOS는 이제 비교 가능한 증거를 기록할 수 있다."*

### 5. Version — 올리지 않는다

`package.json` **0.1.0 유지** · Protocol **0.1 Experimental 유지**.
0.2/0.5/1.0 bump 금지, tag 금지, GitHub Release 금지.

이번 결과는 **`Core Complete / Dogfood Ready`** 이지 `Stable` 도 `Proven` 도 아니다.

### 6. v0.1-scope는 역사다 — 다시 쓰지 않는다

이 문서는 초기 설계 계획으로 **역사적 가치가 있다.**
`bcos init` 표를 현재 사실에 맞추려고 **과거 계획을 삭제하지 않는다.**

**상단에 구분만 추가한다** — 역사적 계획 문서이며 현재 CLI reference가 아니고,
실제 표면은 README와 `--help`를 보라는 정도. **본문 재작성 금지.**

### 7. Quick Start — 새 파일을 만들지 않는다

`bcos init`이 없으므로 **문서가 `bcos init`을 실행하라고 하면 그 문서는 틀렸다.**

README에 **이미 있는** 부트스트랩 문단(현재도 *"There is no `bcos init` yet"*라고
정직하게 적혀 있다)을 **외부 프로젝트 기준으로 고친다.**

**새 `QUICKSTART.md`를 만들지 않는다.** 기존 섹션을 고쳐 해결한다.

## Out of Scope

**코드**
- production source 수정 · tests 수정 · `package.json`·lockfile 수정
- 새 CLI command — `bcos init` · `block`/`unblock` · `create`/`list`/`show` **전부**
- `workflow.ts` refactor (340/340은 Known Limitation으로 적을 뿐 고치지 않는다)

**규범**
- RFC-001 수정 · 새 ADR 작성 · Report protocol 수정

**릴리스**
- version bump · release tag · GitHub Release

**벤치마크·후속**
- T-017 생성 · 실제 비교 실행 · 효율성 주장
- Case Registry · Common Evaluation Gate 구현
- Role Template · Worktree · Digital Docent 기능 구현

## Acceptance Criteria

**A. 문서가 사실과 일치한다**

1. `README.md`·`AGENTS.md`가 지시하는 모든 `bcos` command가 **실제 CLI에 존재한다.**
2. `AGENTS.md`에 `task show` · `task block`이 **0건**이다.
3. `docs/architecture.md` 다이어그램에 `task show`가 **0건**이다.
4. `README.md` Planned에서 **T-013 model adapter · T-014 verification feedback ·
   T-016 telemetry persistence · `task request-changes`가 제거**된다.
5. Planned에 남은 항목은 **실제로 `src/cli.ts`에 없는 것뿐**이다.
6. `docs/README.ko.md`가 영문 README와 **모순되지 않는다** (command 표면·미구현 목록).

**B. 역할 정책**

7. 기본 정책이 **Claude Manager/Reviewer + Codex Worker**로 적혀 있다.
8. `--worker claude`가 **선택 가능한 능력**으로 적혀 있고, 기본이라고 쓰지 않는다.
9. *"Claude는 Worker가 될 수 없다"* 류의 **능력 부정 문장이 0건**이다.
10. 자기 구현·자기 승인 금지(G5)가 유지된다.

**C. 아키텍처**

11. `docs/architecture.md`의 `src/` 목록이 **실제 8개 평면 모듈**과 일치한다
    (`benchmark` · `cli` · `context` · `model` · `reviewer` · `run` · `runner` · `workflow`).
12. `src/core/` · `src/util/` 언급이 **0건**이다.
13. Task/Report/Review/Run/Benchmark artifact의 **소유자 구분**이 남아 있다.
14. **Run 상태와 Task lifecycle 상태를 구분**해 서술한다.
15. T-016이 **measurement harness**이며 trial을 쓰지 않는다는 경계가 반영된다.

**D. 역사 보존**

16. `docs/v0.1-scope.md` **상단에 역사 문서 표시**가 있고 현재 CLI reference가 아님을 밝힌다.
17. `docs/v0.1-scope.md` 본문의 과거 계획이 **삭제·재작성되지 않는다**
    (상단 표시 외 diff가 실질적으로 없다).

**E. 릴리스 주장**

18. `package.json` version이 **`0.1.0` 그대로**다.
19. Protocol **`0.1` Experimental** 표기가 유지된다.
20. `stable` · `1.0` · production-ready 선언이 **0건**이다.
21. **효율성 우위 주장이 0건**이다 (`faster` · `cheaper` · `more efficient` ·
    `beats` 및 이에 준하는 한국어 표현).

**F. 외부 dogfooding**

22. 문서화된 수동 부트스트랩 절차가 **BCOS 저장소 밖 임시 프로젝트에서 재현된다** —
    `task context` · `task start` · `task run --dry-run` · `task status` 전부 exit 0.
23. 그 절차가 `bcos init` · `task show` · `task block` 등 **없는 command에 의존하지 않는다.**
24. smoke에 **모델 추론·네트워크 호출이 없다.**
25. smoke fixture가 **BCOS 저장소에 남지 않는다** (실행 후 working tree가 `?? x` 뿐).

**G. Known Limitations**

26. 살아 있는 문서 **한 곳 이상**에서 다음을 확인할 수 있다 —
    block/unblock CLI 부재 · `create`/`list`/`show`/`init` 부재 ·
    `actor_id` 자기 신고 · token 값 `unavailable` 가능 ·
    T-016은 harness이며 controlled result 없음 · canonical case/evaluation gate 미정 ·
    same-attempt Report append semantics gap.
27. `workflow.ts` 340/340은 **maintenance note 또는 Report Known Risk**에 둔다 —
    사용자 대상 핵심 limitation 목록을 이것으로 채우지 않는다.

**H. 회귀**

28. `src/` diff **0줄** · `tests/` diff **0줄** · `package.json`·lockfile diff **0줄**.
29. 의존성 변경 **0건** · 새 CLI command **0건**.
30. `npm run build` exit 0 · `npm test` **289/289 pass · 0 fail · 0 skipped**.
31. 새 문서 파일 **0개** (기존 파일 수정으로 해결한다).

## Expected Files

**수정**

- `README.md` — Planned/Current 정정, 외부 부트스트랩 절차, Known Limitations
- `docs/README.ko.md` — 영문과 동일 사실
- `CLAUDE.md` — 현재 상태, Node 버전, 역할 정책
- `AGENTS.md` — **없는 command 제거**, 실제 자동 경로
- `docs/architecture.md` — 실제 모듈 목록, 다이어그램 정정
- `docs/vision.md` — 실행 능력 서술 정정 (철학·로드맵은 유지)
- `docs/v0.1-scope.md` — **상단 역사 표시만.** 본문 재작성 금지

**생성**

- `.bcos/reports/T-018-dogfood-release-readiness.md`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-018-dogfood-release-readiness.md` (이 파일)
- `README.md`
- `docs/README.ko.md`
- `CLAUDE.md`
- `docs/architecture.md`
- `docs/vision.md`
- `docs/v0.1-scope.md`
- `src/cli.ts` — **읽기 전용.** 실제 command 표면 근거
- `package.json` — **읽기 전용.** version·engines 근거

**쓰기**

위 "수정"·"생성" 목록뿐이다. **`src/`·`tests/`·`docs/rfcs/`·`docs/decisions/`는 쓰지 않는다.**

**drift가 없다고 확인된 파일은 고치지 않는다.** Write List에 있다는 이유로
문장을 바꾸지 않는다.

## Test Requirements

**이 Task에는 `node:test` 신규 테스트가 없다.** 문서 Task이며 `tests/` diff는 0이어야 한다(AC 28).
검증은 아래 절차를 Report에 **실행 명령과 출력**으로 남기는 방식으로 한다.

**T1. 회귀**
- `npm run build` exit 0
- `npm test` → 289 / 289 / 0 / 0
- **단독 실행한다.** 다른 스크립트를 동시에 돌리지 않는다 — 동시 실행이 실제로
  무관한 테스트 2건을 실패시킨 적이 있다

**T2. 실제 command 표면 대조**
- `bcos --help` 출력을 캡처해 문서의 command 목록과 대조

**T3. 없는 command 검색**
- 수정 대상 문서에서 `bcos init` · `bcos reindex` · `task create|list|show|block|unblock` ·
  project-global `bcos status` 검색
- **`v0.1-scope.md`는 역사 문서이므로 제외** — 대신 상단 표시 존재를 확인

**T4. stale 주장 검색 — grep 하나로 PASS하지 않는다**
- `구현 착수 전` · `T-001 대기/착수 승인됨` · `Node 22` ·
  `telemetry ... Planned` · `verification failure ... Planned` · `Codex only`
- **각 hit의 문맥을 직접 읽고** 실제 stale인지 판단한다

**T5. 모듈 목록 대조**
- `ls src/*.ts` 실제 결과와 `docs/architecture.md` 목록을 비교
- `src/core/` · `src/util/` 0건 확인

**T6. version 불변**
- `package.json` version `0.1.0` · `git diff -- package.json` 0줄

**T7. 외부 dogfood smoke (필수)**
- **임시 디렉터리**에 target project를 만들고 현재 바이너리를 그 cwd에서 실행
- `task context` · `task start` · `task run --dry-run` · `task status` 전부 exit 0
- Context Package에 **BCOS 저장소 파일이 섞이지 않음**, 절대경로·사용자명 **0건**
- 없는 command 5종이 **exit 1**
- **모델 추론·네트워크 호출 없음**
- 실행 후 **BCOS working tree가 `?? x` 뿐**

**T8. 회귀 diff**
- `git diff --stat -- src/ tests/ package.json package-lock.json` → **빈 출력**
- `x` 미변경

## Notes

**이 Task의 가장 큰 실패 경로는 "고치는 김에 만드는 것"이다.**
`bcos init`이 없어서 Quick Start가 어색하다는 이유로 그것을 구현하면 이 Task는 실패다.
**없는 것은 없다고 적는다.**

**`AGENTS.md`가 실제 사고를 낸 문서다.** T-016 attempt 1이 막혔을 때
Worker에게 `bcos task block`을 실행하라고 적혀 있었지만 그 command가 없어서
사람이 수동으로 전이해야 했다. **문서와 코드의 불일치가 운영 사고로 이어진 실측 사례다.**

**Worker session은 lifecycle을 소유하지 않는다.** 현재 자동 경로는
`Manager/Human → task execute → Worker session → Report → Host Verification → submit`이다.
Worker가 `start`/`submit`을 직접 부르는 옛 서술은 수동 부트스트랩 시대의 것이다.
**외부 프로젝트에서는 수동 경로도 여전히 유효하므로**(smoke에서 `task start`를 직접 썼다)
두 경로를 구분해 적되, **없는 command를 섞지 않는다.**

**남는 Known Product Gap — 이 Task에서 해결하지 않는다.**

1. **`block`/`unblock` CLI 부재** — RFC-001 §1.2에 전이는 있으나 command가 없다.
2. **same-attempt Report append semantics** — RFC-001 §3은 attempt당 항목 하나를 전제한다.
3. **`workflow.ts` 340/340** — 여유가 없다. 다음에 이 파일을 건드리면 상한을 넘는다.

**효율성은 아직 미검증이다.** T-016은 자를 만들었을 뿐 재지 않았다.
token은 세 arm 모두 `unavailable`이고 공통 평가 게이트도 미정이다.
**이 Task에서 우위를 주장하는 문장을 한 줄도 쓰지 않는다.**
