# Contributing to BCOS

## Project Status

**Experimental.** Task protocol `0.1` makes no compatibility promises. Fields, transitions,
and rules may change based on real usage. Expect breaking changes at `0.x`.

## Before Contributing

- Read the relevant [RFC](docs/rfcs/) or [ADR](docs/decisions/) first. The protocol is the
  product; the CLI is one implementation of it.
- If a task already covers the change, link it. If not, propose one before writing code.
- **Keep scope small.** A change that touches one concern is easier to review than one
  that touches four.
- **Reuse before adding.** Prefer existing code, then the standard library, then a
  platform feature. New dependencies need a reason.
- **No speculative abstraction.** An interface with one implementation, a factory with one
  product, or a config value that never changes will be rejected.

## Task, Report, Review

Meaningful changes run through the protocol.

- Work is defined by a **task** in `.bcos/tasks/` with six required sections
  (RFC-001 §2.2). The task defines the role — read list, write list, out of scope,
  and acceptance criteria are the whole boundary.
- The worker writes an **implementation report** in `.bcos/reports/`, append-only.
  `Test Evidence` must contain actual command output. "Tests passed" is not evidence.
- A **review** in `.bcos/reviews/` assesses every acceptance criterion individually.
- **The submitter cannot approve.** The `actor_id` performing `approve` must differ from
  the one that submitted the current attempt. This is the point of the protocol; it is
  not negotiable.

## Tests

Run all of these before submitting:

```bash
npm run build
```
```bash
npm test
```

Verify the CLI paths your change affects, and paste the actual output into the report.

## Scope Control

- Stay inside `Expected Files`. If you need a file outside it, stop and say so rather
  than widening the scope yourself.
- Do not implement anything listed under `Out of Scope`, even if it looks like an
  improvement. That list exists because those ideas are tempting.
- **No unrelated refactoring.** Fix the thing the task names.

## Git

Commits follow [docs/git-convention.md](docs/git-convention.md).

- One purpose per commit. Documentation and code changes stay separate.
- **Workers do not run git.** No `commit`, `push`, or `checkout` from a worker session.
- Commits are proposed and executed after human approval — never automatically.

## Benchmarks

Measurable changes record their impact in `docs/benchmarks/`.

- Label every value **Measured**, **Derived**, **Estimated**, or **N/A**.
- Separate environment failures from code failures.
- **Do not claim an improvement rate without a control group.** A single task is a
  baseline, not a result.

## Questions

Open an issue describing what you observed and what you expected. Include the task ID
if one applies.
