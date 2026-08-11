---
protocol: "0.1"
id: T-900
title: Resolve a review verdict by its latest entry so a blocked attempt can be closed after correction
status: TODO
attempt: 0
created: 2026-08-11T07:10:00Z
updated: 2026-08-11T07:10:00Z
---

# T-900 — Protocol Hotfix: Spec Amendment · BLOCKED Alignment

## Objective

T-013 dogfooding에서 **프로토콜 교착**이 실제로 발생했다.
동결된 Task의 명세 자체가 상위 정의와 충돌했고, 어느 전이도 합법이 아니게 됐다.

이 Task는 **그 교착 하나만** 푼다. 제품 기능을 추가하지 않는다.

**핵심 통찰 — 교착의 대부분은 문서 문제이고, 코드 결함은 정확히 하나다.**

Review는 append-only이며 `approve` 가드는 `heading.test(content)`로
**"어딘가에 일치하는 줄이 있는가"**만 본다 (`src/cli.ts:319-320`).
`src/reviewer.ts:56-57`은 `.exec()`로 **첫 일치**를 쓴다.
같은 attempt에 판정 항목이 둘 이상 존재하게 되는 순간 **둘 다 틀린 답을 준다.**

교착을 풀려면 정정 이후 같은 attempt에 후속 판정을 덧붙일 수 있어야 하고,
그러려면 **판정 해석이 "마지막 항목"을 보아야 한다.** 그것이 이 Task의 전부다.

나머지(정정 절차·BLOCKED 의미·소유권)는 **RFC 개정 제안**으로 이 문서에 적고,
**이 Task가 승인된 뒤 manager가 Human 승인을 받아 적용한다** — RFC 본문은
`manager` 소유이므로(RFC-001 §7) worker가 고치지 않는다.

## Scope

### 1. 조사 결과 — 추측 없음, 전부 저장소 실측

| # | 확인 사항 | 결과 |
|---|---|---|
| 1 | §1.2 전이표 | `block`은 `TODO`·`IN_PROGRESS` → `BLOCKED`뿐. **`IMPLEMENTED → BLOCKED` 없음.** "표에 없는 전이는 전부 금지" |
| 2 | §2.3 본문 동결 | 첫 `TASK_STARTED`에 동결. 가변 필드는 `status`·`attempt`·`updated`·`blocked_reason`. "명세를 바꿔야 하면 새 Task를 만든다" |
| 3 | §4 Review | 판정 **3개** — `APPROVED`·`CHANGES_REQUESTED`·**`BLOCKED`**. "attempt마다 하나의 항목". `APPROVED`인데 `FAIL`이 있으면 `E_SCHEMA` |
| 4 | §5 Event | **이벤트 7종 닫힌 집합.** append-only. 자연 키 `(task, event, attempt, ts)` |
| 5 | §8.3 precedence | "언제나 `tasks/*.md`가 이긴다" — **범위는 `state.json`·이벤트 로그뿐** |
| 6 | BLOCKED 정의 위치 | §1.1 상태 · §1.2 전이 · §4 판정 · G6 가드 · frontmatter `blocked_reason` |
| 7 | `task block`/`unblock` 구현 | **0건.** CLI에 명령 자체가 없다 |
| 8 | BLOCKED Task 실적 | **0건.** `events.jsonl`에 `TASK_BLOCKED` 0건 |
| 9 | Review 형식 | `## Attempt <n> — <RFC 3339> — <VERDICT>` |
| 10 | attempt와 명세 변경 | attempt는 **실행 횟수**다. 명세 변경과 무관 |
| 11 | events append-only | §5 MUST. 수정·삭제·재정렬 금지 |
| 12 | state.json | `tasks/*.md`에서 **재생성 가능한 파생물** (ADR-002) |
| 13 | 본문 hash / 불변성 강제 | **코드에 0건.** §2.3은 규범일 뿐 강제되지 않는다 |
| 14 | 전이 구현 방식 | `cli.ts`가 frontmatter 치환 + `persistTransition` |
| 15 | RFC 개정 관행 | RFC 1건 · ADR 3건. **개정 이력 절차는 없다** |
| 16 | Task ID 규칙 | §2 — **`^T-\d{3,}$`**. 코드 검증은 **없다** (`startsWith` 접두 매칭만) |

**결정적 발견 — BLOCKED는 완전한 문서상 상태다.** 명령도, 이벤트도, 실적도 0이다.
따라서 `IMPLEMENTED → BLOCKED` 전이를 새로 여는 것은 **쓰인 적 없는 상태에
경로를 추가하는 일**이며, 교착 해소에 필요하지도 않다.

### 2. Task ID — T-900, 로드맵 보존

RFC §2는 `^T-\d{3,}$`를 요구한다. **`T-013A`는 규격 위반이므로 쓰지 않는다**
(코드가 막지 않는다는 이유로 규격을 벗어나는 것이 이 프로젝트가 금지하는 조용한 이탈이다).

`\d{3,}`는 이미 900번대를 허용한다. **규칙을 확장하지 않고** T-014~T-017을
그대로 남긴다. 이 Task는 **T-900**이며, 900번대는 프로토콜 유지보수 대역으로 쓴다.

| 후보 | 판정 |
|---|---|
| `T-013A` | **기각** — `^T-\d{3,}$` 위반 |
| `T-014`를 hotfix로 소비 | **기각** — 계획된 Verification Failure Feedback을 밀어낸다 |
| RFC 변경 commit만, Task 없음 | **기각** — 코드 변경(판정 해석)이 실재한다 |
| **`T-900`** | **채택** — 규격 준수 · 로드맵 무손상 · 규칙 확장 0 |

### 3. Amendment 모델 — 후보 비교

| 후보 | 판정 |
|---|---|
| A. 동결 본문 직접 수정 | **기각.** §2.3 정면 위반. 원본이 훼손되면 "무엇이 잘못됐었나"가 사라진다 |
| B. Human 승인 한 줄 | **기각.** 무엇을 무엇으로 고쳤는지 기록이 남지 않아 재현·감사 불가 |
| **C. Amendment artifact** | **채택.** 원본 불변 + 정정 내용이 파일 하나로 남는다 |
| D. 새 Task + supersede | **기각.** 새 Task는 T-013의 AC를 **소급 변경하지 못한다.** 이미 끝난 구현·Report·Review·run을 버리게 된다 |
| E. `TASK_SPEC_AMENDED` 이벤트만 | **기각.** §5는 **이벤트 7종 닫힌 집합**이고 전부 상태 전이다. 이벤트 한 줄로는 "AC 59를 무엇으로 정정했는가"를 담을 수 없다 |
| F. artifact + 신규 이벤트 | **기각 (과설계).** artifact가 시각과 내용을 모두 담는다. 이벤트를 더하면 lifecycle 로그에 비-전이 레코드가 섞인다 |

**채택: C.** 파일 하나. 새 이벤트 없음. `state.json` 변경 없음. 새 CLI 명령 없음.

### 4. Amendment artifact 규격 (RFC 개정 제안의 일부)

경로 `.bcos/amendments/<task-id>-A<nnn>.md` · 소유 `human` · **append-only, 수정 금지**

```markdown
---
protocol: "0.1"
task: T-013
amendment: A001
attempt: 2
created: <RFC 3339>
proposed_by: claude-code
approved_by: <human actor_id>
---

## Superseded
- AC 59 · AC 62 · AC 63 · Scope §8

## Original
<원문 그대로 인용>

## Corrected
<정정된 요구>

## Reason
<왜 원문이 잘못됐는가 — 어떤 상위 정의와 어떻게 충돌하는가>

## Evidence
<파일·행 번호>
```

**JSON schema framework를 만들지 않는다.** Markdown으로 충분하다.
**필드를 더 늘리지 않는다.** 위가 최소 집합이다.

**`proposed_by`와 `approved_by`는 서로 달라야 한다.** Reviewer가 자기 발견을
자기 권한으로 계약에 반영하면 G5(SoD)의 의미가 약해진다. 이것은 G5의
형태를 amendment에 그대로 적용한 것이며 새 개념이 아니다.
**`approved_by`는 `actor_role: human`이어야 한다.**

`actor_id`가 자기 신고라는 §7의 알려진 한계는 그대로다.
**서명·인증·권한 시스템을 만들지 않는다.**

### 5. Amendment 허용 / 금지

**허용 — correction만**

- Task 명세가 내부적으로 모순
- Task가 상위 정의(RFC Core, 또는 Task가 **명시적으로 참조한** 계약)와 충돌
- 잘못된 파일명·필드명, 충족 불가능한 AC
- **원래 의도를 보존하는 정정**

**금지 — scope change는 amendment가 아니다**

- scope 확대 · 새 기능 추가
- worker가 구현하기 싫어서 하는 AC 완화
- 테스트 실패를 통과시키기 위한 기준 하향
- 편의·일정을 이유로 한 요구 삭제

**판별 기준 한 줄** — 정정 후 **Task의 목적이 그대로인가.**
목적이 달라지면 amendment가 아니라 **새 Task**다 (§2.3).

### 6. Effective Contract와 AC semantics

```
Effective Contract = 동결된 원본 Task + 승인된 Amendment(들)
```

Amendment는 AC를 **삭제하지 않는다. supersede한다.**
Review의 `Criteria Assessment`는 감사 가능한 형태를 유지한다.

```
| 59 | SUPERSEDED by A001 | 원문은 `worker_runtime` 요구. A001이 `worker_name`으로 정정 |
| 59' | PASS | artifact에 `worker_name` 기록 — 격리 실행으로 확인 |
```

`SUPERSEDED`는 `FAIL`이 아니므로 §4의 "APPROVED인데 FAIL이 있으면 `E_SCHEMA`"에
걸리지 않는다. **이것이 교착을 푸는 의미론적 열쇠다.**

**Markdown 자연어를 범용 파싱하지 않는다.** Reviewer가 amendment를 인식하는
규칙은 **파일 존재 + 명시적 링크**뿐이다.

### 7. BLOCKED — 최종 의미

**`BLOCKED` 판정과 `BLOCKED` 상태는 다른 것이다. 이 구분을 명시한다.**

| | 뜻 |
|---|---|
| `CHANGES_REQUESTED` | **worker의 재작업으로 해결 가능하다** |
| **`BLOCKED` (판정)** | **worker 재작업만으로는 해결 불가.** Task 계약·외부 의존·Human 결정이 필요하다. **lifecycle 전이를 일으키지 않는다** |
| `BLOCKED` (상태) | worker 실행을 막는 외부 blocker. `TODO`·`IN_PROGRESS`에서만 진입 (§1.2 그대로) |

**후보 비교**

| 후보 | 판정 |
|---|---|
| A. `IMPLEMENTED → BLOCKED` 허용 | **기각.** `block`/`unblock`이 **미구현**이고 BLOCKED Task 실적이 **0건**이다. 쓰인 적 없는 상태에 경로와 복귀 전이를 새로 만드는 것은 교착 해소에 불필요하다 |
| **B. 판정 전용 — 전이 없음** | **채택.** Task는 `IMPLEMENTED`에 머문다. 상태 기계를 건드리지 않는다 |
| C. Review BLOCKED 의미 변경 | **기각.** 방금 실제로 필요했던 의미가 바로 이것이다 |
| D. 판정에서 BLOCKED 제거 | **기각.** T-013이 그 판정을 실제로 필요로 했다 |

**복귀 경로 — 새 전이 0개.** 원인이 해소되면 Reviewer가 **같은 attempt에 후속
판정 항목을 덧붙인다** (Review는 이미 append-only다). Task는 `IMPLEMENTED`에서
정상적으로 `approve` 또는 `request-changes`로 나간다.

**이미 구현과 테스트가 끝난 Task를 다시 worker에게 돌릴 필요가 없다.**

### 8. 유일한 코드 변경 — 판정 해석은 마지막 항목을 본다

§7이 같은 attempt에 복수 판정 항목을 허용하는 순간, 현재 구현은 **틀린 답을 준다.**

| 위치 | 현재 | 문제 |
|---|---|---|
| `src/cli.ts:319-320` `existsReview` | `heading.test(content)` | 파일 **어디에든** 일치가 있으면 통과. `APPROVED` 뒤에 `BLOCKED`가 와도 승인된다 |
| `src/reviewer.ts:56-57` `verdict` | `.exec()` **첫 일치** | `BLOCKED` 항목을 건너뛰고 **오래된 판정**을 집는다 |

**변경** — 두 곳 모두 해당 attempt의 **마지막 `## Attempt <n> — … — <VERDICT>`
헤딩**을 찾아 그 판정으로 결정한다. 세 판정값을 모두 인식하되,
`BLOCKED`는 `approve`·`request-changes` 어느 쪽과도 일치하지 않는다.

`verdict()`는 마지막 항목이 `BLOCKED`이면 `"unreadable"`을 반환한다 —
workflow가 사람에게 에스컬레이션한다. **T-011 semantics 그대로다.**

**이것이 이 Task의 worker 작업 전부다.**

### 9. RFC 개정 제안 — 이 Task에서 적용하지 않는다

**worker는 `docs/`를 수정하지 않는다** (RFC-001 §7 — `docs/`는 `manager` 소유).
아래는 **제안**이며, 이 Task가 승인된 뒤 manager가 Human 승인을 받아 적용한다.

| 절 | 왜 | 어떻게 |
|---|---|---|
| **§2.3** | 동결 후 명세 결함의 정정 경로가 "새 Task"뿐이고, 그것은 이미 시작된 Task의 AC를 소급 변경하지 못한다 | 한 문단 추가 — 본문은 **여전히 절대 수정하지 않는다.** 정정은 `.bcos/amendments/`의 Human 승인 artifact로만 하며, 허용/금지 경계(§5)를 명시한다 |
| **§4** | ① `SUPERSEDED` 처분이 없어 정정된 AC를 표현할 수 없다 ② "attempt마다 하나의 항목"이 BLOCKED 이후 복귀를 막는다 ③ BLOCKED 판정의 의미가 미정의다 | `Criteria Assessment`에 `SUPERSEDED` 추가(근거 amendment 링크 필수) · `BLOCKED` 이후 **같은 attempt에 후속 항목 추가 허용**, 판정은 **마지막 항목** · `BLOCKED` = worker 재작업으로 해결 불가, **전이 없음** 명시 |
| **§7** | `.bcos/amendments/` 소유가 정의되지 않았다 | 소유 `human`, 다른 role 읽기만, append-only 행 1개 추가 |

**§1.1 · §1.2 · §5 · §8.3은 변경하지 않는다.**
상태 집합·전이표·이벤트 7종·`state.json` 규칙 전부 그대로다.

### 10. Precedence — T-013에서 실제 필요했던 만큼만

```
RFC-001 Core  >  동결 Task + 승인된 Amendment  >  Report / Review  >  state.json
```

**TELEMETRY.md를 이 계층에 넣지 않는다.** 대신 한 줄만 정한다 —
**Task가 명시적으로 참조한 계약은 그 Task에 대해 구속력을 가진다.**
T-013의 충돌은 TELEMETRY.md가 "규범"이어서가 아니라,
**같은 키 이름에 두 의미를 부여했기 때문**에 결함이었다.

문서 지위 일반론(F-7)은 이 Task에서 정의하지 않는다. **헌법을 만들지 않는다.**

### 11. T-013 복구 절차 — 이 Task 완료 후

1. manager가 §9의 RFC 개정을 적용한다 (Human 승인)
2. manager가 `.bcos/amendments/T-013-A001.md`를 작성한다 — `proposed_by: claude-code`
3. **Human이 `approved_by`로 승인한다** (`proposed_by` ≠ `approved_by`)
4. Reviewer가 T-013 Review에 **attempt 2 후속 항목**을 덧붙인다 —
   AC 59·62·63을 `SUPERSEDED by A001`로, 정정된 요구를 `PASS`로 평가
5. `node dist/cli.js task approve T-013 --actor-role reviewer --actor-id claude-code`
6. T-013 → `DONE`, attempt **2 유지**

**worker attempt 3를 만들지 않는다.** 구현은 이미 옳고 219/219가 통과한다.
재실행할 이유가 없다. attempt는 실행 횟수이지 명세 변경 횟수가 아니다(§1.4).

**보존** — T-013 원본 Task · Attempt 1·2 Report · Attempt 1·2 Review ·
events · runs를 **전부 그대로 둔다.** 역사적 Review를 고쳐
처음부터 문제가 없었던 것처럼 만들지 않는다.

### 12. Context Package — 이번에는 바꾸지 않는다

T-013은 worker 재실행이 필요 없으므로 amendment를 Worker Context에 자동 포함할
필요가 없다. **`src/context.ts`를 건드리지 않는다.**

이후 amendment가 있는 Task에서 worker를 다시 돌려야 한다면, 그 Task의
**Read List에 amendment 경로를 넣으면 된다** — 기존 메커니즘으로 충분하다.
자동 포함이 실제로 필요해지면 그때 판단한다.

## Out of Scope

- Verification Failure Feedback (T-014 그대로 유지)
- Multi-model Switching · Benchmark Harness · Token/Cost
- `src/model.ts` · `src/runner.ts` · `src/workflow.ts` · `src/run.ts` · `src/context.ts` 수정
- **`docs/` 수정** — RFC 개정은 이 Task의 worker 작업이 아니다 (§9)
- **`.bcos/amendments/` 디렉터리·파일 생성** — 첫 amendment는 manager·Human이 만든다
- 새 CLI 명령 (`amend-spec` · `accept-amendment` 등)
- 새 이벤트 (`TASK_SPEC_AMENDED` 등) · `state.json` 스키마 변경
- 새 상태 · 새 전이 (`IMPLEMENTED → BLOCKED` 포함)
- Task 본문 hash 강제 · immutability 검증 엔진
- schema framework · migration framework · generic policy engine
- permission/auth · 서명 · 원격 승인 · GitHub PR 연동
- daemon · DB · plugin · registry
- Reviewer template 개선 (별도 Finding)
- T-013 Task·Review·lifecycle 변경

## Acceptance Criteria

### A. 판정 해석 — 마지막 항목 (1–14)

1. `approve`는 해당 attempt의 **마지막** 판정 항목으로 결정한다.
2. `BLOCKED` 뒤에 `APPROVED`가 오면 `approve`가 **성공**한다.
3. `APPROVED` 뒤에 `BLOCKED`가 오면 `approve`가 **실패**한다.
4. 마지막 항목이 `CHANGES_REQUESTED`면 `approve`가 실패한다.
5. `request-changes`도 **마지막** 항목으로 결정한다.
6. `BLOCKED` 뒤에 `CHANGES_REQUESTED`가 오면 `request-changes`가 성공한다.
7. 마지막 항목이 `APPROVED`면 `request-changes`가 실패한다.
8. **다른 attempt의 항목은 해석에 영향을 주지 않는다.**
9. `verdict()`가 마지막 항목의 판정을 반환한다.
10. 마지막 항목이 `BLOCKED`이면 `verdict()`가 `"unreadable"`을 반환한다.
11. `verdict()`가 `BLOCKED`를 건너뛰고 오래된 판정을 집지 **않는다**.
12. 항목이 하나뿐인 파일에서 동작이 **이전과 동일**하다.
13. Review 파일이 없거나 해당 attempt 항목이 없으면 이전과 동일하게 실패/`unreadable`이다.
14. 판정 헤딩 형식(`## Attempt <n> — <ts> — <VERDICT>`)은 **변경하지 않는다**.

### B. 경계 (15–22)

15. 변경된 source file은 `src/cli.ts` · `src/reviewer.ts` **둘뿐**이다.
16. **새 source file 0개.**
17. `src/model.ts` · `src/runner.ts` · `src/workflow.ts` · `src/run.ts` · `src/context.ts` **무변경**.
18. `docs/` 아래 **무변경**.
19. `.bcos/` 아래 새 디렉터리·파일 **0개** (Report 제외).
20. 새 CLI 명령 **0개** — `--help` 출력 불변.
21. 새 이벤트 종류 **0개** · `state.json` 스키마 **불변**.
22. `class` · `interface` · registry · plugin · DI **0건**.

### C. Lifecycle SSOT (23–28)

23. `events.jsonl`은 append-only로 유지된다 — 기존 줄 수정·삭제 **0건**.
24. G5(SoD)가 **변경되지 않는다**.
25. G3(Report 존재)가 변경되지 않는다.
26. `attempt` 증가 규칙(§1.4)이 변경되지 않는다.
27. 상태 5개·전이 7개가 **변경되지 않는다**.
28. `state.json`은 여전히 `tasks/*.md`에서 재생성 가능하다.

### D. 회귀 (29–36)

29. 기존 219개 테스트가 전부 통과한다.
30. `task execute` 회귀 없음.
31. `task execute --review` 회귀 없음.
32. request-changes / rework 루프 회귀 없음.
33. `task status` · run artifact 회귀 없음.
34. worker stdin SHA-256 계약 회귀 없음.
35. telemetry 키 집합 **불변**.
36. T-001~T-013 아티팩트 **무변경**.

### E. 품질 (37–43)

37. `npm run build` exit 0.
38. `npm test` **실패 0건**, 총 **227개 이상**.
39. 테스트 삭제·skip **0건**.
40. `dependencies` 0개 · `devDependencies` 2개.
41. `src/cli.ts` **490줄 이하** · `src/reviewer.ts` **95줄 이하**.
42. 출력·아티팩트에 사용자 홈 절대 경로 **0건**.
43. 부분 쓰기 **0건** — 기존 temp→rename 경로를 그대로 쓴다 (새 쓰기 경로 없음).

**총 43개.**

## Expected Files

**수정**

- `src/cli.ts` — 판정 해석을 마지막 항목 기준으로. `approve` · `request-changes` 가드
- `src/reviewer.ts` — `verdict()`를 마지막 항목 기준으로, `BLOCKED` 인식
- `tests/cli.test.ts` — 신규 테스트

**생성**

- `.bcos/reports/T-900-protocol-spec-amendment.md`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-900-protocol-spec-amendment.md` (이 파일)
- `docs/rfcs/RFC-001-task-protocol.md` — **§1.2 · §2.3 · §4 · §5. 읽기 전용**
- `src/cli.ts`
- `src/reviewer.ts`
- `tests/cli.test.ts`
- `package.json`

**쓰기**

위 "수정"·"생성" 목록뿐이다. **`docs/`와 `.bcos/amendments/`는 쓰지 않는다.**

## Test Requirements

**현재 219개.** 신규 **8개 이상**, 목표 총 **227개**, AC 하한 **227개**.
(하한이 목표를 넘지 않는다.)

| # | 신규 테스트 |
|---|---|
| 1 | `BLOCKED` 뒤 `APPROVED` → `approve` 성공 |
| 2 | `APPROVED` 뒤 `BLOCKED` → `approve` 실패 |
| 3 | 마지막이 `CHANGES_REQUESTED` → `approve` 실패 |
| 4 | `BLOCKED` 뒤 `CHANGES_REQUESTED` → `request-changes` 성공 |
| 5 | 마지막이 `APPROVED` → `request-changes` 실패 |
| 6 | 다른 attempt의 항목이 해석에 영향을 주지 않는다 |
| 7 | `verdict()`가 마지막 항목을 반환한다 |
| 8 | 마지막이 `BLOCKED`면 `verdict()`가 `unreadable`이다 |

**회귀** — 기존 219개 전부 통과. 단일 항목 Review의 동작이 이전과 동일해야 한다.

**금지** — 새 테스트 프레임워크 · 기존 assertion 완화 · 테스트 삭제/skip ·
실제 모델 호출 · 네트워크.

## Benchmark Telemetry

**새 telemetry 키를 추가하지 않는다.** 이 Task는 관측 대상을 늘리지 않는다.
`docs/benchmarks/TELEMETRY.md`를 **수정하지 않는다**.

token / cost는 T-013과 동일하게 **`N/A`**다. 추정값을 만들지 않는다.
**efficiency · improvement · savings · reduction 류의 계산 결과를 기록하지 않는다.**

## Required Protocol / Policy Notes

- **RFC 개정은 이 Task의 worker 작업이 아니다** — §9의 제안을 승인 후 manager가 적용한다.
- **§1.1 · §1.2 · §5 · §8.3 무변경** — 상태·전이·이벤트·재생성 규칙 그대로.
- **G3 · G5 무변경.**
- **T-013은 이 Task 동안 손대지 않는다** — `IMPLEMENTED / attempt 2` 보존.

## Notes — Follow-up Findings (이 Task에서 해결하지 않는다)

**FU-1 — `docs/` 소유권 실무 이탈.** RFC-001 §7은 `docs/`를 `manager` 소유로
정하고 다른 role은 읽기만 가능하다고 규정한다. 그러나 **T-010 · T-012 · T-013에서
worker가 `docs/architecture.md`와 `docs/benchmarks/TELEMETRY.md`를 수정했다**
(각 Report의 Files Changed로 확인). §7이 현실과 다르거나 실무가 규정을 벗어난
것이며, 둘 중 무엇인지 결정된 바 없다. **이 Task는 `docs/`를 건드리지 않음으로써
그 이탈을 반복하지 않는다.** 판단은 별도 Task로 미룬다.

**FU-2 — Reviewer template.** Attempt 1 Review가 RFC §4의 MUST(모든 AC 항목별
`Criteria Assessment`)를 생략해 명세 충돌이 재작업 전에 드러나지 않았다.
템플릿·체크리스트 개선은 **범위를 키우므로 이 Task에 넣지 않는다.**

**FU-3 — TELEMETRY.md 문서 지위.** 규범 여부가 선언되지 않았고 CLAUDE.md 문서
표에도 없다. §10에서 T-013에 필요한 최소 규칙만 정하고, 일반론은 미룬다.

**FU-4 — `block`/`unblock` 미구현.** RFC가 정의하는 상태·전이·이벤트 2종이
CLI에 존재하지 않는다. 이 Task는 그것을 구현하지 않으며, BLOCKED 상태 경로를
쓰지 않는 설계를 택함으로써 미구현을 확대하지 않는다.
