---
protocol: "0.1"
id: T-016
title: Capture comparable raw benchmark trials without claiming efficiency
status: TODO
attempt: 1
created: 2026-08-13T05:10:00Z
updated: 2026-08-14T03:58:38.409Z
---

# T-016 — Benchmark Trial Record

## Objective

**세 방식(Codex-only · Claude-only · BCOS)을 나중에 공정하게 비교할 수 있도록,
원시 측정값을 손실 없이 · 출처를 밝혀서 저장한다. 비교도 결론도 이 Task에서 하지 않는다.**

BCOS의 최종 검증 질문은 아직 미검증 가설이다.

> 역할 분리가 추가 호출 비용을 상쇄할 만큼 재작업·결함·Human 개입을 줄이는가?

**이 Task의 산출물은 BCOS를 반증할 수도 있어야 한다.** 유리한 지표만 남기거나
불리한 실행을 통계에서 제외하는 구조를 만들면 이 Task는 실패한 것이다.

### 조사 결과 — 결정적 사실

**벤치마크가 필요한 측정값의 대부분이 이미 계산되지만, 어디에도 저장되지 않는다.**

`task execute` 한 번은 stdout으로 telemetry 키 **35개**를 출력한다.
그중 `RunRecord`에 남는 것은 **8개**뿐이고, **27개는 터미널이 닫히면 사라진다.**

```
RunRecord에 남음 (15 필드)
  execution_id · task_id · attempt · started_at · updated_at · completed_at
  workflow_status · workflow_exit_reason · current_stage · stages
  verification_command · verification_exit_code · verification_excerpt
  worker_name · worker_version · reviewer_name · reviewer_version

휘발 (27개) — 벤치마크가 쓰려던 값이 전부 여기 있다
  context_files · context_chars · context_bytes · context_lines · context_sha256
  stdin_bytes · stdin_sha256
  worker_stdout_bytes · worker_stderr_bytes
  worker_duration_ms · first_worker_response_ms · verification_duration_ms
  workflow_duration_ms · worker_exit_code · worker_timed_out · runner_invocations · …
```

**즉 지금 벤치마크를 시작하면 BCOS Arm의 원시 측정값은 매 실행마다 버려진다.**
T-012가 *단계 상태*를 영속화했지만 *측정값*은 영속화하지 않은 것이다.

이 Task는 그 구멍을 닫고(**결정 A**), 세 Arm을 공통으로 묶는 최소 기록을 만든다(**결정 B**).

## Scope

### 1. 결정 A — `RunRecord`에 측정값 9개를 영속화한다

**새 Artifact를 만들지 않는다.** 기존 run artifact가 이미 실행 관찰의 소유자다.
휘발하는 27개 중 **T-017의 Primary Metrics가 실제로 필요로 하는 9개만** 남긴다.

| 필드 | 의미 | 이미 계산되는 곳 |
|---|---|---|
| `worker_invocations` | 이 execution에서 worker를 부른 횟수 | runner 호출 지점 2곳 (`workflow.ts:228,294`) |
| `context_files` | Context Package에 포함된 파일 수 | `context.ts:141` |
| `context_chars` | Context Package 문자 수 | `context.ts:142` |
| `context_bytes` | Context Package 바이트 수 | 동일 지점 |
| `stdin_bytes` | worker에게 실제로 준 stdin 바이트 | `runner.ts` |
| `worker_stdout_bytes` | worker 표준출력 바이트 | `ModelResult.stdoutBytes` |
| `worker_stderr_bytes` | worker 표준오류 바이트 | `ModelResult.stderrBytes` |
| `worker_duration_ms` | worker 실행 시간 | `ModelResult.durationMs` |
| `verification_duration_ms` | Host Verification 소요 시간 | `workflow.ts` verify 단계 |

**합산 규칙 — 명시적으로 정한다.** worker는 한 execution에서 두 번 호출될 수 있다
(`--review` 재작업 루프). 위 값 중 **누적 성격인 것은 execution 내 합계**이고,
`worker_invocations`가 그 합계를 해석 가능하게 만든다. **평균·비율을 저장하지 않는다.**

**`context_chars`와 `context_bytes`를 둘 다 남기는 이유** — 이 저장소의 텍스트는
한국어 비중이 높아 문자 수와 바이트 수가 약 3배 차이 난다. 하나만 저장하면
"어떤 값이 token proxy인가"를 코드가 조용히 결정해 버린다. 둘 다 이미 계산된다.

**남기지 않는 18개** — `context_lines` · `context_sha256` · `stdin_sha256` ·
`first_worker_response_ms` · `workflow_duration_ms` · `nested_worker_detected` 등.
Primary Metrics가 요구하지 않는다. **필요해진 근거가 생기면 그때 추가한다.**
`workflow_duration_ms`는 `started_at`/`completed_at`에서 **DERIVED**로 계산된다 — 중복 저장 금지.

### 2. 결정 B — trial record는 "다른 곳에 집이 없는 값"만 담는다

Arm이 세 개인데, **baseline 두 개는 BCOS lifecycle을 전혀 거치지 않는다.**
Task도 Report도 Review도 Run도 없다. 따라서 세 Arm을 묶는 기록이 하나 필요하다.

**그러나 그 기록이 lifecycle 데이터를 복제하면 안 된다** — 원본과 어긋나는 순간 거짓이 된다.

| 값 | 어디에 사는가 |
|---|---|
| case 정체성 · arm · repetition · base commit · requirement hash | **trial record** (다른 집 없음) |
| environment (os · node · bcos · worker · reviewer 버전) | **trial record** (baseline arm은 기록처 없음) |
| Human 개입 횟수 · 시간 | **trial record** (다른 집 없음) |
| token 사용량 | **trial record** — 현재는 전부 `unavailable` |
| baseline arm의 입출력 proxy | **trial record** (run artifact 없음) |
| **BCOS arm의 입출력 proxy · 시간 · 단계 결과** | **run artifact** ← 참조만 한다 |
| **BCOS arm의 AC 판정 · Finding** | **Review** ← 참조만 한다 |
| **BCOS arm의 lifecycle 시각** | **events.jsonl** ← 참조만 한다 |

**규칙 — BCOS arm의 trial은 proxy를 담지 않는다.** 담으려 하면 `readTrials()`가 거부한다.
이것이 "복제 대신 참조"(§17)를 기계적으로 강제하는 방법이다.

### 2.1 Capture Ownership — T-016이 무엇을 하고 무엇을 하지 않는가

**이 경계를 흐리면 "T-016이 벤치마크를 돌린다"는 거짓 주장이 생긴다.** 명시한다.

| | T-016이 하는 일 | T-016이 **하지 않는** 일 |
|---|---|---|
| **BCOS arm** | 기존 workflow에서 **지금 stdout으로만 휘발하는** Primary Benchmark 필수 측정값 9개를 `RunRecord`에 영속화 | 새 실행 경로·새 계측 지점 추가. lifecycle·proxy를 trial에 복제 |
| **codex_only** | trial record의 **스키마와 provenance를 검증** | **baseline agent를 실행하지 않는다.** 자동 측정하지 않는다 |
| **claude_only** | 동일 | 동일 |

**T-016은 measurement를 *생성*하는 주체가 아니다.**

- BCOS arm의 측정값은 **이미 계산되고 있다.** T-016은 그것이 **버려지지 않게** 할 뿐이다.
- baseline arm의 trial은 **수동 작성** 또는 **미래의 외부 harness**가 만든다.
  둘 중 무엇이든 `readTrials()`는 같은 규칙으로 검증한다.
- **실제 controlled execution은 T-017 또는 이후 experiment harness의 책임이다.**

따라서 `src/benchmark.ts`는 **읽기·검증 전용**이다 — 프로세스를 띄우지도, 파일을 쓰지도 않는다(AC 36).

**"쓰지 않는다"의 범위를 정확히 한다 — benchmark module에 한정된다.**

| 무엇 | 쓰는가 | 어떻게 |
|---|---|---|
| `.bcos/benchmarks/` trial | **아니다** | 사람 또는 미래 외부 harness가 만든다 |
| `.bcos/runs/` run artifact | **그렇다** | `src/run.ts`의 **기존** write/update 경로 그대로 |

**이 둘은 모순이 아니라 서로 다른 대상이다.** §1의 측정값 9개는
**이미 존재하는 run artifact 기록 경로에 값이 얹히는 것**이지 새 쓰기 능력이 아니다.
**새 writer 함수·모듈·추상화를 만들지 않는다**(AC 37).

**새 CLI command를 만들지 않는 §4의 결정은 그대로 유지된다.**

### 3. 저장 방식 — 3안 비교

| 기준 | A. 기존 Artifact만 확장 | B. `.bcos/benchmark.jsonl` | **C. trial 1건 = 파일 1개** |
|---|---|---|---|
| append-only | 예 | 예 | 예 (파일 재작성 없음) |
| Git diff 가독성 | — | 한 줄 추가, 내용 판독 어려움 | **trial 전체가 보인다** |
| merge 충돌 | — | **마지막 줄 동시 추가 시 충돌** | 파일명이 달라 충돌 없음 |
| 반복 실험 표현 | **불가** | 가능 | 가능 |
| baseline arm 표현 | **불가** — BCOS 실행이 없다 | 가능 | 가능 |
| provenance | — | 가능 | 가능 |
| 구현 LOC | 최소 | 소 | 소 (`runs/` 패턴 재사용) |
| T-017 집계 | — | 파일 1개 읽기 | `readdir` + map — **`readRuns`와 동일** |

**A는 탈락한다** — baseline arm은 BCOS를 실행하지 않으므로 확장할 Artifact 자체가 없다.
**C를 선택한다.** `.bcos/runs/`가 이미 "실행 1건 = 파일 1개"이고 `readRuns`가 그 읽기 패턴을
증명했다. 같은 모양을 쓰면 새 패턴을 배우지 않아도 되고, 벤치마크 실행이
여러 머신·여러 브랜치에서 병렬로 일어나도 merge 충돌이 없다.
**B의 유일한 장점(읽기 1회)은 T-017의 편의일 뿐이고, 그 편의는 `readRuns`가 이미 반증했다.**

파일명은 **결정적**이다 — `.bcos/benchmarks/<case_id>-<arm>-<repetition>.json`.

#### Canonical Trial Identity — 파일명과 내용은 하나의 사실이어야 한다

**파일명이 정체성인 저장 방식은, 파일명과 내용이 어긋나는 순간 조용히 거짓이 된다.**
같은 identity를 다른 파일명으로 두 번 저장하면 그 case는 **중복 계수**된다.
따라서 identity를 세 겹으로 못박는다.

**(1) `case_id` slug 규칙 — 짧고 결정적이며 파일명으로 안전하다**

```
^CASE-[A-Z0-9]+(-[A-Z0-9]+)*$      예: CASE-FE-001 · CASE-BE-003
```

`/` · `\` · `..` · 공백 · `.` · 소문자 · 연속 하이픈 · 앞뒤 하이픈을 **전부 거부한다.**
path separator와 `..`를 막는 것은 **파일명이 디렉터리를 벗어나지 못하게 하기 위해서**다.

**(2) 파일명은 분해하지 않고 *구성해서* 비교한다**

`arm`(`codex_only` 등)은 하이픈을 쓰지 않고 `case_id`는 하이픈을 쓰므로,
파일명을 하이픈으로 **분해하면 모호하다** — `CASE-FE-001-bcos-1`의 경계가 어디인지
문자열만 보고 알 수 없다.

**그래서 분해하지 않는다.** JSON 내부의 세 값으로 **기대 파일명을 조립한 뒤
실제 파일명과 정확히 비교한다.** 모호성이 원천적으로 없다.

```
JSON { case_id, arm, repetition }  →  기대 파일명 조립  →  실제 파일명과 일치?
```

불일치는 거부한다. `repetition`은 10진수 그대로이며 `01` 같은 zero-padding은
같은 identity에 두 파일명을 허용하므로 **거부한다.**

**(3) 중복 탐지 코드는 만들지 않는다 — 필요가 없기 때문이다**

`(case_id, arm, repetition)` 하나는 **정확히 하나의 파일명**으로 조립되고,
한 디렉터리에 같은 이름의 파일은 둘 존재할 수 없다.
**따라서 (2)를 통과한 이상 identity 중복은 파일시스템이 이미 막고 있다.**

slug이 대문자·숫자·하이픈뿐이고 `arm`이 소문자뿐이라 대소문자 변형도 생기지 않으므로,
대소문자를 구분하지 않는 파일시스템에서도 우회 경로가 없다.

**별도의 중복 스캐닝 루프를 넣으면 절대 발동하지 않는 코드가 된다.** 넣지 않는다.

**형식은 JSON이다.** Markdown이 아니다. trial은 사람이 읽는 서술이 아니라 수치 기록이고,
T-900 F-1이 "Markdown 형태 파싱은 결함이 숨는 자리"임을 실제 결함으로 보여줬다.

### 4. CLI surface — 새 command 0개

**`bcos benchmark record`를 만들지 않는다.**

| 자동화 후보 | 실제 판단 |
|---|---|
| environment 자동 수집 | `node --version`은 사람이 1초에 읽는다 |
| base commit 자동 취득 | **`src/`에 git 호출이 0건이다.** 지금 여는 것은 새 능력이다 |
| BCOS 참조 자동 연결 | `task_id`와 `execution_id`는 run artifact 파일명에 그대로 있다 |
| 스키마 검증 | **`readTrials()`가 한다 — command 없이도 된다** |

**필요한 flag를 세어 보면 12개가 넘고, 그 대부분이 사람이 한 번 타이핑할 값이다.**
`.bcos/amendments/`가 같은 선례다 — 사람이 쓰고, 코드가 읽을 때 검증한다.
**손으로 쓰는 것이 실제로 오류를 낳는다는 증거가 생기면 그때 command를 만든다.**

### 5. Provenance — 값보다 출처가 먼저다

모든 수치는 `{ value, source }` 쌍이다. `source`는 **닫힌 5값**이다.

| source | 의미 | 예 |
|---|---|---|
| `measured` | 도구가 실제로 보고했다 | Claude CLI가 준 token usage |
| `estimated` | 공식 tokenizer로 계산했다 | tokenizer가 센 입력 token |
| `proxy` | 대체값이다. token이 아니다 | `stdin_bytes` |
| `derived` | 기록된 다른 값에서 계산했다 | `approved_at − started_at` |
| `unavailable` | 얻을 수 없다 | 현재의 모든 token 값 |

**두 가지를 코드가 막는다.**

1. **`source: "unavailable"`이면 `value`는 반드시 `null`이다.** `0`이면 거부한다.
   0은 "0개를 썼다"는 주장이고, 그것은 거짓이다.
2. **`unavailable`이 아니면 `value`는 `null`이 아니다.**

**절대 금지** — `context_chars ≈ tokens` 같은 환산을 저장하거나 token 필드명 아래 두는 것.
proxy는 `proxies` 아래에만 산다. `input_tokens`에 바이트 수를 넣는 것은 스키마 위반이다.

**값이 없는 것이 거짓 정밀도보다 낫다.**

### 6. Arm — 정확히 세 값

```
codex_only    Codex 하나가 계획·구현·자기검사
claude_only   Claude 하나가 계획·구현·자기검사
bcos          Claude Manager → Task Contract → Codex Worker → Host Verification
              → Claude Independent Review
```

**`bcos` arm의 정의는 위 경로 하나다.** T-015가 연 `--worker claude`는
**기본 BCOS 경로가 아니다.** 현재 운영 정책은 `Manager/Reviewer = Claude`,
`Implementation Worker = Codex`이며, trial의 `environment`가 실제로 쓴 실행기를 남기므로
정책과 다르게 실행했다면 기록에서 드러난다.

**네 번째 arm을 만들지 않는다.** 그 밖의 값은 `readTrials()`가 거부한다.

### 7. System Cost와 Evaluation Cost 분리

**섞이면 벤치마크가 무효다.** 스키마에서 분리한다.

| | 무엇 | BCOS arm의 예 |
|---|---|---|
| `system_usage` | 그 방식이 **개발을 수행하며** 쓴 자원 | Claude planning + Codex Worker + Claude Review **전부** |
| `evaluation_usage` | 실험자가 **채점하려고** 추가로 쓴 자원 | blinded evaluator · 별도 채점 모델 |

**BCOS의 Independent Review는 `system_usage`다.** 그것이 BCOS라는 제품의 비용이다.
채점을 위해 세 Arm에 똑같이 붙이는 외부 판정만 `evaluation_usage`다.

#### 7.1 `system_usage`는 total 하나가 아니다 — component로 분해한다

**최종 연구 질문이 그것을 요구한다.**

> Claude planning/review overhead가 역할 분리 효과를 상쇄하는가?

`system_usage`를 **합계 하나로만** 표현하면 **이 질문에 영원히 답할 수 없다.**
BCOS가 Codex-only보다 비싸게 나왔을 때 "planning이 비싼가, Review가 비싼가,
Worker 자체가 비싼가"를 구분할 수 없기 때문이다.
**그 구분이 안 되면 §0이 허용한 '어느 부분을 줄일 것인가'라는 결정을 내릴 수 없다.**

따라서 `system_usage`는 **component 목록**이다. 각 component는 `phase` × `runtime`이다.

| `phase` (닫힌 4값) | `runtime` (닫힌 2값) | 쓰이는 arm |
|---|---|---|
| `planning` | `claude` | bcos |
| `worker` | `codex` | bcos |
| `review` | `claude` | bcos |
| `single_agent` | `codex` / `claude` | codex_only / claude_only |

```json
"system_usage": [
  { "phase": "planning", "runtime": "claude",
    "input_tokens":  { "value": null, "source": "unavailable" },
    "output_tokens": { "value": null, "source": "unavailable" } },
  { "phase": "worker", "runtime": "codex",
    "input_tokens":  { "value": null, "source": "unavailable" },
    "output_tokens": { "value": null, "source": "unavailable" } },
  { "phase": "review", "runtime": "claude",
    "input_tokens":  { "value": null, "source": "unavailable" },
    "output_tokens": { "value": null, "source": "unavailable" } }
]
```

**arm과 phase의 대칭을 코드가 강제한다.**

- baseline arm의 component는 **전부 `single_agent`** 여야 하고,
  `runtime`이 arm과 일치해야 한다 — `codex_only`인데 `single_agent/claude`는 **거부**.
- `bcos` arm에 `single_agent` phase가 있으면 **거부** — 역할 분리가 없다는 뜻이므로 모순이다.

**규칙은 하나도 완화되지 않는다.**

- 각 component의 token 값은 **§5 provenance 규칙을 그대로** 따른다.
  실측이 없으면 `value: null` + `source: "unavailable"` — **현재 세 Arm 모두 그렇다.**
- **proxy를 token으로 승격하지 않는다.** proxy는 여전히 `proxies` 아래에만 산다.
- **`readTrials()`는 component를 합산하지 않는다.** total 필드를 만들지도, 계산하지도 않는다
  (AC 43). 합계가 필요하면 **T-017이 명시적으로** 구한다.
- Evaluation-only judge 사용량은 기존 결정대로 **`evaluation_usage`에 분리**된다.

**이것은 미래 model routing을 위한 추상화가 아니다.** phase 4값·runtime 2값은
**지금 정의된 3-arm 실험의 구성요소를 그대로 적은 것**이고, 그 밖의 조합은 거부된다.
새 provider·새 phase를 추가하려면 이 목록을 고쳐야 한다 — **열려 있지 않다.**

**결과 판정도 같은 원리로 분리한다.** Codex-only가 스스로 "완료"라고 말한 것과
BCOS Reviewer의 `APPROVED`는 **기준이 다르므로 그대로 비교하면 안 된다**(§16).
따라서 trial의 `outcome.gate_ac_*`는 **Arm 외부의 동일한 평가 게이트 결과**이고,
BCOS 내부의 Review 판정은 Review artifact에 그대로 남아 참조로 도달한다.

**T-016은 그 평가 게이트를 구현하지 않는다.** 게이트 결과를 적을 자리만 만든다.

### 8. Human Effort

```json
"human": {
  "intervention_count": { "value": 3,    "source": "measured" },
  "active_ms":          { "value": null, "source": "unavailable" }
}
```

**수동 입력을 허용한다. 추정을 측정으로 부르는 것은 금지한다.**
"대략 5분"을 `300000` + `measured`로 적으면 안 된다 — 모르면 `unavailable` + `null`이다.
AI 사용량만 재고 Human 시간을 빼면 역할 분리의 비용이 사라져 BCOS에 유리하게 편향된다.

### 9. 실패는 1급 데이터다

```
success · verification_failed · review_failed · timeout
worker_error · protocol_error · aborted
```

**7값 닫힌 집합이고 arm 중립이다.** baseline arm에는 BCOS의 `workflow_exit_reason`
(`permission` 등)이 의미를 갖지 않으므로 그 값을 그대로 쓰지 않는다.
**세부 사유는 BCOS arm의 run artifact에 이미 있고, 참조로 도달한다.**

**`readTrials()`는 status로 필터링하지 않는다.** 실패 trial을 조용히 제외하는 코드가 있으면
그 자체가 결함이다. 제외 여부는 T-017에서 **명시적으로** 판단한다.

### 10. BCOS Artifact 참조

```json
"bcos": { "task_id": "T-015", "execution_ids": ["20260812T124928305Z-7b47aa44"] }
```

이 두 값이면 Task · Report · Review · Run · Events에 전부 도달한다.
**baseline arm은 이 필드를 갖지 않는다** — BCOS lifecycle을 흉내 내도록 강요하지 않는다.

### 11. Privacy — 한계를 정확히 말한다

trial record에 들어가면 안 되는 것: 홈 절대경로 · 사용자명 · 환경변수 덤프 ·
비밀키 · API key · 대화 전문.

**T-014의 치환은 `<root>`와 `<home>` 두 개뿐이다.**
T-016은 **그 한계를 그대로 유지하고, 늘렸다고 주장하지 않는다.**
`verificationExcerpt`를 수정하지 않으며, trial record를 "PII sanitizer를 통과했다"고
부르지 않는다. trial의 값은 수치·해시·짧은 식별자이므로 **자유 텍스트 필드를 만들지 않는 것**이
실제 방어다.

### 12. 경계 — `src/model.ts`를 오염시키지 않는다

**`ModelResult`에 context·stdin 지표를 추가하면 T-013 경계가 깨진다.**
`model.ts`는 `.bcos`도 Context Package도 몰라야 한다.

따라서 runner가 **자신의 반환 타입을 넓힌다** — `ModelResult`에 runner가 아는 측정값을
얹어서 workflow에 넘긴다. **`src/model.ts`는 이 Task에서 한 줄도 바뀌지 않는다.**

### 13. 하지 않는 것 — 집계

T-016은 **저장까지**다. `Tokens per Passed AC` · `First-pass Approval Rate` ·
`Rework-adjusted Cost` 같은 **비율·중앙값·순위는 전부 T-017**이다.

**"BCOS is 34% faster" 같은 문장을 출력하는 코드가 있으면 이 Task는 실패다.**
`readTrials()`는 검증된 원시 기록의 배열만 돌려준다.

## Out of Scope

**측정 대상**
- 실제 Codex-only / Claude-only / BCOS 비교 실험 실행
- **baseline agent(codex_only · claude_only) 실행 또는 자동 계측** (§2.1)
- **trial record 생성·기록 기능** — `readTrials()`는 읽기·검증만 한다 (§2.1)
- 통계적 우월성 주장 · 효율 개선률 발표 · Technical Report 작성
- 어떤 종류의 집계·평균·비율·순위 계산 — **component 합산 포함** (§7.1)
- **Case Registry / canonical case definition 저장소** (Notes 참조)

**평가**
- 외부 Benchmark Evaluator / LLM-as-Judge 시스템 구현
- Review Markdown에서 AC·Finding 수를 파싱하는 parser
  (형식 변형이 실재한다 — T-013 Review에 `| **59** | **FAIL` 형태가 3건)

**저장·실행**
- 새 CLI command (`benchmark init/run/compare/chart/export/dashboard/analyze` 전부)
- Telemetry backend · Database · SQLite · Dashboard · 웹 UI
- 병렬 Worker · worktree orchestration · 반복 실행 orchestrator
- Model routing · 자동 모델 선택 · 새 Provider registry

**건드리지 않는 것**
- `src/model.ts` (§12) · `src/cli.ts` · `src/context.ts` · `src/reviewer.ts`
- `verificationExcerpt` 치환 로직 (§11)
- Role Template · README · CLAUDE.md · AGENTS.md · docs/ · RFC-001
- T-017 생성 · `.bcos/` lifecycle 파일 수동 편집

## Acceptance Criteria

**판정 기준** — 각 항목은 **서로 다른 구현 실패를 막는 독립 invariant**여야 한다.
다른 AC에서 기계적으로 따라 나오는 것, 같은 invariant의 positive/negative 예시,
특정 입력값 사례는 **AC가 아니라 테스트 사례**이며 Test Requirements에 있다.

**A. RunRecord 측정값 영속화**

1. `RunRecord` 타입에 §1 표의 9개 필드가 **표와 정확히 같은 이름**으로 모두 optional 추가된다.
2. §1이 "남기지 않는다"고 한 18개 telemetry 키는 `RunRecord`에 추가되지 않는다.
3. `task execute`가 정상 완료하면 run artifact에 9개 필드가 모두 존재한다.
4. 기록된 9개 값이 **같은 실행의 stdout telemetry 값과 일치**한다
   (별도 계산 경로를 만들어 값이 갈라지면 안 된다).
5. `worker_invocations`가 그 execution의 **실제 worker 호출 횟수**와 같고,
   누적 필드는 **그 호출들의 합**이다.
6. worker가 실패로 끝난 execution에도 그 시점까지의 측정값이 기록된다 (실패 시 기록 누락 금지).
7. `--dry-run`이 만든 관찰에도 context 측정값이 기록되며,
   `worker_duration_ms`는 실제 실행이 없었음을 반영한다.

**B. 경계 보존**

8. `src/model.ts`의 diff가 **0줄**이다 (T-013 실행 경계 유지).
9. `src/cli.ts` · `src/context.ts` · `src/reviewer.ts`의 diff가 **0줄**이다 —
   따라서 **새 CLI command는 0개**다.
10. `verificationExcerpt`의 치환 대상이 `<root>` · `<home>` **2개 그대로**다.

**C. Trial record 스키마**

11. `.bcos/benchmarks/` 아래 **JSON 파일 1개 = trial 1건**이다.
12. `readTrials()`가 유효한 trial의 배열을 돌려준다.
13. `measurement_version`이 `"0.1"`이 아니면 거부한다.
14. `arm`이 `codex_only` · `claude_only` · `bcos` 셋 중 하나가 아니면 거부한다.
15. `repetition`이 1 이상의 정수가 아니면 거부한다.
16. `repository_base_commit`이 40자리 hex가 아니면 거부한다.
17. `requirement_sha256`이 64자리 hex가 아니면 거부한다.
18. `outcome.status`가 §9의 7값 중 하나가 아니면 거부한다.

**D. Provenance**

19. 모든 수치 필드가 `{ value, source }` 형태다.
20. `source`가 `measured` · `estimated` · `proxy` · `derived` · `unavailable` 중 하나가
    아니면 거부한다.
21. `source: "unavailable"`인데 `value`가 `null`이 아니면 **거부한다** — `0`도 거부한다.
22. `source`가 `unavailable`이 아닌데 `value`가 `null`이면 거부한다.
23. `system_usage`와 `evaluation_usage`가 **서로 다른 최상위 필드**로 존재한다.
24. `proxies`의 값이 token 필드로 **자동 승격되지 않는다** — 두 필드를 잇는 코드가 없다.

**E. 거부와 침묵 금지**

25. 거부 조건에 걸린 trial에 대해 `readTrials()`는 **예외를 던진다.**
    조용히 건너뛰지 않는다 — 측정 시스템이 기록을 소리 없이 버리면 안 된다.
26. 예외 메시지에 **파일명**과 **위반한 규칙**이 포함된다.

**F. Arm 대칭과 참조**

27. `arm: "bcos"`인 trial은 `bcos.task_id`가 필수이며 `^T-\d{3,}$`를 만족한다.
28. `arm`이 `bcos`가 아닌 trial에 `bcos` 필드가 있으면 거부한다.
29. `arm: "bcos"`인 trial에 `proxies` 필드가 있으면 **거부한다**
    (복제 대신 참조 강제 — proxy는 참조된 run artifact에 있다, §2).
30. `bcos.execution_ids`가 배열이며, 각 원소로 `.bcos/runs/<id>.json`에 도달할 수 있다.

**G. 실패 · Human · Privacy**

31. `status`가 `success`가 아닌 trial도 결과에 **포함된다** —
    `readTrials()`에 status 필터·성공률 계산·정렬 우선순위가 **없다.**
32. `human.intervention_count`와 `human.active_ms`가 §5 provenance 규칙으로 표현된다
    (실측이 없으면 `unavailable` + `null`).
33. 모든 테스트 fixture에 홈 절대경로 · 실제 사용자명이 **0건**이다.

**H. Canonical trial identity** (§3)

34. `case_id`가 `^CASE-[A-Z0-9]+(-[A-Z0-9]+)*$`를 만족하지 않으면 거부한다.
    **이 정규식 하나가 소문자 · 공백 · `.` · `..` · `/` · `\` · 연속·앞뒤 하이픈을 전부 배제한다** —
    별도의 문자 차단 규칙을 만들지 않는다.
35. 검증은 JSON의 `case_id` · `arm` · `repetition`으로 **기대 파일명을 조립해 실제 파일명과
    비교**하고, 다르면 거부한다. **파일명을 하이픈으로 분해해 파싱하지 않는다.**

**I. Capture ownership** (§2.1)

36. `src/benchmark.ts`는 **읽기·검증 전용**이다 — 프로세스 실행(`spawn` · `spawnSync` ·
    `exec` · `execFile` · `fork`)과 파일 쓰기(`writeFileSync` · `renameSync`)가 **0건**이다.
37. 9개 측정값은 `src/run.ts`의 **기존 run artifact write/update 경로를 그대로 재사용**한다 —
    **새 writer 함수·모듈·추상화를 만들지 않는다.**
38. baseline arm trial이 **BCOS 실행 아티팩트 없이** `readTrials()`를 통과한다
    (`.bcos/runs/`가 비어 있어도 유효).

**J. Component-level system usage** (§7.1)

39. `system_usage`가 component **목록**이며, 각 component의 `phase`가
    `planning` · `worker` · `review` · `single_agent`, `runtime`이 `codex` · `claude`라는
    **닫힌 집합**에 속하지 않으면 거부한다.
40. 각 component의 `input_tokens` · `output_tokens`에 **§5 provenance 규칙이 그대로 적용**된다.
41. `phase`가 arm과 정합해야 한다 — `bcos`는 `planning`/`worker`/`review`만,
    baseline은 `single_agent`만. 위반은 거부한다.
42. baseline arm component의 `runtime`이 arm과 다르면 거부한다.
43. **집계를 만들지 않는다** — `src/benchmark.ts`에 합계·비율·평균·백분율·순위 계산이 **0건**이다
    (component token 합산 포함). `readTrials()` 결과에 total 필드가 없다.

**K. 회귀**

44. 기존 테스트 **272개가 전부 통과**한다.
45. `npm run build`가 exit 0이다.
46. `src/run.ts` ≤ 100줄 · `src/runner.ts` ≤ 210줄 · `src/workflow.ts` ≤ 340줄 ·
    `src/benchmark.ts` ≤ 110줄.

## Expected Files

**읽기 허용 (Read List)**

- `.bcos/tasks/T-016-benchmark-trial-record.md`
- `src/run.ts`
- `src/runner.ts`
- `src/workflow.ts`
- `src/context.ts` — **읽기 전용.** 측정값이 계산되는 지점 확인용
- `src/model.ts` — **읽기 전용.** 경계를 확인하고 건드리지 않기 위해
- `tests/cli.test.ts`
- `package.json`
- `AGENTS.md`
- `.bcos/runs/20260812T124928305Z-7b47aa44.json` — real-shape fixture 근거 (§21)

**여기 없는 파일은 읽지 않는다.** RFC-001·docs·README·CLAUDE.md는 이 Task에 필요 없다.

**쓰기 허용 (Write List)**

- `src/run.ts` — RunRecord 9필드
- `src/runner.ts` — 측정값 반환 (ModelResult 확장 금지, §12)
- `src/workflow.ts` — 측정값 합산·기록
- `src/benchmark.ts` — **신규.** trial 타입 + `readTrials()`
- `tests/cli.test.ts`
- `.bcos/reports/T-016-benchmark-trial-record.md`

**새 파일은 `src/benchmark.ts` 하나다.** 이유 — trial record는 run artifact와
**소유자가 다르고**(사람 vs BCOS) **생명주기가 다르다**(수동 기록 vs 실행 중 자동).
`run.ts`에 넣으면 두 Artifact 타입이 한 파일에서 섞이고, `run.ts`는 이미 83/100줄이다.
`cli.ts`는 520줄로 상한이며 새 command도 없으므로 여기 넣을 이유가 없다.

## Test Requirements

**모든 테스트는 `node:test`. 새 test framework·runner·assertion 라이브러리를 추가하지 않는다.**

**AC는 invariant를, 아래 목록은 그 invariant를 깨뜨리는 구체적 입력을 담는다.**
AC와 테스트를 1:1로 만들지 않는다 — 하나의 AC를 여러 케이스가 지킬 수 있다.

**T1. 측정값 영속화 (AC 1–7)**
- 정상 실행 후 run artifact의 9필드가 stdout telemetry와 **값까지 일치**
- worker 2회 호출 실행 → `worker_invocations === 2` + 누적 필드가 두 호출의 합
- worker 1회 호출 실행 → `worker_invocations === 1`
- `verification_duration_ms`가 검증을 실제 수행한 실행에서 `> 0`
- worker 실패 실행에서도 그 시점까지의 측정값 존재
- `--dry-run` 관찰의 context 측정값 존재
- §1이 제외한 18개 키가 run artifact에 **없음**

**T2. 경계 (AC 8–10)**
- `src/model.ts`에 `.bcos` · `context` · `stdin_bytes` 0건
- CLI command 목록 불변

**T3. Trial 스키마 거부 (AC 11–18)**
- 각 거부 조건마다 **독립 케이스**. 하나의 fixture로 여러 규칙을 동시에 위반시키지 않는다
  (T-900 교훈 — 우연한 통과 방지)
- `arm: "bcos_claude"` · `repetition: 0` · `repetition: 1.5` · 39자리 commit ·
  63자리 sha256 · `measurement_version: "0.2"` · `status: "partial"`

**T4. Provenance (AC 19–24)**
- `unavailable` + `0` → 거부 **(단독 케이스로 명시)** — 21의 가장 위험한 형태
- `unavailable` + `null` → 통과
- `measured` + `null` → 거부
- `source: "guessed"` → 거부
- proxy가 token 필드로 승격되지 않음

**T5. 거부 방식 (AC 25–26)**
- 무효 trial에서 **예외 발생**, 메시지에 파일명 + 규칙
- 유효 2건 + 무효 1건 → 예외 (조용한 누락 금지)

**T6. Arm 대칭 (AC 27–30)**
- bcos arm + `proxies` → 거부
- baseline arm + `bcos` 필드 → 거부
- baseline arm + `proxies` → **통과** (기록처가 여기뿐이다)
- `execution_ids`로 실제 run 파일 도달

**T7. 실패·Human·Privacy (AC 31–33)**
- 7개 status 전부 저장·조회 가능, 실패 trial이 결과에 포함됨
- `human.active_ms` = `unavailable` + `null` → 통과
- `human.intervention_count` = `measured` + 정수 → 통과

**T8. Canonical identity (AC 34–35)**
- slug 위반을 **각각 독립 케이스**로: 소문자 · 연속 하이픈 · 앞뒤 하이픈 · 공백 · `.` ·
  `..` · `/` · `\`
- 파일명/내용 불일치를 **세 축 각각** 독립으로: `case_id` 다름 · `arm` 다름 · `repetition` 다름
- `CASE-FE-001`처럼 **하이픈 2개를 가진 case_id**로 조립-후-비교가 정확함을 확인
  (하이픈 분해 구현이었다면 여기서 깨진다)
- zero-padded `repetition` 파일명(`…-bcos-01.json`) 거부 —
  **35의 조립-비교로 자동 거부되며 별도 규칙이 아니다**

**T9. Capture ownership (AC 36–38)**
- `src/benchmark.ts` 소스에 `spawn` · `exec` · `fork` · `writeFileSync` · `renameSync` **0건**
- `.bcos/runs/`가 **비어 있는** 상태에서 baseline arm trial만으로 `readTrials()` 통과
- 9개 측정값이 기존 run artifact 경로로 기록됨 (T1이 이미 확인 — 새 writer 없음)

**T10. Component-level usage (AC 39–43)**
- `phase` 4값 · `runtime` 2값 밖의 값 거부 (각각 독립 케이스)
- bcos arm의 3 component 동시 표현 → **통과**
- bcos arm + `single_agent` → 거부
- baseline arm에 `planning`/`worker`/`review`가 섞이면 → 거부
- `codex_only` + `single_agent/claude` → 거부
- component의 `unavailable` + `0` → 거부 (§5 규칙이 component에도 적용됨을 **직접** 확인)
- `readTrials()` 결과에 total·합계 필드가 **존재하지 않음**

**T11. Real-shape fixture (필수)**
- **한 줄짜리 synthetic fixture만으로 전부 채우지 않는다.**
- 최소 1개 테스트는 `.bcos/runs/20260812T124928305Z-7b47aa44.json`의 **실제 구조를 닮은**
  run artifact와, 그것을 참조하는 bcos arm trial을 함께 쓴다.
  이 trial은 §7.1의 **3 component를 모두 갖춘** 실제 모양이어야 한다.
- **fixture에 실제 사용자명·홈 경로를 넣지 않는다** (AC 33).

**개수를 미리 약속하지 않는다.** 위 계열을 덮는 데 필요한 만큼 쓴다.
**기존 272개는 전부 유지되어야 한다** (AC 44).

## Notes

**이 Task가 반증 도구인 이유.** trial record는 실패를 지우지 못하고(AC 31),
없는 값을 0으로 만들지 못하고(AC 21–22), proxy를 token으로 승격하지 못한다(AC 24).
집계가 없으므로 유리한 지표만 고를 자리도 없다(AC 43).
**결과가 BCOS에 불리해도 그대로 남는다.**

**왜 `src/benchmark.ts`가 지금 필요한가 — Ponytail 자기검토.**
"소비자는 T-017인데 지금 만들 필요가 있는가"는 정당한 의문이다.
답 — **없으면 벤치마크를 시작할 수 없다.** baseline 두 Arm은 BCOS를 실행하지 않으므로
기록할 형식 자체가 없고, 형식만 문서로 정하고 검증기를 미루면 첫 실험 데이터가
검증되지 않은 채 쌓인다. `.bcos/amendments/`도 T-900에서 형식과 검증기를 같이 냈다.

**결정 A와 B를 한 Task로 묶은 이유.** A만 하면 소비자가 없고, B만 하면
BCOS Arm의 측정값이 계속 버려진다. 둘은 하나의 능력이다.

**남는 미검증 가정.**
- 사람이 trial JSON을 손으로 쓰는 것이 실제로 오류를 얼마나 낳는가 → 첫 실험이 판단한다.
  오류가 잦으면 그때 command를 만든다(§4).
- 세 Arm에 동일하게 적용할 **외부 평가 게이트를 어떻게 만들 것인가**는 아직 미해결이다.
  T-016은 그 결과를 적을 자리(`outcome.gate_ac_*`)만 만들고 게이트를 만들지 않는다.
  **게이트 없이 얻은 비교는 §16의 "기준이 다른 비교"이며 신뢰할 수 없다** — T-017 이전에 결정해야 한다.
- token 값은 현재 세 Arm 모두 `unavailable`이다. **token 없이 비용을 비교할 수 있는가**는
  열린 질문이며, proxy만으로 결론을 내리면 안 된다.

**Known Requirement — `requirement_sha256`의 한계와 Case Registry.**

1. **`requirement_sha256`는 "같은 요구사항 버전인가"만 검증한다.**
   두 trial의 해시가 같으면 같은 요구사항이고, 다르면 다르다 — 거기까지다.
   **해시에서 requirement 본문을 복구할 수 없다.** 해시는 단방향이다.
   따라서 `requirement_sha256`가 일치한다는 사실만으로 "무엇을 시켰는지"를 재구성할 수 없고,
   본문은 **별도로 보존되어야 한다.** T-016은 그 보존처를 만들지 않는다.
2. **controlled benchmark를 실행하기 전에 canonical case definition이 별도로 필요하다.**
   `case_id` · requirement 본문 · `verification_command` · 평가 게이트 기준이 한 곳에 고정되어야
   세 Arm이 같은 문제를 푼 것이 된다. **지금 trial record는 그 정의를 *가리킬* 뿐 *담지* 않는다.**
3. **Case Registry 구현은 T-016 scope가 아니다.** T-017 또는 실제 benchmark setup에서 결정한다.
   **그 결정 전에 수집한 trial은 case 정의가 흔들릴 수 있으므로 비교 근거로 쓰면 안 된다.**

**T-015와의 관계.** `--worker claude`는 존재하지만 **기본 BCOS 경로가 아니다**(§6).
이 Task는 그 조합을 벤치마크 Arm으로 승격하지 않는다.
