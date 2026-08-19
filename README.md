# BCOS

**A Git-native, task-contract-first engineering protocol for auditable, reproducible, and falsifiable AI coding workflows.**

> **Status: Experimental.** Task protocol `0.1` and a CLI prototype. The protocol makes
> no compatibility promises yet. See [RFC-001 §10](docs/rfcs/RFC-001-task-protocol.md).

[한국어 문서](docs/README.ko.md)

---

## Why BCOS

AI coding workflows add planning, handoff, verification, and review. Those steps may
prevent rework, or their overhead may exceed their benefit. BCOS puts the inputs,
trajectory, and outputs of that workflow in Git so the trade-off can be inspected and
tested instead of assumed.

> **When does multi-agent orchestration actually pay for itself?**

There is no answer yet. T-016 is a measurement harness; the future T-017 controlled
benchmark has not been run. BCOS therefore records evidence without claiming a speed,
cost, or quality advantage over a single-agent path.

The original motivation still matters: session context disappears, agents do not share a
durable source of truth, implementers can be biased toward their own work, repository-wide
reorientation consumes context, and progress hidden in chat cannot be audited. BCOS moves
that state into repository artifacts, then makes the cost of doing so measurable.

> The project remembers the AI, not the other way around.

## Input → Process → Output

```text
INPUT    Task Contract (objective, scope, out of scope, acceptance criteria,
         read/write scope, test requirements)
         + Context Package + worker runtime
         + previous Review or Host Verification failure when present

PROCESS  Worker execution → Host Verification → submit
         → Independent Review → rework when requested → Human approval

OUTPUT   code diff + Report + Review + lifecycle events + RunRecord
         + benchmark trial
```

These are current artifacts, not a proposed data model. A completed Task does not erase
its trajectory: attempt numbers, Host Verification failures, `CHANGES_REQUESTED` verdicts,
and human intervention remain evidence alongside the final state. A clean path and a path
that passed after rework therefore do not collapse into the same final `PASS`. The records
support inspection; they do not claim to detect every accidental success.

RunRecord persists nine raw workflow measurements:

- input: `context_files`, `context_chars`, `context_bytes`, `stdin_bytes`
- process: `worker_invocations`, `worker_duration_ms`, `verification_duration_ms`
- output volume: `worker_stdout_bytes`, `worker_stderr_bytes`

The boundaries are deliberate:

```text
context_chars ≠ context_bytes ≠ input_tokens ≠ billed cost
```

Byte and character counts can be proxies, but they are not token measurements. Direct
token values can be `unavailable`; in that case the value is `null`, never zero.

## Why the Evidence Is Falsifiable

BCOS treats orchestration benefits as hypotheses to test, not assumptions to encode.

- Failed RunRecords remain beside successful runs instead of being discarded.
- Attempts, Host Verification failures, and review verdicts preserve rework history.
- `unavailable` requires `value: null`, so a missing measurement cannot become zero.
- Proxies such as byte counts cannot be stored as measured token values.
- T-016 preserves raw values and references; it computes no totals, averages, ratios, or
  rankings.

A controlled result may favor BCOS, show no meaningful difference, or show that BCOS is
more expensive. All three are valid outcomes. The third would be evidence for simplifying
or applying the workflow more selectively, not a failure of the measurement system.

## Roles Belong to Tasks

```text
Task Contract → Role → Runtime
```

A permanent role persona is not BCOS's core abstraction. A Task Contract states the role,
scope, evidence, and constraints; an available runtime executes it. The same Codex runtime
can implement backend work in one session and tests in another because the Task changes.

Three separate axes prevent ambiguous ownership:

| Axis | Meaning |
|---|---|
| `role` | Responsibility required by the Task Contract |
| `runtime` | Executable used for a session, currently `codex` or `claude` |
| `actor_id` | Accountable subject for a lifecycle action |

The operating policy is Claude as Manager/Architect/Reviewer and Codex as the default
Worker. `--worker claude` is an optional runtime capability, not the default policy.
Role-based Task Templates are planned and do not exist today.

`actor_id` is self-declared rather than an authenticated identity. Separation of duties
therefore assumes a trusted environment; authentication is a known limit of protocol `0.1`.

## What BCOS Is Not

Permanent AI role personas are not BCOS's core abstraction.

BCOS is not an autonomous software company, a claim that multi-agent work is inherently
superior, a benchmark result showing a speed or cost advantage, or a system that discards
failed executions. It is a protocol and measurement boundary for testing those questions.

## Design Principles

| Principle | Meaning |
|---|---|
| Project Owns Memory | Repository artifacts hold durable state |
| Agents Are Stateless | Sessions can be replaced without becoming project memory |
| Roles Belong to Tasks | Task contracts define responsibility |
| One Artifact, One Owner | Task, Report, and Review have separate writers |
| Architecture Before Implementation | Boundaries are validated before code |
| Small Context by Default | Read scope is declared per Task |
| Human-Controlled Autonomy | Direction, risk, approval, and release stay with people |

Details: [docs/vision.md](docs/vision.md)

## Current Capabilities

Implemented and verified:

- Experimental Task Protocol `0.1` with Git-tracked Task, Report, Review, event, run, and
  benchmark artifacts
- Lifecycle commands for `start`, `submit`, `approve`, and `request-changes`, with atomic
  writes and guards checked before mutation
- Separation of duties by `actor_id`: the subject that submitted an attempt cannot approve
  that attempt
- Deterministic `task context` packages constrained by a Task Read List
- `task run` for passing a fixed preamble and Context Package to Codex, or optionally
  Claude, through stdin without giving the runner lifecycle ownership
- `task execute` for start, worker execution, Host Verification, and submit, with optional
  independent review and bounded rework cycles
- Verification and review failures handed to the next attempt through bounded repository
  artifacts rather than conversation history
- RunRecords that preserve stage outcomes, failure observations, runtime identity, and the
  nine raw measurements listed above
- `task status` for reading current and selected execution records without mutation
- T-016 trial validation for three benchmark arms and provenance-aware numeric values
- zero runtime dependencies

The run record and Task lifecycle describe different facts. A Task may be `IMPLEMENTED`
while its latest workflow run is `failed`; neither record overwrites the other.

### Planned

Not implemented:

- `task block`, `task unblock`, `task create`, `task list`, and `task show`
- `bcos init`, project-wide status, and reindex commands
- Role-based Task Templates
- worktree-isolated parallel workers
- Adaptive Router and Complexity Classifier
- automatic workflow selection or a complexity threshold
- Digital Docent validation
- a canonical benchmark case, common external evaluation gate, and controlled benchmark
  report

Future evidence may suggest a lighter path for simple Tasks and fuller orchestration for
complex or high-risk Tasks. That is a hypothesis for later experiments, not a current
routing capability.

## Benchmark Policy

The controlled comparison has exactly three arms:

| Arm | Path |
|---|---|
| `codex_only` | Codex plans, implements, and self-checks |
| `claude_only` | Claude plans, implements, and self-checks |
| `bcos` | Claude planning → Task Contract → Codex Worker → Host Verification → Claude independent Review |

T-016 supplies the measurement harness and validates raw trial records. T-017 is the
future controlled benchmark/report and has not been performed.

- Every numeric value uses one provenance label: `measured`, `estimated`, `proxy`,
  `derived`, or `unavailable`.
- Failed trials remain data. The reader does not filter them out.
- Raw workflow measurements stay in RunRecords; BCOS trials reference those records
  instead of copying them.
- System usage and external evaluation usage are recorded separately.
- No conclusion is drawn from a single task or from incomparable historical observations.

[Historical benchmark records](docs/benchmarks/) remain available as observations, not
as current benchmark results or performance claims.

## Quick Start

Requires Node.js 24 or newer. No runtime dependencies.

```bash
npm install
npm run build
npm test
node dist/cli.js --help
```

Commands operate on the `.bcos/` directory of the current working directory. There is no
`bcos init`, so a new project currently needs a manual `.bcos/` bootstrap and a Task whose
Read List includes its contract and permitted context.

```text
node dist/cli.js task context T-007
node dist/cli.js task run <in-progress-task-id> --worker codex --dry-run
node dist/cli.js task status <task-id>
```

`--dry-run` prints command metadata and input hashes without starting a model process or
printing the input body.

## Repository Structure

```text
.bcos/tasks/          Task contracts — manager owned
.bcos/reports/        Implementation reports — worker owned, append-only
.bcos/reviews/        Independent reviews — reviewer owned, append-only
.bcos/runs/           Workflow execution observations
.bcos/benchmarks/     Benchmark trial records
.bcos/events.jsonl    Append-only lifecycle audit log
.bcos/state.json      Derived index, regenerable from tasks
docs/                 Vision, architecture, protocol, decisions, and measurements
src/                  CLI implementation
tests/                Tests
```

## Documentation

| Document | Purpose |
|---|---|
| [Vision](docs/vision.md) | Problem, principles, roadmap |
| [Architecture](docs/architecture.md) | Repository layout and runtime constraints |
| [RFC-001 Core](docs/rfcs/RFC-001-task-protocol.md) | Normative task protocol |
| [RFC-001 Appendix](docs/rfcs/RFC-001-task-protocol-appendix.md) | Non-normative rationale and edge cases |
| [ADR-003](docs/decisions/ADR-003-task-centric-workers.md) | Why roles belong to Tasks |
| [Telemetry](docs/benchmarks/TELEMETRY.md) | Measurement field definitions |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Protocol `0.1` may change without notice.

## License

[MIT](LICENSE)
