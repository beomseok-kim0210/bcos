---
task: T-012
---

# Report — T-012

## Attempt 1 — 2026-08-10T03:22:21.868Z

### Implemented
- Added atomic per-execution JSON records under `.bcos/runs/` with compact UTC execution ids.
- Recorded workflow identity, attempt, timestamps, workflow outcome, exit reason, current stage, logical verification command, and all eight stage states.
- Updated records at stage boundaries, retained a single execution id through review rework, and left killed executions at the last observed `running` state.
- Added `task status <id> [--execution <execution-id>]` with Task state, run state, stages, timestamps, last lifecycle event, multi-run selection, and stale-running wording.
- Added workflow execution telemetry fields and documented the five new raw fields.
- Added 30 observability tests, bringing the source test count to 186.

### Files Changed
- src/run.ts (new)
- src/workflow.ts (modified)
- src/cli.ts (modified)
- tests/cli.test.ts (modified)
- docs/benchmarks/TELEMETRY.md (modified)
- docs/architecture.md (modified)
- .bcos/reports/T-012-workflow-observability.md (new)

### Test Evidence

`npm.cmd run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`npm.cmd test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✖ tests\cli.test.ts (3.2759ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11.864

✖ failing tests:

test at tests\cli.test.ts:1:1
✖ tests\cli.test.ts (3.2759ms)
  Error: spawn EPERM
      at ChildProcess.spawn (node:internal/child_process:421:11)
      at spawn (node:child_process:796:9)
      at TestContext.<anonymous> (node:internal/test_runner/runner:398:19)
```

The managed execution environment denied the Node test runner's child-process creation before the test file ran. A second run with `--test-isolation=none` was stopped after it produced no output and remained blocked in child-process-based fixture calls. Therefore no passing full-suite, success-record, failure-record, interrupted-record, status-output, or telemetry-output evidence is claimed.

`node --check tests/cli.test.ts`

```text
Exit code: 0
```

Static constraint check:

```text
tests 186
src/run.ts 69
src/workflow.ts 306
cli.ts
context.ts
reviewer.ts
run.ts
runner.ts
workflow.ts
forbidden_matches 0
```

Dependency shape check:

```text
dependencies false
devDependencies 2
```

`node dist/cli.js --help`

```text
Usage: bcos [--version | --help | task <start|submit|approve|request-changes|context|run|execute|status> <id>]
Exit code: 0
```

### Deviations
- Full `npm test` evidence and the requested runtime artifact/output samples could not be produced because this managed environment rejects nested child-process creation with `EPERM`. The Task cannot be reported complete until the suite passes in an environment that permits the existing fixture subprocesses.

### Known Risks
- The 186-test suite has not executed in this environment, so runtime regressions may remain despite a successful TypeScript build and syntax checks.
- The forced-interruption test and all workflow fixture paths require confirmation on a host that permits child processes.

### Context Used
- Files read: 11
- Outside Expected Files: 0
- `src/run.ts`: 69 lines
- `src/workflow.ts`: 306 lines (from 270, +36)
- `src/cli.ts`: 474 lines (from 431, +43)

### Host Verification and Re-verification — 2026-08-11T01:31:54Z

**Ownership note.** This subsection was written by `claude-code` acting as manager, not by
the worker, on the user's explicit instruction. Reports are normally worker-owned; the
deviation is recorded here rather than hidden. Everything above this heading is the
worker's own text and was not edited.

**1. Worker sandbox — Environment Failure (fourth consecutive task).**

The worker again could not spawn child processes and so could not run the suite. Its
`Known Risks` says so and declines to claim completion. Counted as an environment
failure, not a code failure.

**2. First host verification — 185 / 186.**

The `task execute` run reached the verification stage and stopped there:

```text
telemetry workflow_exit_reason=verification
telemetry verification_exit_code=1
telemetry lifecycle_transitions_caused=1
```

**`submit` was correctly withheld** and the Task stayed `IN_PROGRESS`. The single failure:

```text
✖ a killed workflow leaves valid running observation
  'start' !== 'worker'
```

**3. Root cause — test synchronization defect, not a product defect.**

The test waited only for the run artifact to exist, then killed the workflow. The artifact
is created at the `start` stage, so the kill consistently landed before `worker` began,
while the assertion expected `current_stage === "worker"`. It failed **5 out of 5 runs** —
deterministic, not flaky.

Verified independently by polling until `current_stage === "worker"` (reached in 250 ms)
and only then killing: the record then held exactly what the test expects. **The product
recorded the stage it was actually in. The test asserted a state its own synchronization
did not guarantee.**

**4. Fix — `tests/cli.test.ts`, wait condition only.**

The wait changed from "run artifact exists" to "the artifact reports `current_stage ===
"worker"`", reusing the existing `workflowRunFiles` and `workflowRun` helpers. The loop
bound (50 × 20 ms) is unchanged.

**No assertion was relaxed** — `expected "worker"` stands. No test was deleted or skipped,
no product code was touched, and no new helper or framework was introduced.

**5. Final suite — 186 / 186.**

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

```text
✔ a killed workflow leaves valid running observation (321.9656ms)
ℹ tests 186
ℹ suites 0
ℹ pass 186
ℹ fail 0
```

**6. `--verify-only` — no worker re-run.**

```text
node dist/cli.js task execute T-012 --worker codex --actor-id codex-cli --verify-only
```

```text
telemetry runner_invocations=0
telemetry verification_runs=1
telemetry verification_command=npm-test
telemetry verification_exit_code=0
telemetry verification_duration_ms=73043
telemetry lifecycle_transitions_caused=1
telemetry workflow_exit_reason=success
telemetry execution_id=20260811T012939320Z-6e0b63f5
telemetry workflow_status=success
telemetry current_stage=submit
```

**Codex was not re-run.** `runner_invocations=0`, the existing Report was reused
unmodified, and `start` and `worker` are both recorded as `skipped`.

**7. Lifecycle — final.**

```text
status: IMPLEMENTED
attempt: 1
TASK_STARTED   1  (2026-08-10T03:16:23.972Z, unchanged)
TASK_SUBMITTED 1  (2026-08-11T01:30:52.481Z)
TASK_APPROVED  0
current_task   null
counts         IMPLEMENTED 1, DONE 11
```

No second `TASK_STARTED` was created and the attempt stayed at 1.

**8. Bootstrap limitation — recorded, not hidden.**

**T-012's own first workflow produced no run artifact.** That execution started from the
`dist/` build that predated this task, so the recording code was not loaded. The artifact
that exists, `20260811T012939320Z-6e0b63f5.json`, comes from the `--verify-only`
re-verification, not from the original attempt-1 run.

Consequently the repository holds **no persistent record of the ~465-second worker run**
that produced this implementation. The only evidence of it is a redirected log — which is
precisely the problem T-012 exists to remove. The first task whose whole execution is
observable will be the next one.

**9. Observability re-verified on the new build.**

```text
artifact created per execution, one file each
execution_id  20260811T013127666Z-55289cc5  (millisecond stamp + 8 hex)
filenames sort chronologically; task status selects the last
stages distinguish not_started / skipped / success / failed
--execution <id> resolves a specific run; unknown id exits 1
task with no records exits 0 and says so; unknown task exits 1
task status writes nothing
interruption: 9 / 9 — status stays running, no completed_at,
  no interrupted/unknown in the file, current_stage preserved
privacy: 619 B and 632 B artifacts, no absolute path, no prompt,
  no context package, no environment, no stdout/stderr body
atomic write: zero temp files left, every artifact valid JSON
stdout telemetry: existing keys intact, execution_id added and
  matching the artifact
lifecycle SSOT: no task status field in the artifact, zero
  non-transition records in events.jsonl
```

**Scope violations: 0. Ponytail violations: 0.** `src/run.ts` 69 lines (limit 120),
`src/workflow.ts` 306 (limit 310), no class, no dependency, no `package-lock.json`,
`src/context.ts` · `src/runner.ts` · `src/reviewer.ts` unchanged.
