---
protocol: "0.1"
id: T-003
title: Implement bcos task start with atomic lifecycle update
status: TODO
attempt: 0
created: 2026-08-04T04:24:41Z
updated: 2026-08-04T04:24:41Z
---

## Objective

T-001과 T-002는 구현·Report·Review가 모두 성공했지만 **lifecycle 전이가 두 번 모두 누락**됐다.
Task는 `TODO`인 채로 남았고 `events.jsonl`은 비어 있었으며 `state.json`은 낡은 값이었다.
사람이 세 파일을 손으로 맞춰야 했고, 두 번 다 잊었다.

원인은 worker가 아니라 **도구의 부재**다. 이 Task는 그중 **첫 전이 하나**를 코드로 강제한다.

```
bcos task start <id> --actor-role <role> --actor-id <id>
```

이 명령 하나가 Task frontmatter, `events.jsonl`, `state.json`을 **일관되게** 갱신한다.
`submit`과 `approve`는 이 Task에 포함하지 않는다 — 파일을 쓰는 첫 명령이므로
가장 단순한 전이에서 방식을 먼저 검증한다.

## Scope

`src/cli.ts`에 `task start` 하위 명령을 추가한다.

- [ ] 인자 파싱 — `process.argv`에서 `task`, `start`, `<id>`, `--actor-role`, `--actor-id`를 직접 읽는다
- [ ] `<cwd>/.bcos/tasks/` 에서 `<id>-*.md` 파일을 찾는다
- [ ] 아래 **가드 5개**를 전부 통과할 때만 쓰기를 시작한다
- [ ] 통과 시 세 파일을 **이 순서로** 갱신한다 — Task → events.jsonl → state.json
- [ ] 실패 시 오류 메시지를 stderr에 출력하고 exit 1, **파일을 하나도 바꾸지 않는다**

**가드 (전부 쓰기 前 검사)**

| # | 조건 | 실패 시 |
|---|---|---|
| 1 | `<id>`에 해당하는 Task 파일이 정확히 1개 존재 | exit 1 |
| 2 | 그 Task의 `status`가 `TODO` | exit 1 |
| 3 | `.bcos/tasks/` 안에 `IN_PROGRESS`인 Task가 없다 (RFC-001 G1) | exit 1 |
| 4 | 그 Task의 필수 6섹션이 모두 비어 있지 않다 (RFC-001 G2) | exit 1 |
| 5 | `--actor-role`과 `--actor-id`가 모두 제공됨 | exit 1 |

**세 파일에 쓰는 값**

1. **Task frontmatter** — `status: IN_PROGRESS`, `attempt`를 1 증가, `updated`를 이벤트 `ts`와 동일하게.
   **다른 필드와 본문은 한 바이트도 바꾸지 않는다.**
2. **`.bcos/events.jsonl`** — 아래 8필드를 가진 JSON 한 줄을 **append**. 기존 줄은 건드리지 않는다.
   ```json
   {"ts":"<ISO8601 UTC ms>","event":"TASK_STARTED","task":"<id>","attempt":<새 attempt>,"actor_role":"<role>","actor_id":"<actor-id>","from":"TODO","to":"IN_PROGRESS"}
   ```
3. **`.bcos/state.json`** — `.bcos/tasks/*.md`를 다시 스캔해 `counts`를 재계산하고,
   `current_task`를 `IN_PROGRESS`인 Task의 id(없으면 `null`)로, `updated`를 이벤트 `ts`로 설정한다.
   `protocol`·`version`·`project`·`branch`는 기존 값을 유지한다.

**원자성** — Task와 state.json은 임시 파일에 쓴 뒤 `renameSync`로 교체한다.
events.jsonl은 append이므로 그대로 쓴다.

> 가드를 먼저 전부 통과시키므로 현실적인 실패(잘못된 입력)는 파일을 건드리지 않는다.
> Task 기록 후 events append가 실패하는 창은 남아 있으나, 이를 위한 트랜잭션 계층은 만들지 않는다.
> 실제로 발생한 적이 없는 실패다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- `bcos task submit` / `approve` / `block` / `unblock` / `request-changes` — 후속 Task
- `bcos init` / `status` / `reindex` / `task create` / `list` / `show`
- 범용 인자 파서, 서브커맨드 라우터, 명령 등록 테이블
- **새 소스 파일 또는 `src/core/`, `src/util/` 디렉터리** — 전부 `src/cli.ts` 안에서 처리한다
- YAML 파서 라이브러리 도입 또는 범용 YAML 파서 작성
  (frontmatter는 `key: value` 한 줄 형식이므로 필요한 3개 필드만 치환한다)
- 트랜잭션 엔진, 롤백 프레임워크, 저널, 잠금 파일
- 의존성 추가 — dependencies·devDependencies 모두. 기존 devDependency 버전 변경도 금지
- `package-lock.json` 생성
- 이 저장소의 실제 `.bcos/` 내용 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- git add / commit / push
- GitHub Actions, Issue, Release, Tag

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. 임시 저장소에서 `TODO` Task에 대해 `node dist/cli.js task start T-001 --actor-role worker --actor-id codex-cli`
   가 exit 0을 반환한다.
3. 성공 후 그 Task의 frontmatter가 `status: IN_PROGRESS`, `attempt: 1`이며
   `updated`가 append된 이벤트의 `ts`와 문자열로 같다.
4. 성공 후 그 Task의 **frontmatter 아래 본문이 실행 전과 바이트 단위로 동일**하다.
5. 성공 후 `.bcos/events.jsonl`의 줄 수가 정확히 1 증가하고, 추가된 줄이 유효한 JSON이며
   키가 정확히 8개(`ts` `event` `task` `attempt` `actor_role` `actor_id` `from` `to`)이고
   값이 `TASK_STARTED` / 해당 id / `1` / 전달한 role·id / `TODO` / `IN_PROGRESS` 다.
6. 성공 후 `.bcos/state.json`의 `counts`가 `.bcos/tasks/*.md`를 스캔해 계산한 값과 일치하고,
   `current_task`가 시작한 Task의 id다.
7. 존재하지 않는 Task ID로 실행하면 stderr에 메시지를 출력하고 exit 1이며,
   Task 파일·`events.jsonl`·`state.json` 중 **어느 것도 변경되지 않는다**.
8. `status`가 `TODO`가 아닌 Task로 실행하면 exit 1이며 파일 변경이 없다.
9. 다른 Task가 이미 `IN_PROGRESS`인 상태에서 실행하면 exit 1이며 파일 변경이 없다 (G1).
10. 필수 6섹션 중 하나가 비어 있는 Task로 실행하면 exit 1이며 파일 변경이 없다 (G2).
11. `--actor-role` 또는 `--actor-id`를 생략하면 exit 1이며 파일 변경이 없다.
12. `node dist/cli.js --version`, `--help`, `foo` 의 기존 동작이 변하지 않는다
    (각각 exit 0 / exit 0 / exit 1).
13. `npm test` 가 통과하며 기존 3개를 포함해 **10개 이상**의 테스트가 pass한다.
14. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
15. `git status` 기준 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다.
    `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**수정**
- `src/cli.ts`
- `tests/cli.test.ts`

**읽기 허용 (Read List)**
- `AGENTS.md`
- `.bcos/tasks/T-003-task-start-command.md` (이 파일)
- `src/cli.ts`
- `tests/cli.test.ts`
- `package.json`
- `docs/rfcs/RFC-001-task-protocol.md` — **§1, §2, §3, §5만.** Appendix는 읽지 않는다

**쓰기**
- `.bcos/reports/T-003-task-start-command.md`

**새 소스 파일을 만들지 않는다.** 현재 `src/cli.ts`는 18줄이고 이 Task로 100줄 남짓이 된다.
분리할 두 번째 사용처가 아직 없다.

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고
그 안에 `.bcos/tasks/`, `.bcos/events.jsonl`, `.bcos/state.json` fixture를 생성한 뒤,
`spawnSync`의 `cwd` 옵션으로 CLI를 그 디렉터리에서 실행한다.
**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 금지한다.** 테스트 후 임시 디렉터리를 정리한다.

| # | 대상 | 검증 |
|---|---|---|
| 1 | `--version` | stdout이 version과 일치, exit 0 (기존) |
| 2 | `--help` | stdout에 사용법, exit 0 (기존) |
| 3 | `foo` | stderr에 오류, exit 1 (기존) |
| 4 | 정상 start | exit 0, frontmatter 3필드 갱신, 본문 바이트 동일 |
| 5 | 정상 start | events.jsonl 1줄 증가, 8필드, 값 일치 |
| 6 | 정상 start | state.json counts·current_task 일치 |
| 7 | 없는 ID | exit 1, 세 파일 무변경 |
| 8 | `TODO`가 아닌 상태 | exit 1, 세 파일 무변경 |
| 9 | 다른 Task가 `IN_PROGRESS` | exit 1, 세 파일 무변경 |
| 10 | 필수 섹션 누락 | exit 1, 세 파일 무변경 |
| 11 | `--actor-id` 누락 | exit 1, 세 파일 무변경 |

"세 파일 무변경"은 실행 전후 파일 내용을 문자열로 비교해 확인한다.

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 실행 출력 전문,
그리고 정상 start 1회의 실제 `events.jsonl` 추가 줄을 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수와 Read List 밖에서 읽은 파일을 기록한다.
