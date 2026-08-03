# RFC-001 Appendix — 비규범 참고 자료

> **이 문서는 규범이 아니다.** 읽지 않아도 BCOS를 운영할 수 있다.
> 프로토콜을 구현하거나 예외 상황을 분석할 때만 읽는다.
> [Core RFC](RFC-001-task-protocol.md)와 어긋나면 **Core가 이긴다.**

---

## 1. Task 전체 예시

```markdown
---
protocol: "0.1"
id: T-001
title: BCOS CLI 프로젝트 스캐폴드 구축
status: TODO
attempt: 0
created: 2026-08-03T00:00:00Z
updated: 2026-08-03T00:00:00Z
---

## Objective
왜 이 작업을 하는가. 한 문단.

## Scope
- [ ] 체크 가능한 항목

## Out of Scope
- 만들면 실패로 판정되는 것

## Acceptance Criteria
1. `npm run build`가 오류 없이 `dist/`를 생성한다.
2. `node dist/cli.js --version`이 exit code 0을 반환한다.

## Expected Files
**생성** — `package.json`, `src/cli.ts`
**읽기 허용** — `AGENTS.md`
**쓰기** — `.bcos/reports/T-001-project-scaffold.md`

## Test Requirements
| # | 대상 | 검증 |
|---|---|---|
| 1 | `cli --version` | stdout이 버전과 일치, exit 0 |
```

`BLOCKED` 상태일 때는 frontmatter에 `blocked_reason`이 추가된다.

---

## 2. Report 전체 예시

```markdown
---
task: T-001
---

# Report — T-001

## Attempt 1 — 2026-08-03T12:00:00Z

### Implemented
package.json, tsconfig.json, src/cli.ts를 생성했다.
cli.ts는 --version과 --help만 처리하며 그 외 인자는 exit 1을 반환한다.

### Files Changed
- package.json (new)
- src/cli.ts (new)
- tests/cli.test.ts (new)

### Test Evidence
```
$ npm test
▶ cli
  ✔ --version prints package version (12.4ms)
  ✔ --help prints usage (3.1ms)
  ✔ unknown arg exits 1 (3.8ms)
ℹ pass 3  ℹ fail 0
```

### Deviations
None

### Known Risks
Windows PowerShell 5.1에서만 확인했다. Git Bash는 미검증.

### Context Used
- Files read: 4
- Outside Expected Files: 0

## Attempt 2 — 2026-08-04T09:30:00Z

### Implemented
Review의 Required Changes 1, 2를 반영했다.
...
```

**Attempt 1의 내용은 절대 수정하지 않는다.** 파일 끝에 Attempt 2를 추가한다.

---

## 3. Review 전체 예시

```markdown
---
task: T-001
---

# Review — T-001

## Attempt 1 — 2026-08-03T13:00:00Z — CHANGES_REQUESTED

### Criteria Assessment
| # | Acceptance Criteria | 판정 | 근거 |
|---|---|---|---|
| 1 | npm run build 성공 | PASS | Report Test Evidence 2행 |
| 2 | --version exit 0 | PASS | Test Evidence 4행 |
| 3 | unknown arg exit 1 | FAIL | 테스트는 있으나 stderr 출력 미확인 |

### Findings
- Files Changed가 Expected Files 범위 안에 있다. Out of Scope 침범 없음.
- Test Evidence가 실제 실행 출력이다. 주장 아님.
- `src/cli.ts`가 인자 파싱을 위해 범용 파서를 만들었다.
  현재 처리하는 인자는 2개뿐이다 — 과설계.

### Required Changes
1. `src/cli.ts`의 범용 인자 파서를 제거하고 `process.argv[2]` 직접 비교로 바꿀 것.
2. unknown arg 테스트에 stderr 내용 검증을 추가할 것.

### Verdict
CHANGES_REQUESTED
```

`Findings`의 세 번째 항목이 **Review Ponytail**(Core §4.1)의 적용 사례다.
동작은 정확하지만 더 단순한 대안이 명확하므로 `CHANGES_REQUESTED`다.

---

## 4. 오류 사례 — `E_*` 범주별

Core §8.1의 6개 범주에 실제로 어떤 상황이 들어가는지에 대한 **예시**다.
이 목록은 규범이 아니며 완전하지도 않다. 구현은 `message`와 `details`로 사유를 전달한다.

### `E_SCHEMA`
- frontmatter가 없거나 YAML 파싱 실패
- `status` 값이 5개 집합 밖
- 필수 필드 누락 (`protocol`, `id`, `title`, `status`, `attempt`, `created`, `updated`)
- 타임스탬프가 RFC 3339가 아님 (로컬 타임존 표기 포함)
- 필수 6섹션 누락, 순서 오류, 또는 비어 있음
- `BLOCKED`인데 `blocked_reason` 없음
- Review 판정이 `APPROVED`인데 `Criteria Assessment`에 `FAIL` 존재
- `CHANGES_REQUESTED`인데 `Required Changes`가 비어 있음
- Review가 일부 Acceptance Criteria를 다루지 않음

### `E_TRANSITION`
- 전이표에 없는 전이 시도 — `TODO → DONE`, `IN_PROGRESS → DONE` (리뷰 우회)
- `DONE`에서 나가는 전이 시도
- `IMPLEMENTED → BLOCKED` (`request-changes` 후 `block`할 것)
- 전이는 허용되나 `actor_role`이 허용 집합 밖 — `worker`의 `approve` 시도

### `E_OWNERSHIP`
- **SoD 위반** — 승인 `actor_id`가 현재 attempt의 제출 `actor_id`와 동일
- 소유 role이 아닌 Actor의 아티팩트 본문 수정
- `events.jsonl` 또는 `state.json` 직접 편집 흔적

### `E_ARTIFACT_MISSING`
- `submit` 시 현재 attempt의 Report 항목 없음
- `approve` / `request-changes` 시 현재 attempt의 Review 항목 없음
- Task 파일이 `state.json`에는 있으나 디스크에 없음

### `E_CONFLICT`
- `IN_PROGRESS` Task가 이미 존재하는데 `start` 시도
- Task ID 중복
- 파일명의 id와 frontmatter `id` 불일치

### `E_IO`
- 파일 읽기·쓰기 실패, 권한 오류, 경로 길이 초과
- 원자적 쓰기의 rename 실패

---

## 5. 엣지 케이스

| 상황 | 처리 |
|---|---|
| `state.json` 삭제됨 | `tasks/*.md` 스캔으로 재생성. 오류 아님 |
| `state.json`이 Task와 불일치 | Task가 이김. 재생성 후 경고 |
| 이벤트 순서가 전이표와 모순 | 경고만. **로그를 수정하지 않는다** |
| `events.jsonl` 마지막 줄에 개행 없음 | append 시 개행을 먼저 쓴다 |
| Git 머지로 이벤트 중복 | 자연 키 `(task, event, attempt, ts)`로 하나 취급 |
| Task 파일이 깨져 파싱 불가 | 그 Task만 오류. 다른 Task 처리는 계속 |
| 동결된 Task의 본문이 수정됨 | 감지 수단이 없다 — **`0.1`의 알려진 한계** (§7 L3) |
| Report는 있는데 attempt 항목이 없음 | `E_ARTIFACT_MISSING` |
| `human`이 자기가 구현하고 자기가 승인 | **G5로 차단된다.** `actor_id`가 같으면 role과 무관하게 거부 |
| Windows에서 경로 260자 초과 | `E_IO`. Worktree를 v0.1에서 제외한 이유 |

---

## 6. 설계 근거

### 왜 `attempt`가 0에서 시작하는가
`TODO`인 Task는 아직 한 번도 시도되지 않았다. `attempt: 1`로 시작하면
"시도했으나 아직 결과가 없는 상태"와 구분되지 않는다.
`IN_PROGRESS` 진입 시 증가시키면 `attempt`가 곧 "지금까지의 구현 시도 횟수"가 된다.

### 왜 이벤트에 id 필드를 두지 않는가
초안에는 `id = "<task>|<event>|<ts>"` 형태의 결정적 id가 있었다.
그런데 그 값은 이미 존재하는 필드들의 연결일 뿐이다.
자연 키 `(task, event, attempt, ts)`로 같은 목적(머지 후 중복 제거)을 달성할 수 있다.
**새 필드보다 기존 필드 조합이 우선한다.**

### 왜 `depends_on`을 제거했는가
`0.1`은 `IN_PROGRESS`를 1개로 제한하므로 실행이 순차적이다.
순차 실행에서 의존성은 사람이 Task 순서를 정하는 것으로 충족된다.
순환 참조 검출, 위상 정렬, 대기 큐는 전부 **아직 겪지 않은 문제**에 대한 코드다.

### 왜 `supersedes` / `superseded_by`를 제거했는가
동결된 Task를 대체할 때 추적이 필요하다는 것은 맞다.
그러나 새 Task의 `Objective`에 "T-003을 대체한다"고 쓰면 충족된다.
**필드를 추가하는 것보다 기존 본문을 쓰는 것이 싸다.**

### 왜 `HUMAN_REVIEW_REQUIRED` 판정을 제거했는가
`0.1`에는 인증이 없으므로 이 판정을 강제할 기계적 수단이 없다.
강제되지 않는 판정 값은 장식이다. 사람 판단이 필요하면
`Required Changes`에 "Human 결정 필요"라고 쓰면 된다.

### 왜 `STATE_REINDEXED` 이벤트를 제거했는가
`state.json` 재생성은 파생 파일의 재계산이며 **상태 변경이 아니다.**
상태가 바뀌지 않았는데 이벤트를 남기면 감사 로그가 잡음으로 오염된다.

### 왜 오류 코드 27개를 6개 범주로 줄였는가
코드를 한 줄도 쓰기 전에 27개의 오류를 분류한 것은,
아직 발생하지 않은 실패를 예측해 이름을 붙인 것이다.
호출자가 실제로 분기하는 단위는 "스키마가 틀렸나 / 전이가 안 되나 / 권한이 없나" 수준이며
그 이상의 세분화는 `message`로 충분하다.
**세분화가 필요하다는 증거는 두 번째 호출자가 나타날 때 생긴다.**

### 왜 byte-for-byte 결정성을 포기했는가
바이트 동일성은 캐싱과 스냅샷 테스트를 쉽게 만든다.
그러나 `0.1`에는 캐시가 없고 스냅샷 테스트도 없다.
**존재하지 않는 소비자를 위한 제약**이었다.
의미적 결정성만으로 "같은 입력에 같은 지시"라는 실제 목적은 달성된다.

### 왜 actor를 role과 id로 분리했는가
`codex`를 규범에 박으면 프로토콜이 특정 제품에 묶인다.
BCOS의 목표는 **여러 에이전트가 같은 저장소를 공유하는 것**이므로
규범은 역할만 알고 제품명은 데이터여야 한다.
분리하고 나니 SoD 규칙도 더 정확해졌다 —
"Codex는 승인 못 한다"가 아니라 "제출한 그 주체는 승인 못 한다"이며,
후자가 실제로 막으려던 것이다.

---

## 7. 알려진 한계

| # | 한계 | 영향 |
|---|---|---|
| L1 | `actor_role`/`actor_id`가 자기 신고이며 인증이 없다 | 악의적 Worker가 다른 id를 사칭해 SoD를 우회할 수 있다. `0.1`은 신뢰 환경 전제 |
| L2 | `IN_PROGRESS` 1개 제한으로 병렬 실행 불가 | 처리량 제한. Worktree·Lock RFC 이후 |
| L3 | 동결된 Task 본문의 무단 수정을 감지할 수 없다 | 해시를 두면 감지 가능하나 아직 발생한 적 없는 문제다 |
| L4 | 파일 스캔 기반이라 Task 수천 개에서 느려진다 | 캐시는 진실 원천이 아니므로 ADR-002를 뒤집지 않는다 |
| L5 | Memory·Decision 아티팩트를 정의하지 않는다 | 실제 Report·Review가 쌓인 뒤 검토한다 |
| L6 | 리뷰 품질을 프로토콜이 보장하지 못한다 | 형식만 갖춘 승인이 가능하다. 형식 강제의 한계 |

---

## 8. 미해결 질문

1. **Context Package 8,000자 기준의 근거** — 임의로 정한 값이다.
   T-001 실행 후 실측 크기로 재설정한다.
2. **Test Evidence의 진위를 기계가 판정할 수 있는가** — 현재는 Reviewer의 판단에 맡긴다.
3. **필수 6섹션이 정말 6개여야 하는가** — `Out of Scope`와 `Expected Files`가
   실제로 범위 이탈을 막는지 T-001에서 확인한다. 효과가 없으면 줄인다.
4. **`attempt`가 3을 넘을 때 무엇을 해야 하는가** — 현재는 아무 규칙이 없다.
   실제로 3을 넘는 사례가 나오면 그때 정한다.

---

## 9. 확장 후보 — 지금 만들지 않는다

각 항목은 **실제 필요가 입증될 때만** 검토한다.

| 후보 | 필요를 입증하는 조건 |
|---|---|
| Task 의존성 (`depends_on`) | 병렬 실행이 도입되어 순서를 사람이 못 정할 때 |
| Task 대체 링크 (`supersedes`) | 대체 사례가 3건 이상 쌓이고 본문 서술로 추적이 안 될 때 |
| `CANCELLED` 상태 | 실제 취소 사례가 발생할 때. 별도 RFC |
| Actor 인증 | 신뢰할 수 없는 Worker를 실제로 붙일 때 |
| Task 본문 해시 | 무단 수정이 실제로 발생할 때 |
| 읽기 캐시 | `bcos status`가 1초를 넘을 때 |
| 11단계 상태 머신 | 5개 상태로 표현 못 하는 흐름이 실제로 나타날 때 |
| Memory Protocol (RFC-002) | Report·Review가 쌓여 재사용할 지식이 생길 때 |
| Agent Adapter Protocol | 세 번째 에이전트를 실제로 붙일 때 |
| 세부 오류 코드 | 호출자가 `E_SCHEMA` 안에서 분기해야 할 때 |

> 이 표의 목적은 아이디어를 기억하는 것이지 **로드맵을 약속하는 것이 아니다.**
> 조건이 충족되지 않으면 영원히 만들지 않는 것이 정상이다.
