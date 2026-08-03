---
protocol: "0.1"
id: T-001
title: BCOS CLI 프로젝트 스캐폴드 구축
status: TODO
attempt: 0
created: 2026-08-03T00:00:00Z
updated: 2026-08-03T00:00:00Z
---

## Objective

BCOS CLI를 구현할 Node.js + TypeScript 프로젝트의 뼈대를 만든다.
이 Task는 기능을 만들지 않는다. **빌드·실행·테스트가 되는 최소 골격만** 세운다.

목적은 두 가지다. 첫째, 이후 모든 Task가 올라설 토대를 확보한다.
둘째, **Task 명세와 지정된 읽기 목록만으로 worker가 작업할 수 있는지 검증하는 첫 실험**이다.
두 번째가 더 중요하다. 이 Task를 처리하며 읽은 파일 수를 Report에 기록한다.

## Scope

- [ ] `package.json` — 이름 `bcos`, `bin` 엔트리, npm 스크립트(`build`, `test`), **런타임 의존성 0개**
- [ ] `tsconfig.json` — `strict: true`, ESM, 출력 `dist/`
- [ ] `src/cli.ts` — 진입점. `--version`과 `--help`만 처리한다
- [ ] `tests/cli.test.ts` — `node:test` 기반
- [ ] `README.md` — 설치와 실행 방법 5줄 이내

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- `init` / `status` / `task *` 등 실제 CLI 명령 로직 — 전부 후속 Task다
- Task 파싱, frontmatter 파서, state.json 읽기·쓰기, events.jsonl 기록
- **파일 쓰기 유틸리티(`writeFileAtomic` 등)** — 이 Task는 파일을 쓰지 않는다.
  실제로 파일을 쓰는 첫 Task와 함께 만든다
- `src/core/`, `src/util/` 등 지금 쓰이지 않는 디렉터리
- 인자 파서 라이브러리 도입 또는 범용 인자 파서 작성.
  처리할 인자가 2개뿐이므로 `process.argv[2]` 직접 비교로 충분하다
- 번들러(esbuild, rollup 등), 린터, 포매터, CI 설정
- 런타임 의존성 추가 (devDependency는 `typescript`와 `@types/node`만 허용)
- `.bcos/` 하위 파일 수정 (Report 작성 제외)

## Acceptance Criteria

1. `npm install` 이 성공한다.
2. `npm run build` 가 오류 없이 `dist/`를 생성한다.
3. `node dist/cli.js --version` 이 `package.json`의 `version` 값과 같은 문자열을 출력하고
   exit code 0을 반환한다.
4. `node dist/cli.js --help` 가 사용법을 출력하고 exit code 0을 반환한다.
5. `node dist/cli.js foo` 가 오류 메시지를 **stderr**에 출력하고 **exit code 1**을 반환한다.
6. `npm test` 가 통과하며, 통과한 테스트가 3개 이상이다.
7. `package.json`의 `dependencies`가 비어 있거나 존재하지 않는다.
8. 소스에 하드코딩된 경로 결합(`'a/' + b`, `` `a\${b}` ``)이 없다. 경로는 `path.join` 또는
   `import.meta.url` 기반으로 만든다.
9. `.bcos/` 하위에서 Report 파일 생성 외의 변경이 없다 (`git status`로 확인).

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**생성**
- `package.json`
- `tsconfig.json`
- `src/cli.ts`
- `tests/cli.test.ts`
- `README.md`

**읽기 허용**
- `AGENTS.md`
- `docs/rfcs/RFC-001-task-protocol.md` §3 (Report 포맷). **Appendix는 읽지 않는다**
- `docs/decisions/ADR-001-language.md`
- `.bcos/tasks/T-001-project-scaffold.md` (이 파일)

**쓰기**
- `.bcos/reports/T-001-project-scaffold.md`

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 테스트 프레임워크를 도입하지 않는다.

| # | 대상 | 검증 |
|---|---|---|
| 1 | `cli --version` | stdout이 `package.json`의 version과 일치, exit 0 |
| 2 | `cli --help` | stdout에 사용법 포함, exit 0 |
| 3 | `cli foo` | stderr에 오류 메시지, exit 1 |

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 실행 출력 전문을 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
npm 스크립트에 `&&` 체이닝을 쓰지 않는다 (파서 오류).
