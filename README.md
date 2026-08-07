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
- Automated review and rework — a report that declares its own failure still passes
  `submit`, because the guard checks that a report exists, not what it claims
- `bcos task request-changes`, `bcos task block`, `bcos task unblock`
- `bcos task create`, `bcos task list`
- `bcos init`, `bcos status`, `bcos reindex`
- Role-based worker task templates
- Worktree-isolated parallel workers

**Three of the seven protocol transitions are automated** — `start`, `submit`, and
`approve`, which is the full core cycle. Rework still requires recording
`request-changes` by hand. `actor_id` is self-declared, so separation of duties assumes
a trusted environment; authentication is a known limit of protocol `0.1`.

**`task run` has now driven the real Codex once.** T-009 was implemented by a Codex
process that BCOS started itself: no prompt pasted, no context copied. The run exited 0
after about 359 seconds. That is one observation, not a success rate — and the test suite
still uses a fake worker throughout, deliberately, so it never spends tokens or touches a
network.

That run also produced the first failure worth keeping. Codex could not spawn child
processes inside its own sandbox (`spawn EPERM`), so the worker's `npm test` never ran;
the suite was verified on the host instead, where three stale assertions surfaced and were
fixed. **Running BCOS inside a worker that BCOS started is not yet supported**, and that
is the first requirement for the orchestrator.

## Verified Baselines

Nine tasks have completed the full protocol cycle. These are **baselines, not improvements.**

| | T-001 | T-002 | T-003 | T-005 | T-004 | T-006 | T-007 | T-008 | T-009 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Acceptance Criteria | 9/9 | 11/11 | 15/15 | 18/18 | 16/16 | 24/24 | 32/32 | 46/46 | 62/62 |
| Tests | 3/3 | 3/3 | 11/11 | 23/23 | 31/31 | 46/46 | 66/66 | 90/90 | 99/99 |
| Scope violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Runtime dependencies | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Attempt | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Rework | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** |

T-009 is the first task that needed rework. Its worker could not run the test suite at
all inside its sandbox, and the host run then found three tests still asserting the output
format T-009 replaced. The assertions were corrected; the product code was not.

T-007, T-008, and T-009 measured the artifacts they produce instead of a transition:

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

That last row is **not zero**. One manual step went away — the copy-and-paste. Starting,
submitting, reviewing, approving, and committing are all still done by a person.

The single real Codex run recorded these. They are **one observation each**, kept as a
baseline for later comparison and nothing more:

| | T-009, driven by `task run` |
|---|---:|
| Runner exit code | 0 |
| Worker runtime | ~359 s |
| Context files / characters | 8 / 99,522 |
| Stdin characters / lines | 105,551 / 3,013 |
| Worker stdout / stderr bytes | 663 / 750,989 |
| Prompts pasted by a person | 0 |
| Context copied by a person | 0 |

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
worker execution → prompt elimination — **done.** What follows:

| | |
|---|---|
| **T-010** Workflow Orchestrator | Host-environment validation and a nested-worker guard, then `start` → `run` → report check → host verification → `submit` as one command |
| **T-011** Reviewer / Rework Orchestration | Run the reviewer, act on the verdict, carry feedback back to the worker, loop until approval |
| **T-012** Model Adapter | Token and cost collection, so the fields that read `N/A` today hold measurements |
| **T-013** Multi-model Worker Switching | A second worker, which is what makes "switch models" mean anything |
| **T-014** Benchmark Harness | Persist telemetry and answer the six fairness questions before comparing arms |
| **T-015** Benchmark Report | Where division is finally allowed |

T-010 leads because of what T-009 found: a worker BCOS starts cannot itself start
processes, so anything that runs BCOS inside a worker has to detect that first.

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
