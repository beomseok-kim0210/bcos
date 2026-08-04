---
protocol: "0.1"
id: T-005
title: Fix required section validation for standard Markdown spacing
status: DONE
attempt: 1
created: 2026-08-04T07:12:24Z
updated: 2026-08-04T07:41:34.003Z
---

## Objective
`bcos task start`가 정상적인 Task 파일을 거부한다. T-004를 시작하려 하자
`Task T-004 has an empty required section`으로 막혔는데, T-004의 여섯 섹션은 각각
376~1,769자의 내용을 담고 있다.
원인은 `src/cli.ts`의 `hasRequiredSections()`가 쓰는 정규식이다.
`^## <name>[ \t]*\r?\n([\s\S]*?)(?=^## |\s*$)` 에서 `[\s\S]*?`가 lazy이고 종료 조건에
`\s*$`가 있어, 제목 바로 다음에 빈 줄이 오면 캡처가 빈 문자열로 끝난다.
Markdown에서 제목 뒤 빈 줄은 표준 관례이므로 사실상 모든 정상 Task가 거부된다.
실제로 이 저장소의 Task 파일 **네 개 전부**(T-001~T-004)가 현재 validator를 통과하지 못한다.
T-003 Review에서 F-2 정보성 Finding으로 기록했으나 blocker로 판단하지 않았다. 오판이었다.
T-003 테스트가 제목 다음 줄에 바로 본문이 오는 합성 fixture만 사용했기 때문에
11개가 전부 통과하면서도 실제 형식을 한 번도 검증하지 못했다.
이 Task는 그 검증 로직을 고치고, 실제 Task 파일 형식을 fixture로 넣어 재발을 막는다.

## Scope
`src/cli.ts`의 `hasRequiredSections()`를 다시 구현한다.
- [ ] 필수 6개 heading의 위치를 문서 순서대로 찾는다
- [ ] 각 heading 줄 끝에서 다음 heading 시작 직전까지를 그 섹션의 본문으로 자른다
- [ ] 마지막 `Test Requirements`는 파일 끝까지를 본문으로 본다
- [ ] 잘라낸 본문을 `trim()` 한 뒤 비어 있으면 거부한다
- [ ] `trim()` 결과가 `TODO` / `TBD` / `<...>` 하나뿐이면 거부한다
- [ ] heading이 하나라도 없거나 문서상 순서가 어긋나면 거부한다
- [ ] `tests/cli.test.ts`에 아래 Test Requirements의 fixture를 추가한다
**구현 방향** — 정규식 하나로 Markdown 전체를 파싱하려 하지 않는다.
heading 위치를 찾고 문자열을 잘라 `trim()` 하는 방식이 가장 짧고 읽기 쉽다.
heading 판정은 줄 시작의 `## <name>` 정확 일치로 한다. 뒤에 공백만 허용한다.
"다음 heading"은 **필수 6개 중 다음 것**이 아니라 **본문에 나오는 임의의 `## ` 줄**이다.
필수 섹션 사이에 추가 H2 섹션이 있어도 현재 섹션이 그 지점에서 끝나야 한다.
`### ` 이하 하위 제목은 섹션을 끝내지 않는다.

## Out of Scope
**아래를 만들면 이 Task는 실패다.**
- `bcos task submit` / `approve` / `block` / `unblock` / `request-changes` — T-004 이후
- `bcos init` / `status` / `reindex` / `task create` / `list` / `show`
- **범용 Markdown 파서** — 필요한 것은 heading 위치 탐색과 문자열 자르기뿐이다
- Markdown 또는 YAML 라이브러리 도입
- 전이 정의 테이블, 상태 머신 엔진, 명령 등록 구조, 범용 CLI framework
- 범용 인자 파서
- **새 소스 파일 또는 `src/core/`, `src/util/` 디렉터리** — 전부 `src/cli.ts` 안에서 처리한다
- `task start`의 다른 가드 변경 — 가드 1·2·3·5는 그대로 둔다. G2 판정 로직만 고친다
- Task 파일 자동 수정 또는 자동 교정 기능
- RFC-001 §2.2의 필수 섹션 정의 변경 — 규범은 그대로다. 구현이 규범을 못 따랐을 뿐이다
- runtime dependency 추가. devDependency 추가와 기존 버전 변경도 금지
- `package-lock.json` 생성
- 이 저장소의 실제 `.bcos/` 내용 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- git add / commit / push

## Acceptance Criteria
1. `npm run build` 가 exit 0으로 성공한다.
2. 제목 다음에 **빈 줄 1개**가 있고 그 뒤에 본문이 있는 Task로 `task start` 가 exit 0을 반환한다.
3. 제목 다음에 **빈 줄 2개 이상**이 있어도 exit 0을 반환한다.
4. 섹션 본문이 **여러 문단**(문단 사이 빈 줄 포함)이어도 exit 0을 반환한다.
5. 섹션이 **목록(`- `)으로 시작**해도 exit 0을 반환한다.
6. 섹션이 **표(`|`)를 포함**해도 exit 0을 반환한다.
7. 섹션이 **코드 블록(```)을 포함**해도 exit 0을 반환한다.
8. **이 저장소의 실제 `.bcos/tasks/T-004-task-submit-command.md` 와 동일한 형식**의 fixture로
   `task start` 가 exit 0을 반환한다.
9. 섹션 본문이 **공백·빈 줄뿐**이면 exit 1이며 파일 변경이 0건이다.
10. 섹션 본문이 **`TODO` 한 줄뿐**이면 exit 1이며 파일 변경이 0건이다.
11. 섹션 본문이 **`TBD` 한 줄뿐**이거나 **`<placeholder>` 한 줄뿐**이면 exit 1이며 파일 변경이 0건이다.
12. 필수 heading이 **하나 누락**되면 exit 1이며 파일 변경이 0건이다.
13. 필수 heading의 **순서가 어긋나면** exit 1이며 파일 변경이 0건이다.
14. `task start` 의 나머지 동작이 변하지 않는다 — 없는 ID, `TODO` 아님, 다른 `IN_PROGRESS` 존재,
    actor 인자 누락에서 각각 exit 1이며 파일 변경이 0건이다.
15. `node dist/cli.js --version`, `--help`, `foo` 가 각각 exit 0 / exit 0 / exit 1 이다.
16. `npm test` 가 통과하며 기존 11개를 포함해 **21개 이상**의 테스트가 pass한다.
17. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
18. `git status` 기준 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다.
    `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files
**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.
**수정**
- `src/cli.ts`
- `tests/cli.test.ts`
**읽기 허용 (Read List)**
- `AGENTS.md`
- `.bcos/tasks/T-005-fix-required-section-validation.md` (이 파일)
- `.bcos/prompts/T-005-fix-required-section-validation-codex-prompt.md` (실행 프롬프트)
- `.bcos/tasks/T-004-task-submit-command.md` — **fixture 형식 확인용 읽기 전용.** 수정 금지
- `src/cli.ts`
- `tests/cli.test.ts`
- `package.json`
- `docs/rfcs/RFC-001-task-protocol.md` — **§2와 §8만.** Appendix는 읽지 않는다
**쓰기**
- `.bcos/reports/T-005-fix-required-section-validation.md`
**새 소스 파일을 만들지 않는다.** `src/cli.ts`는 현재 154줄이며 이 Task 후 200줄을 넘지 않아야 한다.
검증 로직을 고치는 작업이지 늘리는 작업이 아니다.

## Test Requirements
`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.
**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고
그 안에 `.bcos/tasks/`, `.bcos/events.jsonl`, `.bcos/state.json` fixture를 생성한 뒤
`spawnSync`의 `cwd` 옵션으로 CLI를 실행한다.
**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 금지한다.**
| # | fixture | 기대 |
|---|---|---|
| 1–11 | 기존 테스트 11개 | 전부 그대로 통과 |
| 12 | 제목 다음 빈 줄 1개 | exit 0 |
| 13 | 제목 다음 빈 줄 여러 개 | exit 0 |
| 14 | 다중 문단 (문단 사이 빈 줄) | exit 0 |
| 15 | 목록으로 시작하는 섹션 | exit 0 |
| 16 | 표를 포함하는 섹션 | exit 0 |
| 17 | 코드 블록을 포함하는 섹션 | exit 0 |
| 18 | 실제 T-004와 동일한 형식 | exit 0 |
| 19 | 공백·빈 줄뿐인 섹션 | exit 1, 파일 변경 0 |
| 20 | `TODO` 한 줄뿐인 섹션 | exit 1, 파일 변경 0 |
| 21 | `<placeholder>` 한 줄뿐인 섹션 | exit 1, 파일 변경 0 |
| 22 | 필수 heading 하나 누락 | exit 1, 파일 변경 0 |
| 23 | 필수 heading 순서 어긋남 | exit 1, 파일 변경 0 |
"파일 변경 0"은 실행 전후 `.bcos/` 하위 파일 내용을 문자열로 비교해 확인한다.
**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 출력 전문,
그리고 **T-004 형식 fixture가 통과하는 것을 보여주는 실행 결과**를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.
**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.
**측정:** Report의 `Context Used`에 읽은 파일 수와 Read List 밖에서 읽은 파일을 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·계정명을 Report에 남기지 않는다.
