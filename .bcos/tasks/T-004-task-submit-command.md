---
protocol: "0.1"
id: T-004
title: Implement bcos task submit with report guard
status: TODO
attempt: 0
created: 2026-08-04T05:01:29Z
updated: 2026-08-04T05:01:29Z
---

## Objective

T-003이 `TODO → IN_PROGRESS` 전이를 명령으로 만들었다. 다음 전이인
`IN_PROGRESS → IMPLEMENTED`는 여전히 사람이 세 파일을 손으로 고쳐야 한다.

```
bcos task submit <id> --actor-role <role> --actor-id <id>
```

이 Task는 그 전이 하나를 추가한다. `start`와 다른 점은 **가드**다.
RFC-001 G3에 따라 **현재 attempt의 Report가 존재할 때만** 제출을 허용한다.
증거 없는 완료 선언을 도구가 막는 첫 지점이다.

`approve`는 포함하지 않는다. Review 존재 가드와 SoD 가드가 추가로 필요하고,
그것은 별도 Task에서 다룬다.

## Scope

`src/cli.ts`에 `task submit` 하위 명령을 추가한다.

- [ ] 인자 파싱 — `task`, `submit`, `<id>`, `--actor-role`, `--actor-id`
- [ ] `<cwd>/.bcos/tasks/` 에서 `<id>-*.md` 를 찾는다
- [ ] 아래 **가드 4개**를 전부 통과할 때만 쓰기를 시작한다
- [ ] 통과 시 세 파일을 **Task → events.jsonl → state.json** 순서로 갱신한다
- [ ] 실패 시 stderr에 오류를 출력하고 exit 1, **파일을 하나도 바꾸지 않는다**

**가드 (전부 쓰기 前 검사)**

| # | 조건 | 실패 시 |
|---|---|---|
| 1 | `<id>`에 해당하는 Task 파일이 정확히 1개 존재 | exit 1 |
| 2 | 그 Task의 `status`가 `IN_PROGRESS` | exit 1 |
| 3 | `.bcos/reports/<id>-*.md` 가 존재하고 **현재 `attempt` 항목을 포함**한다 (RFC-001 G3) | exit 1 |
| 4 | `--actor-role`과 `--actor-id`가 모두 제공됨 | exit 1 |

가드 3의 판정 기준은 Report 본문에 `## Attempt <현재 attempt>` 로 시작하는 줄이
존재하는가다. Report 파일은 있으나 해당 attempt 항목이 없으면 거부한다.

**세 파일에 쓰는 값**

1. **Task frontmatter** — `status: IMPLEMENTED`, `updated`를 이벤트 `ts`와 동일하게.
   **`attempt`는 변경하지 않는다** (RFC-001 §1.4 — attempt는 `IN_PROGRESS` 진입 시에만 증가).
   다른 필드와 본문은 한 바이트도 바꾸지 않는다.
2. **`.bcos/events.jsonl`** — 아래 8필드를 가진 JSON 한 줄을 **append**.
   ```json
   {"ts":"<ISO8601 UTC ms>","event":"TASK_SUBMITTED","task":"<id>","attempt":<현재 attempt>,"actor_role":"<role>","actor_id":"<actor-id>","from":"IN_PROGRESS","to":"IMPLEMENTED"}
   ```
3. **`.bcos/state.json`** — `.bcos/tasks/*.md`를 다시 스캔해 `counts`를 재계산하고,
   `current_task`를 `IN_PROGRESS`인 Task의 id(없으면 `null`)로, `updated`를 이벤트 `ts`로 설정한다.
   `protocol`·`version`·`project`·`branch`는 기존 값을 유지한다.

submit 후에는 `IN_PROGRESS`인 Task가 없으므로 `current_task`는 보통 `null`이 된다.
값을 고정하지 말고 **재계산 결과를 쓴다.**

**코드 재사용** — `start`와 `submit`은 "가드 검사 → 세 파일 갱신" 구조가 같다.
`src/cli.ts` **안에서** 공통 부분을 함수로 묶는 것은 허용한다. 두 번째 호출처가 실제로 생겼다.
단, 전이 정의 테이블·상태 머신 엔진·명령 등록 구조를 만드는 것은 금지한다 (Out of Scope).

**원자성** — Task와 state.json은 임시 파일에 쓴 뒤 `renameSync`로 교체한다.
가드를 먼저 전부 통과시키므로 현실적인 실패는 파일을 건드리지 않는다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **`bcos task approve`** — Review 가드와 SoD 가드가 필요하다. 별도 Task
- `task block` / `unblock` / `request-changes`
- `bcos init` / `status` / `reindex` / `task create` / `list` / `show`
- **전이 정의 테이블, 상태 머신 엔진, 명령 등록 구조, 범용 CLI framework**
- 범용 인자 파서 — 읽을 인자는 5개뿐이다
- **새 소스 파일 또는 `src/core/`, `src/util/` 디렉터리** — 전부 `src/cli.ts` 안에서 처리한다
- YAML 파서 라이브러리 도입 또는 범용 YAML 파서 작성
- Report 내용 검증 — 존재와 attempt 항목만 확인한다.
  `Test Evidence`가 실제 출력인지 판정하는 것은 Reviewer의 일이지 CLI의 일이 아니다
- 트랜잭션 엔진, 롤백 프레임워크, 저널, 잠금 파일
- **runtime dependency 추가** — devDependency 추가와 기존 버전 변경도 금지
- `package-lock.json` 생성
- 이 저장소의 실제 `.bcos/` 내용 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- 기존 `task start` 동작 변경 — 리팩터링으로 공통화하더라도 **동작은 동일해야 한다**
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- git add / commit / push

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. 임시 저장소에서 `IN_PROGRESS` Task와 해당 attempt의 Report가 있을 때
   `node dist/cli.js task submit T-100 --actor-role worker --actor-id codex-cli` 가 exit 0을 반환한다.
3. 성공 후 그 Task의 frontmatter가 `status: IMPLEMENTED`이고 `updated`가 append된 이벤트의
   `ts`와 문자열로 같으며, **`attempt` 값이 실행 전과 동일**하다.
4. 성공 후 그 Task의 frontmatter 아래 본문이 실행 전과 **바이트 단위로 동일**하다.
5. 성공 후 `.bcos/events.jsonl`의 줄 수가 정확히 1 증가하고, 추가된 줄이 유효한 JSON이며
   키가 정확히 8개이고 값이 `TASK_SUBMITTED` / 해당 id / 실행 전 attempt / 전달한 role·id /
   `IN_PROGRESS` / `IMPLEMENTED` 다.
6. 성공 후 `.bcos/state.json`의 `counts`가 `.bcos/tasks/*.md` 스캔 결과와 일치하고,
   `current_task`가 `null`이다.
7. 존재하지 않는 Task ID로 실행하면 exit 1이며 세 파일 중 어느 것도 변경되지 않는다.
8. `status`가 `IN_PROGRESS`가 아닌 Task로 실행하면 exit 1이며 파일 변경이 없다.
9. **Report 파일이 없으면** exit 1이며 파일 변경이 없다 (G3).
10. **Report 파일은 있으나 현재 attempt 항목이 없으면** exit 1이며 파일 변경이 없다 (G3).
11. `--actor-role` 또는 `--actor-id`를 생략하면 exit 1이며 파일 변경이 없다.
12. `node dist/cli.js task start` 의 기존 동작이 변하지 않는다 — 정상 전이 1건과
    실패 경로 1건 이상을 실행해 확인한다.
13. `node dist/cli.js --version`, `--help`, `foo` 의 기존 동작이 변하지 않는다
    (각각 exit 0 / exit 0 / exit 1).
14. `npm test` 가 통과하며 기존 11개를 포함해 **17개 이상**의 테스트가 pass한다.
15. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
16. `git status` 기준 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다.
    `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**수정**
- `src/cli.ts`
- `tests/cli.test.ts`

**읽기 허용 (Read List)**
- `AGENTS.md`
- `.bcos/tasks/T-004-task-submit-command.md` (이 파일)
- `.bcos/prompts/T-004-task-submit-command-codex-prompt.md` (실행 프롬프트)
- `src/cli.ts`
- `tests/cli.test.ts`
- `package.json`
- `docs/rfcs/RFC-001-task-protocol.md` — **§1, §2, §3, §5만.** Appendix는 읽지 않는다

**쓰기**
- `.bcos/reports/T-004-task-submit-command.md`

**새 소스 파일을 만들지 않는다.** `src/cli.ts`는 현재 154줄이며 이 Task 후에도
250줄을 넘지 않아야 한다. 넘는다면 공통화가 부족한 것이다.

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고
그 안에 `.bcos/tasks/`, `.bcos/reports/`, `.bcos/events.jsonl`, `.bcos/state.json` fixture를
생성한 뒤 `spawnSync`의 `cwd` 옵션으로 CLI를 실행한다.
**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 금지한다.**

| # | 대상 | 검증 |
|---|---|---|
| 1–11 | 기존 테스트 11개 | 전부 그대로 통과 |
| 12 | 정상 submit | exit 0, `status: IMPLEMENTED`, `attempt` 불변, 본문 바이트 동일 |
| 13 | 정상 submit | events 1줄 증가, 8필드, `IN_PROGRESS → IMPLEMENTED` |
| 14 | 정상 submit | state counts 일치, `current_task` = `null` |
| 15 | 없는 ID | exit 1, 세 파일 무변경 |
| 16 | `IN_PROGRESS`가 아닌 상태 | exit 1, 세 파일 무변경 |
| 17 | Report 파일 없음 | exit 1, 세 파일 무변경 |
| 18 | Report는 있으나 attempt 항목 없음 | exit 1, 세 파일 무변경 |
| 19 | `--actor-id` 누락 | exit 1, 세 파일 무변경 |

"세 파일 무변경"은 실행 전후 파일 내용을 문자열로 비교해 확인한다.

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 출력 전문,
정상 submit 1회가 append한 실제 이벤트 줄, 그리고 **`task start` 회귀 확인 결과**를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수와 Read List 밖에서 읽은 파일을 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·계정명을 Report에 남기지 않는다.
