---
task: T-004
---

# Report — T-004

## Attempt 1 — 2026-08-04T07:53:53.989Z

### Implemented
- Added `task submit <id> --actor-role <role> --actor-id <id>` for the `IN_PROGRESS` to `IMPLEMENTED` transition.
- Added guards for exactly one matching Task, `IN_PROGRESS` status, a Report containing the current attempt heading, and both actor arguments before any write.
- Preserved the Task attempt and body while updating status and timestamp, appending an eight-field `TASK_SUBMITTED` event, and recalculating state from Task files.
- Shared actor parsing, Task lookup, state recalculation, and ordered Task/event/state persistence between `task start` and `task submit`.
- Added isolated temporary-directory tests for the successful submit path and all required failure paths.

### Files Changed
- src/cli.ts (modified)
- tests/cli.test.ts (modified)
- .bcos/reports/T-004-task-submit-command.md (new)

### Test Evidence

`npm run build`

```text
> bcos@0.1.0 build
> tsc

exit 0
```

`npm test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ --version prints the package version (140.0867ms)
✔ --help prints usage (141.3114ms)
✔ an unknown argument fails with an error (103.3532ms)
✔ task start updates frontmatter and preserves the body (151.3102ms)
✔ task start appends an eight-field event (229.3433ms)
✔ task start recalculates state (153.6763ms)
✔ a missing Task changes no files (159.0555ms)
✔ a non-TODO Task changes no files (127.1141ms)
✔ an existing IN_PROGRESS Task changes no files (186.4723ms)
✔ an empty required section changes no files (144.2448ms)
✔ a missing actor id changes no files (107.7047ms)
✔ task start accepts one blank line after headings (155.9596ms)
✔ task start accepts multiple blank lines after headings (152.093ms)
✔ task start accepts multiple paragraphs (150.6679ms)
✔ task start accepts a section that starts with a list (109.3149ms)
✔ task start accepts a table in a section (140.2093ms)
✔ task start accepts a code block in a section (176.5951ms)
✔ task start accepts a T-004-style Task fixture (119.8178ms)
✔ a whitespace-only section before an extra H2 changes no files (128.2012ms)
✔ a TODO-only section changes no files (101.0972ms)
✔ a TBD-only or placeholder-only section changes no files (257.2167ms)
✔ a missing required heading changes no files (141.7137ms)
✔ required headings out of order change no files (217.3843ms)
✔ task submit updates frontmatter without changing attempt or body (186.4888ms)
✔ task submit appends an eight-field event (126.4608ms)
✔ task submit recalculates state and clears current task (151.1524ms)
✔ task submit with a missing Task changes no files (122.1491ms)
✔ task submit with a non-IN_PROGRESS Task changes no files (110.9151ms)
✔ task submit without a Report changes no files (106.9246ms)
✔ task submit without the current attempt heading changes no files (126.1091ms)
✔ task submit without an actor id changes no files (102.3301ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4799.6535

exit 0
```

`node dist/cli.js --version`

```text
0.1.0
exit=0
```

`node dist/cli.js --help`

```text
Usage: bcos [--version | --help | task <start|submit> <id> --actor-role <role> --actor-id <id>]
exit=0
```

`node dist/cli.js foo`

```text
Unknown argument: foo
exit=1
```

Temporary fixture regression and transition run:

```text
task start exit=0
status: IN_PROGRESS; attempt: 1
task submit exit=0
status: IMPLEMENTED; attempt: 1
submitted event={"ts":"2026-08-04T07:53:31.356Z","event":"TASK_SUBMITTED","task":"T-100","attempt":1,"actor_role":"worker","actor_id":"codex-cli","from":"IN_PROGRESS","to":"IMPLEMENTED"}
state counts={"TODO":0,"IN_PROGRESS":0,"IMPLEMENTED":1,"DONE":0,"BLOCKED":0}
state current_task=null
Task T-100 is not TODO
task start failure exit=1
task start failure files unchanged=true
```

Additional checks:

```text
src/cli.ts lines=234
package-lock.json exists=false
```

### Deviations
None

### Known Risks
None

### Context Used
- Files read: 7
- Outside Expected Files: 0
