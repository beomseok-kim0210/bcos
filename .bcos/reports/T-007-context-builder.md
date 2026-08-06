---
task: T-007
---

# Report — T-007

## Attempt 1 — 2026-08-06T03:09:03Z

### Implemented

`task context <id>` 라우팅과 stdout 출력을 추가했다. `src/context.ts`에서 시작 frontmatter, `Expected Files` 내부 Read List, 첫 백틱 경로와 note를 추출하고, 중복 제거와 8종 검증을 모두 마친 뒤 결정론적 Package를 조립한다. 실패 시 Package를 반환하지 않으며 8,000자 초과는 stderr 경고만 반환한다.

### Files Changed

- `src/context.ts` (new)
- `src/cli.ts` (modified)
- `tests/cli.test.ts` (modified)
- `.bcos/reports/T-007-context-builder.md` (new)

### Test Evidence

`cmd /c npm run build` — exit code 0

```text
> bcos@0.1.0 build
> tsc
```

`cmd /c npm test` — exit code 0

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ --version prints the package version
✔ --help prints usage
✔ an unknown argument fails with an error
✔ task start updates frontmatter and preserves the body
✔ task start appends an eight-field event
✔ task start recalculates state
✔ a missing Task changes no files
✔ a non-TODO Task changes no files
✔ an existing IN_PROGRESS Task changes no files
✔ an empty required section changes no files
✔ a missing actor id changes no files
✔ task start accepts one blank line after headings
✔ task start accepts multiple blank lines after headings
✔ task start accepts multiple paragraphs
✔ task start accepts a section that starts with a list
✔ task start accepts a table in a section
✔ task start accepts a code block in a section
✔ task start accepts a T-004-style Task fixture
✔ a whitespace-only section before an extra H2 changes no files
✔ a TODO-only section changes no files
✔ a TBD-only or placeholder-only section changes no files
✔ a missing required heading changes no files
✔ required headings out of order change no files
✔ task submit updates frontmatter without changing attempt or body
✔ task submit appends an eight-field event
✔ task submit recalculates state and clears current task
✔ task submit with a missing Task changes no files
✔ task submit with a non-IN_PROGRESS Task changes no files
✔ task submit without a Report changes no files
✔ task submit without the current attempt heading changes no files
✔ task submit without an actor id changes no files
✔ task approve updates frontmatter without changing attempt or body
✔ task approve appends one eight-field event
✔ task approve recalculates state and clears current task
✔ task approve with a missing Task changes no files
✔ task approve with a non-IMPLEMENTED Task changes no files
✔ task approve without a Review changes no files
✔ task approve without the current attempt Review changes no files
✔ task approve rejects a CHANGES_REQUESTED Review without changes
✔ task approve rejects BLOCKED and other verdicts without changes
✔ task approve rejects the current attempt submitter without changes
✔ task approve without a current submit event changes no files
✔ task approve uses the current attempt and permits the previous submitter
✔ task approve uses the current attempt and rejects the current submitter
✔ task approve without an actor id changes no files
✔ task approve rejects the worker role without changes
✔ task context prints the package header and footer without changing .bcos
✔ task context includes each Read List file exactly once
✔ task context removes duplicate paths and updates the file count
✔ task context preserves Read List order
✔ task context is byte-for-byte deterministic
✔ task context reads metadata only from the opening frontmatter
✔ task context reports exact file, character, and line totals
✔ task context preserves UTF-8 Korean text
✔ task context accepts a copied real T-004 Task fixture
✔ task context includes a copied real RFC-001 fixture in full
✔ task context rejects a missing Task without stdout
✔ task context rejects a missing Read List label without stdout
✔ task context rejects an empty Read List without stdout
✔ task context rejects a missing file without stdout
✔ task context rejects parent traversal and absolute paths without stdout
✔ task context rejects a NUL binary sample without stdout
✔ task context rejects files larger than 256 KB without stdout
✔ task context rejects every sensitive path pattern without stdout
✔ task context warns but succeeds when the package exceeds 8,000 characters
✔ lifecycle start, submit, and approve retain success and failure paths
ℹ start success: exit 0, start failure: exit 1, submit success: exit 0, submit failure: exit 1, approve success: exit 0, approve failure (SoD): exit 1
ℹ tests 66
ℹ suites 0
ℹ pass 66
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

신규 테스트 20개, 전체 66개 중 66개 pass.

`node dist/cli.js --version` — exit code 0

```text
0.1.0
```

`node dist/cli.js --help` — exit code 0

```text
Usage: bcos [--version | --help | task <start|submit|approve|context> <id> --actor-role <role> --actor-id <id>]
```

`node dist/cli.js foo` — exit code 1

```text
Unknown argument: foo
```

임시 fixture 정상 생성 및 동일 입력 2회 비교 — exit code 0

```text
=== BCOS CONTEXT PACKAGE v0.1 ===
task: T-100
status: IN_PROGRESS
attempt: 3
files: 2
characters: 9
lines: 4

SHA256 RUN 1: ba4d502b509c902b1701861ad7a207c6d93abb10a6c0d92426399a2d4918b479
SHA256 RUN 2: ba4d502b509c902b1701861ad7a207c6d93abb10a6c0d92426399a2d4918b479
HASH MATCH: True
READ LIST ITEMS: 3
PACKAGE FILES: 2
DUPLICATES REMOVED: 1
SUCCESS .bcos UNCHANGED: True
```

임시 fixture 실패 경로 — exit code 1

```text
FAILURE STDOUT CHARACTERS: 0
FAILURE STDERR: Read List file does not exist: missing.txt
FAILURE .bcos UNCHANGED: True
SENSITIVE PATH CASES: 11
PARTIAL STDOUT OBSERVED: False
```

실제 T-004 Task 전문과 RFC-001 전문을 임시 fixture에 복사한 테스트가 각각 통과했다. 8,000자 초과 테스트는 stderr 경고와 exit code 0을 검증했다. 실제 저장소의 Task, `events.jsonl`, `state.json`은 테스트 입력으로 사용하거나 수정하지 않았다.

환경 실패와 코드 실패 구분: 첫 측정 harness는 Windows PowerShell 5.1의 `ProcessStartInfo.ArgumentList` 미지원으로 exit code 1(`null-valued expression`)이었고, `Arguments` 호환 방식으로 다시 실행해 위 결과를 얻었다. 이는 구현 코드 실행 전의 환경/harness 실패다. `foo`의 exit code 1과 실패 fixture의 exit code 1은 기대한 코드 거부 경로다. 그 밖의 코드 실패는 없었다.

### Deviations

None.

### Known Risks

None.

### Context Used

- Files read: 8
- Files read: `AGENTS.md`, `.bcos/tasks/T-007-context-builder.md`, `.bcos/prompts/T-007-context-builder-codex-prompt.md`, `src/cli.ts`, `tests/cli.test.ts`, `package.json`, `docs/rfcs/RFC-001-task-protocol.md`, `.bcos/tasks/T-004-task-submit-command.md`
- Outside Expected Files: 0
- Read List 밖 접근: 0
- `src/cli.ts`: 318 lines
- `src/context.ts`: 165 lines
- `src/` files: `cli.ts`, `context.ts`; subdirectories: 0
- `package-lock.json`: absent
