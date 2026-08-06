---
protocol: "0.1"
id: T-007
title: Build deterministic context packages from task read lists
status: DONE
attempt: 1
created: 2026-08-06T02:43:50Z
updated: 2026-08-06T03:20:04.164Z
---

## Objective

T-006까지 lifecycle 상태 기록은 자동화됐다. 그러나 **사람이 여전히 Context를 나른다.**
Worker를 띄울 때마다 프롬프트 경로를 찾아 전달하고, 프롬프트가 "이 파일들을 읽어라"라고
지시하면 Worker가 하나씩 연다.

이 구조에는 두 가지 문제가 있다. Worker가 무엇을 읽었는지 **자기보고 외에 확인할 방법이
없고**, 모델을 바꿀 때 사람이 프로젝트 구조를 처음부터 다시 설명해야 한다.

```
node dist/cli.js task context T-007
```

이 명령은 Task ID 하나를 받아 **Read List에 적힌 파일들의 내용을 결정론적으로 조립해
stdout으로 출력한다.** 같은 입력이면 같은 바이트가 나온다.

이것이 BCOS의 원래 목적 세 가지 중 첫 번째와 세 번째로 가는 첫걸음이다 —
다른 모델이 프로젝트를 이어받을 수 있게 하고, 전환할 때마다 사람이 다시 설명하지 않게 한다.

**이 Task는 Context를 조립할 뿐 Worker를 실행하지 않는다.** 실행은 후속 Task다.

## Scope

`src/context.ts`를 새로 만들고 `src/cli.ts`에서 라우팅한다.

- [ ] `task context <id>` 인자 파싱 (`src/cli.ts`)
- [ ] Task 파일을 찾아 `Expected Files` 섹션의 **읽기 허용 목록**을 추출한다
- [ ] 각 경로를 검증한다 — 존재·저장소 내부·비바이너리·크기·금지 패턴
- [ ] 중복 경로를 제거한다
- [ ] **Read List에 적힌 순서를 그대로 유지한다** (정렬하지 않는다)
- [ ] 각 파일 전문을 읽어 하나의 패키지로 조립한다
- [ ] 메타데이터 블록을 앞에 붙인다
- [ ] stdout으로 출력한다
- [ ] 검증 실패 시 stderr에 오류를 내고 exit 1, **부분 출력을 하지 않는다**

**Read List 추출 규칙**

`## Expected Files` 섹션 안에서 `**읽기 허용**` 또는 `**읽기 허용 (Read List)**` 로 시작하는
줄을 찾고, 그 다음 줄부터 다음 굵은 라벨(`**생성**` / `**수정**` / `**쓰기**`) 또는
다음 `## ` heading 직전까지의 `- ` 항목을 수집한다.

각 항목에서 **첫 번째 백틱 쌍 안의 문자열**을 경로로 취한다. 뒤에 붙은 한국어 주석은
경로 추출에 사용하지 않는다.

```
- `AGENTS.md`                                        → AGENTS.md
- `.bcos/tasks/T-004-...md` (이 파일)                  → .bcos/tasks/T-004-...md
- `tests/cli.test.ts` — **읽기만.** 수정 금지          → tests/cli.test.ts
```

**§ 범위 표기는 무시하고 파일 전문을 출력한다.** 다만 항목의 주석 전문을 메타데이터의
`note`로 그대로 보존해 사람이 의도를 볼 수 있게 한다. 이유는 Out of Scope에 있다.

**출력 형식**

```
=== BCOS CONTEXT PACKAGE v0.1 ===
task: T-007
status: TODO
attempt: 0
files: 8
characters: 12345
lines: 456

--- FILE 1/8: AGENTS.md ---
<파일 전문>

--- FILE 2/8: ... ---
...
=== END CONTEXT PACKAGE ===
```

`characters`와 `lines`는 **메타데이터 블록을 제외한 파일 본문 합계**다.
계산 후 헤더에 채우므로 자기참조 문제가 없다.

**frontmatter 값은 첫 두 `---` 사이에서만 읽는다.** 문서 전체를 `^status:` 같은 패턴으로
스캔하면 안 된다. **이 Task 파일 자체가 위 예시 블록 안에 `status:`와 `attempt:` 줄을
포함하고 있어** 전역 스캔은 잘못된 값을 얻는다. 위 예시가 그대로 테스트 케이스다.

**타임스탬프를 패키지에 넣지 않는다.** 결정성이 이 Task의 핵심 요구이고,
시각이 필요하면 셸에서 얻을 수 있다.

**검증 규칙**

| # | 검사 | 실패 시 |
|---|---|---|
| 1 | Task 파일이 정확히 1개 존재 | exit 1 |
| 2 | `읽기 허용` 라벨이 존재 | exit 1 |
| 3 | 항목이 1개 이상 | exit 1 |
| 4 | 경로가 상대경로이고 `..`를 포함하지 않는다 | exit 1 |
| 5 | 파일이 존재하고 일반 파일이다 | exit 1 |
| 6 | 파일 크기 ≤ 256 KB | exit 1 |
| 7 | 첫 8,000바이트에 NUL 바이트가 없다 (바이너리 차단) | exit 1 |
| 8 | 경로가 금지 패턴에 걸리지 않는다 | exit 1 |

**금지 패턴** — `.env`로 시작하는 파일명 · 확장자 `.pem` `.key` `.p12` `.pfx` ·
`id_rsa`로 시작하는 파일명 · 경로에 `node_modules/` `dist/` `.git/` 포함

**모든 검증을 통과한 뒤에만 출력을 시작한다.** 파일 하나라도 실패하면 아무것도 출력하지 않는다.

**패키지 크기** — 8,000자를 넘으면 stderr에 경고를 내되 **exit 0을 유지한다**
(RFC-001 §6: "경고한다. 실패가 아니다"). 개별 파일 256 KB 초과만 실패다.

**git 명령을 실행하지 않는다.** 추적 여부 판정에 `git`을 호출하면 프로세스 의존이 생긴다.
**Read List 자체가 허용 목록**이므로 별도 추적 검사가 필요 없다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **§ 범위(section) 추출** — Read List의 `§1, §2` 표기는 T-001~T-006에서 형식이 제각각이다
  (`§3 (Report 포맷)`, `— §1, §2, §3, §5만`, `§2와 §8만`). 기계 파싱이 안정적이지 않고,
  T-005에서 코드 블록 안 `## ` 오인식 문제도 확인됐다. **파일 전문만 출력한다.**
  section 추출은 형식을 먼저 정한 뒤 별도 Task에서 다룬다
- **Worker 실행, 프롬프트 자동 주입, Codex/Claude 호출** — 후속 Task
- `task show` 구현 — RFC-001 §6의 8블록 규격은 요약이 필요해 결정론적으로 만들 수 없다.
  별도 논의 대상이며 이 Task는 `task context`라는 다른 명령을 만든다
- `request-changes` / `block` / `unblock` / `init` / `status` / `reindex` / `create` / `list`
- **파일 출력 및 `.bcos/context/` 디렉터리** — 패키지는 재생성 가능한 파생물이다.
  stdout만 지원하며 파일이 필요하면 셸 리다이렉션을 쓴다
- Task Schema Migration, frontmatter에 read list 필드 추가
- **범용 Markdown 파서**
- ContextBuilder class · Provider · Adapter · Factory · Plugin 구조 · 범용 CLI framework
- 여러 유틸리티 파일 — 새 파일은 `src/context.ts` **하나만**
- 후속 Runner용 인터페이스 선제 설계
- Embedding · Vector DB · RAG · 요약 LLM 호출 · 외부 API
- **runtime dependency 추가** — devDependency 추가와 기존 버전 변경도 금지
- `package-lock.json` 생성
- **기존 `task start` / `submit` / `approve` 동작 변경**
- 이 저장소의 실제 `.bcos/` 내용 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- git 명령 실행 및 git add / commit / push

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. 유효한 Task를 가진 임시 저장소에서 `node dist/cli.js task context T-100` 이 exit 0을 반환한다.
3. 출력이 `=== BCOS CONTEXT PACKAGE v0.1 ===` 로 시작하고 `=== END CONTEXT PACKAGE ===` 로 끝난다.
4. Read List의 각 파일이 **정확히 한 번씩** 포함된다.
5. Read List에 같은 경로가 두 번 적혀 있으면 **한 번만** 포함되고 `files` 수가 그에 맞는다.
6. 파일 순서가 **Read List에 적힌 순서와 동일**하다.
7. **같은 입력으로 두 번 실행한 stdout이 바이트 단위로 동일**하다.
8. 메타데이터의 `task`·`status`·`attempt`가 Task frontmatter와 일치한다.
9. 메타데이터의 `files`가 실제 포함된 파일 수와 일치한다.
10. 메타데이터의 `characters`와 `lines`가 파일 본문 합계와 일치한다.
11. 한국어가 포함된 파일이 **UTF-8로 손상 없이** 출력된다.
12. 실행 후 Task 파일의 frontmatter와 본문이 **바이트 단위로 변하지 않는다**.
13. 실행 후 `events.jsonl`이 변하지 않는다.
14. 실행 후 `state.json`이 변하지 않는다.
15. 존재하지 않는 Task ID → exit 1, stdout 비어 있음.
16. `읽기 허용` 라벨이 없는 Task → exit 1, stdout 비어 있음.
17. 항목이 하나도 없는 Read List → exit 1, stdout 비어 있음.
18. Read List에 존재하지 않는 파일 → exit 1, stdout 비어 있음.
19. `..`를 포함하거나 절대경로인 항목 → exit 1, stdout 비어 있음.
20. 바이너리 파일(NUL 바이트 포함) → exit 1, stdout 비어 있음.
21. 256 KB를 초과하는 파일 → exit 1, stdout 비어 있음.
22. 금지 패턴 경로(`.env`, `*.key`, `node_modules/` 등) → exit 1, stdout 비어 있음.
23. 실패 경로 전부에서 fixture의 `.bcos/` 파일 내용이 실행 전과 동일하다.
24. 패키지가 8,000자를 넘으면 stderr에 경고가 나오지만 **exit 0**이다.
25. `node dist/cli.js task start` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건.
26. `node dist/cli.js task submit` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건.
27. `node dist/cli.js task approve` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건(SoD).
28. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.
29. `npm test` 가 통과하며 기존 46개를 포함해 **65개 이상**의 테스트가 pass한다.
30. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
31. `src/` 에 `cli.ts`와 `context.ts` **두 파일만** 존재하고 하위 디렉터리가 없다.
32. `git status` 기준 변경 파일이 `src/cli.ts`, `src/context.ts`, `tests/cli.test.ts`, Report
    4개뿐이다. `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**생성**

- `src/context.ts`

**수정**

- `src/cli.ts`
- `tests/cli.test.ts`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-007-context-builder.md` (이 파일)
- `.bcos/prompts/T-007-context-builder-codex-prompt.md` (실행 프롬프트)
- `src/cli.ts`
- `tests/cli.test.ts`
- `package.json`
- `docs/rfcs/RFC-001-task-protocol.md` (파일 전문. Appendix는 읽지 않는다)
- `.bcos/tasks/T-004-task-submit-command.md` (fixture 형식 확인용 읽기 전용. 수정 금지)

**쓰기**

- `.bcos/reports/T-007-context-builder.md`

**새 파일은 `src/context.ts` 하나만 만든다.** `src/cli.ts`는 303줄이고 T-006이 정한
분리 트리거가 400줄이다. Context 조립은 상태 전이와 다른 책임이므로 파일을 나눈다.
`src/cli.ts`는 인자 라우팅과 출력만, `src/context.ts`는 추출·검증·조립만 담당한다.
`src/context.ts`는 **함수 몇 개를 export**하며 class를 쓰지 않는다.

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고
그 안에 fixture를 생성한 뒤 `spawnSync`의 `cwd` 옵션으로 CLI를 실행한다.
**이 저장소의 실제 `.bcos/`나 실제 소스 파일을 읽거나 쓰는 테스트는 금지한다.**

stdout · stderr · exit code를 **분리해서** 검증한다.

| # | 대상 | 기대 |
|---|---|---|
| 1–46 | 기존 테스트 46개 | 전부 그대로 통과 |
| 47 | 정상 생성 | exit 0, 헤더·푸터 존재 |
| 48 | 파일 포함 | 각 파일이 정확히 한 번 |
| 49 | 중복 제거 | 같은 경로 2회 기재 시 1회만 |
| 50 | 순서 | Read List 순서와 동일 |
| 51 | **결정성** | 두 번 실행 stdout 바이트 동일 |
| 52 | 메타데이터 | `task`·`status`·`attempt` 일치 |
| 53 | 메타데이터 | `files`·`characters`·`lines` 일치 |
| 54 | UTF-8 | 한국어 포함 fixture 손상 없음 |
| 55 | **실제 Task 형식** | T-004를 복사한 fixture로 정상 생성 |
| 56 | **실제 RFC 형식** | RFC-001을 복사한 파일을 Read List에 포함해 정상 생성 |
| 57 | 없는 Task | exit 1, stdout 비어 있음 |
| 58 | 라벨 없음 | exit 1, stdout 비어 있음 |
| 59 | 빈 Read List | exit 1, stdout 비어 있음 |
| 60 | 없는 파일 | exit 1, stdout 비어 있음 |
| 61 | `..` 경로 | exit 1, stdout 비어 있음 |
| 62 | 바이너리 | exit 1, stdout 비어 있음 |
| 63 | 크기 초과 | exit 1, stdout 비어 있음 |
| 64 | 금지 패턴 | exit 1, stdout 비어 있음 |
| 65 | 8,000자 초과 | stderr에 경고, exit 0 |
| 66 | Lifecycle 회귀 | `start`·`submit`·`approve` 정상·실패 각 1건 |

55번과 56번은 **실제 파일을 복사한 fixture**를 쓴다. 이 저장소의 파일을 직접 읽지 말고
임시 디렉터리로 복사해 사용한다. T-005에서 합성 fixture만 써서 실제 형식을 검증하지 못한
사례가 있었다. 같은 실수를 반복하지 않는다.

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 출력 전문,
정상 생성 1회의 **패키지 헤더 전문**, 같은 입력 2회 실행의 **해시 일치 결과**,
실패 경로 1건의 stdout 공백 확인, lifecycle 회귀 결과를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수, Read List 밖에서 읽은 파일,
완료 후 `src/cli.ts`와 `src/context.ts`의 줄 수를 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·계정명을 Report에 남기지 않는다.
