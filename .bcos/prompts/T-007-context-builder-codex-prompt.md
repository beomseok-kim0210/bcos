# T-007 — Worker 실행 프롬프트

> **부트스트랩 산출물이다.** 이 Task가 만드는 `task context`가 동작하면
> 프롬프트가 파일 목록을 나열할 필요가 줄어든다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-007**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-007-context-builder.md` — 작업 명세. **이것이 계약입니다.**
3. `src/cli.ts` — 라우팅 추가 대상. 현재 303줄입니다
4. `tests/cli.test.ts` — 기존 테스트 46개
5. `package.json`
6. `docs/rfcs/RFC-001-task-protocol.md` — 파일 전문. **Appendix는 읽지 않습니다**
7. `.bcos/tasks/T-004-task-submit-command.md` — **읽기 전용.** fixture 형식 확인용

이 프롬프트 파일도 Read List에 포함되어 있습니다.

**위 목록 외의 파일은 읽지 마세요.** Appendix, `CLAUDE.md`, `README.md`,
`docs/architecture.md`, `docs/benchmarks/`, `.bcos/reviews/`, 다른 Task 파일 모두
읽지 마세요. 저장소 전체 탐색(`ls -R`, 전역 grep)도 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇을 만드는가

```
node dist/cli.js task context <id>
```

Task의 **Read List에 적힌 파일들을 결정론적으로 조립해 stdout으로 출력**합니다.

이 명령은 **상태를 바꾸지 않습니다.** Task·events·state 어느 것도 건드리지 않고
읽기만 합니다. lifecycle 명령이 아니라 파생 산출물 생성기입니다.

**핵심 요구는 결정성입니다.** 같은 입력이면 stdout이 **바이트 단위로 같아야** 합니다.
그래서 타임스탬프를 패키지에 넣지 않습니다.

정확한 추출 규칙·출력 형식·검증 8종은 Task 문서에 있습니다. 그대로 따르세요.

**특히 주의할 세 가지입니다.**

- **경로는 각 `- ` 항목의 첫 백틱 쌍 안 문자열**입니다. 뒤에 붙은 한국어 주석
  (`(이 파일)`, `— **읽기만.**`, `§1, §2만`)은 경로가 아닙니다
- **`§` 범위를 해석하지 마세요.** 파일 전문을 출력합니다. 주석은 메타데이터 `note`로만 보존합니다
- **모든 검증을 통과한 뒤에 출력을 시작하세요.** 파일 하나라도 실패하면
  **stdout에 아무것도 쓰지 않고** exit 1입니다. 부분 출력은 실패입니다

## 3. 새 파일을 하나 만듭니다

**`src/context.ts` 하나만 만드세요.**

`src/cli.ts`는 303줄이고 T-006이 정한 분리 트리거가 400줄입니다. Context 조립은
상태 전이와 다른 책임이므로 이번에 나눕니다.

- `src/cli.ts` — 인자 라우팅과 stdout 출력만
- `src/context.ts` — Read List 추출 · 검증 · 조립만. **함수를 export**합니다

**여기까지입니다.**

- `ContextBuilder` class, Provider, Adapter, Factory, Plugin 구조를 만들지 마세요
- `src/util/`, `src/core/`, 두 번째 새 파일을 만들지 마세요
- **범용 Markdown 파서를 만들지 마세요.** 라벨 하나 찾고 `- ` 줄에서 백틱 안을 꺼내면 됩니다
- 후속 Runner를 위한 인터페이스를 미리 설계하지 마세요
- 의존성을 추가하지 마세요
- **`git` 명령을 호출하지 마세요.** 추적 여부를 확인할 필요가 없습니다 —
  Read List 자체가 허용 목록입니다

## 4. 기존 동작을 깨뜨리지 마세요

`task start` · `task submit` · `task approve`의 동작은 **완전히 동일**해야 합니다.
기존 테스트 46개가 전부 통과해야 하고, 세 명령의 정상 전이와 실패 경로를 각각 실행해
회귀가 없음을 확인하세요.

## 5. 테스트 격리 — 가장 중요한 제약

**이 저장소의 실제 `.bcos/`나 실제 소스 파일을 읽거나 쓰는 테스트는 절대 금지입니다.**

각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고 fixture를 생성한 뒤
`spawnSync`의 `cwd`로 실행하세요. stdout·stderr·exit code를 **분리해서** 검증합니다.

**실제 형식 fixture를 반드시 넣으세요.**
`.bcos/tasks/T-004-task-submit-command.md`와 `docs/rfcs/RFC-001-task-protocol.md`를
임시 디렉터리로 **복사해서** fixture로 씁니다. 저장소 파일을 직접 읽는 테스트가 아닙니다.

T-005에서 합성 fixture만 써서 실제 형식을 한 번도 검증하지 못한 사례가 있었습니다.
같은 실수를 반복하지 마세요.

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

그리고 임시 fixture에서 다음을 확인하세요.

- 정상 생성 1회 — 패키지 헤더 전문을 기록
- **같은 입력 2회 실행 — stdout 해시가 같은지**
- 실패 경로 1건 — stdout이 비어 있는지
- `task start` · `submit` · `approve` 정상·실패 각 1건

Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.
`npm install`이 `package-lock.json`을 만들면 삭제하세요.

## 7. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-007-context-builder.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-007` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

- `Implemented` — 사실만. 추출과 검증을 어떻게 나눴는지 한두 문장으로
- `Files Changed` — 경로 + (new | modified | deleted)
- `Test Evidence` — **6번 명령 출력 전문 + 패키지 헤더 + 해시 일치 결과 +
  실패 시 stdout 공백 확인 + lifecycle 회귀 결과**
- `Deviations` — 없으면 `None`
- `Known Risks` — 없으면 `None`
- `Context Used` — 읽은 파일 수, Read List 밖 파일,
  **완료 후 `src/cli.ts`와 `src/context.ts` 줄 수**

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`), 이메일,
로컬 환경값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 8. 절대 하지 말 것

- **`.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다
- **`task context`가 어떤 파일도 쓰지 않게 하세요.** 읽기 전용 명령입니다
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — 구현 안에서도, 셸에서도 금지입니다

## 9. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 32개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (65개 이상 pass)
- [ ] 같은 입력 2회 실행의 stdout 해시가 같다
- [ ] 실패 경로에서 stdout이 비어 있다
- [ ] 실제 T-004와 RFC-001 형식을 복사한 fixture 테스트가 들어 있다
- [ ] `task start` · `submit` · `approve` 회귀가 없음을 직접 실행해 확인했다
- [ ] `src/`에 `cli.ts`와 `context.ts` 두 파일만 있고 하위 디렉터리가 없다
- [ ] 변경 파일이 `src/cli.ts`, `src/context.ts`, `tests/cli.test.ts`, Report 4개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
