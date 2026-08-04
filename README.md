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
- Lifecycle guards checked **before any write**, so a rejected transition leaves every
  file untouched — verified across five failure paths
- State transitions tested against temporary fixtures, never the repository's own `.bcos/`
- `--version`, `--help`, and a failing path for unknown arguments
- Independent review and benchmark records for every completed task

### Planned

Not implemented. Do not expect these to work yet.

- `bcos task submit`, `bcos task approve`
- `bcos task show` and context package generation
- `bcos task create`, `bcos task list`
- `bcos init`, `bcos status`, `bcos reindex`
- Worker execution adapter
- Role-based worker task templates
- Worktree-isolated parallel workers

`submit` and `approve` are still performed by hand, so a lifecycle can still be left
incomplete after the first transition.

## Verified Baselines

Three tasks have completed the full protocol cycle. These are **baselines, not improvements.**

| | T-001 (scaffold) | T-002 (maintenance) | T-003 (lifecycle) |
|---|---:|---:|---:|
| Acceptance Criteria | 9/9 | 11/11 | 15/15 |
| Tests | 3/3 | 3/3 | 11/11 |
| Scope violations | 0 | 0 | 0 |
| Ponytail violations | 0 | 0 | 0 |
| Runtime dependencies | 0 | 0 | 0 |
| Product change lines | 87 | 2 | 304 |
| Attempt | 1 | 1 | 1 |
| Rework | 0 | 0 | 0 |

T-003 additionally measured the transition it automates:

| | Before | After |
|---|---:|---:|
| Files a human edits for one `TODO → IN_PROGRESS` transition | 3 | 0 |
| Manual steps for that transition | 6 | 1 |
| Partial writes observed across 5 failure paths | — | 0 |

**How to read this:**

- The three tasks differ in kind — creating a project, editing two lines, and adding a
  state-changing command. Comparing them directly is not meaningful.
- **There is no control group.** No improvement rate is claimed, in any dimension.
- The step counts above are **observed absolute numbers** for one specific transition.
  They are not converted into a productivity percentage.
- Read Scope Ratio has fallen across the three tasks, but the repository also grew.
  That decline is **not** claimed as an efficiency gain.
- `Files Read` is **self-reported by the worker** and has no audit trail. It is recorded
  in the benchmarks but is not treated as verified.

Full records: [T-001](docs/benchmarks/T-001-project-scaffold.md) ·
[T-002](docs/benchmarks/T-002-align-node-version.md) ·
[T-003](docs/benchmarks/T-003-task-start-command.md)

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

`task start` operates on the `.bcos/` directory of the **current working directory**.
It works in this repository because `.bcos/tasks/`, `.bcos/events.jsonl`, and
`.bcos/state.json` already exist. There is no `bcos init` yet, so a fresh project has to
create that structure by hand before the command can run. The commands listed under
Planned do not exist at all.

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
role-based worker task templates → worktree-isolated parallel workers →
vendor-neutral worker adapters.

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
