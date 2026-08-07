---
task: T-009
---

# Report — T-009

## Attempt 1 — 2026-08-07T04:11:10Z

### Implemented

- Removed all `.bcos/prompts/` discovery, prompt-count validation, delimiter parsing, and prompt-body insertion from Runner.
- Added the fixed Korean preamble with only Task ID, worker name, and Report path as variable values, followed by one Context Package.
- Added a guard requiring the Context Package file headers to contain the Task file itself.
- Added a 1,800-second default worker timeout while retaining strict rejection of zero, negative, fractional, and non-numeric overrides.
- Added stdout-only raw telemetry for context/stdin identity, configured timeout, first stdout or stderr response, duration, exit, timeout state, byte counts, retry count, and Runner transition count.
- Kept dry-run free of stdin content and process-only telemetry fields.
- Added fixture coverage for deterministic input, ignored/missing prompts, fixed preamble invariance, Task self-inclusion, telemetry keys and hashes, two-second first-response timing, timeout override, and `.bcos` immutability.

### Files Changed

- `src/runner.ts` (modified) — replaced hand-written Prompt loading with the fixed preamble; added Task self-inclusion validation, default timeout, first-response timing, and telemetry output.
- `tests/cli.test.ts` (modified) — changed the former missing/multiple/malformed/empty Prompt rejection tests because Prompt files are no longer an input; added T-009 Runner and telemetry tests using the existing temporary fake-worker fixture.
- `.bcos/reports/T-009-prompt-builder.md` (new) — recorded Attempt 1 implementation and verification evidence.

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

✖ tests\cli.test.ts (3.1205ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14.4225

✖ failing tests:

test at tests\cli.test.ts:1:1
✖ tests\cli.test.ts (3.1205ms)
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
```

The in-process fallback `node --test --test-isolation=none tests/cli.test.ts` discovered all 99 tests, but the managed sandbox also denied every test fixture's `spawnSync` with `EPERM`; result: 99 tests, 1 pass, 98 environment-blocked failures. No real Codex process was invoked.

CLI smoke commands:

```text
node dist/cli.js --version
0.1.0
version_exit=0

node dist/cli.js --help
Usage: bcos [--version | --help | task <start|submit|approve|context|run> <id>]
help_exit=0

node dist/cli.js foo
Unknown argument: foo
foo_exit=1
```

Static acceptance checks:

```text
runner_lines=245
test_declarations=99
src_files=cli.ts,context.ts,runner.ts
src_dirs=
forbidden_matches=0
prompt_read_matches=0
package_lock=False
```

### Deviations

- Required fake-worker execution evidence, dry-run transcript, telemetry transcript, two-Task preamble comparison output, delayed-response measurement, and lifecycle regression execution could not be captured because this managed environment rejects Node child-process creation with `spawn EPERM`. The implementation and tests were not weakened or bypassed; the blocked commands and results are recorded above.

### Known Risks

- `npm test` has not passed in this environment. Runtime assertions involving the CLI and fake worker remain unverified until the 99-test suite is run in an environment that permits Node child processes. Therefore this attempt does not claim completion of all Acceptance Criteria.

### Context Used

- Files read: 8
- Outside Expected Files: 0
- `src/runner.ts`: 245 lines, +39 lines versus T-008's 206 lines

### Re-verification — 2026-08-07T04:38:07Z

**Ownership note.** This subsection was written by `claude-code` acting as manager, not by
the worker, on the user's explicit instruction to record the rework inside Attempt 1.
Reports are normally worker-owned; the deviation is recorded here rather than hidden.
Everything above this heading is the worker's own text and was not edited.

**1. Worker's first `npm test` — Environment Failure, not a code failure.**

The worker's sandbox rejected Node child-process creation with `spawn EPERM` (errno
-4048), so the suite never ran. The in-process fallback discovered all 99 tests but every
fixture's `spawnSync` was denied the same way. **No assertion was evaluated.** This is an
environment failure and is counted separately from code failures.

**2. Host `npm test` — Test Regression, 3 failures out of 99.**

Run independently on the host, the suite reported 99 tests / 96 pass / 3 fail, exit
non-zero. The failures were:

```text
✖ task run streams fake worker stdout and stderr and reports byte counts
✖ task run reports exit zero and execution duration
✖ task run distinguishes and propagates fake worker exit 3
```

**3. Cause — legacy output assertions, in the tests only.**

All three asserted the human-readable Runner summary that T-009 replaced:

| Legacy assertion | Current output |
|---|---|
| `Worker stdout bytes: <n>` | `telemetry worker_stdout_bytes=<n>` |
| `Worker stderr bytes: <n>` | `telemetry worker_stderr_bytes=<n>` |
| `Worker exit code: 0` | `telemetry worker_exit_code=0` |
| `Worker duration ms: <n>` | `telemetry worker_duration_ms=<n>` |
| `Worker exit code: 3` | `telemetry worker_exit_code=3` |

The telemetry format is the contract this task specifies — see the Task's Scope
(`telemetry <key>=<value>`, one field per line) and Acceptance Criteria 22, 23, and 26.
`task run` is not among the commands the Task forbids changing; only `start`, `submit`,
`approve`, and `context` are. **The product code was therefore left alone and the stale
assertions were corrected.**

`Worker failed with exit code 3` on stderr was kept by the implementation, so that
assertion still passes and was not touched.

**4. Files changed in the rework.**

- `tests/cli.test.ts` — five assertion lines rewritten to the telemetry format across the
  three failing tests. No test was added, removed, renamed, or restructured.
- `src/runner.ts` — **not modified.** The 245-line file is the worker's Attempt 1 output,
  unchanged.

**5. `npm run build` and `npm test` after the fix.**

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ task run streams fake worker stdout and stderr and reports byte counts (322.2117ms)
✔ task run reports exit zero and execution duration (281.2633ms)
✔ task run distinguishes and propagates fake worker exit 3 (235.6502ms)
ℹ tests 99
ℹ suites 0
ℹ pass 99
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21518.2522
```

**tests 99 / pass 99 / fail 0, exit 0.**

**6. Independent verification — 31 checks, all passing.**

Run against a fixture built for this purpose rather than relying on the suite.

```text
fake exit 0 → process exit 0, telemetry worker_exit_code=0
fake exit 3 → process exit 3, telemetry worker_exit_code=3
worker_stdout_bytes / worker_stderr_bytes / worker_duration_ms numeric in both cases
stdout and stderr forwarded to the parent in both cases
stderr carries "Worker failed with exit code 3" for the non-zero case
dry-run succeeds with no .bcos/prompts directory present
worker_timeout_seconds=1800 by default
dry-run omits every process-only field
retry_count=0, runner_transitions_caused=0
dry-run twice → identical stdin_sha256
read list missing its own Task file → exit 1
.bcos hash unchanged on every path above
start / submit / approve / context: success and failure each, G3, G4, and G5 intact
```

**7. Invariants.**

```text
src/runner.ts        245 lines (limit 250)
src files            cli.ts, context.ts, runner.ts
src subdirectories   0
dependencies         none; devDependencies 2
package-lock.json    absent
forbidden strings    0 (_rate, _ratio, efficiency, improvement, savings, reduction)
shell: true / cmd /c 0
```

**Scope violations: 0. Ponytail violations: 0.** No dependency, no new source file, no
product-code change, no lifecycle file edited. `.bcos/tasks/T-009-prompt-builder.md`
remains `IN_PROGRESS` at attempt 1 with one event; `events.jsonl` and `state.json` are
untouched by the rework.
