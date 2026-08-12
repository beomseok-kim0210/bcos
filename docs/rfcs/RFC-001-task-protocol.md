# RFC-001 — BCOS Task Protocol (Core)

**프로토콜 `0.1` · 상태 Experimental · 2026-08-03 · [Appendix](RFC-001-task-protocol-appendix.md)(비규범)**

> **이 문서만 읽으면 BCOS를 운영할 수 있다.**
> Appendix는 프로토콜 자체를 구현하거나 예외를 분석할 때만 읽는다.

---

## 0. 목적과 범위

BCOS의 본체는 CLI가 아니라 이 프로토콜이다. CLI는 첫 번째 구현체일 뿐이다.
이 문서는 **파일에 무엇이 어떻게 적히는가**만 정의하며 프로그램 구조는 정의하지 않는다.

**`0.x`는 실험 단계이며 호환성을 약속하지 않는다.** 실사용 근거로 자유롭게 바꾼다.
`1.0` 승격 조건은 §10에 있다. 규범 용어는 RFC 2119를 따른다.

### 0.1 Actor

Actor는 **역할(role)** 과 **식별자(id)** 로 분리한다. 제품명을 규범에 넣지 않는다.

`actor_role` — `human`(방향·승인) · `manager`(Task·아키텍처) · `worker`(구현·Report)
· `reviewer`(검증·판정) · `runtime`(상태·이벤트 기록, 판단하지 않음)

`actor_id` — 자유 문자열. `claude-code`, `codex-cli`, `gemini-cli`, `alice` 등.

**같은 구현체가 여러 역할을 맡을 수 있다.** 단 §1.3 SoD 제약을 받는다.

---

## 1. 상태와 전이

### 1.1 상태 — 5개, 닫힌 집합

```
TODO · IN_PROGRESS · IMPLEMENTED · DONE · BLOCKED
```

이 외의 값은 오류다(`E_SCHEMA`). 상태 추가는 프로토콜 버전 변경을 요구한다.

### 1.2 전이

```
                     ┌──── request-changes ────┐
                     ▼                         │
TODO ──start──▶ IN_PROGRESS ──submit──▶ IMPLEMENTED ──approve──▶ DONE
  │                  │
  └──── block ───────┴──▶ BLOCKED ──unblock──▶ TODO
```

| 전이 | From | To | 허용 role | 가드 | 이벤트 |
|---|---|---|---|---|---|
| create | — | `TODO` | `manager`, `human` | §2 스키마 | `TASK_CREATED` |
| `start` | `TODO` | `IN_PROGRESS` | 전체 | G1, G2 | `TASK_STARTED` |
| `submit` | `IN_PROGRESS` | `IMPLEMENTED` | 전체 | G3 | `TASK_SUBMITTED` |
| `approve` | `IMPLEMENTED` | `DONE` | `reviewer`, `human` | G4, G5 | `TASK_APPROVED` |
| `request-changes` | `IMPLEMENTED` | `IN_PROGRESS` | `reviewer`, `human` | G4, G5 | `TASK_CHANGES_REQUESTED` |
| `block` | `TODO`, `IN_PROGRESS` | `BLOCKED` | 전체 | G6 | `TASK_BLOCKED` |
| `unblock` | `BLOCKED` | `TODO` | 전체 | — | `TASK_UNBLOCKED` |

**표에 없는 전이는 전부 금지한다**(`E_TRANSITION`). `DONE`은 종단 상태이며 되살릴 수 없다.

### 1.3 가드

| ID | 조건 | 위반 |
|---|---|---|
| **G1** | `IN_PROGRESS`인 Task가 하나도 없다 | `E_CONFLICT` |
| **G2** | Task의 필수 6섹션이 모두 비어 있지 않다 | `E_SCHEMA` |
| **G3** | 현재 attempt의 Report 항목이 존재한다 | `E_ARTIFACT_MISSING` |
| **G4** | 현재 attempt의 Review 항목이 존재하고, 판정이 요청한 전이와 일치한다 | `E_ARTIFACT_MISSING` |
| **G5** | **승인 Actor가 제출 Actor와 다르다 (SoD)** | `E_OWNERSHIP` |
| **G6** | `blocked_reason`이 제공됐다 | `E_SCHEMA` |

**G5 — 직무 분리 (Separation of Duties). 이 프로토콜의 존재 이유다.**

> `worker` 역할은 **자신의 구현을 승인할 수 없다.** 구체적으로,
> `approve`/`request-changes`를 수행하는 `actor_id`는 현재 attempt의
> `TASK_SUBMITTED` 이벤트의 `actor_id`와 **MUST NOT** 같다.
> 이 규칙의 완화는 프로토콜의 목적을 폐기하는 것과 같다.

### 1.4 attempt

`attempt`는 Task별 정수이며 **`0`에서 시작하고, `IN_PROGRESS`에 진입할 때마다 1 증가한다**
— `start`와 `request-changes` 양쪽 모두. 따라서 `attempt ≥ 2`는 재작업이 있었다는 뜻이다.
Report와 Review는 attempt마다 하나의 항목을 가진다.

### 1.5 불변식

구현은 어떤 연산 이후에도 다음을 **MUST** 보장한다.

`IN_PROGRESS` Task는 최대 1개다. 모든 상태 변경에 대응하는 이벤트가 존재한다.
`IMPLEMENTED`·`DONE` Task는 Report를, `DONE` Task는 `APPROVED` Review를 가진다.
`state.json`은 `tasks/*.md`에서 재계산한 값과 일치한다.

---

## 2. Task Schema

**소유자: `manager`.** 경로 `.bcos/tasks/<id>-<slug>.md`

- `id` — `^T-\d{3,}$`
- `slug` — `^[a-z0-9]+(-[a-z0-9]+)*$`, 60자 이하
- 파일명의 id와 frontmatter의 `id`는 **MUST** 일치한다
- 파일명에 `:` `?` `*` `<` `>` `|` `"` 를 **MUST NOT** 쓴다 (Windows)

### 2.1 Frontmatter

```yaml
protocol: "0.1"        # 필수
id: T-001              # 필수, 불변
title: 한 줄 제목       # 필수, 80자 이하
status: TODO           # 필수, §1.1
attempt: 0             # 필수, 정수 ≥ 0
created: 2026-08-03T00:00:00Z   # 필수, RFC 3339 UTC (날짜만도 허용)
updated: 2026-08-03T00:00:00Z   # 필수
blocked_reason: ...    # status가 BLOCKED일 때만 필수
```

알 수 없는 필드는 오류가 아니다. §9.2에 따라 보존한다.

### 2.2 본문 — 필수 6섹션

이 H2 섹션을 **정확히 이 순서로 MUST** 포함한다.

```
## Objective            왜 하는가
## Scope                무엇을 하는가
## Out of Scope         무엇을 하지 않는가
## Acceptance Criteria  무엇이 참이면 끝인가 (번호 매긴 관찰 가능한 문장)
## Expected Files       읽고 쓸 파일의 상한
## Test Requirements    어떻게 증명하는가
```

"비어 있다"는 내용이 없거나 `TBD` / `TODO` / `<...>` 뿐인 경우다. 추가 H2 섹션은 **MAY** 존재하며 보존된다.

- **Out of Scope** — 범위 이탈을 막는 유일한 방어선이다. "없음"은 **SHOULD NOT**.
- **Acceptance Criteria** — 관찰 가능해야 한다. "코드가 깨끗하다"는 부적합.
- **Expected Files** — 희망 목록이 아니라 **상한**이다. 밖의 파일이 필요하면 `block`한다.

### 2.3 본문 동결

> Task 본문과 `title`은 **첫 `TASK_STARTED` 시점에 동결된다.**
> 이후 변경 가능한 필드는 `status`, `attempt`, `updated`, `blocked_reason`뿐이다.

동결 전에는 자유롭게 다듬어도 된다.

**동결 후 명세 결함을 고치려고 원본을 수정하지 않는다** (**MUST NOT**).
원본 Task는 감사 기록의 일부이며 **무엇이 잘못 적혀 있었는지가 보존되어야 한다.**
정정은 원본을 바꾸지 않고 §2.4 Amendment로 한다.
의도한 작업 자체가 달라지면 정정이 아니므로 **새 Task를 만든다.**

### 2.4 Amendment — 동결된 명세의 정정

**소유자: `human`.** 경로 `.bcos/amendments/<task-id>-A<nnn>.md`. **Append-only.**

Amendment는 **동결된 Task의 명세 결함을 원본을 바꾸지 않고 정정하는 별도 아티팩트**다.

frontmatter는 `task` · `amendment` · `attempt` · `created` · `proposed_by` · `approved_by`.
본문은 `## Superseded` `## Original` `## Corrected` `## Reason` `## Evidence`.

**effective 조건 — 전부 MUST.** 다음 넷은 **구현이 검사한다.**
하나라도 어기면 effective하지 않으며, **오류가 아니라 무시된다.**

- `task`가 대상 Task와 일치한다
- `approved_by`가 비어 있지 않다
- `proposed_by`와 `approved_by`가 **서로 다르다** — G5를 정정에 적용한 것이다
- `## Superseded`가 원본 Task에 **실제로 존재하는** AC를 하나 이상 가리킨다

다음은 **MUST이지만 구현이 검사하지 않는다** — §7의 자기 신고 한계와 같은 성격이며,
Reviewer가 확인한다.

- `proposed_by`가 비어 있지 않다
- `approved_by`는 `human`이다

```
Effective Contract = 동결된 원본 Task + effective Amendment(들)
```

**한 Actor가 자기 정정을 스스로 권위 있게 만들 수 없다.** 제안과 승인은 분리된다.
`actor_id`가 자기 신고라는 §7의 한계는 여기에도 그대로 적용된다 —
감사 가능한 논리적 경계이지 인증이 아니다.

**Amendment로 할 수 없는 것 (MUST NOT)** — 요구 추가 · 범위 확대 · 새 기능 도입 ·
AC 완화 · 실패한 검증을 통과시키기 위한 기준 하향 · 이력 재작성.

**정정과 범위 변경의 판별 기준 한 줄** — 정정 후 **Task의 목적이 그대로인가.**
목적이 달라지면 Amendment가 아니라 새 Task다 (§2.3).

**이 판별은 사람이 한다.** 구현은 위 네 조건(형식·참조 무결성)만 검사하며,
정정인지 범위 확대인지는 **판정하지 않는다.**

---

## 3. Report Schema

**소유자: `worker`.** 경로 `.bcos/reports/<id>-<slug>.md` (Task와 동일 파일명)

**Append-only.** 재제출 시 기존 내용을 **MUST NOT** 수정하고 새 항목을 파일 끝에 추가한다.

frontmatter는 `task: <id>` 하나다. 본문은 attempt마다 다음 항목을 가진다.

```
## Attempt <n> — <RFC 3339>
### Implemented      사실 나열. 평가나 설계 정당화가 아니다
### Files Changed    경로 + (new | modified | deleted)
### Test Evidence    실행한 명령과 그 출력. "통과했다"는 문장은 증거가 아니다
### Deviations       명세와 다르게 한 것. 없으면 `None`
### Known Risks      알고 있는 문제. 없으면 `None`
### Context Used     읽은 파일 수 / Expected Files 밖의 파일 (SHOULD)
```

5개 H3 섹션은 **MUST**, `Context Used`는 **SHOULD**.
`Context Used`는 이 프로젝트의 목표(컨텍스트 절감)를 재는 유일한 수단이다.

전체 예시는 [Appendix §2](RFC-001-task-protocol-appendix.md).

---

## 4. Review Schema

**소유자: `reviewer`.** 경로 `.bcos/reviews/<id>-<slug>.md`. **Append-only.**

판정은 3개다 — `APPROVED` · `CHANGES_REQUESTED` · `BLOCKED`

frontmatter는 `task: <id>` 하나다. 본문의 판정 항목은 다음 형태다.

```
## Attempt <n> — <RFC 3339> — <VERDICT>
### Criteria Assessment  AC별 표: 번호 / 기준 / PASS·FAIL·SUPERSEDED / 근거
### Findings             아키텍처 정합성, Out of Scope 침범, 증거의 실재 여부
### Required Changes     CHANGES_REQUESTED일 때 필수. 번호 매긴 실행 가능한 지시
### Verdict              판정 값
```

`Required Changes`는 "개선하라"가 아니라 "X 파일의 Y를 Z로 바꾸라"여야 한다.
전체 예시는 [Appendix §3](RFC-001-task-protocol-appendix.md).

- `Criteria Assessment`는 **모든** Acceptance Criteria를 항목별로 다뤄야 한다 (**MUST**).
- `APPROVED`인데 `FAIL` 항목이 있으면 모순이다 (`E_SCHEMA`).
- `CHANGES_REQUESTED`인데 `Required Changes`가 비어 있으면 무효다 (`E_SCHEMA`).
- **증거 없는 완료 주장은 `CHANGES_REQUESTED`로 판정한다** (**MUST**).

**`SUPERSEDED`** — effective Amendment(§2.4)가 그 AC를 정정했다는 뜻이다.
근거 Amendment를 **명시한다**. 원본 AC는 동결된 Task에 그대로 남고 승인 요건에서만 빠진다.
**`PASS`가 아니며 삭제도 아니다.** 따라서 `FAIL`이 아니고 위 `E_SCHEMA` 규칙에 걸리지 않는다.
**구현은 Review 표를 읽지 않는다** — `SUPERSEDED` 표기가 실제 Amendment와 맞는지는
Reviewer가 확인한다.

**여러 판정 항목** — Review는 append-only이므로 같은 attempt에 판정 항목이 **여럿일 수 있다.**
그 attempt의 권위 있는 판정은 **마지막 유효 판정 항목**이다.
앞선 판정은 **수정하거나 삭제하지 않는다** (**MUST NOT**) — 무엇이 왜 막혔었는지가 기록으로 남는다.

**`BLOCKED` 판정은 lifecycle 전이를 일으키지 않는다.** Task는 있던 상태에 그대로 머문다.
worker 재작업만으로는 해결할 수 없어 **승인을 진행할 수 없다는 기록**이며,
§1.1의 `BLOCKED` **상태**(§1.2 `block` 전이로만 진입)와는 다른 것이다.
원인이 해소되면 같은 attempt에 후속 판정 항목을 덧붙인다.

### 4.1 Review Ponytail

Reviewer는 다음을 **MUST** 검사한다. 더 단순한 대안이 명확하면 `CHANGES_REQUESTED`다.

- 같은 결과를 더 적은 변경으로 만들 수 있는가?
- 삭제할 코드·파일·상태·규칙이 있는가?
- 현재 요구사항에 없는 기능이 추가됐는가?
- 설명할 수 없는 추상화가 있는가?

---

## 5. Event Schema

**소유자: `runtime`.** 경로 `.bcos/events.jsonl`

JSON Lines. UTF-8, LF, 파일 끝에 개행. **Append-only** — 기존 줄의 수정·삭제·재정렬을 **MUST NOT** 한다.

```json
{"ts":"2026-08-03T10:00:00.000Z","event":"TASK_STARTED","task":"T-001","attempt":1,"actor_role":"worker","actor_id":"codex-cli","from":"TODO","to":"IN_PROGRESS"}
```

전 필드 필수. `from`/`to`는 해당 없으면 `null`.

**이벤트 7종** — `TASK_CREATED` `TASK_STARTED` `TASK_SUBMITTED` `TASK_APPROVED`
`TASK_CHANGES_REQUESTED` `TASK_BLOCKED` `TASK_UNBLOCKED`

**자연 키** `(task, event, attempt, ts)` — 동일 키의 줄이 여럿이면 하나로 취급한다. 별도 id 필드를 두지 않는다.

**순서** — 물리적 줄 순서는 권위가 없다. `ts` 오름차순이 논리적 순서다.
§1.2와 모순되면 경고하되 **로그는 수정하지 않는다.** 기록이 이상하다는 사실 자체가 보존되어야 한다.

---

## 6. Context Package

`bcos task show <id>`의 출력. **Worker 세션에 그대로 투입되는 실행 패키지**이며 조회 결과가 아니다.

**블록 순서 (MUST)**

1. `TASK SPECIFICATION` — Task 본문 전문
2. `PREVIOUS REVIEW` — `attempt ≥ 2`일 때만. 직전 Review의 `Required Changes`
3. `ARCHITECTURE RULES` — 해당 규칙만 발췌
4. `RELATED DECISIONS` — 링크 + 한 줄 요약
5. `EXPECTED FILES`
6. `TEST REQUIREMENTS`
7. `EXECUTION RULES` — Worker 행동 규칙 요약
8. `REPORT PATH`

**제외 (MUST NOT 포함)** — 저장소 트리 전체, 다른 Task, 문서 전문, 전체 이벤트 로그.

**결정성** — 동일 저장소 상태·동일 Task에 대해 **블록 순서와 의미적 내용이 동일**해야 한다(**MUST**). 바이트 단위 동일성은 요구하지 않는다.

**크기** — 8,000자를 넘으면 **경고한다. 실패가 아니다.** 근거가 경험적이지 않으므로 T-001 실행 후 실측값으로 재검토한다.

---

## 7. 소유권

| 경로 | 소유 role | 다른 role |
|---|---|---|
| `.bcos/tasks/` | `manager` | 읽기만 |
| `.bcos/reports/` | `worker` | 읽기만 |
| `.bcos/reviews/` | `reviewer` | 읽기만 |
| `.bcos/amendments/` | `human` | 읽기만 |
| `.bcos/events.jsonl`, `state.json` | `runtime` | **직접 편집 금지** |
| `docs/`, `CLAUDE.md`, `AGENTS.md` | `manager` | 읽기만 |
| `src/`, `tests/` | `worker` | 읽기만 |

`human`은 모든 경로에 쓸 수 있다. 단 G5(SoD)는 `human`에게도 적용된다.

**소유는 결정 권한이다. 파일 쓰기 권한과 같은 개념이 아니다.**
소유자는 Task의 `Expected Files`(§2.2 — 읽고 쓸 파일의 **상한**)에 경로를 명시해
**그 Task 한정으로** 쓰기를 위임할 수 있다. 위임은 소유를 옮기지 않는다 —
위임 자체가 소유자가 작성한 Task 안에서 일어나고, `Expected Files` 밖의 파일은
여전히 쓸 수 없다. 명시되지 않은 경로에 대해서는 표의 `읽기만`이 그대로 적용된다.

**규범 문서 자체는 위임 대상이 아니다** — 이 RFC의 변경은 프로토콜 결정이므로
소유자가 판단한다. Task가 이 문서를 `Expected Files`에 넣을 때는 **읽기 전용**이다.

- **OR-1** 소유 role이 아니면 본문을 수정하지 않는다. 상태 필드는 프로토콜 연산으로만 바꾼다.
- **OR-2** `events.jsonl`과 `state.json`은 어떤 Actor도 직접 편집하지 않는다.
- **OR-3** 제출자와 승인자는 다른 `actor_id`여야 한다 (G5).

`actor_role`과 `actor_id`는 자기 신고이며 `0.1`은 인증을 정의하지 않는다 (알려진 한계).

---

## 8. Validation

### 8.1 오류 범주 — 6개

| 코드 | 의미 |
|---|---|
| `E_SCHEMA` | 스키마 위반 — 필드·형식·필수 섹션·모순된 판정 |
| `E_TRANSITION` | 정의되지 않은 상태 전이 |
| `E_OWNERSHIP` | 소유권·권한 위반 (SoD 위반 포함) |
| `E_ARTIFACT_MISSING` | 필요한 Report 또는 Review 없음 |
| `E_CONFLICT` | 불변식 충돌 (예: `IN_PROGRESS` 중복) |
| `E_IO` | 파일 읽기·쓰기 실패 |

세부 사유는 `message`와 `details`로 전달한다. **세부 오류 코드를 규범으로 정의하지 않는다** —
구현 전에 오류 분류를 고정하는 것은 과설계다. 예시는 [Appendix §4](RFC-001-task-protocol-appendix.md).

### 8.2 규칙

구현은 **쓰기 전에** 검증을 **MUST** 수행하고, **거부하되 파일을 수정하지 않는다**(자동 교정 **MUST NOT**).
Task 하나의 오류가 다른 Task 처리를 막지 **SHOULD NOT** 않는다.

### 8.3 불일치 해소

**언제나 `tasks/*.md`가 이긴다.** `state.json`은 재생성하고, 이벤트 로그는 경고만 하고 수정하지 않는다.

---

## 9. 호환성 원칙

### 9.1 `0.x`는 호환성을 약속하지 않는다

실사용 근거가 나오면 필드·전이·규칙을 자유롭게 바꾼다.
마이그레이션 도구를 미리 만들지 않는다. **Git 커밋이 롤백 수단이다.**

### 9.2 미지 데이터 보존 — 유일한 호환성 MUST

구현이 아티팩트를 읽고 다시 쓸 때, 알 수 없는 **frontmatter 필드**, **본문 섹션**,
**이벤트 필드**를 **MUST** 원형 그대로 보존한다.

> 미지 필드를 지우는 구현은 프로토콜 위반이다.
> 구식 도구 하나가 저장소를 한 번 훑는 것만으로 다른 도구의 데이터를 전부 파괴할 수 있고,
> 그러면 "여러 에이전트가 하나의 상태를 공유한다"는 전제가 붕괴한다.

### 9.3 닫힌 집합과 열린 집합

- **닫힘** (미지 값 = 오류): `status`, `verdict`, `actor_role`, `event`
- **열림** (보존 후 무시): `actor_id`, 그 밖의 모든 미지 필드

권한과 흐름에 관여하는 것은 닫고, 부가 정보는 연다.

---

## 10. `1.0` 승격 조건

다음 흐름을 **Windows에서 최소 1회 성공**해야 `1.0` 승격을 논의한다.

| # | 단계 | 성공 기준 |
|---|---|---|
| 1 | Task 생성 | 필수 6섹션을 갖춘 Task가 `TODO`로 생성된다 |
| 2 | Context Package 출력 | §6의 블록 구조로 출력된다 |
| 3 | Worker 구현 | **Context Package만 받고** 구현이 완료된다 |
| 4 | Report 제출 | Report 작성 후 `submit`이 성공한다. Report 없이는 거부된다 |
| 5 | 독립 Reviewer 검토 | 제출자와 다른 `actor_id`가 Review를 작성한다 |
| 6 | 변경 요청 또는 승인 | 판정에 따라 `IN_PROGRESS` 복귀 또는 `DONE` 전이가 성공한다 |
| 7 | state 재생성 | `state.json`을 삭제해도 `tasks/*.md`에서 완전히 복원된다 |
| 8 | events 감사 확인 | 모든 상태 변경이 이벤트로 남아 있고 순서가 §1.2와 일치한다 |

성공 후 실측값으로 다음을 재검토한다 — Context Package 크기 기준, 필수 섹션 개수,
attempt 의미, 오류 범주의 충분성.

**승격은 자동이 아니다.** 실험 결과를 근거로 새 RFC 개정을 거친다.

---

---

설계 근거, 전체 예시, 엣지 케이스, 오류 사례, 미해결 질문, 확장 후보는
[Appendix](RFC-001-task-protocol-appendix.md)에 있다. **비규범이며 읽지 않아도 운영할 수 있다.**
