---
task: T-019
---

# Report — T-019

## Attempt 1 — 2026-08-19T07:42:11Z

### Implemented

- Repositioned BCOS as a Git-native, task-contract-first engineering protocol for
  auditable, reproducible, and falsifiable AI coding workflows.
- Put the unanswered research question and the T-016/T-017 evidence boundary near the
  top of both README files without making a comparative performance conclusion.
- Documented the current Input → Process → Output chain and its Task, Report, Review,
  lifecycle event, RunRecord, and benchmark trial artifacts.
- Explained falsifiability through retained failures and rework, `unavailable` + `null`,
  proxy/token separation, and the absence of aggregation in T-016.
- Distinguished `role`, `runtime`, and `actor_id`; retained Claude Manager/Reviewer +
  Codex Worker as policy and `--worker claude` as an optional capability.
- Listed all nine persisted RunRecord measurement fields with source-identical names.
- Corrected Benchmark Policy to the three arms and five provenance values.
- Moved Role-based Task Templates, Adaptive Router, Complexity Classifier, automatic
  workflow selection, and Digital Docent validation into an explicit not-implemented
  list.
- Removed stale historical narrative and the long command-by-command capability catalog.
  `README.md` changed from the 484-line baseline to 248 physical lines while retaining
  readable sections rather than joining lines to meet a count.
- Kept the English and Korean documents aligned in definition, research question,
  falsifiability, role model, evidence fields, benchmark arms, provenance, and planned
  boundaries.

### Files Changed

- README.md (modified)
- docs/README.ko.md (modified)
- .bcos/reports/T-019-readme-positioning-evidence-model.md (new)

### Test Evidence

Initial PowerShell npm entry-point attempt:

```text
> npm run build
npm.ps1 cannot be loaded because running scripts is disabled on this system.
Exit code: 1
```

Build through the Windows command entry point:

```text
> npm.cmd run build

> bcos@0.1.0 build
> tsc

Exit code: 0
```

Required test command through the Windows command entry point:

```text
> npm.cmd test

> bcos@0.1.0 test
> node --test tests/cli.test.ts

tests 1
pass 0
fail 1
skipped 0
Error: spawn EPERM
Exit code: 1
```

The failure occurred while Node's test runner tried to spawn the test-file process,
before the 289 tests ran. A non-mutating in-process diagnostic was also attempted:

```text
> node --test --test-isolation=none tests/cli.test.ts
command timed out after 180080 milliseconds
Exit code: 124
```

That fallback is not evidence for the required `npm test` result and is not treated as a
pass.

Static source/document cross-check:

```text
PHYSICAL_LINE_COUNTS
README.md: 248
docs/README.ko.md: 233

RUNRECORD_FIELDS
context_files: source=True, en=True, ko=True
context_chars: source=True, en=True, ko=True
context_bytes: source=True, en=True, ko=True
stdin_bytes: source=True, en=True, ko=True
worker_invocations: source=True, en=True, ko=True
worker_duration_ms: source=True, en=True, ko=True
verification_duration_ms: source=True, en=True, ko=True
worker_stdout_bytes: source=True, en=True, ko=True
worker_stderr_bytes: source=True, en=True, ko=True

ARMS
codex_only: source=True, en=True, ko=True
claude_only: source=True, en=True, ko=True
bcos: source=True, en=True, ko=True

PROVENANCE
measured: source=True, en=True, ko=True
estimated: source=True, en=True, ko=True
proxy: source=True, en=True, ko=True
derived: source=True, en=True, ko=True
unavailable: source=True, en=True, ko=True

BOUNDARIES
Task Contract → Role → Runtime: en=True, ko=True
actor_id: en=True, ko=True
--worker claude: en=True, ko=True
Adaptive Router: en=True, ko=True
Complexity Classifier: en=True, ko=True
Role-based Task Template: en=True, ko=True
Digital Docent: en=True, ko=True
T-016: en=True, ko=True
T-017: en=True, ko=True

FORBIDDEN_OR_STALE_HITS
(no output)

REQUIRED_QUESTION
English: True
Korean: True
```

The forbidden/stale scan covered `N/A`, the removed competing-project name, the AC 23
comparative claim phrases, and their Korean equivalents. The required arm identifiers
contain `_only`, `append-only` describes the protocol's artifact rule, and
`task-contract-first` is the contracted positioning phrase; none is a superiority claim.

### Deviations

- Used `npm.cmd` after PowerShell execution policy rejected `npm.ps1`; this invokes the
  same package scripts without changing repository files.
- Did not run T7/T9 git-diff commands because the worker execution instruction explicitly
  prohibits every git command. No `git` or `bcos` command was executed.
- The required test suite could not complete in this worker sandbox because child-process
  creation failed with `spawn EPERM`. The in-process diagnostic was attempted but timed
  out and is not substituted for the required result.

### Known Risks

- AC 30 is not verified in this session: `npm test` did not produce the required
  289/289 pass result because the environment denied Node's test-runner spawn.
- T7/T9 repository-diff assertions are not independently verified because git commands
  were prohibited. The worker applied patches only to the two expected README files and
  this Report, and made no source, test, package, lockfile, vision, or T-017 edits.
- Because the required test and diff evidence are unavailable, this Report does not claim
  that every Acceptance Criterion has been verified. Host verification is required.

### Context Used

- Files read: 10 (the complete supplied Context Package)
- Outside Expected Files: 0

## Attempt 2 — 2026-08-19T08:30:43Z

### Implemented
- Restored the `actor_id` trust boundary in both READMEs: it is self-declared, not authenticated, so separation of duties assumes a trusted environment and authentication remains a protocol `0.1` limitation.
- Restored discoverability of historical benchmark records in both READMEs while explicitly separating those observations from current benchmark results and performance claims.

### Files Changed
- README.md (modified)
- docs/README.ko.md (modified)
- .bcos/reports/T-019-readme-positioning-evidence-model.md (modified, append-only Attempt 2)

### Test Evidence

`npm run build`

```text
Exit code: 1
PowerShell execution policy blocked profile.ps1 and npm.ps1 before npm started.
```

`npm.cmd run build` (profile disabled)

```text
Exit code: 0
> bcos@0.1.0 build
> tsc
```

`npm.cmd test` (profile disabled)

```text
Exit code: 1
> node --test tests/cli.test.ts
tests 1
pass 0
fail 1
Error: spawn EPERM
```

`node --test --test-isolation=none tests/cli.test.ts`

```text
Exit code: 124
command timed out after 182379 milliseconds
The test file loaded, but CLI subprocess creation was denied with EPERM across the cases;
this sandbox run is not valid 289-test regression evidence.
```

Targeted documentation verification (PowerShell `Select-String` / `Get-Content`):

```text
README.md: 254 lines (baseline 484)
docs/README.ko.md: 222 lines
Forbidden-context hits: 2, both reviewed as non-claims:
- "multi-agent가 본질적으로 우월하다는 주장도 아니며"
- "자동 workflow 선택" under 아직 구현하지 않은 기능
actor_id trust-boundary matches: EN lines 105-106; KO lines 102-103
historical-record qualification matches: EN lines 195-196; KO lines 180-181
arms: codex_only / claude_only / bcos in both documents
provenance: measured / estimated / proxy / derived / unavailable; N/A: 0
Current-vs-planned terms occur only in explicit planned/not-implemented context.
```

Measurement-name comparison against `src/run.ts`:

```text
context_files source=1 en=1 ko=1
context_chars source=1 en=2 ko=2
context_bytes source=1 en=2 ko=2
stdin_bytes source=1 en=1 ko=1
worker_invocations source=1 en=1 ko=1
worker_duration_ms source=1 en=1 ko=1
verification_duration_ms source=1 en=1 ko=1
worker_stdout_bytes source=1 en=1 ko=1
worker_stderr_bytes source=1 en=1 ko=1
src/benchmark.ts sources = measured, estimated, proxy, derived, unavailable
src/benchmark.ts arms = codex_only, claude_only, bcos
```

### Deviations
- The user explicitly prohibited `git` commands, so T7/T9 git-diff checks were not run in this worker session.
- The required `npm test` 289/289 result could not be reproduced because the managed environment denied Node child-process creation with `spawn EPERM`. A process-isolation-free retry also encountered subprocess denial and timed out. No source or test file was changed.

### Known Risks
- AC 30 is not verified in this worker session: build passed, but the required 289/289 test result is blocked by the execution environment. Host Verification or the independent reviewer must run `npm test` in an environment that permits child processes before submission can be considered complete.
- Git-based scope/diff assertions remain for Host Verification because this worker was forbidden to invoke Git.

### Context Used
- Files read: 10 from the supplied Context Package
- Outside Expected Files: 0
