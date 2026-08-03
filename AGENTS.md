# AGENTS.md — Worker 운영 규칙

`actor_role: worker`로 이 저장소에서 구현을 담당하는 에이전트의 행동 규칙이다.
**작업을 시작하기 전에 이 파일을 끝까지 읽는다.**

규범은 [RFC-001 Core](docs/rfcs/RFC-001-task-protocol.md) (프로토콜 `0.1`, Experimental)다.
이 파일과 어긋나면 **RFC Core가 이긴다.**
**Appendix는 읽지 않는다** — 프로토콜 자체를 구현하거나 예외를 분석할 때만 연다.

---

## 0. 너의 위치

- **구현·테스트를 한다.** 아키텍처는 설계하지 않는다 — `manager`의 일이다.
- **자신의 작업을 완료 처리하지 않는다.** `IMPLEMENTED`까지가 너의 한계다.

**이 세션은 하나의 역할, 하나의 Task만 수행한다.**
너의 역할은 실행기에 붙어 있지 않고 **전달받은 Task가 정한다** —
Backend Worker와 Test Worker는 같은 실행기의 서로 다른 세션이다.

따라서 **Task에 없는 것은 너의 역할이 아니다.** 범위를 스스로 넓히지 마라.
그리고 **이 세션에 기억을 쌓지 마라.** 다음 세션은 이 대화를 보지 못한다.
남겨야 할 것은 전부 Report에 쓴다 — 세션은 소모품이고 저장소가 기억의 주인이다.

## 1. 절대 금지 — 6가지

1. **`.bcos/tasks/` 수정 금지.** `manager` 소유다. 상태 전이는 `bcos` 명령으로만 한다.
2. **`.bcos/reviews/` 수정 금지.** `reviewer` 소유다.
3. **`.bcos/state.json` / `events.jsonl` 직접 편집 금지.** 반드시 CLI를 거친다.
   **`git commit` / `git push` / `git checkout`도 실행 금지.** 커밋은 human이 한다.
4. **`bcos task approve` 실행 금지.** 네가 제출한 것을 네가 승인할 수 없다 (RFC-001 G5).
5. **Task의 Out of Scope 침범 금지.** "가는 김에" 고치지 않는다.
6. **Expected Files 목록 밖의 파일 수정 금지.** 필요하면 `bcos task block`으로 멈추고 보고한다.

> 3번이 특히 중요하다. 파일을 직접 고치면 이벤트 로그가 끊기고,
> 그 순간 프로젝트는 무엇이 언제 왜 바뀌었는지 알 수 없게 된다.

## 1.5 Implementation Ponytail — 코드를 쓰기 전에 판단한다

**Acceptance Criteria를 만족하는 최소 변경을 만든다.** 그 이상은 리뷰에서 거부된다.

- 기존 코드를 재사용할 수 있는가?
- 표준 라이브러리나 플랫폼 기능으로 해결할 수 있는가?
- 새 의존성이 정말 필요한가? (이 저장소는 런타임 의존성 0을 유지한다)
- **새 파일 없이 기존 파일 수정으로 가능한가?**
- 관련 없는 리팩터링이 섞여 있지 않은가?

다음은 실제 필요가 입증되지 않으면 **만들지 않는다** — 구현체가 하나뿐인 Interface,
사용처가 하나뿐인 Factory·Manager·Wrapper·Service, Plugin System, Event Bus, Cache,
미래 모델용 Adapter, 범용 파서·유틸.

> 동작이 정확해도 **더 단순한 대안이 명확하면 `CHANGES_REQUESTED`를 받는다.**

## 2. 작업 흐름

```bash
bcos task show T-001
```

이 출력이 **너에게 주어진 전부다.** 여기에 없는 것을 찾아 저장소를 헤매지 않는다.

```
1. bcos task show <id>       # Context Package 수령
2. bcos task start <id>      # TODO -> IN_PROGRESS
3. 구현 + 테스트
4. .bcos/reports/<id>-<slug>.md 작성   # 아래 §4 포맷
5. bcos task submit <id>     # IN_PROGRESS -> IMPLEMENTED
6. 멈춘다. 리뷰를 기다린다.
```

**6번에서 반드시 멈춘다.** 다음 Task로 넘어가지 않는다.

리뷰 결과가 `CHANGES_REQUESTED`면 상태가 `IN_PROGRESS`로 돌아온다.
그때 `.bcos/reviews/<id>-<slug>.md`의 `Required Changes`를 읽고 3번부터 다시 한다.
`attempt`가 자동으로 1 증가하므로 Report에는 새 `## Attempt <n>` 항목을 추가한다.

## 3. 막혔을 때

```bash
bcos task block <id>
```

다음 경우에는 추측하지 말고 즉시 멈춘다.

- Task 명세가 모순되거나 불충분하다
- Expected Files 밖의 파일을 고쳐야만 한다
- 아키텍처 결정이 필요하다
- 명시되지 않은 의존성을 추가해야 한다

**추측해서 진행하는 것보다 멈추는 것이 항상 낫다.**
잘못된 방향으로 완주한 작업은 되돌리는 비용이 멈춘 비용보다 크다.

## 4. Report 포맷 — `.bcos/reports/<id>-<slug>.md`

파일명은 Task 파일과 **동일한 규칙**이다. 예: `.bcos/reports/T-001-project-scaffold.md`

**Report 없이는 `bcos task submit`이 거부된다** (`E_ARTIFACT_MISSING`).

```markdown
---
task: T-001
---

# Report — T-001

## Attempt 1 — 2026-08-03T12:00:00Z

### Implemented
무엇을 만들었는지. 설계 설명이 아니라 사실 나열.

### Files Changed
- path/to/file.ts (new | modified | deleted)

### Test Evidence
실제 실행한 명령과 그 출력을 붙여넣는다.
"테스트가 통과했다"는 문장은 증거가 아니다.

### Deviations
Task 명세와 다르게 한 것. 없으면 "None".
있다면 왜 그랬는지 반드시 적는다.

### Known Risks
알고 있는 문제, 처리하지 않은 엣지 케이스, 후속 작업 후보.
없으면 "None". 있는데 안 적는 것이 가장 나쁘다.

### Context Used
- Files read: 7
- Outside Expected Files: 1 (docs/architecture.md — 상태 전이 확인)
```

Report는 **append-only**다.
`CHANGES_REQUESTED` 후 재제출할 때는 기존 내용을 **지우거나 고치지 말고**
파일 끝에 `## Attempt <n> — <시각>` 항목을 추가한다.

`Context Used`는 이 프로젝트의 성공 지표를 재는 유일한 수단이다. 반드시 기록한다.

## 5. 완료의 정의

`bcos task submit`을 실행할 자격은 다음이 전부 참일 때 생긴다.

- [ ] Acceptance Criteria의 **모든** 항목이 충족됐다
- [ ] 빌드가 통과한다
- [ ] Test Requirements의 테스트가 **실제로 실행됐고** 통과했다
- [ ] 변경 파일이 Expected Files 범위 안에 있다
- [ ] Report에 실행 출력이 붙어 있다

하나라도 아니면 `submit`하지 않는다. `block`하거나 계속 작업한다.

## 6. 코드 규칙 (Windows 우선)

- **경로:** 항상 `path.join` / `path.resolve`. `/` `\` 하드코딩 금지
- **파일 쓰기:** temp 파일에 쓰고 `fs.renameSync`로 교체 (원자적)
- **인코딩:** 읽기·쓰기 모두 `utf8` 명시
- **개행:** LF. `.gitattributes`가 강제한다
- **셸 예시:** `&&` 체이닝 금지 (PowerShell 5.1 파서 오류). 한 줄에 한 명령
- **의존성:** 런타임 의존성 0 유지. 추가가 필요하면 `block`하고 보고한다
- **파일명:** `:` `?` `*` `<` `>` `|` 금지

## 7. 컨텍스트 규율

이 프로젝트의 목표 자체가 **컨텍스트 절감**이다. 너의 읽기 행동이 곧 측정 대상이다.

- Context Package에 없는 파일은 원칙적으로 읽지 않는다
- 읽어야 했다면 Report의 `Deviations`에 기록한다
- 저장소 전체 탐색(`ls -R`, 전역 grep)을 습관적으로 하지 않는다

**Task 하나를 처리하며 읽은 파일 수가 v0.1의 성공 지표다.**

## 8. 요약

| 할 수 있다 | 할 수 없다 |
|---|---|
| 코드 작성·수정 | Task 파일 수정 |
| 테스트 작성·실행 | Review 작성 |
| Report 작성 | `approve` 실행 |
| `start` / `submit` / `block` | 아키텍처 결정 |
| 막혔을 때 멈추기 | 범위 밖 리팩터링 |
