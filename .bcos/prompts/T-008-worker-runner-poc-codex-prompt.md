# T-008 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** 이 Task가 만드는 `task run`이 동작하면
> 사람이 Context를 복사해 붙여넣을 필요가 없어진다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-008**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-008-worker-runner-poc.md` — 작업 명세. **이것이 계약입니다.**
3. `src/cli.ts` — 라우팅 추가 대상. 현재 318줄입니다
4. `src/context.ts` — **읽기 전용.** `buildContextPackage()`를 호출만 합니다
5. `tests/cli.test.ts` — 기존 테스트 66개
6. `package.json`
7. `.bcos/prompts/T-007-context-builder-codex-prompt.md` — **읽기 전용.** Prompt 형식 확인용

이 프롬프트 파일도 Read List에 포함되어 있습니다.

**위 목록 외의 파일은 읽지 마세요.** `CLAUDE.md`, `README.md`, RFC, ADR,
`docs/benchmarks/`, `.bcos/reviews/`, 다른 Task 파일 모두 읽지 마세요.
저장소 전체 탐색(`ls -R`, 전역 grep)도 하지 마세요.

**`codex --help`를 실행하지 마세요.** 필요한 사용법은 Task 문서에 이미 조사돼 있습니다.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇을 만드는가

```
node dist/cli.js task run <id> --worker codex [--dry-run] [--timeout <seconds>] [--worker-command <path>]
```

Context Package와 Worker Prompt를 조립해 **Codex 프로세스의 stdin으로 전달**합니다.

**Runner는 lifecycle을 소유하지 않습니다.** `start`·`submit`·`approve`를 대신 실행하지
않고, Codex 출력을 해석하지 않으며, 작업 완료 여부를 판단하지 않습니다.
**입력을 넣고 출력을 그대로 통과시킬 뿐입니다.**

`events.jsonl`은 이 명령의 어떤 경로에서도 늘어나면 안 됩니다.

정확한 조립 형식·탐색 규칙·검증 항목은 Task 문서에 있습니다. 그대로 따르세요.

## 3. 셸을 쓰지 마세요 — 가장 중요한 제약

`spawn`에 **`shell: false`** 를 씁니다. `shell: true`, `cmd /c`, 문자열로 명령을 조립하는
방식은 전부 금지입니다.

Windows에서 `codex`는 `.cmd` 셸 shim이라 `shell:false`로 실행할 수 없습니다.
**대신 `process.execPath`로 Codex의 JS 엔트리를 직접 실행합니다.**

```
spawn(process.execPath,
      [<codex.js 경로>, "exec", "-", "--cd", <저장소 루트>],
      { shell: false, cwd: <저장소 루트> })
```

`codex exec` 에 PROMPT 인자로 `-`를 주면 **stdin에서 지시를 읽습니다.**
이것은 codex-cli 0.146.0에서 확인된 동작입니다.

**JS 엔트리 탐색** — `--worker-command`가 있으면 그 경로, 없으면 `process.env.PATH`의
각 디렉터리에서 `node_modules/@openai/codex/bin/codex.js` 존재를 확인해 첫 매치를 씁니다.
**`PATH`는 문자열 분할과 `existsSync`로만 다룹니다. 셸을 부르지 마세요.**

**`--sandbox`를 지정하지 마세요.** Codex 설정 기본값을 그대로 씁니다. Runner가 샌드박스
정책을 임의로 완화하면 안 됩니다.

**Task ID를 argv에 넣지 마세요.** Task ID는 오직 stdin 본문에만 들어갑니다.
이것이 셸 메타문자 주입을 원천 차단합니다.

## 4. Ponytail — 추상화를 만들지 마세요

지원하는 worker는 **`codex` 하나뿐**입니다. 두 번째가 생기는 것은 T-010이며,
그때까지 vendor 중립 구조를 만들지 않습니다.

- `WorkerAdapter` interface, `CodexAdapter` class, Provider, Factory, Plugin **금지**
- Event emitter, Queue, Job scheduler, Retry engine, Process manager 추상화 **금지**
- 새 파일은 **`src/runner.ts` 하나만**. `src/util/` 같은 디렉터리를 만들지 마세요
- **`src/context.ts`를 수정하지 마세요.** `buildContextPackage()`를 import해 호출만 합니다
- 의존성을 추가하지 마세요
- 대화형 TTY 자동화를 시도하지 마세요

`src/runner.ts`는 **함수를 export**합니다. class를 쓰지 마세요.

## 5. 출력을 메모리에 쌓지 마세요

Codex 구현 작업은 출력이 깁니다. child의 stdout·stderr를 **부모로 흘려보내면서
바이트 수만 세세요.** 전체 출력을 문자열로 누적하지 마세요.

**stdin 내용을 로그 파일로 남기지 마세요.** 환경 변수 값을 오류 메시지에 넣지 마세요.

## 6. dry-run

`--dry-run`은 **프로세스를 실행하지 않고** 요약만 출력합니다.

포함 — command · args · cwd · Prompt 경로 · Context file count · Context SHA-256 ·
stdin SHA-256 · stdin 문자 수 · 줄 수

**stdin 본문은 출력하지 마세요.** 전문을 출력하는 옵션도 만들지 마세요.

같은 입력이면 stdin SHA-256이 같아야 합니다. **타임스탬프를 stdin에 넣지 마세요.**

## 7. 테스트 — 실제 Codex를 절대 호출하지 마세요

**임시 디렉터리에 가짜 worker `.js` 파일**을 만들고 `--worker-command`로 가리키세요.
Runner가 `process.execPath`로 JS를 실행하므로 가짜 worker도 `.js`면 됩니다.
`.cmd` wrapper나 셸이 필요 없어 Windows에서 안전합니다.

가짜 worker는 stdin 전문을 읽어 **SHA-256을 stdout에 출력**하고, `process.cwd()`를 출력하고,
stderr에 한 줄을 쓰고, 지정한 exit code로 종료하고, 지정한 시간 대기할 수 있어야 합니다.

**이 저장소의 실제 `.bcos/`나 실제 소스를 읽거나 쓰는 테스트는 금지입니다.**
실패 경로마다 fixture `.bcos/` 해시가 실행 전후 동일한지 확인하세요.

## 8. 검증할 것

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

그리고 임시 fixture에서 확인하세요.

- dry-run 요약 전문
- **dry-run 2회 stdin SHA-256 일치**
- fake worker가 받은 stdin SHA-256이 dry-run 해시와 일치
- fake worker exit 3이 worker 실패로 구분 보고되는지
- timeout 동작과 그 후 fixture 무변경
- `task start` · `submit` · `approve` · `context` 정상·실패 각 1건

Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.
`npm install`이 `package-lock.json`을 만들면 삭제하세요.

## 9. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-008-worker-runner-poc.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-008` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만. 탐색·조립·실행을 어떻게 나눴는지 한두 문장으로
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **8번 항목 전부**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수, Read List 밖 파일,
  **완료 후 `src/cli.ts` · `src/context.ts` · `src/runner.ts` 줄 수**

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`), 이메일,
환경 변수 값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 10. 절대 하지 말 것

- **`.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다
- **Runner가 lifecycle 전이를 일으키지 않게 하세요.** `events.jsonl`은 늘어나면 안 됩니다
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — 구현 안에서도, 셸에서도 금지입니다
- **실제 Codex를 실행하지 마세요** — 테스트에서도, 수동 확인에서도 금지입니다

## 11. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 46개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (90개 이상 pass)
- [ ] dry-run 2회의 stdin SHA-256이 같다
- [ ] fake worker가 받은 stdin 해시가 dry-run 해시와 일치한다
- [ ] 실패 경로마다 fixture `.bcos/` 해시가 동일하고 `events.jsonl`이 늘지 않았다
- [ ] 소스에 `shell: true` · `cmd /c` · 명령 문자열 조립이 없다
- [ ] 테스트가 실제 Codex를 한 번도 호출하지 않는다
- [ ] `src/`에 `cli.ts` · `context.ts` · `runner.ts` 세 파일만 있고 하위 디렉터리가 없다
- [ ] 변경 파일이 `src/cli.ts`, `src/runner.ts`, `tests/cli.test.ts`, Report 4개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
