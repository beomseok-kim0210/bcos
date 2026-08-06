---
task: T-008
---

# Report — T-008

## Attempt 1 — 2026-08-06T04:20:03Z

### Implemented
`task run <id> --worker codex` 라우팅과 옵션 검증을 추가했다. Runner는 Task·Prompt·Context를 검증하고 결정론적 stdin을 조립하며, dry-run 요약 또는 `shell: false`인 Node child 실행을 수행한다. child stdout·stderr는 누적하지 않고 부모로 전달하면서 바이트 수만 센다.

### Files Changed
- src/cli.ts (modified)
- src/runner.ts (new)
- tests/cli.test.ts (modified)
- .bcos/reports/T-008-worker-runner-poc.md (new)

### Test Evidence

`npm run build` (PowerShell 실행 정책 때문에 동등한 `npm.cmd` 진입점으로 실행):

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`npm test` (PowerShell 실행 정책 때문에 동등한 `npm.cmd` 진입점으로 실행):

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ lifecycle start, submit, and approve retain success and failure paths
ℹ start success: exit 0, start failure: exit 1, submit success: exit 0, submit failure: exit 1, approve success: exit 0, approve failure (SoD): exit 1
✔ task run dry-run reports command, args, cwd, and Prompt path
✔ task run dry-run reports Context count and hashes
✔ task run dry-run reports stdin character and line counts without its body
✔ task run dry-run is deterministic and changes no .bcos files
✔ task run delivers the exact dry-run stdin hash to the fake worker
✔ task run assembles identity, safety instructions, Prompt, and Context once
✔ task run uses the fixture root as worker cwd and does not pass Task ID in argv
✔ task run streams fake worker stdout and stderr and reports byte counts
✔ task run reports exit zero and execution duration
✔ task run distinguishes and propagates fake worker exit 3
✔ task run timeout fails and changes no .bcos files
✔ task run rejects a missing Task without changes
✔ task run rejects a Task not IN_PROGRESS without changes
✔ task run rejects a missing Prompt without changes
✔ task run rejects multiple Prompts without changes
✔ task run rejects a Prompt without a delimiter pair without changes
✔ task run rejects an empty Prompt body without changes
✔ task run rejects Context creation failure without changes
✔ task run rejects unsupported workers without changes
✔ task run rejects a nonexistent worker command without changes
✔ task run rejects every non-positive-integer timeout without changes
✔ task run keeps shell metacharacters in stdin and out of worker argv
✔ task run requires worker and rejects unknown options without changes
✔ task context retains success and failure paths after runner routing
ℹ tests 90
ℹ suites 0
ℹ pass 90
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13826.0914
```

임시 fixture dry-run 요약 전문(개인 경로 일반화):

```text
command: <node>
args: ["<fake-worker.js>","exec","-","--cd","<fixture-root>"]
cwd: <fixture-root>
Prompt: .bcos\prompts\T-200-worker-0.md
Context file count: 1
Context SHA-256: 89280016ead6e6e839f8209505ababdb8ce56e4caee715cdc4675fa8f6f82b06
stdin SHA-256: b4e44a6192132130dc5ab0d336a3bb165bf4410ccc3da8ea655924e25910e03a
stdin characters: 504
stdin lines: 26
```

위 test run에서 같은 fixture의 dry-run 2회 stdin SHA-256 일치, fake worker 수신 SHA-256 일치, fake exit 3 구분·전파, timeout 실패와 `.bcos` 불변을 각각 독립 테스트로 확인했다. 모든 runner 실패 테스트는 실행 전후 fixture `.bcos` 전체 snapshot을 비교했고, lifecycle 회귀는 start·submit·approve·context 정상·실패를 각각 확인했다. 실제 Codex는 호출하지 않았고 모든 worker 실행은 임시 fixture `.js`를 사용했다.

CLI 직접 실행:

```text
> node dist/cli.js --version
0.1.0
Exit code: 0

> node dist/cli.js --help
Usage: bcos [--version | --help | task <start|submit|approve|context|run> <id>]
Exit code: 0

> node dist/cli.js foo
Unknown argument: foo
Exit code: 1
```

구성 검사:

```text
src files:
cli.ts
context.ts
runner.ts

src directories: (none)
source matches for "shell: true" or "cmd /c": (none)
package-lock.json exists: False
```

### Deviations
None.

### Known Risks
None.

### Context Used
- Files read: 8
- Outside Expected Files: 0
- Completed line counts: src/cli.ts 358, src/context.ts 165, src/runner.ts 206
