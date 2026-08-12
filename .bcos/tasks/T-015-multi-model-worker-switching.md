---
protocol: "0.1"
id: T-015
title: Let the same Task run through either worker runtime without changing any other semantics
status: TODO
attempt: 0
created: 2026-08-12T06:30:00Z
updated: 2026-08-12T06:30:00Z
---

# T-015 — Multi-model Worker Switching

## Objective

**같은 Task를 Codex로도 Claude로도 실행할 수 있게 한다. 그 외에는 아무것도 바꾸지 않는다.**

T-013이 실행 경계(`src/model.ts`)를 만들었지만 조합은 일부러 열지 않았다.
지금 `--worker`는 `codex`만 받는다.

**조사 결과 경계는 이미 준비돼 있다.** `src/model.ts`는 `runtime` 매개변수로
Codex와 Claude를 모두 실행할 수 있고, worker/reviewer 역할을 모르며,
`runModel({ runtime: "claude", … })`는 오늘도 동작한다.
막고 있는 것은 **호출자의 하드코딩 5곳**뿐이다.

이 Task는 그 5곳을 여는 것이 전부다. **provider 추상화가 아니다.**

## Scope

### 1. 조사 결과 — 현재 경계 (저장소 실측)

**`src/model.ts` (113줄)는 이미 runtime 매개변수화돼 있다.**

| | Codex | Claude |
|---|---|---|
| 실행 파일 탐색 | PATH 순회 → `node_modules/@openai/codex/bin/codex.js` | PATH 순회 → `claude.exe` / `claude` |
| `command` | **`process.execPath`** (JS 진입점) | **실행 파일 직접** |
| `args` | `[entry, "exec", "-", "--cd", cwd]` | `["-p", "--output-format", "text"]` |
| `runtimeKind` | `node` | `native` |
| version | `@openai/codex/package.json` 읽기 — **spawn 0회** | `--version` **spawn 1회**, semver 파싱 |
| cwd | `--cd` 인자 **+** spawn `cwd` | spawn `cwd`만 (cwd 플래그 없음) |
| stdin | `exec -` 가 stdin 지시 | `-p` + 파이프 |
| timeout | `setTimeout` → `kill()` — **공통** | 동일 |
| env | 호출자가 지정 — **공통** | 동일 |
| stdout/stderr | `on("data")` 계수 + 부모 전달 — **공통** | 동일 |

**공통**: spawn 호출·`shell:false`·stdin 주입·타임아웃·바이트 계수·first response·
종료 확정·오류 분류(`not_found` / `spawn_failed`).
**다름**: 실행 파일 위치·`command` 대상·argv·`runtimeKind`·version 취득 방식·cwd 전달 방식.

**중요 — 다른 것은 전부 `modelCommand()` 안에 갇혀 있다.** 호출자는 `runtime` 하나만 준다.

### 2. 제약 위치 — 정확히 5곳

| 위치 | 내용 |
|---|---|
| `src/runner.ts:75` | `if (options.worker !== "codex") throw` |
| `src/runner.ts:120` | `modelCommand({ runtime: "codex", … })` 하드코딩 |
| `src/runner.ts:177` | dry-run 반환값에 `runtime: "codex", runtimeKind: "node"` 하드코딩 |
| `src/runner.ts:179` | `runModel({ runtime: "codex", … })` 하드코딩 |
| `src/workflow.ts:171` | `if (options.worker !== "codex") return finish("protocol", …)` |

`src/cli.ts`의 파서는 `--worker` 값을 **문자열로 그대로 넘긴다** — 제약이 없다.
따라서 **CLI 표면을 바꿀 필요가 없다.**

**Reviewer 제약은 `src/workflow.ts:177`(`--reviewer must be claude`)과
`src/reviewer.ts:79`(`runtime: "claude"` 하드코딩)에 따로 있다.
이 Task는 그것을 건드리지 않는다.**

### 3. 발견한 결함 — dry-run telemetry가 runtime을 거짓말한다

`src/runner.ts:144`가 telemetry 기본값에 **`worker_runtime: "node"`를 하드코딩**한다.
실제 실행 경로(`:187`)는 `result.runtimeKind`로 덮어쓰지만 **`--dry-run`은 덮어쓰지 않는다.**

지금은 worker가 codex뿐이라 우연히 맞지만, Claude를 열면
`--worker claude --dry-run`이 **`worker_runtime=node`** 를 출력한다 — 거짓이다.

**T-013의 `worker_runtime` 의미 충돌과 같은 종류의 결함이다.** T-015가 고친다.
`worker_runtime`은 언제나 **실행 형태**(`node` / `native`)이고
`worker_name`은 언제나 **실행기 정체**(`codex` / `claude`)다.

### 4. 사용자 계약 — 새 옵션 0개

```
bcos task execute T-xxx --worker codex --actor-id <id>
bcos task execute T-xxx --worker claude --actor-id <id>
```

`--provider` · `--backend` · `--model-adapter` · registry · 설정 파일 **전부 만들지 않는다.**
사용자는 **이름 두 개**(`codex` / `claude`) 중 고른다.
`node` / `native` 같은 내부 구분은 **사용자 선택지로 노출하지 않는다** — 기록에만 남는다.

허용 집합은 **닫힌 두 값**이다. 그 밖의 값은 거부한다.

### 5. Worker stdin 호환성 — 의미는 같고, 한 줄만 다르다

**같은 Task·같은 Context·같은 피드백이면 두 runtime의 stdin은 한 줄을 빼고 동일하다.**

`src/runner.ts`의 `buildPreamble`이 preamble에 실행기 이름을 적는다.

```
BCOS WORKER EXECUTION

  task:   T-xxx
  worker: codex        ← 이 줄만 다르다 (claude면 claude)
  report: .bcos/reports/...
```

그 외 — preamble 본문·Context Package·`--- REVIEW OF PREVIOUS ATTEMPT ---`·
`--- PREVIOUS HOST VERIFICATION FAILURE ---` — **전부 바이트 단위로 같다.**

**모델별 프롬프트를 만들지 않는다.** 모델별 stdin 마커도, 모델별 Task 의미도 없다.

**바이트 완전 동일을 요구하지 않는 이유** — preamble의 `worker:` 줄은 정보이지
지시가 아니다. 그 줄을 지우면 **기존 codex 경로의 stdin이 바뀌어** 지금까지 유지해 온
불변성이 깨진다. 대신 **차이를 정확히 한 줄로 못박고 그것을 테스트로 고정한다.**

### 6. 저장소 지침 파일 — 이 저장소에서만 발생하는 충돌 (중요)

두 실행기는 **서로 다른 저장소 지침 파일을 자동으로 읽는다.**

| runtime | 자동 로드 | 이 저장소에서의 내용 |
|---|---|---|
| Codex | `AGENTS.md` | **worker 운영 규칙** — 의도한 그대로 |
| Claude | `CLAUDE.md` | *"하지 않는 일: 대규모 구현 코드 작성 — 실제 구현은 Codex가 담당한다"* (`CLAUDE.md:11`) |

**즉 이 저장소에서 Claude를 worker로 띄우면, Claude는 자기 역할이 manager·reviewer이며
구현 코드를 쓰지 않는다고 읽는다.** stdin의 worker 계약과 정면으로 충돌한다.

**이것은 BCOS 코드 문제가 아니다.** 이 저장소의 지침 구성 문제이며,
일반 사용자의 저장소에는 없을 수 있다.

**T-015는 이것을 해결하지 않는다.** `CLAUDE.md`는 manager 소유 문서이고
그 역할 분리는 지금 이 세션의 운영 규칙이기도 하다. 변경 여부는 별도 Human 결정이다.
**T-015의 테스트는 전부 가짜 worker를 쓰므로 영향을 받지 않는다.**

**실제 Claude worker dogfooding 전에 이 충돌을 먼저 해소해야 한다** — Notes 참조.

### 7. Nested worker guard — 이미 runtime 중립

`src/runner.ts:181`이 `env: { ...process.env, BCOS_WORKER_SESSION: "1" }`을 준다.
**runtime 분기 없이 모든 worker에 적용된다.** `src/reviewer.ts:78`은 반대로
reviewer 환경에서 그 값을 **삭제**한다. `src/workflow.ts:112`가 그것을 보고 중첩을 막는다.

**runtime별 중첩 보호를 만들지 않는다.** 지금 구조가 이미 옳다.

### 8. 출력 · telemetry 의미 — 정의는 같고 값은 다르다

`ModelResult`가 두 runtime에 **같은 정의**를 준다 — `exitCode` · `durationMs` ·
`stdoutBytes` · `stderrBytes` · `firstResponseMs` · `timedOut` · `error` · `errorCode`.

**같은 값을 요구하지 않는다.** 같은 뜻을 요구한다.

**새 stdout telemetry 키를 만들지 않는다.** 기존 키가 자동으로 따라간다.

| 키 | codex | claude |
|---|---|---|
| `worker_name` | `codex` | `claude` |
| `worker_runtime` | `node` | **`native`** |
| 나머지 worker_* | 정의 동일 | 정의 동일 |

### 9. Run artifact — 이미 올바르다

`src/workflow.ts:236,297`이 `run.worker_name = workerResult.runtime`,
`run.worker_version = workerResult.version`을 기록한다.
`runtime`이 `claude`면 자동으로 `worker_name: "claude"`가 된다. **코드 변경 불필요.**

`worker_runtime`을 정체 저장에 **재사용하지 않는다** (T-013 A001 정정 유지).

### 10. 전환 이력 — 새 필드도 새 이벤트도 필요 없다

run artifact가 이미 `task_id` · `attempt` · `worker_name` · `worker_version`을 담는다.
실측 확인:

```
T-900 a1 codex 0.146.0
T-900 a2 codex 0.146.0
T-014 a1 codex 0.147.0
```

**attempt별 실행기와 버전이 그대로 재구성된다.** `worker_switch_count` 같은 계산도,
"worker switched" 이벤트도 만들지 않는다 (T-009 계산 금지 원칙).

### 11. Lifecycle — runtime 선택은 lifecycle을 바꾸지 않는다

| 질문 | 답 |
|---|---|
| attempt 사이에 worker를 바꿀 수 있는가 | **그렇다** |
| 같은 `IN_PROGRESS` attempt에서 검증 실패 후 바꿀 수 있는가 | **그렇다** |
| worker 전환이 attempt를 올리는가 | **아니다** |
| runtime이 바뀌면 `actor_id`도 바꿔야 하는가 | **아니다 — 별개 축이다** |

attempt는 오직 기존 전이(`start` · `request-changes`)로만 변한다 (RFC-001 §1.4).

**`actor_id`와 runtime을 결합하지 않는다.** `actor_id`는 SoD 정체성이고
runtime은 실행기다 — T-013이 세운 4축 분리를 유지한다.
`--worker claude --actor-id codex-cli` 같은 조합은 **감사 기록이 오해를 부르지만
BCOS는 막지 않는다.** `actor_id`가 자기 신고라는 RFC §7의 한계와 같은 성격이다.
**규칙을 새로 만들지 않고 한계로 기록한다.**

### 12. Host Verification — runtime 중립을 강제한다

두 runtime 모두 **같은 경로**로 흐른다.

```
worker → report_check(G3) → Host Verification → submit gate
```

`src/workflow.ts`의 검증 단계는 worker runtime을 **읽지 않는다.**
**worker가 runtime을 바꾼다고 자기 완료를 선언할 권한을 얻지 못한다.**
worker 샌드박스 자체 테스트는 여전히 비권위적이고, Host 검증이 권위다.

### 13. 피드백 합성 — 이미 runtime 중립

| 메커니즘 | 판정 |
|---|---|
| T-011 Review 피드백 (`runner.ts:108-110`) | `attempt >= 2` 조건만 본다 — **runtime 무관** |
| T-014 검증 실패 피드백 (`runner.ts:113-118`) | `readRuns` + stage 상태만 본다 — **runtime 무관** |

따라서 **Codex가 실패한 검증 증거를 Claude가 그대로 받는다.** 사람의 번역이 없다.
반대 방향도 같다. **두 메커니즘을 수정하지 않는다** — 그대로 두는 것이 정답이다.

### 14. 결정성 — 두 가지를 구분한다

**BCOS 입력 결정성** — 같은 Task·Context·피드백 → 같은 stdin 바이트(§5의 한 줄 제외).
**요구한다.**

**모델 출력 결정성** — Codex와 Claude가 같은 결과를 낸다.
**요구하지 않는다. 요구할 수 없다.**

거짓 교차모델 결정성 요구를 만들지 않는다. 벤치마크 비교는 T-016 이후
**원시 결과 지표**로 하며, 동일 생성물을 기대하지 않는다.

### 15. 실패 · 폴백 금지

| 상황 | 동작 |
|---|---|
| 선택한 runtime 실행 파일 없음 | `error: "not_found"` · exit 1 · **즉시 실패** |
| 권한 오류 | `errorCode` 보존 → workflow가 `permission` / `environment`로 분류 |
| timeout | `timedOut: true` · 자식 kill |
| nonzero exit | 그대로 보고 |
| 알 수 없는 worker 값 | `protocol` 오류로 거부 |

**어떤 경우에도 다른 runtime으로 조용히 대체하지 않는다.**
`--worker claude`를 골랐는데 Claude가 없으면 **실패한다. Codex를 대신 돌리지 않는다.**
run artifact와 telemetry는 **실제로 선택된 runtime**을 기록한다.

fallback · 자동 재시도 · 라우팅은 **범위 밖**이다.

### 16. Claude worker 권한 — 우회하지 않는다

조사 결과 `.claude/settings.json`에는 **permissions 블록이 없다**(플러그인 설정뿐).
Claude CLI는 `--permission-mode`(`acceptEdits` · `bypassPermissions` 등)와
`--allowedTools`를 제공하지만, **BCOS의 현재 argv에는 권한 플래그가 없다.**

**T-015는 권한 플래그를 추가하지 않는다.**
`--dangerously-skip-permissions` · `bypassPermissions` · `danger-full-access`
**전부 금지**이며, `acceptEdits`도 이 Task에서 넣지 않는다 —
worker의 파일 편집 권한은 **사용자 자신의 Claude 설정** 문제이지
BCOS가 조용히 완화할 것이 아니다.

**실패는 안전하게 난다.** Claude가 파일을 못 쓰면 Report가 없고,
G3(report_check)가 submit을 막는다.

**알려진 한계** — BCOS는 **권한 실패와 일반 실패를 구별하지 못한다.**
관측할 수 있는 것은 exit code·바이트 수·Report 부재뿐이다.
이 한계를 Report에 기록한다. 구별 기능을 이번에 만들지 않는다.

### 17. Worker / Reviewer 같은 runtime 정책 — **허용한다 (정책 A)**

Worker가 Claude이고 Reviewer도 Claude인 조합을 **막지 않는다.**

**근거 — 현재 프로토콜이 증명하는 것은 정체성 분리뿐이다.**

- RFC-001 G5: *"승인 Actor가 제출 Actor와 다르다"* — `actor_id` 비교다
- `README.md:20`: *"**Self-verification bias.** Whoever wrote the code declares it done."*
- `docs/architecture.md:33`: *"이 직무 분리가 자기검증 편향을 제거하는 유일한 장치다"*

셋 다 **"누가 썼는가"**를 말한다. **모델 다양성을 요구하는 규정은 저장소 어디에도 없다.**

**SoD가 보장하는 것** — 제출한 `actor_id`가 승인하지 못한다. 승인 행위에 다른 주체가 개입한다.
**SoD가 보장하지 않는 것** — 판단의 독립성. 같은 모델이 양쪽에 서면 같은 맹점을 공유할 수 있다.
**runtime을 다르게 해도 완전한 독립은 아니다** — 둘 다 LLM이다. 과장하지 않는다.

**모델 다양성이 제품 요구라면 명시적 규칙으로 따로 세워야 하며, G5에 끼워 넣지 않는다.**
벤치마크 공정성이 다양성을 요구한다면 그것은 **T-016의 측정 요건**이지
lifecycle 가드가 아니다.

**따라서 이번에는 규칙을 추가하지 않는다.** 경고도 넣지 않는다 — 근거 없는 경고는 소음이다.

## Out of Scope

- **Reviewer switching** — `--reviewer`는 `claude`만 유지한다. `--reviewer codex` 거부 유지
- `src/model.ts` 수정 — 이미 runtime 매개변수화돼 있다
- `src/context.ts` · `src/run.ts` · `src/cli.ts` 수정
- `CLAUDE.md` · `AGENTS.md` 수정 (§6의 충돌은 별도 Human 결정)
- 새 CLI 옵션 (`--provider` · `--backend` · `--model-adapter` 등)
- provider registry · plugin · 동적 모델 탐색 · 설정 파일
- API 기반 실행 (OpenAI API · Anthropic API)
- 토큰·비용 수집 · pricing
- 자동 라우팅 · 최저가 선택 · 품질 라우팅 · **자동 fallback** · 로드밸런싱
- 병렬 worker · ensemble voting
- 벤치마크 계산 (T-016 · T-017)
- 모델별 프롬프트 템플릿
- 자격증명 관리 · API key 저장 · 권한 우회
- worker/reviewer runtime 동일 금지 규칙
- 전환 이벤트 · 전환 로그 · `worker_switch_count`
- 새 source file · class · registry · factory · strategy

## Acceptance Criteria

### A. 선택과 거부 (1–8)

1. `--worker codex`가 **기존과 동일하게** 동작한다.
2. `--worker claude`가 `task execute`에서 **수락**된다.
3. `--worker claude`가 `task run`에서 **수락**된다.
4. `codex` · `claude` 외의 값은 `task execute`에서 **거부**된다.
5. `codex` · `claude` 외의 값은 `task run`에서 **거부**된다.
6. 거부 시 **파일이 하나도 바뀌지 않는다**.
7. `--reviewer claude`가 그대로 동작한다.
8. `--reviewer codex`가 **여전히 거부**된다.

### B. 실행 계약 (9–18)

9. Codex argv가 `[<codex.js>, "exec", "-", "--cd", <root>]`로 **불변**이다.
10. Claude argv가 `["-p", "--output-format", "text"]`다.
11. Codex는 `process.execPath`로, Claude는 실행 파일을 **직접** 띄운다.
12. Codex `runtimeKind`가 `node`, Claude가 `native`다.
13. **선택한 runtime이 실제로 실행된다** — 다른 실행기가 실행되지 않는다.
14. 두 runtime 모두 `shell: false`로 실행된다.
15. 두 runtime 모두 stdout·stderr를 **부모로 전달**한다.
16. 두 runtime 모두 timeout 시 kill되고 `timedOut`이 참이다.
17. 두 runtime 모두 nonzero exit를 그대로 보고한다.
18. 두 runtime 모두 실행 파일이 없으면 `error: "not_found"`다.

### C. 폴백 금지 (19–22)

19. `--worker claude`인데 Claude가 없으면 **실패**하고 **Codex를 실행하지 않는다**.
20. `--worker codex`인데 Codex가 없으면 **실패**하고 **Claude를 실행하지 않는다**.
21. run artifact의 `worker_name`이 **실제 선택된 runtime**이다.
22. telemetry의 `worker_name`이 **실제 선택된 runtime**이다.

### D. stdin 의미 동일성 (23–28)

23. 같은 Task·Context·피드백에서 두 runtime의 stdin이 **preamble `worker:` 한 줄을 제외하고 동일**하다.
24. Context Package SHA-256이 두 runtime에서 **동일**하다.
25. 모델별 프롬프트·마커가 **0건**이다.
26. Review 피드백 블록이 두 runtime 모두에 **동일하게** 전달된다.
27. 검증 실패 피드백 블록이 두 runtime 모두에 **동일하게** 전달된다.
28. 블록 순서가 두 runtime에서 **동일**하다.

### E. 환경 · 중첩 가드 (29–32)

29. Codex worker 환경에 `BCOS_WORKER_SESSION=1`이 있다.
30. **Claude worker 환경에도 `BCOS_WORKER_SESSION=1`이 있다.**
31. reviewer 환경에는 여전히 **없다**.
32. 중첩 가드가 두 runtime 모두에서 동작한다.

### F. 관측 (33–38)

33. run artifact `worker_name`이 codex 실행에서 `codex`다.
34. run artifact `worker_name`이 claude 실행에서 `claude`다.
35. run artifact `worker_version`이 두 runtime 모두 기록된다.
36. **`--dry-run`의 `worker_runtime`이 선택한 runtime의 실행 형태를 반영한다** (§3 결함 수정).
37. `worker_runtime`을 정체 저장에 재사용하지 **않는다**.
38. **새 stdout telemetry 키가 0개**이고 기존 키 집합이 불변이다.

### G. Lifecycle 보존 (39–44)

39. runtime 선택이 attempt를 **바꾸지 않는다**.
40. attempt 사이에 worker를 바꿔도 lifecycle 이벤트가 **추가되지 않는다**.
41. 같은 `IN_PROGRESS` attempt에서 검증 실패 후 worker를 바꿀 수 있다.
42. Host Verification 경로가 두 runtime에서 **동일**하다.
43. 검증 실패 시 submit이 두 runtime 모두에서 **막힌다**.
44. G3 · G5가 두 runtime 모두에서 그대로 동작한다.

### H. 경계 · 품질 (45–50)

45. **새 source file 0개** · `src/model.ts` · `src/context.ts` · `src/run.ts` · `src/cli.ts` **무변경**.
46. `src/runner.ts` **205줄 이하** · `src/workflow.ts` **330줄 이하**.
47. `class` · `interface` · registry · plugin · factory **0건**.
48. `dependencies` 0개 · `devDependencies` 2개.
49. `npm run build` exit 0 · `npm test` **실패 0건**, 총 **272개 이상**.
50. 테스트 삭제·skip **0건**. 실제 Codex·Claude를 테스트에서 호출하지 **않는다**.

**총 50개.**

## Expected Files

**수정**

- `src/runner.ts` — worker runtime 매개변수화 (5곳 중 4곳) + §3 dry-run telemetry 결함 수정
- `src/workflow.ts` — worker 허용 집합을 닫힌 두 값으로
- `tests/cli.test.ts` — 신규 테스트 + 아래 두 기존 테스트의 **입력값** 교체

**생성**

- `.bcos/reports/T-015-multi-model-worker-switching.md`

**기존 테스트 2건의 입력값 교체 — 완화가 아니다**

`task run rejects unsupported workers without changes`(1563)와
`task execute rejects unsupported workers`(1946)는 현재 **`claude`를 "지원하지 않는 값"으로**
쓴다. `claude`가 지원되므로 그 자리에 **실제로 지원하지 않는 값**을 넣는다.
**단언은 그대로 유지한다** — 거부되고 파일이 바뀌지 않아야 한다.
`review rejects unsupported reviewer`(2108)는 **손대지 않는다**.

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-015-multi-model-worker-switching.md` (이 파일)
- `docs/rfcs/RFC-001-task-protocol.md` — **§1.3 G5 · §1.4 attempt. 읽기 전용**
- `docs/benchmarks/TELEMETRY.md` — **읽기 전용**
- `src/model.ts` — **읽기 전용.** 수정하지 않는다
- `src/runner.ts`
- `src/workflow.ts`
- `src/reviewer.ts` — **읽기 전용.** reviewer 경로 확인용
- `tests/cli.test.ts`
- `package.json`

**쓰기**

위 "수정"·"생성" 목록뿐이다. `docs/`는 **읽기 전용**이다.

## Test Requirements

**현재 256개.** 신규 **16개 이상**, 목표 총 **272개**, AC 하한 **272개**.
(하한이 목표를 넘지 않는다.)

**실제 Codex · Claude를 호출하지 않는다.** 기존 `--worker-command` fake fixture를 쓴다.

| # | 신규 테스트 |
|---|---|
| 1 | `--worker claude`가 `task execute`에서 수락된다 |
| 2 | `--worker claude`가 `task run`에서 수락된다 |
| 3 | Claude worker 실행 시 run artifact `worker_name`이 `claude`다 |
| 4 | Claude worker 실행 시 `worker_version`이 기록된다 |
| 5 | Claude worker 환경에 `BCOS_WORKER_SESSION=1`이 있다 |
| 6 | Claude worker의 stdout·stderr가 부모로 전달된다 |
| 7 | Claude worker timeout이 kill되고 `timedOut`이 참이다 |
| 8 | Claude worker nonzero exit가 그대로 보고된다 |
| 9 | 두 runtime의 stdin이 preamble `worker:` **한 줄만** 다르다 |
| 10 | Context Package SHA가 두 runtime에서 동일하다 |
| 11 | Review 피드백이 Claude worker에도 전달된다 |
| 12 | 검증 실패 피드백이 Claude worker에도 전달된다 |
| 13 | **폴백 금지** — Claude 실행 파일이 없으면 실패하고 Codex가 실행되지 않는다 |
| 14 | attempt 사이 worker 전환이 run artifact로 재구성된다 (a1 codex · a2 claude) |
| 15 | 같은 `IN_PROGRESS` attempt에서 검증 실패 후 worker 전환이 가능하다 |
| 16 | **`--dry-run`의 `worker_runtime`이 선택한 runtime을 반영한다** (§3 결함) |

**real-shape launch fixture — runtime당 하나씩 (필수)**

실제 CLI를 실행하지 않고 **`modelCommand()`가 만드는 argv 모양**을 runtime별로 고정한다.

```
codex  → command = <node>,  args = [<codex.js>, "exec", "-", "--cd", <root>]
claude → command = <claude>, args = ["-p", "--output-format", "text"]
```

T-013이 이미 이 두 테스트를 갖고 있다 — **삭제하지 말고 유지**하며,
worker 경로에서도 같은 모양이 나오는지 확인한다.

**회귀** — 기존 256개 전부 통과. 특히 `task execute` · `--review` · rework 루프 ·
`task status` · run artifact · 검증 피드백 · nested 가드.

**금지** — 새 테스트 프레임워크 · 기존 assertion 완화 · 테스트 삭제/skip ·
실제 모델 호출 · 네트워크 접근.

## Benchmark Telemetry

**새 telemetry 키를 추가하지 않는다.** 기존 키가 runtime을 따라간다.

| 키 | 변화 |
|---|---|
| `worker_name` | `codex` → 선택에 따라 `codex` \| `claude` |
| `worker_runtime` | `node` → 선택에 따라 `node` \| `native`. **dry-run 결함 수정 포함** |

`docs/benchmarks/TELEMETRY.md`는 **수정하지 않는다** —
`worker_name`은 이미 *"`--worker` 값"*, `worker_runtime`은 이미 *"worker 실행 형태"*로
정의돼 있어 두 runtime을 그대로 포괄한다.

token / cost는 **`blocked` 유지**. argv를 바꿔 machine-readable 출력을 요청하지 않는다.
**비율·효율·절감률 금지.**

## Notes — 실제 Claude worker dogfooding 전에 해결할 것

**이 저장소에서는 아직 Claude를 실제 worker로 띄우면 안 된다.**

1. **`CLAUDE.md` 역할 충돌** (§6) — Claude가 자동으로 읽는 문서가
   *"실제 구현은 Codex가 담당한다"*고 지시한다. worker 계약과 충돌한다.
   **Human이 결정할 사항이다** — `CLAUDE.md`를 조정할지, 별도 저장소에서 검증할지.
2. **권한** (§16) — `.claude/settings.json`에 permissions 블록이 없다.
   파일 편집이 막히면 Report가 없고 G3에서 멈춘다. 안전하지만 진행은 못 한다.

**따라서 T-015 구현 자체는 기존 Codex worker로 수행한다.**
새 축 두 개(구현 + 실제 Claude worker)를 동시에 처음 검증하지 않는다 —
T-012·T-013에서 쓴 것과 같은 원칙이다.

**T-015 구현이 승인된 뒤, 실제 Claude worker의 첫 실행은 위 두 항목을 해소한 다음
작은 probe Task로 한다.** T-016 Benchmark Harness를 첫 실험 대상으로 삼지 않는다 —
T-016은 그 자체가 새 축이고, 실패 시 원인이 둘로 갈린다.
