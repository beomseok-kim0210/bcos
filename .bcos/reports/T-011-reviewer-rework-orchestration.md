---
task: T-011
---

# Report — T-011

## Attempt 1 — 2026-08-10T02:26:47Z

### Implemented
- `task request-changes` 라우팅, G4/G5 검증, attempt 증가, 상태·이벤트 갱신을 추가했다.
- Claude reviewer 프로세스의 결정론적 stdin 조립, 직접 실행, timeout, 출력 전달, Attempt heading 판정 읽기를 추가했다.
- `task execute --review`의 승인·변경 요청·재작업·재검증·재리뷰 loop와 사람 이관 출력을 추가했다.
- attempt 2 이상 worker stdin에 이전 Review 전문을 첨부했다.
- reviewer/rework/approval telemetry 필드를 stdout에 추가하고 정의 문서에 새 절을 추가했다.
- 임시 디렉터리의 가짜 worker/verifier/reviewer만 사용하는 신규 테스트 27개를 추가해 총 156개로 구성했다.

### Files Changed
- src/cli.ts (modified)
- src/runner.ts (modified)
- src/workflow.ts (modified)
- src/reviewer.ts (new)
- tests/cli.test.ts (modified)
- docs/benchmarks/TELEMETRY.md (modified)
- .bcos/reports/T-011-reviewer-rework-orchestration.md (new)

### Test Evidence

`npm.cmd run build`

```text
> bcos@0.1.0 build
> tsc

Process exited with code 0
```

`node --check tests/cli.test.ts; node --check dist/cli.js`

```text
Process exited with code 0
```

`npm.cmd test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

tests 1
suites 0
pass 0
fail 1
duration_ms 18.037

failing tests:
tests/cli.test.ts:1:1
Error: spawn EPERM
    code: 'EPERM'
    syscall: 'spawn'

Process exited with code 1
```

격리 없이 테스트 파일을 직접 실행한 추가 확인:

```text
tests 156
suites 0
pass 1
fail 155
duration_ms 2325.5521

각 spawnSync 결과의 status가 null이었고 자식 프로세스가 실행되지 않았다.
```

정적 품질 확인:

```text
src_files=cli.ts,context.ts,reviewer.ts,runner.ts,workflow.ts
src_dirs=
reviewer_lines=103
workflow_lines=270
tests=156
금지 문자열 검색 결과: 0건
```

CLI smoke evidence:

```text
0.1.0
Usage: bcos [--version | --help | task <start|submit|approve|request-changes|context|run|execute> <id>]
Unknown argument: foo
각 exit code: 0 / 0 / 1
```

### Deviations
- 이 worker 샌드박스는 `node:test` 및 테스트 본문이 생성하는 모든 자식 프로세스를 `spawn EPERM`으로 거부했다. Task가 요구한 `npm test` 성공, APPROVED/rework 이벤트 전문, reviewer stdin 해시, 이관 출력, telemetry 실행 증거를 이 세션에서 산출할 수 없었다. 호스트에서 반드시 재실행해야 한다.

### Known Risks
- `npm test`가 실제로 통과하지 않았으므로 Acceptance Criteria 전체 충족을 주장하지 않는다.
- 프로세스 실행이 가능한 Windows host에서 156개 테스트를 재실행해 reviewer와 rework 통합 경로를 확인해야 한다.

### Context Used
- Files read: 10
- Outside Expected Files: 0
- Final line counts: src/reviewer.ts 103, src/workflow.ts 270, src/cli.ts 430, src/runner.ts 253
- Line changes from the supplied Context Package: src/reviewer.ts +103 (new); src/cli.ts, src/workflow.ts, src/runner.ts는 제공된 원본에 대한 변경만 수행했으며 git 명령 금지로 diff 기반 증감은 측정하지 않았다.
