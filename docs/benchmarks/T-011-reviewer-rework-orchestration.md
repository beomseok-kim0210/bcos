# T-011 Benchmark

**첫 `task execute` dogfooding Task.** 사람이 입력한 BCOS lifecycle 명령이 **하나**였고
BCOS가 실제 Codex에게 구현을 맡겨 `IMPLEMENTED`까지 스스로 진행했다.
**개선율을 주장하지 않는다.**

값의 종류를 구분한다 — **Measured**(직접 관측) · **Derived**(관측값 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

필드 정의는 [TELEMETRY.md](TELEMETRY.md)에 있다.

| 항목 | 값 |
|---|---|
| Task | T-011 — Run the reviewer, act on the verdict, and loop until approval |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Quality

| 지표 | 값 | 종류 |
|---|---:|---|
| AC total / passed / failed | 94 / 94 / 0 | Measured |
| **AC Pass Rate** | **100.0%** | Derived |
| **Tests** | **156 / 156** | Measured — 129 → 156 |
| **Test Pass Rate** | **100.0%** | Derived |
| Reviewer 독립 검증 | **99 / 99** | Measured |
| Build result | SUCCESS | Measured |
| **First Review verdict** | **APPROVED** | Measured |
| Attempts | 1 | Measured |
| **Rework** | **No** | Measured — 두 Task 만에 무재작업 복귀 |
| **Environment failures** | **1** | Measured — worker 내부 `spawn EPERM` |
| Test regressions | **0** | Measured |
| Review findings | 5 (Blocking 0 / Major 1 / Minor 2 / Info 2) | Measured |
| Scope violations | 0 | Measured |
| Ponytail violations | 0 | Measured |

## 2. Dogfooding — 이 Task의 핵심 관측

**사람이 입력한 BCOS lifecycle 명령: 1개.**

```
task execute T-011 --worker codex --actor-id codex-cli --timeout 5400
```

`task start` · `task run` · `npm test` · `task submit` 을 따로 입력하지 않았다.

| 지표 | 값 | 종류 |
|---|---:|---|
| **사람이 입력한 lifecycle 명령** | **1** | Measured |
| `lifecycle_transitions_caused` | **2** | Measured |
| `workflow_exit_reason` | **success** | Measured |
| `workflow_duration_ms` | **598,607** | Measured |
| `runner_invocations` | 1 | Measured |
| `verification_runs` | 1 | Measured |
| Context files | **10** | Measured |
| Context bytes / chars | **173,900 / 149,325** | Measured |
| `stdin_bytes` | **174,778** | Measured |
| `worker_duration_ms` | **544,281** | Measured |
| `worker_exit_code` | **0** | Measured |
| `worker_stdout_bytes` | **592** | Measured |
| `worker_stderr_bytes` | **1,713,277** | Measured |
| `verification_command` | `npm-test` | Measured |
| `verification_exit_code` | **0** | Measured |
| `verification_duration_ms` | **53,984** | Measured |
| hand-written Worker Prompt | **0** | Measured |
| 사람이 복사한 Context | **0** | Measured |

**이벤트 시각이 workflow 시각과 맞물린다** — `workflow_started_at` `02:19:06.428Z` →
`TASK_STARTED` `.608Z`(180 ms 후), `TASK_SUBMITTED` `02:29:05.020Z` →
`workflow_completed_at` `.035Z`(15 ms 후). **사후 복구가 아니다.**

**T-010과 나란히 놓는다. 개선율로 환산하지 않는다.**

| | T-010 | T-011 |
|---|---:|---:|
| `IMPLEMENTED` 까지 사람 명령 | 4 | **1** |
| 실행 주체 | 사람이 순서대로 입력 | **workflow** |

## 3. Worker self-test vs Host verification — 세 번째 분기

| 증거 출처 | 결과 |
|---|---|
| **Worker self-test** | `spawn EPERM` — 156 중 1 pass. **AC 충족 주장 안 함** |
| **Host verification** | **156 / 156 pass, exit 0** |
| **Reviewer 독립 재실행** | **156 / 156 pass, exit 0** |

**worker sandbox가 자식 프로세스를 거부한 것이 T-009·T-010·T-011 세 Task 연속이다.**
이제 예외가 아니라 상수로 취급한다.

**이번에는 그 불일치가 위험이 아니라 설계가 작동한 증거다.** worker의 자기보고가
아니라 host 검증이 제출을 결정했다. T-010이 검증 주체를 옮긴 이유가 두 번 연속
실증됐다.

## 4. request-changes — 새 lifecycle 전이

RFC-001 §1.2를 그대로 구현했다. **프로토콜 개정 0건.**

| 지표 | 값 | 종류 |
|---|---:|---|
| **Lifecycle coverage** | **3 → 4 / 7 transitions** | Derived |
| 전이 | `IMPLEMENTED` → `IN_PROGRESS` | Measured |
| 이벤트 | `TASK_CHANGES_REQUESTED` | Measured |
| 가드 | G4 · G5 | Measured |
| attempt 증가 주체 | `request-changes` | Measured |
| request-changes 테스트 | **8** | Measured |
| G4 양방향 검증 | 통과 | Measured |

**G4 양방향** — `APPROVED` Review로 `request-changes` 불가, `CHANGES_REQUESTED`
Review로 `approve` 불가. 거부 다섯 경로에서 `.bcos/` 해시 동일.

## 5. Reviewer orchestration

| 지표 | 값 | 종류 |
|---|---:|---|
| reviewer 테스트 | **18** | Measured |
| human escalation 테스트 | **6** | Measured |
| Claude 실행 형태 | `claude.exe` 직접 spawn, `shell: false` | Measured |
| reviewer argv | `["-p","--output-format","text"]` | Measured |
| 새 Review 스키마 | **없음** | Measured |
| 판정 읽는 지점 | 1곳 (`src/reviewer.ts:70`) | Measured |
| 산문 파서 | **0** | Measured |
| `--max-review-cycles` 기본값 | **2** | Measured |
| 자동 승인 (판정 없이) | **0** | Measured |

**판정별 동작 (Reviewer fixture 실측)**

| 판정 | 동작 | 결과 |
|---|---|---|
| `APPROVED` | `approve` | `DONE`, 승인 actor = reviewer actor |
| `CHANGES_REQUESTED` | `request-changes` → 재작업 → 재리뷰 | attempt 2, 최종 `DONE` |
| `BLOCKED` | 이관 | approve 0건, `IMPLEMENTED` 유지 |
| 판정 없음 | 이관 | 전이 0건 |
| reviewer exit ≠ 0 | 이관 | 전이 0건 |
| cycle 소진 | 이관 | 자동 승인 0건 |

**rework loop 이벤트 순서 (실측)**

```
TASK_STARTED → TASK_SUBMITTED → TASK_CHANGES_REQUESTED → TASK_SUBMITTED → TASK_APPROVED
```

`TASK_STARTED`는 **1건 유지** — 재작업이 새 start를 만들지 않는다.

## 6. Change Size

| 지표 | 값 | 종류 |
|---|---:|---|
| **`src/reviewer.ts`** | **103줄 (신규)** | Measured — 상한 160 |
| `src/workflow.ts` | 178 → **270** (+98 / −6) | Measured — 상한 300 |
| `src/cli.ts` | 393 → **430** (+40 / −3) | Measured |
| `src/runner.ts` | 248 → **253** (+6 / −1) | Measured |
| `src/context.ts` | 165 → 165 (**무변경**) | Measured |
| `tests/cli.test.ts` | 1,584 → **1,805** (+227 / −6) | Measured |
| `docs/benchmarks/TELEMETRY.md` | +27줄, **삭제 0줄** | Measured |
| **`src/` 총 LOC** | **1,221** | Measured |
| Report LOC | 107 | Measured |
| **새 소스 파일** | **1** | Measured |
| class 수 (reviewer + workflow) | **0** | Measured |
| **Runtime dependencies** | **0** | Measured |

## 7. Telemetry

| 지표 | 값 | 종류 |
|---|---:|---|
| **TELEMETRY.md 필드 수** | **96 → 112** | Measured |
| 새 절 | `## 12 Reviewer Orchestration Metrics` | Measured |
| 요구된 새 키 | **14 / 14 존재** | Measured |
| 기존 필드 삭제 | **0줄** | Measured |
| 계산 필드 정의 | **0** | Measured |
| `--review` 없을 때 reviewer 필드 | **미출력** | Measured |

**`rework_count`가 `TASK_CHANGES_REQUESTED` 이벤트로 셀 수 있게 됐다.** 다만 §7 표에
아직 `blocked`로 남아 있다 (Review F-1).

**여전히 `N/A`인 것** — token 4개 · cost 4개 · `context_tokens`(T-012) ·
`review_start_time`(RFC 이벤트 없음) · `review_findings_*`(산문) · `human_*`(manual) ·
`workflow_resume_count`(blocked).

## 8. Observability — 이번 관측의 별도 항목

**실행은 성공했는데 성공한 줄 몰랐다.**

| 관측 | 값 |
|---|---|
| workflow 프로세스 | 부모 세션 종료 후에도 계속 실행 |
| 최종 exit | **0** |
| 실제 소요 | 598,607 ms |
| 중간 스냅샷 오인 | `IN_PROGRESS` → "멈춤"으로 판단됨 |
| 상태 재조회 명령 | **없음** |
| telemetry 보존 | **stdout 전용** |
| 사후 확인 가능 이유 | 로그를 파일로 리다이렉트해 둔 우연한 조치 |
| fixture telemetry 혼입 | 로그에 `task_id=T-200` 등이 실제 실행과 섞임 |

**"한 명령으로 자동화됐다"와 "완료를 신뢰성 있게 관찰할 수 있다"는 다른 문제다.**
T-011은 전자를 진전시켰고 후자는 손대지 않았다. **T-011 Scope 밖이며 구현 결함이 아니다.**

## 9. Context (Worker 측)

| 지표 | 값 | 종류 |
|---|---:|---|
| Files Allowed (Read List) | 10 | Measured |
| Files Read | 10 | Measured (자기보고) |
| **Read List 밖 접근** | **0** | Measured (자기보고) — 여덟 Task 연속 |
| tracked 파일 수 | 80 | Measured |
| Read Scope Ratio | 12.5% | Derived — 10 / 80 |
| **hand-written Worker Prompt** | **0** | Measured |

## 10. 열한 Task 병기

**개선율을 계산하지 않는다.** 성격이 서로 다르다.

| 지표 | T-006 | T-007 | T-008 | T-009 | T-010 | T-011 |
|---|---:|---:|---:|---:|---:|---:|
| 성격 | 전이3 | Context | 실행 | 제거 | 묶기 | **리뷰 loop** |
| AC | 24/24 | 32/32 | 46/46 | 62/62 | 87/87 | **94/94** |
| Tests | 46/46 | 66/66 | 90/90 | 99/99 | 129/129 | **156/156** |
| `src/` LOC | 303 | 483 | 729 | 768 | 984 | **1,221** |
| Attempts | 1 | 1 | 1 | 1 | 1 | 1 |
| Rework | 0 | 0 | 0 | 1 | 1 | **0** |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 |
| Env failures | 0 | 0 | 1 | 1 | 1 | **1** |
| 사후 복구 필요 | no | no | no | no | no | **no** |

**열한 Task 연속 1회 시도 승인 · 범위 이탈 0 · Ponytail 위반 0.**
**worker sandbox 환경 실패는 네 Task 연속이다.**

## 11. 지금 쓸 수 있는 사실

- **`task execute` 한 명령으로 실제 Codex가 T-011을 `IMPLEMENTED`까지 구현했다.**
  붙여넣은 프롬프트 0, 복사한 Context 0.
- **worker가 자기 검증에 실패해도 host 검증이 제출을 결정한다.** 세 Task 연속 관측.
- **`request-changes` 전이가 RFC-001 규정대로 동작한다.** G4 양방향, G5, attempt 증가.
- **판정을 읽지 못하면 절대 승인하지 않는다.** `BLOCKED`·판정 없음·reviewer 실패·
  cycle 소진 전부 사람에게 넘긴다.
- **rework loop가 `TASK_STARTED`를 재생성하지 않는다.** 이벤트 순서 5단계 실측.
- **worker actor == reviewer actor면 시작 전에 거부된다.** 세 프로세스 모두 미실행.
- 테스트는 실제 Codex·Claude에 의존하지 않는다 — 둘 다 `PATH`에서 제거해도 156/156.
- 새 파일 1개, class 0개, 런타임 의존성 0, 새 Review 스키마 0.

## 12. 아직 쓸 수 없는 주장

- **"Review까지 자동화 완료"** — `task execute --review`를 **실제 Claude로 돌린 적이
  없다.** 검증은 전부 가짜 reviewer다. T-011 자신의 Review도 수동이었다.
- **"사람 개입 N% 감소"** — 4 → 1은 절대 수치이며 비교군이 없다.
- **"실행을 신뢰성 있게 관찰할 수 있다"** — 관측 수단이 없다 (§8).
- **"토큰·비용 절감"** — 전 필드 `N/A`다.
- **"worker sandbox 문제 해결"** — 우회했을 뿐 해결하지 않았다.

## 13. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| **실제 Claude reviewer** | 한 번도 돌린 적 없음 | **T-012**를 `task execute --review`로 dogfood |
| **Observability** | 실행 상태 조회 불가, telemetry 휘발 (F-3) | persistent telemetry · execution id · `task status` |
| `rework_count` 문서 모순 | §7 `blocked` vs §12 해제 (F-1) | §7 행·사유 갱신 |
| Reviewer 검증 정책 | CLAUDE.md·AGENTS.md와 어긋남 (F-4) | 정책 개정 승인 |
| `BLOCKED` 전이 부재 | RFC §4와 §1.2 불일치 (F-5) | RFC 개정 판단 |
| token · cost | 전 필드 `N/A` | **T-012 Model Adapter** |
| 두 번째 worker | 없음 | **T-013** |
| 공정성 6문제 | 미해결 | **T-014** 착수 조건 |
