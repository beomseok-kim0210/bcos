# T-006 Benchmark

**세 번째 lifecycle 전이.** T-003(첫 전이) · T-004(두 번째 전이)와 성격이 같으므로
세 값을 나란히 둘 수 있다. **절대값만 기록하고 개선율은 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-006 — Implement bcos task approve with review and separation-of-duties guards |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. 이 Task가 바꾼 것 — SoD가 코드가 됐다

**수치보다 이 항목이 먼저다.**

| 지표 | Before | After | 종류 |
|---|---|---|---|
| **SoD 강제 수단** | 문서상의 약속 | **실행되는 가드** | Measured |
| **SoD guard 차단 테스트** | 0 | **3** | Measured |
| **Review guard 차단 테스트** | 0 | **4** | Measured |

**SoD guard 3건** — ① 제출자와 동일 actor 승인 거부 ② `TASK_SUBMITTED` 이벤트 부재 시 거부
③ attempt 2에서 현재 attempt 제출자 거부 (이전 attempt 제출자는 통과)

**Review guard 4건** — ① Review 파일 없음 ② 현재 attempt 항목 없음
③ `CHANGES_REQUESTED` ④ `BLOCKED` 및 그 밖의 판정

reviewer 독립 실행 결과다.

```text
제출자 codex-cli → 승인 시도 codex-cli
  exit=1  "The submitting actor cannot approve the same attempt"
  .bcos 트리 md5 동일 (partial write 0)

제출자 codex-cli → 승인 claude-code
  exit=0  TASK_APPROVED 기록
```

T-001~T-005에서 이 규칙은 사람이 지켰다. **T-006부터 도구가 지킨다.**

---

## 2. Lifecycle

| 지표 | 값 | 종류 |
|---|---:|---|
| **Lifecycle coverage** | **3 / 7 transitions** | Derived |
| 자동화된 전이 | `start`, `submit`, `approve` | Measured |
| 미구현 전이 | `block`, `unblock`, `request-changes`, `create` | Measured |
| T-006 자신의 start·submit | **실시간 기록** | Measured |
| 사후 복구 필요 여부 | **no** (approve 포함) | Measured |

**실시간 기록 근거** — `TASK_STARTED` `02:53:47.287Z`, `TASK_SUBMITTED` `03:11:03.989Z`.
밀리초가 임의값이고 간격이 17분 16초이며, Report 작성 시각 `03:08:46.887Z`가 두 이벤트
사이에 있다. T-004에 이어 두 번째다.

### Manual lifecycle steps

`IMPLEMENTED → DONE` 전이 1회 기준. 절대 수치만 기록한다.

| 지표 | Before (수동) | After (T-006) | 종류 |
|---|---:|---:|---|
| Manual files edited | **3** | **0** | Measured |
| Human manual steps | **5** | **1** | Measured |

**Before 5단계** — ① Task `status` 수정 ② Task `updated` 수정 ③ `events.jsonl` append
④ `state.json` counts 재계산 ⑤ `state.json` `updated` 수정

**After 1단계** — `bcos task approve <id> --actor-role <role> --actor-id <id>`

**세 전이 전체** — 이제 `start → submit → approve` 한 사이클에 사람이 편집하는 파일이
**9개에서 0개로**, 단계가 **16단계에서 3단계로** 바뀌었다. 이 값은 세 전이의 개별 측정치를
더한 것이며 한 번에 측정한 값이 아니다.

**Partial writes: 0 / 11** (Measured) — reviewer가 실패 11종을 각각 실행하고 `.bcos` 트리
전체 md5를 실행 전후 비교했다. 11/11 동일.

---

## 3. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total / passed / failed | 24 / 24 / 0 | Measured | reviewer 독립 재현 |
| **AC Pass Rate** | **100.0%** | Derived | 24 / 24 |
| **Tests** | **46 / 46** | Measured | 31 → 46 |
| 신규 approve 테스트 | 15 | Measured | 성공 3 + 실패 12 |
| **Test Pass Rate** | **100.0%** | Derived | 46 / 46 |
| Build result | SUCCESS | Measured | `dist/` 삭제 후 `tsc` exit 0 |
| **First Review verdict** | **APPROVED** | Measured | 첫 리뷰 승인 |
| Attempts | 1 | Measured | — |
| **Rework** | **No** | Measured | — |
| **Scope Violations** | **0** | Measured | Review §Scope Violations |
| **Ponytail Violations** | **0** | Measured | Review §Ponytail Violations |

---

## 4. Change Size

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| **`src/cli.ts` LOC** | **234 → 303 (+69)** | Measured | `wc -l` |
| `src/cli.ts` diff | +70 / −1 | Measured | `git diff --numstat` |
| `tests/cli.test.ts` diff | +184 / −4 | Measured | 405 → 585줄 |
| 제품 변경 줄 수 | +254 / −5 | Measured | `git diff --shortstat` |
| Report LOC | 154 | Measured | `wc -l` |
| 테스트 / 구현 LOC 비율 | 2.63 | Derived | 184 / 70 |
| **새 함수** | **1** (`submittedActor`, 11줄) | Measured | — |
| **새 소스 파일** | **0** | Measured | `src/`에 `cli.ts` 하나 |
| 새 import | **0** | Measured | — |
| **Runtime dependencies added** | **0** | Measured | `dependencies` 키 부재 |
| devDependencies | 2 | Measured | 버전 무변경 |

**`src/cli.ts` 상한 330줄 대비 303줄** — 27줄 여유. T-006 설계 시 "310줄 예상"으로
단일 파일 유지를 결정했고 실측이 예측 범위 안이었다.

### 세 전이 코드 증가량 — 절대값 비교

**같은 성격의 작업 3건이므로 처음으로 3점 비교가 가능하다.**

| | T-003 `start` | T-004 `submit` | T-006 `approve` |
|---|---:|---:|---:|
| `src/cli.ts` 증가량 | **+136** (18 → 154) | **+75** (159 → 234) | **+69** (234 → 303) |
| 가드 개수 | 5 | 4 | **6** |
| 신규 테스트 | 8 | 8 | **15** |
| 새 함수 | 7 | 3 | **1** |

**개선율을 계산하지 않는다.** 세 값이 감소 추세로 보이지만, 첫 전이가 인프라 전체를
만들었고 이후 전이가 그것을 재사용하는 것은 구조상 당연하다. T-006은 가드가 가장 많은데
증가량이 가장 작다 — 이는 `persistTransition`·`readTaskSet`·`actorArguments`가
세 번째 호출에서도 그대로 쓰였기 때문이다. **관측된 사실이며 효율 지표가 아니다.**

---

## 5. Context

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| Worker Prompt Characters (본문) | 5,463 | Measured | `---` 사이 코드포인트 |
| Estimated Tokens | 1,366 | **Estimated** | 문자수 ÷ 4. tokenizer 미사용 |
| Files Allowed (Read List) | 8 | Measured | Task `Expected Files` |
| Files Read | 8 | Measured (자기보고) | Report `Context Used` |
| **Read List 밖 접근** | **0** | Measured (자기보고) | **세 Task 연속 0건** |
| tracked 파일 수 | 53 | Measured | `git ls-files \| wc -l` |
| Read Scope Ratio | 15.1% | Derived | 8 / 53 |

Read List 밖 접근이 T-005·T-004에 이어 **세 Task 연속 0건**이다.
T-004부터 실행 프롬프트를 Read List에 포함시킨 설계 변경의 결과다.

---

## 6. Reliability

| 지표 | 값 | 종류 |
|---|---:|---|
| **Code failures** | **0** | Measured |
| **Environment failures** | **0** | Measured — worker·reviewer 양쪽 |
| worker `Deviations` | **None** | Measured — 두 Task 연속 |
| Human 승인 횟수 | N/A | **N/A** — Report에 기록 없음. 추정하지 않는다 |
| Human 내용 개입 | 0 | Measured (자기보고) |
| Windows 재현 | **Yes** | Measured — reviewer가 전 경로 재실행 |

---

## 7. 여섯 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-001 | T-002 | T-003 | T-005 | T-004 | T-006 |
|---|---:|---:|---:|---:|---:|---:|
| 성격 | 생성 | 2줄 수정 | 전이 1 | 버그수정 | 전이 2 | 전이 3 |
| AC | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 | **24/24** |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | 31/31 | **46/46** |
| `src/cli.ts` LOC | 18 | 18 | 154 | 159 | 234 | **303** |
| Attempts | 1 | 1 | 1 | 1 | 1 | 1 |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 |
| Read List 밖 접근 | 1 | 1 | 1 | 0 | 0 | 0 |
| Environment failures | 3 | 2 | 1 | 0 | 0 | 0 |
| 사후 복구 필요 | yes | yes | yes | yes | **no** | **no** |

여섯 Task 연속 **1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0**이다.
관측된 사실이며, 성격이 서로 다른 6건이므로 아직 경향이라고 부르지 않는다.

---

## 8. 지금 쓸 수 있는 사실

- **SoD가 실행되는 가드가 됐다.** 제출자의 승인 시도가 거부되고 파일이 변경되지 않는다.
- `start → submit → approve` **세 전이가 모두 명령**이다. Lifecycle coverage 3/7.
- 실패 경로 **11종에서 partial write 0건**을 `.bcos` 트리 해시로 확인했다.
- 세 번째 전이 추가에 `src/cli.ts` **69줄**, 새 함수 **1개**, 새 파일 **0개**가 들었다.
- `IMPLEMENTED → DONE` 전이의 사람 편집 파일이 **3 → 0**, 단계가 **5 → 1**로 바뀌었다.

## 9. 아직 쓸 수 없는 주장

- **"전이 추가 비용이 감소한다"** — 표본 3건이고 인프라 재사용은 구조상 당연하다.
- **"lifecycle 자동화 완료"** — 7개 중 3개다. `request-changes`는 여전히 수동이다.
- **"SoD가 완전히 보장된다"** — `actor_id`는 자기 신고다. 다른 문자열을 넣으면 통과한다.
  인증은 프로토콜 `0.1`의 알려진 한계다.
- **"컨텍스트 절감"** — Read Scope Ratio 하락에 저장소 성장과 Read List 설계 변경이 섞여 있다.

## 10. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| `request-changes` | 재작업 시 수동 기록 | attempt 증가가 걸린 유일한 미구현 전이 |
| `src/cli.ts` 크기 | 303줄, 상한 330 근접 | 다음 전이 설계 시 분리 트리거 재평가 |
| Actor 인증 | 자기 신고 | 별도 RFC. `0.1` 범위 밖 |
| Files Read | 자기보고, 감사 불가 | 감사 가능한 기록 수단 |
| `1.0` 승격 | 8단계 중 대부분 충족 | RFC-001 §10 재평가 시점 |
