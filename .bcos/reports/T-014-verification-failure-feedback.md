---
task: T-014
---

# Report — T-014

## Attempt 1 — 2026-08-12T06:30:00Z

### Implemented
- 검증 자식 프로세스의 stdout과 stderr를 기존 `pipe()`로 계속 전달하면서 마지막 2,048바이트를 보관한다.
- 잘린 발췌에 `…` 표시를 붙이고 저장소 루트와 사용자 홈 절대경로를 치환한다.
- 검증 실행 결과의 exit code와 발췌를 run artifact의 선택 필드로 기록한다. 검증 전 종료된 run에는 두 필드가 생기지 않는다.
- Task별 마지막 실제 검증 결과를 찾아 실패인 경우에만 Worker stdin 끝에 논리 명령, exit code, 발췌를 전달한다.
- `not_started`와 `skipped` run을 건너뛰며 Review 피드백 뒤에 검증 실패 피드백을 배치한다.
- staleness, 결정성, 경로 정제, 2,048바이트 경계, verify-only, Review 결합, 실제 T-012 실패 형태를 포함한 테스트 17개를 추가했다.
- run artifact의 검증 증거 필드와 두 경로만 치환하는 한계를 telemetry 문서에 기술했다.

### Files Changed
- src/workflow.ts (modified)
- src/run.ts (modified)
- src/runner.ts (modified)
- tests/cli.test.ts (modified)
- docs/benchmarks/TELEMETRY.md (modified)
- .bcos/reports/T-014-verification-failure-feedback.md (new)

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

✖ tests\\cli.test.ts
Error: spawn EPERM
ℹ tests 1
ℹ pass 0
ℹ fail 1
Exit code: 1
```

`node --test --test-isolation=none tests/cli.test.ts`

```text
테스트 파일 자체는 시작됐으나 각 CLI fixture의 spawnSync가 EPERM으로 거부됐다.
프로세스 격리가 필요한 마지막 비동기 테스트가 종료되지 않아 122.4초에 timeout됐다.
신규 순수 dry-run 결정성 테스트 1개를 포함해 spawn이 필요 없는 테스트 2개는 PASS로 관측됐다.
Exit code: 124
```

`node --input-type=module -e "... verificationExcerpt assertions ..."`

```text
verificationExcerpt assertions: pass
Exit code: 0
```

`Select-String -LiteralPath tests/cli.test.ts -Pattern '^test\\('`

```text
256
```

소스 파일 줄 수 확인:

```text
src/run.ts 83
src/workflow.ts 326
src/runner.ts 192
```

### Deviations
`npm test`의 256개 assertion 통과를 worker 샌드박스에서 확인하지 못했다. Node test runner와 테스트 내부의 모든 자식 프로세스 생성이 `spawn EPERM`으로 차단됐으며, 명세에 기록된 기존 worker 환경 제약과 같은 증상이다. Host에서 `npm test` 재실행이 필요하다.

### Known Risks
- Host 전체 테스트 결과가 아직 없다. 빌드와 독립적인 발췌 helper assertion만 통과했다.
- 정제는 명세대로 저장소 루트와 사용자 홈 경로 두 건만 치환한다. 검증 출력의 다른 민감정보는 발췌에 남을 수 있다.

### Context Used
- Files read: 9
- Outside Expected Files: 0
