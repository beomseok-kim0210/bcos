---
task: T-004
---

# Review — T-004

## Attempt 1 — 2026-08-04T08:00:00Z — APPROVED

### Verdict

**APPROVED**

Acceptance Criteria 16개를 reviewer 환경에서 독립 재현했다. `dist/` 삭제 후 재빌드,
reviewer 자신의 fixture로 성공 경로 1건과 실패 경로 6종을 직접 실행했으며,
`task start` 회귀도 별도로 확인했다.

**이 Task는 프로토콜 운영상 첫 사례를 남겼다** — `TASK_STARTED`와 `TASK_SUBMITTED`가
사후 복구가 아니라 **실제 실행 시각으로 기록된 첫 Task**다. 아래 §Lifecycle Assessment 참조.

### Acceptance Criteria Assessment

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | `npm run build` exit 0 | PASS | `dist/` 삭제 후 재빌드 exit 0 |
| 2 | 정상 submit exit 0 | PASS | reviewer fixture, exit 0 |
| 3 | `status: IMPLEMENTED`, `updated` = 이벤트 `ts`, **`attempt` 불변** | PASS | `attempt: 1` 유지, `updated`·`ts` 모두 `…T07:58:23.754Z` |
| 4 | 본문 바이트 동일 | PASS | md5 `0617a563…` 실행 전후 일치 |
| 5 | events 1줄 증가, 8필드, 값 일치 | PASS | 키 8개, `TASK_SUBMITTED`/`T-100`/`1`/`worker`/`codex-cli`/`IN_PROGRESS`/`IMPLEMENTED` |
| 6 | state counts 일치, `current_task: null` | PASS | `{TODO:0, IN_PROGRESS:0, IMPLEMENTED:1, DONE:0, BLOCKED:0}`, `null` |
| 7 | 없는 Task ID → exit 1, 무변경 | PASS | `.bcos` 트리 해시 동일 |
| 8 | `IN_PROGRESS` 아님 → exit 1, 무변경 | PASS | 동일 |
| 9 | **Report 없음 → exit 1, 무변경 (G3)** | PASS | 동일 |
| 10 | **Report는 있으나 현재 attempt 항목 없음 → exit 1, 무변경 (G3)** | PASS | `## Attempt 9`만 있는 Report로 확인 |
| 11 | actor 인자 누락 → exit 1, 무변경 | PASS | `--actor-id` 누락·`--actor-role` 누락 양쪽 확인 |
| 12 | `task start` 회귀 없음 | PASS | 정상 전이 1건 + 실패 3종 확인 |
| 13 | `--version`/`--help`/`foo` | PASS | exit 0 / 0 / 1 |
| 14 | 테스트 17개 이상 | PASS | **31 pass / 0 fail** |
| 15 | `dependencies` 없음, devDeps 2개 | PASS | 키 부재, 버전 무변경 |
| 16 | 변경 파일 3개, lock 없음, 실제 `.bcos/` 무변경 | PASS | 아래 §Scope Violations |

**AC Pass Rate: 100.0% (16/16)**
**Test Pass Rate: 100.0% (31/31)**

### Findings

**F-1 · Info · G3 가드가 attempt 번호까지 정확히 검사한다**

reviewer가 `## Attempt 9`만 있는 Report로 `attempt: 1` Task를 submit해 보았고
정상적으로 거부됐다. "Report 파일 존재"만이 아니라 **현재 attempt 항목 존재**를
확인한다 — RFC-001 G3의 문언 그대로다. 재작업(attempt 2 이상) 시 이전 attempt Report로
통과하는 구멍이 없다.

**F-2 · Info · 공통화가 적정 수준에서 멈췄다**

`actorArguments()`, `readTaskSet()`, `persistTransition()` 세 함수를 새로 뽑아
`startTask()`와 `submitTask()`가 공유한다. 전이 정의 테이블·상태 머신 엔진·명령 등록
구조는 없다. 라우팅은 `if (argument === "task" && argv[3] === "start") ... else if (... "submit")`
조건문 두 개다.

Task가 허용한 범위("`src/cli.ts` 안에서 공통 함수")를 정확히 지켰고, 금지한 범위
(테이블·엔진·framework)를 넘지 않았다. 세 번째 전이(`approve`)가 추가될 때 이 구조가
계속 적절한지는 그때 다시 판단한다.

**F-3 · Info · `--help` 문자열이 `task <start|submit>` 형태로 갱신됐다**

exit code는 0으로 동일하고 기존 테스트의 `/Usage:/` 단언도 통과한다. 새 명령을
문서화한 것이므로 회귀가 아니다.

**F-4 · Minor · `src/cli.ts`가 234줄로 상한 250줄에 근접했다**

T-003 154줄 → T-005 159줄 → T-004 234줄. 이번 증가분 75줄은 `submitTask()`와
공통 함수 3개다. Task가 정한 상한(250줄) 안이지만 여유가 16줄이다.

`approve`가 추가되면 이 파일 하나로는 부담이 커진다. **지금 분리하는 것은 과설계**이지만,
다음 Task 설계 시 상한을 다시 정하거나 분리 시점을 판단해야 한다. 현재는 위반이 아니다.

**Blocking finding: 0건.**

### Scope Violations

**0건.**

| 검사 | 결과 |
|---|---|
| 변경 파일이 `src/cli.ts`·`tests/cli.test.ts`·Report 3개인가 | OK |
| 새 소스 파일 / `src/core/` / `src/util/` | **없음** |
| 새 import | **없음** — `node:fs`·`node:path`·`node:url` 그대로 |
| 전이 테이블 · 상태 머신 엔진 · 명령 등록 구조 | **없음** (grep으로 확인) |
| 범용 인자 파서 | **없음** — `args.indexOf()` 직접 조회 |
| YAML·Markdown 라이브러리 | **없음** |
| 트랜잭션 엔진 · 롤백 · 잠금 파일 | **없음** |
| Report 내용 검증(증거 진위 판정) | **없음** — 존재와 attempt 항목만 확인 |
| `task approve` 등 범위 밖 명령 | **없음** |
| 의존성 추가 또는 버전 변경 | **없음** |
| `package-lock.json` | **없음** |
| RFC·ADR·README·문서 수정 | **없음** |

`.bcos/` 변경은 `tasks/T-004`(frontmatter 3필드)·`events.jsonl`(2줄 추가)·`state.json`뿐이며,
**전부 `bcos task start`와 `bcos task submit` 명령이 기록한 것**이다. worker가 손으로 편집한
흔적은 없다.

### Ponytail Violations

**0건.**

**Review Ponytail 4문항**

- 더 적은 변경으로 같은 결과? — 아니다. 가드 4개와 3파일 갱신이 모두 AC에 대응한다.
- 삭제할 코드·상태·규칙? — 없다. 새 함수 3개는 전부 두 곳에서 호출된다.
- 요구사항에 없는 기능? — 없다.
- 설명할 수 없는 추상화? — 없다. `persistTransition()`은 "Task→event→state 순서로 원자적
  기록"이라는 한 가지 일만 한다.

공통화 판단이 적절하다. **두 번째 호출처가 실제로 생긴 뒤에** 함수를 뽑았고,
호출처가 하나뿐인 추상화는 만들지 않았다.

### Lifecycle Assessment

**T-004는 전이가 실시간으로 기록된 첫 Task다.**

```text
TASK_STARTED    2026-08-04T07:48:31.075Z   worker/codex-cli   TODO → IN_PROGRESS
TASK_SUBMITTED  2026-08-04T07:55:47.593Z   worker/codex-cli   IN_PROGRESS → IMPLEMENTED
```

**사후 복구가 아니라는 근거 세 가지.**

1. **밀리초가 임의값이다.** 복구 이벤트는 하나의 시각에 `.001`/`.002`/`.003`을 붙인다
   (T-001·T-002·T-003·T-005가 그렇다). 여기는 `.075`와 `.593`이다.
2. **두 이벤트 간격이 7분 16초다.** 복구는 같은 초 안에서 이루어진다.
3. **Report 작성 시각(`07:53:53.989Z`)이 두 이벤트 사이에 있다.** 시작 → 작업 → Report →
   제출 순서가 시간축에서 자연스럽게 성립한다.

| 검사 | 결과 |
|---|---|
| `TASK_STARTED` < `TASK_SUBMITTED` | OK (7분 16초 차) |
| 두 이벤트 attempt 모두 1 | OK |
| actor_role / actor_id | OK — 둘 다 `worker` / `codex-cli` |
| submit 후 `status: IMPLEMENTED` | OK |
| `attempt: 1` 유지 (증가하지 않음) | OK |
| `current_task: null` | OK |
| Task `updated` = SUBMITTED `ts` | OK — 둘 다 `07:55:47.593Z` |
| state `updated` = SUBMITTED `ts` | OK |
| counts 파생 일치 | OK — `{TODO:0, IN_PROGRESS:0, IMPLEMENTED:1, DONE:4, BLOCKED:0}` |

**T-001부터 T-005까지는 전부 사후 복구가 필요했다.** T-004에서 처음으로 그 절차가 사라졌다.
남은 것은 `approve` 하나이며, 명령이 없어 이번에도 손으로 기록해야 한다.

### Regression Assessment

**회귀 0건.**

| 대상 | 결과 |
|---|---|
| 기존 테스트 23개 | 전부 pass (31개 중 앞 23개) |
| `task start` 정상 경로 | exit 0, `TODO → IN_PROGRESS`, `attempt 0 → 1`, 본문 md5 동일, `current_task` 설정 |
| `task start` 없는 ID | exit 1, `.bcos` 트리 해시 동일 |
| `task start` `TODO` 아님 | exit 1, 해시 동일 |
| `task start` actor 누락 | exit 1, 해시 동일 |
| `--version` / `--help` / `foo` | exit 0 / 0 / 1 |

`startTask()`가 공통 함수를 쓰도록 리팩터링됐음에도 동작이 완전히 동일하다.

### Reliability

| 지표 | 값 |
|---|---|
| Code failures | **0** |
| Environment failures | **0** (reviewer·worker 양쪽) |
| 최종 재현 | **성공** — `dist/` 삭제 후 build·test 31개·성공 1건·실패 6종·회귀 4종 전부 재시도 없이 통과 |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

reviewer 측 부산물 고지 — `npm run build`로 gitignore 대상인 `dist/`가 재생성됐고,
`npm install`이 만든 `package-lock.json`은 검증 직후 제거했다. 임시 fixture는
`os.tmpdir()` 아래이며 이 저장소 밖이다.

### Reviewer Conclusion

**T-004는 lifecycle 자동화의 두 번째 전이를 완성했고, 동시에 그 자동화가 실제로 작동함을
스스로 증명했다.** Task 문서·이벤트 로그·상태 인덱스가 모두 명령에 의해 기록됐고,
reviewer가 확인한 시각 패턴이 이를 뒷받침한다.

G3 가드가 특히 의미 있다. **증거 없는 완료 선언을 도구가 막는 첫 지점**이며,
reviewer 검증 결과 "Report 파일이 있기만 하면 통과"가 아니라 "현재 attempt 항목이 있어야
통과"로 정확히 동작한다.

**남은 한계를 분명히 한다.** 7개 전이 중 2개가 자동화됐다. `approve`는 여전히 명령이 없어
이번 승인도 손으로 기록해야 하며, SoD 가드(G5)는 아직 코드로 강제되지 않는다.
`approve`가 구현되기 전까지 "제출자는 승인할 수 없다"는 규칙은 문서상의 약속일 뿐이다.

**Required Changes: 없음** (APPROVED이므로 RFC-001 §4에 따라 미기재)

**후속 권고 (이번 승인의 조건이 아님)**
- `task approve` 구현 — Review 존재 가드(G4)와 **SoD 가드(G5)**가 추가된다.
  G5가 코드로 들어가는 시점이 이 프로토콜의 핵심 주장이 실제로 강제되는 시점이다
- F-4: `src/cli.ts` 234줄. `approve` 추가 시 파일 분리 여부를 Task 설계에서 판단
- T-006 이후 Task는 임시 우회 없이 표준 Markdown 빈 줄 형식으로 작성 (T-005로 해소됨)

Benchmark: `docs/benchmarks/T-004-task-submit-command.md`
