# T-009 Benchmark

**첫 실제 Codex dogfooding Task.** 앞선 여덟 Task와 두 가지가 다르다 —
사람이 프롬프트를 붙여넣지 않았고, **BCOS가 Codex 프로세스를 직접 실행했다.**
**개선율을 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

필드 정의는 [TELEMETRY.md](TELEMETRY.md)에 있다.

| 항목 | 값 |
|---|---|
| Task | T-009 — Build the worker prompt instead of hand-writing one per task |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Quality

| 지표 | 값 | 종류 |
|---|---:|---|
| AC total / passed / failed | 62 / 62 / 0 | Measured |
| **AC Pass Rate** | **100.0%** | Derived |
| **Tests** | **99 / 99** | Measured — 90 → 99 |
| **Test Pass Rate** | **100.0%** | Derived |
| Reviewer 독립 검증 | 99항목 중 98 통과 | Measured |
| Build result | SUCCESS | Measured |
| **First Review verdict** | **APPROVED** | Measured |
| Attempts | 1 | Measured |
| **Rework** | **Yes** | Measured — **아홉 Task 중 처음** |
| **Environment failures** | **1** | Measured — worker 내부 `spawn EPERM` |
| **Test regressions** | **3** | Measured — legacy assertion |
| Review findings | 5 (Blocking 0 / Major 1 / Minor 1 / Info 3) | Measured |
| Scope violations | 0 | Measured |
| Ponytail violations | 0 | Measured |

**Reviewer 독립 검증의 1건 불일치는 구현 결함이 아니다.** Reviewer의 검사식이
preamble 차이를 3줄로 기대했으나 실제로는 2줄이었다 — `worker` 값이 두 fixture에서
모두 `codex`였기 때문이다. 치환 자리 밖은 완전히 동일했다.

## 2. Rework 이력 — 이번 Task의 특징

**두 종류의 실패를 구분해 기록한다.**

| 단계 | 결과 | 분류 |
|---|---|---|
| worker 내부 `npm test` | `spawn EPERM` (errno -4048) — 실행 자체 불가 | **Environment Failure** |
| host `npm test` | 99 tests / 96 pass / **3 fail** | **Test Regression** |
| 재작업 후 `npm test` | 99 tests / **99 pass** / 0 fail | Measured |

**세 회귀의 원인은 legacy assertion 하나뿐이다.** T-009가 Runner 출력을
`telemetry <key>=<value>`로 바꿨는데 기존 테스트가 옛 human-readable 형식을
기대하고 있었다.

| 기존 기대 | 현재 출력 |
|---|---|
| `Worker stdout bytes: <n>` | `telemetry worker_stdout_bytes=<n>` |
| `Worker stderr bytes: <n>` | `telemetry worker_stderr_bytes=<n>` |
| `Worker exit code: 0` | `telemetry worker_exit_code=0` |
| `Worker duration ms: <n>` | `telemetry worker_duration_ms=<n>` |
| `Worker exit code: 3` | `telemetry worker_exit_code=3` |

**재작업에서 제품 코드는 변경되지 않았다.** `tests/cli.test.ts`의 assertion 5줄만
고쳤고 테스트를 추가·삭제·개명하지 않았다. Telemetry 형식이 Task Scope와 AC가
지정한 계약이므로 되돌리지 않은 것이다.

## 3. Prompt Dependency — 이 Task의 핵심 지표

| | Before (T-008) | After (T-009) |
|---|---:|---:|
| Task당 hand-written prompt | **1개** | **0개** |
| T-009 프롬프트 본문 | 5,719자 | — |
| 프롬프트 관련 실패 경로 | **3종** | **0종** |
| 치환 자리 | N/A | **3개** (task id · worker · report path) |
| `.bcos/prompts/` 읽기 | 매 실행 | **없음** |

**여덟 Task 동안 손으로 쓴 프롬프트 크기** — 2,953 · 3,170 · 3,702 · 4,396 ·
4,595 · 5,463 · 4,552 · 5,642자. **T-009가 마지막이다.**

Reviewer가 Prompt 2개 fixture와 빈 fixture의 `stdin_sha256`이 동일함을 확인했다 —
파일이 읽히지 않는다는 직접 증거다.

**preamble 불변성 (Measured)** — 서로 다른 두 Task의 preamble에서 다른 줄은
`task:`와 `report:` **두 줄뿐**이었다. `worker:`는 allow list가 `codex` 하나여서
값이 같다. 치환 자리 밖은 글자 하나도 다르지 않다.

## 4. 실제 Codex Dogfooding — 관측된 사실만

**BCOS가 실제 Codex 프로세스를 직접 실행한 첫 사례다.** 아래는 실행 콘솔에서
관측된 값이며, **BCOS가 파일로 자동 수집한 것이 아니다** (Review F-3).

| 지표 | 값 | 종류 |
|---|---:|---|
| Runner exit code | **0** | Measured |
| worker runtime | **약 359초** | Measured |
| Context files | 8 | Measured |
| Context chars | 99,522 | Measured |
| stdin chars | 105,551 | Measured |
| stdin lines | 3,013 | Measured |
| worker stdout bytes | 663 | Measured |
| worker stderr bytes | 750,989 | Measured |
| 사람이 붙여넣은 프롬프트 | **0** | Measured |
| 사람이 복사한 Context | **0** | Measured |

**stderr 750,989 bytes / stdout 663 bytes** — Codex는 진행 상황을 stderr로 쏟고
stdout은 거의 쓰지 않는다. Runner가 출력을 메모리에 쌓지 않고 흘려보낸 설계가
750 KB 앞에서 실제로 필요했다.

**Context 약 100 KB는 baseline으로만 기록한다.** Context pruning이나 section
extraction의 비교 기준이며, 지금 이 값이 크다 작다를 판단하지 않는다.

**주장하지 않는 것** — 토큰 절감 · 생산성 향상률 · 모델 전환 성공 ·
Context 효율 개선 · Files Actually Read 검증. **어느 것도 측정하지 않았다.**

## 5. Telemetry

| 지표 | 값 | 종류 |
|---|---:|---|
| **TELEMETRY.md 필드 수** | **84** | Measured |
| 카테고리 | 10 | Measured |
| Runner가 출력하는 필드 | 19 | Measured |
| dry-run에서 생략되는 실행 전용 필드 | 5 | Measured |
| 계산 필드(`*_rate`·`*_ratio` 등) | **0** | Measured |
| 파일에 기록되는 Telemetry | **0** | Measured — stdout 전용 |

**가용성 분포 (Measured)**

| 표기 | 뜻 | 대략 |
|---|---|---:|
| `now` | BCOS가 이미 값을 만든다 | 22 |
| `T-009` | 이번에 추가 | 4 |
| `T-010` | Model Adapter 필요 | 9 |
| `manual` | 도구가 관측 불가 | 13 |
| `blocked` | 프로토콜 변경 필요 | 6 |

**T-009가 새로 추가한 것** — `first_worker_response_ms` · `worker_runtime` ·
`worker_timeout_seconds` · `stdin_bytes`.

`first_worker_response_ms`는 추정이 아니라 **실측**이다 — 2초 지연 worker에서
1,000ms를 넘고 `worker_duration_ms >= first_worker_response_ms`가 성립했다.

**여전히 `N/A`인 것** — token 4개 · cost 4개 · `context_tokens`(T-010),
`review_start_time` · `rework_count` · Quality 산문 필드(blocked), `human_*` 전체(manual).

## 6. 기본 timeout — 관측 근거

**1,800초를 골랐다. 600초가 아니다.**

| Task | worker 소요 |
|---|---:|
| T-004 | 437초 |
| T-008 | 461초 |
| T-007 | 670초 |
| **T-006** | **1,037초** |
| **T-009 (실제 Codex)** | **약 359초** |

**600초를 기본값으로 뒀다면 T-006은 정상 작업 중에 죽었을 것이다.**
1,800초는 관측 최댓값의 약 1.7배이며, 무한 대기를 없애면서 정상 작업을 죽이지 않는
가장 작은 값이다. `--timeout`으로 언제든 덮어쓴다.

0 · 음수 · 소수 · 비숫자는 여전히 exit 1이고 **기본값으로 조용히 대체되지 않는다.**

## 7. Change Size

| 지표 | 값 | 종류 |
|---|---:|---|
| `src/runner.ts` | 206 → **245** (+103 / −64) | Measured |
| `src/cli.ts` | 358 → 358 (**무변경**) | Measured |
| `src/context.ts` | 165 → 165 (**무변경**) | Measured |
| `tests/cli.test.ts` | 1,189 → **1,314** (+149 / −24) | Measured |
| **`src/` 총 LOC** | **768** | Measured |
| Report LOC | 233 | Measured |
| **새 소스 파일** | **0** | Measured |
| `src/` 하위 디렉터리 | 0 | Measured |
| **Runtime dependencies** | **0** | Measured |
| devDependencies | 2 | Measured |
| AC 48 상한 250줄 | **245 — 충족** | Measured |

**삭제된 것** — `promptsDirectory` 탐색 · `function extractPrompt` ·
`Expected exactly one Worker Prompt` · `Worker Prompt body is missing`.

## 8. Human Handoff

| | T-008 이후 | T-009 이후 |
|---|---:|---:|
| Context 전달 단계 | **1** | **1** |
| Task당 프롬프트 작성 | **1** | **0** |

**T-009가 없앤 것은 전달 단계가 아니라 작성 단계다.**

**여전히 사람이 하는 것** — `task start` · Report 확인 · `task submit` ·
Review 호출 · `task approve` · commit·push. **6단계.**

**단계 수만 기록하고 생산성으로 환산하지 않는다.**

## 9. Context (Worker 측)

| 지표 | 값 | 종류 |
|---|---:|---|
| Files Allowed (Read List) | 8 | Measured |
| Files Read | 8 | Measured (자기보고) |
| **Read List 밖 접근** | **0** | Measured (자기보고) — 여섯 Task 연속 |
| tracked 파일 수 | 71 | Measured |
| Read Scope Ratio | 11.3% | Derived — 8 / 71 |
| Context SHA-256 (승인 시점) | `d7f7de8edb51e317…` | Measured |

**`Files Read`는 여전히 자기보고다.** Runner가 실제 투입 집합을 기록하지 않는다.

## 10. 아홉 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-001 | T-002 | T-003 | T-005 | T-004 | T-006 | T-007 | T-008 | T-009 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 성격 | 생성 | 2줄 | 전이1 | 버그 | 전이2 | 전이3 | Context | 실행 | **제거** |
| AC | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 | 24/24 | 32/32 | 46/46 | **62/62** |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | 31/31 | 46/46 | 66/66 | 90/90 | **99/99** |
| `src/` LOC | 18 | 18 | 154 | 159 | 234 | 303 | 483 | 729 | **768** |
| Attempts | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| **Rework** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Env failures | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 1 | **1** |
| 사후 복구 필요 | yes | yes | yes | yes | no | no | no | no | **no** |

**아홉 Task 연속 1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0**이다.
**재작업은 T-009가 처음이다** — 여덟 Task 연속 무재작업 기록이 끊겼다.

## 11. 지금 쓸 수 있는 사실

- **Task마다 프롬프트를 쓰지 않아도 된다.** Prompt 파일이 없거나 둘이어도 결과가 같다.
- **preamble은 치환 자리 3개 밖에서 완전히 동일하다.** 두 Task 비교로 확인했다.
- **Read List에 Task 자신이 없으면 실행이 거부되고 빠진 경로가 출력된다.**
- **같은 입력이 같은 stdin을 만들고, 그 바이트가 그대로 worker에 도달한다.**
- **fake worker exit 0/3이 process exit과 `telemetry worker_exit_code` 양쪽에 정확히 전파된다.**
- **기본 timeout 1,800초가 걸리고 잘못된 값은 기본값으로 대체되지 않는다.**
- **BCOS가 실제 Codex를 직접 실행해 Task 하나를 완주시켰다** — 사람이 붙여넣은
  프롬프트 0, 복사한 Context 0.
- 테스트는 실제 Codex에 의존하지 않는다 — `PATH` 제거 후에도 99/99.
- 런타임 의존성 0, 새 파일 0, `src/` 하위 디렉터리 0.

## 12. 아직 쓸 수 없는 주장

- **"Worker 실행 자동화 완료"** — `start`·`submit`·Review·`approve`·commit이 남아 있다.
- **"모델 전환 비용 감소"** — worker가 `codex` 하나뿐이라 전환 자체가 불가능하다.
- **"토큰·비용 절감"** — 측정하지 않았다. 전 필드 `N/A`다.
- **"Context 효율 개선"** — 100 KB는 baseline이지 개선의 증거가 아니다.
- **"Files Read 감사 해결"** — Runner가 실제 투입 집합을 기록하지 않는다.
- **"프롬프트 작성 비용 N% 절감"** — 비교군이 없다. 단계 수만 기록했다.

## 13. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| **중첩 sandbox** | Codex 안에서 Codex 실행 시 `spawn EPERM` (Review F-4) | **T-010** — host 환경 검증 · nested worker guard |
| **Report 신뢰성** | Report가 실패를 선언해도 submit이 통과 (Review F-2) | **T-011** — verdict 처리 · rework loop |
| **Report 소유권** | 재작업 피드백을 누가 어디에 적는지 미정 (Review F-1) | **T-011** |
| Telemetry 저장 | stdout 전용이라 실행 창을 닫으면 사라짐 (Review F-3) | **T-014 Benchmark Harness** |
| token · cost | 전 필드 `N/A` | **T-012 Model Adapter** |
| 두 번째 worker | 없음 | **T-013 Multi-model Worker Switching** |
| 공정성 6문제 | 미해결 | **T-014** 착수 조건 |
| `frontmatterValue` 3중 복제 | 세 파일에 중복 (Review F-5) | 네 번째 복사 시 추출 |
| 8,000자 기준 | 실측 네 건 모두 초과 | 근거 축적 후 재조정 |
