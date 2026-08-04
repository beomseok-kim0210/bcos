# T-004 Benchmark

**두 번째 lifecycle 전이.** T-003(첫 전이)과 **성격이 같은 작업**이므로 두 값을 나란히 둘 수 있다.
그래도 개선율로 환산하지 않는다 — 표본이 2건이고, 두 번째가 첫 번째의 인프라를 물려받는 것은
당연하기 때문이다.

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-004 — Implement bcos task submit with report guard |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Lifecycle — 이번 Task의 가장 중요한 기록

| 지표 | 값 | 종류 | 근거 |
|---|---|---|---|
| **`task start` 자동 기록** | **yes** | Measured | `TASK_STARTED` `2026-08-04T07:48:31.075Z` |
| **`task submit` 자동 기록** | **yes** | Measured | `TASK_SUBMITTED` `2026-08-04T07:55:47.593Z` |
| 사후 복구 필요 여부 (start·submit) | **no** | Measured | 아래 판별 근거 |
| 사후 복구 필요 여부 (approve) | **yes** | Measured | `task approve` 명령 없음 |
| **Lifecycle coverage** | **2 / 7 transitions** | Derived | `start`, `submit` |

**실시간 기록임을 판별한 근거 3가지 (Measured)**

1. 밀리초가 임의값이다 — `.075`, `.593`. 복구 이벤트는 한 시각에 `.001`/`.002`/`.003`을 붙인다.
2. 두 이벤트 간격이 **7분 16초**다. 복구는 같은 초 안에서 끝난다.
3. Report 작성 시각 `07:53:53.989Z`가 두 이벤트 **사이**에 있다. 시작 → 작업 → Report → 제출
   순서가 시간축에서 성립한다.

**T-001~T-005는 전부 사후 복구가 필요했다. T-004에서 start·submit 두 전이가 처음으로
실시간 기록됐다.**

### Manual lifecycle edits / steps

`IN_PROGRESS → IMPLEMENTED` 전이 1회 기준. 절대 수치만 기록한다.

| 지표 | Before (수동) | After (T-004) | 종류 |
|---|---:|---:|---|
| Manual lifecycle edits (파일) | **3** | **0** | Measured |
| Human manual steps | **5** | **1** | Measured |

**Before 5단계** — ① Task `status` 수정 ② Task `updated` 수정 ③ `events.jsonl`에 JSON 한 줄
작성·append ④ `state.json` counts 재계산·수정 ⑤ `state.json` `current_task`·`updated` 수정

**After 1단계** — `bcos task submit <id> --actor-role <role> --actor-id <id>`

`start`(6단계)보다 하나 적은 이유는 submit이 `attempt`를 건드리지 않기 때문이다.

**Partial writes in failure paths: 0** (Measured) — reviewer가 실패 6종
(없는 ID / `IN_PROGRESS` 아님 / Report 없음 / attempt 항목 없음 / `--actor-id` 누락 /
`--actor-role` 누락)을 각각 실행하고 `.bcos` 트리 전체 md5를 실행 전후 비교했다. 6/6 동일.

---

## 2. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total / passed / failed | 16 / 16 / 0 | Measured | reviewer 독립 재현 |
| **AC Pass Rate** | **100.0%** | Derived | 16 / 16 |
| **Tests** | **31 / 31** | Measured | `npm test`, 23 → 31 |
| 신규 submit 테스트 | 8 | Measured | 성공 3 + 실패 5 |
| **Test Pass Rate** | **100.0%** | Derived | 31 / 31 |
| Build result | SUCCESS | Measured | `dist/` 삭제 후 `tsc` exit 0 |
| **First Review Verdict** | **APPROVED** | Measured | 첫 리뷰에서 승인 |
| Attempts | 1 | Measured | 재작업 없음 |
| **Scope Violations** | **0** | Measured | Review §Scope Violations |
| **Ponytail Violations** | **0** | Measured | Review §Ponytail Violations |

**G3 가드 정확성 (Measured)** — reviewer가 `## Attempt 9`만 있는 Report로 `attempt: 1`
Task를 submit해 거부됨을 확인했다. "Report 파일 존재"가 아니라 **"현재 attempt 항목 존재"**
를 검사한다. 재작업 시 이전 attempt Report로 통과하는 구멍이 없다.

---

## 3. Change Size

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| **`src/cli.ts` LOC** | **159 → 234 (+75)** | Measured | `wc -l` |
| `src/cli.ts` diff | +103 / −28 | Measured | `git diff --numstat` |
| `tests/cli.test.ts` diff | +98 / −3 | Measured | 310 → 405줄 |
| 제품 변경 줄 수 | +201 / −31 | Measured | `git diff --shortstat` |
| Report LOC | 132 | Measured | `wc -l` |
| 새 소스 파일 | **0** | Measured | 전부 `src/cli.ts` |
| 새 import | **0** | Measured | `node:fs`·`node:path`·`node:url` 그대로 |
| **Runtime dependencies added** | **0** | Measured | `dependencies` 키 부재 |
| devDependencies | 2 | Measured | 버전 무변경 |

### T-003 대비 — 두 번째 전이 추가 비용

**같은 성격의 작업이므로 비교 가능한 유일한 쌍이다.**

| | T-003 (첫 전이 `start`) | T-004 (두 번째 전이 `submit`) |
|---|---:|---:|
| `src/cli.ts` 증가량 | **+136** (18 → 154) | **+75** (159 → 234) |
| 신규 테스트 | 8 (3 → 11) | 8 (23 → 31) |
| 가드 개수 | 5 | 4 |

두 번째 전이가 첫 번째보다 55줄 적게 들었다. 원인은 **공통 함수 3개**
(`actorArguments`, `readTaskSet`, `persistTransition`)를 뽑아 `start`와 공유했기 때문이다.

**이 차이를 개선율로 환산하지 않는다.** 두 번째 전이가 첫 번째의 인프라를 재사용하는 것은
구조상 당연하며, 표본이 2건이라 경향이라고 부를 수 없다. 세 번째 전이(`approve`)의
증가량이 나오면 그때 다시 본다.

---

## 4. Context

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| Worker Prompt Characters (본문) | 4,396 | Measured | `---` 사이 코드포인트 |
| Estimated Tokens | 1,099 | **Estimated** | 문자수 ÷ 4. tokenizer 미사용 |
| Files Allowed (Read List) | 7 | Measured | Task `Expected Files` |
| Files Read | 7 | Measured (자기보고) | Report `Context Used` |
| **Read List 밖 접근** | **0** | Measured (자기보고) | 두 Task 연속 0건 |
| tracked 파일 수 | 48 | Measured | `git ls-files \| wc -l` |
| Read Scope Ratio | 14.6% | Derived | 7 / 48 |

Read List 밖 접근이 T-005에 이어 **두 Task 연속 0건**이다. T-004부터 실행 프롬프트를
Read List에 포함시킨 설계 변경의 결과이며, worker 행동이 달라진 것이 아니다.

---

## 5. Reliability

| 지표 | 값 | 종류 |
|---|---:|---|
| **Code failures** | **0** | Measured |
| **Environment failures** | **0** | Measured — worker·reviewer 양쪽 |
| PowerShell execution policy failure | 0 | Measured |
| Human 승인 횟수 | N/A | **N/A** — Report에 기록 없음. 추정하지 않는다 |
| Human 내용 개입 | 0 | Measured (자기보고) — Deviations `None` |
| Windows 재현 | **Yes** | Measured — reviewer가 전 경로 재실행 |

worker Report의 `Deviations`가 처음으로 `None`이다. T-001~T-005는 매번 환경 이슈나
Read List 이탈이 있었다.

---

## 6. 다섯 Task 병기

**개선율을 계산하지 않는다.** 성격이 전부 다르다.

| 지표 | T-001 | T-002 | T-003 | T-005 | T-004 |
|---|---:|---:|---:|---:|---:|
| 성격 | 생성 | 2줄 수정 | 첫 전이 | 버그수정 | 두 번째 전이 |
| AC | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | **31/31** |
| `src/cli.ts` LOC | 18 | 18 | 154 | 159 | **234** |
| Attempts | 1 | 1 | 1 | 1 | 1 |
| Scope violations | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 |
| Read List 밖 접근 | 1 | 1 | 1 | 0 | 0 |
| Environment failures | 3 | 2 | 1 | 0 | 0 |
| 사후 복구 필요 | yes | yes | yes | yes | **approve만** |

다섯 Task 연속 **1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0**이다. 관측된 사실이며,
성격이 서로 다른 5건이므로 아직 경향이라고 부르지 않는다.

---

## 7. 지금 쓸 수 있는 사실

- `start`와 `submit` 두 전이가 **실시간으로 기록됐다.** 사후 복구 없이 진행된 첫 Task다.
- **G3 가드가 동작한다** — Report가 없거나 현재 attempt 항목이 없으면 제출이 거부된다.
- 실패 경로 6종에서 **partial write 0건**을 `.bcos` 트리 해시로 확인했다.
- 두 번째 전이 추가에 `src/cli.ts` **75줄**이 들었다. 새 파일·새 의존성·새 abstraction은 0건이다.
- `IN_PROGRESS → IMPLEMENTED` 전이의 사람 편집 파일이 **3 → 0**, 단계가 **5 → 1**로 바뀌었다.

## 8. 아직 쓸 수 없는 주장

- **"두 번째 전이가 45% 저렴했다"** — 표본 2건이고 인프라 재사용은 구조상 당연하다.
- **"lifecycle 자동화 완료"** — 7개 전이 중 2개다. `approve`는 여전히 수동이다.
- **"SoD가 강제된다"** — G5는 아직 코드에 없다. `approve` 구현 전까지는 문서상의 약속이다.
- **"컨텍스트 절감"** — Read Scope Ratio 하락에 저장소 성장과 Read List 설계 변경이 섞여 있다.

## 9. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| **SoD 강제** | G5가 문서상의 약속 | `task approve` 구현 — 이 프로토콜의 핵심 주장이 코드가 되는 지점 |
| lifecycle 커버리지 | 2 / 7 | `approve` 이후 4 / 7 (`block`·`unblock` 포함 시) |
| `src/cli.ts` 크기 | 234줄, 상한 250 근접 | 세 번째 전이 설계 시 분리 여부 판단 |
| Files Read | 자기보고, 감사 불가 | 감사 가능한 기록 수단 |
| Human approvals | Report에 항목 없음 | Report 포맷 결정 |
