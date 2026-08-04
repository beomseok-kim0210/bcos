---
task: T-005
---

# Review — T-005

## Attempt 1 — 2026-08-04T07:40:00Z — APPROVED

### Verdict

**APPROVED**

Acceptance Criteria 18개를 reviewer 환경에서 독립 재현했다. Worker Report의 출력을 신뢰하지 않고
`dist/` 삭제 후 재빌드, reviewer 자신의 fixture 12종으로 validator를 직접 검증했으며,
**실제 T-004 파일과 실제 `.bcos/` 구조를 임시 복사해 blocker 해소를 확인했다.**

### Acceptance Criteria Assessment

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | `npm run build` exit 0 | PASS | `dist/` 삭제 후 재빌드 exit 0 |
| 2 | 제목 뒤 빈 줄 1개 → exit 0 | PASS | reviewer fixture 1 |
| 3 | 제목 뒤 빈 줄 여러 개 → exit 0 | PASS | reviewer fixture 2 |
| 4 | 다중 문단 → exit 0 | PASS | reviewer fixture 3 |
| 5 | 목록으로 시작 → exit 0 | PASS | reviewer fixture 4 |
| 6 | 표 포함 → exit 0 | PASS | reviewer fixture 5 |
| 7 | 코드 블록 포함 → exit 0 | PASS | reviewer fixture 6 |
| 8 | **실제 T-004 형식 → exit 0** | PASS | **실제 파일 복사본으로 확인. 아래 §실제 T-004 재현** |
| 9 | 공백뿐 → exit 1, 변경 0 | PASS | reviewer fixture 8, `.bcos` 트리 해시 동일 |
| 10 | `TODO`뿐 → exit 1, 변경 0 | PASS | reviewer fixture 9 |
| 11 | `TBD`/`<placeholder>`뿐 → exit 1, 변경 0 | PASS | reviewer fixture 10·11 |
| 12 | heading 누락 → exit 1, 변경 0 | PASS | reviewer fixture 12 |
| 13 | heading 순서 오류 → exit 1, 변경 0 | PASS | reviewer fixture 13 |
| 14 | 나머지 가드 회귀 없음 | PASS | 없는 ID·`TODO` 아님·G1 충돌·actor 누락 전부 exit 1, 변경 0 |
| 15 | `--version`/`--help`/`foo` | PASS | exit 0 / 0 / 1 |
| 16 | 테스트 21개 이상 | PASS | **23 pass / 0 fail** |
| 17 | `dependencies` 없음, devDeps 2개 | PASS | 키 부재, `@types/node`·`typescript` 무변경 |
| 18 | 변경 파일 3개, lock 없음, 실제 `.bcos/` 무변경 | PASS | `git status` 3항목, lock 부재, `.bcos/` diff 0 |

**AC Pass Rate: 100.0% (18/18)**
**Test Pass Rate: 100.0% (23/23)**

### 실제 T-004 형식 재현 결과

**이것이 이 Task의 판정 근거다.** 실제 `.bcos/tasks/` 전체와 `events.jsonl`, `state.json`을
임시 디렉터리에 복사한 뒤 수정 없이 실행했다.

```text
$ node dist/cli.js task start T-004 --actor-role worker --actor-id codex-cli
exit=0

status:  TODO → IN_PROGRESS
attempt: 0 → 1
updated: 2026-08-04T07:34:50.863Z

본문 md5 (before → after): 7ba144a1333981aa8b8af4d7e3dc58be → 7ba144a1333981aa8b8af4d7e3dc58be

events: 9줄 → 10줄
{"ts":"2026-08-04T07:34:50.863Z","event":"TASK_STARTED","task":"T-004","attempt":1,
 "actor_role":"worker","actor_id":"codex-cli","from":"TODO","to":"IN_PROGRESS"}

state: {"TODO":1,"IN_PROGRESS":1,"IMPLEMENTED":0,"DONE":3,"BLOCKED":0}
       current_task: "T-004"
```

수정 전에는 같은 파일이 `Task T-004 has an empty required section`으로 거부됐다.
**blocker가 실제로 해소됐다.** 본문 md5가 동일하므로 frontmatter 외에는 손대지 않았다.

이 검증은 전부 `os.tmpdir()` 복사본에서 수행했다. 실제 저장소의 T-004는
`status: TODO`, `attempt: 0`으로 그대로이며 실제 `events.jsonl`은 9줄이다.

### Findings

**F-1 · Info · 코드 블록 안의 `## ` 줄이 섹션 경계로 취급된다**

`hasRequiredSections()`는 다음 heading을 `/^## /m` 로 찾으므로 fenced code block 안의
`## ` 줄도 경계가 된다. reviewer가 확인한 결과, 코드 블록 뒤에 실제 본문이 있으면
잘린 앞부분이 비어 있지 않아 통과한다(exit 0).

**T-005 명세가 "본문에 나오는 임의의 `## ` 줄"을 경계로 정의했으므로 명세 준수다.**
이론적 오탐 조건은 "섹션 본문이 곧바로 `## `로 시작하는 코드 블록이고 그 앞에 아무 내용도
없는 경우"인데, 실제 Task 문서에서 발생한 적이 없다. Markdown fence 상태를 추적하려면
파서에 가까워지므로 지금 고치는 것은 과설계다. 기록만 남긴다.

**F-2 · Info · 마지막 섹션은 파일 끝까지 판정한다**

`Test Requirements` 이후에 추가 H2가 있으면 그것까지 본문에 포함된다.
이는 T-005 명세 3번 요구사항 그대로이며 의도된 동작이다.

**F-3 · Info · `name`이 이스케이프 없이 정규식에 삽입된다**

`new RegExp(\`^## ${name}...\`)`. `names`는 정규식 메타문자가 없는 고정 상수 6개이므로
현재 위험이 없다. 사용자 입력이 이 경로에 들어오면 달라지지만 그런 경로는 없다.

**F-4 · T-003 Review F-2 판정 정정**

T-003 Review에서 같은 결함을 **Info로 분류하고 "AC 10 충족에는 문제없다"** 고 판단했다.
그 판단은 틀렸다. 당시 확인했어야 할 것은 합성 fixture가 아니라 저장소의 실제 Task 형식이었고,
실제로는 **T-001~T-004 네 파일 전부**가 거부되는 상태였다. `task start`는 T-005 이전까지
실제 Task에서 한 번도 동작하지 않았다.

교훈은 명확하다 — **fixture가 실제 산출물의 형식을 대표하지 않으면 테스트 개수는 무의미하다.**
T-003은 11개가 전부 통과했으나 그중 실제 형식을 쓴 것은 0개였다.
T-005는 이 문제를 AC 8과 테스트 18번으로 직접 막았다.

**F-5 · Minor · T-005 자신의 lifecycle이 기록되지 않았다**

`bcos task start T-005`가 실행되지 않아 Task는 `TODO`/`attempt 0`이고 `events.jsonl`에
T-005 항목이 없다. 반면 Report는 `## Attempt 1`로 작성돼 있다.

**구현 결함이 아니다.** T-005 프롬프트가 `.bcos/` 상태 파일 수정을 금지했고 worker는
그 지시를 정확히 따랐다. 전이를 기록하는 것은 human의 절차였고 그 단계가 누락됐다.
사후 복구 계획은 §Reviewer Conclusion 뒤 Lifecycle Recovery Plan에 있다.

**Blocking finding: 0건.**

### Scope Violations

**0건.**

| 검사 | 결과 |
|---|---|
| 변경 파일이 `src/cli.ts`·`tests/cli.test.ts`·Report 3개인가 | OK |
| 새 소스 파일 / `src/core/` / `src/util/` | **없음** |
| 새 import 추가 | **없음** — `node:fs`, `node:path`, `node:url` 그대로 |
| Markdown·YAML 라이브러리 | **없음** |
| 의존성 추가 또는 버전 변경 | **없음** |
| `package-lock.json` | **없음** |
| 실제 저장소 `.bcos/` 변경 | **없음** (Report 생성 제외) |
| `task start`의 다른 가드 변경 | **없음** — 가드 1·2·3·5 동작 동일 |
| `submit`/`approve` 등 범위 밖 명령 | **없음** |
| RFC·ADR·README·문서 수정 | **없음** |

### Ponytail Violations

**0건.**

| 유혹 | 결과 |
|---|---|
| 범용 Markdown 파서 | 없음. `indexOf` 수준의 위치 탐색 + `slice` + `trim` |
| 새 abstraction / 헬퍼 모듈 | 없음. 함수 개수 5개로 T-003과 동일 |
| 전이 테이블 · 상태 머신 엔진 | 없음 |
| 파일 자동 교정 기능 | 없음 |

`src/cli.ts` **154 → 159줄 (+5)**. 상한 200줄 대비 여유가 크다.
검증 로직을 **고치는** 작업이었고 실제로 5줄만 늘었다.

**Review Ponytail 4문항** — 더 적은 변경으로 같은 결과? 아니다. 정규식 하나로는 이 문제를
못 고친다. 삭제할 코드? 없다. 요구사항에 없는 기능? 없다. 설명할 수 없는 추상화? 없다.

### Reliability

| 지표 | 값 |
|---|---|
| Code failures | **0** |
| Environment failures | **0** (reviewer 환경) |
| Worker 측 이슈 | 전역 `bcos`가 PATH에 없음 → `node dist/cli.js`로 검증. **blocker 아님** |
| 최종 재현 | **성공** — `dist/` 삭제 후 build·test 23개·fixture 12종·실제 T-004 전부 재시도 없이 통과 |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

reviewer 측 부산물 고지 — `npm run build`로 gitignore 대상인 `dist/`가 재생성됐고,
`npm install`이 만든 `package-lock.json`은 검증 직후 제거했다. 임시 fixture는
`os.tmpdir()` 아래이며 이 저장소 밖이다. 소스 변경은 없다.

### Regression Assessment

**회귀 0건.**

| 대상 | 결과 |
|---|---|
| 기존 테스트 11개 | 전부 pass (23개 중 앞 11개) |
| `task start` 성공 경로 | 정상 전이 확인 (실제 T-004 + fixture 6종) |
| 없는 Task ID | exit 1, `.bcos` 트리 해시 동일 |
| `TODO`가 아닌 Task | exit 1, 해시 동일 |
| 다른 Task가 `IN_PROGRESS` (G1) | exit 1, 해시 동일 |
| actor 인자 누락 | exit 1, 해시 동일 |
| `--version` / `--help` / `foo` | exit 0 / 0 / 1 |

heading 매칭 정규식이 `(?=^## |\s*$)` 종료 조건에서 `(?:\r?\n|$)` 로 바뀌었으나
가드 판정 결과는 기존 실패 경로에서 모두 동일하다.

### Reviewer Conclusion

**T-005는 실제 blocker를 해소했다.** 판정 근거는 테스트 개수가 아니라 실제 T-004 파일이
수정 없이 `exit 0`으로 전이된다는 사실이다.

이번 Task의 가치는 두 가지다. 첫째, `bcos task start`가 **처음으로 실제 Task에서 동작한다.**
T-001부터 T-004까지는 명령이 존재했을 뿐 이 저장소의 어떤 Task도 통과시키지 못했다.
둘째, **fixture 현실성 문제를 테스트로 못박았다.** AC 8과 테스트 18번이 실제 T-004 형식을
검증하므로 같은 종류의 결함이 다시 통과할 수 없다.

구현은 5줄 증가로 끝났다. 문제는 크기가 아니라 lazy 정규식의 종료 조건 하나였고,
worker는 그것만 고쳤다.

**Required Changes: 없음** (APPROVED이므로 RFC-001 §4에 따라 미기재)

**후속 권고 (이번 승인의 조건이 아님)**
- T-005 lifecycle 3건 사후 복구 필요 (F-5). 원래 시각은 추정하지 않는다
- 복구 후 T-004를 정상 형식 그대로 `bcos task start`로 시작할 수 있다
- T-006 이후 Task는 임시 우회 없이 표준 Markdown 빈 줄 형식으로 작성한다

Benchmark: `docs/benchmarks/T-005-fix-required-section-validation.md`
