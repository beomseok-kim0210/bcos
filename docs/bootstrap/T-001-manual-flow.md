# T-001 수동 부트스트랩 절차

> **CLI가 없으므로 프로토콜 전이를 사람이 대행한다.**
> `bcos` CLI가 동작하면 이 문서와 `.bcos/prompts/`는 **삭제한다.**
> 임시 발판이지 영구 구조가 아니다.

프로토콜 `0.1`의 전이 규칙은 그대로 지킨다. 자동화만 없을 뿐이다.

---

## 역할 배정

| `actor_role` | `actor_id` | 담당 |
|---|---|---|
| `human` | `<HUMAN_ID>` | 실행, 전달, 최종 승인 |
| `manager` | `claude-code` | Task 명세, Review 작성 |
| `worker` | `codex-cli` | 구현, Report |
| `reviewer` | `claude-code` | 독립 검토 |

**SoD 확인:** 제출은 `codex-cli`, 승인은 `claude-code`/`<HUMAN_ID>`.
`actor_id`가 다르므로 RFC-001 G5를 만족한다.

---

## 절차

### 1단계 — Human이 Codex CLI 실행

프로젝트 루트에서 시작한다.

```bash
cd C:\path\to\bcos
```
```bash
codex
```

### 2단계 — 실행 프롬프트 전달

[`.bcos/prompts/T-001-codex-prompt.md`](../../.bcos/prompts/T-001-codex-prompt.md)에서
`---` 사이의 본문을 **그대로 복사해** Codex 세션에 붙여넣는다.

**요약하거나 다시 쓰지 않는다.** 프롬프트 자체가 실험 대상이다.
프롬프트를 손보면 "Task 명세만으로 작업 가능한가"라는 가설을 측정할 수 없게 된다.

`TASK_STARTED`에 해당하는 시점이다. Task의 `status`를 `IN_PROGRESS`로,
`attempt`를 `1`로 손으로 바꾼다. (전이 시 attempt +1 — RFC-001 §1.4)

### 3단계 — Codex가 구현과 Report 작성

Codex가 5개 파일을 만들고 테스트를 실행한 뒤
`.bcos/reports/T-001-project-scaffold.md`를 작성한다.

**Human이 개입하지 않는다.** 막히면 Codex가 멈추고 보고하도록 프롬프트에 지시되어 있다.
힌트를 주면 실험이 오염된다. 막히는 것 자체가 유효한 결과다.

### 4단계 — Human이 결과를 Claude Code에 전달

Codex가 Report를 쓰면 Human이 Claude Code 세션에서 다음을 알린다.

```
T-001 구현이 제출됐다. Review를 작성하라.
```

Claude는 다음을 읽는다 — Task 파일, Report, 실제 변경된 5개 파일, `git status`.

`TASK_SUBMITTED`에 해당하는 시점이다. `status`를 `IMPLEMENTED`로 손으로 바꾼다.

### 5단계 — Claude가 독립 Review 작성

`.bcos/reviews/T-001-project-scaffold.md`에 작성한다.
포맷은 RFC-001 §4, 판정은 `APPROVED` / `CHANGES_REQUESTED` / `BLOCKED`.

**반드시 확인한다.**

- Acceptance Criteria 9개를 **항목별로** 판정 (누락하면 Review 무효)
- `Test Evidence`가 실제 실행 출력인가, 주장인가
- 변경 파일이 `Expected Files` 5개 안에 있는가
- **`Out of Scope` 침범 여부** — 특히 범용 인자 파서, 파일 쓰기 유틸리티
- **Review Ponytail** — 더 적은 변경으로 같은 결과가 가능한가

`CHANGES_REQUESTED`면 `Required Changes`에 실행 가능한 지시를 번호 매겨 쓴다.
"개선하라"가 아니라 "X 파일의 Y를 Z로 바꾸라"여야 한다.

**`CHANGES_REQUESTED`인 경우** — `status`를 `IN_PROGRESS`로, `attempt`를 `2`로 바꾸고
2단계로 돌아간다. 이때 Codex에는 `Required Changes`를 전달한다.
Report에는 `## Attempt 2` 항목이 **추가**된다. 기존 항목은 수정하지 않는다.

### 6단계 — Human이 승인 여부 결정

Review가 `APPROVED`여도 **최종 승인은 Human이 한다.**

승인하면 `status`를 `DONE`으로 바꾼다.

---

## 손으로 기록할 이벤트

CLI가 없으므로 `.bcos/events.jsonl`에 직접 append한다.
**전이가 일어난 시점의 실제 시각**을 쓴다.

```json
{"ts":"...","event":"TASK_STARTED","task":"T-001","attempt":1,"actor_role":"worker","actor_id":"codex-cli","from":"TODO","to":"IN_PROGRESS"}
{"ts":"...","event":"TASK_SUBMITTED","task":"T-001","attempt":1,"actor_role":"worker","actor_id":"codex-cli","from":"IN_PROGRESS","to":"IMPLEMENTED"}
{"ts":"...","event":"TASK_APPROVED","task":"T-001","attempt":1,"actor_role":"reviewer","actor_id":"claude-code","from":"IMPLEMENTED","to":"DONE"}
```

`TASK_CREATED`는 T-001이 CLI 이전에 손으로 만들어져 존재하지 않는다.
**이것은 알려진 부트스트랩 공백이며, 첫 이벤트가 `TASK_STARTED`인 것은 정상이다.**

`state.json`도 손으로 갱신한다 — `current_task`, `counts`, `updated`.

---

## 이 실험에서 측정할 것

T-001의 진짜 목적은 스캐폴드가 아니라 **가설 검증**이다.

| 측정 항목 | 어디서 | 판정 |
|---|---|---|
| worker가 읽은 파일 수 | Report `Context Used` | 허용 목록 4개에 가까울수록 성공 |
| 허용 목록 밖 파일을 읽었는가 | Report `Deviations` | 읽었다면 Task 명세가 불충분했다는 뜻 |
| `Out of Scope` 침범 | Review | 침범했다면 Out of Scope 서술이 약했다는 뜻 |
| `Expected Files` 이탈 | `git status` | 이탈했다면 목록이 부정확했다는 뜻 |
| attempt 횟수 | Task frontmatter | 2를 넘으면 Acceptance Criteria가 모호했다는 뜻 |
| 프롬프트 실제 크기 | 프롬프트 파일 | RFC-001 §6의 8,000자 기준 재조정 근거 |

**실패해도 유효한 결과다.** 어디서 실패했는지가 프로토콜의 다음 개정 근거가 된다.

---

## 이 절차가 끝난 뒤

1. 측정 결과로 RFC-001 §10의 `1.0` 승격 조건을 평가한다.
   T-001은 CLI 없이 수동 진행이므로 **8단계를 완전히 충족하지 못한다.**
   CLI가 생긴 뒤 T-002에서 자동화된 E2E를 다시 돌려야 승격 판단이 가능하다.
2. `Out of Scope`와 `Expected Files`의 실제 효과를 판정한다.
   효과가 없었다면 필수 6섹션에서 삭제를 검토한다.
3. **CLI가 동작하면 이 문서와 `.bcos/prompts/`를 삭제한다.**
