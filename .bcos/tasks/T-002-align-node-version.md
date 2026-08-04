---
protocol: "0.1"
id: T-002
title: Align minimum Node version with tested environment
status: DONE
attempt: 1
created: 2026-08-04T02:48:50Z
updated: 2026-08-04T03:13:17.003Z
---

## Objective

`package.json`의 `engines.node`가 실제로 검증한 범위보다 넓게 선언되어 있다.
현재 `>=22`이지만 `npm test`는 `.ts` 파일을 직접 실행하므로 Node의 type stripping에 의존하고,
이 기능은 Node 22.18 미만에서 기본 비활성이다. 검증 환경은 Node v24.11.1 하나뿐이다.

**선언을 검증 범위에 맞춘다.** 기능을 추가하지 않고, 테스트 구조도 바꾸지 않는다.
Review Finding F-1의 처리다.

## Scope

- [ ] `package.json`의 `engines.node`를 `>=24`로 변경
- [ ] `README.md`의 Node 요구사항 문장을 `package.json`과 일치시킴
- [ ] 변경 후 build·test·CLI 3경로가 여전히 통과하는지 실행으로 확인

## Out of Scope

**아래를 건드리면 이 Task는 실패다.**

- `src/cli.ts` 수정
- `tests/cli.test.ts` 수정 — **파일명 변경(`.ts` → `.js`) 포함**
- `tsconfig.json` 수정
- 테스트 러너 추가 (jest, vitest, mocha 등)
- transpiler loader 추가 (`--loader`, `--import`, tsx, ts-node 등)
- 의존성 추가 — dependencies와 devDependencies 모두
- 기존 devDependency의 버전 변경 (`@types/node`의 `^22.0.0` 포함)
- `package-lock.json` 생성 또는 커밋
- Node 버전 매트릭스 CI, GitHub Actions
- RFC·ADR·아키텍처 문서 변경
- Worker Template 생성
- `.bcos/` 하위 파일 수정 (Report 작성 제외)

## Acceptance Criteria

1. `package.json`의 `engines.node` 값이 정확히 `">=24"` 다.
2. `README.md`가 Node 24 이상을 요구한다고 서술하며, `package.json`과 모순되지 않는다.
3. `npm install` 이 exit code 0으로 성공한다.
4. `npm run build` 가 exit code 0으로 성공하고 `dist/cli.js`를 생성한다.
5. `npm test` 가 exit code 0으로 통과하며 3개 테스트가 모두 pass다.
6. `node dist/cli.js --version` 이 `package.json`의 `version`과 같은 문자열을 출력하고 exit 0이다.
7. `node dist/cli.js --help` 가 사용법을 출력하고 exit 0이다.
8. `node dist/cli.js foo` 가 stderr에 오류를 출력하고 exit 1이다.
9. `package.json`에 `dependencies` 키가 없거나 비어 있다.
10. `devDependencies`가 `@types/node`와 `typescript` 2개뿐이며 버전 문자열이 변경되지 않았다.
11. `git status` 기준 변경 파일이 `package.json`, `README.md`, Report 3개뿐이다.
    `package-lock.json`이 생성되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**수정**
- `package.json`
- `README.md`

**읽기 허용 (Read List)**
- `AGENTS.md`
- `.bcos/tasks/T-002-align-node-version.md` (이 파일)
- `package.json`
- `README.md`
- `tests/cli.test.ts` — **읽기만.** 수정 금지
- `docs/rfcs/RFC-001-task-protocol.md` §3 (Report 포맷). **Appendix는 읽지 않는다**

**쓰기**
- `.bcos/reports/T-002-align-node-version.md`

## Test Requirements

새 테스트를 작성하지 않는다. **기존 3개가 계속 통과하는지만 확인한다.**

| # | 명령 | 기대 |
|---|---|---|
| 1 | `npm install` | exit 0 |
| 2 | `npm run build` | exit 0, `dist/cli.js` 생성 |
| 3 | `npm test` | exit 0, 3 pass / 0 fail |
| 4 | `node dist/cli.js --version` | stdout이 version과 일치, exit 0 |
| 5 | `node dist/cli.js --help` | stdout에 `Usage:`, exit 0 |
| 6 | `node dist/cli.js foo` | stderr에 오류, exit 1 |

**증거:** Report의 `Test Evidence`에 위 6개 명령의 실행 출력 전문을 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1. npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수와 Read List 밖에서 읽은 파일을 기록한다.
이 값이 T-001과 비교할 두 번째 기준선이 된다.
