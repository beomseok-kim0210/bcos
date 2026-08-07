---
task: T-010
---

# Report — T-010

## Attempt 1 — 2026-08-07T05:27:42.722Z

### Implemented

- Added `task execute` routing and option parsing for worker, actor, timeout, worker command, verifier command, and verify-only execution.
- Added a function-only workflow orchestrator with environment probing, nested-worker rejection, lifecycle reuse, worker execution, Report gating, host verification, resume behavior, and workflow telemetry.
- Marked runner children with `BCOS_WORKER_SESSION=1` and exposed timeout notification to the orchestrator without changing existing runner exit codes.
- Added 30 workflow-focused tests, bringing the declared total to 129.
- Added the workflow measurement contract fields and blocked resume-count definition to the Telemetry document.

### Files Changed

- src/cli.ts (modified)
- src/runner.ts (modified)
- src/workflow.ts (new)
- tests/cli.test.ts (modified)
- docs/benchmarks/TELEMETRY.md (modified)
- .bcos/reports/T-010-workflow-orchestrator-poc.md (new)

### Test Evidence

`node "<npm-install>/node_modules/npm/bin/npm-cli.js" run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`node dist/cli.js --version`; `node dist/cli.js --help`; `node dist/cli.js foo`

```text
0.1.0
Usage: bcos [--version | --help | task <start|submit|approve|context|run|execute> <id>]
Unknown argument: foo

Exit codes: 0 / 0 / 1
```

`npm test` (invoked through the npm JavaScript entry because PowerShell blocks `npm.ps1`)

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✖ tests\cli.test.ts (2.6975ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10.9597

✖ failing tests:

test at tests\cli.test.ts:1:1
✖ tests\cli.test.ts (2.6975ms)
  Error: spawn EPERM
      at ChildProcess.spawn (node:internal/child_process:421:11)
      at spawn (node:child_process:796:9)
      at TestContext.<anonymous> (node:internal/test_runner/runner:398:19)
      at FileTest.runInAsyncScope (node:async_hooks:214:14)
      at FileTest.run (node:internal/test_runner/test:1106:25)
      at FileTest.start (node:internal/test_runner/test:1003:17)
      at runTestFile (node:internal/test_runner/runner:477:32)
      at node:internal/test_runner/runner:769:25
      at node:internal/per_context/primordials:559:37
      at new Promise (<anonymous>) {
    errno: -4048,
    code: 'EPERM',
    syscall: 'spawn'
  }

Exit code: 1
```

Static quality check:

```text
workflow_lines=174
cli_lines=393
runner_lines=248
declared_tests=129
src_files=cli.ts, context.ts, runner.ts, workflow.ts
banned_shell_matches=0
```

The normal-flow summary, nested-worker runtime message, verification-failure state, complete workflow telemetry, and lifecycle regression output could not be produced in this worker session because every Node child-process attempt is denied with `EPERM`. They require the host-shell `npm test` run specified by the Task.

### Deviations

- The required host test suite could not be completed in this BCOS worker sandbox. The default Node test runner failed before loading the test file because it could not spawn its test child process. A diagnostic run with test isolation disabled declared 129 tests but the tests' own CLI child processes were likewise denied. No `bcos` command was run because the execution prompt explicitly prohibited it.

### Known Risks

- Acceptance Criteria 8–78 and 79's passing-test requirement remain unverified until `npm test` is run from a host shell that permits child processes.
- The implementation is therefore not claimed complete despite a successful TypeScript build and static quality checks.

### Context Used

- Files read: 8
- Outside Expected Files: 0
- `src/workflow.ts`: 174 lines
- `src/cli.ts`: +39 lines (354 → 393)
- `src/runner.ts`: +3 lines (245 → 248)

### Re-verification — 2026-08-07T05:52:44Z

**Ownership note.** This subsection was written by `claude-code` acting as manager, not by
the worker, on the user's explicit instruction to record the rework inside Attempt 1.
Reports are normally worker-owned; the deviation is recorded here rather than hidden.
Everything above this heading is the worker's own text and was not edited.

**1. Worker's `npm test` — Environment Failure, not a code failure.**

The worker's sandbox denied every Node child-process attempt with `spawn EPERM`
(errno -4048), so the suite never ran. A diagnostic run with test isolation disabled
declared 129 tests but the tests' own CLI children were denied the same way. **No
assertion was evaluated.** Counted separately from code failures — this is the second
task in a row where the worker could not verify itself, and it is the reason T-010 exists.

**2. Host `npm test` — Test Regression, 1 failure out of 129.**

```text
ℹ tests 129
ℹ pass 128
ℹ fail 1

✖ task execute stops before lifecycle and runner when child creation is denied
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + undefined
  - 'environment'
      at tests/cli.test.ts:1445:10
```

`result.status === 1` passed on the line above; only `workflow_exit_reason` was missing.

**3. Cause — a real defect in the product code, not a stale assertion.**

The failing fixture denies child creation with Node's permission model:

```text
node --permission --allow-fs-read=* --allow-fs-write=* dist/cli.js task execute ...
```

Probed directly under that flag:

```text
THREW: name=Error code=ERR_ACCESS_DENIED
message=Access to this API has been restricted. Use --allow-child-process to manage...
```

**Under the permission model `spawnSync` throws; it does not return `{ error }`.**
The probe at `src/workflow.ts` only inspected `probe.error`, so the throw escaped
`executeWorkflow` entirely. The CLI's catch printed the message and set exit 1 — which is
why the exit-code assertion passed — but `finish()` never ran, so **no telemetry line was
emitted at all**. `workflow_exit_reason` was `undefined` because the whole telemetry block
was skipped, not because the classification was wrong.

**Contract check.** The Task classifies `EPERM` as `permission` and any other probe spawn
failure as `environment`. `ERR_ACCESS_DENIED` is not `EPERM`, so `environment` is the
value the contract requires. **The test expected the right thing; the code could not
produce it.** The assertion was left untouched.

**4. Fix — `src/workflow.ts`, one site.**

The probe now treats a thrown error exactly as it treats a returned one:

```text
let probeError: NodeJS.ErrnoException | undefined;
try {
  probeError = spawnSync(process.execPath, ["-e", ""], { shell: false, stdio: "ignore" }).error;
} catch (error) {
  probeError = error as NodeJS.ErrnoException;
}
if (probeError) {
  return finish(probeError.code === "EPERM" ? "permission" : "environment", "...");
}
```

Net +4 lines. **`src/workflow.ts` is the only file changed in the rework** — no test was
added, removed, renamed, or reworded, and `src/cli.ts`, `src/runner.ts`,
`tests/cli.test.ts`, and `docs/benchmarks/TELEMETRY.md` are the worker's Attempt 1 output
unchanged. **Product code was changed, because the defect was in the product code.**

**5. `npm run build` and `npm test` after the fix.**

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ task execute stops before lifecycle and runner when child creation is denied (111.934ms)
ℹ tests 129
ℹ suites 0
ℹ pass 129
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 30664.7626
```

**tests 129 / pass 129 / fail 0, exit 0.**

**6. Independent verification — 16 checks, all passing.**

Run against a fixture built for this purpose, with a worker and a verifier that each
write a marker file if they execute.

```text
exit 1
workflow_exit_reason=environment
lifecycle_transitions_caused=0
runner_invocations=0
verification_runs=0
nested_worker_detected=false
verification_exit_code   not emitted   (a missing value is not written as zero)
verification_command     not emitted
worker marker file       absent        (the worker never ran)
verifier marker file     absent        (the verifier never ran)
.bcos recursive hash     unchanged
task status              TODO
events.jsonl             empty
telemetry lines          no absolute path
control run, no --permission: workflow proceeds and the worker marker appears
```

The control run matters: it shows the probe is not failing everything, only the denied
environment.

**7. Invariants.**

```text
src/workflow.ts      178 lines (limit 200), no class
src files            cli.ts, context.ts, runner.ts, workflow.ts
src subdirectories   0
dependencies         none; devDependencies 2
package-lock.json    absent
forbidden strings    0 (_rate, _ratio, efficiency, improvement, savings, reduction)
shell: true / cmd /c 0
```

**Scope violations: 0. Ponytail violations: 0.** No dependency, no new file, no new
abstraction — the fix is a try/catch around a call that already existed.

**Observation, not fixed.** `verify()` spawns through the same API and would fail the same
way if permissions were revoked mid-run. It is unreachable in practice because the probe
gates it, so it was left alone to keep the rework minimal. Recorded here rather than
changed unasked.

**Lifecycle untouched.** `.bcos/tasks/T-010-workflow-orchestrator-poc.md` remains
`IN_PROGRESS` at attempt 1 with one event; `events.jsonl` and `state.json` were not
modified by the rework. No `bcos` command and no `git` command was run.
