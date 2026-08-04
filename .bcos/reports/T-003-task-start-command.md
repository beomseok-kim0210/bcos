---
task: T-003
---

# Report — T-003

## Attempt 1 — 2026-08-04T04:37:13.575Z

### Implemented
- Added `task start <id> --actor-role <role> --actor-id <id>` handling to the CLI.
- Added all five pre-write guards for Task lookup, TODO status, G1, G2, and actor arguments.
- Added ordered Task, event, and state updates with atomic replacement for the Task and state files.
- Added isolated temporary-repository tests for the successful transition and each required failure path.

### Files Changed
- src/cli.ts (modified)
- tests/cli.test.ts (modified)
- .bcos/reports/T-003-task-start-command.md (new)

### Test Evidence

`cmd /c npm run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`cmd /c npm test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ --version prints the package version (82.9859ms)
✔ --help prints usage (94.2623ms)
✔ an unknown argument fails with an error (89.1263ms)
✔ task start updates frontmatter and preserves the body (96.1997ms)
✔ task start appends an eight-field event (101.308ms)
✔ task start recalculates state (99.4305ms)
✔ a missing Task changes no files (92.1246ms)
✔ a non-TODO Task changes no files (94.8709ms)
✔ an existing IN_PROGRESS Task changes no files (92.9026ms)
✔ an empty required section changes no files (93.6741ms)
✔ a missing actor id changes no files (86.313ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1173.5439

Exit code: 0
```

`node dist/cli.js --version`

```text
0.1.0
Exit code: 0
```

`node dist/cli.js --help`

```text
Usage: bcos [--version | --help | task start <id> --actor-role <role> --actor-id <id>]
Exit code: 0
```

`node dist/cli.js foo`

```text
Unknown argument: foo
Exit code: 1
```

Normal start in an isolated temporary repository appended this event:

```json
{"ts":"2026-08-04T04:36:49.350Z","event":"TASK_STARTED","task":"T-001","attempt":1,"actor_role":"worker","actor_id":"codex-cli","from":"TODO","to":"IN_PROGRESS"}
```

The normal start command exited 0.

### Deviations
- The first manual evidence command created its fixture under `os.tmpdir()` but did not change its process cwd before invoking the CLI. It therefore read the real repository's Task files and exited 1 at the TODO-status guard. It did not reach the events or state reads and did not write any file. The command was rerun with the cwd explicitly changed to the temporary repository and exited 0. No test in `npm test` read or wrote the real repository's `.bcos/` directory.

### Known Risks
- As allowed by the Task specification, a filesystem failure after the atomic Task rename but before the event append can leave a partial lifecycle update; no transaction or rollback layer was added.

### Context Used
- Files read: 7
- Read List: AGENTS.md; .bcos/tasks/T-003-task-start-command.md; src/cli.ts; tests/cli.test.ts; package.json; docs/rfcs/RFC-001-task-protocol.md (§1, §2, §3, §5 only); .bcos/prompts/T-003-task-start-command-codex-prompt.md
- Outside Expected Files: 1 (.bcos/prompts/T-003-task-start-command-codex-prompt.md — worker bootstrap prompt supplied by the user)
- The failed manual evidence process read real Task files mechanically, but their contents were not surfaced into the agent context; see Deviations.
