# BCOS — Architecture

> **데이터 모델·상태·스키마의 규범은 [RFC-001 Core](rfcs/RFC-001-task-protocol.md)다.**
> 이 문서는 그것을 중복 서술하지 않는다. 저장소 배치와 실행 환경 제약만 다룬다.
> 둘이 어긋나면 **RFC-001이 이긴다.**

---

## 1. 계층

```
Human
  │  제품 의도 / 최종 승인
  ▼
manager  ─── Task 명세 ──▶ .bcos/tasks/<id>-<slug>.md
  │                              │
  │                              │ bcos task context
  │                              ▼
  │                           worker ◀── Context Package
  │                              │
  │                              ├──▶ 코드 (src/, tests/)
  │                              └──▶ .bcos/reports/<id>-<slug>.md
  │                              │
  │  ◀──────── submit ───────────┘   (IN_PROGRESS → IMPLEMENTED)
  ▼
reviewer ──▶ .bcos/reviews/<id>-<slug>.md
  │
  ├─ approve          → DONE
  └─ request-changes  → IN_PROGRESS
```

**제출한 `actor_id`는 승인할 수 없다** (RFC-001 §1.3 G5).
이 직무 분리가 자기검증 편향을 제거하는 유일한 장치다.

BCOS 구현체는 이 화살표를 **강제하는 도구**다. 스스로 판단하지 않는다.

### Worker는 역할이 아니라 세션이다

`worker` 상자는 특정 에이전트 인스턴스가 아니다.
**같은 실행기의 새 세션**이며, 무엇을 하는 세션인지는 전달받은 Task가 결정한다.

```
Task Role → Context Package → Worker Session → Implementation Report
```

한 세션은 하나의 역할, 하나의 Task만 수행한다.
Backend Worker와 Test Worker는 **같은 Codex CLI의 서로 다른 세션**일 수 있다.
장기 기억은 세션이 아니라 이 저장소가 보유하므로 세션은 언제든 버려도 된다.

근거와 ClawDev 대조는 [ADR-003](decisions/ADR-003-task-centric-workers.md).

## 2. 저장소 구조

```
bcos/
├── CLAUDE.md                 # manager 세션 진입점 (인덱스)
├── AGENTS.md                 # worker 행동 규칙
├── .gitattributes
├── .gitignore
├── docs/
│   ├── vision.md
│   ├── architecture.md       # 이 문서
│   ├── v0.1-scope.md
│   ├── rfcs/
│   │   ├── RFC-001-task-protocol.md            # 규범
│   │   └── RFC-001-task-protocol-appendix.md   # 비규범
│   └── decisions/
│       ├── ADR-001-language.md
│       └── ADR-002-storage.md
├── .bcos/
│   ├── state.json            # 파생 인덱스 (재생성 가능)
│   ├── events.jsonl          # append-only 감사 로그
│   ├── tasks/                # 진실 원천 — manager 소유
│   ├── reports/              # worker 소유
│   ├── reviews/              # reviewer 소유
│   ├── amendments/           # 동결된 Task 명세의 정정 — human 소유
│   ├── runs/                 # workflow 실행 관찰 기록
│   └── benchmarks/           # 비교 측정 아티팩트 — benchmark 담당 소유
├── src/                      # 구현 (worker가 작성)
└── tests/
```

**미래용 디렉터리나 인터페이스를 미리 만들지 않는다.** 위 목록이 전부다.

## 3. 저장 원칙

> **`.bcos/tasks/*.md`가 유일한 진실 원천이다.**
> `events.jsonl`은 append-only 감사 로그, `state.json`은 재생성 가능한 파생 인덱스다.
> 셋이 어긋나면 **항상 `tasks/*.md`가 이긴다.**

근거는 [ADR-002](decisions/ADR-002-storage.md). 스키마는 [RFC-001 §2–5](rfcs/RFC-001-task-protocol.md).

| 파일 | Git 머지 |
|---|---|
| `tasks/`, `reports/`, `reviews/`, `runs/`, `benchmarks/` | 소유자가 구분된 아티팩트. 충돌 시 수동 해결 |
| `events.jsonl` | `merge=union`. 라인 단위라 안전 |
| `state.json` | 충돌 시 폐기 후 재생성 |

## 4. 실행 환경 제약 (Windows 우선)

| 제약 | 대응 |
|---|---|
| PowerShell 5.1은 `&&` 미지원 | 문서 예시를 체이닝 없이 한 줄씩 |
| CRLF/LF 혼선 | `.gitattributes`에 `* text=auto eol=lf` |
| 파일명 금지 문자 | `<id>-<slug>` 형태 고정 |
| 경로 260자 제한 | Worktree를 v0.1에서 제외해 회피 |
| 쓰기 중 중단 | temp write → rename (원자적) |
| 경로 구분자 | 항상 `path.join`. 하드코딩 금지 |
| 인코딩 | 읽기·쓰기 모두 `utf8` 명시 |

## 5. 모듈 경계

8개 엔진(State/Task/Memory/Review/Event/Runtime/Git/Adapter)으로 **분리하지 않는다.**
구현체가 하나뿐인 계층을 미리 만드는 것은 과설계다.

```
src/
├── benchmark.ts    # 비교 측정 아티팩트 기록
├── cli.ts          # 명령 파싱 + lifecycle 라우팅
├── context.ts      # 결정론적 Context Package 조립
├── model.ts        # 모델 CLI 탐색·실행·관측 경계
├── reviewer.ts     # reviewer 입력·판정 처리
├── run.ts          # workflow 실행 기록과 조회
├── runner.ts       # worker 프로세스 실행
└── workflow.ts     # host 검증·제출·review/rework orchestration
```

**분리는 두 번째 사용처가 생길 때 한다.**

Task lifecycle 상태(`TODO`부터 `DONE`까지)는 Task와 event가 소유한다. Run의
`running`·`completed`·`failed`는 한 workflow 실행의 관찰 결과일 뿐이며 Task 상태를
대체하거나 복구하지 않는다. 따라서 Task가 `IMPLEMENTED`이면서 마지막 Run이 `failed`인
상태도 모순이 아니다.

T-016 benchmark 기능은 세 arm의 비교 가능한 증거를 기록하는 measurement harness다.
controlled trial 결과가 아니며, canonical case와 공통 evaluation gate가 정해지기 전에는
우위를 주장하지 않는다.
