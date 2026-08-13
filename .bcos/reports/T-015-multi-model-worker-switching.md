---
task: T-015
---

# Report — T-015

## Attempt 1 — 2026-08-12T12:55:24Z

### Implemented
- `codex`와 `claude`만 worker로 허용하도록 runner와 workflow의 닫힌 허용 집합을 열었다.
- 선택한 worker 값을 `modelCommand()`와 `runModel()`에 전달하고, dry-run 결과와 telemetry가 준비된 실행 형태를 기록하게 했다.
- 기존 unsupported-worker 테스트 입력을 `claude`에서 실제 미지원 값 `other`로 교체했다.
- 가짜 worker fixture만 사용해 Claude run/execute, argv, 출력 전달, timeout, nonzero exit, stdin/Context 동일성, 피드백 전달, 폴백 금지, run artifact, worker 전환, dry-run telemetry를 다루는 테스트 16개를 추가했다.

### Files Changed
- src/runner.ts (modified)
- src/workflow.ts (modified)
- tests/cli.test.ts (modified)
- .bcos/reports/T-015-multi-model-worker-switching.md (new)

### Test Evidence
`npm.cmd run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`npm.cmd test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

Error: spawn EPERM
tests 1
pass 0
fail 1
Exit code: 1
```

환경 원인 확인:

```text
node --eval "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['--version'],{encoding:'utf8'}); console.log(JSON.stringify({status:r.status,error:r.error?.code,stdout:r.stdout,stderr:r.stderr}))"
{"status":null,"error":"EPERM"}
```

단일 프로세스에서 테스트 파일을 직접 실행한 경우에도 각 테스트의 `spawnSync`가 같은 `EPERM`을 받아 전체 검증을 완료하지 못했다.

구조 및 개수 확인:

```text
runner_lines=195
workflow_lines=326
tests=272
```

선택 runtime dry-run 확인:

```text
claude args: ["-p","--output-format","text"]
claude telemetry worker_name=claude
claude telemetry worker_runtime=native
codex args: ["<node>","exec","-","--cd","<root>"]
codex telemetry worker_name=codex
codex telemetry worker_runtime=node
both context_sha256=67e674acc5776b45daf76de4ce9ecf153142db88874a2e578137d3587826ed67
```

### Deviations
- `npm test` 실패 0건 요건은 실행 환경이 모든 Node 자식 프로세스 생성을 `EPERM`으로 차단해 검증하지 못했다. 테스트 코드나 실제 모델 실행의 실패로 판정할 증거는 없지만, 요구된 전체 회귀 성공 증거도 없으므로 완료로 주장하지 않는다.

### Known Risks
- Claude CLI 권한 실패와 일반 실패는 여전히 구별되지 않는다. Task에서 명시한 알려진 한계이며 이번 범위에서 분류 기능을 추가하지 않았다.
- 전체 272개 테스트는 자식 프로세스 생성이 허용된 host에서 다시 실행해야 한다.

### Context Used
- Files read: 10
- Outside Expected Files: 0
