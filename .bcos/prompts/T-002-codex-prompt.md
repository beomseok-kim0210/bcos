# T-002 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** `bcos task show`가 동작하면 이 파일과 `.bcos/prompts/`는 삭제한다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-002**입니다. 이것은 신규 기능이 아니라 **한 줄짜리 유지보수**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-002-align-node-version.md` — 작업 명세. **이것이 계약입니다.**
3. `package.json`, `README.md` — 수정 대상
4. `tests/cli.test.ts` — **읽기만.** 수정 금지
5. `docs/rfcs/RFC-001-task-protocol.md` **§3만** — Report 포맷

**위 목록 외의 파일은 읽지 마세요.**

- `docs/rfcs/RFC-001-task-protocol-appendix.md`를 **읽지 마세요.**
- `CLAUDE.md`, `docs/architecture.md`, `docs/vision.md`, `.bcos/reviews/`, `docs/benchmarks/`를
  **읽지 마세요.**
- `src/cli.ts`를 읽을 필요가 없습니다. 이 Task는 소스를 건드리지 않습니다.
- 저장소 전체 탐색(`ls -R`, 전역 grep)을 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 할 일 — 이것이 전부입니다

**`package.json`**

```
"engines": { "node": ">=22" }   →   "engines": { "node": ">=24" }
```

**`README.md`**

Node 요구사항 문장을 24 이상으로 고칩니다. `package.json`과 모순되지 않으면 됩니다.

**끝입니다.** 다른 변경은 없습니다.

## 3. 배경 (왜 이 변경인가)

`npm test`는 `node --test tests/cli.test.ts`로 `.ts` 파일을 직접 실행합니다.
이는 Node의 type stripping에 의존하는데, Node 22.18 미만에서는 기본 비활성입니다.
따라서 `>=22` 선언은 실제로 동작하지 않는 버전을 포함합니다.
검증된 환경은 Node v24.11.1 하나뿐이므로 선언을 `>=24`로 좁힙니다.

## 4. Ponytail — 유혹을 억제하세요

**이 Task는 2줄 변경입니다.** 그보다 커지면 잘못 가고 있는 것입니다.

다음이 눈에 보여도 **고치지 마세요.** 전부 T-002의 Out of Scope입니다.

- `tests/cli.test.ts`에 TypeScript 문법이 없으니 `.js`로 이름을 바꾸면 Node 22를 살릴 수 있다
  → **하지 마세요.** 파일명 변경도 금지입니다
- `@types/node`가 `^22.0.0`인데 engines는 24다
  → **버전을 올리지 마세요.** 기존 devDependency 변경도 금지입니다
- 테스트 러너나 `tsx`를 쓰면 더 깔끔하다 → **의존성 추가 금지입니다**
- CI 매트릭스를 추가하면 여러 Node를 검증할 수 있다 → **범위 밖입니다**

**`npm install` 실행 시 `package-lock.json`이 생기면 커밋 대상이 아닙니다.**
생성되었다면 삭제하거나, 삭제가 곤란하면 Report의 `Deviations`에 기록하세요.

## 5. 검증할 것

변경 후 다음을 **실제로 실행**하고 출력을 저장하세요.

```
npm install
```
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

마지막 명령은 stderr에 메시지를 내고 **exit code 1**이어야 합니다.
Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.

## 6. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-002-align-node-version.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-002` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **5번에서 실행한 6개 명령의 출력 전문**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — **읽은 파일 수**와 **Read List 밖에서 읽은 파일**을 정확히 적으세요.
  이 수치가 벤치마크 기준선이 됩니다. 추정하지 말고 실제로 연 파일을 세세요

## 7. 절대 하지 말 것

- **`.bcos/tasks/T-002-align-node-version.md`를 수정하지 마세요.** 읽기 전용입니다
- **Task의 `status`나 `attempt`를 직접 바꾸지 마세요**
- **`.bcos/state.json`과 `.bcos/events.jsonl`을 건드리지 마세요**
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — `add`, `commit`, `push`, `checkout` 전부 금지입니다

## 8. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 11개가 **모두** 충족됐다
- [ ] 6개 검증 명령이 실제로 실행됐고 전부 통과했다
- [ ] 변경 파일이 `package.json`, `README.md`, Report 3개뿐이다
- [ ] `package-lock.json`이 생성되지 않았다
- [ ] `Out of Scope` 항목을 하나도 건드리지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
