---
task: T-901
---

# Report — T-901

## Attempt 1 — 2026-08-13T14:19:00Z

### Implemented
- `readList()`의 종료 경계가 기존 `**생성**`, `**수정**`, `**쓰기**`와 새 `**쓰기 허용 (Write List)**`를 인식하도록 했다.
- 대칭 Write List 경계, 기존 짧은 경계 3종, 굵은 산문 비경계, 실제 T-016 형태를 검증하는 테스트 6건을 추가했다.
- 기존 짧은 `**쓰기**` 테스트가 경계 앞의 기본 항목 2개를 사용하던 픽스처 오류를 독립적인 1개 항목 픽스처로 수정했다.

### Files Changed
- src/context.ts (modified)
- tests/cli.test.ts (modified)
- .bcos/reports/T-901-context-write-list-boundary.md (new)

### Test Evidence

직전 Host Verification (`npm-test`)은 전체 278건을 실행했고, 수정 전 픽스처 오류 한 건만 실패했다.

```text
ℹ tests 278
ℹ pass 277
ℹ fail 1

✖ task context retains the short write boundary
expected: /^files: 1$/m
actual: files: 2
```

해당 픽스처 수정 후 변경 범위 6개 케이스를 빌드된 `buildContextPackage()`에 직접 실행했다.

```text
T-901 targeted cases: 6 passed
Exit code: 0
```

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

```text
src/context.ts lines: 165
T-901 tests present: 6
Exit code: 0
```

전체 `npm.cmd test` 재실행은 이 worker 샌드박스가 Node test runner의 자식 프로세스 생성을 차단해 테스트 코드 진입 전 실패했다.

```text
Error: spawn EPERM
code: 'EPERM'
syscall: 'spawn'
```

`--test-isolation=none` 재시도에서도 테스트 내부의 `spawnSync`가 같은 환경 제한을 받아 전체 회귀 실행 근거로 사용하지 않았다.

### Deviations
- 전체 테스트 재실행은 worker 샌드박스의 `spawn EPERM` 제한 때문에 완료하지 못했다. 직전 Host Verification의 277개 통과 결과와 실패했던 단일 케이스를 포함한 변경 범위 직접 검증 6개 통과를 함께 남겼다.

### Known Risks
- 수정 후 전체 278개를 한 번에 통과한 Host Verification 결과는 아직 없다. 독립 reviewer/host가 `npm test`를 다시 실행해야 한다.

### Context Used
- Files read: 6
- Outside Expected Files: 0
