---
task: T-900
---

# Review — T-900 Protocol Hotfix

## Attempt 1 — 2026-08-11T07:35:00Z — CHANGES_REQUESTED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli` — SoD 충족 (G5)

**핵심 질문에 대한 답: 절반만 풀었다.**

교착의 lifecycle 절반 — "정정 이후 같은 attempt에 후속 판정을 덧붙여 빠져나온다" — 은
**완전히 동작한다.** 격리 저장소 6종으로 직접 확인했고 T-013 복구 시뮬레이션도 통과한다.

**그러나 amendment 절반은 작동하지 않는다.** `effectiveAmendments()`의 참조 무결성
검사가 **모든 실제 Task에서 Acceptance Criteria를 0개로 인식한다.** 따라서 어떤
amendment도 유효로 판정될 수 없다. T-013·T-012·T-900 셋 다 0개다.

기록 훼손은 없고 변경은 최소이며 범위 이탈도 없다. **막는 것은 단 하나의 정규식이다.**

---

## 판정 요약

| | |
|---|---|
| **Verdict** | **CHANGES_REQUESTED** |
| Blocking | **1** (F-1) |
| Major | 0 · Minor 2 · Info 3 |
| Reviewer 독립 재현 | build exit 0 · **234 / 234 pass · fail 0 · skip 0 · todo 0** |
| AC | **PASS 47 · FAIL 4** (51개 중) |
| T-013 아티팩트 보존 | **10 / 10 바이트 동일** |

---

## F-1 — 참조 무결성 검사가 모든 실제 Task에서 무력하다 (**Blocking · Implementation**)

### 결함

`src/cli.ts:50`

```ts
const criteria = /^## Acceptance Criteria[ \t]*\r?\n([\s\S]*?)(?=^## |\s*$)/m.exec(task)?.[1] ?? "";
```

`m` 플래그에서 `$`는 **모든 줄 끝**에 매치한다. `[\s\S]*?`는 게으르므로
`\s*$`가 **첫 줄 끝에서 즉시 성립**하고 본문이 그 자리에서 잘린다.

### 실측 — 모든 실제 Task에서 0개

| Task | 인식된 AC | 실제 AC |
|---|---:|---:|
| T-013 | **0** | 94 |
| T-900 (자기 자신) | **0** | 49 |
| T-012 | **0** | 89 |

T-013에서 추출된 본문은 **빈 문자열**이다. 헤딩 다음이 빈 줄이면 `\s*$`가
0번째 위치에서 바로 성립하기 때문이다.

### 결과 — amendment 메커니즘이 통째로 불활성

`src/cli.ts:70-71`은 참조가 하나라도 `criterionIds`에 없으면 amendment를 제외한다.
`criterionIds`가 항상 비어 있으므로 **모든 amendment가 제외된다.**

T-013 복구 시뮬레이션에서 실제로 재현했다 — 형식이 완전한 A001을 넣고
`effectiveAmendments("T-013", …)`를 부르면 **0건**이다.

**T-900이 존재하는 이유가 바로 그 amendment이므로, 이 결함은 Task의 목적을 무효화한다.**

### 같은 결함이 `## Superseded` 추출에도 있다

`src/cli.ts:67` — 동일한 `(?=^## |\s*$)` 패턴이다.

```
## Superseded
- AC 59
- AC 62
- AC 63
```

추출 결과: `"- AC 59"` → 참조 `["59"]`. **AC 62·63이 조용히 사라진다.**
여러 AC를 정정하는 amendment는 첫 항목만 검사되고 첫 항목만 기록된다.

### 왜 테스트가 잡지 못했는가

신규 테스트 #10(`returns an amendment satisfying all four conditions`)의 fixture는
`## Acceptance Criteria` 바로 다음 줄에 `1. one`을 두고 **`AC 1`을 참조한다.**
잘림 이후에도 살아남는 **유일한 번호**가 1이다.

| fixture 형태 | 인식되는 AC |
|---|---|
| 헤딩 직후 `1. one` (worker fixture) | `["1"]` |
| 헤딩 뒤 빈 줄 | `[]` |
| 소제목 사용 (T-013·T-900 실제 형태) | `[]` |

**테스트는 통과하지만 잘못된 이유로 통과한다.** AC 2 이상을 참조하거나 실제 Task
형태를 쓰면 즉시 실패한다.

### 최소 수정안 (Review에서 코드는 수정하지 않았다)

**두 추출을 하나의 헬퍼로 통일하고, 종료 조건을 "다음 `## ` 헤딩 또는 문서 끝"으로 만든다.**

```ts
function section(content: string, name: string): string {
  const start = new RegExp(`^## ${name}[ \\t]*\\r?\\n`, "m").exec(content);
  if (!start) return "";
  const rest = content.slice(start.index + start[0].length);
  const next = /^## /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
```

`src/cli.ts:50`과 `:67`이 이 헬퍼를 쓰면 된다. **정규식 두 개가 하나로 줄어든다.**
`hasRequiredSections`가 이미 같은 방식(`/^## /m`으로 다음 헤딩 탐색)을 쓰고 있으므로
새 개념이 아니라 **기존 패턴의 재사용**이다.

### 추가로 요구하는 테스트 (숫자 채우기 금지 — 결함을 실제로 잡는 것만)

1. 헤딩 뒤 **빈 줄이 있는** Task에서 AC 번호가 인식된다
2. **소제목(`### …`)을 쓰는** Task에서 AC 번호가 인식된다 — T-013·T-900 실제 형태
3. **마지막 AC 번호**(첫 번째가 아닌)를 참조하는 amendment가 유효로 판정된다
4. `## Superseded`가 **여러 AC**를 나열하면 전부 추출된다
5. 그중 하나라도 원본에 없으면 제외된다 — 기존 15g가 vacuous하지 않게 된다

### 보존해야 할 것

- `lastReviewVerdict` 구현 — **정확하다. 손대지 마라.**
- `effectiveAmendments`의 네 조건과 반환 형태 — 조건 자체는 옳다.
- 기존 234개 테스트 — 삭제·완화 금지.

---

## 1. Lifecycle Ground Truth — 일치

| | T-900 | T-013 |
|---|---|---|
| status / attempt | **IMPLEMENTED / 1** ✓ | **IMPLEMENTED / 2** ✓ |
| `TASK_STARTED` | **1** ✓ | 1 (변화 없음) ✓ |
| `TASK_SUBMITTED` | **1** ✓ | 2 (변화 없음) ✓ |
| `TASK_APPROVED` | **0** ✓ | **0** ✓ |
| `TASK_CHANGES_REQUESTED` | **0** ✓ | 1 (변화 없음) ✓ |

`current_task: null` · counts `IMPLEMENTED 2 / DONE 12`.
T-013 events **4건 그대로** — T-900 실행이 T-013 lifecycle을 건드리지 않았다.

## 2. Build / Test — Reviewer 직접 실행

```
npm run build  → exit 0
npm test       → tests 234 · pass 234 · fail 0 · skipped 0 · todo 0
```

기존 219개 유지(회귀 0), 신규 15개(판정 8 + amendment 7), 삭제·skip **0건**.
신규 테스트는 숫자 채우기가 아니라 독립 행동을 본다 — **다만 #10은 F-1 때문에
잘못된 이유로 통과한다.**

## 3. T-013 Artifact Isolation — 두 독립 증거 일치

Worker의 baseline hash를 재검토하고, **mtime으로 교차 확인**했다.
T-900 실행 창은 `15:34:20–15:42:26 KST`다.

| 파일 | 해시 | mtime |
|---|---|---|
| `src/model.ts` | 동일 | 11:49:03 |
| `src/run.ts` | 동일 | 14:39:47 |
| `src/runner.ts` | 동일 | 11:46:28 |
| `src/workflow.ts` | 동일 | 14:39:48 |
| `src/context.ts` | 동일 | 2026-08-06 |
| `docs/architecture.md` | 동일 | 11:43:19 |
| `docs/benchmarks/TELEMETRY.md` | 동일 | 14:39:49 |
| T-013 Task | 동일 | 14:45:21 |
| T-013 Review | 동일 | 15:12:39 |
| T-013 Report | 동일 | 14:43:52 |

**10 / 10 바이트 동일이고 mtime 전부 실행 창 이전이다.**
reset·stash·commit 하지 않았다.

T-900이 바꾼 파일은 **8개** — `src/cli.ts` · `src/reviewer.ts` · `tests/cli.test.ts` ·
`events.jsonl` · `state.json` · T-900 Task frontmatter · T-900 Report · run artifact.

## 4. Last Verdict Semantics — 6 / 6 통과

격리 저장소 6종을 만들어 실제 `task approve`를 실행했다.

| 리뷰 항목 순서 | approve | 기대 |
|---|---|---|
| `APPROVED` | 성공 | ✓ |
| `APPROVED` → `BLOCKED` | **실패** | ✓ |
| `BLOCKED` → `APPROVED` | **성공** | ✓ |
| `CHANGES_REQUESTED` → `APPROVED` | **성공** | ✓ |
| `APPROVED` → `CHANGES_REQUESTED` | **실패** | ✓ |
| `BLOCKED`만 | 실패 | ✓ |

**"파일 어딘가에 APPROVED 문자열이 있는가" 방식이 아니다.** 마지막 항목이 권위를 가진다.

## 5. Parser Consistency — 세 경로 의미 동일

`cli.ts`의 `lastReviewVerdict`를 `approve`(311행)와 `request-changes`(349→364행)가
**같은 함수로** 쓴다. `reviewer.ts`의 `verdict()`는 별도 구현이지만 정규식이
**공백 제거 후 바이트 단위로 완전히 동일**하고 마지막 항목 선택 루프도 같다.

```
^##Attempt${attempt}—[^\r\n]+—(APPROVED|CHANGES_REQUESTED|BLOCKED)[\t]*\r?$
```

`reviewer.ts`는 `BLOCKED`를 `"unreadable"`로 매핑해 workflow 에스컬레이션으로
연결한다 — T-011 semantics 그대로다. **불일치 없음.** (중복 자체는 M-1.)

## 6. Amendment Discovery — 조건은 옳고, 검사 하나가 무력하다

| 조건 | 판정 |
|---|---|
| task id 일치 | ✓ 동작 |
| `approved_by` 존재 | ✓ 동작 |
| `proposed_by` ≠ `approved_by` | ✓ 동작 |
| Superseded 대상이 실제 AC에 존재 | **✗ F-1 — 항상 실패** |

무효 amendment가 예외를 일으키지 않고, 디렉터리 부재 시 빈 배열을 돌려주며,
**Task·state·events를 변경하지 않는다** — 확인했다.

## 7. Human Approval Semantics — 과장 없음

`approved_by` 존재 요구 + proposer/approver 분리. **서명 0 · auth 0 · remote approval 0.**
Task 문서가 "`actor_id`가 자기 신고라는 §7의 알려진 한계는 그대로다"라고 명시한다.
**보안 인증이라고 주장하지 않는다.** 현재 수준은 감사 가능한 논리적 승인 경계이며
문서와 구현이 그 표현에서 일치한다.

## 8. Correction vs Scope Change — 경계 유지

기계 검사는 **형식·참조 무결성까지만**이다. "Task 목적이 그대로인가"는 코드에 없다.
class · policy engine · rules framework **0건**. 과설계 아님.

## 9. Frozen Task Immutability

`effectiveAmendments()` 호출 전후 원본 Task가 **바이트 단위로 동일**하다.
T-013 Task도 무변경(위 §3). T-900 Task는 frontmatter `status`·`attempt`·`updated`만
변했다 — §2.3이 허용하는 세 필드다. **원본 AC 삭제 0건.**

## 10. Effective Contract — 설계는 일관, 실행은 F-1에 막힘

`Frozen Original + Human-approved Amendment` 구조는 문서·코드에서 일관된다.
`SUPERSEDED`는 삭제가 아니라 supersede이고 `FAIL`이 아니므로 §4 모순 규칙을 피한다.
복구 시뮬레이션에서 **기존 `BLOCKED` 항목이 그대로 남는 것**을 확인했다 —
실패 이력을 숨기지 않는다.

**다만 F-1로 인해 amendment가 유효 판정을 받지 못하므로, 현재는 이 구조가
문서상으로만 성립한다.**

## 11. BLOCKED Semantics — 일부러 하지 않은 것들 확인

| 항목 | 실측 |
|---|---|
| `task block` / `unblock` | **0건** |
| `IMPLEMENTED → BLOCKED` 전이 | **0건** |
| `TASK_BLOCKED` 이벤트 | **0건** |
| `TASK_SPEC_AMENDED` 이벤트 | **0건** |
| 새 lifecycle state | **0건** |
| `state.json` 스키마 변경 | **0건** |

`BLOCKED`는 판정·에스컬레이션 의미로만 존재하고 `CHANGES_REQUESTED`와 구분된다.

## 12. T-013 Recovery Feasibility — 격리 사본에서 end-to-end 확인

실제 저장소를 복제한 임시 디렉터리에서 실행했다. **실제 T-013은 건드리지 않았다.**

```
1. 복구 전 approve       → 실패 (Approved Review for attempt 2 is missing)
2. A001 amendment 탐지   → 0건   ← F-1
3. Review에 APPROVED append → 기존 내용 보존 OK · BLOCKED 항목 잔존 OK
4. 복구 후 approve       → 성공
5. 최종                  → status DONE · attempt 2
6. events                → STARTED(a1) SUBMITTED(a1) CHANGES_REQUESTED(a2) SUBMITTED(a2) APPROVED(a2)
   attempt 3 생성        → 없음
7. Task 본문             → frontmatter 외 동일
```

**lifecycle 복구는 완전히 가능하다.** worker attempt 3 불필요, 기록 훼손 없음.
**그러나 2단계가 0건이므로 "Human 승인 amendment가 effective contract의 일부"라는
주장을 기계적으로 뒷받침할 수 없다.** 감사 추적의 한쪽 다리가 빠진다.

## 13. No New Commands / Files

새 source file **0개**. 새 CLI 명령 **0개** —
`start|submit|approve|request-changes|context|run|execute|status` 그대로다.
저장소 `.bcos/amendments/` **없음**(테스트는 임시 fixture에서만).

## 14. Source Boundaries

`src/cli.ts` **520 / 520** · `src/reviewer.ts` **87 / 95** ·
class·interface·registry·plugin **0건** · deps **0** · devDeps 2 ·
`package-lock.json` 변경 **0건**.

**cli.ts가 상한과 정확히 같은 것은 Minor로 판정한다**(M-2). 위반이 아니고
동작에도 영향이 없다. 다만 여유가 0이라 F-1 수정이 줄 수를 늘리면
상한을 넘게 된다 — 제안한 `section()` 헬퍼는 정규식 두 줄을 대체하므로
순증이 크지 않지만, 재작업 시 **상한 조정 필요 여부를 먼저 판단해야 한다.**

## 15. dist/cli.js Import Side Effect — **T-900이 만든 것이 아니다**

재현했다. 현재 빌드: `Unknown argument: (none)` · `exitCode 1`.
**T-013 이전 빌드(baseline mirror)에서도 완전히 동일하다.**

따라서 이것은 `cli.ts`가 스크립트 모듈이라는 **기존 구조의 성질**이며,
T-900은 export를 추가해 그것을 관측 가능하게 만들었을 뿐이다.

`effectiveAmendments`의 실사용은 깨지지 않는다 — 값은 정상 반환되고
부작용은 `process.exitCode`뿐이다. 테스트가 자식 프로세스로 격리한 것은
(`tests/cli.test.ts:799-802`) **합리적이며, 새 source file 금지 제약 하에서
사실상 유일한 선택**이다.

**향후 source split이 필요한 신호로는 본다**(I-1). **이번 Task Blocking 아님.**

## 16. Partial Write / Safety

`effectiveAmendments`는 읽기 전용이다 — 쓰기 0, events 변경 0, state 변경 0,
Task 변경 0. 새 쓰기 경로 도입 **0건**(기존 temp→rename 유지).
temp 파일 잔존 **0건**, run artifact JSON **4개 전부 유효**.
`events.jsonl`은 36 → 42줄로 **증가만** 했다 — append-only 유지.

## 17. Regression

기존 219개 유지 + 신규 15개 = 234개 전부 통과.
`--version` · `--help` · start · submit · approve · request-changes · context ·
run · execute · status · reviewer loop · rework loop · G5 · Report guard ·
last verdict semantics 모두 커버된다.

## 18. FU Findings Preservation — 넷 다 그대로

| | 상태 |
|---|---|
| FU-1 docs ownership | **미해결 유지.** T-900의 `docs/` 변경 **0건** — 이탈을 반복하지 않았다 |
| FU-2 Reviewer Criteria Assessment template | 미해결 유지 |
| FU-3 TELEMETRY.md 규범 지위 | 미해결 유지 |
| FU-4 block/unblock 미구현 | 미해결 유지 (명령 0건) |

**해결한 척하지 않았다.**

## 19. Pre-start Contract Refinement — 프로토콜 위반 아님

T-900 Task는 실행 지시와의 모순을 발견하고 **첫 `TASK_STARTED` 이전에** 정렬됐다.

근거 — 편집 직후 `status: TODO / attempt: 0`이 확인됐고, `TASK_STARTED`는
`06:34:21.039Z` **1건뿐**이며, worker가 구현한 `effectiveAmendments`는
**정렬된 계약에만 존재하는 요구**다. 정렬이 시작 이후였다면 worker가 알 수 없다.

RFC-001 §2.3 — *"동결 전에는 자유롭게 다듬어도 된다."*
**동결 전 계약 정제이며 위반이 아니다.** 오히려 T-013에서 뒤늦게 드러난
계약↔지시 불일치를 시작 전에 처리한 것으로, 같은 교착의 재발을 막았다.

**단, 이 정렬은 커밋되지 않았다** — 커밋된 `e3e5797`과 작업 트리의 T-900 Task가
다르다(I-2). 재작업 후 커밋 시 반드시 포함되어야 한다.

---

## Findings

| | 등급 | 유형 | 내용 |
|---|---|---|---|
| **F-1** | **Blocking** | Implementation | AC 절 추출 정규식이 모든 실제 Task에서 AC를 0개로 인식 → **모든 amendment가 무효**. `## Superseded`도 첫 항목만 추출 |
| M-1 | Minor | Architecture | `lastReviewVerdict` 정규식이 `cli.ts`·`reviewer.ts`에 **중복**. 현재 완전 동일하나 한쪽만 고치면 조용히 갈라진다 |
| M-2 | Minor | — | `cli.ts` **520/520**, 여유 0. F-1 수정 전 상한 판단 필요 |
| I-1 | Info | Architecture | `dist/cli.js` import 부작용은 **기존 성질**(구 빌드에서도 재현). 향후 source split 신호 |
| I-2 | Info | Process | T-900 Task의 동결 전 정제가 **미커밋** — 재작업 커밋에 포함 필요 |
| I-3 | Info | — | `effectiveAmendments` 반환 객체에 **superseded 참조 목록이 없다.** Reviewer가 감사하려면 파일을 다시 읽어야 한다. F-1 수정 시 함께 검토 |

---

## Criteria Assessment (RFC-001 §4 MUST — 51항목 전수)

증거: `M` 기계 검증 · `T` 테스트 · `X` 격리 실행 · `S` 시뮬레이션

| # | 판정 | 근거 |
|---|---|---|
| 1 | PASS | X approve가 마지막 항목으로 결정 (6/6) |
| 2 | PASS | X `BLOCKED`→`APPROVED` 성공 |
| 3 | PASS | X `APPROVED`→`BLOCKED` 실패 |
| 4 | PASS | X 마지막이 `CHANGES_REQUESTED` → 실패 |
| 5 | PASS | M `existsReview`가 동일 `lastReviewVerdict` 사용 |
| 6 | PASS | T `request-changes accepts CHANGES_REQUESTED appended after BLOCKED` |
| 7 | PASS | T 마지막이 `APPROVED`면 request-changes 실패 |
| 8 | PASS | T `approve ignores verdicts from other attempts` |
| 9 | PASS | T `reviewer verdict uses APPROVED appended after BLOCKED` |
| 10 | PASS | T `BLOCKED reviewer verdict escalates unreadable` |
| 11 | PASS | T `treats BLOCKED appended after APPROVED as unreadable` |
| 12 | PASS | X 단일 항목 파일에서 이전과 동일 |
| 13 | PASS | T `missing reviewer verdict escalates unreadable` |
| 14 | PASS | M 헤딩 형식 불변 |
| 15a | PASS | M `export function effectiveAmendments` 존재 |
| 15b | PASS | X 디렉터리 없음 → `[]` |
| **15c** | **FAIL** | **F-1 — 실제 Task 형태에서 유효 amendment가 0건.** fixture(AC 1)에서만 통과 |
| 15d | PASS | X `approved_by` 빈 값 → 제외 |
| 15e | PASS | X `proposed_by === approved_by` → 제외 |
| 15f | PASS | X `task` 불일치 → 제외 |
| **15g** | **FAIL** | **vacuous** — 모든 참조가 "없음"으로 판정되므로 검사가 의미를 갖지 못한다 (F-1) |
| 15h | PASS | X 호출 전후 Task 바이트 동일 |
| 15 | PASS | M 변경 source file은 `cli.ts`·`reviewer.ts` 둘뿐 |
| 16 | PASS | M 새 source file 0 |
| 17 | PASS | M 해시+mtime — T-013 소스 5개 무변경 |
| 18 | PASS | M `docs/` 변경 0건 |
| 19 | PASS | M 저장소 `.bcos/amendments/` 없음 |
| 20 | PASS | M `--help` 명령 집합 불변 |
| 21 | PASS | M 새 이벤트 0 · `state.json` 스키마 불변 |
| 22 | PASS | M class·interface·registry·plugin 0건 |
| 23 | PASS | M events 36→42줄, 증가만 |
| 24 | PASS | M G5 불변 |
| 25 | PASS | M G3 불변 |
| 26 | PASS | M `attempt` 규칙 불변 |
| 27 | PASS | M 상태 5·전이 7 불변 |
| 28 | PASS | M `state.json` 재생성 가능 |
| 29 | PASS | 기존 219개 통과 |
| 30 | PASS | T `task execute` 회귀 없음 |
| 31 | PASS | T `--review` 회귀 없음 |
| 32 | PASS | T rework 루프 회귀 없음 |
| 33 | PASS | T `task status`·run artifact 회귀 없음 |
| 34 | PASS | T stdin SHA 계약 회귀 없음 |
| 35 | PASS | T telemetry 키 불변 |
| 36 | PASS | M T-013 아티팩트 10/10 동일 |
| 37 | PASS | **Reviewer 직접** build exit 0 |
| 38 | PASS | **Reviewer 직접** 234 pass / 0 fail (≥234) |
| 39 | PASS | M skip·todo 0건 |
| 40 | PASS | M deps 0 / devDeps 2 |
| 41 | PASS | M cli 520≤520 · reviewer 87≤95 (M-2) |
| 42 | PASS | M 출력·아티팩트 홈 경로 0건 |
| 43 | PASS | M 새 쓰기 경로 0 · temp 잔존 0 · JSON 4개 유효 |

**집계 — PASS 47 · FAIL 4** (15c · 15g, 그리고 이들이 뒷받침해야 할
Scope §4 참조 무결성 조건). FAIL은 전부 **F-1 하나에서 파생**된다.

---

## Required Changes

1. **`src/cli.ts`** — `## <name>` 절 본문 추출을 "다음 `## ` 헤딩 또는 문서 끝"으로
   고친다. `hasRequiredSections`가 이미 쓰는 방식을 재사용해 헬퍼 하나로 통일하고,
   `:50`(Acceptance Criteria)과 `:67`(Superseded) 두 곳이 그것을 쓰게 한다.
2. **`tests/cli.test.ts`** — F-1을 실제로 잡는 테스트 5개를 추가한다
   (빈 줄 있는 Task · 소제목 있는 Task · 마지막 AC 참조 · 다중 Superseded 추출 ·
   그중 하나가 없을 때 제외). **기존 fixture를 실제 Task 형태에 가깝게 고치되
   assertion을 완화하지 마라.**
3. **`src/cli.ts` 상한** — 수정으로 520을 넘게 되면 Task Notes에 근거를 적고
   상한을 조정한다. **조용히 넘지 마라.**

**하지 마라** — `lastReviewVerdict` 변경 · `effectiveAmendments`의 네 조건 변경 ·
새 source file · 새 CLI 명령 · 새 이벤트 · `docs/` 수정 · T-013 관련 파일 접근 ·
policy engine 도입 · 기존 테스트 삭제·완화.

---

## 총평

**설계 판단은 옳았다.** BLOCKED 상태를 새로 열지 않고 판정 해석만 고친 선택,
새 이벤트·새 명령·새 파일을 만들지 않은 절제, 의미 판단을 사람에게 남긴 경계,
그리고 T-013 산출물을 바이트 단위로 보존한 실행 — 전부 요구한 대로다.
교착의 lifecycle 절반은 실제로 풀렸고 T-013 복구 경로도 검증됐다.

**막는 것은 정규식 하나다.** 그 하나 때문에 amendment가 단 한 건도 유효로
판정되지 못하고, 이 Task가 존재하는 이유의 절반이 작동하지 않는다.
수정 범위는 파일 두 개, 함수 하나, 테스트 다섯 개다.

---

## Attempt 2 — 2026-08-11T08:05:00Z — APPROVED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli` — SoD 충족 (G5)

**Attempt 1의 Blocking F-1이 해소됐다.** 실제 Task 문서에서 0개였던 Acceptance
Criteria 인식이 T-012 **87** · T-013 **94** · T-900 **51**로 바뀌었고,
독립 계수와 정확히 일치한다. `## Superseded`의 다중 항목도 전부 추출된다.

**수정은 순증 0으로 끝났다.** 중복 정규식 두 개를 helper 하나로 합쳤기 때문에
`src/cli.ts`는 520줄 그대로다. 상한 조정이 필요 없었다.

**T-013 산출물 10개는 이번에도 바이트 단위로 동일하다.**

---

## 판정 요약

| | |
|---|---|
| **Verdict** | **APPROVED** |
| Blocking | **0** · Major 0 · Minor 2 · Info 3 |
| Reviewer 독립 재현 | build exit 0 · **239 / 239 pass · fail 0 · skip 0 · todo 0** |
| AC | **PASS 51 / 51** |
| T-013 아티팩트 보존 | **10 / 10 바이트 동일** |

---

## 1. Lifecycle Ground Truth — 일치

| | T-900 | T-013 |
|---|---|---|
| status / attempt | **IMPLEMENTED / 2** ✓ | IMPLEMENTED / 2 ✓ |
| `TASK_STARTED` | **1** ✓ (attempt 2에서 추가 없음) | 1 ✓ |
| `TASK_SUBMITTED` | **2** ✓ | 2 ✓ |
| `TASK_CHANGES_REQUESTED` | **1** ✓ | 1 ✓ |
| `TASK_APPROVED` | **0** ✓ | **0** ✓ |

`current_task: null` · counts `IMPLEMENTED 2 / DONE 12`.
**request-changes가 `IN_PROGRESS` 재진입을 소유했으므로 `TASK_STARTED`가 늘지 않았다** (§1.4).
T-013 events **4건 그대로** — T-900 rework가 T-013 lifecycle을 건드리지 않았다.

## 2. Independent Build / Test

Reviewer가 직접 실행했다.

```
npm run build → exit 0
npm test      → tests 239 · pass 239 · fail 0 · skipped 0 · todo 0
```

기존 234개 유지, 신규 5개. 삭제·skip **0건**.

## 3. Attempt 1 Root Cause — old / new 대조 재현

Attempt 1의 결함은 `m` 플래그에서 `$`가 **모든 줄 끝**에 매치하는 것이었다.
`[\s\S]*?`가 게으르므로 `\s*$`가 첫 줄 끝에서 즉시 성립해 절 본문이 잘렸다.

같은 문서에 옛 정규식과 새 helper를 나란히 적용했다.

| Task | OLD | NEW |
|---|---:|---:|
| T-012 | **0** | **87** |
| T-013 | **0** | **94** |
| T-900 | **0** | **51** |

Attempt 1 Review가 기록한 "모든 실제 Task에서 0개"가 재현되고, 수정 후 해소된다.

## 4. Section Helper 검증

```ts
function section(content: string, name: string): string {
  const heading = new RegExp(`^## ${name}[ \\t]*\\r?\\n`, "m").exec(content);
  if (!heading) return "";
  const rest = content.slice(heading.index + heading[0].length);
  const end = /^## /m.exec(rest)?.index;
  return end === undefined ? rest : rest.slice(0, end);
}
```

정확한 `## <name>` 헤딩을 찾고, 직후부터 **다음 줄 시작 `## ` 또는 문서 끝**까지
반환한다. `hasRequiredSections`가 이미 쓰던 경계 방식과 같은 개념이다.

**`:54` Acceptance Criteria와 `:71` Superseded가 같은 helper를 쓴다** — 확인했다.
generic Markdown parser · AST parser · 새 dependency · 새 source file · class ·
registry **전부 0건**.

## 5. 실제 Task AC Parsing — 독립 계수와 일치

fixture가 아니라 실제 문서로 검증했다. Task 파일은 수정하지 않았다.

| Task | parser | 독립 수동 계수 | 일치 |
|---|---:|---:|---|
| T-012 | 87 | 87 | ✓ |
| T-013 | 94 | 94 | ✓ |
| T-900 | 51 | 51 | ✓ |

T-013의 **AC 59 · 62 · 63이 문서에 존재하고 parser가 셋 다 인식한다.**

## 6. Superseded Multi-item Parsing

| 입력 | 결과 |
|---|---|
| `- AC 59 / - AC 62 / - AC 63` | **`["59","62","63"]`** |
| 절 뒤에 `## `가 없는 문서 끝 | `["1","2"]` |

첫 항목만 읽거나 중간·마지막을 놓치지 않는다.

## 7. Missing Criterion Validation

`- AC 59 / - AC 62 / - AC 999` → 참조 `["59","62","999"]`가 **전부 추출**되고,
`999`가 원본에 없으므로 amendment가 **제외**된다.
첫 항목만 확인하고 통과시키는 구조가 아니다.

## 8. 신규 테스트 5개 — 실제 shape

| 테스트 | 사용한 shape |
|---|---|
| `recognizes criteria after a blank line` | **`AC 2`** |
| `recognizes criteria below a subheading` | **`AC 3`** |
| `recognizes the last Acceptance Criterion` | **`AC 3`** |
| `validates every listed Superseded criterion` | **`AC 1 / AC 2 / AC 3`** |
| `excludes a missing criterion anywhere in Superseded` | **`AC 1 / AC 99 / AC 3`** — 누락이 **중간**에 있다 |

**Attempt 1에서 결함을 놓친 원인(AC 1만 쓰는 synthetic fixture)이 제거됐다.**
마지막 테스트가 특히 중요하다 — 첫 항목만 검사하는 구현이면 통과할 수 없다.

## 9. Amendment Validation 전체 회귀 — 의미 불변

| 조건 | 결과 |
|---|---|
| 디렉터리 없음 | **0건**, 오류 아님 ✓ |
| 네 조건 충족 | **1건** ✓ |
| `approved_by` 없음 | 제외 ✓ |
| `proposed_by === approved_by` | 제외 ✓ |
| task 불일치 | 제외 ✓ |
| 없는 AC 참조 | 제외 ✓ |

**Attempt 1에서 정상 판정된 네 조건의 의미가 바뀌지 않았다.**

## 10. Last Verdict Semantics Regression — 6 / 6

section helper 수정이 verdict parser에 영향을 주지 않았다.

| 순서 | approve | 기대 |
|---|---|---|
| `APPROVED` | 성공 | ✓ |
| `APPROVED` → `BLOCKED` | **실패** | ✓ |
| `BLOCKED` → `APPROVED` | **성공** | ✓ |
| `CHANGES_REQUESTED` → `APPROVED` | **성공** | ✓ |
| `APPROVED` → `CHANGES_REQUESTED` | **실패** | ✓ |
| `BLOCKED`만 | 실패 | ✓ |

`src/reviewer.ts`는 이번 attempt에서 **변경되지 않았다**(해시 동일).

## 11. T-013 A001 Recovery Simulation — 격리 사본에서 11 / 11

**실제 T-013 저장소에는 아무것도 쓰지 않았다.**

```
1.  amendment 이전 approve        → 실패 (Approved Review ... is missing)
2.  A001 effectiveAmendments      → 1건 {amendment: A001, attempt: 2}
3.  Superseded 59/62/63           → 전부 인식
4.  BLOCKED Review 이력           → 잔존
5.  후속 APPROVED append          → 기존 내용 보존
6.  마지막 verdict                → APPROVED
7.  task approve                  → 성공
8.  status                        → DONE
9.  attempt                       → 2 유지
10. attempt 3                     → 없음
11. frozen Task body              → frontmatter 외 동일
```

**Attempt 1에서 2단계가 0건이던 것이 1건으로 바뀌었다.** 교착의 나머지 절반이 열렸다.

## 12. Frozen Task Immutability

`effectiveAmendments()` 호출 전후 원본 Task가 **바이트 단위로 동일**하다.
T-013 Task 본문도 무변경. Amendment는 original requirement를 삭제하지 않고
`SUPERSEDED` 링크로만 해석된다 — 시뮬레이션에서 BLOCKED 이력이 남는 것으로 확인했다.

## 13. T-013 Artifact Isolation — 10 / 10

Attempt 2 실행 직전 기준선(89파일) 대비 **전부 바이트 동일**:
`model.ts` · `run.ts` · `runner.ts` · `workflow.ts` · `context.ts` ·
`architecture.md` · `TELEMETRY.md` · T-013 Task · Review · Report.

T-013 events **4건**, `TASK_APPROVED` **0건**. reset·stash·revert·commit 없음.

## 14. cli.ts LOC / Architecture

`src/cli.ts` **520 / 520** · `src/reviewer.ts` **87 / 95**.

**중복 정규식 두 개를 helper 하나로 통합해 순증 0으로 해결됐다.**
상한을 넘지 않았고 조정도 필요 없었다. Task Contract 위반 없음.

`520/520 · headroom 0`은 **Minor(M-2)로 기록한다.** 위반이 아니고 동작에도
영향이 없다. 다만 다음 변경이 한 줄이라도 늘리면 즉시 상한에 닿는다.

## 15. Source / Scope — 최소 범위

이번 attempt의 제품 변경은 **`src/cli.ts` · `tests/cli.test.ts` 둘뿐**이다.

| 금지 항목 | 실측 |
|---|---|
| `src/reviewer.ts` 변경 | **없음** (해시 동일) |
| `docs/` 변경 | **0건** |
| 새 source file | **0** |
| 새 CLI 명령 | **0** — 명령 집합 불변 |
| dependency | **0** / devDeps 2 |
| class · interface · registry | **0건** |
| 새 이벤트 · lifecycle state | **0건** |
| `block`/`unblock` · auth · amendment writer | **0건** |
| 저장소 `.bcos/amendments/` | **없음** |

## 16. Feedback Handoff Dogfooding — SHA로 교차 확인

실행 **전** dry-run과 실행 **후** telemetry의 stdin 지문이 일치한다.

```
dry-run     stdin SHA-256  7e37f6292a4992ec8a30f4f9e0db45b63dfff4739fc796d3b05716453399bf89
telemetry   stdin_sha256   7e37f6292a4992ec8a30f4f9e0db45b63dfff4739fc796d3b05716453399bf89
```

Attempt 1 Review 전문(14,548자)이 `--- REVIEW OF PREVIOUS ATTEMPT ---`로
worker stdin에 그대로 들어갔다. **Human 재요약 0건, hand-written prompt 0건.**

## 17. T-900 Self-dogfooding — 관측 사실

**T-900의 `request-changes` 전이는 T-900 Attempt 1이 구현한 last-verdict 해석을
실제로 사용해 실행됐다.** 가드가 attempt 1 Review의 마지막 판정
(`CHANGES_REQUESTED`)을 읽어 통과시켰다.

Attempt 1 Review 파일에는 그 시점에 attempt 1 항목이 하나뿐이었으므로
**옛 구현으로도 같은 결과가 나왔을 것이다.** 따라서 이 실행은
"마지막 판정 선택"이 여러 항목 중에서 동작함을 증명하지는 않는다 —
그 증명은 §10의 6종 fixture가 담당한다.

**과장 없이: hotfix가 자기 rework lifecycle에 처음 적용됐다는 사실만 기록한다.**

## 18. Partial Write / Privacy

`section()`과 `effectiveAmendments()`는 **읽기 전용**이다 —
events 쓰기 0 · state 쓰기 0 · Task body 쓰기 0 · amendment 쓰기 0.

`events.jsonl` 36 → 44줄 **증가만**(append-only 유지) ·
temp 파일 잔존 **0건** · run artifact JSON **5개 전부 유효**.

민감정보 — telemetry · run artifact · Report에서 홈 절대경로 · 이메일 **각 0건**.

## 19. FU-1 ~ FU-4 Preservation

| | 상태 |
|---|---|
| FU-1 docs ownership | **미해결 유지** — `docs/` 변경 0건 |
| FU-2 Reviewer Criteria Assessment template | 미해결 유지 |
| FU-3 TELEMETRY.md 규범 지위 | 미해결 유지 |
| FU-4 block/unblock 미구현 | 미해결 유지 (명령 0건) |

**해결한 척하지 않았다.**

---

## Criteria Assessment (RFC-001 §4 MUST — 51항목 전수)

증거: `M` 기계 검증 · `T` 테스트 · `X` 격리 실행 · `S` 시뮬레이션 · `R` 실행 기록

| # | 판정 | 근거 |
|---|---|---|
| 1 | PASS | X approve가 마지막 항목으로 결정 (6/6) |
| 2 | PASS | X `BLOCKED`→`APPROVED` 성공 |
| 3 | PASS | X `APPROVED`→`BLOCKED` 실패 |
| 4 | PASS | X 마지막이 `CHANGES_REQUESTED` → 실패 |
| 5 | PASS | M `existsReview`가 동일 `lastReviewVerdict` 사용 |
| 6 | PASS | T `request-changes accepts CHANGES_REQUESTED appended after BLOCKED` |
| 7 | PASS | T 마지막이 `APPROVED`면 request-changes 실패 |
| 8 | PASS | T `approve ignores verdicts from other attempts` |
| 9 | PASS | T `reviewer verdict uses APPROVED appended after BLOCKED` |
| 10 | PASS | T `BLOCKED reviewer verdict escalates unreadable` |
| 11 | PASS | T `treats BLOCKED appended after APPROVED as unreadable` |
| 12 | PASS | X 단일 항목 파일에서 이전과 동일 (`APPROVED만` → 성공) |
| 13 | PASS | T `missing reviewer verdict escalates unreadable` |
| 14 | PASS | M 판정 헤딩 형식 불변 |
| 15a | PASS | M `export function effectiveAmendments` 1건 |
| 15b | PASS | X 디렉터리 없음 → `[]` |
| **15c** | **PASS** | **X+S 실제 Task 형태에서 1건 탐지 — F-1 해소.** T-013 A001 시뮬레이션 확인 |
| 15d | PASS | X `approved_by` 빈 값 → 제외 |
| 15e | PASS | X `proposed_by === approved_by` → 제외 |
| 15f | PASS | X `task` 불일치 → 제외 |
| **15g** | **PASS** | **M+T 더 이상 vacuous하지 않다** — 실제 AC 인식 위에서 `AC 99`가 제외된다 |
| 15h | PASS | X 호출 전후 Task 바이트 동일 |
| 15 | PASS | M 변경 source file은 `cli.ts` 하나 (`reviewer.ts`도 무변경) |
| 16 | PASS | M 새 source file 0 |
| 17 | PASS | M T-013 소스 5개 해시 동일 |
| 18 | PASS | M `docs/` 변경 0건 |
| 19 | PASS | M 저장소 `.bcos/amendments/` 없음 |
| 20 | PASS | M `--help` 명령 집합 불변 |
| 21 | PASS | M 새 이벤트 0 · `state.json` 키 불변 |
| 22 | PASS | M class·interface·registry 0건 |
| 23 | PASS | M events 36→44줄, 증가만 |
| 24 | PASS | M G5 불변 · rework 전이에서 실제 작동 |
| 25 | PASS | M G3 불변 |
| 26 | PASS | R attempt 1→2, `TASK_STARTED` 추가 없음 |
| 27 | PASS | M 상태 5·전이 7 불변 |
| 28 | PASS | M `state.json` 재생성 가능 |
| 29 | PASS | 기존 234개 통과 |
| 30 | PASS | T `task execute` 회귀 없음 |
| 31 | PASS | T `--review` 회귀 없음 |
| 32 | PASS | R rework 루프 실제 실행 성공 |
| 33 | PASS | T `task status`·run artifact 회귀 없음 |
| 34 | PASS | T stdin SHA 계약 회귀 없음 |
| 35 | PASS | T telemetry 키 불변 |
| 36 | PASS | M T-013 아티팩트 10/10 동일 |
| 37 | PASS | **Reviewer 직접** build exit 0 |
| 38 | PASS | **Reviewer 직접** 239 pass / 0 fail (≥234) |
| 39 | PASS | M skip·todo 0건 |
| 40 | PASS | M deps 0 / devDeps 2 |
| 41 | PASS | M cli 520≤520 · reviewer 87≤95 |
| 42 | PASS | M telemetry·artifact·Report 홈 경로 0건 |
| 43 | PASS | M 새 쓰기 경로 0 · temp 잔존 0 · JSON 5개 유효 |

**집계 — PASS 51 · FAIL 0 · SUPERSEDED 0 · N/A 0.**
T-900에는 아직 Amendment가 없으므로 `SUPERSEDED`를 쓰지 않았다.

---

## Findings

| | 등급 | 유형 | 내용 |
|---|---|---|---|
| M-1 | Minor | Architecture | `lastReviewVerdict` 정규식이 `cli.ts`·`reviewer.ts`에 **여전히 중복**. 현재 바이트 동일하나 한쪽만 고치면 조용히 갈라진다. Attempt 1에서 제기했고 이번 범위가 아니어서 유지된다 |
| M-2 | Minor | — | `cli.ts` **520/520**, headroom 0. 이번엔 순증 0으로 해결됐으나 다음 변경은 즉시 상한에 닿는다 |
| I-1 | Info | Architecture | `dist/cli.js` import 부작용은 **기존 성질**(구 빌드에서도 재현). 향후 source split 신호 |
| I-2 | Info | Process | **synthetic fixture가 실제 문서 shape의 결함을 가릴 수 있다** — Attempt 1이 그 사례다. AC 1만 쓰는 fixture가 잘림 결함을 통과시켰다. 이번 rework는 실제 Task 문서로 검증하는 절차를 추가해 해소했고, 이 교훈은 후속 Task 설계에 남긴다 |
| I-3 | Info | — | **T-013 복구는 아직 실제 저장소에서 실행되지 않았다.** 격리 사본에서만 검증됐다. 실제 실행은 Human/Manager 단계다 |

**Blocking 0 · Major 0.** M-1·M-2·I-1은 Attempt 1에서 이미 기록했고 이번 범위가
아니다. I-2는 이번 attempt가 실제로 개선한 항목이므로 기록만 한다.

---

## Required Changes

**없다.** Attempt 1의 Blocking F-1이 해소됐고 51개 AC가 전부 충족된다.

---

## Verdict

**APPROVED**

Attempt 1의 Blocking Finding이 최소 범위로 해소됐다 — 중복 정규식 두 개를
helper 하나로 합쳐 순증 0, 새 파일 0, 새 명령 0, 의존성 0.
정상 판정됐던 로직(last verdict · 네 조건 · SoD · BLOCKED semantics)은 손대지 않았다.
T-013 산출물은 10/10 바이트 동일하고 lifecycle도 무변경이다.

**T-013 Protocol deadlock은 이제 안전하게 풀 수 있다** — 격리 사본에서
amendment 탐지부터 `DONE / attempt 2`까지 11단계가 전부 통과했고,
worker attempt 3 없이, 기존 BLOCKED 이력을 지우지 않고 끝난다.

**실제 T-013 복구는 이 Review에서 실행하지 않는다.** Human/Manager 단계다.
