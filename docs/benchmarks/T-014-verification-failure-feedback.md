# T-014 — Verification Failure Feedback

**Raw Data만 기록한다.** 비율·개선율·절감률은 없다.

## Lifecycle

| key | 값 |
|---|---|
| `task_id` | T-014 |
| `final_status` | DONE |
| `final_attempt` | 1 |
| `task_started_count` | 1 |
| `task_submitted_count` | 1 |
| `task_changes_requested_count` | 0 |
| `task_approved_count` | 1 |
| `worker_actor_id` | codex-cli |
| `reviewer_actor_id` | claude-code |
| `first_review_verdict` | APPROVED |
| `worker_attempt_count` | 1 |

## Execution

| key | 값 |
|---|---|
| `execution_id` | 20260812T045321986Z-2ded4929 |
| `workflow_exit_reason` | success |
| `worker_duration_ms` | 397356 |
| `worker_exit_code` | 0 |
| `verification_command` | npm-test |
| `verification_exit_code` | 0 |
| `verification_duration_ms` | 87813 |
| `verification_runs` | 1 |
| `runner_invocations` | 1 |
| `lifecycle_transitions_caused` | 2 |

## Acceptance Criteria

| key | 값 |
|---|---|
| `criteria_total` | 51 |
| `criteria_pass` | 51 |
| `criteria_fail` | 0 |
| `criteria_superseded` | 0 |

## Tests

| key | 값 |
|---|---|
| `tests_before_task` | 239 |
| `tests_after_task` | 256 |
| `tests_pass` | 256 |
| `tests_fail` | 0 |
| `tests_skipped` | 0 |
| `tests_todo` | 0 |
| `new_tests` | 17 |
| `reviewer_independent_reproduction` | 256 / 256 |

## No-Failure Regression

| key | 값 |
|---|---|
| `baseline_stdin_sha256` | 60176e4fb0e1398ffec475bd34fc81b6a316e902b8435c2ace963770d6c1bb49 |
| `post_implementation_stdin_sha256` | 60176e4fb0e1398ffec475bd34fc81b6a316e902b8435c2ace963770d6c1bb49 |
| `baseline_stdin_chars` | 181412 |
| `post_implementation_stdin_chars` | 181412 |
| `baseline_captured_before_implementation` | true |
| `reviewer_independently_reproduced` | true |

## Excerpt Bound — 직접 측정

| key | 값 |
|---|---|
| `excerpt_field_bytes_ascii` | 2052 |
| `excerpt_payload_bytes_ascii` | 2048 |
| `truncation_marker_bytes` | 4 |
| `excerpt_field_bytes_short_output` | 6 |
| `truncation_marker_on_short_output` | false |
| `excerpt_payload_bytes_3byte_chars` | 2052 |
| `replacement_characters_3byte_chars` | 2 |
| `excerpt_payload_bytes_4byte_chars` | 2048 |
| `replacement_characters_4byte_chars` | 0 |
| `artifact_json_valid_all_cases` | true |

## Feedback Block

| key | 값 |
|---|---|
| `block_marker` | `--- PREVIOUS HOST VERIFICATION FAILURE ---` |
| `block_fields` | command · exit code · excerpt |
| `execution_id_in_block` | false |
| `timestamp_in_block` | false |
| `duration_in_block` | false |
| `absolute_path_in_block` | false |
| `block_position` | last |
| `ordering_observed` | CONTEXT(480) < REVIEW(1011) < VERIFICATION(1157) |

## Real-shape Fixture

| key | 값 |
|---|---|
| `fixture_source` | T-012 실제 실패 형태 |
| `failing_test_name_preserved` | true |
| `assertion_evidence_preserved` | true |
| `delivered_to_worker_stdin` | true |

## Stale Feedback

| 이력 | 선택 | 전달 |
|---|---|---|
| `failed → not_started` | failed | 전달 |
| `failed → success` | success | 없음 |
| `failed → success → not_started → success` | success | 없음 |

| key | 값 |
|---|---|
| `failed_artifact_retained_after_success` | true |
| `clear_event_added` | false |
| `delete_operation_added` | false |

## Determinism

| key | 값 |
|---|---|
| `reassembly_runs_compared` | 3 |
| `reassembly_distinct_sha` | 1 |
| `verifier_reruns_compared` | 5 |
| `verifier_rerun_distinct_interleavings` | 4 |
| `contract_requires_rerun_determinism` | false |

## Combined Feedback

| key | 값 |
|---|---|
| `review_block_present` | true |
| `verification_block_present` | true |
| `ordering_deterministic` | true |
| `dedup_framework_added` | false |

## Attempt / Gate

| key | 값 |
|---|---|
| `attempt_after_two_verification_failures` | 1 |
| `status_after_verification_failure` | IN_PROGRESS |
| `submit_events_after_failure` | 0 |
| `verify_only_runner_invocations` | 0 |
| `verify_only_worker_executed` | false |

## Source

| key | 값 |
|---|---|
| `workflow_ts_lines` | 326 |
| `workflow_ts_limit` | 330 |
| `run_ts_lines` | 83 |
| `run_ts_limit` | 100 |
| `runner_ts_lines` | 192 |
| `runner_ts_limit` | 200 |
| `new_source_files` | 0 |
| `new_cli_commands` | 0 |
| `new_events` | 0 |
| `new_lifecycle_states` | 0 |
| `new_stdout_telemetry_keys` | 0 |
| `telemetry_unique_keys_before` | 103 |
| `telemetry_unique_keys_after` | 103 |
| `dependencies` | 0 |
| `dev_dependencies` | 2 |
| `class_count` | 0 |
| `model_ts_changed` | false |
| `context_ts_changed` | false |

## Privacy

| key | 값 |
|---|---|
| `home_path_in_run_artifacts` | 0 |
| `home_path_in_worker_stdin` | 0 |
| `home_path_in_telemetry` | 0 |
| `backslash_variant_substituted` | true |
| `forward_slash_variant_substituted` | true |
| `substitution_rules` | 2 (`<root>` · `<home>`) |
| `general_secret_redaction_claimed` | false |

## Safety

| key | 값 |
|---|---|
| `run_artifacts_valid_json` | all |
| `temp_files_left` | 0 |
| `events_jsonl_lines_valid_json` | all |
| `state_json_valid` | true |
| `verifier_stdout_forwarded` | true |
| `verifier_stderr_forwarded` | true |

## Review

| key | 값 |
|---|---|
| `blocking_findings` | 0 |
| `major_findings` | 0 |
| `minor_findings` | 1 |
| `info_findings` | 4 |
| `scope_violations` | 0 |
| `ponytail_violations` | 0 |

## Bootstrap

| key | 값 |
|---|---|
| `workflow_start_utc` | 2026-08-12T04:53:21Z |
| `dist_rebuild_kst` | 2026-08-12 13:59:22 |
| `workflow_end_utc` | 2026-08-12T05:01:27Z |
| `new_fields_in_own_artifact` | false |
| `new_fields_in_fresh_build_fixture` | true |

## Worker Environment

| key | 값 |
|---|---|
| `worker_sandbox_test_execution` | denied (EPERM) |
| `consecutive_tasks_with_eperm` | 9 |
| `host_verification_substituted` | true |

## Notes

- `excerpt_payload_bytes_3byte_chars` 2052는 UTF-8 경계 절단으로 U+FFFD가 생겨
  디코딩 후 4바이트 늘어난 값이다. `verify()`가 보관하는 버퍼는 정확히 2048바이트다.
- `verifier_rerun_distinct_interleavings` 4는 stdout과 stderr가 별개 pipe이기 때문이며,
  Worker 입력 결정성은 저장된 발췌를 다시 읽는 경로에만 의존한다.
- `new_fields_in_own_artifact` false는 부트스트랩 특성이다. T-012·T-013과 같다.
