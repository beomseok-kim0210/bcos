---
task: T-009
---

# Review — T-009

## Attempt 1 — 2026-08-07T04:45:48Z — APPROVED

### Verification Method

Worker Report를 신뢰하지 않고 Reviewer 자신의 fixture를 만들어 독립 검증했다.
`os.tmpdir()` 아래에 저장소 fixture와 가짜 worker `.js`를 만들고, 컴파일된
`dist/cli.js`를 `cwd` 옵션으로 실행해 **99개 항목**을 확인했다. 실패 경로마다
`.bcos/` 전체를 재귀 해시로 스냅샷해 실행 전후를 대조했다.

`npm test`도 직접 실행했고, `PATH`에서 Codex 진입점을 제거한 뒤 한 번 더 돌렸다.

### Lifecycle

| | |
|---|---|
| `TASK_STARTED` | `2026-08-07T04:03:44.089Z` — worker / codex-cli |
| `TASK_SUBMITTED` | `2026-08-07T04:40:18.322Z` — worker / codex-cli |

**사후 복구 흔적이 없다.** 밀리초가 `.089` / `.322`로 임의값이고 간격이 36분 34초다.
`.001`/`.002` 패턴이 아니다. **다섯 Task 연속 실시간 기록이다.**

`status: IMPLEMENTED` · `attempt: 1` · `current_task: null` ·
`counts.IMPLEMENTED: 1` · `counts.DONE: 8`. 두 이벤트를 수정하지 않았다.

### Acceptance Criteria

**62 / 62 충족.** Reviewer가 직접 관측했다. 50–62번은 문서 검증 항목이며
`docs/benchmarks/TELEMETRY.md`를 직접 읽어 확인했다.

### Prompt 제거 — 이 Task의 본체

소스에서 `prompts` · `promptNames` · `extractPrompt` · `promptBody` 문자열이
**0건**이다. diff에서 `promptsDirectory`, `function extractPrompt`,
`Expected exactly one Worker Prompt`, `Worker Prompt body is missing`이 삭제됐다.

독립 검증으로 **네 가지 이전 실패 경로가 전부 정상 동작으로 바뀐 것**을 확인했다.

| fixture | 결과 |
|---|---|
| `.bcos/prompts/` 비어 있음 | exit 0 |
| Prompt 2개 | exit 0, 무시 |
| Prompt 본문 비어 있음 | exit 0 |
| Prompt 구분자 없음 | exit 0 |

**Prompt 2개 fixture와 빈 fixture의 `stdin_sha256`이 동일했다.** 파일이 읽히지
않는다는 가장 강한 증거다. Prompt 내용 마커(`AAA_MARKER`·`BBB_MARKER`)도
stdin에 나타나지 않았다.

**preamble 불변성** — 서로 다른 두 Task(T-700 / T-701)의 preamble을 줄 단위로
비교했다. 다른 줄은 **`task:`와 `report:` 두 줄뿐**이었다. `worker:`는 allow list가
`codex` 하나여서 값이 같아 결과적으로 동일했다. **치환 자리 3개 밖에서는 글자
하나도 다르지 않다.**

`buildPreamble`은 템플릿 리터럴 하나와 `${taskId}` · `${worker}` · `${reportPath}`
세 개가 전부다. **템플릿 엔진 · Prompt DSL · registry · class · Adapter · Factory가
소스에 0건이다.** `src/context.ts`와 `src/cli.ts`는 **한 줄도 바뀌지 않았다.**
`src/`는 세 파일이고 하위 디렉터리가 없다. 런타임 의존성 0, `package-lock.json` 없음.

### Task self-inclusion guard

| 검증 | 결과 |
|---|---|
| Read List에 자기 Task 있음 | exit 0 |
| 없음 | **exit 1** |
| 오류 메시지 | `Read List is missing its Task file: .bcos\tasks\T-700-probe.md` — **빠진 경로를 명시한다** |
| 실패 시 `.bcos/` | 해시 동일 |
| 실패 시 stdout | 0 바이트 |

Context Package 안에 Task 본문이 **정확히 1회**, `AGENTS.md`가 포함되며,
Read List 기재 순서(`AGENTS.md` → Task → `extra.md`)가 출력 순서와 일치했다.

**여덟 Task의 관행이 처음으로 코드가 됐다.**

### stdin 결정성

같은 fixture로 dry-run을 두 번 실행해 `stdin_sha256`과 `context_sha256`이 모두
동일했다. 가짜 worker가 받은 본문의 해시가 dry-run이 보고한 해시와 **일치**했다 —
조립한 것과 전달한 것이 같은 바이트다.

본문을 덤프해 직접 확인 — Task ID · worker · Report 경로 · "git 명령을 실행하지
마라" · "bcos 명령을 실행하지 마라" · "승인을 시도하지 마라" 포함, Context Package
**정확히 1회**, 타임스탬프 없음.

### Telemetry

`telemetry <key>=<value>` 형식이 실제 출력 계약임을 확인했다. dry-run에서 14개 키가
모두 나오고, **실행 전용 5개(`worker_exit_code` · `worker_duration_ms` ·
`first_worker_response_ms` · `worker_stdout_bytes` · `worker_stderr_bytes`)는
나오지 않는다.** 0으로 채우지 않았다.

**exit code 전파 — 직접 실행해 확인했다.**

| fake worker | process exit | `telemetry worker_exit_code` |
|---|---:|---:|
| exit 0 | **0** | **0** |
| exit 3 | **3** | **3** |

두 경우 모두 `worker_duration_ms` · `worker_stdout_bytes` · `worker_stderr_bytes` ·
`first_worker_response_ms`가 숫자였고, `worker_timed_out=false`,
`retry_count=0`, `runner_transitions_caused=0`이 출력됐다. stdout·stderr가 부모로
전달됐고 argv에 Task ID가 없었으며 `.bcos/`가 변하지 않았다.

**`first_worker_response_ms`는 실측값이다.** 2초 지연 worker에서 1,000ms를 넘었고
`worker_duration_ms >= first_worker_response_ms`가 성립했다.

**계산 결과가 없다.** 소스에 `_rate` · `_ratio` · `efficiency` · `improvement` ·
`savings` · `reduction`이 0건이고, Telemetry는 파일에 기록되지 않는다.

### timeout

기본값 **1,800초**를 확인했다. `--timeout 60`이 덮어썼다.
**0 · 음수(-5) · 소수(1.5) · 비숫자(abc)가 모두 exit 1이고 기본값으로 넘어가지
않았다** — 잘못된 값이 조용히 1800으로 대체되지 않는다. 세 경우 모두 `.bcos/` 무변경.

`--timeout 1`에 10초 worker를 붙이자 exit 1, `worker_timed_out=true`, `.bcos/` 무변경.

**1,800초를 고른 근거는 관측이다.** 실측된 Task 소요는 T-004 437초 · T-008 461초 ·
T-007 670초 · **T-006 1,037초**였다. 600초를 기본값으로 뒀다면 T-006은 정상 작업
중에 죽었을 것이다. 1,800초는 관측 최댓값의 약 1.7배다.

### Test Suite

Reviewer가 직접 실행해 **99 pass / 0 fail**, exit 0.
`PATH`에서 `@openai/codex/bin/codex.js`를 포함한 디렉터리를 전부 제거하고 다시
돌려도 **99/99 pass**했다 — **어떤 테스트도 실제 Codex에 의존하지 않는다.**

`src/runner.ts` 245줄로 AC 48의 250줄 상한을 지켰다(T-008 대비 +39).

### TELEMETRY.md

**84개 필드 / 10개 카테고리** 확인. 세 arm(`claude-only` · `codex-only` · `bcos`)의
Measurement Contract임을 명시한다.

`token_source` · `token_measured` · `cost_source` · `session_id` · `handoff_count` ·
`worker_switch_count` · `context_reused` · `context_regenerated` ·
`manual_prompt_bytes` · `generated_prompt_bytes` · `worker_completed` ·
`worker_interrupted` · `worker_exit_reason` **전부 존재한다.**

`measured` / `estimated` / `N/A` / `blocked`를 구분하고, human 필드가 도구로 관측
불가임과 `human_approval_count`만 이벤트 로그로 교차 확인 가능함을 적었다.
protocol-blocked 필드에 필요한 변경점(RFC-001 §3 · §5, `request-changes` 구현)을
명시했다. 공정성 미해결 문제 **6개**가 있다.

**계산 필드가 0건이다** — `*_rate` · `*_ratio` · `efficiency` · `improvement` ·
`savings` · `reduction` 어느 것도 필드로 정의되지 않았다. 공개 지표 6종은 Raw Data
대응만 적고 여섯 행 전부 "BCOS가 계산하는가: 아니오"다.

### Regression

**start** 정상·실패 · **submit** 정상·**G3 거부** · **approve** 정상·**G4 거부**·
**G5(SoD) 거부** · **context** 정상·실패 · `--version` · `--help` · unknown argument ·
`task run` 실패 4종 · 셸 메타문자 Task ID 차단. **전부 통과.**

거부된 전이는 status와 이벤트 수를 바꾸지 않았다.

### Findings

**F-1 — Report 소유권 예외 (Process, Info)**

Report의 `### Re-verification` 절은 worker가 아니라 `claude-code`가 사용자 지시로
작성했다. CLAUDE.md 규칙 2는 manager의 Report 수정을 금지한다.

**은폐되지 않았다.** 해당 절 첫 문단에 작성자와 예외 사유가 명시돼 있고,
그 위 worker 원문은 수정되지 않았다(`## Attempt 1 — 2026-08-07T04:11:10Z` 이하
`### Context Used`까지 그대로). 추가는 append 뿐이다.

**구현 품질과 무관한 프로세스 Finding이다.** 재작업 피드백을 누가 어디에 적는지가
프로토콜에 없다. **T-011 Reviewer/Rework Orchestration의 요구사항 후보로 남긴다.**

**F-2 — Report가 완료를 주장하지 않는데 submit이 통과했다 (Process, Major)**

worker의 `Known Risks`는 이렇게 적었다 — "`npm test` has not passed in this
environment ... this attempt does not claim completion of all Acceptance Criteria."

그런데 `task submit`은 통과했다. **G3는 현재 attempt의 Report가 존재하는지만
검사하고 그 Report가 무엇을 주장하는지는 보지 않는다.** 규격대로 동작한 것이므로
구현 결함이 아니다.

결과적으로 문제는 없었다 — host 검증이 3건의 회귀를 잡아냈고 재작업으로 해소됐다.
그러나 **"증거 없는 제출을 도구가 막는다"는 T-004의 약속이 여기서는 절반만
지켜졌다.** Report가 스스로 실패를 선언해도 제출이 통과한다.

Report를 기계가 읽게 하려면 RFC-001 §3 변경이 필요하며, 이는
`TELEMETRY.md`가 `tests_passed`를 `blocked`로 표시한 사유와 같은 뿌리다.
**T-011에서 다룰 후보로 기록한다.** 이번 승인을 막지 않는다.

**F-3 — dogfooding 실행의 Telemetry가 어디에도 남지 않았다 (Minor)**

이번 T-009는 실제 Codex Runner의 첫 실행이었고 Telemetry가 콘솔에 출력됐다.
그러나 **Telemetry는 stdout 전용이고 파일에 기록되지 않는다**(AC 32가 그렇게
요구한다). 실행 창을 닫으면 값이 사라진다.

설계대로 동작한 것이며 저장은 T-012 Benchmark Runner의 책임이다. 이번 실행의
관측값은 사용자가 콘솔에서 옮겨 적은 것을 Benchmark에 기록했고, **BCOS가 자동
수집한 값이 아니라는 사실을 함께 적었다.**

**F-4 — 중첩 Codex 실행에서 `spawn EPERM` (Info, T-010 요구사항 후보)**

worker의 첫 `npm test`가 `spawn EPERM`(errno -4048)으로 실행되지 못했다.
Codex 샌드박스 안에서 다시 자식 프로세스를 띄우려 한 결과다.

**이것이 이번 dogfooding의 가장 값진 발견이다.** BCOS가 Codex 안에서 Codex를
실행하는 구조를 만들면 같은 문제가 재현될 수 있다. **T-010 Workflow
Orchestrator의 정식 요구사항 후보 — host 환경 검증과 nested worker guard.**

**F-5 — `frontmatterValue` 3중 복제 (Info, T-008 F-3 이월)**

`src/cli.ts:25` · `src/context.ts:28` · `src/runner.ts:35`. T-008 Review에서 이미
기록했고 이번에도 변하지 않았다. 각 5줄 안팎이라 지금 추출하는 쪽이 더 비싸다.
네 번째 복사가 생기면 그때 뽑는다.

### Ponytail

**위반 없음.** 이 Task는 **삭제가 본체다** — 탐색·추출·검증 로직과 실패 경로 3종이
사라졌다. `src/runner.ts`는 +39줄이지만 그중 상당수가 Telemetry 출력이고,
템플릿 엔진·DSL·registry·class·새 파일·새 의존성이 하나도 없다.

### Sensitive Information

Report · `src/runner.ts` · `tests/cli.test.ts` · `TELEMETRY.md` 전부 **0건**.

### Verdict

**APPROVED**

AC 62개 전부, Reviewer 독립 검증 99개 중 98개 통과했다. 나머지 1개는 Reviewer의
검사식이 지나치게 엄격했던 것이며(worker 값이 두 fixture에서 같아 preamble 차이가
3줄이 아니라 2줄이었다) **구현 결함이 아님을 확인했다.**

Findings 5건 중 Blocking은 없다. F-2가 가장 무겁지만 프로토콜 설계 문제이지
이번 구현의 결함이 아니며, T-011에서 다룬다.
