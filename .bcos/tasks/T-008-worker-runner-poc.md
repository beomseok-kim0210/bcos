---
protocol: "0.1"
id: T-008
title: Run a Codex worker with the assembled context package
status: TODO
attempt: 0
created: 2026-08-06T03:34:59Z
updated: 2026-08-06T03:34:59Z
---

## Objective

T-007이 Context Package를 결정론적으로 만들었다. 그러나 **사람이 그것을 복사해
Codex에 붙여넣는다.** Human handoff가 4단계에서 2단계로 줄었을 뿐 0이 아니다.

```
node dist/cli.js task run T-008 --worker codex
```

이 명령은 Context Package와 Worker Prompt를 조립해 **Codex 프로세스의 stdin으로 넘긴다.**
사람이 복사하는 단계가 사라진다.

**Runner는 lifecycle을 소유하지 않는다.** `start`·`submit`·`approve`를 대신 실행하지 않고,
Codex의 출력을 해석하지 않으며, 작업이 끝났는지 판단하지 않는다.
**입력을 전달하고 출력을 그대로 통과시킬 뿐이다.**

이 Task가 제거하는 수동 단계는 **정확히 하나** — Context Package 복사·붙여넣기다.

## Scope

`src/runner.ts`를 새로 만들고 `src/cli.ts`에서 라우팅한다.

- [ ] `task run <id> --worker codex [--dry-run] [--timeout <seconds>] [--worker-command <path>]` 파싱
- [ ] Task를 찾고 `status`가 `IN_PROGRESS`인지 확인한다
- [ ] `.bcos/prompts/<id>-*.md` 를 찾아 **정확히 1개**인지 확인한다
- [ ] Prompt의 **첫 두 `---` 줄 사이 본문**을 꺼낸다
- [ ] `src/context.ts`의 `buildContextPackage()`를 **그대로 재사용**해 Context를 만든다
- [ ] stdin 입력을 조립한다
- [ ] `--dry-run`이면 요약만 출력하고 프로세스를 실행하지 않는다
- [ ] 아니면 Codex 프로세스를 실행하고 stdin을 쓴다
- [ ] child stdout·stderr를 부모로 흘려보내며 **바이트 수만 센다**
- [ ] exit code와 실행 시간을 보고한다

**Codex 실행 방식**

`codex exec` 는 비대화형 실행을 지원하며, PROMPT 인자를 `-`로 주면 **stdin에서 지시를 읽는다**
(`codex exec --help` 확인, codex-cli 0.146.0).

Windows에서 `codex`는 `.cmd` 셸 shim이고 Node는 `shell:false`로 `.cmd`를 실행할 수 없다.
셸을 켜는 대신 **`process.execPath`로 Codex의 JS 엔트리를 직접 실행한다.**
shim이 `node <basedir>/node_modules/@openai/codex/bin/codex.js "$@"` 를 실행하므로 동등하다.

```
spawn(process.execPath,
      [<codex.js>, "exec", "-", "--cd", <repo root>],
      { shell: false, cwd: <repo root> })
```

**Codex JS 엔트리 탐색**

1. `--worker-command <path>` 가 주어지면 그 경로를 쓴다. 존재하지 않으면 실패한다
2. 아니면 `process.env.PATH`의 각 디렉터리에서
   `node_modules/@openai/codex/bin/codex.js` 존재를 확인해 **첫 매치**를 쓴다
3. 못 찾으면 실패한다

**셸을 호출하지 않는다.** `PATH`는 문자열 분할과 `existsSync`로만 다룬다.

**`--sandbox`를 지정하지 않는다.** Codex의 설정 기본값을 그대로 쓴다.
Runner가 샌드박스 정책을 임의로 완화하지 않는다.

**stdin 조립 형식**

```
BCOS WORKER EXECUTION

task: <id>
worker: <worker>
report: .bcos/reports/<id>-<slug>.md

이 입력은 BCOS가 조립했다. CONTEXT PACKAGE 안의 파일이 네가 읽어야 할 전부다.
그 목록 밖의 파일을 임의로 열지 마라. git 명령을 실행하지 마라.
`task submit`을 비롯한 어떤 bcos 명령도 실행하지 마라. 작업을 마치면 Report를 쓰고 멈춰라.

--- WORKER INSTRUCTIONS ---
<Prompt의 첫 두 --- 사이 본문>

--- CONTEXT PACKAGE ---
<buildContextPackage() 출력 전문>
```

**타임스탬프를 넣지 않는다.** 같은 입력이면 stdin 바이트가 동일해야 한다.
Context Package가 이미 담고 있는 내용을 다시 적지 않는다.

**Report 경로는 Task 파일명에서 유도한다** — `.bcos/reports/<Task 파일명>`.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **`task start` / `submit` / `approve` 자동 실행** — Runner는 lifecycle을 소유하지 않는다
- Report 존재 자동 감지, Review 자동 실행, 재작업 루프
- **Codex 출력 해석, 작업 완료 여부 판단**
- **대화형 TTY 자동화** — Windows 호환성과 테스트 가능성 때문에 제외한다
- Claude Code Runner · Gemini Runner · 그 밖의 두 번째 worker
- **`WorkerAdapter` interface · `CodexAdapter` class · Provider · Factory · Plugin ·
  Event emitter · Queue · Job scheduler · Retry engine · Process manager 추상화**
- vendor-neutral abstraction 일반 — 지원 worker는 `codex` 하나뿐이며 T-010 전까지 만들지 않는다
- 병렬 worker · worktree · background daemon
- API 직접 호출 · 토큰 사용량 조회 · 비용 계산
- prompt 요약 · LLM 기반 Context 축약
- **셸 실행** — `shell: true`, `cmd /c`, 셸 문자열 조립 전부 금지
- 새 util 파일 — 새 파일은 `src/runner.ts` **하나만**
- `src/context.ts` 수정 — `buildContextPackage()`를 **호출만** 한다
- **runtime dependency 추가** — devDependency 추가와 기존 버전 변경도 금지
- `package-lock.json` 생성
- **기존 `task start` / `submit` / `approve` / `context` 동작 변경**
- 이 저장소의 실제 `.bcos/` 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- **테스트에서 실제 Codex 호출** — 가짜 worker fixture를 쓴다
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- git 명령 실행 및 git add / commit / push

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. `IN_PROGRESS` Task에서 `task run <id> --worker codex --dry-run` 이 exit 0을 반환한다.
3. dry-run 출력에 실행할 command와 args가 그대로 나온다.
4. dry-run 출력에 cwd가 저장소 루트로 나온다.
5. dry-run 출력에 선택된 Prompt 경로가 나온다.
6. dry-run 출력에 Context file count와 SHA-256이 나온다.
7. dry-run 출력에 stdin SHA-256과 문자 수·줄 수가 나온다.
8. **dry-run 출력에 stdin 본문이 포함되지 않는다.**
9. 조립된 stdin에 Task ID, worker 종류, Report 경로가 포함된다.
10. 조립된 stdin에 Context 밖 파일 금지·git 금지·`task submit` 금지 지시가 포함된다.
11. 조립된 stdin에 Prompt 본문과 Context Package가 각각 한 번씩 포함된다.
12. **같은 입력으로 dry-run을 두 번 실행하면 stdin SHA-256이 동일하다.**
13. dry-run 실행 후 Task 파일·`events.jsonl`·`state.json`이 변하지 않는다.
14. 가짜 worker fixture로 실행하면 **stdin 전문이 그 프로세스에 전달된다** (수신 측 해시 대조).
15. 가짜 worker의 cwd가 fixture 저장소 루트다.
16. 가짜 worker의 stdout이 부모 stdout으로 전달된다.
17. 가짜 worker의 stderr가 부모 stderr로 전달된다.
18. 가짜 worker가 exit 0이면 Runner도 exit 0이다.
19. 가짜 worker가 exit 3이면 **Runner가 그 코드를 구분해 보고**하고 BCOS 자체 오류와 다르게 표시한다.
20. 실행 시간이 요약에 보고된다.
21. `--timeout`을 넘기면 child가 종료되고 Runner가 timeout으로 실패한다.
22. timeout 발생 후에도 fixture의 `.bcos/` 파일이 변하지 않는다.
23. worker 프로세스 시작 실패(없는 경로)가 exit 1로 보고된다.
24. **Task ID에 셸 메타문자를 넣어도 그것이 실행되지 않는다** — argv에 Task ID가 들어가지 않음을 확인한다.
25. 존재하지 않는 Task ID → exit 1.
26. `status`가 `IN_PROGRESS`가 아닌 Task → exit 1.
27. Prompt 파일이 없으면 → exit 1.
28. Prompt 파일이 2개 이상이면 → exit 1.
29. Prompt에 `---` 쌍이 없거나 본문이 비어 있으면 → exit 1.
30. Context 생성이 실패하면(Read List 파일 없음 등) → exit 1.
31. `--worker`가 `codex`가 아니면 → exit 1.
32. `--worker-command`가 가리키는 파일이 없으면 → exit 1.
33. `--timeout`이 양의 정수가 아니면 → exit 1.
34. **모든 실패 경로에서 fixture의 `.bcos/` 파일 내용이 실행 전과 동일하다.**
35. **어떤 경로에서도 Runner가 lifecycle 전이를 일으키지 않는다** — `events.jsonl` 줄 수 불변.
36. `task start` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건.
37. `task submit` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건.
38. `task approve` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건.
39. `task context` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건.
40. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.
41. `npm test` 가 통과하며 기존 66개를 포함해 **90개 이상**의 테스트가 pass한다.
42. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
43. `src/` 에 `cli.ts` · `context.ts` · `runner.ts` **세 파일만** 존재하고 하위 디렉터리가 없다.
44. **테스트가 실제 Codex를 한 번도 호출하지 않는다** — 모든 프로세스 실행이 fixture `.js`다.
45. 소스에 `shell: true`, `cmd /c`, `exec(` 문자열 조립이 없다.
46. `git status` 기준 변경 파일이 `src/cli.ts`, `src/runner.ts`, `tests/cli.test.ts`, Report
    4개뿐이다. `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**생성**

- `src/runner.ts`

**수정**

- `src/cli.ts`
- `tests/cli.test.ts`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-008-worker-runner-poc.md` (이 파일)
- `.bcos/prompts/T-008-worker-runner-poc-codex-prompt.md` (실행 프롬프트)
- `src/cli.ts`
- `src/context.ts`
- `tests/cli.test.ts`
- `package.json`
- `.bcos/prompts/T-007-context-builder-codex-prompt.md` (Prompt 형식 확인용 읽기 전용)

**쓰기**

- `.bcos/reports/T-008-worker-runner-poc.md`

**Codex CLI 도움말은 이미 조사됐다.** 위 Scope의 `codex exec` 사용법과 JS 엔트리 경로가
codex-cli 0.146.0 실측 결과다. **`codex --help`를 다시 실행하지 않는다.**

**새 파일은 `src/runner.ts` 하나만 만든다.** `src/context.ts`는 수정하지 않고
`buildContextPackage()`를 import해 호출한다. `src/cli.ts`는 라우팅과 출력만 담당한다.
`src/runner.ts`는 **함수를 export**하며 class를 쓰지 않는다.

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**실제 Codex를 절대 호출하지 않는다.** 임시 디렉터리에 **가짜 worker `.js` 파일**을 만들고
`--worker-command`로 그것을 가리킨다. Runner가 `process.execPath`로 JS를 실행하므로
가짜 worker도 `.js`면 충분하다. **`.cmd` wrapper나 셸이 필요 없어 Windows에서 안전하다.**

가짜 worker가 할 수 있어야 하는 것 — stdin 전문을 읽어 **SHA-256을 stdout에 출력**,
`process.cwd()` 출력, stderr에 한 줄 출력, 지정한 exit code로 종료, 지정한 시간 대기.
동작은 인자로 제어한다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 저장소 fixture를 만들고
`spawnSync`의 `cwd` 옵션으로 CLI를 실행한다.
**이 저장소의 실제 `.bcos/`나 실제 소스 파일을 읽거나 쓰는 테스트는 금지한다.**

| # | 대상 | 기대 |
|---|---|---|
| 1–66 | 기존 테스트 66개 | 전부 그대로 통과 |
| 67 | dry-run 정상 | exit 0, command·args·cwd·prompt 경로 출력 |
| 68 | dry-run | Context file count·SHA-256 출력 |
| 69 | dry-run | stdin SHA-256·chars·lines 출력 |
| 70 | dry-run | **stdin 본문 미포함** |
| 71 | dry-run 2회 | stdin SHA-256 동일 |
| 72 | dry-run 후 | Task·events·state 무변경 |
| 73 | stdin 내용 | Task ID·worker·Report 경로 포함 |
| 74 | stdin 내용 | Context 밖 금지·git 금지·submit 금지 지시 포함 |
| 75 | stdin 내용 | Prompt 본문·Context Package 각 1회 |
| 76 | fake worker | 수신 stdin SHA-256이 dry-run 해시와 일치 |
| 77 | fake worker | cwd가 fixture 루트 |
| 78 | fake worker | stdout 전달 |
| 79 | fake worker | stderr 전달 |
| 80 | fake worker | exit 0 → Runner exit 0 |
| 81 | fake worker | exit 3 → Runner가 worker 실패로 구분 보고 |
| 82 | 실행 시간 | 요약에 보고됨 |
| 83 | timeout | child 종료, Runner 실패 |
| 84 | timeout 후 | fixture `.bcos/` 무변경 |
| 85 | 없는 worker-command | exit 1 |
| 86 | 셸 메타문자 Task ID | 실행되지 않음, exit 1 |
| 87 | 없는 Task / 잘못된 status | 각각 exit 1 |
| 88 | Prompt 없음 / 2개 / 빈 본문 | 각각 exit 1 |
| 89 | Context 생성 실패 | exit 1 |
| 90 | 지원하지 않는 worker / 잘못된 timeout | 각각 exit 1 |
| 91 | 모든 실패 경로 | fixture `.bcos/` 해시 동일, `events.jsonl` 줄 수 불변 |
| 92 | Lifecycle 회귀 | `start`·`submit`·`approve`·`context` 정상·실패 각 1건 |

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 출력 전문,
dry-run 요약 전문, **2회 실행 stdin 해시 일치 결과**, fake worker의 stdin 해시 대조 결과,
non-zero exit 구분 보고, timeout 동작, lifecycle 회귀 결과를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수, Read List 밖에서 읽은 파일,
완료 후 `src/cli.ts` · `src/context.ts` · `src/runner.ts` 줄 수를 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·환경 변수 값을 Report에 남기지 않는다.
