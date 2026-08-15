# BCOS — Vision

> **AI가 프로젝트를 기억하는 것이 아니라, 프로젝트가 AI를 기억한다.**

BCOS(Bible Coding Operating System)는 Claude Code, Codex CLI 등 서로 다른 AI 개발 에이전트를
하나의 프로젝트 운영 체계 아래에서 협업시키기 위한 오픈소스 프로젝트다.

프로젝트의 상태, 아키텍처, 의사결정, 작업 큐, 리뷰, 장기 메모리는
**대화 세션이 아니라 Git 저장소가 소유한다.**

---

## 1. 해결하려는 문제

| # | 문제 | 증상 |
|---|---|---|
| P1 | 기억이 세션에 묶여 있다 | 대화창을 닫으면 맥락이 소멸한다. 매번 재설명한다 |
| P2 | 에이전트 간 공유 진실 원천이 없다 | Claude가 아는 것을 Codex가 모른다 |
| P3 | 자기검증 편향 | 구현한 주체가 스스로 "완료"를 선언한다 |
| P4 | 컨텍스트 비용 폭증 | 작업 하나에 저장소 전체를 읽는다 |
| P5 | 진행 상태가 암묵적 | 감사·복구·인수인계가 불가능하다 |

이 다섯은 독립된 문제가 아니다. P1이 P2를 낳고, P2가 P4를 낳는다.
P3은 설계·구현·리뷰가 한 세션에 뒤섞이기 때문에 발생한다.

## 2. 핵심 원칙

1. **Project Owns Memory** — 저장소가 기억의 주인이다. 대화는 휘발성 버퍼일 뿐이다.
2. **Agents Are Stateless** — 에이전트는 언제든 죽이고 교체 가능한 Worker다.
3. **One Artifact, One Owner** — 아티팩트마다 소유자는 한 명이다. 겸직하지 않는다.
4. **Architecture Before Implementation** — 경계 검증이 코드보다 앞선다.
5. **Small Context by Default** — 현재 역할에 필요한 최소한만 읽는다.
6. **Human-Controlled Autonomy** — 방향, 위험, 릴리스는 사람이 결정한다.

## 3. 역할 경계

| 구분 | 소유 | 결정 | 산출물 | 금지 |
|---|---|---|---|---|
| **Human** | 제품 의도, 우선순위, 예산 | 무엇을 왜 만드는가, 릴리스 여부 | Vision, 승인/거부 | Task 명세를 우회한 직접 구현 지시 |
| **Claude** | 아키텍처, 결정, Task 명세, 리뷰 판정, 메모리 | 어떻게 나눌 것인가, 합격인가 | `docs/`, `.bcos/tasks/`, `.bcos/reviews/` | 대규모 구현, 자기 리뷰, 승인 없는 아키텍처 변경 |
| **Codex** | 구현 코드, 테스트, Report | Task 범위 안의 구현 방법만 | 코드 diff, `.bcos/reports/` | 아키텍처 재설계, 범위 밖 리팩터링, **자신의 작업을 승인(approve)** |
| **BCOS Runtime** | 상태, 이벤트, 컨텍스트 패키징, 실행 연결 | lifecycle·제품 판단을 하지 않는다 | `state.json`, `events.jsonl`, run 기록 | 내용 판단, 독립 판정 없는 승인 |

> **BCOS Runtime에는 지능이 없어야 한다.**
> 판단이 들어가는 순간 그것은 "또 하나의 에이전트"가 되고 P2를 다시 만든다.

### 구현자와 승인자의 분리

이 경계는 규범이 아니라 **도구가 강제한다.**

```
worker   ──▶ IMPLEMENTED 까지만 (submit)
reviewer ──▶ DONE 으로 승격 (approve)
```

**제출한 `actor_id`는 승인할 수 없다.** 역할이 아니라 실제 주체를 비교한다 —
같은 사람이 두 역할을 겸해도 자기 구현은 승인하지 못한다.
구현한 주체가 완료를 선언할 수 있으면 BCOS의 가치는 0이다.

## 4. 실행 모델

BCOS는 모델의 추론을 구현하지 않지만, 설치된 Codex 또는 Claude CLI 프로세스를
선택적으로 실행해 Context Package를 stdin으로 전달할 수 있다. 기본 운영 정책은
Claude Manager/Reviewer와 Codex Worker이며, `--worker claude`는 선택 가능한 능력이다.
workflow는 host 검증과 독립 review 판정을 연결하지만 제품 방향이나 리뷰 내용을 대신
판단하지 않는다.

Daemon과 병렬 Worker Pool은 없고, 새 프로젝트 부트스트랩도 수동이다. 임베딩 기반
메모리 검색 대신 저장소의 명시적 아티팩트와 작은 Read List를 사용한다. 따라서 v0.1의
핵심은 자동 실행 여부가 아니라 저장소가 기억과 역할 경계를 소유하게 하는 규율이다.

## 5. 성공의 정의

v0.1이 성공했다는 것은 다음이 참이라는 뜻이다.

- Claude가 쓴 Task 명세 하나만으로 Codex가 이탈 없이 구현했고, Claude Reviewer가 별도로 승인했다.
- Codex가 읽은 파일 수가 저장소 전체가 아니라 Task에 명시된 목록에 가깝다.
- 세션을 모두 닫고 다음 날 다시 열어도 저장소의 Task·Run 아티팩트로 맥락이 복원된다.
- 무엇이 왜 그렇게 결정됐는지가 Git 이력에 남아 있다.

**측정 지표:** Task당 Codex가 읽은 파일 수. 이것을 재지 않으면 "컨텍스트 절감"은 구호에 그친다.

## 6. 로드맵

**역할은 Agent가 아니라 Task가 가진다** ([ADR-003](decisions/ADR-003-task-centric-workers.md)).
같은 실행기를 새 세션마다 다른 Task Contract로 실행해 역할별 Worker로 쓴다.
따라서 로드맵의 각 단계는 "Agent를 늘리는 것"이 아니라 **"Task 계약을 다듬는 것"** 이다.

| 버전 | Worker 운용 | 함께 들어오는 것 |
|---|---|---|
| **v0.1** | **Sequential Single Worker** — `IN_PROGRESS` 1개, 세션 1개, 수동 전달 | 명세 확정 + 최소 CLI |
| **v0.2** | **Role-based Task Templates** — backend·frontend·test·refactor·migration·docs·ai-ml | Review Loop 복원, Report 정형화 |
| **v0.3** | **Multiple Sequential Workers** — 역할별 세션을 순차 실행 | 세션 간 Artifact 전달 |
| **v0.5** | **Parallel Worker Pool** — Worktree 격리, Lock, 충돌 감지 | 결과 통합, Review Gate |
| **v1.0** | **Vendor-neutral Runtime** — 실행기 교체 가능 | Migration 안정화 |

**단계별 제약**

- **v0.2 Template**은 강제 아키텍처가 아니라 Task 작성 보조다.
  Role / Read Scope / Write Scope / Test Requirements / Review Checklist / Common Out of Scope의
  **기본값만** 제공한다. **실제 사용 사례가 없는 Template은 미리 만들지 않는다.**
- **v0.3**에서 세션 간 기억은 공유하지 않는다. **Artifact만 공유한다.**
- **v0.5**는 실제 병렬 필요성이 검증된 뒤에만 도입한다.
  **동일 작업 폴더에서 여러 세션이 동시에 파일을 수정하는 방식은 금지한다.**
- **v1.0**에서 Task Protocol은 실행기와 독립적으로 유지한다 —
  Backend Task는 Codex CLI, Research Task는 Gemini CLI, Review Task는 Claude Code처럼
  **Task가 실행기를 고르지, 실행기가 역할을 고르지 않는다.**

## 7. 원본 설계 문서

Notion의 아키텍처 문서가 이 저장소의 상위 근거다.

- [BCOS — Bible Coding Operating System](https://app.notion.com/p/3b18c965179881b79fe3c1b2e4510215)
- 01. Claude Management Layer / 02. Codex Worker Pool / 03. Control Plane & Runtime
- 04. Project Memory Architecture / 05. Review & Feedback Loop
- 06. Event-driven Task Lifecycle / 07. End-to-End Operating Flow

이 저장소의 `docs/`가 구현 기준이며, Notion과 어긋날 경우 **저장소가 이긴다.**
