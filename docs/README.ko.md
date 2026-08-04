# BCOS

BCOS는 Claude Code와 Codex 같은 AI 코딩 도구가 Task, Report, Review, Git 기록을 기준으로
협업하도록 만드는 Git 기반 개발 운영 도구다.

지금은 실험 단계다. 프로토콜 버전은 `0.1`이고 호환성을 약속하지 않는다.

영문 문서가 공식 진입점이다 — [README.md](../README.md)

---

## BCOS를 만든 이유

AI에게 코드를 짜게 하는 것과, AI가 참여하는 프로젝트의 상태를 관리하는 것은 다른 문제다.
전자는 이미 잘 된다. 후자가 잘 안 된다.

이 프로젝트도 그 문제를 직접 겪었다.

첫 두 개의 작업(T-001, T-002)에서 구현은 성공했고 리뷰도 통과했다. 그런데 두 번 모두
**상태 전이 기록이 누락됐다.** Task 파일은 `TODO`인 채로 남았고, 이벤트 로그는 비어 있었고,
상태 인덱스는 낡은 값이었다. 나중에 손으로 되돌려야 했다.

원인을 따져보니 Worker의 성능 문제가 아니었다. 전이 하나를 기록하려면 사람이 파일 세 개를
각각 열어 고쳐야 했고, 두 번 다 그중 일부를 잊었을 뿐이다. **절차를 강제하는 도구가 없었다.**

BCOS는 이 반복된 결함에서 출발했다. 그래서 목표가 "AI를 더 똑똑하게"가 아니라
"프로젝트 상태를 저장소가 소유하게"다.

## 어떻게 동작하나

```
사람이 목표 결정
→ Claude Code가 Task 설계
→ Codex가 구현하고 Report 작성
→ Claude Code가 독립 Review
→ BCOS가 상태와 이벤트 관리
→ 사람이 최종 승인
```

여기서 중요한 규칙이 하나 있다. **제출한 주체는 승인할 수 없다.** 승인을 수행하는
`actor_id`는 해당 시도를 제출한 `actor_id`와 달라야 한다. 구현한 쪽이 스스로 완료를
선언할 수 있으면 리뷰 단계가 형식만 남기 때문이다.

다만 아직 자동화되지 않은 구간이 있다. Task를 Codex에 전달하고, Report를 다시 Claude에게
넘기는 과정은 현재 사람이 직접 한다. 상태 전이도 `task start` 한 건만 명령으로 처리되고
나머지는 수동이다.

## ClawDev와 무엇이 다른가

BCOS 이전에 ClawDev라는 실험을 했다. 역할별로 Agent 인스턴스를 따로 두는 방식이었고,
동작은 했다. 다만 역할을 하나 늘릴 때마다 Agent와 시스템 프롬프트, 그리고 API 비용이
같이 늘었다.

BCOS는 역할 분리라는 아이디어는 그대로 가져오고, 역할이 Agent에 묶여 있던 부분만 끊었다.

| | ClawDev | BCOS |
|---|---|---|
| 역할이 있는 곳 | Agent 인스턴스 | Task Contract |
| 역할을 추가하는 비용 | Agent + 프롬프트 + API 비용 | 문서 한 장 |
| 상태가 있는 곳 | Agent의 대화 이력 | Git 아티팩트 |
| 방향 | Agent가 Task를 받는다 | Task가 Worker를 정의한다 |

같은 Codex 실행기라도 어떤 Task를 받았느냐에 따라 백엔드 Worker가 되기도 하고 테스트
Worker가 되기도 한다. 세션에는 기억을 남기지 않으므로 언제 종료해도 잃는 것이 없다.

근거는 [ADR-003](decisions/ADR-003-task-centric-workers.md)에 정리해 두었다.

## 현재 구현된 기능

- `--version`, `--help`, 알 수 없는 인자에 대한 오류 처리
- `bcos task start <id> --actor-role <role> --actor-id <id>` — `TODO → IN_PROGRESS`
- `bcos task submit <id> --actor-role <role> --actor-id <id>` — `IN_PROGRESS → IMPLEMENTED`
- 두 명령 모두 Task frontmatter, 이벤트 로그, 상태 인덱스를 한 번에 갱신한다
- 쓰기를 시작하기 전에 lifecycle guard를 먼저 검사한다
- **`submit`은 현재 attempt의 Report가 있어야만 통과한다.** 증거 없는 제출을 도구가 막는다
- 거부된 전이는 파일을 하나도 바꾸지 않는다 — 실패 경로 6종에서 확인했다
- 상태 전이 테스트는 임시 디렉터리에서만 실행되며 저장소의 실제 `.bcos/`를 건드리지 않는다
- 모든 작업에 대해 Report, Review, Benchmark 기록을 남긴다

## 아직 구현하지 않은 기능

`approve` 전이는 아직 명령이 없어서 사람이 직접 처리한다. 프로토콜의 일곱 전이 중
둘이 자동화된 상태다. 따라서 **"제출한 주체는 승인할 수 없다"는 규칙은 아직 문서상의
약속이며 코드로 강제되지 않는다.** `approve`가 구현되는 시점이 이 프로젝트의 핵심 주장이
실제로 강제되는 시점이다.

Task를 만들거나 목록을 보는 명령, Worker에게 넘길 Context Package를 생성하는 `task show`,
새 프로젝트에 `.bcos/` 구조를 만드는 `init`, 상태를 조회하는 `status`와 인덱스를 다시
만드는 `reindex`도 아직 없다. Codex나 Claude를 자동으로 실행하는 연결도 없다.

구현 시점은 약속하지 않는다. 필요가 확인된 순서대로 만든다.

## T-001부터 T-005까지

지금까지 다섯 개의 작업이 프로토콜 전 과정을 통과했다.

| | 한 일 | AC | 테스트 |
|---|---|---:|---:|
| **T-001** | CLI 골격 구성 | 9/9 | 3/3 |
| **T-002** | Node 지원 버전 선언을 실제 검증 범위에 맞춤 | 11/11 | 3/3 |
| **T-003** | `task start` 자동화 | 15/15 | 11/11 |
| **T-005** | 정상 Markdown을 거부하던 검증 버그 수정 | 18/18 | 23/23 |
| **T-004** | `task submit` 자동화 | 16/16 | 31/31 |

두 전이 작업은 자동화한 대상을 직접 측정했다. 전이 한 건을 완료하는 데 사람이 편집해야
하는 파일이 **3개에서 0개로** 바뀌었고, 수동 단계는 `start`가 **6단계에서 1단계로**,
`submit`이 **5단계에서 1단계로** 줄었다. 실패 경로에서 **부분 쓰기는 한 건도 관측되지
않았다**(`start` 5종, `submit` 6종).

T-004는 또 다른 의미가 있다. **start와 submit이 사후 복구 없이 실제 실행 시각으로 기록된
첫 작업**이다. 그 이전 네 작업은 전이 기록을 나중에 손으로 채워 넣어야 했다.

다섯 작업 모두 재작업 없이 한 번에 승인됐고, 범위 이탈과 과설계 위반은 0건이었다.

다만 이 수치들을 생산성 향상률로 환산하지는 않는다. 다섯 작업은 성격이 전부 다르고
비교군이 없다. 위 단계 수는 특정 전이 하나에 대해 관찰된 절대값일 뿐이다.

## 직접 실행해 보기

Node.js 24 이상이 필요하다. 런타임 의존성은 없다.

```bash
npm install
```
```bash
npm run build
```
```bash
npm test
```
```bash
node dist/cli.js --version
```
```bash
node dist/cli.js --help
```

`task start`는 현재 작업 디렉터리의 `.bcos/`를 대상으로 동작한다. 이 저장소에는
`.bcos/tasks/`, `.bcos/events.jsonl`, `.bcos/state.json`이 이미 있어서 바로 실행되지만,
아직 `init` 명령이 없으므로 **새 프로젝트에서는 이 구조를 직접 만들어야 한다.**

## 프로젝트 구조

```
.bcos/tasks/          Task 명세. 단일 진실 원천
.bcos/reports/        Worker가 쓰는 구현 보고서
.bcos/reviews/        Reviewer가 쓰는 검토 기록
.bcos/events.jsonl    상태 변경 이력. 추가만 가능
.bcos/state.json      Task 파일에서 다시 만들 수 있는 파생 인덱스
docs/rfcs/            프로토콜 명세
docs/decisions/       설계 결정 기록
docs/benchmarks/      작업별 측정값
src/                  CLI 구현
```

## 관련 문서

| 문서 | 내용 |
|---|---|
| [RFC-001 Core](rfcs/RFC-001-task-protocol.md) | 프로토콜 규범. Task·Report·Review·Event 규격 |
| [RFC-001 Appendix](rfcs/RFC-001-task-protocol-appendix.md) | 설계 근거와 엣지 케이스. 규범 아님 |
| [Vision](vision.md) | 문제 정의와 원칙, 단계별 계획 |
| [Architecture](architecture.md) | 저장소 배치와 실행 환경 제약 |
| [ADR-001](decisions/ADR-001-language.md) | Node.js를 고르고 런타임 의존성을 두지 않은 이유 |
| [ADR-002](decisions/ADR-002-storage.md) | SQLite 대신 텍스트 파일을 쓰는 이유 |
| [ADR-003](decisions/ADR-003-task-centric-workers.md) | 역할을 Task에 두는 이유 |
| [Git Convention](git-convention.md) | 커밋 규약 |

## 앞으로의 방향

당장은 `approve`다. 이것이 붙으면 `start → submit → approve` 핵심 세 단계가 모두
명령으로 처리되고, 제출자와 승인자가 달라야 한다는 규칙도 코드로 강제된다.

그다음은 Worker에게 넘길 Context Package를 생성하는 일이다. 지금은 Task 파일과 프롬프트를
사람이 복사해서 전달하는데, 이 부분이 자동화되어야 "필요한 만큼만 읽는다"는 원칙을
실제로 측정할 수 있다.

새 프로젝트 초기화와 실행기 연결은 그 뒤다.

## 기여하기

[CONTRIBUTING.md](../CONTRIBUTING.md)를 참고한다. 아직 실험 단계라 프로토콜이 예고 없이
바뀔 수 있다.

## 라이선스

[MIT License](../LICENSE)
