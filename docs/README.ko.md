# BCOS — 한국어 안내

**AI 코딩 에이전트를 위한 Task 중심 · Git 기반 운영 계층.**

> **상태: Experimental.** Task 프로토콜 `0.1`과 CLI 프로토타입 단계다.
> `0.x`는 호환성을 약속하지 않는다.

영문 문서가 공식 진입점이다 — [README.md](../README.md)

---

## 무엇인가

여러 AI 개발 에이전트가 **동일한 프로젝트 상태와 기억을 공유**하도록 만드는 운영 계층이다.

프로젝트의 상태·결정·작업 큐·리뷰는 대화 세션이 아니라 **Git 저장소가 소유한다.**

> AI가 프로젝트를 기억하는 것이 아니라, 프로젝트가 AI를 기억한다.

## 왜 만들었는가

AI 코딩 에이전트는 코드는 잘 쓰지만 프로젝트를 기억하지 못한다. 반복해서 부딪힌 문제가 다섯이다.

- **세션이 끝나면 맥락이 사라진다.** 창을 닫으면 매번 처음부터 다시 설명한다.
- **에이전트 간 공유 진실 원천이 없다.** 한쪽이 아는 것을 다른 쪽이 모른다.
- **자기검증 편향.** 구현한 주체가 스스로 "완료"를 선언한다.
- **컨텍스트 비용.** 작업 하나마다 저장소 전체를 다시 읽는다.
- **진행 상태가 암묵적이다.** 무엇이 끝났는지가 대화 스크롤에만 있어 감사·복구·인수인계가 불가능하다.

## Claude Code와 Codex CLI의 역할

역할은 에이전트가 아니라 **Task가 가진다.**

```
Human
  └─▶ Claude Code — Manager / Architect / Reviewer
        └─▶ Task Contract        (범위, 읽기 목록, 완료 기준)
              └─▶ Codex CLI — Worker
                    └─▶ Implementation Report
                          └─▶ 독립 Review        (다른 actor_id)
                                └─▶ Human 승인
                                      └─▶ Git 이력
```

- **Claude Code** — 아키텍처, Task 명세, 리뷰, 메모리. 구현 코드는 쓰지 않는다.
- **Codex CLI** — 구현과 테스트, Report 작성. `IMPLEMENTED`까지가 한계다.
- **승인은 제출자가 할 수 없다.** `actor_id`가 다른 주체만 `DONE`으로 올릴 수 있다.

Worker 세션은 하나의 역할, 하나의 Task만 맡는다. 같은 실행기가 다음 세션에서는 다른 역할이 된다 —
무엇을 하는 세션인지는 전달받은 Task가 정한다. 장기 기억은 저장소에 있으므로 세션은 소모품이다.

## ClawDev와의 차이

ClawDev는 역할별로 별도 API Agent를 두었던 이전 실험이다. 동작은 했지만 **역할을 늘리는 비용이
Agent 인스턴스 하나와 API 비용**이었다. BCOS는 역할 분리는 유지하고 그 결합만 끊었다.

| | ClawDev | BCOS |
|---|---|---|
| 구조 | Agent 중심 | **Task 중심** |
| 역할의 소재 | Agent 인스턴스 | **Task Contract** |
| 역할 추가 비용 | 새 Agent + 프롬프트 + API 비용 | **문서 한 장** |
| 상태 보관 | Agent 대화 이력 | **Git 아티팩트** |
| 방향 | Agent → Task | **Task → Worker** |

ClawDev의 역할 분리 경험은 폐기하지 않고 Worker Task Template으로 흡수한다.
근거: [ADR-003](decisions/ADR-003-task-centric-workers.md)

## 현재 구현 상태

**구현됨**

- Task 프로토콜 `0.1` — 상태·전이·가드·아티팩트 스키마
- Git 추적 Task / Report / Review, 소유자 분리
- Append-only 이벤트 로그와 재생성 가능한 state 인덱스
- `actor_id` 기반 직무 분리 — 제출자는 승인할 수 없다
- CLI 스캐폴드 — `--version`, `--help`, 알 수 없는 인자 실패 경로

**미구현 (아직 동작하지 않음)**

`bcos init` · `status` · `reindex` · `task create/list/show` · `task start/submit/approve` ·
Context Package 생성 · Worker Task Template · Worktree 병렬 실행 · 벤더 중립 어댑터

**CLI가 나오기 전까지 프로토콜 전이는 사람이 손으로 수행한다.**

## 검증된 수치

Task 두 건이 전체 프로토콜 사이클을 통과했다. **기준선이지 개선 실적이 아니다.**

| | T-001 (스캐폴드) | T-002 (유지보수) |
|---|---:|---:|
| Acceptance Criteria | 9/9 | 11/11 |
| 테스트 | 3/3 | 3/3 |
| 범위 이탈 | 0 | 0 |
| Ponytail 위반 | 0 | 0 |
| 런타임 의존성 | 0 | 0 |
| 제품 변경 줄 수 | 87 | 2 |
| 재작업 | 0 | 0 |

**읽는 방법**

- 두 Task는 성격이 다르다. 하나는 프로젝트 생성, 하나는 2줄 수정이다. 직접 비교는 무의미하다.
- **비교군이 없다.** 어떤 차원에서도 개선율을 주장하지 않는다.
- `읽은 파일 수`는 **Worker 자기보고**이며 감사 로그가 없다. 기록은 하되 검증된 값으로 보지 않는다.

상세: [T-001](benchmarks/T-001-project-scaffold.md) · [T-002](benchmarks/T-002-align-node-version.md)

## 로드맵

핵심 CLI 명령 → 자동 lifecycle 전이 → Context Package 생성 →
역할별 Worker Task Template → Worktree 격리 병렬 Worker → 벤더 중립 어댑터

각 단계의 착수 조건: [docs/vision.md](vision.md)

## Quick Start

**Node.js 24 이상** 필요. 런타임 의존성 0.

```bash
npm install
```
```bash
npm run build
```
```bash
npm test
```
```bash
node dist/cli.js --version
```

미구현 목록의 `bcos` 명령은 아직 존재하지 않는다.

## 더 읽을 것

| 문서 | 내용 |
|---|---|
| [RFC-001 Core](rfcs/RFC-001-task-protocol.md) | **규범.** Task·Report·Review·Event 규격 |
| [RFC-001 Appendix](rfcs/RFC-001-task-protocol-appendix.md) | 비규범 — 설계 근거, 엣지 케이스 |
| [Vision](vision.md) | 문제 정의, 원칙, 로드맵 |
| [Architecture](architecture.md) | 저장소 배치, 실행 환경 제약 |
| [ADR-001](decisions/ADR-001-language.md) · [ADR-002](decisions/ADR-002-storage.md) · [ADR-003](decisions/ADR-003-task-centric-workers.md) | 언어 · 저장 구조 · Worker 모델 결정 |
| [Git Convention](git-convention.md) | 커밋 규약 |
