---
protocol: "0.1"
id: T-006
title: Implement bcos task approve with review and separation-of-duties guards
status: TODO
attempt: 0
created: 2026-08-04T11:19:51Z
updated: 2026-08-04T11:19:51Z
---

## Objective

`start`와 `submit`은 명령이 됐다. `approve`는 아직 사람이 세 파일을 손으로 고친다.

```
bcos task approve <id> --actor-role <role> --actor-id <id>
```

이 Task는 마지막 핵심 전이를 추가한다. 앞선 두 전이와 결정적으로 다른 점이 있다.

**이 명령에 SoD 가드가 들어간다.** RFC-001 G5는 "승인하는 `actor_id`는 현재 attempt의
`TASK_SUBMITTED` 이벤트의 `actor_id`와 같아서는 안 된다"고 규정한다. 지금까지 이 규칙은
문서상의 약속이었고 사람이 지켜왔다. **T-006에서 처음으로 코드가 강제한다.**

BCOS의 존재 이유가 자기검증 편향 제거이므로, 이 가드가 이 프로젝트에서 가장 중요한
한 줄이다. 나머지는 그것을 성립시키기 위한 배관이다.

## Scope

`src/cli.ts`에 `task approve` 하위 명령을 추가한다.

- [ ] 인자 파싱 — `task`, `approve`, `<id>`, `--actor-role`, `--actor-id`
- [ ] 아래 **가드 6개**를 전부 통과할 때만 쓰기를 시작한다
- [ ] 통과 시 세 파일을 **Task → events.jsonl → state.json** 순서로 갱신한다
- [ ] 실패 시 stderr에 오류를 출력하고 exit 1, **파일을 하나도 바꾸지 않는다**

**가드 (전부 쓰기 前 검사)**

| # | 조건 | RFC 근거 |
|---|---|---|
| 1 | `<id>`에 해당하는 Task 파일이 정확히 1개 존재 | — |
| 2 | 그 Task의 `status`가 `IMPLEMENTED` | §1.2 전이표 |
| 3 | `--actor-role`과 `--actor-id`가 모두 제공됨 | — |
| 4 | `--actor-role`이 `reviewer` 또는 `human` | §1.2 전이표 허용 role |
| 5 | 현재 attempt의 Review 항목이 존재하고 판정이 `APPROVED` | **G4** |
| 6 | 승인 `actor_id` ≠ 현재 attempt의 `TASK_SUBMITTED` `actor_id` | **G5 (SoD)** |

**가드 5 — Review 판정 검사 (최소 구현)**

Review 파일 `.bcos/reviews/<id>-*.md` 의 본문에서 H2 heading 한 줄을 찾는다. 형태는
`(H2 마커) Attempt <현재 attempt> — <임의 텍스트> — APPROVED` 이며, 실제 예시는
`.bcos/reviews/T-004-task-submit-command.md` 7행에 있다.

**이 한 줄만 검사한다.** `### Verdict` 섹션이나 `Criteria Assessment` 표를 읽지 않는다.
attempt 번호와 판정이 같은 줄에 있으므로 정규식 하나로 충분하다.
기존 Review 파일 5개가 모두 이 형식이며, RFC-001 §4의 본문 템플릿과 일치한다.

Review 파일이 없거나, 현재 attempt 항목이 없거나, 그 줄의 판정이 `APPROVED`가 아니면
(예: `CHANGES_REQUESTED`, `BLOCKED`) 거부한다.

**가드 6 — SoD 검사**

`.bcos/events.jsonl`을 읽어 `task`가 대상 id이고 `event`가 `TASK_SUBMITTED`이며
**`attempt`가 현재 attempt와 같은** 이벤트를 찾는다. 그 이벤트의 `actor_id`가
`--actor-id`와 같으면 거부한다.

- **이전 attempt의 submit 이벤트를 참조하면 안 된다.** attempt 일치를 반드시 확인한다.
- 해당 이벤트가 없으면 SoD를 판정할 수 없으므로 거부한다.
- **Report 작성자나 Task 작성자를 SoD 기준으로 쓰지 않는다.** 오직 `TASK_SUBMITTED`
  이벤트의 `actor_id`만 사용한다.

**세 파일에 쓰는 값**

1. **Task frontmatter** — `status: DONE`, `updated`를 이벤트 `ts`와 동일하게.
   **`attempt`는 변경하지 않는다.** 다른 필드와 본문은 한 바이트도 바꾸지 않는다.
2. **`.bcos/events.jsonl`** — 8필드 JSON 한 줄 append.
   ```json
   {"ts":"<ISO8601 UTC ms>","event":"TASK_APPROVED","task":"<id>","attempt":<현재 attempt>,"actor_role":"<role>","actor_id":"<actor-id>","from":"IMPLEMENTED","to":"DONE"}
   ```
3. **`.bcos/state.json`** — `.bcos/tasks/*.md`를 다시 스캔해 `counts` 재계산,
   `current_task`는 재계산 결과, `updated`는 이벤트 `ts`.

**코드 재사용** — `actorArguments`, `readTaskSet`, `persistTransition`,
`frontmatterValue`, `replaceFrontmatterValue`는 이미 존재하며 `approveTask`가 세 번째
호출처가 된다. 그대로 재사용한다. 새 헬퍼는 **이벤트 조회 하나만** 허용한다.

**`src/cli.ts` 단일 파일을 유지한다.** 상한을 250줄에서 **330줄로 조정**한다.
근거는 이 Task의 Out of Scope에 있다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **새 소스 파일 또는 디렉터리** — `src/lifecycle.ts`, `src/core/`, `src/util/` 전부 금지.
  분리를 검토했으나 이번에는 하지 않는다. 헬퍼는 이미 명명된 함수로 분리돼 있고,
  테스트가 `spawnSync` 기반 블랙박스라 파일 분리가 테스트성을 개선하지 않으며,
  330줄은 탐색 문제를 일으키지 않는다. **파일 경계는 두 번째 진입점이 생길 때 만든다.**
- `task block` / `unblock` / `request-changes`
- `bcos init` / `status` / `reindex` / `task create` / `list` / `show`
- **Transition class, StateMachine class, Command registry, Adapter, Factory,
  범용 CLI framework, 전이 정의 테이블**
- **범용 Markdown 파서** — Review에서 읽는 것은 `## Attempt <n> — … — <VERDICT>` 한 줄뿐이다
- `### Verdict` 섹션 파싱, `Criteria Assessment` 표 해석, Finding 분석
- Review 내용의 의미 검증 — 판정 문자열 일치만 확인한다
- YAML·Markdown 라이브러리 도입
- 범용 인자 파서
- 트랜잭션 엔진, 롤백 프레임워크, 저널, 잠금 파일
- **runtime dependency 추가** — devDependency 추가와 기존 버전 변경도 금지
- `package-lock.json` 생성
- 이 저장소의 실제 `.bcos/` 내용 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- **기존 `task start` / `task submit` 동작 변경** — 리팩터링하더라도 동작은 동일해야 한다
- RFC·ADR·README·CLAUDE.md·AGENTS.md 수정
- git add / commit / push

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. `IMPLEMENTED` Task + 현재 attempt의 `APPROVED` Review + 다른 actor의 `TASK_SUBMITTED`
   이벤트가 있을 때 `node dist/cli.js task approve T-100 --actor-role reviewer --actor-id claude-code`
   가 exit 0을 반환한다.
3. 성공 후 frontmatter가 `status: DONE`이고 `updated`가 append된 이벤트의 `ts`와 같으며
   **`attempt` 값이 실행 전과 동일**하다.
4. 성공 후 frontmatter 아래 본문이 실행 전과 **바이트 단위로 동일**하다.
5. 성공 후 `events.jsonl` 줄 수가 정확히 1 증가하고, 추가된 줄의 키가 정확히 8개이며
   값이 `TASK_APPROVED` / 해당 id / 실행 전 attempt / 전달한 role·id / `IMPLEMENTED` / `DONE` 다.
6. 성공 후 `state.json`의 `DONE` 카운트가 1 증가하고 `IMPLEMENTED`가 1 감소하며
   `counts`가 `.bcos/tasks/*.md` 스캔 결과와 일치하고 `current_task`가 `null`이다.
7. 존재하지 않는 Task ID → exit 1, 세 파일 무변경.
8. `status`가 `IMPLEMENTED`가 아닌 Task → exit 1, 무변경.
9. **Review 파일이 없으면** → exit 1, 무변경 (G4).
10. **Review에 현재 attempt 항목이 없으면** → exit 1, 무변경 (G4).
11. **판정이 `CHANGES_REQUESTED`이면** → exit 1, 무변경 (G4).
12. **판정이 `BLOCKED`이거나 그 밖의 값이면** → exit 1, 무변경 (G4).
13. **승인 `actor_id`가 현재 attempt의 submit `actor_id`와 같으면** → exit 1, 무변경 (G5).
14. **현재 attempt의 `TASK_SUBMITTED` 이벤트가 없으면** → exit 1, 무변경 (G5 판정 불가).
15. **이전 attempt의 submit actor와 현재 attempt의 submit actor가 다를 때,
    현재 attempt 기준으로 SoD를 판정한다** — 이전 attempt actor로 승인하면 성공하고,
    현재 attempt actor로 승인하면 거부된다.
16. `--actor-role` 또는 `--actor-id` 누락 → exit 1, 무변경.
17. `--actor-role`이 `worker`이면 → exit 1, 무변경 (RFC §1.2 허용 role).
18. `node dist/cli.js task start` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건 이상.
19. `node dist/cli.js task submit` 의 기존 동작이 변하지 않는다 — 정상 1건 + 실패 1건 이상.
20. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.
21. `npm test` 가 통과하며 기존 31개를 포함해 **45개 이상**의 테스트가 pass한다.
22. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
23. `src/cli.ts`가 **330줄 이하**이고 `src/` 아래에 새 파일이 없다.
24. `git status` 기준 변경 파일이 `src/cli.ts`, `tests/cli.test.ts`, Report 3개뿐이다.
    `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**수정**

- `src/cli.ts`
- `tests/cli.test.ts`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-006-task-approve-command.md` (이 파일)
- `.bcos/prompts/T-006-task-approve-command-codex-prompt.md` (실행 프롬프트)
- `src/cli.ts`
- `tests/cli.test.ts`
- `package.json`
- `docs/rfcs/RFC-001-task-protocol.md` — **§1, §2, §4, §5만.** Appendix는 읽지 않는다
- `.bcos/reviews/T-004-task-submit-command.md` — **fixture 형식 확인용 읽기 전용.** 수정 금지

**쓰기**

- `.bcos/reports/T-006-task-approve-command.md`

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 임시 디렉터리를 만들고
그 안에 `.bcos/tasks/`, `.bcos/reports/`, `.bcos/reviews/`, `.bcos/events.jsonl`,
`.bcos/state.json` fixture를 생성한 뒤 `spawnSync`의 `cwd` 옵션으로 CLI를 실행한다.
**이 저장소의 실제 `.bcos/`를 읽거나 쓰는 테스트는 금지한다.**

| # | 대상 | 기대 |
|---|---|---|
| 1–31 | 기존 테스트 31개 | 전부 그대로 통과 |
| 32 | 정상 approve | exit 0, `status: DONE`, `attempt` 불변, 본문 바이트 동일 |
| 33 | 정상 approve | events 1줄 증가, 8필드, `IMPLEMENTED → DONE` |
| 34 | 정상 approve | `DONE` +1, `IMPLEMENTED` −1, `current_task` = `null` |
| 35 | 없는 Task ID | exit 1, 파일 변경 0 |
| 36 | `IMPLEMENTED`가 아닌 상태 | exit 1, 파일 변경 0 |
| 37 | Review 파일 없음 | exit 1, 파일 변경 0 |
| 38 | Review에 현재 attempt 항목 없음 | exit 1, 파일 변경 0 |
| 39 | 판정이 `CHANGES_REQUESTED` | exit 1, 파일 변경 0 |
| 40 | 판정이 `BLOCKED` | exit 1, 파일 변경 0 |
| 41 | **SoD 위반 — submit actor와 동일** | exit 1, 파일 변경 0 |
| 42 | **`TASK_SUBMITTED` 이벤트 없음** | exit 1, 파일 변경 0 |
| 43 | **attempt 2 상황 — 이전 attempt actor로 승인** | exit 0 |
| 44 | **attempt 2 상황 — 현재 attempt actor로 승인** | exit 1, 파일 변경 0 |
| 45 | `--actor-id` 누락 | exit 1, 파일 변경 0 |
| 46 | `--actor-role: worker` | exit 1, 파일 변경 0 |

43번과 44번은 같은 fixture를 쓴다 — `attempt: 2`, attempt 1의 submit actor는 `worker-a`,
attempt 2의 submit actor는 `worker-b`. `worker-a`로 승인하면 통과하고 `worker-b`로 승인하면
거부되어야 한다. **이 쌍이 "이전 attempt를 잘못 참조하지 않는다"를 증명한다.**

"파일 변경 0"은 실행 전후 `.bcos/` 하위 파일 내용을 문자열로 비교해 확인한다.

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 출력 전문,
정상 approve가 append한 실제 이벤트 줄, **SoD 차단 실행 결과**,
그리고 `task start` · `task submit` 회귀 확인 결과를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수와 Read List 밖에서 읽은 파일,
그리고 완료 후 `src/cli.ts` 줄 수를 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·계정명을 Report에 남기지 않는다.
