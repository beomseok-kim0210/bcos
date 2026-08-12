# T-900 — Protocol Hotfix: Spec Amendment · BLOCKED Alignment

**Raw Data만 기록한다.** 비율·개선율·절감률은 없다.

## Lifecycle

| key | 값 |
|---|---|
| `task_id` | T-900 |
| `final_status` | DONE |
| `final_attempt` | 2 |
| `task_started_count` | 1 |
| `task_submitted_count` | 2 |
| `task_changes_requested_count` | 1 |
| `task_approved_count` | 1 |
| `worker_actor_id` | codex-cli |
| `reviewer_actor_id` | claude-code |
| `first_review_verdict` | CHANGES_REQUESTED |
| `final_review_verdict` | APPROVED |
| `worker_attempt_count` | 2 |

## Execution

| key | attempt 1 | attempt 2 |
|---|---|---|
| `execution_id` | 20260811T063420927Z-5ec29fcf | 20260811T065857866Z-3f8a5376 |
| `workflow_exit_reason` | success | success |
| `workflow_duration_ms` | 485893 | N/A |
| `worker_duration_ms` | N/A | 337496 |
| `worker_exit_code` | 0 | 0 |
| `verification_command` | npm-test | npm-test |
| `verification_exit_code` | 0 | 0 |
| `verification_duration_ms` | 83939 | 85728 |
| `runner_invocations` | 1 | 1 |
| `lifecycle_transitions_caused` | 2 | 1 |
| `start_stage` | success | skipped |

## Tests

| key | 값 |
|---|---|
| `tests_before_task` | 234 |
| `tests_attempt_1` | 234 |
| `tests_attempt_1_pass` | 234 |
| `tests_attempt_1_fail` | 0 |
| `blocking_defects_at_attempt_1` | 1 |
| `tests_attempt_2` | 239 |
| `tests_attempt_2_pass` | 239 |
| `tests_attempt_2_fail` | 0 |
| `tests_skipped` | 0 |
| `tests_todo` | 0 |
| `new_tests_attempt_1` | 15 |
| `new_tests_attempt_2` | 5 |
| `reviewer_independent_reproduction` | 239 / 239 |

**`tests_attempt_1` 234개가 전부 통과했으나 Blocking 결함이 존재했다.**
합성 fixture가 AC 1만 참조해 절 잘림 결함을 통과시켰기 때문이다.

## Acceptance Criteria

| key | 값 |
|---|---|
| `criteria_total` | 51 |
| `criteria_pass` | 51 |
| `criteria_fail` | 0 |
| `criteria_superseded` | 0 |
| `criteria_pass_attempt_1` | 47 |
| `criteria_fail_attempt_1` | 4 |

## Section Parser — 실제 Task 문서

| task | `criteria_recognized_before` | `criteria_recognized_after` | `criteria_counted_manually` |
|---|---:|---:|---:|
| T-012 | 0 | 87 | 87 |
| T-013 | 0 | 94 | 94 |
| T-900 | 0 | 51 | 51 |

| key | 값 |
|---|---|
| `superseded_items_extracted` | 3 / 3 (`AC 59` · `AC 62` · `AC 63`) |
| `superseded_items_extracted_before` | 1 / 3 |
| `missing_criterion_position_tested` | middle (`AC 1` · `AC 99` · `AC 3`) |

## Verdict Semantics

| case | approve 결과 |
|---|---|
| `APPROVED` | 성공 |
| `APPROVED` → `BLOCKED` | 실패 |
| `BLOCKED` → `APPROVED` | 성공 |
| `CHANGES_REQUESTED` → `APPROVED` | 성공 |
| `APPROVED` → `CHANGES_REQUESTED` | 실패 |
| `BLOCKED` only | 실패 |

`verdict_cases_verified` = 6 · `verdict_cases_passed` = 6

## Amendment Validation

| case | 결과 |
|---|---|
| amendments 디렉터리 없음 | 0건, 오류 아님 |
| 네 조건 충족 | 1건 |
| `approved_by` 없음 | 제외 |
| `proposed_by == approved_by` | 제외 |
| `task` 불일치 | 제외 |
| 존재하지 않는 AC 참조 | 제외 |

`amendment_cases_verified` = 6 · `amendment_cases_passed` = 6

## T-013 Recovery Simulation (격리 사본)

| step | 결과 |
|---|---|
| amendment 이전 approve | 실패 |
| `effectiveAmendments("T-013")` | 1건 |
| Superseded 인식 | 59 · 62 · 63 |
| BLOCKED Review 이력 | 잔존 |
| 후속 APPROVED append | 기존 내용 보존 |
| `task approve` | 성공 |
| 최종 status | DONE |
| 최종 attempt | 2 |
| worker attempt 3 | 없음 |
| frozen Task body | 불변 |

`recovery_steps_verified` = 11 · `recovery_executed_on_real_repository` = false

## Feedback Handoff

| key | attempt 2 |
|---|---|
| `context_files` | 7 |
| `context_chars` | 165933 |
| `review_chars` | 14548 |
| `stdin_bytes` | 206073 |
| `stdin_sha256_predicted` | 7e37f629… |
| `stdin_sha256_observed` | 7e37f629… |
| `human_resummary_count` | 0 |
| `handwritten_prompt_files` | 0 |

## Source

| key | 값 |
|---|---|
| `cli_ts_lines` | 520 |
| `cli_ts_limit` | 520 |
| `cli_ts_lines_before_rework` | 520 |
| `reviewer_ts_lines` | 87 |
| `reviewer_ts_limit` | 95 |
| `reviewer_ts_changed_attempt_2` | false |
| `new_source_files` | 0 |
| `new_cli_commands` | 0 |
| `new_events` | 0 |
| `new_lifecycle_states` | 0 |
| `dependencies` | 0 |
| `dev_dependencies` | 2 |
| `class_count` | 0 |
| `docs_files_changed` | 0 |

## Isolation / Safety

| key | 값 |
|---|---|
| `t013_artifacts_preserved` | 10 / 10 |
| `t013_events` | 4 |
| `t013_task_approved` | 0 |
| `partial_writes` | 0 |
| `temp_files_left` | 0 |
| `run_artifacts_valid_json` | 5 / 5 |
| `events_jsonl_lines` | 36 → 44 (append only) |
| `home_absolute_paths_in_output` | 0 |
| `scope_violations` | 0 |
| `ponytail_violations` | 0 |

## Worker Environment

| key | 값 |
|---|---|
| `worker_sandbox_test_execution` | denied (EPERM) |
| `consecutive_tasks_with_eperm` | 8 |
| `host_verification_substituted` | true |

## Notes

- **`tests_attempt_1` 234 / 234 pass에도 Blocking 결함이 존재했다.**
  테스트 통과 수만으로 정확성을 주장할 수 없다는 관측 사례다.
- `recovery_executed_on_real_repository` = false — T-013 복구는 격리 사본에서만
  검증됐다. 실제 실행은 Human/Manager 단계다.
- `cli_ts_lines` 520이 상한과 같다. 이번 수정은 중복 정규식 두 개를 helper 하나로
  합쳐 순증 0으로 끝났다.
