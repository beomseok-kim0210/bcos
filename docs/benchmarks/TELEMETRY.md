# Benchmark Telemetry — 필드 정의

**Raw Data만 정의한다.** 이 문서에 비율·개선율·절감률은 없다.

BCOS의 최종 비교 실험은 같은 Task를 세 방식으로 수행하고 값을 나란히 놓는 것이다.

| arm | 뜻 |
|---|---|
| `claude-only` | Claude Code 한 대화로 처음부터 끝까지 |
| `codex-only` | Codex CLI 한 세션으로 처음부터 끝까지 |
| `bcos` | Task 계약 · Context Package · Runner · 독립 Review |

**세 arm 중 둘은 BCOS 저장소 밖에서 돈다.** 그래서 필드 정의가 Task 문서가 아니라
여기에 있다. `claude-only` 실행에는 Task도 Benchmark 파일도 없지만 **같은 키로**
기록해야 비교가 성립한다.

## 절대 규칙

1. **계산 결과를 저장하지 않는다.** `efficiency` · `improvement` · `savings` ·
   `reduction` · `ratio` · `rate` 로 끝나는 키를 만들지 않는다.
2. **모르면 `N/A`를 쓴다.** 추정값을 관측값 자리에 넣지 않는다.
3. **추정이 필요하면 키를 분리한다.** `context_tokens`(관측)와
   `context_tokens_estimated`(문자수 ÷ 4)는 다른 필드다.
4. **비교는 실험이 끝난 뒤 Benchmark Report에서 한다.** 여기서도, Task에서도 하지 않는다.

## 가용성 표기

| 표기 | 뜻 |
|---|---|
| `now` | BCOS가 이미 값을 만든다 |
| `T-009` | 이 Task에서 출력하기 시작한다 |
| `T-010` | Model Adapter가 있어야 알 수 있다 |
| `manual` | 도구가 관측할 수 없다. 사람이 적는다 |
| `blocked` | 프로토콜 변경이 필요하다. 사유를 명시한다 |

---

## 1. Run Identity

| key | 단위 | 출처 | 가용성 |
|---|---|---|---|
| `arm` | `claude-only` \| `codex-only` \| `bcos` | 실험자 | manual |
| `task_id` | 문자열 | Task frontmatter | now |
| `attempt` | 정수 | Task frontmatter | now |
| `protocol` | 문자열 | Task frontmatter | now |

`arm`이 `bcos`가 아니면 `task_id`는 "같은 문제"를 가리키는 라벨일 뿐 Task 파일이 없다.

## 2. Human Metrics

**BCOS는 사람이 하는 일을 관측할 수단이 없다.** 터미널 밖의 행동은 도구에 보이지 않는다.
전부 `manual`이며, 그 사실을 감추지 않는다.

| key | 단위 | 정의 | 가용성 |
|---|---|---|---|
| `human_actions` | 건 | 사람이 실행한 명령·클릭·붙여넣기의 총합 | manual |
| `human_approval_count` | 건 | 사람이 "진행해도 좋다"고 판단한 횟수 | manual |
| `human_prompt_paste_count` | 건 | 사람이 프롬프트를 복사해 붙여넣은 횟수 | manual |
| `human_context_transfer_count` | 건 | 사람이 Context를 복사해 옮긴 횟수 | manual |
| `human_waiting_time_seconds` | 초 | 사람이 worker를 기다린 시간 | manual |
| `human_active_time_seconds` | 초 | 사람이 실제로 손을 움직인 시간 | manual |

`bcos` arm의 `human_approval_count`만은 `events.jsonl`의 `TASK_APPROVED` 수로
교차 확인할 수 있다. **나머지는 교차 확인 수단이 없다.**

`human_context_transfer_count`는 T-008 이후 `bcos` arm에서 0이 된다 — Runner가 옮긴다.
이것이 세 arm을 가르는 가장 직접적인 값이다.

## 3. Time Metrics

| key | 단위 | 출처 | 가용성 |
|---|---|---|---|
| `task_start_time` | RFC 3339 | `TASK_STARTED` 이벤트 | now |
| `first_worker_response_ms` | ms | worker 첫 출력까지 걸린 시간 | **T-009** |
| `review_start_time` | RFC 3339 | — | **blocked** |
| `approval_time` | RFC 3339 | `TASK_APPROVED` 이벤트 | now |
| `total_wall_time_seconds` | 초 | `TASK_STARTED` → `TASK_APPROVED` | now |

**`review_start_time`이 blocked인 이유** — Review 시작을 나타내는 이벤트가 프로토콜에
없다. `REVIEW_STARTED`를 추가하는 것은 RFC-001 §5 변경이며 별도 승인 대상이다.
그전까지는 Review 파일의 Attempt 시각을 **종료 시각**으로만 쓴다. 시작 시각은 `N/A`다.

## 4. Token Metrics

**지금은 전부 `N/A`다.** BCOS는 worker의 출력을 해석하지 않으므로 사용량을 모른다.
필드는 T-010이 채운다.

| key | 단위 | 가용성 |
|---|---|---|
| `input_tokens` | 정수 | T-010 |
| `output_tokens` | 정수 | T-010 |
| `total_tokens` | 정수 | T-010 |
| `context_tokens` | 정수 | T-010 |

**확장 지점** — T-010 Model Adapter는 worker마다 사용량 보고 방식이 다르다는 것을
전제로 설계한다. 그래서 위 네 필드에 더해 다음을 남긴다.

| key | 단위 | 뜻 |
|---|---|---|
| `token_source` | 문자열 | 값의 출처. 예: `codex-json` · `api-response` · `none` |
| `token_measured` | `true` \| `false` | 관측값인가 추정값인가 |

**`token_measured: false`인 값으로 비교하지 않는다.** 추정끼리도 비교하지 않는다 —
arm마다 추정 방식이 다르면 그 차이가 결과처럼 보인다.

## 5. Context Metrics

**BCOS의 핵심이다.** `bcos` arm에서만 결정론적으로 관측된다.

| key | 단위 | 출처 | 가용성 |
|---|---|---|---|
| `context_files` | 개 | Context Package 헤더 `files:` | now |
| `context_bytes` | byte | Context Package 크기 | now |
| `context_lines` | 줄 | Context Package 헤더 `lines:` | now |
| `context_chars` | 문자 | Context Package 헤더 `characters:` | now |
| `context_sha256` | hex | Context Package 해시 | now |
| `duplicate_files_removed` | 개 | Read List 항목 수 − `context_files` | now (파생) |
| `read_list_entries` | 개 | Task의 Read List 항목 수 | now |
| `stdin_bytes` | byte | worker에게 실제로 넣은 입력 | **T-009** |
| `stdin_sha256` | hex | 같은 입력이 같은 바이트인지 | now |
| `context_tokens_estimated` | 정수 | `context_chars ÷ 4` | manual |

`claude-only`·`codex-only` arm에는 Context Package가 없다. 그 경우
`context_files`는 **사람이 세어 적는다**(manual). 무엇을 읽었는지 관측할 수 없으면
`N/A`이지 0이 아니다.

**`duplicate_files_removed`는 파생값이지만 비율이 아니다.** 두 관측값의 차이이므로
Raw Data로 취급한다. 나눗셈이 들어가면 그때부터 금지 대상이다.

## 6. Worker Metrics

| key | 단위 | 출처 | 가용성 |
|---|---|---|---|
| `worker_name` | 문자열 | `--worker` 값 | now |
| `worker_runtime` | 문자열 | worker 실행 형태. 예: `node <codex.js>` | **T-009** |
| `worker_exit_code` | 정수 | child exit code | now |
| `worker_duration_ms` | ms | spawn → close | now |
| `worker_stdout_bytes` | byte | 전달한 stdout 바이트 | now |
| `worker_stderr_bytes` | byte | 전달한 stderr 바이트 | now |
| `worker_timeout_seconds` | 초 \| `none` | 설정값 | **T-009** |
| `worker_timed_out` | `true` \| `false` | timeout 발생 여부 | now |
| `retry_count` | 정수 | 재시도 횟수 | now (**항상 0**) |

**`retry_count`가 항상 0인 이유** — 재시도 엔진이 없다. T-008에서 명시적으로 배제했다.
필드를 남기는 이유는 이후에 생겼을 때 **키가 바뀌지 않게** 하기 위해서다.

## 7. Quality Metrics

| key | 단위 | 출처 | 가용성 |
|---|---|---|---|
| `acceptance_criteria_total` | 개 | Task 문서 | manual |
| `acceptance_criteria_passed` | 개 | Review | manual |
| `tests_total` | 개 | `npm test` 출력 | manual |
| `tests_passed` | 개 | `npm test` 출력 | manual |
| `review_findings` | 개 | Review §Findings | manual |
| `review_findings_blocking` | 개 | Review §Findings | manual |
| `regression_count` | 개 | Review | manual |
| `rework_count` | 개 | `TASK_CHANGES_REQUESTED` 수 | blocked |
| `first_review_verdict` | `APPROVED` \| `CHANGES_REQUESTED` | Review 제목 | now |

**대부분 manual인 이유** — Report와 Review는 사람이 읽으라고 쓴 산문이다.
숫자를 뽑으려면 산문 파서가 필요한데, **파서를 만들지 않는다.** 산문을 기계가 읽게
만들려면 Report 스키마를 바꿔야 하고 그건 RFC-001 §3 변경이다.

`rework_count`가 blocked인 이유도 같다 — `request-changes` 전이가 아직 명령이 아니라
이벤트가 남지 않는다.

## 8. Lifecycle Metrics

| key | 단위 | 출처 | 가용성 |
|---|---|---|---|
| `current_state` | 상태명 | Task frontmatter | now |
| `transition_count` | 건 | 해당 Task의 이벤트 수 | now |
| `events` | 배열 | `events.jsonl`에서 해당 Task 행 | now |
| `runner_transitions_caused` | 건 | Runner가 일으킨 전이 | now (**항상 0**) |

`claude-only`·`codex-only` arm에는 lifecycle이 없다. 전부 `N/A`다.
**`N/A`와 0을 구분한다** — "전이가 없었다"와 "전이 개념이 없다"는 다르다.

## 9. Session / Handoff Metrics

**모델을 바꿀 때 사람이 프로젝트를 다시 설명하는 비용**이 BCOS가 없애려는 것이다.
그 비용을 직접 재는 필드다.

| key | 단위 | 정의 | 가용성 |
|---|---|---|---|
| `session_id` | 문자열 | 한 번의 연속 작업 단위 식별자 | manual |
| `handoff_count` | 건 | 작업이 사람·세션·도구 사이를 넘어간 횟수 | manual |
| `worker_switch_count` | 건 | 같은 Task에서 worker를 바꾼 횟수 | manual |
| `context_reused` | 건 | 이전과 **같은 `context_sha256`**으로 다시 투입한 횟수 | now |
| `context_regenerated` | 건 | Context Package를 새로 만든 횟수 | now |
| `manual_prompt_bytes` | byte | 사람이 손으로 쓴 프롬프트 크기 | manual |
| `generated_prompt_bytes` | byte | 도구가 만든 preamble 크기 | T-009 |
| `worker_completed` | `true` \| `false` | worker가 스스로 끝냈는가 | now |
| `worker_interrupted` | `true` \| `false` | 사람·timeout·한도로 끊겼는가 | now |
| `worker_exit_reason` | `completed` \| `timeout` \| `error` \| `killed` \| `unknown` | 종료 사유 | now |

**`worker_exit_reason`은 분류지 계산이 아니다.** exit code와 `worker_timed_out`에서
곧바로 정해지며 비율이 아니다.

`manual_prompt_bytes`와 `generated_prompt_bytes`는 **둘 다 원시값이다.**
`bcos` arm의 T-009 이후 `manual_prompt_bytes`는 0이 된다.

**이 필드들로 지금 계산하지 않는다.**

| 금지 | 언제 |
|---|---|
| Prompt Compression Ratio | T-013 Benchmark Report |
| Context Reuse Rate | T-013 |
| Handoff Reduction | T-013 |
| Worker Completion Rate | T-013 |

## 10. Cost Metrics

**전부 `N/A`다.** 필드만 정의한다.

| key | 단위 | 가용성 |
|---|---|---|
| `input_cost` | USD | T-010 |
| `output_cost` | USD | T-010 |
| `total_cost` | USD | T-010 |
| `estimated_cost` | USD | T-010 |
| `cost_source` | 문자열 | T-010 — 단가표 출처와 조회 시점 |

**단가는 바뀐다.** `cost_source` 없이 기록된 비용은 나중에 재현할 수 없다.
T-010은 단가를 코드에 박지 말고 값과 함께 출처를 남긴다.

---

## 공개 지표와의 관계

용어를 맞추되 **BCOS 안에서 계산하지 않는다.**

| 공개 지표 | 대응하는 Raw Data | BCOS가 계산하는가 |
|---|---|---|
| SWE-bench Resolve Rate | `first_review_verdict` · `acceptance_criteria_passed` | **아니오** |
| HumanEval pass@k | `tests_passed` · `attempt` | **아니오** |
| EvalPlus | `tests_total` · `tests_passed` | **아니오** |
| OpenHands Index | `human_actions` · `total_wall_time_seconds` | **아니오** |
| METR Time Horizon | `total_wall_time_seconds` · `worker_duration_ms` | **아니오** |
| DORA | `events` · `approval_time` | **아니오** |

**BCOS는 이 지표들의 구현체가 아니다.** 같은 이름을 쓰는 것은 나중에 결과를 읽는
사람이 익숙한 용어로 해석할 수 있게 하려는 것뿐이다. Resolve Rate를 자칭하려면
SWE-bench 데이터셋으로 돌려야 하는데 그렇게 한 적이 없다.

## Task 문서에서의 사용

Task 문서의 `## Benchmark Telemetry` 섹션은 **값을 적는 곳이 아니다.**
그 Task가 **이번에 새로 남기기 시작하는 필드**만 적는다. 값은 완료 후
`docs/benchmarks/T-0NN-*.md`에 들어간다.

이미 `now`인 필드를 Task마다 다시 나열하지 않는다. 그건 이 문서가 한다.

`## Benchmark Telemetry`는 **선택 섹션이다.** RFC-001 §2.2의 필수 6개 섹션에
넣지 않는다 — 넣으면 G2 검증과 기존 여덟 Task 전부를 고쳐야 하고, 얻는 것은
"빈 섹션이 강제로 존재함"뿐이다.

## 최종 비교 실험에서 볼 값

세 arm을 나란히 놓을 때 실제로 의미가 있는 축이다. **여기서 계산하지 않는다.**

| 축 | 쓰는 Raw Data |
|---|---|
| 해결 여부 | `first_review_verdict` · `acceptance_criteria_passed` |
| 첫 시도 승인 | `attempt` · `first_review_verdict` |
| 재작업 | `rework_count` (blocked) |
| 회귀 | `regression_count` |
| 승인된 Task당 토큰 | `total_tokens` + `token_measured` |
| 승인된 Task당 비용 | `total_cost` + `cost_source` |
| 승인까지의 시간 | `total_wall_time_seconds` |
| 사람이 실제로 쓴 시간 | `human_active_time_seconds` · `human_actions` |
| 인수인계 | `handoff_count` · `human_context_transfer_count` |
| 재설명 비용 | `manual_prompt_bytes` · `context_regenerated` |
| worker 교체 | `worker_switch_count` |
| 한도로 인한 중단 | `worker_interrupted` · `worker_exit_reason` |

## 공정성 — 아직 풀리지 않은 문제

**아래가 확정되기 전에는 arm 간 개선율을 주장하지 않는다.** T-012 착수 조건이다.

1. **`claude-only` · `codex-only`에 BCOS Task 문서를 줄 것인가?**
   주면 BCOS의 산출물(범위·AC·Read List)을 이미 준 것이라 비교가 무너진다.
   안 주면 세 arm이 푸는 문제가 서로 달라진다.
2. **주지 않는다면 같은 문제 정의를 어떻게 보장하는가?**
   최소한 Objective와 Acceptance Criteria는 공유해야 "같은 Task"라고 부를 수 있다.
   그 경계를 어디에 그을지 정해야 한다.
3. **평가자가 어느 arm의 결과인지 모르게 할 수 있는가?**
   `bcos` arm은 Report·Review·이벤트를 남기므로 산출물 형태만으로 구분된다.
   블라인드 평가를 하려면 코드 diff만 떼어 평가해야 한다.
4. **같은 시작 commit을 어떻게 보장하는가?**
   arm마다 저장소 상태가 다르면 난이도가 다르다. commit 해시를 고정하고 기록한다.
5. **모델과 CLI 버전을 어떻게 고정하는가?**
   `codex-cli` 버전, 모델 이름, 모델 버전을 실행 시점에 기록해야 재현할 수 있다.
6. **timeout · tool 권한 · sandbox 조건을 어떻게 맞추는가?**
   `bcos` arm은 Runner가 `--sandbox`를 지정하지 않아 Codex 기본값을 쓴다.
   다른 arm이 더 넓은 권한으로 돌면 그 차이가 결과처럼 보인다.

**이 여섯이 답해지지 않은 상태의 비교는 일화이지 측정이 아니다.**

## 아직 정의하지 않은 것

- **비교 실행 절차** — 같은 Task를 세 arm으로 어떻게 돌리는지. 위 여섯 문제의 답. T-012.
- **결과 집계 형식** — 세 arm의 값을 어떤 파일에 모으는지. T-012.
- **Benchmark Report** — 비교와 해석. T-013. **여기서 처음으로 나눗셈을 허용한다.**
