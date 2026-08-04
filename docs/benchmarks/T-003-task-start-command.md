# T-003 Benchmark

**첫 상태 변경 CLI 실험.** T-001(스캐폴드 생성), T-002(2줄 수정)와 성격이 또 다르므로
**세 Task 사이의 개선율을 계산하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-003 — Implement bcos task start with atomic lifecycle update |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Context

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| Worker Prompt Characters (본문) | 3,702 | Measured | `---` 사이 본문 코드포인트 |
| Worker Prompt Lines (본문) | 136 | Measured | 본문 개행 수 |
| Estimated Tokens | 926 | **Estimated** | 문자수 ÷ 4. **tokenizer 미사용** |
| Files Allowed (Read List) | 6 | Measured | Task `Expected Files` §읽기 허용 |
| Files Read | 7 | Measured (자기보고) | Report `Context Used`. **독립 검증 불가** |
| Read List 밖 접근 | 1 | Measured (자기보고) | 실행 프롬프트 자신 |
| 현재 tracked 파일 수 | 38 | Measured | `git ls-files \| wc -l` |
| **Read Scope Ratio** | **18.4%** | Derived | 7 / 38 |

**해석 주의** — `Files Read`는 자기보고이며 감사 로그가 없다. 세 Task 연속으로 Read List 밖
접근 1건이 발생했고 매번 **실행 프롬프트 자신**이었다. 프롬프트를 읽지 않으면 지시를 받을 수
없으므로 불가피하며, Task 설계 측 갭이다(Review F-4).

---

## 2. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total / passed / failed | 15 / 15 / 0 | Measured | reviewer 독립 재현 |
| **AC Pass Rate** | **100.0%** | Derived | 15 / 15 |
| Tests total / passed | 11 / 11 | Measured | `node:test` |
| **Test Pass Rate** | **100.0%** | Derived | 11 / 11 |
| Build result | SUCCESS | Measured | `dist/` 삭제 후 `tsc` exit 0 |
| First Review verdict | APPROVED | Measured | 첫 리뷰에서 승인 |
| Attempts | 1 | Measured | 재작업 없음 |
| Rework required | No | Measured | — |
| **Scope Violations** | **0** | Measured | 아래 §3 |
| **Ponytail Violations** | **0** | Measured | Review §Ponytail Violations |

---

## 3. Lifecycle Metrics

**이 Task가 실제로 무엇을 바꿨는가.** 아래는 `TODO → IN_PROGRESS` 전이 **1회**를 완료하는 데
필요한 작업량을 동일 요구사항 기준으로 센 값이다. 절대 수치만 기록하며 비율로 환산하지 않는다.

| 지표 | Before (수동) | After (T-003) | 종류 |
|---|---:|---:|---|
| Manual files edited | **3** | **0** | Measured |
| Human manual steps | **6** | **1** | Measured |
| Partial write observed | — | **0건** | Measured |
| State consistency | 수동 대조 | **명령이 보장** | Measured |

**Before 6단계** — ① Task frontmatter `status` 수정 ② `attempt` 수정 ③ `updated` 수정
④ `events.jsonl`에 JSON 한 줄 작성·append ⑤ `state.json` counts 재계산·수정
⑥ `state.json` `current_task`·`updated` 수정

**After 1단계** — `bcos task start <id> --actor-role <role> --actor-id <id>` 실행

이 수치는 T-001·T-002에서 **실제로 수행한 복구 절차**와 T-003 구현물의 관측된 동작을
비교한 것이다. 추정이 아니다. 다만 **동일 요구사항의 작업량 비교이지 품질·속도·비용의
개선율이 아니다.**

**Partial write 검증** — reviewer가 실패 경로 5종(없는 ID / `TODO` 아님 / G1 / G2 /
actor 인자 누락)을 각각 실행하고 `.bcos/` 트리 전체의 md5 해시를 실행 전후 비교했다.
**5종 모두 해시 동일 — 파일 변경 0건.**

**State consistency 검증** — 성공 경로 1회 후 다음을 확인했다.

| 검사 | 결과 |
|---|---|
| Task `updated` == 이벤트 `ts` | 일치 (`…T04:40:31.943Z`) |
| Task 본문 바이트 동일 | md5 `43e28806…` 실행 전후 일치 |
| 이벤트 필드 수 | 정확히 8 |
| `state.json` counts == Task 파일 스캔 결과 | 일치 |
| `current_task` | 시작한 Task id |

**남은 한계** — `submit`·`approve`는 여전히 수동이다. T-003이 자동화한 것은 전체 lifecycle
7개 전이 중 1개이며, 사람이 손대야 하는 전이가 아직 2개 남아 있다.

---

## 4. Change Size

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| 제품 수정 파일 수 | 2 | Measured | `src/cli.ts`, `tests/cli.test.ts` |
| 전체 변경 파일 수 (Report 포함) | 3 | Measured | `git status --short` |
| 제품 변경 줄 수 | +304 / −6 | Measured | `git diff --shortstat` |
| `src/cli.ts` | +139 / −3 | Measured | 18줄 → 154줄 |
| `tests/cli.test.ts` | +165 / −3 | Measured | 32줄 → 194줄 |
| Report LOC | 99 | Measured | `wc -l` |
| 테스트 / 구현 LOC 비율 | 1.19 | Derived | 165 / 139 |
| 새 소스 파일 | **0** | Measured | `src/core`·`src/util` 미생성 |
| runtime dependencies | 0 | Measured | `dependencies` 키 부재 |
| devDependencies | 2 | Measured | 버전 문자열 무변경 |
| 새 dependency | 0 | Measured | — |

**테스트가 구현보다 많다(1.19).** 실패 경로 5종에 각각 파일 무변경 검증이 붙었기 때문이며,
이 Task의 위험이 기능이 아니라 partial write에 있었다는 설계 판단과 일치한다.

---

## 5. Reliability

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| PowerShell execution policy failure | 1 | Measured | worker 측 `npm.ps1` 차단 → `cmd /c` 우회 |
| Sandbox EPERM failure | 0 | Measured | — |
| **Code failures** | **0** | Measured | 구현 결함 실패 없음 |
| **Environment failures** | **1** | Derived | PowerShell 1건 |
| Human 승인 횟수 | N/A | **N/A** | Report에 기록 없음. 추정하지 않는다 |
| Human 내용 개입 | 0 | Measured (자기보고) | Deviations에 지시 변경 기록 없음 |
| Windows 재현 | **Yes** | Measured | reviewer가 Windows에서 전 경로 재실행 |

**환경 실패가 3 → 2 → 1로 줄었다.** 단, 이는 Task 성격 차이일 수 있으므로 개선으로
해석하지 않는다. PowerShell 실행 정책 문제는 세 Task 연속 발생했으므로 환경 설정으로
제거할 가치가 있다.

---

## 6. 세 기준선 병기

**개선율을 계산하지 않는다.** 세 Task는 성격이 전부 다르다 — 생성 / 2줄 수정 / 상태 변경 로직.

| 지표 | T-001 | T-002 | T-003 |
|---|---:|---:|---:|
| Worker Prompt (본문 chars) | 2,953 | 3,170 | 3,702 |
| Files Read (자기보고) | 5 | 7 | 7 |
| tracked 파일 수 (분모) | 18 | 29 | 38 |
| Read Scope Ratio | 27.8% | 24.1% | 18.4% |
| 제품 변경 줄 수 | 87 | 2 | 304 |
| Report LOC | 155 | 105 | 99 |
| AC Pass Rate | 100% (9/9) | 100% (11/11) | 100% (15/15) |
| Test Pass Rate | 100% (3/3) | 100% (3/3) | 100% (11/11) |
| Scope Violations | 0 | 0 | 0 |
| Ponytail Violations | 0 | 0 | 0 |
| Attempts | 1 | 1 | 1 |
| Environment failures | 3 | 2 | 1 |
| Code failures | 0 | 0 | 0 |

**Read Scope Ratio가 27.8% → 24.1% → 18.4%로 낮아졌다.** 그러나 읽은 파일 수는 5 → 7 → 7이고
분모는 18 → 29 → 38로 커졌다. **비율 하락의 주된 요인은 저장소 성장이다.**
컨텍스트 규율의 효과와 분리되지 않았으므로 개선으로 주장하지 않는다.

**세 Task 연속으로 1회 시도 승인, 범위 이탈 0건, Ponytail 위반 0건이다.** 이는 관측된 사실이며,
표본이 3건이고 전부 다른 성격이므로 아직 경향이라고 부르지 않는다.

---

## 7. 지금 쓸 수 있는 사실

- 상태 변경 로직을 다루는 세 번째 Task도 **1회 시도에 승인**됐다. AC 15/15, 테스트 11/11.
- **실패 경로 5종에서 partial write 0건**을 reviewer가 `.bcos/` 트리 해시로 독립 검증했다.
- `TODO → IN_PROGRESS` 전이의 사람 수동 편집 파일이 **3개에서 0개**로, 단계가 **6에서 1**로 바뀌었다.
- 런타임 의존성 0, 새 소스 파일 0, 새 dependency 0을 유지했다.

## 8. 아직 쓸 수 없는 주장

- **"컨텍스트 N% 절감"** — Read Scope Ratio 변화에 저장소 성장 효과가 섞여 있다.
- **"개발 속도 향상"** — 시간을 측정하지 않았다.
- **"lifecycle 자동화 완료"** — 7개 전이 중 1개만 구현됐다. `submit`·`approve`는 수동이다.
- **"프로토콜이 스스로를 강제한다"** — 아직 아니다. 한 전이에 대해서만 참이다.

## 9. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| Files Read | 자기보고, 감사 불가 | 감사 가능한 기록 수단 |
| 실행 프롬프트의 Read List 지위 | 3회 연속 "밖 접근 1건" | Read List 포함 또는 `task show` 구현 |
| Human approvals | Report에 항목 없음 | Report 포맷 결정 |
| lifecycle 커버리지 | 7개 전이 중 1개 | `submit`·`approve` 구현 |
| Worker Time | 시작 시각 로그 부재 | 전이의 실시간 기록 — T-003이 첫걸음 |
