# T-012 Benchmark

**첫 관측 가능성 Task.** workflow 실행이 저장소에 기록으로 남고 명령 하나로 읽힌다.
**개선율을 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

필드 정의는 [TELEMETRY.md](TELEMETRY.md)에 있다.

| 항목 | 값 |
|---|---|
| Task | T-012 — Record each workflow execution so a finished run can be inspected later |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Quality

| 지표 | 값 | 종류 |
|---|---:|---|
| AC total / passed / failed | 87 / 87 / 0 | Measured |
| **AC Pass Rate** | **100.0%** | Derived |
| **Tests** | **186 / 186** | Measured — 156 → 186 |
| **Test Pass Rate** | **100.0%** | Derived |
| Build result | SUCCESS | Measured |
| **First Review verdict** | **APPROVED** | Measured |
| Attempts | 1 | Measured |
| **Rework** | **No** | Measured |
| **Environment failures** | **1** | Measured — worker 내부 `spawn EPERM` (네 Task 연속) |
| **Test regressions** | **1** | Measured — 신규 테스트 동기화 결함 |
| Review findings | 6 (Blocking 0 / Major 1 / Minor 2 / Info 3) | Measured |
| Scope violations | 0 | Measured |
| Ponytail violations | 0 | Measured |

## 2. 두 번의 실행 — 검증 게이트가 작동했다

| | 최초 `task execute` | `--verify-only` |
|---|---:|---:|
| 시각 | `03:16:23.808Z` → `03:24:09.791Z` | `01:29:39.239Z` → `01:30:52.499Z` |
| `workflow_duration_ms` | **465,983** | **73,260** |
| **worker invocations** | **1** | **0** |
| `worker_exit_code` | 0 | — |
| `worker_duration_ms` | **396,705** | — |
| `first_worker_response_ms` | 2,754 | — |
| Context files / chars | 11 / 172,674 | — |
| `stdin_bytes` | 200,450 | — |
| worker stdout / stderr | 527 / 1,049,594 | — |
| **host verification** | **185 / 186 → exit 1** | **186 / 186 → exit 0** |
| `verification_duration_ms` | 69,063 | 73,043 |
| `workflow_exit_reason` | **verification** | **success** |
| `lifecycle_transitions_caused` | 1 (`start`) | 1 (`submit`) |
| Task 상태 결과 | `IN_PROGRESS` 유지 | **`IMPLEMENTED`** |

**최초 실행에서 host 검증이 submit을 막았다.** 실패는 신규 테스트의 동기화 결함이었고
제품 결함이 아니었다 — 5회 중 5회 결정적으로 재현됐다.
**assertion을 완화하지 않고 대기 조건만 고쳤으며 제품 코드는 손대지 않았다.**

**재개는 worker를 다시 돌리지 않았다** — `--verify-only` 로 `runner_invocations=0`.

## 3. Run artifact

| 지표 | 값 | 종류 |
|---|---:|---|
| **생성된 run artifact (실제 저장소)** | **1** | Measured |
| artifact 크기 | **612 bytes** | Measured |
| execution_id | `20260811T012939320Z-6e0b63f5` | Measured |
| id 형식 | 밀리초 UTC + 8 hex | Measured |
| 파일명 정렬 = 시간순 | yes | Measured |
| stage 어휘 | 5종 구분 (`not_started`·`skipped`·`running`·`success`·`failed`) | Measured |
| stage 수 | 8 (workflow 호출 순서에서 도출) | Measured |
| **artifact에 Task status 필드** | **없음** | Measured |
| **`.bcos/runs/` 에 남은 temp 파일** | **0** | Measured |
| 원자적 쓰기 | temp + `renameSync` (기존 관행 재사용) | Measured |

**`--verify-only` 기록의 stage 상태**

```
start: skipped        worker: skipped
report_check: success verification: success  submit: success
review: not_started   approve: not_started   request_changes: not_started
```

## 4. 검증한 관측 동작

| 항목 | 결과 | 종류 |
|---|---|---|
| `task status` 필수 항목 출력 | 13종 전부 | Measured |
| 기록 없는 Task | **exit 0** + 명시 문구 | Measured |
| 여러 execution 최신 선택 | 정확 + 총 개수 안내 | Measured |
| `--execution <id>` | 정확 조회 / 없는 id exit 1 | Measured |
| **`task status` 쓰기** | **0건** | Measured |
| **interruption** | **9 / 9** | Measured |
| guard 거부 시 기록 생성 | **0건** | Measured |
| stdout telemetry 기존 키 삭제 | **0건** | Measured |
| stdout `execution_id` == artifact | yes | Measured |

**interruption 상세** — `running` 유지 · `failed` 자동 전환 없음 · `success` 위조 없음 ·
`completed_at` 없음 · `interrupted`·`unknown` 파일 저장 없음 · `current_stage` 보존 ·
유효 JSON · temp 잔존 0.

`task status` 가 그것을 이렇게 표현한다 — `Workflow status: running` /
`Completed: not observed` / `Exit reason: not observed`.
**살아 있다고도 죽었다고도 단정하지 않는다.**

## 5. Privacy

실제 저장소 artifact 전문(612 bytes)을 검사했다.

| 검사 | 결과 |
|---|---|
| 절대경로 | **없음** |
| 사용자 홈 경로 | **없음** |
| 전체 command line | **없음** |
| 환경 변수 | **없음** |
| 프롬프트 전문 | **없음** |
| Context Package 전문 | **없음** |
| stdout / stderr 전문 | **없음** |
| 이메일 · 자격증명 | **없음** |

저장되는 것은 논리 명령 이름(`npm-test`) · 타임스탬프 · task id · execution id ·
stage 상태뿐이다.

## 6. Bootstrap limitation

**T-012 attempt 1의 최초 workflow에는 run artifact가 없다.**

| | |
|---|---|
| 기록되지 않은 실행 | 최초 `task execute` — worker 396,705 ms |
| 이유 | T-012 코드가 들어가기 **전의 `dist/`** 로 시작됨 |
| 저장소에 있는 기록 | `--verify-only` 재검증에서 생성된 1개 |
| 그 실행의 유일한 증거 | 리다이렉트한 로그 |

**구현 결함이 아니라 부트스트랩 특성이다.** 기능을 만드는 실행 자체가 그 기능의
혜택을 받을 수 없다.

**처음부터 끝까지 persistent run artifact로 기록되는 첫 workflow는 T-013이다.**

## 7. Change Size

| 지표 | 값 | 종류 |
|---|---:|---|
| **`src/run.ts`** | **69줄 (신규)** | Measured — 상한 120 |
| `src/workflow.ts` | 270 → **306** (+54 / −18) | Measured — 상한 310 |
| `src/cli.ts` | 431 → **474** (+45 / −1) | Measured |
| `src/context.ts` · `runner.ts` · `reviewer.ts` | **무변경** | Measured |
| `tests/cli.test.ts` | +211 / −1 | Measured |
| `docs/benchmarks/TELEMETRY.md` | +12줄, **삭제 0** | Measured |
| `docs/architecture.md` | +1줄 | Measured |
| **`src/` 총 LOC** | **1,270** | Measured |
| **새 소스 파일** | **1** | Measured |
| class 수 (`run.ts`) | **0** | Measured |
| **Runtime dependencies** | **0** | Measured |
| `package-lock.json` | 없음 | Measured |

## 8. Telemetry

| 지표 | 값 | 종류 |
|---|---:|---|
| **TELEMETRY.md 필드 수** | **112 → 118** | Measured |
| 새 키 | 5 (`execution_id`·`workflow_status`·`current_stage`·`stage_status`·`run_record_path`) | Measured |
| 기존 필드 삭제 | **0줄** | Measured |
| 계산 필드 정의 | **0** | Measured |

**여전히 `N/A` 인 것** — token 4개 · cost 4개 · `context_tokens`(T-013) ·
`review_start_time` · `review_findings_*` · `human_*` ·
`workflow_resume_count`(문서상 `blocked` 이나 실행 기록으로 셀 수 있게 됐다 — Review F-3).

## 9. 열두 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-008 | T-009 | T-010 | T-011 | T-012 |
|---|---:|---:|---:|---:|---:|
| 성격 | 실행 | 제거 | 묶기 | 리뷰 loop | **관측** |
| AC | 46/46 | 62/62 | 87/87 | 94/94 | **87/87** |
| Tests | 90/90 | 99/99 | 129/129 | 156/156 | **186/186** |
| `src/` LOC | 729 | 768 | 984 | 1,221 | **1,270** |
| Attempts | 1 | 1 | 1 | 1 | 1 |
| Rework | 0 | 1 | 1 | 0 | **0** |
| Scope violations | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 |
| Env failures | 1 | 1 | 1 | 1 | **1** |
| 사후 복구 필요 | no | no | no | no | **no** |

**열두 Task 연속 1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0.**
**worker sandbox 환경 실패는 다섯 Task 연속이다.**

## 10. 지금 쓸 수 있는 사실

- **workflow 실행마다 저장소에 기록이 남는다.** 612 bytes, 실행당 1개.
- **`task status <id>` 하나로 읽힌다.** 터미널이나 세션을 잃어도 저장소만으로 답이 나온다.
- **관측하지 못한 종료를 추측하지 않는다.** 강제 종료 후에도 `running` 이 유지되고
  `interrupted`·`unknown` 을 파일에 쓰지 않는다.
- **Task 상태와 실행 관찰이 분리돼 있다.** artifact에 Task status 필드가 없고,
  `run.ts`·`workflow.ts` 가 `events.jsonl`·`state.json` 에 쓰지 않는다.
- **guard에서 거부된 실행은 기록을 남기지 않는다** — `bcosSnapshot` 57개 단언이 유지된다.
- **host 검증이 다시 한 번 submit을 막았다** — 이번에는 신규 테스트 결함을 잡았다.
- **재개가 worker를 다시 돌리지 않는다** — `--verify-only` 로 `runner_invocations=0`.
- 새 파일 1개, class 0, 의존성 0, daemon·서버·DB 없음.

## 11. 아직 쓸 수 없는 주장

- **"T-012의 전 과정이 관측됐다"** — 최초 workflow는 기록되지 않았다(§6).
- **"stdout fixture 혼입이 사라졌다"** — 사라지지 않았다. 권위를 파일로 옮기고
  `execution_id` 로 귀속만 가능하게 했다.
- **"실행 중인지 알 수 있다"** — `running` 은 마지막 관측 상태이지 생존 확인이 아니다.
- **"검증 실패 후 자동 복구된다"** — worker에게 실패 증거가 전달되지 않는다(Review F-1).
- **"관측 가능성 문제 해결 완료"** — 저장과 조회가 생겼을 뿐 재개 피드백은 없다.

## 12. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| **검증 실패 피드백** | 재개 시 worker가 실패 증거를 못 받음 (F-1) | **Verification Failure Feedback Handoff** |
| **첫 전 구간 관측** | T-012 최초 실행 기록 없음 (§6) | **T-013 dogfooding** |
| AC 문구 | "변경 파일 N개뿐"이 실행 기록과 충돌 (F-2) | T-013부터 문구 수정 |
| `workflow_resume_count` | 문서상 `blocked` 이나 이제 셀 수 있음 (F-3) | TELEMETRY §7·§11 정리 |
| `PATH` 제거 검증 | 186개 규모에서 완료되지 않음 (F-4) | 정적 증명으로 대체 |
| `workflow.ts` 여유 | 306 / 310 (F-6) | 다음 설계 때 상한 재검토 |
| token · cost | 전 필드 `N/A` | **T-013 Model Adapter** |
| 두 번째 worker | 없음 | T-014 |
| 공정성 6문제 | 미해결 | Benchmark Harness 착수 조건 |
