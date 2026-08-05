---
task: T-006
---

# Report — T-006

## Attempt 1 — 2026-08-05T03:08:46.887Z

### Implemented
`task approve`의 6개 가드를 쓰기 전에 검사하고, 통과 시 Task, events.jsonl,
state.json 순서로 `IMPLEMENTED → DONE` 전이를 기록한다. 현재 attempt와 일치하는
`TASK_SUBMITTED` 이벤트의 `actor_id`만 조회해 동일 actor의 승인을 거부한다.

### Files Changed
- src/cli.ts (modified)
- tests/cli.test.ts (modified)
- .bcos/reports/T-006-task-approve-command.md (new)

### Test Evidence

`npm run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`npm test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ --version prints the package version (82.0845ms)
✔ --help prints usage (80.0786ms)
✔ an unknown argument fails with an error (78.8813ms)
✔ task start updates frontmatter and preserves the body (97.9626ms)
✔ task start appends an eight-field event (97.8081ms)
✔ task start recalculates state (97.5396ms)
✔ a missing Task changes no files (90.0589ms)
✔ a non-TODO Task changes no files (90.7313ms)
✔ an existing IN_PROGRESS Task changes no files (90.1862ms)
✔ an empty required section changes no files (87.1023ms)
✔ a missing actor id changes no files (88.5277ms)
✔ task start accepts one blank line after headings (97.8014ms)
✔ task start accepts multiple blank lines after headings (98.5599ms)
✔ task start accepts multiple paragraphs (92.8073ms)
✔ task start accepts a section that starts with a list (93.0385ms)
✔ task start accepts a table in a section (92.7614ms)
✔ task start accepts a code block in a section (92.1852ms)
✔ task start accepts a T-004-style Task fixture (91.1859ms)
✔ a whitespace-only section before an extra H2 changes no files (91.0906ms)
✔ a TODO-only section changes no files (90.7135ms)
✔ a TBD-only or placeholder-only section changes no files (179.2187ms)
✔ a missing required heading changes no files (89.3635ms)
✔ required headings out of order change no files (89.7631ms)
✔ task submit updates frontmatter without changing attempt or body (98.0607ms)
✔ task submit appends an eight-field event (98.1267ms)
✔ task submit recalculates state and clears current task (97.5211ms)
✔ task submit with a missing Task changes no files (88.5898ms)
✔ task submit with a non-IN_PROGRESS Task changes no files (89.0475ms)
✔ task submit without a Report changes no files (88.2165ms)
✔ task submit without the current attempt heading changes no files (93.7476ms)
✔ task submit without an actor id changes no files (89.89ms)
✔ task approve updates frontmatter without changing attempt or body (102.6801ms)
✔ task approve appends one eight-field event (95.8548ms)
✔ task approve recalculates state and clears current task (96.719ms)
✔ task approve with a missing Task changes no files (96.4715ms)
✔ task approve with a non-IMPLEMENTED Task changes no files (93.7463ms)
✔ task approve without a Review changes no files (93.9092ms)
✔ task approve without the current attempt Review changes no files (95.206ms)
✔ task approve rejects a CHANGES_REQUESTED Review without changes (94.3876ms)
✔ task approve rejects BLOCKED and other verdicts without changes (188.4345ms)
✔ task approve rejects the current attempt submitter without changes (98.9455ms)
✔ task approve without a current submit event changes no files (96.8076ms)
✔ task approve uses the current attempt and permits the previous submitter (95.0268ms)
✔ task approve uses the current attempt and rejects the current submitter (93.7387ms)
✔ task approve without an actor id changes no files (93.9838ms)
✔ task approve rejects the worker role without changes (92.5489ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4652.9348

Exit code: 0
```

`node dist/cli.js --version`

```text
0.1.0
Exit code: 0
```

`node dist/cli.js --help`

```text
Usage: bcos [--version | --help | task <start|submit|approve> <id> --actor-role <role> --actor-id <id>]
Exit code: 0
```

`node dist/cli.js foo`

```text
Unknown argument: foo
Exit code: 1
```

OS 임시 디렉터리의 독립 fixture에서 `task start`와 `task submit` 정상 전이를 실행했다.

```text
start exit=0 stderr=""
submit exit=0 stderr=""
```

별도의 OS 임시 fixture에서 `task approve` 정상 전이와 append된 실제 이벤트를 확인했다.

```text
approve exit=0 stderr=""
approve event={"ts":"2026-08-05T03:08:27.528Z","event":"TASK_APPROVED","task":"T-100","attempt":1,"actor_role":"reviewer","actor_id":"reviewer-a","from":"IMPLEMENTED","to":"DONE"}
```

동일 actor가 현재 attempt를 승인하는 SoD 실패 fixture 결과다. 실행 전후 Task,
events.jsonl, state.json, Review 문자열을 비교했다.

```text
SoD exit=1 stderr="The submitting actor cannot approve the same attempt\n"
SoD files unchanged=true
```

완료 후 제약 확인:

```text
src/cli.ts lines=303
src files=cli.ts
package-lock.json exists=False
```

### Deviations
None

### Known Risks
None

### Context Used
- Files read: 8
- Outside Expected Files: 0
- src/cli.ts lines after implementation: 303
