---
task: T-003
---

# Review — T-003

## Attempt 1 — 2026-08-04T04:45:00Z — APPROVED

### Verdict

**APPROVED**

Acceptance Criteria 15개를 reviewer 환경에서 독립 재현했다. Worker Report의 출력을 신뢰하지 않고
`dist/` 삭제 후 재빌드, 자체 fixture로 성공 경로 1건과 실패 경로 5건을 직접 실행해 검증했다.

**이 Task의 핵심은 기능이 아니라 실패 경로다.** 가드 5종 모두에서 `.bcos/` 트리 전체의
md5 해시가 실행 전후 동일함을 확인했다 — partial write 0건.

### Acceptance Criteria Assessment

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | `npm run build` exit 0 | PASS | `dist/` 삭제 후 재빌드 exit 0 |
| 2 | 정상 start exit 0 | PASS | reviewer fixture에서 exit 0 |
| 3 | frontmatter 3필드 갱신, `updated` = 이벤트 `ts` | PASS | `status: IN_PROGRESS`, `attempt: 1`, `updated`·`ts` 모두 `...T04:40:31.943Z` |
| 4 | 본문 바이트 동일 | PASS | 본문 md5 `43e28806…` 실행 전후 일치 |
| 5 | events 1줄 증가, 8필드, 값 일치 | PASS | 8키 확인, `TASK_STARTED`/`T-100`/`1`/`worker`/`codex-cli`/`TODO`/`IN_PROGRESS` |
| 6 | state counts·current_task 일치 | PASS | `{TODO:0, IN_PROGRESS:1, …}`, `current_task: "T-100"` |
| 7 | 없는 ID → exit 1, 무변경 | PASS | `.bcos` 트리 md5 동일 |
| 8 | `TODO` 아님 → exit 1, 무변경 | PASS | 동일 |
| 9 | 다른 `IN_PROGRESS` 존재 → exit 1, 무변경 (G1) | PASS | 동일 |
| 10 | 필수 섹션 비어 있음 → exit 1, 무변경 (G2) | PASS | 동일 |
| 11 | actor 인자 누락 → exit 1, 무변경 | PASS | 동일 |
| 12 | `--version`/`--help`/`foo` 회귀 없음 | PASS | exit 0 / 0 / 1 |
| 13 | `npm test` 통과, 10개 이상 | PASS | **11 pass / 0 fail** |
| 14 | `dependencies` 없음, devDeps 2개 그대로 | PASS | 키 부재, `@types/node`·`typescript` 버전 무변경 |
| 15 | 변경 파일 3개, lock 없음, 실제 `.bcos/` 무변경 | PASS | `git status` 3항목, lock 부재, `.bcos/` diff 0 |

**AC Pass Rate: 100.0% (15/15)**
**Test Pass Rate: 100.0% (11/11)**

### Findings

**F-1 · Minor · `events.jsonl` 또는 `state.json` 부재 시 raw stack trace**

`.bcos/tasks/`는 있으나 `events.jsonl`/`state.json`이 없는 저장소에서 실행하면
`readFileSync`가 처리되지 않은 예외를 던져 Node 내부 스택 트레이스가 출력된다.

**동작 자체는 안전하다.** 이 읽기는 Task 쓰기보다 앞에 있어 exit 1이며 Task 파일은
변경되지 않는다(reviewer 확인: `status: TODO` 유지, partial write 없음).

다만 `bcos init`이 아직 없으므로 새 저장소 사용자가 이 경로에 도달할 수 있다.
Task가 이 상황을 AC로 요구하지 않았고 `init`이 Out of Scope이므로 **구현자 귀책이 아니다.**
후속 Task에서 `fail()`로 감싸거나 `init` 구현으로 해소한다.

**F-2 · Info · `hasRequiredSections`는 각 섹션의 첫 줄만 검사한다**

`([\s\S]*?)(?=^## |\s*$)` 는 lazy 매칭이라 `\s*$`가 첫 줄 끝에서 성립한다.
결과적으로 "섹션 전체가 비었는가"가 아니라 "첫 줄이 비었는가"를 본다.

**AC 10을 충족하는 데는 문제가 없다.** 섹션이 실제로 비면 첫 줄도 비므로 정확히 거부된다.
`TBD`/`TODO`/`<...>` 판정도 첫 줄 기준으로 의도대로 동작한다.
"첫 줄만 채우고 나머지는 비우는" 회피는 가능하나, 이는 아직 발생한 적 없는 문제이며
지금 강화하면 과설계다. 기록만 남긴다.

**F-3 · Info · `--help` 문자열 변경은 회귀가 아니다**

`--help` 출력에 `task start` 사용법이 추가됐다. AC 12는 exit code 기준이며 0을 유지한다.
기존 테스트의 `/Usage:/` 단언도 통과한다. 새 명령을 문서화하는 것이 올바른 동작이다.

**F-4 · Info · Read List 밖 접근 1건은 불가피하다**

worker가 `.bcos/prompts/T-003-…-codex-prompt.md`를 읽었다. 프롬프트를 읽지 않으면
지시를 받을 수 없다. T-001·T-002에서도 동일하게 발생했으며 **Task 설계 측 갭**이다.
세 Task 연속이므로 후속 Task는 프롬프트를 Read List에 포함해야 한다.

**F-5 · Info · Deviations의 자기보고가 정확하다**

worker는 수동 증거 수집 중 cwd를 바꾸지 않아 실제 저장소를 대상으로 실행했고
`TODO` 가드에서 exit 1로 멈췄다고 보고했다. reviewer가 `git status`와 `.bcos/` diff로
확인한 결과 **실제 저장소는 한 바이트도 변경되지 않았다.** 보고가 사실과 일치한다.
숨길 수 있었던 실수를 기록한 점은 Report 규범을 정확히 따른 것이다.

**Blocking finding: 0건.**

### Scope Violations

**0건.**

| 검사 | 결과 |
|---|---|
| 변경 파일이 `src/cli.ts`·`tests/cli.test.ts`·Report 3개인가 | OK |
| 새 소스 파일 / `src/core/` / `src/util/` 생성 | **없음** |
| 의존성 추가 또는 기존 버전 변경 | **없음** |
| `package-lock.json` 생성 | **없음** |
| 실제 저장소 `.bcos/` 변경 | **없음** |
| `submit`/`approve`/`init`/`status` 등 범위 밖 명령 | **없음** |
| RFC·ADR·README·CLAUDE.md·AGENTS.md 수정 | **없음** |

### Ponytail Violations

**0건.** Out of Scope에 나열한 유혹을 하나도 실행하지 않았다.

| 유혹 | 결과 |
|---|---|
| 범용 인자 파서 | `args.indexOf("--actor-role")` 직접 조회. 파서 없음 |
| 서브커맨드 라우터 / 명령 등록 테이블 | `if (argument === "task" && argv[3] === "start")` 조건문 하나 |
| YAML 파서 라이브러리 | 정규식으로 3개 필드만 치환 |
| 트랜잭션 엔진 / 롤백 / 잠금 파일 | 없음. 가드 선행 검사로 해결 |
| 새 모듈 분리 | 전부 `src/cli.ts` 안. 두 번째 사용처 없음 |

**Review Ponytail 4문항**

- 더 적은 변경으로 같은 결과? — 아니다. 가드 5개와 3파일 갱신이 모두 AC에 대응한다.
- 삭제할 코드·상태·규칙? — 없다. 모든 헬퍼 함수에 호출처가 있다.
- 요구사항에 없는 기능? — 없다.
- 설명할 수 없는 추상화? — 없다. 함수 4개는 전부 `startTask()` 안에서 쓰인다.

`writeFileSync` + `renameSync` 조합이 두 곳(Task, state)에서 반복되나, 별도 헬퍼로 빼지 않은
것은 적절하다. 2회 반복은 추상화 근거가 되지 못한다.

### Reliability

| 지표 | 값 |
|---|---|
| Code failures | **0** |
| Environment failures | **0** (reviewer 환경) |
| Worker 측 환경 이슈 | PowerShell이 `npm.ps1` 차단 → `cmd /c` 우회 (T-001·T-002와 동일 계열) |
| 최종 재현 | **성공** — `dist/` 삭제 후 build·test·성공 경로·실패 경로 5종 전부 재시도 없이 통과 |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

reviewer 측 부산물 고지 — `npm run build` 실행으로 gitignore 대상인 `dist/`가 재생성됐다.
임시 fixture는 `os.tmpdir()` 아래에 생성했고 이 저장소 밖이다. 소스 변경은 없다.

### Benchmark Summary

| 항목 | 값 |
|---|---:|
| AC Pass Rate | 100.0% (15/15) |
| Test Pass Rate | 100.0% (11/11) |
| Scope Violations | 0 |
| Ponytail Violations | 0 |
| Attempt | 1 |
| Rework | No |
| 제품 변경 줄 수 | +304 / −6 (2 파일) |
| Files Read (자기보고) | 7 |
| Read Scope Ratio | 18.4% (7 / 38) |
| Partial write 관측 | **0건** (실패 5종 전부) |

상세: `docs/benchmarks/T-003-task-start-command.md`

### Reviewer Conclusion

**이 Task는 T-001·T-002에서 두 번 반복된 결함을 실제로 제거했다.**

`TODO → IN_PROGRESS` 전이에 한해, 사람이 세 파일을 각각 편집하던 절차가 명령 하나로 바뀌었고
**세 파일이 함께 갱신되거나 함께 갱신되지 않거나 둘 중 하나만 가능**해졌다. 누락이 구조적으로
불가능해진 첫 전이다.

특히 평가할 점은 **실패 경로의 엄격함**이다. AC 15개 중 5개가 "실패 시 파일 변경 0건"에
배정돼 있었고, reviewer가 `.bcos/` 트리 전체 해시로 독립 검증한 결과 전부 충족했다.
가드를 모든 쓰기 앞에 배치한 설계가 정확히 작동한다.

**아직 해결되지 않은 것을 분명히 한다.** `submit`과 `approve`는 여전히 수동이므로
T-003이 자동화한 것은 전체 lifecycle의 3분의 1이다. 다음 두 전이가 구현되기 전까지
lifecycle 누락은 여전히 발생할 수 있다.

**Required Changes: 없음** (APPROVED이므로 RFC-001 §4에 따라 미기재)

**후속 Task 권고 (이번 승인의 조건이 아님)**
- T-004로 `task submit` + `task approve` 구현 — 메커니즘이 검증됐으므로 한 Task로 묶는 것을
  검토할 수 있다. `approve`는 Review 존재 가드와 SoD 가드가 추가된다
- F-1: `events.jsonl`/`state.json` 부재 시 clean error. `bcos init` 구현으로 함께 해소 가능
- F-4: 실행 프롬프트를 Read List에 포함 (3개 Task 연속 발생)
- README `Current Capabilities`에 `bcos task start` 추가 — 기능 승인 후 별도 커밋
