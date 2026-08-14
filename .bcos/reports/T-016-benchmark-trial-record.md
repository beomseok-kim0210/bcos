---
task: T-016
---

# Report — T-016

## Attempt 2 — 2026-08-14T00:00:00Z

### Implemented
- Added the nine optional benchmark measurements to `RunRecord`.
- Returned context and stdin measurements from the runner without changing `ModelResult`.
- Persisted per-execution worker invocation counts and cumulative worker and verification measurements through the existing run update path.
- Added a read-only JSON trial loader with canonical identity, provenance, arm ownership, component usage, outcome, and run-reference validation.
- Added regression tests for measurement persistence, cumulative rework values, failures, real-shape BCOS references, baseline independence, and invalid trial rejection.

### Files Changed
- src/run.ts (modified)
- src/runner.ts (modified)
- src/workflow.ts (modified)
- src/benchmark.ts (new)
- tests/cli.test.ts (modified)
- .bcos/reports/T-016-benchmark-trial-record.md (new)

### Test Evidence
`npm.cmd run build`

```text
> bcos@0.1.0 build
> tsc

exit 0
```

`node --test --experimental-test-isolation=none --test-name-pattern="readTrials" tests/cli.test.ts`

```text
tests 8
pass 8
fail 0
duration_ms 343.9717
```

`npm.cmd test`

```text
tests 1
pass 0
fail 1
Error: spawn EPERM
```

The complete suite could not start under this execution sandbox because Node's test-runner child process creation was denied. Running without test isolation also encountered `spawn EPERM` in existing subprocess-based tests and timed out; this is environment evidence, not a passing full-suite claim.

Source size check:

```text
src/run.ts 86
src/runner.ts 201
src/workflow.ts 340
src/benchmark.ts 90
```

### Deviations
- The required full test suite could not be completed because the host denied child-process creation (`spawn EPERM`). The build and the eight read-only benchmark tests passed.

### Known Risks
- Workflow subprocess integration tests were added but could not execute in this sandbox, so the run-artifact measurement paths still require host verification in an environment that permits child processes.

### Context Used
- Files read: 10
- Outside Expected Files: 0

## Attempt 2 verification retry — 2026-08-14T05:00:00Z

### Implemented
- Corrected the stage-vocabulary regression test so legitimate zero-valued benchmark measurements remain allowed while numeric stage statuses remain forbidden.
- Retained the Attempt 1 RunRecord measurement persistence and read-only benchmark trial validation implementation.

### Files Changed
- src/run.ts (modified)
- src/runner.ts (modified)
- src/workflow.ts (modified)
- src/benchmark.ts (new)
- tests/cli.test.ts (modified)
- .bcos/reports/T-016-benchmark-trial-record.md (modified)

### Test Evidence
`npm.cmd run build`

```text
> bcos@0.1.0 build
> tsc
Exit code: 0
```

`node --test --test-isolation=none --test-name-pattern=readTrials tests/cli.test.ts`

```text
✔ readTrials returns baseline trials without BCOS run artifacts
✔ readTrials accepts a real-shape BCOS reference with all three usage components
✔ readTrials rejects independent core schema violations with filename and rule
✔ readTrials enforces provenance including unavailable zero and token proxy rejection
✔ readTrials rejects canonical identity violations without parsing hyphens
✔ readTrials rejects arm ownership and component symmetry violations
✔ readTrials includes all seven outcomes and does not create totals
✔ readTrials throws instead of silently skipping one invalid trial
ℹ tests 8
ℹ pass 8
ℹ fail 0
Exit code: 0
```

`npm.cmd test`

```text
The default node:test file-isolation subprocess could not start in this worker sandbox:
Error: spawn EPERM
Exit code: 1
```

`node --test --test-isolation=none tests/cli.test.ts`

```text
The test file loaded, but subprocess-based CLI fixtures received spawn EPERM in this worker sandbox.
The command was terminated at the 180-second execution limit; this is environment evidence, not a product assertion failure.
Exit code: 124
```

### Deviations
- The full process-based suite could not be validly executed in the worker sandbox because child-process creation is denied with EPERM. Host Verification must run `npm test` in its normal environment.

### Known Risks
- Full regression acceptance (AC 44) remains dependent on Host Verification because this worker environment cannot spawn the test runner or CLI fixture processes.

### Context Used
- Files read: 11
- Outside Expected Files: 1 (`.bcos/reports/T-016-benchmark-trial-record.md` — append-only heading placement verification)
