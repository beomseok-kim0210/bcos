---
task: T-008
---

# Review — T-008

## Attempt 1 — 2026-08-06T04:28:21Z — APPROVED

### Verification Method

Worker Report를 신뢰하지 않고 Reviewer 자신의 fixture를 만들어 독립 검증했다.
`os.tmpdir()` 아래에 저장소 fixture와 가짜 worker `.js`를 만들고, 컴파일된
`dist/cli.js`를 `cwd` 옵션으로 실행해 **88개 항목**을 확인했다. 실패 경로마다
`.bcos/` 전체를 재귀 해시로 스냅샷해 실행 전후를 대조했다.

이 저장소의 실제 `.bcos/`는 Review 과정에서 읽기만 했다.

### Lifecycle

| | |
|---|---|
| `TASK_STARTED` | `2026-08-06T04:13:25.276Z` |
| `TASK_SUBMITTED` | `2026-08-06T04:21:06.265Z` |

**사후 복구 흔적이 없다.** 밀리초가 `.276` / `.265`로 임의값이고 두 이벤트 간격이
약 7분 41초이며, Report의 Attempt 시각 `04:20:03Z`가 두 이벤트 사이에 든다.
T-004 이후 유지된 실시간 기록이 T-008에서도 지켜졌다.

### Acceptance Criteria

**46 / 46 충족.** 전부 Reviewer가 직접 관측했다.

| 묶음 | 결과 |
|---|---|
| dry-run (2–13) | 12/12 — 요약 항목 전부 출력, stdin 본문 미출력, 2회 해시 동일, 무변경 |
| worker 실행 (14–20) | 7/7 — 수신 해시 일치, cwd·stdout·stderr·exit·시간·바이트 |
| 실패 경로 (21–34) | 14/14 — 15종 전부 exit 1, `.bcos/` 해시 동일, stdout 0바이트 |
| lifecycle 불변 (35–39) | 5/5 — `events.jsonl` 줄 수 불변, 4개 명령 회귀 통과 |
| 구조·품질 (1, 40–46) | 8/8 |

### Independent Verification

**성공 경로 — 28/28**

가짜 worker가 수신한 stdin의 SHA-256이 dry-run이 보고한 해시와 **완전히 일치**했다.
조립한 것과 전달한 것이 같은 바이트임이 증명된다.

stdin 본문을 별도 fixture로 덤프해 내용을 직접 확인했다 — `task: T-500`,
`worker: codex`, Report 경로, 금지 지시 3종("임의로 열지 마라" / "git 명령을 실행하지
마라" / "어떤 bcos 명령도 실행하지 마라"), Prompt 본문 마커 **정확히 1회**,
Context Package 헤더 **정확히 1회**, Read List 파일의 실제 내용 포함, 타임스탬프 없음.

worker argv는 `["exec", "-", "--cd", <root>]`였다. **Task ID는 argv에 없다.**
cwd는 fixture 루트였다.

**결정성** — 같은 입력으로 dry-run을 두 번 실행해 stdin SHA-256이 동일했다.
실제 저장소의 `task context T-007`도 2회 실행해 동일 해시를 확인했다
(`9f0d36dd2cd5bc5a…`).

**실패 경로 — 60/60**

Prompt 없음 · Prompt 2개 · 구분자 없음 · 빈 본문 · Task 없음 · status 아님 ·
worker allow list 위반 · `--worker` 누락 · Context 생성 실패 · worker-command 없음 ·
timeout 0/음수/소수/비숫자 · 알 수 없는 옵션 · exec 실패(디렉터리 지정) —
**15종 전부 exit 1이고 stdout이 0바이트이며 `.bcos/` 해시가 동일했다.**

**partial write는 한 건도 관측되지 않았다.**

fake worker `exit 1` / `exit 3` 모두 그 코드가 그대로 전파됐고 stderr에
`Worker failed with exit code`가 나와 BCOS 자체 오류와 구분된다.
`--timeout 1`에 10초 대기 worker를 붙이자 8초 이내에 종료되고 exit 1로 실패했다.

**셸 주입** — Task ID로 `T-500 & echo PWNED > pwned.txt`를 넘겼다.
exit 1, `pwned.txt` 미생성, `PWNED` 출력 없음. **argv에 Task ID를 넣지 않은 설계가
실제로 방어한다.**

**실제 Codex 미호출 — 결정적으로 확인했다.** `PATH`에서 `@openai/codex/bin/codex.js`를
포함한 디렉터리를 전부 제거하고 전체 테스트를 재실행해 **90/90 pass**했다.
어떤 테스트도 실제 Codex에 의존하지 않는다.

**Lifecycle 회귀 — 18/18** (Reviewer 자체 fixture)

`start` 정상·실패, `submit` 정상·Report 없음 거부(G3), `approve` 정상·Review 없음
거부(G4)·**SoD 위반 거부(G5)**, `context` 정상·실패. 거부된 전이는 status와 이벤트
수를 바꾸지 않았다.

### Test Suite

Reviewer가 직접 실행해 **90 pass / 0 fail**, exit 0. 기존 66개 중 삭제된 테스트는
**0건**이고 신규 24개가 추가됐다. 테스트는 `mkdtempSync(os.tmpdir())` fixture에서만
동작하며 저장소의 실제 `.bcos/`를 참조하지 않는다.

Report가 주장한 줄 수도 실측과 일치했다 — `src/cli.ts` 358, `src/context.ts` 165,
`src/runner.ts` 206.

### Ponytail

**위반 없음.**

`WorkerAdapter` · `CodexAdapter` · Provider · Factory · Plugin · Queue · Retry ·
Process manager 추상화가 **하나도 없다.** `src/runner.ts`는 함수 5개를 export 없이
두고 `runCodexWorker` 하나만 내보낸다. class가 없다.

`src/context.ts`는 **한 줄도 바뀌지 않았고** `buildContextPackage()`를 호출만 한다.
`src/`에는 여전히 세 파일뿐이고 하위 디렉터리가 없다. `dependencies` 키가 없고
`devDependencies`는 2개 그대로다. `package-lock.json`이 없다.

`shell: true` · `cmd /c` · 명령 문자열 조립이 소스에 없다. 코드에 남은 `.exec(`는
전부 `RegExp.prototype.exec`다.

### Findings

**F-1 — 기본 timeout이 없다 (Non-blocking, Major)**

`--timeout`을 생략하면 타이머를 걸지 않는다(`src/runner.ts:163`). Codex가 멈추면
Runner가 무한 대기한다.

**이것은 worker의 결함이 아니라 Task 문서의 결함이다.** 설계 보고에서는 "기본 10분"을
명시했으나 **Task 문서에 그 문장을 옮기지 않았다.** AC 21은 "`--timeout`을 넘기면"만
요구하므로 구현은 명세를 정확히 따랐다. 명세를 쓴 쪽의 누락이다.

T-009에서 기본값을 정해 보완한다. AC 위반이 아니므로 승인을 막지 않는다.

**F-2 — `--help`에서 actor 플래그가 사라졌다 (Non-blocking, Minor)**

`src/cli.ts:353`. 이전 문자열은 `--actor-role <role> --actor-id <id>`를 포함했으나
새 문자열에는 없다. 이 플래그는 `start`·`submit`·`approve`에 **필수**여서 help만 보고는
명령을 완성할 수 없다.

`run`은 다른 플래그를 쓰므로 한 줄에 모두 담기 어려웠던 사정은 이해된다. AC 40은
exit 0만 요구하므로 위반은 아니다. 명령별 usage가 필요해지는 시점의 신호로 기록한다.

**F-3 — `frontmatterValue`가 3중 복제됐다 (Informational)**

`src/cli.ts:25` · `src/context.ts:28` · `src/runner.ts:31`. 각각 5줄 안팎이고
구현이 조금씩 다르다(`cli.ts`는 문서 전체, 나머지 둘은 frontmatter 블록 한정).

지금 공용 모듈로 뽑으면 파일이 하나 늘고 세 호출부가 결합된다. **현 시점에서는
중복이 더 싸다.** 네 번째 복사가 생기거나 파싱 규칙이 갈라지면 그때 추출한다.

**F-4 — timeout 시 손자 프로세스가 남을 수 있다 (Informational)**

`child.kill()`은 직계 자식만 종료한다. 실제 Codex가 하위 프로세스를 띄운 뒤
timeout이 걸리면 그것들이 남을 수 있다. 가짜 worker로는 재현되지 않아 관측하지 못했다.

Report의 `Known Risks`가 `None`인데 이 항목은 적을 만했다. 실제 Codex 실행이
처음 일어나는 시점에 확인할 대상이다.

### Reviewer Artifacts

Review 과정에서 `dist/`를 재빌드했다. `dist/`는 Git이 추적하지 않으므로 커밋에
포함되지 않는다. `package-lock.json`은 생성되지 않았다.

Reviewer fixture는 전부 `os.tmpdir()` 아래에 만들었고 저장소에 남기지 않았다.

### Sensitive Information

Report · `src/runner.ts` · `src/cli.ts` · `tests/cli.test.ts` 전부 **0건**.
개인 홈 경로·계정명·이메일·환경 변수 값이 없다. Report는 dry-run 요약의 경로를
`<node>` · `<fixture-root>`로 일반화했다.

### Verdict

**APPROVED**

AC 46개 전부, Reviewer 독립 검증 88개 전부, lifecycle 회귀 18개 전부 통과했다.
실패 경로 15종에서 partial write가 없고, 셸 주입이 실제로 차단되며, 조립한 stdin이
바이트 단위로 그대로 전달됨을 해시로 확인했다.

발견 4건은 모두 승인을 막지 않는다. F-1은 명세를 쓴 쪽의 누락이고, 나머지는
정보성이다.
