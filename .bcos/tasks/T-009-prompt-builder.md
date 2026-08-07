---
protocol: "0.1"
id: T-009
title: Build the worker prompt instead of hand-writing one per task
status: DONE
attempt: 1
created: 2026-08-06T04:45:00Z
updated: 2026-08-07T04:48:58.268Z
---

## Objective

여덟 Task 동안 사람이 Task마다 프롬프트 파일을 손으로 썼다. 2,953자에서 5,642자로
**91% 늘었다.** 그런데 그 내용은 전부 다른 곳에 이미 있다.

| 프롬프트가 적는 것 | 이미 있는 곳 |
|---|---|
| worker 정체·금지 사항·Ponytail·Report 포맷·완료 정의 | `AGENTS.md` (177줄, Context에 포함) |
| 읽을 파일·만들 것·하지 말 것·검증할 것 | **Task 문서 자체** (Context에 포함) |

**여덟 Task 전부 Read List에 자기 자신을 넣었다.** 즉 worker는 Task 문서 전문을
이미 받고 있다. 프롬프트는 그것을 다시 요약한 사본이다.

T-009는 그 사본을 없앤다. Runner가 **고정 preamble + Context Package**만 보낸다.
Task마다 쓰던 프롬프트 파일이 사라진다.

**이 Task가 제거하는 수동 단계는 정확히 하나** — Task마다 프롬프트를 손으로 쓰는 일.

부수 효과로 실패 경로 3종(프롬프트 없음 · 2개 · 본문 비어 있음)이 함께 사라진다.

## Scope

`src/runner.ts`를 수정한다. **새 소스 파일을 만들지 않는다.**

- [ ] `.bcos/prompts/` 탐색과 `---` 본문 추출을 **삭제한다**
- [ ] 고정 preamble을 만드는 함수를 `src/runner.ts`에 둔다
- [ ] Task의 Read List에 **Task 파일 자신이 없으면 실패**한다
- [ ] worker 첫 출력까지의 시간을 잰다
- [ ] 종료 요약에 Telemetry 필드를 고정 형식으로 출력한다
- [ ] dry-run 요약에도 같은 형식을 쓴다
- [ ] **`--timeout` 기본값을 1,800초로 둔다** (T-008 Review F-1)

**기본 timeout 1,800초** — 지금은 `--timeout`을 생략하면 타이머가 없어 멈춘 worker를
무한히 기다린다. 실측된 Task 소요는 437 · 461 · 670 · **1,037초**였다(사람 단계 포함).
600초를 기본값으로 두면 **T-006은 정상 작업 중에 죽었을 것이다.** 1,800초는 관측된
최댓값의 약 1.7배이며, 무한 대기를 없애면서 정상 작업을 죽이지 않는 가장 작은 값이다.
`--timeout`으로 사용자가 언제든 바꾼다.

**preamble 형식** (`<>` 자리만 값이 들어간다. 그 밖은 모든 Task에서 동일하다)

```
BCOS WORKER EXECUTION

  task:   <id>
  worker: <worker>
  report: .bcos/reports/<Task 파일명>

너는 이 저장소의 worker다. actor_role: worker.

CONTEXT PACKAGE 안에 Task 문서가 있다. 그것이 네 계약이다. 먼저 끝까지 읽어라.
행동 규칙은 같은 패키지의 AGENTS.md에 있다.

CONTEXT PACKAGE 안의 파일이 네가 읽어야 할 전부다.
그 목록 밖의 파일을 임의로 열지 마라. 저장소 전체를 탐색하지 마라.
git 명령을 실행하지 마라. bcos 명령을 실행하지 마라.
승인을 시도하지 마라. 독립 reviewer가 검토한다.

Task의 Acceptance Criteria를 전부 충족했을 때만 완료라고 보고하라.
막히면 추측하지 말고 멈추고 무엇이 막혔는지 적어라.

작업을 마치면 위 경로에 Report를 쓰고 멈춰라.

--- CONTEXT PACKAGE ---
<buildContextPackage() 출력 전문>
```

**타임스탬프를 넣지 않는다.** 같은 입력이면 stdin 바이트가 동일해야 한다.

**Read List 자기 포함 검사** — Task 문서가 Context에 없으면 worker에게 계약이
전달되지 않는다. Context Package 본문에서 Task 파일 경로를 찾지 못하면 실패한다.

**Telemetry 출력 형식** — `docs/benchmarks/TELEMETRY.md`의 키를 그대로 쓴다.
한 줄에 하나, `telemetry ` 접두어를 붙여 worker 출력과 구분한다.

```
telemetry task_id=T-009
telemetry worker_name=codex
telemetry worker_runtime=node
telemetry context_files=9
telemetry context_bytes=91234
telemetry context_lines=2560
telemetry context_chars=88904
telemetry context_sha256=<hex>
telemetry stdin_bytes=93000
telemetry stdin_sha256=<hex>
telemetry worker_timeout_seconds=none
telemetry first_worker_response_ms=1842
telemetry worker_duration_ms=93217
telemetry worker_exit_code=0
telemetry worker_timed_out=false
telemetry worker_stdout_bytes=41233
telemetry worker_stderr_bytes=0
telemetry retry_count=0
telemetry runner_transitions_caused=0
```

dry-run에서는 프로세스를 띄우지 않으므로 실행 관련 4개
(`first_worker_response_ms` · `worker_duration_ms` · `worker_exit_code` ·
`worker_stdout_bytes` · `worker_stderr_bytes`)를 출력하지 않는다.
**0으로 채우지 않는다.** 없는 값과 0은 다르다.

`worker_timeout_seconds`는 `--timeout`이 없으면 `none`이다.

## Out of Scope

**아래를 만들면 이 Task는 실패다.**

- **템플릿 엔진 · 플레이스홀더 문법 · 조건 분기 · 반복 구문** — preamble은 상수 문자열과
  값 3개의 연결이다. 그 이상이 필요하면 설계가 틀린 것이다
- **Task 문서 파싱** — Scope·AC·Out of Scope를 뽑아 프롬프트에 옮기지 않는다.
  Task 문서는 Context Package 안에 **전문 그대로** 들어간다
- **`.bcos/prompts/` 디렉터리 삭제** — 여덟 Task의 기록이다. 읽지 않을 뿐 지우지 않는다
- **Prompt 파일 fallback** — "파일이 있으면 그것을 쓴다"를 만들지 않는다. 출처는 하나다
- `bcos task prompt` 같은 새 명령 — preamble은 상수라 미리 볼 이유가 없다
- **Telemetry 저장** — 파일·JSON·DB에 쓰지 않는다. **출력만 한다.**
  저장은 T-012 Benchmark Runner의 일이다
- **Telemetry 계산** — 비율·개선율·절감률·합계 이외의 파생값을 만들지 않는다
- **Token · Cost 수집** — worker 출력을 해석해야 한다. T-010
- **`REVIEW_STARTED` 등 새 이벤트** — RFC-001 §5 변경이다
- **Report·Review 산문 파싱** — AC 수·테스트 수·Findings 수를 뽑지 않는다
- **`## Benchmark Telemetry`를 필수 섹션으로 만들기** — G2 검증과 기존 여덟 Task를
  전부 고쳐야 한다. **선택 섹션으로 둔다**
- 두 번째 worker · `WorkerAdapter` · Factory · Plugin · Queue · Retry
- **셸 실행** — `shell: true`, `cmd /c`, 셸 문자열 조립
- 새 소스 파일 — `src/`는 `cli.ts` · `context.ts` · `runner.ts` 셋을 유지한다
- **`src/context.ts` 수정** — `buildContextPackage()`를 호출만 한다
- **runtime dependency 추가** · `package-lock.json` 생성
- **기존 `task start` / `submit` / `approve` / `context` 동작 변경**
- 이 저장소의 실제 `.bcos/` 변경 — **테스트는 임시 디렉터리에서만 동작한다**
- **테스트에서 실제 Codex 호출** — 가짜 worker fixture를 쓴다
- RFC·ADR·README·CLAUDE.md·AGENTS.md·`docs/benchmarks/TELEMETRY.md` 수정
- git 명령 실행 및 git add / commit / push

## Acceptance Criteria

1. `npm run build` 가 exit 0으로 성공한다.
2. `.bcos/prompts/`에 파일이 **하나도 없어도** `task run --dry-run`이 exit 0이다.
3. `.bcos/prompts/`에 파일이 **두 개 있어도** 결과가 달라지지 않는다 — 읽지 않는다.
4. 조립된 stdin에 Task ID, worker 종류, Report 경로가 포함된다.
5. 조립된 stdin에 "Task 문서가 계약"이라는 지시가 포함된다.
6. 조립된 stdin에 Context 밖 파일 금지·저장소 탐색 금지 지시가 포함된다.
7. 조립된 stdin에 git 금지·bcos 명령 금지·승인 시도 금지 지시가 포함된다.
8. 조립된 stdin에 Report 경로와 "마치면 멈춰라"가 포함된다.
9. 조립된 stdin에 Context Package가 **정확히 한 번** 포함된다.
10. 조립된 stdin에 Task 문서 본문이 **정확히 한 번** 포함된다 (Context Package 경유).
11. 조립된 stdin에 `AGENTS.md` 본문이 포함된다 (Read List 경유).
12. Context Package 안의 파일 순서가 Read List 기재 순서와 같다 — T-007 동작 유지.
13. **조립된 stdin에 타임스탬프가 없다.**
14. **같은 입력으로 dry-run을 두 번 실행하면 stdin SHA-256이 동일하다.**
15. **서로 다른 두 Task의 preamble에서 `<>` 자리 3개만 다르다** — 나머지 줄은 동일하다.
16. Task의 Read List에 Task 파일 자신이 없으면 exit 1이다.
17. 그 실패 메시지가 무엇이 빠졌는지 말한다.
18. dry-run 출력에 command·args·cwd가 나온다.
19. **dry-run 출력에 stdin 본문이 포함되지 않는다.**
20. dry-run 출력에 `telemetry ` 줄이 나온다.
21. dry-run 출력에 실행 관련 5개 필드가 **나오지 않는다.**
22. 실제 실행 출력에 `telemetry ` 줄이 나온다.
23. `telemetry` 줄의 키가 `TELEMETRY.md`에 정의된 키와 정확히 일치한다.
24. `telemetry first_worker_response_ms`가 worker 첫 출력 시점을 반영한다 —
    2초 지연 worker에서 1,000ms보다 크다.
25. `telemetry worker_duration_ms`가 `first_worker_response_ms`보다 크거나 같다.
26. `telemetry worker_exit_code`가 fake worker의 종료 코드와 같다.
27. `telemetry worker_timed_out`이 timeout 발생 시 `true`, 아니면 `false`다.
28. `telemetry worker_timeout_seconds`가 `--timeout` 없으면 **`1800`**이다.
29. `--timeout` 없이도 타이머가 걸린다 — 짧은 값으로 대체해 child 종료를 확인한다.
30. `--timeout <n>`이 기본값을 덮어쓴다.
31. `--timeout`이 0 · 음수 · 소수 · 비숫자면 exit 1이고 **기본값으로 넘어가지 않는다.**
32. `telemetry context_sha256`과 `stdin_sha256`이 dry-run과 실제 실행에서 같다.
33. `telemetry retry_count=0`과 `runner_transitions_caused=0`이 항상 출력된다.
34. **Telemetry 출력에 비율·개선율·절감률 키가 없다** — `_rate` · `_ratio` ·
    `efficiency` · `improvement` · `savings` · `reduction` 문자열이 소스에 없다.
35. **Telemetry가 어떤 파일에도 기록되지 않는다** — 실행 후 fixture 파일 수 불변.
36. 존재하지 않는 Task ID → exit 1.
37. `status`가 `IN_PROGRESS`가 아닌 Task → exit 1.
38. Context 생성이 실패하면 → exit 1.
39. `--worker`가 `codex`가 아니면 → exit 1.
40. `--worker-command`가 가리키는 파일이 없으면 → exit 1.
41. **Task ID에 셸 메타문자를 넣어도 그것이 실행되지 않는다.**
42. **모든 실패 경로에서 fixture의 `.bcos/` 파일 내용이 실행 전과 동일하다.**
43. **어떤 경로에서도 Runner가 lifecycle 전이를 일으키지 않는다** — 이벤트 줄 수 불변.
44. `task start` · `submit` · `approve` · `context` 기존 동작이 변하지 않는다 —
    각각 정상 1건 + 실패 1건.
45. `--version` / `--help` / `foo` 가 각각 exit 0 / exit 0 / exit 1이다.
46. `npm test` 가 통과하며 **95개 이상**의 테스트가 pass한다.
47. `package.json`에 `dependencies` 키가 없고 `devDependencies`가 기존 2개 그대로다.
48. `src/` 에 `cli.ts` · `context.ts` · `runner.ts` **세 파일만** 존재하고
    하위 디렉터리가 없다.
49. **테스트가 실제 Codex를 한 번도 호출하지 않는다** — 모든 프로세스 실행이 fixture `.js`다.
50. 소스에 `shell: true`, `cmd /c`, 셸 문자열 조립이 없다.
51. `src/runner.ts`가 **250줄을 넘지 않는다** — 삭제가 추가보다 커야 한다.
52. `git status` 기준 변경 파일이 `src/runner.ts`, `tests/cli.test.ts`, Report
    3개뿐이다. `package-lock.json`이 없고 이 저장소의 `.bcos/` 내용이 변경되지 않았다.

**아래는 worker가 만드는 것이 아니다.** `docs/benchmarks/TELEMETRY.md`는 이미 작성돼
있고 이 Task에서 **읽기 전용**이다. Reviewer가 문서를 직접 확인한다.

53. `docs/benchmarks/TELEMETRY.md`가 존재하고 세 arm(`claude-only` · `codex-only` ·
    `bcos`)의 Measurement Contract임을 명시한다.
54. Raw Data만 정의하고 비교 계산 키(`*_rate` · `*_ratio` · `efficiency` ·
    `improvement` · `savings` · `reduction`)를 **정의하지 않는다.**
55. `measured` · `estimated` · `N/A`를 구분하고 **없는 값을 0으로 채우지 않는다**고 명시한다.
56. token 필드에 `token_source`와 `token_measured`가 있다.
57. cost 필드에 `cost_source`가 있다.
58. session / handoff raw 필드가 있다.
59. human 필드가 **도구로 관측 불가**임과 교차 확인 가능한 항목을 명시한다.
60. protocol 변경이 필요한 필드를 `blocked`로 표시하고 필요한 변경점을 적는다.
61. 공개 Benchmark는 **Raw Data mapping만** 하고 점수를 자칭하지 않는다.
62. Benchmark 공정성 미해결 문제를 명시하고, **확정 전에는 arm 간 개선율을 주장하지
    않는다**고 적는다.

## Expected Files

**이 목록 밖의 파일은 읽지도 쓰지도 않는다.**
목록 밖의 파일이 필요해지면 작업을 멈추고 그 사실을 보고한다.

**수정**

- `src/runner.ts`
- `tests/cli.test.ts`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-009-prompt-builder.md` (이 파일)
- `docs/benchmarks/TELEMETRY.md` (Telemetry 키 정의 — **읽기 전용**)
- `src/runner.ts`
- `src/cli.ts`
- `src/context.ts`
- `tests/cli.test.ts`
- `package.json`

**쓰기**

- `.bcos/reports/T-009-prompt-builder.md`

**실행 프롬프트가 Read List에 없다.** T-008 Task는 자기 프롬프트를 Read List에 넣었지만,
`task run`이 프롬프트를 stdin에 직접 넣으므로 Read List에도 있으면 **같은 내용이 두 번**
들어간다. 이 Task는 실제 Runner로 실행될 후보이므로 중복을 미리 없앤다.

**`src/cli.ts`는 읽기만 한다.** 라우팅은 T-008에서 이미 끝났고 옵션도 그대로다.
바꿀 이유가 생기면 그것을 보고한다.

**이 Task는 코드가 줄어들 수 있다.** 프롬프트 탐색·본문 추출이 사라지고
preamble 상수와 Telemetry 출력이 들어온다. AC 46이 그 균형을 강제한다.

## Test Requirements

`node:test` 내장 러너를 쓴다. 외부 프레임워크를 도입하지 않는다.

**실제 Codex를 절대 호출하지 않는다.** 임시 디렉터리에 **가짜 worker `.js` 파일**을
만들고 `--worker-command`로 그것을 가리킨다.

가짜 worker가 할 수 있어야 하는 것 — stdin 전문을 파일로 덤프, SHA-256 출력,
**지정한 시간만큼 기다렸다가 첫 출력**(`first_worker_response_ms` 검증용),
지정한 exit code로 종료.

**테스트 격리 — 반드시 지킨다.** 각 테스트는 `os.tmpdir()` 아래에 fixture를 만들고
`spawnSync`의 `cwd` 옵션으로 CLI를 실행한다. **이 저장소의 실제 `.bcos/`나 실제 소스를
읽거나 쓰는 테스트는 금지한다.**

| # | 대상 | 기대 |
|---|---|---|
| 1–90 | 기존 테스트 90개 | 프롬프트 파일 전제가 사라진 것을 반영해 수정. **삭제 최소화** |
| 91 | prompts 디렉터리 없음 | dry-run exit 0 |
| 92 | prompts에 파일 2개 | 결과 동일 — 읽지 않음 |
| 93 | stdin 내용 | Task ID·worker·Report 경로 |
| 94 | stdin 내용 | 계약·탐색 금지·git 금지·bcos 금지·승인 금지·완료 지시 |
| 95 | stdin 내용 | Context Package 1회, Task 본문 포함 |
| 96 | 두 Task 비교 | preamble에서 값 3개만 다름 |
| 97 | Read List 자기 미포함 | exit 1 + 무엇이 빠졌는지 |
| 98 | dry-run | `telemetry ` 줄 존재, 실행 5개 필드 부재 |
| 99 | 실제 실행 | `telemetry ` 줄 존재, 키가 정의와 일치 |
| 100 | 2초 지연 worker | `first_worker_response_ms` > 1000 |
| 101 | duration 관계 | `worker_duration_ms` ≥ `first_worker_response_ms` |
| 102 | exit code · timed_out · timeout_seconds | 값 일치, `none` 처리 |
| 103 | 해시 | dry-run과 실제 실행의 context·stdin 해시 동일 |
| 104 | 금지 키 | 소스에 비율 계열 문자열 0건 |
| 105 | Telemetry 미기록 | 실행 후 fixture 파일 수·해시 불변 |
| 106 | 결정성 | dry-run 2회 stdin SHA-256 동일 |
| 107 | 실패 경로 6종 | 각각 exit 1, `.bcos/` 무변경, 이벤트 불변 |
| 108 | 셸 메타문자 Task ID | 실행되지 않음 |
| 109 | Lifecycle 회귀 | `start`·`submit`·`approve`·`context` 정상·실패 각 1건 |

**기존 테스트 중 프롬프트 파일을 전제한 것은 고친다.** T-008의 "Prompt 없음 / 2개 /
빈 본문 → exit 1" 세 테스트는 **동작이 반대로 바뀌었으므로** 삭제하거나 새 기대값으로
바꾼다. 어느 쪽이든 Report에 **어떤 테스트를 왜 바꿨는지** 적는다.

**증거:** Report의 `Test Evidence`에 `npm run build`와 `npm test`의 출력 전문,
dry-run 요약 전문, 실제 실행의 `telemetry` 줄 전문, 두 Task preamble 차이,
2회 실행 해시 일치, lifecycle 회귀 결과를 붙여넣는다.
"통과했다"는 문장만으로는 제출이 거부된다.

**실행 환경:** Windows PowerShell 5.1에서 동작해야 한다.
경로는 `path.join`을 쓰고 npm 스크립트에 `&&` 체이닝을 쓰지 않는다.

**측정:** Report의 `Context Used`에 읽은 파일 수, Read List 밖에서 읽은 파일,
완료 후 `src/runner.ts` 줄 수와 **T-008 대비 증감**을 기록한다.
**이 저장소는 공개된다.** 개인 홈 경로·이메일·환경 변수 값을 Report에 남기지 않는다.

## Benchmark Telemetry

필드 정의는 [docs/benchmarks/TELEMETRY.md](../../docs/benchmarks/TELEMETRY.md)에 있다.
**여기에는 이번 Task가 새로 남기기 시작하는 것만 적는다.** 값은 완료 후
`docs/benchmarks/T-009-prompt-builder.md`에 들어간다.

**이번에 추가되는 필드**

| key | 왜 지금 가능한가 |
|---|---|
| `first_worker_response_ms` | Runner가 첫 stdout·stderr chunk 시각을 잰다 |
| `worker_runtime` | Runner가 실행 형태를 안다 |
| `worker_timeout_seconds` | Runner가 설정값을 안다 |
| `stdin_bytes` | Runner가 조립한 입력의 크기를 안다 |

**이번에도 불가능한 것과 그 이유**

| key | 왜 불가능한가 |
|---|---|
| `input_tokens` · `output_tokens` · `total_tokens` | worker 출력을 해석해야 한다 — T-010 |
| `input_cost` · `output_cost` · `estimated_cost` | 토큰이 없으면 계산 대상이 없다 — T-010 |
| `context_tokens` | tokenizer가 없다. 문자수 추정은 관측이 아니다 — T-010 |
| `review_start_time` | Review 시작 이벤트가 프로토콜에 없다 — RFC-001 §5 변경 필요 |
| `rework_count` | `request-changes` 전이가 명령이 아니라 이벤트가 남지 않는다 |
| `tests_passed` · `acceptance_criteria_*` · `review_findings` | Report·Review가 산문이다. **파서를 만들지 않는다** |
| `human_*` 전체 | 터미널 밖의 행동을 도구가 관측할 수 없다. 사람이 적는다 |

**이 Task의 Telemetry는 출력만 한다.** 파일에 쓰지 않고, 계산하지 않고, 비교하지 않는다.
AC 28·29가 그것을 강제한다.
