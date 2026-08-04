# T-003 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** `bcos task show`가 동작하면 이 파일과 `.bcos/prompts/`는 삭제한다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-003**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-003-task-start-command.md` — 작업 명세. **이것이 계약입니다.**
3. `src/cli.ts`, `tests/cli.test.ts`, `package.json` — 수정 대상과 현재 구조
4. `docs/rfcs/RFC-001-task-protocol.md` — **§1, §2, §3, §5만**

**위 목록 외의 파일은 읽지 마세요.**

- `docs/rfcs/RFC-001-task-protocol-appendix.md`를 **읽지 마세요.**
- `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/vision.md`,
  `.bcos/reviews/`, `docs/benchmarks/`를 **읽지 마세요.**
- 저장소 전체 탐색(`ls -R`, 전역 grep)을 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇을 만드는가

`src/cli.ts`에 하위 명령 하나를 추가합니다.

```
bcos task start <id> --actor-role <role> --actor-id <id>
```

이 명령은 **세 파일을 일관되게 갱신**합니다 — Task frontmatter, `.bcos/events.jsonl`,
`.bcos/state.json`. 정확한 규칙과 가드 5개는 Task 문서에 있습니다. 그대로 따르세요.

**핵심은 실패 경로입니다.** 가드 중 하나라도 실패하면
**파일을 하나도 바꾸지 않고** stderr에 오류를 내고 exit 1이어야 합니다.
가드는 전부 쓰기 **전에** 검사하세요.

## 3. Ponytail — 최소 구현

- **새 파일을 만들지 마세요.** 전부 `src/cli.ts` 안에서 처리합니다.
  `src/core/`, `src/util/`, 별도 모듈은 Out of Scope입니다.
- **범용 인자 파서를 만들지 마세요.** 읽을 인자는 `task`, `start`, `<id>`,
  `--actor-role`, `--actor-id` 다섯 개뿐입니다. `process.argv`를 직접 읽으면 충분합니다.
- **YAML 라이브러리를 쓰지 마세요.** frontmatter는 `key: value` 한 줄 형식입니다.
  필요한 3개 필드(`status`, `attempt`, `updated`)만 치환하고 나머지는 그대로 두세요.
- **트랜잭션 엔진·롤백 프레임워크·잠금 파일을 만들지 마세요.**
  가드를 먼저 통과시키는 것으로 충분합니다.
- **서브커맨드 라우터나 명령 등록 테이블을 만들지 마세요.** 명령이 하나뿐입니다.
- 의존성을 추가하지 마세요. 기존 devDependency 버전도 바꾸지 마세요.

**동작이 정확해도 더 단순한 대안이 명확하면 `CHANGES_REQUESTED`를 받습니다.**

## 4. 테스트 격리 — 가장 중요한 제약

**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 절대 금지입니다.**

각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고, 그 안에
`.bcos/tasks/`, `.bcos/events.jsonl`, `.bcos/state.json` fixture를 직접 생성한 뒤,
`spawnSync`의 `cwd` 옵션으로 CLI를 그 디렉터리에서 실행하세요.
테스트가 끝나면 임시 디렉터리를 정리합니다.

실제 `.bcos/`가 한 바이트라도 바뀌면 이 Task는 실패입니다.

**기존 테스트 3개를 깨뜨리지 마세요.** `--version`, `--help`, unknown argument는
그대로 동작해야 합니다.

## 5. 검증할 것

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

마지막 명령은 exit 1이어야 합니다.
Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.

`npm install`이 `package-lock.json`을 만들면 삭제하세요. 커밋 대상이 아닙니다.

## 6. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-003-task-start-command.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-003` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **5번 명령들의 출력 전문 + 정상 start 1회가 append한 실제 이벤트 줄**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수와 Read List 밖에서 읽은 파일

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`),
이메일, 로컬 환경값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 7. 절대 하지 말 것

- **`.bcos/tasks/T-003-task-start-command.md`를 수정하지 마세요.** 읽기 전용입니다
- **이 저장소의 `.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다.
  Task `status`·`attempt`·`state.json`·`events.jsonl`을 직접 바꾸지 마세요 —
  당신이 만드는 명령이 할 일이지, 당신이 지금 할 일이 아닙니다
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — `add`, `commit`, `push`, `checkout` 전부 금지입니다

## 8. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 15개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (10개 이상 pass)
- [ ] 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
