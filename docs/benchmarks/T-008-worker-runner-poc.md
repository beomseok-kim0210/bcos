# T-008 Benchmark

**첫 프로세스 실행 Task.** 앞선 일곱 Task와 성격이 다르다 — 파일을 읽거나 쓰는 대신
**외부 프로세스에 입력을 전달한다.** **개선율을 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-008 — Run a Codex worker with the assembled context package |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Lifecycle

| 지표 | 값 | 종류 |
|---|---:|---|
| **Lifecycle coverage** | **3 / 7 transitions** | Derived |
| 자동화된 전이 | `start`, `submit`, `approve` | Measured |
| 미구현 전이 | `request-changes`, `block`, `unblock`, `create` | Measured |
| T-008의 start·submit | **실시간 기록** | Measured |
| 사후 복구 필요 | **no** | Measured — 네 Task 연속 |
| **Runner가 일으킨 전이** | **0** | Measured |

**T-008은 lifecycle 전이를 추가하지 않는다.** coverage 3/7 유지가 정상이다.
더 중요한 것은 **Runner가 전이를 일으키지 않는다**는 점이다 — Reviewer가 성공·실패
모든 경로에서 `events.jsonl` 줄 수 불변을 확인했다.

**실시간 기록 근거** — `TASK_STARTED` `04:13:25.276Z`, `TASK_SUBMITTED` `04:21:06.265Z`,
Report 작성 `04:20:03Z`가 두 이벤트 사이. 밀리초가 임의값이고 간격이 7분 41초다.

---

## 2. Worker Runner — 이번 Task의 핵심 지표

Reviewer가 **자체 fixture와 가짜 worker `.js`**로 측정했다. 실제 Codex는 호출하지 않았다.

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| **stdin SHA-256 결정성** | **yes** | Measured | dry-run 2회 동일 |
| **조립 = 전달 (해시 대조)** | **yes** | Measured | worker 수신 SHA-256 == dry-run SHA-256 |
| **Task ID argv 포함** | **no** | Measured | argv = `["exec","-","--cd",<root>]` |
| **셸 주입 차단** | **yes** | Measured | `T-500 & echo PWNED > pwned.txt` → exit 1, 파일 미생성 |
| `shell: false` | yes | Measured | `src/runner.ts:160` |
| worker allow list | **1종** (`codex`) | Measured | — |
| sandbox 완화 | **없음** | Measured | `--sandbox` 미전달 |
| **실패 경로 검증 수** | **15종** | Measured | Reviewer 독립 |
| **partial write** | **0 / 15** | Measured | `.bcos/` 재귀 해시 대조 |
| **실패 시 stdout** | **0 byte / 15** | Measured | — |
| non-zero exit 전파 | yes (1·3 확인) | Measured | stderr에 구분 메시지 |
| timeout 동작 | yes | Measured | `--timeout 1` + 10초 worker → 8초 이내 종료 |
| **dry-run stdin 본문 노출** | **없음** | Measured | 전문 출력 옵션 자체가 없음 |
| **실제 Codex 호출** | **0회** | Measured | PATH에서 `codex.js` 제거 후 90/90 pass |

**PATH 제거 검증이 이번 Review의 결정적 절차다.** "테스트가 실제 Codex를 부르지
않는다"는 주장을 코드 읽기가 아니라 **실행으로** 확인했다.

### Context Package (T-008 자신)

| 지표 | 값 | 종류 |
|---|---:|---|
| file count | 8 | Measured |
| characters | 88,904 | Measured |
| lines | 2,560 | Measured |
| bytes | 103,921 | Measured |
| 8,000자 경고 | 발생, exit 0 유지 | Measured |

**세 번째 초과 실측이다.** RFC §6의 8,000자 기준은 실제 Task Read List 앞에서
세 번 연속 무의미했다. **기준 재조정은 여전히 별도 판단이며 여기서 결론 내지 않는다.**

---

## 3. Human Handoff

Worker에게 Context를 전달하는 데 필요한 사람의 단계다. **절대 수치만 기록한다.**

| | T-007 이후 | T-008 이후 |
|---|---|---|
| 단계 수 | **2** | **1** |
| 내용 | ① `task context <id>` 실행 ② 결과를 복사해 Worker에 붙여넣기 | ① `task run <id> --worker codex` 실행 |

**제거된 단계는 정확히 하나 — 복사·붙여넣기다.**

**아직 자동화되지 않은 단계를 명시한다.**

| 단계 | 상태 |
|---|---|
| `task start` | 사람이 실행 |
| **Context 전달** | **T-008이 자동화** |
| Report 작성 확인 | 사람이 확인 |
| `task submit` | 사람이 실행 |
| Review 호출 | 사람이 실행 |
| `task approve` | 사람이 실행 |
| commit · push | 사람이 실행 |

**7단계 중 1단계가 사라졌다.** 이것을 생산성 향상률로 환산하지 않는다.

---

## 4. 결정성 주장 범위

무엇이 결정론적이고 무엇이 아닌지 명시한다. **이 구분을 흐리지 않는다.**

| 결정론적 | 결정론적이지 않음 |
|---|---|
| Prompt 탐색 결과 | Codex의 출력 |
| Context Package 해시 | Codex가 만든 코드 변경 |
| **stdin 해시** | 실행 시간 |
| command · args · cwd | 토큰 사용량 |
| timeout 설정 | worker exit code |

**BCOS가 보장하는 것은 입력이다. 출력이 아니다.**

---

## 5. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total / passed / failed | 46 / 46 / 0 | Measured | Reviewer 독립 재현 |
| **AC Pass Rate** | **100.0%** | Derived | 46 / 46 |
| **Tests** | **90 / 90** | Measured | 66 → 90 |
| 신규 테스트 | 24 | Measured | 삭제 0건 |
| **Test Pass Rate** | **100.0%** | Derived | 90 / 90 |
| **Reviewer 독립 검증 항목** | **88** | Measured | 자체 fixture |
| Reviewer lifecycle 회귀 | 18 / 18 | Measured | 자체 fixture |
| Build result | SUCCESS | Measured | `tsc` exit 0 |
| **First Review verdict** | **APPROVED** | Measured | 첫 리뷰 승인 |
| Attempts | 1 | Measured | — |
| **Rework** | **No** | Measured | — |
| **Scope Violations** | **0** | Measured | Review |
| **Ponytail Violations** | **0** | Measured | Review |
| Findings | 4 (전부 Non-blocking / Informational) | Measured | Review §Findings |

---

## 6. Change Size

| 지표 | 값 | 종류 |
|---|---:|---|
| **`src/runner.ts`** | **206줄 (신규)** | Measured |
| `src/cli.ts` | 318 → 358 (+41 / −1) | Measured |
| `src/context.ts` | 165 → 165 (**무변경**) | Measured |
| `tests/cli.test.ts` | 877 → 1,189 (+312) | Measured |
| **`src/` 총 LOC** | **729** | Measured |
| Report LOC | 125 | Measured |
| 테스트 / 구현 LOC 비율 | 1.27 | Derived — 312 / 246 |
| **새 소스 파일** | **1** (`src/runner.ts`) | Measured |
| `src/` 하위 디렉터리 | **0** | Measured |
| 새 외부 import | **0** | Measured — `node:child_process`·`node:crypto` 추가, 전부 내장 |
| **Runtime dependencies added** | **0** | Measured |
| devDependencies | 2 | Measured |

### 기능 추가 비용 — 절대값 비교

| | T-003 `start` | T-004 `submit` | T-006 `approve` | T-007 `context` | T-008 `run` |
|---|---:|---:|---:|---:|---:|
| 성격 | 전이 1 | 전이 2 | 전이 3 | 파생 산출물 | **프로세스 실행** |
| 코드 증가 | +136 | +75 | +69 | +180 | **+246** |
| 신규 테스트 | 8 | 8 | 15 | 20 | **24** |
| 새 파일 | 0 | 0 | 0 | 1 | **1** |

**T-008은 앞선 넷과 비교 대상이 아니다.** 새 책임(프로세스 실행)이라 재사용할
인프라가 없었고, 코드가 다시 늘어난 것은 예상된 결과다. **추세로 해석하지 않는다.**

---

## 7. Context (Worker 측)

| 지표 | 값 | 종류 |
|---|---:|---|
| Worker Prompt Characters | 5,642 | Measured |
| Estimated Tokens | 1,411 | **Estimated** — 문자수 ÷ 4, tokenizer 미사용 |
| Files Allowed (Read List) | 8 | Measured |
| Files Read | 8 | Measured (자기보고) |
| **Read List 밖 접근** | **0** | Measured (자기보고) — **다섯 Task 연속** |
| tracked 파일 수 | 64 | Measured |
| Read Scope Ratio | 12.5% | Derived — 8 / 64 |

**Files Read는 여전히 worker 자기보고다.** T-008이 Runner를 만들었지만
**실제 투입 집합을 기록하지는 않는다.** 감사 문제는 그대로 남아 있다.

---

## 8. Reliability

| 지표 | 값 | 종류 |
|---|---:|---|
| **Code failures** | **0** | Measured |
| **Environment failures** | **1** | Measured — PowerShell 실행 정책으로 `npm` 대신 `npm.cmd` 진입점 사용 |
| worker `Deviations` | **None** | Measured — 네 Task 연속 |
| worker `Known Risks` | None (Reviewer가 1건 추가) | Measured — Review F-4 |
| Windows 재현 | **Yes** | Measured |

**Environment failure 1건은 코드 실패가 아니다.** worker가 우회 경로를 찾아 진행했고
Report에 밝혔다. T-004 이후 처음 발생했다.

---

## 9. 여덟 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-001 | T-002 | T-003 | T-005 | T-004 | T-006 | T-007 | T-008 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 성격 | 생성 | 2줄 수정 | 전이 1 | 버그수정 | 전이 2 | 전이 3 | Context | **실행** |
| AC | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 | 24/24 | 32/32 | **46/46** |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | 31/31 | 46/46 | 66/66 | **90/90** |
| `src/` 총 LOC | 18 | 18 | 154 | 159 | 234 | 303 | 483 | **729** |
| Attempts | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Read List 밖 접근 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Environment failures | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 1 |
| 사후 복구 필요 | yes | yes | yes | yes | no | no | no | **no** |

여덟 Task 연속 **1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0**이다.
성격이 서로 다른 8건이므로 아직 경향이라고 부르지 않는다.

---

## 10. 지금 쓸 수 있는 사실

- **조립한 stdin이 바이트 단위로 그대로 전달된다.** 해시 대조로 확인했다.
- **같은 입력이 같은 stdin을 만든다.** 타임스탬프가 없어 2회 실행 해시가 같다.
- **실패 15종에서 partial write가 0이고 stdout이 0 바이트다.**
- **Task ID가 argv에 들어가지 않아 셸 메타문자가 실행되지 않는다.** 실제 시도로 확인했다.
- **Runner가 lifecycle 전이를 일으키지 않는다.** 모든 경로에서 `events.jsonl` 불변.
- **테스트가 실제 Codex에 의존하지 않는다.** PATH 제거 후에도 90/90 pass.
- Context 전달의 사람 단계가 **2에서 1로** 바뀌었다.
- 런타임 의존성 0, 새 파일 1개, `src/` 하위 디렉터리 0을 유지했다.

## 11. 아직 쓸 수 없는 주장

- **"Worker 실행 자동화 완료"** — 실제 Codex로 한 Task를 끝까지 돌린 적이 없다.
  검증은 전부 가짜 worker다.
- **"모델 전환 비용 감소"** — 지원 worker가 `codex` 하나뿐이라 전환 자체가 불가능하다.
- **"Files Read 감사 문제 해결"** — Runner가 실제 투입 집합을 기록하지 않는다.
- **"교차 검증 가능"** — 두 번째 worker가 없다.
- **"토큰 N% 절감"** — 비교군이 없고 측정하지 않았다.

## 12. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| **기본 timeout** | 없어서 무한 대기 가능 (Review F-1) | **T-009**에서 기본값 확정 |
| 실제 Codex 실행 | 한 번도 안 해봄 | 실제 Task 1건을 Runner로 완주 |
| stdin 조립 규칙 | Runner 내부 결정 | **T-009 Prompt Builder**가 규격화 |
| 두 번째 worker | 없음 | **T-010 Model Adapter Boundary** |
| `--help` 정보 손실 | actor 플래그가 사라짐 (Review F-2) | 명령별 usage |
| Files Read 감사 | 여전히 자기보고 | Runner가 투입 집합을 기록 |
| RFC-001 §6 | `task show` 8블록이 요약을 요구해 구현 불가 | **§6 개정.** 별도 승인 대상 |
| 8,000자 기준 | 실측 3건이 모두 초과 | 근거 축적 후 재조정 |
