# BCOS

**감사·재현·반증 가능한 AI 코딩 workflow를 위한 Git-native, Task-contract-first engineering protocol.**

> **상태: Experimental.** Task protocol `0.1`과 CLI prototype 단계이며 아직 호환성을
> 약속하지 않는다. 기준은 [RFC-001 §10](rfcs/RFC-001-task-protocol.md)에 있다.

영문 공식 진입점: [README.md](../README.md)

---

## BCOS를 만든 이유

AI 코딩 workflow에는 계획, 인수인계, 검증, 리뷰가 추가된다. 그 단계들이 재작업을 막을
수도 있고, 반대로 단계 자체의 비용이 이익보다 클 수도 있다. BCOS는 이 workflow의 입력,
과정, 출력을 Git에 남겨 그 trade-off를 가정하지 않고 관찰하고 검증하게 한다.

> **When does multi-agent orchestration actually pay for itself?**

아직 답은 없다. T-016은 measurement harness이고 미래 T-017 controlled benchmark는
실행되지 않았다. 따라서 BCOS가 single-agent 경로보다 속도·비용·품질 면에서 낫다고
주장하지 않는다.

출발점이 된 문제도 여전히 중요하다. 세션이 끝나면 Context가 사라지고, 실행기 사이에
지속되는 진실 원천이 없으며, 구현자는 자기 작업에 편향될 수 있다. 매번 저장소 전체를
다시 읽는 데 Context가 들고, chat에 숨은 진행은 감사하기 어렵다. BCOS는 이 상태를
저장소 아티팩트로 옮기고, 그렇게 하는 비용까지 측정 가능하게 만든다.

> AI가 프로젝트를 기억하는 것이 아니라, 프로젝트가 AI를 기억한다.

## Input → Process → Output

```text
INPUT    Task Contract (Objective, Scope, Out of Scope, Acceptance Criteria,
         Read/Write Scope, Test Requirements)
         + Context Package + worker runtime
         + 직전 Review 또는 Host Verification 실패

PROCESS  Worker 실행 → Host Verification → submit
         → Independent Review → 필요하면 재작업 → Human 승인

OUTPUT   code diff + Report + Review + lifecycle events + RunRecord
         + benchmark trial
```

위 항목은 제안이 아니라 현재 존재하는 아티팩트다. Task가 끝나도 과정은 지워지지 않는다.
attempt 수, Host Verification 실패, `CHANGES_REQUESTED` 판정, Human 개입이 최종 상태와
함께 남는다. 따라서 곧바로 통과한 궤적과 재작업 뒤 통과한 궤적을 같은 최종 `PASS`로
뭉개지 않는다. 다만 이 기록이 모든 우연한 통과를 탐지한다고 주장하지는 않는다.

RunRecord에는 workflow 원시 측정값 9개가 영속화된다.

- 입력: `context_files`, `context_chars`, `context_bytes`, `stdin_bytes`
- 과정: `worker_invocations`, `worker_duration_ms`, `verification_duration_ms`
- 출력 분량: `worker_stdout_bytes`, `worker_stderr_bytes`

경계는 다음과 같다.

```text
context_chars ≠ context_bytes ≠ input_tokens ≠ billed cost
```

문자·바이트 수는 proxy로 쓸 수 있지만 token 측정값은 아니다. direct token 값은
`unavailable`일 수 있으며, 이때 값은 0이 아니라 `null`이다.

## 왜 반증 가능한가

BCOS는 orchestration의 이익을 내장된 전제가 아니라 검증할 가설로 다룬다.

- 실패한 RunRecord를 성공한 실행 옆에 그대로 보존한다.
- attempt, Host Verification 실패, Review 판정으로 재작업 이력을 보존한다.
- `unavailable`은 `value: null`이어야 하므로 없는 측정값이 0으로 바뀌지 않는다.
- 바이트 수 같은 proxy를 측정된 token 값으로 저장할 수 없다.
- T-016은 원시값과 참조를 보존하며 합계·평균·비율·순위를 계산하지 않는다.

controlled result는 BCOS에 유리할 수도, 차이가 없을 수도, BCOS가 더 비쌀 수도 있다.
셋 모두 유효한 결과다. 세 번째 결과는 측정 시스템의 실패가 아니라 workflow를 단순화하거나
선택적으로 적용할 근거다.

## 역할은 Task에 있다

```text
Task Contract → Role → Runtime
```

영구 AI role persona는 BCOS의 핵심 추상화가 아니다. Task Contract가 역할, 범위, 증거,
제약을 정하고 사용 가능한 runtime이 실행한다. 같은 Codex runtime도 어떤 Task를 받는지에
따라 한 세션에서는 backend 구현을, 다른 세션에서는 test 작업을 수행할 수 있다.

소유권을 모호하게 하지 않도록 세 축을 구분한다.

| 축 | 의미 |
|---|---|
| `role` | Task Contract가 요구하는 책임 |
| `runtime` | 세션을 실행한 도구. 현재 `codex` 또는 `claude` |
| `actor_id` | lifecycle action의 책임 주체 |

기본 운영 정책은 Claude Manager/Architect/Reviewer + Codex Worker다.
`--worker claude`는 선택 가능한 runtime 능력이며 기본 정책이 아니다.
Role-based Task Template은 계획 항목이고 현재 존재하지 않는다.

`actor_id`는 인증된 신원이 아니라 자기 신고 값이다. 따라서 직무 분리는 신뢰 환경을
전제하며, 인증은 protocol `0.1`이 현재 제공하지 않는 알려진 한계다.

## BCOS가 아닌 것

영구 AI role persona는 BCOS의 핵심 추상화가 아니다.

BCOS는 자율 소프트웨어 회사가 아니고, multi-agent가 본질적으로 우월하다는 주장도 아니며,
속도나 비용 우위를 보인 benchmark 결과도 아니다. 실패한 실행을 버리는 시스템도 아니다.
이 질문들을 검증하기 위한 protocol이자 측정 경계다.

## 설계 원칙

| 원칙 | 의미 |
|---|---|
| Project Owns Memory | 지속되는 상태는 저장소 아티팩트가 소유한다 |
| Agents Are Stateless | 세션은 프로젝트 기억이 되지 않고 교체 가능하다 |
| Roles Belong to Tasks | Task Contract가 책임을 정의한다 |
| One Artifact, One Owner | Task, Report, Review의 작성자를 분리한다 |
| Architecture Before Implementation | 코드보다 경계 검증이 앞선다 |
| Small Context by Default | Task마다 읽기 범위를 선언한다 |
| Human-Controlled Autonomy | 방향, 위험, 승인, 릴리스는 사람이 맡는다 |

자세한 내용: [vision.md](vision.md)

## 현재 구현된 기능

- Task, Report, Review, Event, Run, Benchmark 아티팩트를 Git에 남기는 Task Protocol `0.1`
- `start`, `submit`, `approve`, `request-changes` lifecycle 명령과 쓰기 전 guard
- 제출한 `actor_id`가 같은 attempt를 승인하지 못하게 하는 직무 분리
- Task Read List로 제한되고 같은 입력에 같은 결과를 내는 `task context`
- 고정 preamble과 Context Package를 stdin으로 Codex 또는 선택적 Claude worker에 전달하는
  `task run`; runner는 lifecycle을 소유하지 않는다
- start, worker, Host Verification, submit을 잇고 독립 review와 제한된 재작업 cycle을
  선택적으로 수행하는 `task execute`
- 검증·리뷰 실패를 대화가 아니라 크기가 제한된 저장소 아티팩트로 다음 attempt에 전달
- 단계 결과, 실패 관찰, runtime 정체성, 위 9개 원시 측정값을 남기는 RunRecord
- 최신 실행이나 특정 execution을 쓰기 없이 읽는 `task status`
- 세 benchmark arm과 provenance 수치를 검증하는 T-016 trial reader
- 런타임 의존성 0개

RunRecord와 Task lifecycle은 서로 다른 사실을 기록한다. Task가 `IMPLEMENTED`인데 최신
workflow run은 `failed`일 수 있으며 어느 쪽도 다른 쪽을 덮어쓰지 않는다.

### 아직 구현하지 않은 기능

- `task block`, `task unblock`, `task create`, `task list`, `task show`
- `bcos init`, 프로젝트 전체 status, reindex
- Role-based Task Template
- worktree로 격리된 병렬 worker
- Adaptive Router와 Complexity Classifier
- 자동 workflow 선택과 complexity threshold
- Digital Docent 검증
- canonical benchmark case, 공통 외부 evaluation gate, controlled benchmark report

미래 증거가 단순 Task에는 가벼운 경로를, 복잡하거나 고위험인 Task에는 더 많은
orchestration을 제안할 수 있다. 이는 나중에 검증할 가설이며 현재 routing 기능이 아니다.

## Benchmark 정책

controlled comparison의 arm은 정확히 셋이다.

| Arm | 경로 |
|---|---|
| `codex_only` | Codex가 계획·구현·자기검사 |
| `claude_only` | Claude가 계획·구현·자기검사 |
| `bcos` | Claude 계획 → Task Contract → Codex Worker → Host Verification → Claude 독립 Review |

T-016은 measurement harness로 원시 trial record를 검증한다. T-017은 미래 controlled
benchmark/report이며 아직 수행되지 않았다.

- 모든 수치는 `measured`, `estimated`, `proxy`, `derived`, `unavailable` 중 하나로
  provenance를 표시한다.
- 실패 trial도 데이터이며 reader가 제외하지 않는다.
- workflow 원시 측정값은 RunRecord에 두고 BCOS trial은 복제 대신 이를 참조한다.
- system usage와 외부 evaluation usage를 분리한다.
- 한 Task나 서로 비교할 수 없는 역사적 관찰에서 결론을 만들지 않는다.

[과거 benchmark 기록](benchmarks/)은 관찰 자료로 남아 있으며, 현재 benchmark 결과나
성능 주장으로 취급하지 않는다.

## 직접 실행해 보기

Node.js 24 이상이 필요하며 런타임 의존성은 없다.

```bash
npm install
npm run build
npm test
node dist/cli.js --help
```

명령은 현재 작업 디렉터리의 `.bcos/`를 대상으로 한다. 아직 `bcos init`이 없으므로 새
프로젝트는 `.bcos/` 구조와 자기 계약 및 허용 Context를 Read List에 넣은 Task를 직접
준비해야 한다.

```text
node dist/cli.js task context T-007
node dist/cli.js task run <IN_PROGRESS-Task-ID> --worker codex --dry-run
node dist/cli.js task status <Task-ID>
```

`--dry-run`은 model process를 시작하거나 입력 본문을 출력하지 않고 command metadata와
입력 hash를 보여준다.

## 프로젝트 구조

```text
.bcos/tasks/          Manager 소유 Task Contract
.bcos/reports/        Worker 소유 Implementation Report, append-only
.bcos/reviews/        Reviewer 소유 Independent Review, append-only
.bcos/runs/           Workflow 실행 관찰
.bcos/benchmarks/     Benchmark trial record
.bcos/events.jsonl    Append-only lifecycle 감사 로그
.bcos/state.json      Task에서 재생성 가능한 파생 index
docs/                 Vision, architecture, protocol, decision, measurement 문서
src/                  CLI 구현
tests/                Test
```

## 관련 문서

| 문서 | 내용 |
|---|---|
| [Vision](vision.md) | 문제, 원칙, roadmap |
| [Architecture](architecture.md) | 저장소 배치와 실행 제약 |
| [RFC-001 Core](rfcs/RFC-001-task-protocol.md) | 규범 Task Protocol |
| [RFC-001 Appendix](rfcs/RFC-001-task-protocol-appendix.md) | 비규범 근거와 edge case |
| [ADR-003](decisions/ADR-003-task-centric-workers.md) | 역할을 Task에 두는 이유 |
| [Telemetry](benchmarks/TELEMETRY.md) | 측정 field 정의 |

## 기여하기

[CONTRIBUTING.md](../CONTRIBUTING.md)를 참고한다. Protocol `0.1`은 예고 없이 바뀔 수 있다.

## 라이선스

[MIT License](../LICENSE)
