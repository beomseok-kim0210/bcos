# T-004 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** `bcos task show`가 동작하면 이 파일과 `.bcos/prompts/`는 삭제한다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-004**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-004-task-submit-command.md` — 작업 명세. **이것이 계약입니다.**
3. `src/cli.ts` — 수정 대상. `task start` 구현이 이미 있습니다
4. `tests/cli.test.ts` — 기존 테스트 11개
5. `package.json`
6. `docs/rfcs/RFC-001-task-protocol.md` — **§1, §2, §3, §5만**

이 프롬프트 파일도 Read List에 포함되어 있습니다.

**위 목록 외의 파일은 읽지 마세요.**

- `docs/rfcs/RFC-001-task-protocol-appendix.md`를 **읽지 마세요.**
- `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/vision.md`,
  `.bcos/reviews/`, `docs/benchmarks/`, 다른 Task 파일을 **읽지 마세요.**
- 저장소 전체 탐색(`ls -R`, 전역 grep)을 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇을 만드는가

`src/cli.ts`에 하위 명령 하나를 추가합니다.

```
bcos task submit <id> --actor-role <role> --actor-id <id>
```

`IN_PROGRESS → IMPLEMENTED` 전이입니다. 이미 있는 `task start`와 구조가 같습니다 —
가드를 먼저 전부 검사하고, 통과하면 Task frontmatter·`events.jsonl`·`state.json`을
순서대로 갱신합니다.

**`start`와 다른 점 세 가지입니다.**

1. **Report 가드(G3)가 있습니다.** `.bcos/reports/<id>-*.md` 가 존재하고
   본문에 `## Attempt <현재 attempt>` 줄이 있어야만 제출을 허용합니다.
   파일은 있는데 해당 attempt 항목이 없으면 거부합니다.
2. **`attempt`를 증가시키지 않습니다.** attempt는 `IN_PROGRESS`에 진입할 때만 오릅니다.
   submit은 `IN_PROGRESS`를 떠나는 전이이므로 값을 그대로 둡니다.
3. **`current_task`가 보통 `null`이 됩니다.** 값을 하드코딩하지 말고
   Task 파일을 다시 스캔한 재계산 결과를 쓰세요.

정확한 가드 4개와 쓰는 값은 Task 문서에 있습니다. 그대로 따르세요.

**핵심은 실패 경로입니다.** 가드 중 하나라도 실패하면 **파일을 하나도 바꾸지 않고**
stderr에 오류를 내고 exit 1이어야 합니다. 가드는 전부 쓰기 **전에** 검사하세요.

## 3. 코드 재사용 — 이번에는 허용됩니다

`start`와 `submit`은 "가드 검사 → 세 파일 갱신" 구조가 동일합니다.
**두 번째 호출처가 실제로 생겼으므로** `src/cli.ts` 안에서 공통 부분을 함수로 묶는 것은
적절합니다. 중복을 그대로 두는 쪽이 오히려 지적받습니다.

**단, 여기까지입니다.**

- 전이 정의 테이블(`{from, to, guards, event}` 배열 같은 것)을 만들지 마세요
- 상태 머신 엔진, 명령 등록 구조, 범용 CLI framework를 만들지 마세요
- 새 파일이나 `src/core/`, `src/util/` 디렉터리를 만들지 마세요
- 범용 인자 파서를 만들지 마세요. 읽을 인자는 5개뿐입니다
- YAML 라이브러리를 쓰지 마세요
- 트랜잭션 엔진·롤백·잠금 파일을 만들지 마세요

전이가 두 개일 때 필요한 것은 **공유 함수 몇 개**이지 프레임워크가 아닙니다.
`src/cli.ts`가 250줄을 넘으면 공통화가 부족하거나 무언가를 과하게 만든 것입니다.

**`task approve`를 만들지 마세요.** Review 가드와 SoD 가드가 필요한 별도 Task입니다.

## 4. 기존 동작을 깨뜨리지 마세요

리팩터링으로 공통화하더라도 **`task start`의 동작은 완전히 동일해야 합니다.**
기존 테스트 11개가 전부 그대로 통과해야 하며, 추가로 `task start` 정상 전이 1건과
실패 경로 1건 이상을 직접 실행해 회귀가 없음을 확인하세요.

## 5. 테스트 격리 — 가장 중요한 제약

**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 절대 금지입니다.**

각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고, 그 안에
`.bcos/tasks/`, `.bcos/reports/`, `.bcos/events.jsonl`, `.bcos/state.json` fixture를
직접 생성한 뒤 `spawnSync`의 `cwd` 옵션으로 CLI를 실행하세요.
테스트가 끝나면 임시 디렉터리를 정리합니다.

실제 `.bcos/`가 한 바이트라도 바뀌면 이 Task는 실패입니다.

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

그리고 임시 fixture에서 `task start` 정상 전이와 `task submit` 정상 전이를 각각 실행해
회귀가 없음을 확인하세요.

Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.
`npm install`이 `package-lock.json`을 만들면 삭제하세요.

## 7. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-004-task-submit-command.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-004` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만. 공통화한 부분이 있으면 무엇을 묶었는지 적으세요
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **6번 명령들의 출력 전문 + submit이 append한 실제 이벤트 줄 +
  `task start` 회귀 확인 결과**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수와 Read List 밖에서 읽은 파일

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`), 이메일,
로컬 환경값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 8. 절대 하지 말 것

- **`.bcos/tasks/T-004-task-submit-command.md`를 수정하지 마세요.** 읽기 전용입니다
- **이 저장소의 `.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다.
  `status`·`attempt`·`state.json`·`events.jsonl`을 직접 바꾸지 마세요
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — `add`, `commit`, `push`, `checkout` 전부 금지입니다

## 9. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 16개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (17개 이상 pass)
- [ ] `task start` 회귀가 없음을 직접 실행해 확인했다
- [ ] 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
