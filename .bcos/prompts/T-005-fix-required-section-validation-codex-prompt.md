# T-005 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** `bcos task show`가 동작하면 이 파일과 `.bcos/prompts/`는 삭제한다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-005**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

이것은 **버그 수정**입니다. 새 기능을 만들지 않습니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-005-fix-required-section-validation.md` — 작업 명세. **이것이 계약입니다.**
3. `src/cli.ts` — 수정 대상. `hasRequiredSections()` 함수가 문제입니다
4. `tests/cli.test.ts` — 기존 테스트 11개
5. `.bcos/tasks/T-004-task-submit-command.md` — **읽기 전용.** fixture 형식 확인용입니다.
   **절대 수정하지 마세요**
6. `package.json`
7. `docs/rfcs/RFC-001-task-protocol.md` — **§2와 §8만**

이 프롬프트 파일도 Read List에 포함되어 있습니다.

**위 목록 외의 파일은 읽지 마세요.** Appendix, `CLAUDE.md`, `README.md`,
`docs/architecture.md`, `.bcos/reviews/`, `docs/benchmarks/`, 다른 Task 파일 모두 읽지 마세요.
저장소 전체 탐색(`ls -R`, 전역 grep)도 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇이 잘못됐는가

`src/cli.ts`의 `hasRequiredSections()`는 각 섹션 본문을 이 정규식으로 잡습니다.

```
^## <name>[ \t]*\r?\n([\s\S]*?)(?=^## |\s*$)
```

`[\s\S]*?`가 lazy이고 종료 조건에 `\s*$`가 있습니다. 제목 바로 다음 줄이 **빈 줄**이면
그 위치에서 `\s*$`가 즉시 성립해 캡처가 빈 문자열이 됩니다. 그 결과 내용이 가득한 섹션이
"비어 있다"로 판정됩니다.

Markdown에서 제목 뒤 빈 줄은 표준 관례입니다. 실제로 이 저장소의 Task 파일
**T-001, T-002, T-003, T-004 네 개 모두** 현재 코드로 `task start`가 거부됩니다.
확인된 사실입니다.

## 3. 어떻게 고치는가

**정규식 하나로 Markdown 전체를 파싱하려 하지 마세요.** 다음이 가장 짧고 읽기 쉽습니다.

1. 필수 6개 heading의 위치를 문서 순서대로 찾는다
2. 각 heading 줄이 끝나는 지점부터 **다음 `## ` 줄이 시작하기 직전까지**를 잘라낸다
3. 마지막 `Test Requirements`는 파일 끝까지 자른다
4. 잘라낸 문자열을 `trim()` 한다
5. 비어 있으면 거부한다
6. `TODO` / `TBD` / `<...>` 하나뿐이면 거부한다
7. heading이 없거나 문서상 순서가 어긋나면 거부한다

**주의할 점 두 가지입니다.**

- "다음 heading"은 **필수 6개 중 다음 것이 아니라 본문에 나오는 임의의 `## ` 줄**입니다.
  필수 섹션 사이에 추가 H2가 있으면 현재 섹션은 거기서 끝나야 합니다.
- `### ` 이하 하위 제목은 섹션을 끝내지 **않습니다.** `## ` 만 경계입니다.

## 4. Ponytail — 고치는 작업이지 늘리는 작업이 아닙니다

- **범용 Markdown 파서를 만들지 마세요.** 필요한 것은 위치 탐색과 문자열 자르기뿐입니다
- Markdown·YAML 라이브러리를 추가하지 마세요
- 새 파일이나 `src/core/`, `src/util/` 디렉터리를 만들지 마세요. 전부 `src/cli.ts` 안입니다
- 전이 정의 테이블·상태 머신 엔진·범용 CLI framework를 만들지 마세요
- **`task start`의 다른 가드를 건드리지 마세요.** 가드 1(Task 존재), 2(`TODO`),
  3(다른 `IN_PROGRESS` 없음), 5(actor 인자)는 그대로입니다. G2 판정 로직만 고칩니다
- Task 파일을 자동으로 고쳐주는 기능을 만들지 마세요
- `task submit`이나 `approve`를 만들지 마세요

`src/cli.ts`가 200줄을 넘으면 무언가를 과하게 만든 것입니다. 현재 154줄입니다.

## 5. 테스트 격리 — 가장 중요한 제약

**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 절대 금지입니다.**

각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고, 그 안에
`.bcos/tasks/`, `.bcos/events.jsonl`, `.bcos/state.json` fixture를 직접 생성한 뒤
`spawnSync`의 `cwd` 옵션으로 CLI를 실행하세요. 끝나면 정리합니다.

실제 `.bcos/`가 한 바이트라도 바뀌면 이 Task는 실패입니다.

**T-004 형식 fixture를 반드시 넣으세요.** `.bcos/tasks/T-004-task-submit-command.md`를
읽어 같은 형식(제목 뒤 빈 줄, 다중 문단, 목록, 표, 코드 블록)의 fixture를 만들고
`task start`가 exit 0을 반환하는지 검증하세요. **이것이 이 Task의 핵심 테스트입니다.**

T-003의 테스트가 제목 다음 줄에 바로 본문이 오는 합성 fixture만 써서, 11개가 전부
통과하면서도 실제 형식을 한 번도 검증하지 못했습니다. 같은 실수를 반복하지 마세요.

## 6. 검증할 것

구현 후 다음을 **실제로 실행**하고 출력을 저장하세요.

```
npm run build
```
```
npm test
```
```
node dist/cli.js --version
```
```
node dist/cli.js --help
```
```
node dist/cli.js foo
```

그리고 임시 fixture에서 T-004와 같은 형식의 Task로 `task start`가 성공하는지,
공백뿐인 섹션으로는 실패하는지 각각 실행해 확인하세요.

Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.
`npm install`이 `package-lock.json`을 만들면 삭제하세요.

## 7. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-005-fix-required-section-validation.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-005` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만. 어떤 방식으로 섹션을 잘랐는지 한두 문장으로
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **6번 명령들의 출력 전문 + T-004 형식 fixture가 통과하는 실행 결과**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수와 Read List 밖에서 읽은 파일

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`), 이메일,
로컬 환경값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 8. 절대 하지 말 것

- **`.bcos/tasks/` 아래 어떤 파일도 수정하지 마세요.** T-004와 T-005 모두 읽기 전용입니다
- **이 저장소의 `.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — `add`, `commit`, `push`, `checkout` 전부 금지입니다

## 9. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 18개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (21개 이상 pass)
- [ ] T-004와 같은 형식의 fixture로 `task start`가 exit 0을 반환한다
- [ ] 공백뿐 / `TODO`뿐 / heading 누락 / 순서 오류 fixture가 각각 exit 1이고 파일 변경 0건이다
- [ ] 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
