# T-001 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** `bcos task show`가 동작하면 이 파일과 `.bcos/prompts/`는 삭제한다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-001**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-001-project-scaffold.md` — 작업 명세. **이것이 계약입니다.**
3. `docs/rfcs/RFC-001-task-protocol.md` **§3만** — Report 포맷
4. `docs/decisions/ADR-001-language.md` — 언어·런타임 결정

**위 4개 외의 파일은 읽지 마세요.**

- `docs/rfcs/RFC-001-task-protocol-appendix.md`를 **읽지 마세요.** 비규범 문서입니다.
- `docs/architecture.md`, `docs/vision.md`, `docs/v0.1-scope.md`, `CLAUDE.md`를 **읽지 마세요.**
- 저장소 전체 탐색(`ls -R`, 전역 grep)을 하지 마세요.

읽어야만 했던 파일이 생기면 그 사실을 Report의 `Deviations`에 기록하세요.
**읽은 파일 수가 이 실험의 측정 대상입니다.**

## 2. 만들 것

T-001의 `Expected Files` 목록에 있는 5개 파일만 생성합니다.

```
package.json
tsconfig.json
src/cli.ts
tests/cli.test.ts
README.md
```

**목록 밖의 파일을 만들거나 수정하지 마세요.**
필요해지면 만들지 말고 **작업을 멈추고 그 사실을 보고하세요.**

## 3. Ponytail — 최소 구현을 선택하세요

**Acceptance Criteria를 만족하는 가장 단순한 코드**를 쓰세요. 그 이상은 리뷰에서 거부됩니다.

- 처리할 인자는 `--version`과 `--help` 둘뿐입니다. **범용 인자 파서를 만들지 마세요.**
  `process.argv[2]` 직접 비교로 충분합니다.
- 표준 라이브러리로 되는 것을 직접 구현하지 마세요.
- 런타임 의존성을 추가하지 마세요. devDependency는 `typescript`와 `@types/node`만 허용됩니다.
- 구현체가 하나뿐인 Interface, 사용처가 하나뿐인 Factory·Manager·Wrapper·Service,
  Plugin System, Cache, 미래용 Adapter를 **만들지 마세요.**
- 관련 없는 리팩터링을 하지 마세요.

**동작이 정확해도 더 단순한 대안이 명확하면 `CHANGES_REQUESTED`를 받습니다.**

T-001의 `Out of Scope`에 있는 것을 만들면 **이 Task는 실패로 판정됩니다.**
특히 `writeFileAtomic` 같은 파일 쓰기 유틸리티를 만들지 마세요 — 이 Task는 파일을 쓰지 않습니다.

## 4. 검증할 것

구현 후 다음을 **실제로 실행**하세요. 출력을 저장하세요.

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

Windows PowerShell 5.1에서 실행되므로 npm 스크립트에 `&&` 체이닝을 쓰지 마세요.

## 5. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-001-project-scaffold.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-001` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만. 평가나 정당화가 아닙니다
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **4번에서 실행한 명령의 출력 전문.** "통과했다"는 문장은 증거가 아닙니다
- `Deviations` — 명세와 다르게 한 것. 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수 / Expected Files 밖에서 읽은 파일

## 6. 절대 하지 말 것

- **`.bcos/tasks/T-001-project-scaffold.md`를 수정하지 마세요.** Task 파일은 읽기 전용입니다.
- **Task의 `status`나 `attempt`를 직접 바꾸지 마세요.** 상태 전이는 당신의 권한이 아닙니다.
- **`.bcos/state.json`과 `.bcos/events.jsonl`을 건드리지 마세요.**
- **승인(approve)을 시도하지 마세요.** 당신이 제출한 것을 당신이 승인할 수 없습니다.
  독립 reviewer가 검토합니다.
- **git commit이나 push를 하지 마세요.**

## 7. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 9개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다
- [ ] 변경 파일이 `Expected Files` 5개 범위 안에 있다
- [ ] Report에 실행 출력이 붙어 있다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.** 다음 작업으로 넘어가지 마세요.

---
