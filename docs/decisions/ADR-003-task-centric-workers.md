# ADR-003 — Task-Centric Worker Architecture

- **상태:** Accepted
- **날짜:** 2026-08-04
- **관련:** [RFC-001](../rfcs/RFC-001-task-protocol.md), [vision.md](../vision.md) §6 로드맵

---

## 맥락

이전 프로젝트 **ClawDev**는 Agent-Centric이었다.
Architect·Backend·Frontend·Reviewer를 각각 별도 API Agent로 만들고,
Agent마다 시스템 프롬프트와 대화 상태를 보유했으며, Orchestrator가 Agent 실행을 관리했다.

이 구조의 비용은 두 가지였다.

1. **역할이 Agent 인스턴스에 귀속된다.** 역할을 바꾸려면 Agent를 다시 만들어야 한다.
2. **역할 수만큼 API 비용이 발생한다.** 역할 분리가 곧 지출 증가였다.

BCOS는 기존 구독(Codex CLI, Claude Code)으로 운영하며 추가 API 키를 쓰지 않는다.
따라서 "역할마다 Agent를 띄운다"는 접근을 그대로 가져올 수 없다.

## 결정

**역할은 Agent가 아니라 Task가 가진다.**

동일한 Codex CLI 실행기를 **새 세션마다 다른 Task Contract로 실행**하여 역할별 Worker로 쓴다.

```
Task Role → Context Package → Codex CLI Session → Implementation Report
```

각 Worker는 다음을 가진 **독립적인 세션**이다.

- 같은 실행기, 같은 구독 계정
- 역할별 Task와 Context Package
- 역할별 Read List / Write List
- 역할별 Out of Scope와 Acceptance Criteria
- 작업 후 별도의 Implementation Report

**한 세션이 여러 역할을 동시에 맡는다는 뜻이 아니다.**
한 세션은 하나의 역할, 하나의 Task만 수행한다.

장기 기억은 세션이 아니라 **저장소가 보유한다.** 세션은 언제든 버릴 수 있다.

## 대조

| | ClawDev (Agent-Centric) | BCOS (Task-Centric) |
|---|---|---|
| 역할의 소재 | Agent 인스턴스 | **Task Template과 Context Package** |
| 역할 추가 비용 | 새 Agent + 시스템 프롬프트 + API 비용 | **새 Task 문서 한 장** |
| 상태 보관 | Agent의 대화 이력 | **Git 저장소와 `.bcos/`** |
| Orchestrator 책임 | Agent 실행과 대화 관리 | **Task·Artifact·State 관리** |
| 세션 교체 | 상태 손실 | **무해. 세션은 소모품** |
| 비용 모델 | 역할 수에 비례 | **구독 정액** |
| 방향 | Agent → Task | **Task → Worker** |

**ClawDev의 역할 분리 경험은 폐기하지 않는다.**
Backend·Frontend·AI·QA·Review 역할 설계는 v0.2의 **Worker Task Template**으로 흡수한다.
버리는 것은 "역할 = Agent 인스턴스"라는 결합이지, 역할 구분 자체가 아니다.

## 설계 원칙

1. 역할은 Agent가 아니라 Task가 가진다.
2. Worker는 한 세션에 하나의 역할과 하나의 Task만 수행한다.
3. 역할별 Worker는 **동일한 실행기의 별도 세션**일 수 있다.
4. 장기 기억을 Worker 세션에 저장하지 않는다.
5. Worker 간 직접 대화 대신 **Task·Report·Review Artifact로 협업**한다.
6. v0.1에서는 병렬화를 구현하지 않는다.
7. **실제 사용 사례 없이 Worker Template·Adapter·Worktree 자동화를 만들지 않는다.**
8. Claude Code는 PM·Architect·Reviewer이며 **worker 역할을 맡지 않는다.**

> 8번은 프로토콜이 아니라 **이 저장소의 정책**이다.
> RFC-001은 `actor_id`만 다르면 누구든 어떤 역할이든 맡을 수 있게 허용한다.
> 그보다 강한 제약을 두는 이유는, 설계자가 구현까지 하면 리뷰의 독립성이
> `actor_id` 문자열 하나에만 의존하게 되기 때문이다.

## 결과

**긍정**
- 역할을 늘리는 비용이 문서 한 장이다. 실험이 싸진다.
- 세션이 죽어도 잃는 것이 없다. 저장소가 상태를 갖는다.
- 실행기를 바꿔도 Task Protocol이 그대로다 (v1.0의 전제).

**부정 (수용함)**
- 세션 간 맥락 공유가 없어 사람이 Artifact를 전달해야 한다.
  → v0.1의 수동 부트스트랩이 정확히 이 비용이다. 자동화는 필요가 입증된 뒤.
- 역할별 세션을 사람이 열어야 한다. 세션 수만큼 손이 간다.
  → v0.3에서 순차 실행으로 완화한다. 병렬은 v0.5.

**되돌리는 조건**
- Artifact만으로 협업이 불가능한 사례가 반복되면 세션 간 직접 전달을 재검토한다.
  단 그 경우에도 **상태의 소유자는 저장소**라는 원칙은 유지한다.

단계별 도입 계획은 [vision.md §6 로드맵](../vision.md)에 있다. 여기 중복하지 않는다.
