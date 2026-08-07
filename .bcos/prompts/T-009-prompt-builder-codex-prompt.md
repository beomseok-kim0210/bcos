# T-009 — Worker 실행 프롬프트

> **마지막으로 손으로 쓰는 프롬프트다.** 이 Task가 끝나면 Runner가 preamble을
> 직접 만들고, 이 파일 같은 것을 Task마다 쓸 필요가 없어진다.
> 아래 `---` 사이의 내용을 그대로 복사해 Codex CLI 세션에 붙여넣는다.

---

당신은 BCOS 저장소의 **worker**입니다. `actor_role: worker`, `actor_id: codex-cli`.

작업 대상은 **T-009**입니다. 이 저장소는 **공개(public) GitHub 저장소**입니다.

## 1. 먼저 읽을 것 (이 순서로)

1. `AGENTS.md` — 당신의 행동 규칙. **끝까지 읽으세요.**
2. `.bcos/tasks/T-009-prompt-builder.md` — 작업 명세. **이것이 계약입니다.**
3. `src/runner.ts` — 유일한 수정 대상. 현재 206줄입니다
4. `docs/benchmarks/TELEMETRY.md` — **읽기 전용.** 출력할 키의 정의입니다
5. `src/cli.ts` — **읽기 전용.** 라우팅은 이미 끝났습니다
6. `src/context.ts` — **읽기 전용.** `buildContextPackage()`를 호출만 합니다
7. `tests/cli.test.ts` — 기존 테스트 90개
8. `package.json`

**이 프롬프트 파일은 Read List에 없습니다.** 이 내용이 이미 당신에게 전달됐기
때문입니다. Read List에까지 넣으면 같은 글이 두 번 들어갑니다.

**위 목록 외의 파일은 읽지 마세요.** `README.md`, `CLAUDE.md`, RFC, ADR,
다른 Task 파일, `.bcos/prompts/`의 다른 파일, `.bcos/reviews/` 모두 읽지 마세요.
저장소 전체 탐색(`ls -R`, 전역 grep)도 하지 마세요.

읽어야만 했던 파일이 생기면 Report의 `Deviations`에 기록하세요.

## 2. 무엇을 하는가 — 대부분 삭제입니다

지금 Runner는 `.bcos/prompts/<id>-*.md`를 찾아 `---` 사이 본문을 꺼내 씁니다.
**그 코드를 전부 지웁니다.**

대신 **고정 preamble**을 만듭니다. 값이 들어가는 자리는 셋뿐입니다 — Task ID,
worker 이름, Report 경로. 나머지 줄은 모든 Task에서 글자 하나까지 같습니다.

**왜 지워도 되는가** — worker는 Context Package로 Task 문서 전문과 `AGENTS.md`를
이미 받습니다. 손으로 쓴 프롬프트는 그것을 다시 요약한 사본이었습니다.

정확한 preamble 문구는 Task 문서 §Scope에 있습니다. **그대로 쓰세요.**

## 3. 절대로 만들지 마세요

- **템플릿 엔진 · 플레이스홀더 문법 · 조건 분기 · 반복 구문**
  preamble은 **상수 문자열과 값 3개의 연결**입니다. `${}` 세 개면 끝납니다
- **Task 문서 파싱** — Scope나 AC를 뽑아 프롬프트에 옮기지 마세요.
  Task 문서는 Context Package 안에 전문 그대로 들어갑니다
- **Prompt 파일 fallback** — "파일이 있으면 그걸 쓴다"를 만들지 마세요. 출처는 하나입니다
- **새 명령** (`task prompt` 등) — preamble이 상수라 미리 볼 이유가 없습니다
- **새 소스 파일** — `src/`는 `cli.ts` · `context.ts` · `runner.ts` 셋을 유지합니다
- `src/context.ts` · `src/cli.ts` 수정 — **둘 다 읽기 전용입니다**
- 의존성 추가

**`.bcos/prompts/` 디렉터리를 지우지 마세요.** 여덟 Task의 기록입니다.
읽지 않을 뿐 남겨둡니다.

## 4. 기본 timeout 1,800초

지금은 `--timeout`을 생략하면 타이머가 없어 멈춘 worker를 무한히 기다립니다.
기본값을 **1,800초**로 둡니다.

실측된 Task 소요는 437 · 461 · 670 · **1,037초**였습니다. 600초를 기본값으로 두면
정상 작업이 죽습니다. `--timeout`으로 언제든 덮어쓸 수 있습니다.

**0 · 음수 · 소수 · 비숫자는 여전히 exit 1입니다.** 잘못된 값이 기본값으로
조용히 대체되면 안 됩니다.

## 5. 새 가드 하나

Task의 Read List에 **Task 파일 자신이 없으면 실패**시킵니다.

Task 문서가 Context에 없으면 worker에게 계약이 전달되지 않습니다. 지금까지 여덟 Task가
전부 자기 자신을 넣었지만, 그건 관행이었을 뿐 강제된 적이 없습니다.

Context Package 본문에서 Task 파일 경로를 찾지 못하면 exit 1입니다.
**무엇이 빠졌는지 메시지에 적으세요.**

## 6. Telemetry — 출력만 합니다

`docs/benchmarks/TELEMETRY.md`에 정의된 키를 **그대로** 씁니다. 키를 새로 만들지 마세요.

한 줄에 하나, `telemetry ` 접두어를 붙입니다. 형식은 Task 문서 §Scope에 있습니다.

**절대 하지 마세요.**

- 파일·JSON·DB에 쓰기 — **출력만 합니다.** 저장은 T-012의 일입니다
- 비율·개선율·절감률 계산 — `_rate` · `_ratio` · `efficiency` · `improvement` ·
  `savings` · `reduction` 이라는 문자열이 소스에 있으면 이 Task는 실패입니다
- 토큰·비용 수집 — worker 출력을 해석해야 합니다. T-010입니다
- dry-run에서 실행 관련 필드를 0으로 채우기 — **없는 값과 0은 다릅니다.**
  출력하지 마세요

`first_worker_response_ms`는 **첫 stdout 또는 stderr chunk가 도착한 시각**입니다.
close 시각이 아닙니다.

## 7. 코드가 줄어야 합니다

`src/runner.ts`는 지금 206줄입니다. **250줄을 넘기지 마세요** (AC 48).

프롬프트 탐색·본문 추출·정규식이 사라지고 상수 preamble과 Telemetry 출력이
들어옵니다. 삭제가 추가와 비슷하거나 더 커야 정상입니다.

250줄을 넘길 것 같으면 **무언가를 과하게 만들고 있는 것입니다.** 멈추고 보고하세요.

## 8. 기존 테스트를 고쳐야 합니다

T-008의 세 테스트는 **동작이 반대로 바뀝니다.**

- "Prompt 없음 → exit 1" → 이제 정상 동작입니다
- "Prompt 2개 → exit 1" → 이제 무시합니다
- "Prompt 본문 비어 있음 → exit 1" → 이제 해당 없음입니다

삭제하든 새 기대값으로 바꾸든 좋습니다. **어떤 테스트를 왜 바꿨는지 Report에 적으세요.**
그 밖의 기존 테스트는 건드리지 마세요.

## 9. 테스트 — 실제 Codex를 절대 호출하지 마세요

임시 디렉터리에 **가짜 worker `.js` 파일**을 만들고 `--worker-command`로 가리키세요.

이번에 필요한 새 능력 — **지정한 시간만큼 기다렸다가 첫 출력**을 하는 worker.
`first_worker_response_ms`를 검증하려면 이게 있어야 합니다.

**이 저장소의 실제 `.bcos/`나 실제 소스를 읽거나 쓰는 테스트는 금지입니다.**
실패 경로마다 fixture `.bcos/` 해시가 실행 전후 동일한지 확인하세요.

## 10. 검증할 것

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

- dry-run 요약 전문과 `telemetry` 줄
- 실제 실행의 `telemetry` 줄 전문
- **서로 다른 두 Task의 preamble 차이가 값 3개뿐**임을 보이는 비교
- dry-run 2회 stdin SHA-256 일치
- 2초 지연 worker에서 `first_worker_response_ms` > 1000
- Read List 자기 미포함 → exit 1
- `task start` · `submit` · `approve` · `context` 정상·실패 각 1건

Windows PowerShell 5.1에서 실행되므로 `&&` 체이닝을 쓰지 마세요.
`npm install`이 `package-lock.json`을 만들면 삭제하세요.

## 11. Report 작성

**정확히 이 경로에** 작성하세요.

```
.bcos/reports/T-009-prompt-builder.md
```

포맷은 `AGENTS.md` §4를 따릅니다. frontmatter는 `task: T-009` 하나입니다.
본문은 `## Attempt 1 — <RFC 3339 시각>` 아래에 6개 H3 섹션을 둡니다.

`Context Used`에 읽은 파일 수, Read List 밖 파일,
**완료 후 `src/runner.ts` 줄 수와 206줄 대비 증감**을 반드시 적으세요.

`Files Changed`에 **바꾼 기존 테스트와 그 이유**를 적으세요.

**이 저장소는 공개됩니다.** Report에 개인 홈 경로(`C:\Users\<계정명>\...`), 이메일,
환경 변수 값을 남기지 마세요. 경로가 필요하면 `C:\path\to\bcos`처럼 일반화하세요.

## 12. 절대 하지 말 것

- **`.bcos/` 하위 파일을 수정하지 마세요.** Report 작성만 예외입니다
- **`.bcos/prompts/`를 삭제하지 마세요**
- **Runner가 lifecycle 전이를 일으키지 않게 하세요.** 이벤트는 늘어나면 안 됩니다
- **승인(approve)을 시도하지 마세요.** 독립 reviewer가 검토합니다
- **git 명령을 실행하지 마세요** — 구현 안에서도, 셸에서도 금지입니다
- **실제 Codex를 실행하지 마세요** — 테스트에서도, 수동 확인에서도 금지입니다
- **`docs/benchmarks/TELEMETRY.md`를 수정하지 마세요** — 읽기 전용입니다

## 13. 완료 조건

다음이 전부 참일 때만 "완료했다"고 보고하세요.

- [ ] Acceptance Criteria 62개가 **모두** 충족됐다
- [ ] `npm run build`와 `npm test`가 실제로 실행됐고 통과했다 (95개 이상 pass)
- [ ] `.bcos/prompts/`가 비어 있어도 dry-run이 exit 0이다
- [ ] 두 Task의 preamble 차이가 값 3개뿐이다
- [ ] dry-run 2회의 stdin SHA-256이 같다
- [ ] `telemetry` 키가 `TELEMETRY.md` 정의와 정확히 일치한다
- [ ] 소스에 비율 계열 문자열이 0건이다
- [ ] Telemetry가 어떤 파일에도 기록되지 않는다
- [ ] 기본 timeout 1,800초가 동작하고 잘못된 값은 여전히 거부된다
- [ ] `src/runner.ts`가 250줄 이하다
- [ ] `src/`에 세 파일만 있고 하위 디렉터리가 없다
- [ ] 변경 파일이 `src/runner.ts`, `tests/cli.test.ts`, Report 3개뿐이다
- [ ] 이 저장소의 실제 `.bcos/` 내용이 변경되지 않았다
- [ ] `package-lock.json`이 없다
- [ ] `Out of Scope` 항목을 하나도 만들지 않았다

하나라도 아니면 완료라고 하지 말고, 무엇이 막혔는지 보고하세요.
**추측해서 진행하는 것보다 멈추는 것이 항상 낫습니다.**

작업을 마치면 Report를 작성하고 **멈추세요.**

---
