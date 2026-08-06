---
task: T-007
---

# Review — T-007

## Attempt 1 — 2026-08-06T03:25:00Z — APPROVED

### Verdict

**APPROVED**

Acceptance Criteria 32개를 reviewer 환경에서 독립 재현했다. `dist/` 삭제 후 재빌드,
reviewer 자신의 fixture로 성공 경로 1건과 **실패 경로 10종**을 직접 실행했으며,
`start` · `submit` · `approve` 회귀를 정상·실패 각 1건씩 확인했다.

**결정성 검증이 이 Task의 판정 근거다.** 같은 입력 2회 실행의 stdout SHA-256이
`3c1d4ef9d5b9a94a…`로 동일했다.

### Acceptance Criteria Assessment

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | `npm run build` exit 0 | PASS | `dist/` 삭제 후 재빌드 exit 0 |
| 2 | 정상 생성 exit 0 | PASS | reviewer fixture exit 0 |
| 3 | 헤더·푸터 존재 | PASS | `=== BCOS CONTEXT PACKAGE v0.1 ===` / `=== END CONTEXT PACKAGE ===` |
| 4 | 각 파일 정확히 한 번 | PASS | `FILE 1/4`~`4/4`, 중복 없음 |
| 5 | 중복 제거 | PASS | Read List 5항목(`AGENTS.md` 2회) → `files: 4` |
| 6 | Read List 순서 유지 | PASS | AGENTS → RFC → cli.ts → T-004, 기재 순서와 동일 |
| 7 | **2회 실행 바이트 동일** | PASS | SHA-256 `3c1d4ef9d5b9a94a…` 일치 |
| 8 | 메타데이터 `task`·`status`·`attempt` | PASS | `T-100` / `IMPLEMENTED` / `3` — frontmatter와 일치 |
| 9 | `files` 정확 | PASS | 4 |
| 10 | `characters`·`lines` 정확 | PASS | 별도 fixture에서 `characters: 34` 실측 일치 (F-1 참조) |
| 11 | UTF-8 보존 | PASS | `한글 본문입니다 … §·—` 손상 없음 |
| 12 | Task 파일 무변경 | PASS | md5 실행 전후 동일 |
| 13 | `events.jsonl` 무변경 | PASS | 0B 유지 |
| 14 | `state.json` 무변경 | PASS | `updated: "x"` 유지 |
| 15 | 없는 Task ID | PASS | exit 1, stdout 0B |
| 16 | 라벨 없음 | PASS | exit 1, stdout 0B |
| 17 | 빈 Read List | PASS | exit 1, stdout 0B |
| 18 | 없는 파일 | PASS | exit 1, stdout 0B |
| 19 | `..` / 절대경로 | PASS | 양쪽 각각 exit 1, stdout 0B |
| 20 | 바이너리 | PASS | NUL 포함 파일 exit 1, stdout 0B |
| 21 | 256 KB 초과 | PASS | 300 KB 파일 exit 1, `Read List file exceeds 256 KB` |
| 22 | 금지 패턴 | PASS | `.env` · `node_modules/` 각각 exit 1 |
| 23 | 실패 시 fixture 무변경 | PASS | **10종 전부 `.bcos` 트리 md5 동일** |
| 24 | 8,000자 초과 경고 + exit 0 | PASS | `Warning: … (16832)` stderr, exit 0 |
| 25 | `task start` 회귀 없음 | PASS | 정상 1건 + 실패 1건 |
| 26 | `task submit` 회귀 없음 | PASS | 정상 1건 + 실패 1건 |
| 27 | `task approve` 회귀 없음 | PASS | 정상 1건 + SoD 실패 1건 |
| 28 | `--version`/`--help`/`foo` | PASS | exit 0 / 0 / 1 |
| 29 | 테스트 65개 이상 | PASS | **66 pass / 0 fail** |
| 30 | `dependencies` 없음, devDeps 2개 | PASS | 키 부재, 버전 무변경 |
| 31 | `src/`에 두 파일, 하위 디렉터리 없음 | PASS | `cli.ts` · `context.ts` |
| 32 | 변경 파일 4개, lock 없음, 실제 `.bcos/` 무변경 | PASS | 아래 §Scope Violations |

**AC Pass Rate: 100.0% (32/32)**
**Test Pass Rate: 100.0% (66/66)**

### 독립 검증 요약

```text
성공 경로 — 실제 T-004와 실제 RFC-001을 복사한 fixture
  exit=0
  stderr: Warning: Context Package exceeds 8,000 characters (16832)
  header: task=T-100 status=IMPLEMENTED attempt=3 files=4 characters=16466 lines=533
  order:  AGENTS.md → RFC-001 → src/cli.ts → T-004      (Read List 기재 순서)
  dedup:  Read List 5항목 → files 4
  SHA-256 1회 = 2회 = 3c1d4ef9d5b9a94a…
  fixture .bcos md5 실행 전후 동일

실패 경로 10종 — 전부 exit 1, stdout 0 byte, .bcos md5 동일
  없는 Task ID / 라벨 없음 / 빈 Read List / 없는 파일 / `..` 경로 /
  절대경로 / .env / node_modules/ / 바이너리 / 256 KB 초과
```

### Findings

**F-1 · Minor · `lines` 정의가 `wc -l`과 1 차이 난다**

`lineCount()`는 `content.split(/\r\n|\r|\n/).length`를 쓴다. 파일이 개행으로 끝나면
마지막 빈 조각이 포함되어 **눈에 보이는 줄 수보다 1이 크다.**

```text
ko.md 내용: "한글…\n두 번째 줄\n"
wc -l       → 2
lines       → 3
characters  → 34   (실측 일치)
```

**Task가 `lines`의 정의를 명시하지 않았으므로 규격 위반은 아니다.**
`split` 기준과 개행 개수 기준 모두 통용되며, 값은 결정론적이고 일관된다.
`characters`는 정확히 일치했다.

다만 사람이 `wc -l`과 대조하면 어긋나 보인다. **후속 Task에서 정의를 명시하거나
개행 개수 기준으로 바꾸는 것을 권고한다.** 이번 승인의 조건은 아니다.

**F-2 · Info · `note`가 메타데이터 블록이 아니라 파일 헤더에 렌더링된다**

Task는 "주석 전문을 메타데이터의 `note`로 보존"이라고 적었고, 구현은
`--- FILE n/m: path ---` 다음 줄에 `note: (파일 전문)`을 붙인다.

```text
--- FILE 2/4: docs/rfcs/RFC-001-task-protocol.md ---
note: (파일 전문)
```

**요구 목적(사람이 의도를 볼 수 있게)을 충족하며 배치가 오히려 낫다** —
해당 파일 바로 옆에 붙어 어떤 항목의 주석인지 명확하다. 결정론적이고 재현된다.

**F-3 · Info · frontmatter 전용 파서를 두어 자기참조 함정을 회피했다**

`taskFrontmatter()`가 첫 두 `---` 사이만 잘라내고 `frontmatterValue()`가 그 안에서만
찾는다. T-007 Task 파일이 예시 코드 블록에 `status: TODO` / `attempt: 0`을 포함하고 있어
전역 스캔이면 잘못된 값을 얻는데, 구현이 이를 정확히 피했다.
**Task 명세에 명시한 요구가 그대로 반영됐다.**

**F-4 · Info · 8,000자 경고 임계값이 패키지 전체 길이 기준이다**

`output.length` — 헤더 포함이다. Task는 "패키지가 8,000자를 넘으면"이라 적었으므로
해석이 일치한다. `characters` 메타데이터는 본문 합계(16,466)이고 경고는 전체(16,832)로
서로 다른 값인데, 둘 다 정의대로다. 혼동 여지가 있으나 규격 위반이 아니다.

**Blocking finding: 0건.**

### Scope Violations

**0건.**

| 검사 | 결과 |
|---|---|
| 변경 파일이 `src/cli.ts`·`src/context.ts`·`tests/cli.test.ts`·Report 4개인가 | OK |
| 새 소스 파일이 `src/context.ts` **하나뿐**인가 | OK |
| `src/` 하위 디렉터리 | **없음** |
| class · Factory · Adapter · Provider · Plugin · registry | **없음** (grep 확인) |
| `git` 호출 (`execSync` / `child_process` / `"git"`) | **없음** (grep 확인) |
| 새 import | `realpathSync`·`statSync` 추가 — 전부 `node:fs`. **외부 의존 0** |
| 파일 출력 · `.bcos/context/` 디렉터리 | **없음** — stdout 전용 |
| § 범위 추출 | **없음** — 파일 전문만 |
| `task show` 구현 | **없음** |
| 범용 Markdown 파서 | **없음** — 라벨 탐색 + 백틱 추출 |
| 의존성 추가 또는 버전 변경 | **없음** |
| `package-lock.json` | **없음** |
| `task start` / `submit` / `approve` 동작 변경 | **없음** — 회귀 확인 |
| 실제 저장소 `.bcos/` 변경 | **명령 기록만** — `start`·`submit`이 기록한 것 |
| RFC·ADR·README·문서 수정 | **없음** |

### Ponytail Violations

**0건.**

`src/context.ts` 165줄에 함수 6개 — `taskFrontmatter` · `frontmatterValue` · `readList` ·
`isForbidden` · `loadFiles` · `lineCount`, 그리고 `buildContextPackage` 하나만 export한다.
`src/cli.ts`는 318줄로 라우팅 한 줄과 출력 함수만 늘었다.

- 더 적은 변경으로 같은 결과? — 아니다. 검증 8종이 모두 AC에 대응한다
- 삭제할 코드? — 없다. 모든 함수에 호출처가 있다
- 요구사항에 없는 기능? — 없다
- 설명할 수 없는 추상화? — 없다. export가 하나뿐이다

**분리 판단이 옳았다.** `src/cli.ts` 318 + `src/context.ts` 165 = 483줄이다.
단일 파일이었다면 T-006이 정한 400줄 트리거를 넘었을 것이고, 실제로 넘었다.

### Regression Assessment

**회귀 0건.**

| 대상 | 결과 |
|---|---|
| 기존 테스트 46개 | 전부 pass (66개 중 앞 46개) |
| `task start` 정상 | exit 0, `TODO → IN_PROGRESS`, `attempt 0 → 1` |
| `task start` 실패 | exit 1, `.bcos` md5 동일 |
| `task submit` 정상 | exit 0, `IN_PROGRESS → IMPLEMENTED`, `attempt` 불변 |
| `task submit` 실패 (Report 없음) | exit 1, md5 동일 |
| `task approve` 정상 | exit 0, `IMPLEMENTED → DONE` |
| `task approve` 실패 (SoD) | exit 1, `The submitting actor cannot approve the same attempt`, md5 동일 |
| `--version` / `--help` / `foo` | exit 0 / 0 / 1 |

`--help` 문자열이 `task <start|submit|approve|context>`로 갱신됐다. exit code 동일,
기존 `/Usage:/` 단언 통과. 새 명령 문서화이므로 회귀가 아니다.

### Lifecycle Assessment

```text
TASK_STARTED    2026-08-06T03:00:48.781Z   worker/codex-cli
TASK_SUBMITTED  2026-08-06T03:11:59.074Z   worker/codex-cli
Report 작성     2026-08-06T03:09:03Z       (두 이벤트 사이)
```

밀리초가 임의값(`.781`, `.074`)이고 간격이 11분 10초이며 Report가 그 사이에 있다.
**사후 복구가 아니다.** T-004·T-006에 이어 세 번째다.

`start`와 `submit`은 이미 실제 실행된 기록이므로 **수정하거나 복구하지 않았다.**

### Reliability

| 지표 | 값 |
|---|---|
| Code failures | **0** |
| Environment failures | **0** (worker·reviewer 양쪽) |
| worker `Deviations` | **None** (세 Task 연속) |
| 최종 재현 | **성공** — `dist/` 삭제 후 build·test 66개·성공 1건·실패 10종·회귀 8종 재시도 없이 통과 |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

reviewer 측 부산물 — `npm run build`로 gitignore 대상 `dist/`가 재생성됐고,
`npm install`이 만든 `package-lock.json`은 검증 직후 제거했다. fixture는 `os.tmpdir()` 아래다.

### Reviewer Conclusion

**T-007은 사람이 Context를 나르던 구조에 처음으로 도구를 넣었다.**

지금까지 `Files Read`는 worker 자기보고였고 감사 수단이 없었다. `task context`가
읽을 파일 집합을 결정론적으로 만들면서, **무엇이 전달됐는지가 재현 가능한 산출물**이 됐다.
SHA-256이 두 번 실행에서 같다는 것이 그 근거다.

설계 판단 세 가지가 결과로 확인됐다. **stdout 전용**이라 stale 파생물이 없고,
**타임스탬프 미포함**이라 해시가 안정적이며, **§ 범위 미지원**이라 T-005에서 겪은
코드 블록 heading 오인식을 애초에 피했다.

특히 평가할 점은 **실패 경로의 엄격함**이다. 10종 전부에서 stdout이 0 바이트였다.
부분 출력이 없다는 것은 Runner가 이 명령의 출력을 신뢰할 수 있다는 뜻이다.

**남은 한계를 분명히 한다.** 이 명령은 Context를 **만들 뿐 전달하지 않는다.**
사람이 여전히 결과를 복사해 Worker에 붙여넣어야 한다. Human handoff 단계가
4에서 2로 줄었을 뿐 0이 아니다. Runner는 후속 Task다.

**Required Changes: 없음** (APPROVED이므로 RFC-001 §4에 따라 미기재)

**후속 권고 (이번 승인의 조건이 아님)**
- F-1: `lines` 정의를 명시하거나 개행 개수 기준으로 통일
- **RFC-001 §6 개정** — `task show` 8블록 중 둘이 요약을 요구해 결정론적 구현이 불가능하다.
  `task context`와의 관계를 규격에 반영해야 한다. 별도 승인 대상
- T-008 Worker Runner PoC — Context를 만드는 것과 전달하는 것 사이의 간극

Benchmark: `docs/benchmarks/T-007-context-builder.md`
