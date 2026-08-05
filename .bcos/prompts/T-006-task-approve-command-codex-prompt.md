# T-006 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** `bcos task show`가 동작하면 이 파일과 `.bcos/prompts/`는 삭제한다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-006**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-006-task-approve-command.md` — 작업 명세. **이것이 계약입니다.**
3. `src/cli.ts` — 수정 대상. `task start`와 `task submit`이 이미 있습니다
4. `tests/cli.test.ts` — 기존 테스트 31개
5. `package.json`
6. `docs/rfcs/RFC-001-task-protocol.md` — **§1, §2, §4, §5만**
7. `.bcos/reviews/T-004-task-submit-command.md` — **읽기 전용.** fixture 형식 확인용

이 프롬프트 파일도 Read List에 포함되어 있습니다.

**위 목록 외의 파일은 읽지 마세요.** Appendix, `CLAUDE.md`, `README.md`,
`docs/architecture.md`, `docs/benchmarks/`, 다른 Task 파일 모두 읽지 마세요.
저장소 전체 탐색(`ls -R`, 전역 grep)도 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇을 만드는가

```
bcos task approve <id> --actor-role <role> --actor-id <id>
```

`IMPLEMENTED → DONE` 전이입니다. 구조는 `task submit`과 같습니다 — 가드를 먼저 전부
검사하고, 통과하면 Task frontmatter·`events.jsonl`·`state.json`을 순서대로 갱신합니다.

**가드가 6개이고, 그중 두 개가 새롭습니다.**

**가드 5 — Review 판정 (G4)**

`.bcos/reviews/<id>-*.md` 본문에서 다음 한 줄을 찾습니다.

```
## Attempt <현재 attempt> — <임의 텍스트> — APPROVED
```

**이 줄만 검사하세요.** `### Verdict` 섹션도, `Criteria Assessment` 표도 읽지 마세요.
attempt 번호와 판정이 같은 줄에 있으므로 정규식 하나면 됩니다.
`.bcos/reviews/T-004-task-submit-command.md`를 열어 실제 형식을 확인하세요.

판정이 `CHANGES_REQUESTED`나 `BLOCKED`이면 거부합니다.

**가드 6 — 직무 분리 (G5). 이 명령에서 가장 중요합니다**

`.bcos/events.jsonl`에서 다음 조건을 **전부** 만족하는 이벤트를 찾습니다.

- `task` == 대상 id
- `event` == `TASK_SUBMITTED`
- **`attempt` == 현재 attempt**

그 이벤트의 `actor_id`가 `--actor-id`와 **같으면 거부**합니다.

**주의 세 가지입니다.**

- **`attempt` 일치를 반드시 확인하세요.** 재작업이 있었다면 이전 attempt의 submit
  이벤트가 남아 있습니다. 그것을 참조하면 SoD 판정이 틀립니다
- **해당 이벤트가 없으면 거부**합니다. SoD를 판정할 근거가 없기 때문입니다
- **Report 작성자나 Task 작성자를 기준으로 쓰지 마세요.** 오직 `TASK_SUBMITTED`
  이벤트의 `actor_id`만 사용합니다

이 가드가 "구현한 주체는 자기 작업을 승인할 수 없다"를 코드로 강제하는 지점입니다.
이 프로젝트가 존재하는 이유이므로 정확해야 합니다.

나머지 가드 4개(Task 존재 / `IMPLEMENTED` 상태 / actor 인자 / role이 `reviewer`나 `human`)와
세 파일에 쓰는 값은 Task 문서에 있습니다. 그대로 따르세요.

**핵심은 실패 경로입니다.** 가드 중 하나라도 실패하면 **파일을 하나도 바꾸지 않고**
stderr에 오류를 내고 exit 1이어야 합니다. 가드는 전부 쓰기 **전에** 검사하세요.

## 3. Ponytail — 이미 있는 것을 쓰세요

`actorArguments()`, `readTaskSet()`, `persistTransition()`, `frontmatterValue()`,
`replaceFrontmatterValue()`가 이미 있습니다. `approveTask()`가 세 번째 호출처입니다.
**그대로 재사용하세요.** 새 헬퍼는 **이벤트 조회 하나만** 허용합니다.

**`src/cli.ts` 단일 파일을 유지합니다.** 상한은 330줄입니다(현재 234줄).

- 새 파일을 만들지 마세요. `src/lifecycle.ts`, `src/core/`, `src/util/` 전부 금지입니다
- Transition class, StateMachine class, Command registry, Adapter, Factory,
  전이 정의 테이블, 범용 CLI framework를 만들지 마세요
- **범용 Markdown 파서를 만들지 마세요.** Review에서 읽는 것은 한 줄뿐입니다
- YAML·Markdown 라이브러리를 쓰지 마세요
- 트랜잭션 엔진·롤백·잠금 파일을 만들지 마세요
- 의존성을 추가하지 마세요

330줄을 넘으면 무언가를 과하게 만든 것입니다.

## 4. 기존 동작을 깨뜨리지 마세요

`task start`와 `task submit`의 동작은 **완전히 동일**해야 합니다.
기존 테스트 31개가 전부 통과해야 하고, 두 명령의 정상 전이와 실패 경로를 각각 실행해
회귀가 없음을 확인하세요.

## 5. 테스트 격리 — 가장 중요한 제약

**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 절대 금지입니다.**

각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고, 그 안에
`.bcos/tasks/`, `.bcos/reports/`, `.bcos/reviews/`, `.bcos/events.jsonl`,
`.bcos/state.json` fixture를 직접 생성한 뒤 `spawnSync`의 `cwd`로 실행하세요.

실제 `.bcos/`가 한 바이트라도 바뀌면 이 Task는 실패입니다.

**반드시 넣어야 할 테스트 쌍이 있습니다.** `attempt: 2`인 Task fixture를 만들고,
`events.jsonl`에 attempt 1 submit(actor `worker-a`)과 attempt 2 submit(actor `worker-b`)을
둡니다. 그 상태에서

- `--actor-id worker-a`로 승인 → **exit 0** (이전 attempt actor이므로 SoD 위반 아님)
- `--actor-id worker-b`로 승인 → **exit 1** (현재 attempt actor이므로 SoD 위반)

이 쌍이 "이전 attempt를 잘못 참조하지 않는다"를 증명합니다.

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

그리고 임시 fixture에서 `task start` · `task submit` · `task approve` 정상 전이와
**SoD 차단 1건**을 각각 실행해 결과를 기록하세요.

Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.
`npm install`이 `package-lock.json`을 만들면 삭제하세요.

## 7. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-006-task-approve-command.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-006` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만. SoD 판정을 어떻게 구현했는지 한두 문장으로
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **6번 명령들의 출력 전문 + approve가 append한 실제 이벤트 줄 +
  SoD 차단 결과 + start·submit 회귀 결과**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수, Read List 밖 파일, **완료 후 `src/cli.ts` 줄 수**

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`), 이메일,
로컬 환경값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 8. 절대 하지 말 것

- **`.bcos/tasks/` 와 `.bcos/reviews/` 아래 어떤 파일도 수정하지 마세요.** 읽기 전용입니다
- **이 저장소의 `.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다
- **승인(approve)을 시도하지 마세요.** 명령을 구현하는 것과 실행하는 것은 다릅니다.
  실제 T-006 승인은 독립 reviewer가 합니다
- **git 명령을 실행하지 마세요** — `add`, `commit`, `push`, `checkout` 전부 금지입니다

## 9. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 24개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (45개 이상 pass)
- [ ] attempt 2 SoD 쌍 테스트(이전 actor 통과 / 현재 actor 거부)가 들어 있다
- [ ] `task start`와 `task submit` 회귀가 없음을 직접 실행해 확인했다
- [ ] `src/cli.ts`가 330줄 이하이고 `src/` 아래에 새 파일이 없다
- [ ] 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
