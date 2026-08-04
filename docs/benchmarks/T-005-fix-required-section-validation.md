# T-005 Benchmark

**버그 수정 Task.** 신규 기능이 아니라 T-003이 만든 검증 로직의 결함을 고쳤다.
앞선 네 Task와 성격이 또 다르므로 **개선율을 계산하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-005 — Fix required section validation for standard Markdown spacing |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. 이 Task가 검출하고 고친 결함

**수치보다 이 항목이 먼저다.**

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| **수정 전 거부된 실제 Task 문서** | **4 / 4** | Measured | 컴파일된 CLI로 T-001~T-004 복사본 실행, 전부 `exit 1` |
| **수정 후 실제 T-004 형식 통과** | **yes** | Measured | 실제 파일 복사본으로 `exit 0`, 아래 §2 |
| 결함이 존재한 기간 | T-003 승인 ~ T-005 | Measured | T-003 커밋 `d49c2fb` 이후 |
| T-003에서 이 결함을 놓친 이유 | fixture 비현실성 | Measured | 아래 §3 |

`bcos task start`는 T-003에서 구현되고 11개 테스트가 전부 통과했으나,
**이 저장소의 어떤 Task 문서도 통과시키지 못하는 상태였다.** T-005 이전까지
이 명령이 실제 Task에서 동작한 적은 한 번도 없다.

---

## 2. 실제 T-004 재현 (Measured)

실제 `.bcos/tasks/` 전체와 `events.jsonl`, `state.json`을 임시 디렉터리에 복사한 뒤
수정 없이 실행했다.

```text
node dist/cli.js task start T-004 --actor-role worker --actor-id codex-cli
exit=0

status   TODO → IN_PROGRESS
attempt  0 → 1
본문 md5  7ba144a1333981aa8b8af4d7e3dc58be → 7ba144a1333981aa8b8af4d7e3dc58be (동일)
events   9줄 → 10줄, TASK_STARTED 1건
state    counts {"TODO":1,"IN_PROGRESS":1,"IMPLEMENTED":0,"DONE":3,"BLOCKED":0}
         current_task "T-004"
```

수정 전 동일 파일: `Task T-004 has an empty required section` (exit 1).

---

## 3. Fixture 현실성 — 이번에 확인한 사실

T-003의 테스트 11개는 전부 다음 형태의 합성 fixture를 썼다.

```
## Objective
x
```

제목 다음 줄에 본문이 바로 온다. 그런데 이 저장소의 실제 Task 문서는 전부
표준 Markdown 관례대로 제목 뒤에 빈 줄을 둔다.

| | T-003 | T-005 |
|---|---:|---:|
| 테스트 개수 | 11 | 23 |
| 그중 실제 Task 형식을 쓴 것 | **0** | **1** (테스트 18번) |
| 실제 Task 문서 통과 여부 | 0 / 4 | 4 / 4 |

**테스트 개수는 결함 검출력과 무관했다.** 11개가 전부 통과하는 동안 실제 형식은
한 번도 실행되지 않았다. 검출력을 만든 것은 개수가 아니라 **fixture 하나의 현실성**이다.

이 수치를 품질 향상률로 환산하지 않는다. 11 → 23은 규모 변화이지 품질 변화가 아니다.

---

## 4. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total / passed / failed | 18 / 18 / 0 | Measured | reviewer 독립 재현 |
| **AC Pass Rate** | **100.0%** | Derived | 18 / 18 |
| **Tests before → after** | **11 → 23** | Measured | `npm test` 출력 |
| 신규 validator 테스트 | **12** | Measured | 통과 7종 + 거부 5종 |
| **Test Pass Rate** | **100.0%** | Derived | 23 / 23 |
| Build result | SUCCESS | Measured | `dist/` 삭제 후 `tsc` exit 0 |
| **First Review verdict** | **APPROVED** | Measured | 첫 리뷰에서 승인 |
| Attempts | 1 | Measured | 재작업 없음 |
| Rework required | No | Measured | — |
| **Scope Violations** | **0** | Measured | Review §Scope Violations |
| **Ponytail Violations** | **0** | Measured | Review §Ponytail Violations |

reviewer는 worker 테스트와 별개로 **자체 fixture 12종**(통과 6 + 거부 6)을 만들어
`.bcos` 트리 전체 md5로 실패 시 파일 무변경을 확인했다. 12/12 일치.

---

## 5. Change Size

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| **`src/cli.ts` LOC before → after** | **154 → 159 (+5)** | Measured | `wc -l` |
| `src/cli.ts` diff | +8 / −3 | Measured | `git diff --numstat` |
| `tests/cli.test.ts` diff | +116 / −0 | Measured | 32 → 310줄 |
| 제품 변경 줄 수 | +124 / −3 | Measured | `git diff --shortstat` |
| Report LOC | 112 | Measured | `wc -l` |
| 테스트 / 구현 LOC 비율 | **14.5** | Derived | 116 / 8 |
| 새 소스 파일 | **0** | Measured | 함수 개수 T-003과 동일 (5개) |
| 새 import | **0** | Measured | `node:fs`·`node:path`·`node:url` 그대로 |
| **Runtime dependencies added** | **0** | Measured | `dependencies` 키 부재 |
| devDependencies | 2 | Measured | 버전 문자열 무변경 |

**구현 5줄, 테스트 116줄.** 비율 14.5는 이 Task의 성격을 그대로 보여준다 —
고칠 코드는 적었고, 같은 결함이 재발하지 않도록 막는 데 대부분의 작업이 들어갔다.

---

## 6. Context

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| Worker Prompt Characters (본문) | 4,595 | Measured | `---` 사이 코드포인트 |
| Worker Prompt Lines | 162 | Measured | — |
| Estimated Tokens | 1,149 | **Estimated** | 문자수 ÷ 4. tokenizer 미사용 |
| Files Allowed (Read List) | 8 | Measured | Task `Expected Files` |
| Files Read | 8 | Measured (자기보고) | Report `Context Used` |
| **Read List 밖 접근** | **0** | Measured (자기보고) | **네 Task 만에 처음 0건** |
| tracked 파일 수 | 45 | Measured | `git ls-files \| wc -l` |
| Read Scope Ratio | 17.8% | Derived | 8 / 45 |

**Read List 밖 접근이 처음으로 0건이다.** T-001~T-004는 매번 실행 프롬프트 자신을
읽어야 해서 1건씩 발생했다. T-004부터 프롬프트를 Read List에 포함시킨 조치의 결과이며,
**설계 변경으로 해소된 것이지 worker 행동이 달라진 것이 아니다.**

---

## 7. Reliability

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| PowerShell execution policy failure | 0 | Measured | 이번에는 발생하지 않음 |
| Sandbox failure | 0 | Measured | — |
| **Code failures** | **0** | Measured | 구현 결함 실패 없음 |
| **Environment failures** | **0** | Measured | reviewer·worker 양쪽 |
| 전역 `bcos` PATH 부재 | 해당 | Measured | `node dist/cli.js`로 검증. **blocker 아님** |
| Human 승인 횟수 | N/A | **N/A** | Report에 기록 없음. 추정하지 않는다 |
| Human 내용 개입 | 0 | Measured (자기보고) | Deviations에 지시 변경 기록 없음 |
| Windows 재현 | **Yes** | Measured | reviewer가 Windows에서 전 경로 재실행 |

---

## 8. Lifecycle

| 지표 | 값 | 종류 |
|---|---:|---|
| lifecycle 커버리지 | 7개 전이 중 **1개** (`start`) | Measured |
| T-005 자신의 lifecycle 기록 | **없음** — 사후 복구 필요 | Measured |
| 사후 복구가 필요했던 Task 누계 | **4** (T-001·T-002·T-003·T-005) | Measured |

T-003 승인 시 "T-003이 수동 복구가 필요한 마지막 Task"라고 기록했으나 **틀렸다.**
T-005의 `bcos task start`가 실행되지 않아 다시 복구가 필요하다.

원인은 도구가 아니라 절차다. 명령은 존재했고 T-005 형식은 통과 가능했으나,
human이 Codex 실행 전에 전이를 기록하는 단계를 건너뛰었다.
**자동화가 도구만으로 완성되지 않는다는 관측이다.**

---

## 9. 지금 쓸 수 있는 사실

- 실제 Task 문서 **4개 전부가 거부되던 상태에서 4개 전부 통과로** 바뀌었다.
- `bcos task start`가 **실제 Task에서 처음으로 동작한다.**
- 구현 변경은 **5줄**이며 새 파일·새 의존성·새 abstraction은 0건이다.
- 실패 경로 12종에서 파일 변경 0건을 `.bcos` 트리 해시로 확인했다.
- 다섯 Task 연속 **1회 시도 승인, 범위 이탈 0건, Ponytail 위반 0건**이다.

## 10. 아직 쓸 수 없는 주장

- **"테스트 11 → 23으로 품질 N% 향상"** — 개수는 검출력과 무관했다. §3이 그 증거다.
- **"lifecycle 자동화 완료"** — 7개 전이 중 1개다. T-005 자신도 수동 복구가 필요하다.
- **"컨텍스트 절감"** — Read Scope Ratio 하락에 저장소 성장과 Read List 설계 변경이 섞여 있다.

## 11. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| lifecycle 기록 누락 | 도구가 있어도 human이 건너뛴다 | `submit`·`approve` 구현 후 절차 단순화 |
| Files Read | 자기보고, 감사 불가 | 감사 가능한 기록 수단 |
| fixture 현실성 | T-003에서 실패 사례 발생 | 실제 산출물 형식 fixture를 AC로 강제 (T-005에서 도입) |
| Human approvals | Report에 항목 없음 | Report 포맷 결정 |
