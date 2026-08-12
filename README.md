# BCOS

**A task-centric, Git-based operating layer for AI coding agents.**

> **Status: Experimental.** Task protocol `0.1` and a CLI prototype.
> The protocol makes no compatibility promises yet. See [RFC-001 §10](docs/rfcs/RFC-001-task-protocol.md)
> for what has to happen before `1.0`.

[한국어 문서](docs/README.ko.md)

---

## Why BCOS

AI coding agents are good at writing code and bad at remembering projects.
Five problems show up repeatedly:

- **Context dies with the session.** Close the window and the project has to be re-explained.
- **No shared source of truth between agents.** What one agent knows, another does not.
- **Self-verification bias.** Whoever wrote the code declares it done.
- **Context cost.** Every task re-reads the whole repository to reorient.
- **Progress is implicit.** What is finished exists only in a chat scrollback — not auditable,
  not recoverable, not transferable.

BCOS moves project state out of the conversation and into the repository.

> The project remembers the AI, not the other way around.

## Core Idea

Roles are not attached to agents. They are attached to tasks.

```
Human
  └─▶ Claude Code  as Manager / Architect / Reviewer
        └─▶ Task Contract          (scope, read list, acceptance criteria)
              └─▶ Codex CLI  as Worker
                    └─▶ Implementation Report
                          └─▶ Independent Review     (different actor_id)
                                └─▶ Human Approval
                                      └─▶ Git History
```

A worker session handles one role and one task. The same executable can act as a backend
worker in one session and a test worker in the next — what it is doing is decided by the
task it receives, not by how it was configured. Long-term memory lives in the repository,
so sessions are disposable.

## Design Principles

| Principle | Meaning |
|---|---|
| Project Owns Memory | The repository holds state; conversations are volatile buffers |
| Agents Are Stateless | Sessions can be killed and replaced at any time |
| Roles Belong to Tasks | A task contract defines the role, not an agent config |
| One Artifact, One Owner | Each artifact has exactly one writer |
| Architecture Before Implementation | Boundaries are validated before code |
| Small Context by Default | Read only what the current role needs |
| Human-Controlled Autonomy | Direction, risk, and release stay with the human |

Details: [docs/vision.md](docs/vision.md)

## ClawDev to BCOS

ClawDev was an earlier experiment that separated roles into distinct API agents. It worked,
but role separation cost one agent instance — and one API bill — per role. BCOS keeps the
role separation and drops the coupling.

| | ClawDev | BCOS |
|---|---|---|
| Model | Agent-centric | Task-centric |
| Roles live in | Agent instances | Task contracts |
| Adding a role costs | A new agent, prompt, and API spend | A new task document |
| State lives in | Agent conversation history | Git artifacts |
| Orchestrator manages | Agent execution | Tasks, artifacts, and state |
| Direction | Agent → Task | Task → Worker |

Rationale: [ADR-003](docs/decisions/ADR-003-task-centric-workers.md)

## Current Capabilities

Implemented and verified:

- Experimental Task Protocol `0.1` — states, transitions, guards, artifact schemas
- Git-tracked Task / Report / Review artifacts with separate owners
- Append-only event log and a regenerable state index
- Separation of duties enforced by `actor_id` — the submitter cannot approve
- `bcos task start <id> --actor-role <role> --actor-id <id>` — the `TODO → IN_PROGRESS`
  transition, which updates the task frontmatter, the event log, and the derived state
  index together
- `bcos task submit <id> --actor-role <role> --actor-id <id>` — the
  `IN_PROGRESS → IMPLEMENTED` transition, refused unless a report exists containing an
  entry for the current attempt (RFC-001 G3)
- `bcos task approve <id> --actor-role <role> --actor-id <id>` — the
  `IMPLEMENTED → DONE` transition, refused unless the review carries an `APPROVED`
  verdict for the current attempt (G4)
- **Separation of duties is enforced, not just documented.** The approving `actor_id`
  must differ from the one recorded in that attempt's `TASK_SUBMITTED` event (G5).
  A submitter attempting to approve their own work is rejected and no file changes
- `bcos task context <id>` — assembles the files named in a task's read list into one
  package on stdout. The same input produces the same bytes: no timestamp is written,
  duplicates are removed, and the declared order is preserved. Paths outside the
  repository, binaries, oversized files, and credential-shaped names are refused
- `bcos task run <id> --worker codex` — assembles the worker prompt and the context
  package into one deterministic input and writes it to a Codex process on stdin, so
  nobody has to copy it across. `--dry-run` prints the command, arguments, and input
  hashes without the input body and without starting a process. The runner spawns with
  `shell: false` and the task id never reaches `argv`, so shell metacharacters in an id
  cannot execute. **It does not own the lifecycle:** it never runs `start`, `submit`, or
  `approve`, never interprets the worker's output, and leaves `events.jsonl` unchanged
  on every path — success, failure, and timeout alike
- **No task needs a hand-written worker prompt.** The runner sends one fixed preamble
  with three substituted values — task id, worker, report path — followed by the context
  package. The task document is the whole contract, and it is already in the package, so
  a per-task prompt file was only ever a summary of documents the worker already had.
  Two different tasks produce preambles that differ on those value lines and nowhere else
- A task whose read list omits its own file is refused, naming the missing path. Without
  it the worker would receive no contract at all
- `task run` defaults to a 1,800-second timeout; `--timeout` overrides it, and zero,
  negative, fractional, and non-numeric values are rejected rather than silently falling
  back to the default
- Raw telemetry on stdout as `telemetry <key>=<value>` — context and stdin identity,
  configured timeout, first worker response, duration, exit code, timeout state, and byte
  counts. **Measurements only:** no rate, ratio, or improvement is computed anywhere, and
  a dry run omits the process-only fields rather than reporting them as zero
- `bcos task execute <id> --worker codex --actor-id <id>` — runs start, the worker,
  verification, and submit as one command, stopping at `IMPLEMENTED`. A `TODO` task starts
  from the beginning; an `IN_PROGRESS` one resumes without a second start event;
  `--verify-only` skips the worker entirely when only the verification needs re-running
- **Verification decides whether the work is submitted.** The orchestrator runs
  `package.json`'s test script on the host and refuses to submit on a non-zero exit,
  leaving the task `IN_PROGRESS` with its report intact. The worker does not get to
  declare its own work verified
- **A worker BCOS started cannot run the workflow.** `task run` stamps its children with
  `BCOS_WORKER_SESSION`, and `task execute` refuses when it sees it. Separately, the
  orchestrator spawns a throwaway process before doing anything else; if child creation is
  denied it stops there, having touched no task file, no event log, and no worker
- `bcos task request-changes <id> --actor-role <role> --actor-id <id>` — the
  `IMPLEMENTED → IN_PROGRESS` transition RFC-001 specifies, guarded by G4 and G5 and
  emitting `TASK_CHANGES_REQUESTED`. It requires a review carrying `CHANGES_REQUESTED`
  for the current attempt, and the attempt number advances on the way back, so
  `attempt ≥ 2` means rework happened. **Four of the seven transitions are now commands**
- `task execute --review --reviewer claude --reviewer-actor-id <id>` — runs the reviewer
  after submit, then acts on its verdict: `APPROVED` approves, `CHANGES_REQUESTED` sends
  the work back and reruns the worker, verification, and the review. The reviewer's actor
  id must differ from the worker's, and that is checked before anything starts
- **The workflow never approves without a verdict it could read.** An unreadable verdict,
  a `BLOCKED` one, a failed reviewer, an exhausted cycle budget, or a failed
  re-verification all stop and print where it stopped, the task state, the last verdict,
  the review path, and what a person should do next. The cycle budget defaults to two
- Rework carries the review back to the worker: from the second attempt on, the previous
  review is appended to the worker's input. **No conversation history, no re-exploration,
  no hand-written prompt** — the task contract, `AGENTS.md`, and the deterministic
  artifacts are the whole handoff
- **Every workflow execution leaves a record in `.bcos/runs/`.** One small JSON file per
  run, named by an execution id that carries a millisecond timestamp, so sorting filenames
  is sorting by time. It holds the stage each step reached, when it started and last
  changed, and how it ended — and nothing else: no absolute path, no command line, no
  prompt, no context, no captured output
- `bcos task status <id>` — reads the latest run for a task and prints the execution id,
  attempt, workflow status, stage results, timings, exit reason, and the last lifecycle
  event. `--execution <id>` selects a specific run. It writes nothing
- **A run that BCOS did not see finish stays `running`.** It is never rewritten to
  `failed`, and `interrupted` and `unknown` are never stored, because those would be
  guesses. The reading command says `Completed: not observed` instead — it does not claim
  the process is alive either
- **The run record never owns lifecycle state.** A task can be `IMPLEMENTED` while its
  last execution says `failed`; both are true about different things. Task state stays in
  `tasks/*.md`, and the recorder writes to neither `events.jsonl` nor `state.json`
- **A failed verification is handed to the next worker.** The run record keeps the
  verification exit code and the last 2,048 bytes of its output, and a worker resuming
  that task receives the logical command name, the exit code, and that excerpt at the end
  of its input. Nobody has to explain the failure again. The output still streams to the
  terminal as before; the excerpt is a bounded tail, not a stored log
- **A fixed failure stops being reported.** The handoff reads the most recent execution
  that actually reached verification, so once a later run passes, the older failure is no
  longer sent. Nothing is deleted — the failed record stays in `.bcos/runs/`
- Repository-root and home paths in that excerpt are replaced with `<root>` and `<home>`.
  **That is two path substitutions, not secret redaction** — anything else in the
  verifier's output is carried as-is. When there is no failure to report, worker input is
  byte-for-byte what it was before this existed
- Lifecycle guards checked **before any write**, so a rejected transition leaves every
  file untouched — verified across eleven failure paths. `task context` writes nothing
  at all, and a rejected package emits zero bytes to stdout
- State transitions tested against temporary fixtures, never the repository's own `.bcos/`
- `--version`, `--help`, and a failing path for unknown arguments
- Independent review and benchmark records for every completed task

### Planned

Not implemented. Do not expect these to work yet.

- Model adapters — `codex` is the only worker `task run` accepts, so there is no model to
  switch to and no token or cost figure to record
- Telemetry persistence — the fields go to stdout and are gone when the window closes
- A submit guard that reads what a report claims — one that declares its own criteria
  unverified still passes, because the check is that a report exists. What changed is that
  an automated reviewer now runs, and RFC-001 requires it to refuse a completion claim
  with no evidence behind it
- Carrying a verification failure back to the worker — a failed run leaves the task
  `IN_PROGRESS`, but a plain resume tells the worker nothing about what failed, so it
  cannot act on it. Review feedback has that path; verification failure does not
- `bcos task request-changes`, `bcos task block`, `bcos task unblock`
- `bcos task create`, `bcos task list`
- `bcos init`, `bcos status`, `bcos reindex`
- Role-based worker task templates
- Worktree-isolated parallel workers

**Four of the seven protocol transitions are automated** — `start`, `submit`, `approve`,
and `request-changes`. `block` and `unblock` still have no command. `actor_id` is
self-declared, so separation of duties assumes a trusted environment; authentication is a
known limit of protocol `0.1`.

**One command can now carry a task from `TODO` to `DONE`.** Task design and the commit
are still done by a person, and so is deciding to run it at all.

**`task run` has now driven the real Codex once.** T-009 was implemented by a Codex
process that BCOS started itself: no prompt pasted, no context copied. The run exited 0
after about 359 seconds. That is one observation, not a success rate — and the test suite
still uses a fake worker throughout, deliberately, so it never spends tokens or touches a
network.

That run also produced the first failure worth keeping. Codex could not spawn child
processes inside its own sandbox (`spawn EPERM`), so the worker's `npm test` never ran;
the suite was verified on the host instead, where three stale assertions surfaced and were
fixed. It happened again on the next task, and the host run found a real defect that time.

T-010 answers it, though not by detection. A worker that runs `npm test` directly is
beyond BCOS's reach — what changed is that **`task execute` runs the verification on the
host**, so a worker that cannot check itself no longer decides whether its work is
submitted. The nesting guard and the spawn probe cover the narrower case of the workflow
command itself being run inside a worker.

## Verified Baselines

Twelve tasks have completed the full protocol cycle. These are **baselines, not improvements.**

| | T-003 | T-005 | T-004 | T-006 | T-007 | T-008 | T-009 | T-010 | T-011 | T-012 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Acceptance Criteria | 15/15 | 18/18 | 16/16 | 24/24 | 32/32 | 46/46 | 62/62 | 87/87 | 94/94 | 87/87 |
| Tests | 11/11 | 23/23 | 31/31 | 46/46 | 66/66 | 90/90 | 99/99 | 129/129 | 156/156 | 186/186 |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Runtime dependencies | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Attempt | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Rework | 0 | 0 | 0 | 0 | 0 | 0 | **1** | **1** | 0 | 0 |

T-001 and T-002 are omitted from the table for width; both were 9/9 and 11/11 with 3/3
tests and no rework.

The last two tasks needed rework, and both times for the same reason: the worker could not
run the test suite inside its own sandbox, so the host run was the first real check.
T-009's host run found three stale assertions. T-010's found a genuine defect — the
capability probe missed a thrown error, so a denied environment exited without emitting any
telemetry at all. **This is the pattern T-010's host verification exists to catch.**

T-007 through T-010 measured the artifacts they produce instead of a transition:

| | `task context` | `task run` |
|---|---:|---:|
| Same input, same bytes (SHA-256 across two runs) | yes | yes |
| Assembled input reaches the worker unchanged | N/A | yes |
| Task id present in worker `argv` | N/A | no |
| Lifecycle transitions caused | 0 | 0 |
| Stdout on each failure path | 0 bytes (11 paths) | 0 bytes (15 paths) |
| Partial writes on failure paths | 0 | 0 |
| Real Codex invocations across the test suite | N/A | 0 |
| Hand-written prompt files a task needs | N/A | 1 → 0 |
| Steps a person takes to hand context to a worker | 4 → 2 | 2 → 1 |

`task execute` was measured against a fake worker and a fake verifier, each of which
leaves a marker file when it runs, so "did not run" is observed rather than inferred:

| | `task execute` |
|---|---:|
| Commands a person types to reach `IMPLEMENTED` | 4 → 1 |
| Submits when verification exits non-zero | never |
| Lifecycle transitions when nesting or spawning is refused | 0 |
| Worker or verifier started on those paths | none |
| Absolute paths in telemetry output | 0 |

**Everything after `IMPLEMENTED` is still manual** — review, verdict, rework, approval,
and the commit. And `task execute` has not yet driven a real Codex run; T-010 itself was
implemented the old way, since the command did not exist while it was being written.

Two real Codex runs are on record. They are **one observation each**, kept as a baseline
for later comparison and nothing more:

| | T-009, `task run` | T-011, `task execute` |
|---|---:|---:|
| Exit code | 0 | 0 |
| Worker runtime | ~359 s | ~544 s |
| Whole-workflow runtime | N/A | ~599 s |
| Context files / characters | 8 / 99,522 | 10 / 149,325 |
| Stdin bytes | N/A | 174,778 |
| Worker stdout / stderr bytes | 663 / 750,989 | 592 / 1,713,277 |
| Host verification | N/A | exit 0 in ~54 s |
| **BCOS commands a person typed** | 4 | **1** |
| Prompts pasted, context copied | 0 | 0 |

T-011 is the first task BCOS carried on its own: one `task execute` ran the start, the
worker, the verification, and the submit. **Its worker could not run the tests inside its
own sandbox** — the third task in a row — **and said so, declining to claim the criteria
were met. The host run passed 156 of 156, and that is what justified the submit.** This is
the case host verification exists for.

Codex writes its progress to stderr and almost nothing to stdout, which is why the runner
forwards output instead of accumulating it. **No token count, cost, or efficiency figure
is claimed** — none of it is measured yet.

The reviewer verified `task run` against a fixture of their own rather than trusting the
worker's tests, and confirmed the no-real-Codex claim by removing the Codex entry point
from `PATH` and re-running the suite: 99 of 99 still passed.

Each lifecycle task also measured the transition it automates:

| | `TODO → IN_PROGRESS` | `IN_PROGRESS → IMPLEMENTED` | `IMPLEMENTED → DONE` |
|---|---:|---:|---:|
| Files a human edits | 3 → 0 | 3 → 0 | 3 → 0 |
| Manual steps | 6 → 1 | 5 → 1 | 5 → 1 |
| Partial writes across failure paths | 0 / 5 | 0 / 6 | 0 / 11 |

Lifecycle coverage after T-006: **3 of 7 transitions** — the full core cycle.
Adding each transition cost 136, 75, and 69 lines of `src/cli.ts` respectively.
Those are absolute figures; later transitions reuse the infrastructure the first one
built, so the decline is structural and **not** presented as an efficiency gain.

**How to read this:**

- The tasks differ in kind — creating a project, editing two lines, adding a
  state-changing command, fixing a validator. Comparing them directly is not meaningful.
- The step counts are **observed absolute numbers** for one specific transition each.
  They are not converted into a productivity percentage.
- **There is no control group.** No improvement rate is claimed, in any dimension.
- Read Scope Ratio has fallen across the tasks, but the repository also grew.
  That decline is **not** claimed as an efficiency gain.
- `Files Read` is **self-reported by the worker** and has no audit trail. It is recorded
  in the benchmarks but is not treated as verified.

Full records: [T-001](docs/benchmarks/T-001-project-scaffold.md) ·
[T-002](docs/benchmarks/T-002-align-node-version.md) ·
[T-003](docs/benchmarks/T-003-task-start-command.md) ·
[T-004](docs/benchmarks/T-004-task-submit-command.md) ·
[T-005](docs/benchmarks/T-005-fix-required-section-validation.md) ·
[T-006](docs/benchmarks/T-006-task-approve-command.md) ·
[T-007](docs/benchmarks/T-007-context-builder.md) ·
[T-008](docs/benchmarks/T-008-worker-runner-poc.md) ·
[T-009](docs/benchmarks/T-009-prompt-builder.md) ·
[T-010](docs/benchmarks/T-010-workflow-orchestrator-poc.md) ·
[T-011](docs/benchmarks/T-011-reviewer-rework-orchestration.md) ·
[T-012](docs/benchmarks/T-012-workflow-observability.md) ·
[Telemetry field definitions](docs/benchmarks/TELEMETRY.md)

## Quick Start

Requires **Node.js 24 or newer**. No runtime dependencies.

```bash
npm install
```
```bash
npm run build
```
```bash
npm test
```
```bash
node dist/cli.js --version
```
```bash
node dist/cli.js --help
```

```bash
node dist/cli.js task context T-007
```

`task run` needs a task in `IN_PROGRESS`, and every task in this repository is `DONE`, so
there is nothing here to run it against — the command below is a form to use on your own
task, not one to paste as is. `--dry-run` prints the command, the arguments, and the
input hashes without starting a process:

```
node dist/cli.js task run <your-in-progress-task-id> --worker codex --dry-run
```

The `task` commands operate on the `.bcos/` directory of the **current working
directory**. They work in this repository because `.bcos/tasks/`, `.bcos/events.jsonl`,
and `.bcos/state.json` already exist. There is no `bcos init` yet, so a fresh project has
to create that structure by hand first. The commands listed under Planned do not exist
at all.

## Repository Structure

```
.bcos/tasks/          Task contracts — manager owned, single source of truth
.bcos/reports/        Implementation reports — worker owned, append-only
.bcos/reviews/        Independent reviews — reviewer owned, append-only
.bcos/events.jsonl    Append-only audit log
.bcos/state.json      Derived index, regenerable from tasks/
docs/rfcs/            Protocol specification
docs/decisions/       Architecture decision records
docs/benchmarks/      Per-task measurements
src/                  CLI implementation
tests/                Tests
```

## Documentation

| Document | Purpose |
|---|---|
| [Vision](docs/vision.md) | Problem, principles, roadmap |
| [Architecture](docs/architecture.md) | Repository layout and runtime constraints |
| [RFC-001 Core](docs/rfcs/RFC-001-task-protocol.md) | **Normative protocol.** Read this one |
| [RFC-001 Appendix](docs/rfcs/RFC-001-task-protocol-appendix.md) | Non-normative rationale and edge cases |
| [ADR-001](docs/decisions/ADR-001-language.md) | Why Node.js with zero runtime dependencies |
| [ADR-002](docs/decisions/ADR-002-storage.md) | Why plain files instead of SQLite |
| [ADR-003](docs/decisions/ADR-003-task-centric-workers.md) | Why roles belong to tasks |
| [Git Convention](docs/git-convention.md) | Commit format and process |

## Roadmap

Core CLI commands → automated lifecycle transitions → context package generation →
worker execution → prompt elimination → workflow orchestration → reviewer and rework
orchestration → execution observability → model adapter boundary → verification failure
feedback — **done.** What follows:

| | |
|---|---|
| **Multi-model Worker Switching** | A second worker, which is what makes "switch models" mean anything |
| **Benchmark Harness** | Answer the six fairness questions before comparing arms |
| **Benchmark Report** | Where division is finally allowed |

T-012 closed the observability gap T-011 exposed: every run now leaves a record and one
command reads it. What it did not close is the other half — when host verification fails,
the task correctly stays `IN_PROGRESS`, but resuming tells the worker nothing about what
failed. Review feedback has a path back to the worker; verification failure does not.
That gap is what the next task should take.

T-012's own first run is not in the record, because it started from a build that predated
the recorder. **The first workflow observable end to end will be the next one.**

Stages and entry conditions: [docs/vision.md](docs/vision.md)

## Benchmark Policy

Every completed task produces a benchmark record under `docs/benchmarks/`.

- Every value is labelled **Measured**, **Derived**, **Estimated**, or **N/A**.
- Raw reports, reviews, and benchmarks are kept — not summarised away.
- **No improvement rate is claimed from a single task.** Efficiency claims wait until
  there is a comparable sample.
- Environment failures and code failures are counted separately.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is experimental and the protocol
may change without notice while it is at `0.x`.

## License

[MIT](LICENSE)

---

Project background and related work are available in the
[author's portfolio](https://beomseok-portfolio.vercel.app/).
