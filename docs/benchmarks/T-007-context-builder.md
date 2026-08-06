# T-007 Benchmark

**첫 Context 산출 Task.** 앞선 여섯 Task와 성격이 다르다 — 상태를 바꾸지 않고
파생 산출물을 만든다. **개선율을 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-007 — Build deterministic context packages from task read lists |
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
| T-007의 start·submit | **실시간 기록** | Measured |
| 사후 복구 필요 | **no** | Measured |

**T-007은 lifecycle 전이를 추가하지 않는다.** coverage가 3/7로 유지되는 것이 정상이며,
로드맵 전환에 따라 나머지 4개는 Context·Runner 계열 이후로 미뤄졌다.

**실시간 기록 근거** — `TASK_STARTED` `03:00:48.781Z`, `TASK_SUBMITTED` `03:11:59.074Z`,
Report 작성 `03:09:03Z`가 두 이벤트 사이. 밀리초가 임의값이고 간격이 11분 10초다.
T-004·T-006에 이어 세 번째로 사후 복구가 없었다.

---

## 2. Context Package — 이번 Task의 핵심 지표

reviewer가 **실제 T-004 Task와 실제 RFC-001을 복사한 fixture**로 측정했다.
Read List 5항목(그중 `AGENTS.md` 중복 1건), 결과 4파일.

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| **file count** | **4** | Measured | 헤더 `files: 4` |
| Read List 기재 항목 수 | 5 | Measured | 중복 1건 포함 |
| **duplicates removed** | **1** | Measured | 5 → 4 |
| **bytes** | **25,289** | Measured | `wc -c` (UTF-8, 한국어 포함) |
| **lines** | **551** | Measured | `wc -l` — 패키지 전체 |
| 본문 characters (헤더 metadata) | 16,466 | Measured | 파일 본문 합계 |
| 패키지 전체 characters | 16,832 | Measured | 경고 판정 기준 |
| **SHA-256 deterministic** | **yes** | Measured | 2회 실행 `3c1d4ef9d5b9a94a…` 동일 |
| **blocked paths** | **6종** | Measured | `..` · 절대경로 · `.env` · `node_modules/` · 바이너리 · 256 KB 초과 |
| 실패 경로 총 검증 수 | 10 | Measured | 위 6종 + 없는 Task · 라벨 없음 · 빈 목록 · 없는 파일 |
| **partial output** | **0 / 10** | Measured | 실패 전부 stdout 0 byte |
| **generation time** | **300 ms** | Measured | Node 프로세스 시작 포함, 단일 실행 |
| Read List 순서 유지 | yes | Measured | 기재 순서와 출력 순서 일치 |
| UTF-8 보존 | yes | Measured | 한국어·`§`·`—` 손상 없음 |

**8,000자 경고** — 실제 패키지가 16,832자로 경고가 발생했고 **exit 0을 유지**했다.
RFC-001 §6의 "경고한다. 실패가 아니다"와 일치한다.

이 수치는 RFC §6이 T-001 실행 후 재검토하라고 남긴 8,000자 기준에 대한 **두 번째 실측**이다.
실제 Task의 Read List를 전부 담으면 8,000자를 크게 넘는다는 것이 확인됐다.
**기준 자체의 재조정은 별도 판단이며 이 Benchmark에서 결론 내지 않는다.**

---

## 3. Human Handoff

Worker에게 Context를 전달하는 데 필요한 사람의 단계다. **절대 수치만 기록한다.**

| | Before | After |
|---|---|---|
| 단계 수 | **4** | **2** |
| 내용 | ① Codex 실행 ② 프롬프트 경로 찾아 전달 ③ 프롬프트가 Read List를 나열해 Worker가 하나씩 읽음 ④ 누락 시 사람이 추가 설명 | ① `task context <id>` 실행 ② 결과를 Worker에 전달 |

**단계 수만 기록하고 토큰 절감률이나 생산성 향상률로 환산하지 않는다.**
비교군이 없고, 두 절차가 만들어내는 결과물의 성격도 다르다.

**아직 0이 아니다.** 이 명령은 Context를 **만들 뿐 전달하지 않는다.**
사람이 결과를 복사해 붙여넣는 단계가 남아 있으며, 그것이 T-008 Runner의 대상이다.

**부수 효과 하나** — `Files Read`가 T-001부터 worker 자기보고였고 감사 수단이 없었다.
Context를 도구가 만들면 그 집합이 **재현 가능한 산출물**이 된다. 아직 Worker가 실제로
그것만 읽었는지는 확인할 수 없으므로 **감사 문제가 해결된 것은 아니다.**

---

## 4. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total / passed / failed | 32 / 32 / 0 | Measured | reviewer 독립 재현 |
| **AC Pass Rate** | **100.0%** | Derived | 32 / 32 |
| **Tests** | **66 / 66** | Measured | 46 → 66 |
| 신규 테스트 | 20 | Measured | — |
| **Test Pass Rate** | **100.0%** | Derived | 66 / 66 |
| Build result | SUCCESS | Measured | `dist/` 삭제 후 `tsc` exit 0 |
| **First Review verdict** | **APPROVED** | Measured | 첫 리뷰 승인 |
| Attempts | 1 | Measured | — |
| **Rework** | **No** | Measured | — |
| **Scope Violations** | **0** | Measured | Review §Scope Violations |
| **Ponytail Violations** | **0** | Measured | Review §Ponytail Violations |

---

## 5. Change Size

| 지표 | 값 | 종류 |
|---|---:|---|
| **`src/context.ts`** | **165줄 (신규)** | Measured |
| `src/cli.ts` | 303 → 318 (+15 / −1) | Measured |
| `tests/cli.test.ts` | 585 → 877 (+292) | Measured |
| 제품 변경 줄 수 | +308 / −1 (기존 2파일) + 165 (신규) | Measured |
| Report LOC | 182 | Measured |
| 테스트 / 구현 LOC 비율 | 1.62 | Derived | 292 / 180 |
| **새 소스 파일** | **1** (`src/context.ts`) | Measured |
| `src/` 하위 디렉터리 | **0** | Measured |
| 새 외부 import | **0** | Measured — `realpathSync`·`statSync` 추가, 전부 `node:fs` |
| **Runtime dependencies added** | **0** | Measured |
| devDependencies | 2 | Measured |

### 기능 추가 비용 — 절대값 비교

| | T-003 `start` | T-004 `submit` | T-006 `approve` | T-007 `context` |
|---|---:|---:|---:|---:|
| 성격 | 전이 1 | 전이 2 | 전이 3 | **파생 산출물** |
| 코드 증가 | +136 | +75 | +69 | **+180** (cli 15 + context 165) |
| 신규 테스트 | 8 | 8 | 15 | **20** |
| 새 파일 | 0 | 0 | 0 | **1** |

**T-007은 앞선 셋과 비교 대상이 아니다.** 전이 셋은 같은 인프라를 공유했지만
T-007은 새 책임이라 재사용할 것이 없었다. 코드가 다시 늘어난 것은 예상된 결과이며
**추세 역전으로 해석하지 않는다.**

**분리 판단 검증** — `cli.ts` 318 + `context.ts` 165 = **483줄**.
단일 파일이었다면 T-006이 정한 400줄 트리거를 실제로 넘었을 것이다.
설계 시점의 "약 403줄" 예측보다 컸고, 분리가 옳았다.

---

## 6. Context (Worker 측)

| 지표 | 값 | 종류 |
|---|---:|---|
| Worker Prompt Characters | 4,552 | Measured |
| Estimated Tokens | 1,138 | **Estimated** — 문자수 ÷ 4, tokenizer 미사용 |
| Files Allowed (Read List) | 8 | Measured |
| Files Read | 8 | Measured (자기보고) |
| **Read List 밖 접근** | **0** | Measured (자기보고) — **네 Task 연속** |
| tracked 파일 수 | 58 | Measured |
| Read Scope Ratio | 13.8% | Derived — 8 / 58 |

---

## 7. Reliability

| 지표 | 값 | 종류 |
|---|---:|---|
| **Code failures** | **0** | Measured |
| **Environment failures** | **0** | Measured — worker·reviewer 양쪽 |
| worker `Deviations` | **None** | Measured — 세 Task 연속 |
| Human 승인 횟수 | N/A | **N/A** — Report에 항목 없음. 추정하지 않는다 |
| Windows 재현 | **Yes** | Measured |

---

## 8. 일곱 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-001 | T-002 | T-003 | T-005 | T-004 | T-006 | T-007 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 성격 | 생성 | 2줄 수정 | 전이 1 | 버그수정 | 전이 2 | 전이 3 | **Context** |
| AC | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 | 24/24 | **32/32** |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | 31/31 | 46/46 | **66/66** |
| `src/` 총 LOC | 18 | 18 | 154 | 159 | 234 | 303 | **483** |
| Attempts | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Read List 밖 접근 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| Environment failures | 3 | 2 | 1 | 0 | 0 | 0 | 0 |
| 사후 복구 필요 | yes | yes | yes | yes | no | no | **no** |

일곱 Task 연속 **1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0**이다.
성격이 서로 다른 7건이므로 아직 경향이라고 부르지 않는다.

---

## 9. 지금 쓸 수 있는 사실

- **같은 입력이 같은 바이트를 만든다.** 2회 실행 SHA-256 일치를 reviewer가 확인했다.
- **실패 10종에서 stdout이 0 바이트다.** 부분 출력이 없어 소비자가 신뢰할 수 있다.
- 민감 경로 6종(`..` · 절대경로 · `.env` · `node_modules/` · 바이너리 · 256 KB 초과)이 차단된다.
- 실제 T-004와 RFC-001 형식을 복사한 fixture에서 동작한다. 합성 fixture만 쓰지 않았다.
- Context 전달의 사람 단계가 **4에서 2로** 바뀌었다.
- 런타임 의존성 0, 새 파일 1개, `src/` 하위 디렉터리 0을 유지했다.

## 10. 아직 쓸 수 없는 주장

- **"토큰 N% 절감"** — 비교군이 없고 측정하지 않았다.
- **"Context 전달 자동화 완료"** — 사람이 결과를 복사해 붙여넣는 단계가 남아 있다.
- **"Files Read 감사 문제 해결"** — Context를 만들 수 있게 됐을 뿐,
  Worker가 그것만 읽었는지는 여전히 확인할 수 없다.
- **"모델 전환 비용 감소"** — Runner가 없어 실제 전환 시나리오를 측정한 적이 없다.
- **"8,000자 기준이 잘못됐다"** — 실측 2건이 넘긴 것은 사실이나 기준 재조정은 별도 판단이다.

## 11. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| Context 전달 | 사람이 복사해 붙여넣는다 | **T-008 Worker Runner PoC** |
| Files Read 감사 | 여전히 자기보고 | Runner가 실제 투입 집합을 기록 |
| `lines` 정의 | `wc -l`과 1 차이 (Review F-1) | 정의 명시 또는 개행 개수 기준 |
| RFC-001 §6 | `task show` 8블록이 요약을 요구해 구현 불가 | **§6 개정.** 별도 승인 대상 |
| 8,000자 기준 | 실측 2건이 모두 초과 | 근거 축적 후 재조정 |
