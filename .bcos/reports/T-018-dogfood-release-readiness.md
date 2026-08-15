---
task: T-018
---

# Report — T-018

## Attempt 1 — 2026-08-15T02:44:28.090Z

### Implemented

- Updated the English and Korean README files to separate the eight implemented Task
  commands from genuinely missing commands, document optional Claude Worker support,
  describe manual external-project bootstrap, and collect the required known limits.
- Updated Worker and Claude entry-point guidance to reflect the host-owned workflow,
  Node.js 24+, the default Claude Manager/Reviewer + Codex Worker policy, optional
  `--worker claude`, and G5 separation of duties.
- Replaced the architecture module tree with the eight flat `src/*.ts` modules, retained
  artifact ownership, separated Run status from Task lifecycle state, and identified
  T-016 as a measurement harness rather than a trial.
- Updated the vision's execution model without changing its repository-owned-memory
  philosophy.
- Added only a historical-document banner to `docs/v0.1-scope.md`; its original plan body
  remains intact.

### Files Changed

- `README.md` (modified)
- `docs/README.ko.md` (modified)
- `CLAUDE.md` (modified)
- `AGENTS.md` (modified)
- `docs/architecture.md` (modified)
- `docs/vision.md` (modified)
- `docs/v0.1-scope.md` (modified)
- `.bcos/reports/T-018-dogfood-release-readiness.md` (new)

### Test Evidence

`npm.cmd run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`node dist/cli.js --help`

```text
Usage: bcos [--version | --help | task <start|submit|approve|request-changes|context|run|execute|status> <id>]
Exit code: 0
```

`Get-ChildItem -Path src -Filter *.ts -File | Sort-Object Name`

```text
benchmark.ts
cli.ts
context.ts
model.ts
reviewer.ts
run.ts
runner.ts
workflow.ts
Exit code: 0
```

Static searches over the seven modified documents:

```text
AGENTS.md + docs/architecture.md: task show/task block hits: 0
docs/architecture.md: src/core/ and src/util/ hits: 0
Stale claims (pre-implementation, T-001 pending, Node 22, Codex-only, implemented items
listed as Planned): 0
Superiority declarations (stable, production-ready, faster, cheaper, more efficient,
beats, and Korean equivalents): 0
Missing-command hits outside docs/v0.1-scope.md: only Planned/Known Missing prose
docs/v0.1-scope.md: historical-document/current-reference banner present
All seven modified documents: LF line endings
```

`node -e "const p=require('./package.json'); ..."`

```text
version=0.1.0
engines.node=>=24
Exit code: 0
```

External dogfood smoke used
`C:\Users\Public\Documents\ESTsoft\CreatorTemp\bcos-t018-dogfood` as cwd and the
current built `dist/cli.js`. The corrected fixture used a three-file Read List.

```text
task context T-001: exit 0
status: IN_PROGRESS
attempt: 1
files: 3
foreign_repo_hits=0
absolute_or_username_hits=0

task start T-001 --actor-role worker --actor-id codex-cli: exit 0
task run T-001 --worker codex --dry-run: exit 0
telemetry context_files=3
telemetry worker_timed_out=false
telemetry runner_transitions_caused=0
task status T-001: exit 0
Task T-001 (IN_PROGRESS) has no workflow execution records.

init: exit 1
status (project-global): exit 1
reindex: exit 1
task show T-001: exit 1
task block T-001: exit 1
```

The smoke used `--dry-run`, so it started no model process and made no network call. The
fixture files and directories were removed after execution (`fixture_removed=True`).

`npm.cmd test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

tests 1
pass 0
fail 1
skipped 0
Error: spawn EPERM
    at ChildProcess.spawn (node:internal/child_process:421:11)
Exit code: 1
```

The Node test runner was denied child-process creation before `tests/cli.test.ts` could
run, so the required 289/289 result was not obtained in this Worker sandbox.

### Deviations

- The user explicitly prohibited `git` commands. Therefore the required `git diff`
  checks in T6/T8 and the exact working-tree `?? x` check were not run. Repository edits
  were made only through `apply_patch` to the seven allowed documents and this Report.
- `npm run build` first resolved to the execution-policy-blocked `npm.ps1`. The same
  package script was then run successfully with `npm.cmd run build`.
- The first smoke fixture used the label `Read List` and was rejected with
  `Read List label is missing`; it was corrected to the Task contract's
  `읽기 허용 (Read List)` label, after which all four required smoke commands passed.

### Known Risks

- Acceptance Criterion 30 is not verified: the required 289/289 test run is blocked by
  this Worker's `spawn EPERM` sandbox restriction. This is an environment failure before
  test execution, not a passing regression result.
- Acceptance Criteria 25 and 28 cannot be fully evidenced without the prohibited
  working-tree diff commands. The external fixture itself was removed successfully.
- `workflow.ts` is at its documented 340/340 maintenance ceiling; no source change was
  made in this documentation-only Task.

### Context Used

- Files read: 10 (the complete supplied Context Package)
- Outside Expected Files: 0

### Additional Test Evidence

`node --test --test-isolation=none tests/cli.test.ts` was attempted after the normal test
runner hit `spawn EPERM`. It bypassed the runner's initial isolation spawn but changed the
suite's required isolation semantics: most cases reported failure, three reported pass,
and the command timed out after 180 seconds. It is not accepted as regression evidence
and does not replace the required `npm test` result.
