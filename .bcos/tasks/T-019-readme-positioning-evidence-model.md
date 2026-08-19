---
protocol: "0.1"
id: T-019
title: State what BCOS is for and what it records without claiming an answer
status: TODO
attempt: 0
created: 2026-08-15T05:00:00Z
updated: 2026-08-15T05:00:00Z
---

# T-019 — README Positioning and Evidence Model

## Objective

**README가 BCOS를 "AI 에이전트용 저장소 계층"이 아니라
`Input → Process → Output`을 Git 아티팩트로 남겨
추가 orchestration 비용이 회수되는지를 **반증 가능하게** 검증하는 engineering protocol로
설명하게 한다. 답은 아직 쓰지 않는다.**

핵심 질문을 노출한다.

> When does multi-agent orchestration actually pay for itself?

**이 질문의 답은 없다.** T-016은 measurement harness이고 T-017 controlled benchmark는
수행되지 않았다. **README는 질문과 측정 가능성을 설명해야지 결론을 주장하면 안 된다.**

### 현재 README의 약점 — 실측

| 항목 | 실측 |
|---|---|
| 한 줄 정의 | *"A task-centric, Git-based operating layer for AI coding agents."* |
| `## Why BCOS` | 문제를 **기억·컨텍스트 손실** 다섯 가지로만 제시 — T-001 시절 서술 |
| 분량 | **484줄** (ko 366줄). `## Current Capabilities` 한 섹션이 **161줄** |
| 반증 가능성 | 단어도 개념도 **없음** |
| 핵심 연구 질문 | **없음** |

**틀린 문장은 아니다.** 다만 "왜 이 프로젝트가 존재하는가"가
*"세션이 끝나면 컨텍스트가 사라진다"* 로만 읽힌다. 그것은 **이미 시장에 흔한 문제 정의**다.

### 실제 발견한 불일치 — `## Benchmark Policy`

README `:462`가 값 라벨을 **`Measured` · `Derived` · `Estimated` · `N/A`** 네 개로 적는다.
그러나 T-016이 구현한 provenance는 **다섯 개**다.

```
measured · estimated · proxy · derived · unavailable
```

**`proxy`가 빠져 있고 `N/A`는 존재하지 않는 값이다.** 이 Task에서 정정한다.

### 이 Task가 하지 않는 일 — 결론 쓰기

**BCOS에 유리한 결론을 미리 적으면 실패다.** 아직 controlled evidence가 없다.
`faster` · `cheaper` · `more efficient` · `beats single-agent` · 수치적 개선율 —
**한 줄도 쓰지 않는다.**

## Scope

### 1. 한 줄 정의 — 네 의미를 보존한다

새 중심 표현의 의미는 다음 네 가지다. 최종 문구는 README tone에 맞춘다.

```
Git-native · Task-contract-first · Auditable/Reproducible · Falsifiable
```

**`unique` · `first` · `only` 같은 검증되지 않은 우위 표현을 쓰지 않는다.**

### 2. `falsifiable`은 장식어가 아니다 — 동작으로 설명한다

**단어만 넣고 설명하지 않으면 이 Task는 실패다.** 실제 구현된 근거로 뒷받침한다.

| 설계 | 실제 동작 |
|---|---|
| 실패를 지우지 않음 | 실패한 RunRecord가 성공본과 함께 남는다 |
| 재작업 이력 보존 | attempt · Host Verification 실패 · `CHANGES_REQUESTED` 판정이 남는다 |
| 없는 값을 만들지 않음 | `unavailable`은 `value: null`이며 **0으로 바꾸지 않는다** |
| proxy를 승격하지 않음 | 바이트·문자 수를 token 측정값으로 주장하지 않는다 |
| 원시값과 해석을 분리 | T-016은 **집계·평균·순위를 만들지 않는다** |

따라서 결과는 **셋 다 가능하다** — BCOS가 유리 · 차이 없음 · **BCOS가 더 비쌈**.
**세 번째도 유효한 결과이며 측정 시스템의 실패가 아니다.**
오히려 workflow를 단순화할 근거가 된다.

### 3. 역할은 Agent가 아니라 Task에 있다

**영구 persona(`Frontend Agent` · `Backend Agent` · `Tester Agent`)는 BCOS의
핵심 추상화가 아니다.** "persona를 절대 지원하지 않는다"가 아니라
**"핵심 추상화가 아니다"** 가 정확한 주장이다.

```
Task Contract → Role → Runtime
```

같은 Codex runtime이 Task Contract에 따라 다른 역할을 수행한다.

**세 축을 구분한다.**

| 축 | 의미 |
|---|---|
| `role` | Task가 요구하는 역할 |
| `runtime` | 실제 실행기 (`codex` / `claude`) |
| `actor_id` | lifecycle action의 책임 주체 |

**현재 Role-based Task Template은 없다.** 이미 자동화된 역할 템플릿이 있는 것처럼 쓰지 않는다.
**동시에 미래를 막는 절대 표현도 쓰지 않는다** — *"BCOS has no roles"* ·
*"will never have personas"* · *"does not support role templates"* 는 전부 금지다.
Role Template이 나중에 추가되더라도 **`Task Contract → Role → Runtime`** 구조는 그대로다.

기본 정책은 **Claude = Manager/Architect/Reviewer, Codex = default Worker**이고,
`--worker claude`는 **선택 가능한 능력**이다. **Capability ≠ Operating Policy.**

### 4. Input → Process → Output

README가 **무엇을 입력받고 무엇을 관찰하며 무엇을 남기는지** 보이게 한다.

```
INPUT      Task Contract (Objective · Scope · Out of Scope · Acceptance Criteria
                          · Read/Write scope · Test Requirements)
           실행 입력: Context Package · worker runtime
                     · 직전 Review 피드백 · 직전 Host Verification 실패
PROCESS    Worker 실행 → Host Verification → submit
                       → Independent Review → 재작업 → Human 승인
OUTPUT     code diff · Report · Review · lifecycle events · RunRecord · benchmark trial
```

**복잡한 다이어그램을 만들지 않는다.** 위 수준의 ASCII 또는 작은 표까지만 허용한다.
**현재 실제로 존재하는 아티팩트만 쓴다.**

### 5. 측정값 — 실제 필드만

T-016이 `RunRecord`에 영속화하는 raw measurement는 **정확히 9개**다.

```
입력 계열   context_files · context_chars · context_bytes · stdin_bytes
과정 계열   worker_invocations · worker_duration_ms · verification_duration_ms
출력 분량   worker_stdout_bytes · worker_stderr_bytes
```

**9개를 전부 나열할 필요는 없다.** 예시를 든다면 **이름이 source와 정확히 일치해야 한다.**

### 6. token / cost 경계 — 이 Task에서 가장 위험한 지점

```
context_chars ≠ context_bytes ≠ input_tokens ≠ billed cost
```

**"컨텍스트가 작으니 token이 줄었다"고 쓰면 실패다.**
현재 direct token 측정은 세 arm 모두 확보되지 않았고 `unavailable`일 수 있다.
**proxy를 measured token으로 승격시키지 않는다.**

### 7. 최종 통과만이 증거가 아니다

Task가 `DONE`이어도 그 과정이 남는다 — attempt 2였는지, Host Verification이 한 번
실패했는지, `CHANGES_REQUESTED`가 있었는지, Human 개입이 있었는지.

**최종 PASS 하나로 좋은 궤적과 마지막에 겨우 통과한 궤적을 같게 취급하지 않는다.**

단 **"BCOS가 요행 통과를 완전히 탐지한다"고 쓰지 않는다.**
보존되는 증거의 의미까지만 설명한다.

### 8. `## What BCOS Is Not`

짧게 넣는다. **경쟁 프로젝트 이름을 본문에 넣지 않고 폄하하지 않는다.**

```
Permanent AI role personas are not BCOS's core abstraction.

BCOS is not: 자율 소프트웨어 회사
             · multi-agent가 본질적으로 우월하다는 주장
             · BCOS가 더 빠르거나 싸다는 벤치마크 결과
             · 실패한 실행을 버리는 시스템
```

**첫 줄의 표현이 중요하다.** *"persona 모음이 아니다"* 가 아니라
**"persona가 핵심 추상화가 아니다"** 다. 전자는 미래 Role Template과 불필요하게 충돌한다.

핵심 문장: ***"BCOS treats orchestration benefits as hypotheses to test, not assumptions to encode."***

### 9. Benchmark framing 정정

**arms 3종** — `codex_only` · `claude_only` · `bcos`.
**T-016 = measurement harness · T-017 = 미래의 controlled benchmark/report.**

`## Benchmark Policy`의 값 라벨을 **T-016의 5값 provenance로 정정한다**(§0 발견).
**핵심 질문을 두 번 장황하게 반복하지 않는다.**

### 10. 미래 해석은 가설로만

증거가 *"단순 Task에는 full orchestration 가치가 낮고 복잡·고위험 Task에는 높다"* 를
보여준다면 BCOS는 모든 Task에 같은 workflow를 강제하기보다 **더 선택적으로 진화해야 할 수 있다.**

**현재 없는 기능** — Adaptive Router · Complexity Classifier · 자동 workflow 선택 ·
complexity threshold. **Current Capabilities에 넣으면 실패다.**

### 11. Digital Docent

**Current Capability처럼 쓰지 않는다.** 아직 시작되지 않았으므로
*"Digital Docent에서 검증했다"* 는 거짓이다.
필요하면 미래 문맥에서 **"real project dogfooding"** 수준의 일반 표현만 쓴다.

### 12. 정보 구조 — 길이를 늘리지 않는다

README는 이미 **484줄**이고 `## Current Capabilities`만 **161줄**이다.
**섹션을 계속 더하는 방식을 금지한다.** 우선순위:

```
1. stale·중복 문장 제거   2. 기존 섹션 재작성   3. 기존 섹션 통합   4. 꼭 필요한 신규만
```

`## Why BCOS`는 **재작성**한다 — 새 섹션을 앞에 덧붙이지 않는다.
**새 documentation 파일을 만들지 않는다.**

**484줄은 baseline이지 최적화 목표가 아니다.** 새 섹션이 필요하면
**중복을 제거하거나 통합해서** 자리를 만든다. 그러나 **여러 bullet을 한 줄로 붙이거나
의미 있는 설명을 압축해 숫자만 맞추는 것은 이 Task의 목적이 아니다** —
Ponytail은 LOC 감소가 아니라 **불필요한 내용과 구조를 만들지 않는 것**이다.
가독성이 줄 수보다 우선하며, 순증가가 필요했다면 **Report에 근거를 남긴다**(AC 28).

첫 화면에서 30초 안에 **A. 무엇인가 · B. 왜 존재하는가 · C. 무엇을 가정하지 않는가 ·
D. 무엇을 측정하는가** 를 알 수 있어야 한다.

### 13. `docs/vision.md`는 건드리지 않는다 — 조사 결과

**충돌을 찾지 못했다.** vision §5 "성공의 정의"는 v0.1 성공 기준(이탈 없는 구현 ·
읽은 파일 수 · 맥락 복원 · Git 이력)이고, 새 README 포지셔닝은 그것을 **확장할 뿐 부정하지 않는다.**
철학(*"프로젝트가 AI를 기억한다"*)도 그대로 성립한다.

**따라서 Write List에 넣지 않는다.** 구현 중 실제 모순이 발견되면
**임의로 고치지 말고 멈추고 보고한다.**

## Out of Scope

**코드·릴리스**
- production source · tests · `package.json` · 의존성 수정
- version bump · tag · GitHub Release
- RFC · ADR 수정 · architecture refactor · workflow 수정

**기능**
- benchmark runner · token 수집 기능 · 실제 benchmark 실행 · 집계 지표 계산
- Adaptive Router · Complexity Classifier · Worktree · 병렬 실행
- Role/Frontend/Backend/AI/Test Template · Digital Docent 구현

**문서**
- T-017 생성 · `docs/vision.md` 수정(§13) · 새 documentation 파일
- **경쟁 프로젝트 이름을 README 본문에 삽입** · 비교표 작성
- 블로그·논문 작성 · Notion 업데이트

## Acceptance Criteria

**A. 포지셔닝**

1. README 첫 화면에서 BCOS가 **단순 multi-agent framework가 아니라
   Git-native task-contract engineering protocol**임을 알 수 있다.
2. 한 줄 정의가 **Git-native · task-contract-first · auditable/reproducible · falsifiable**
   네 의미를 보존한다.
3. 핵심 연구 질문(*"When does multi-agent orchestration actually pay for itself?"*)이
   **첫 화면 또는 `## Why BCOS` 직후에 노출**된다.
4. `unique` · `first` · `only` 등 **검증되지 않은 우위 표현이 0건**이다.
5. multi-agent가 본질적으로 우월하다고 **전제하지 않는다.**

**B. 반증 가능성**

6. `falsifiable`이 **실제 동작으로 설명**된다 — 실패 보존 · `unavailable`≠0 ·
   proxy 미승격 · 원시값과 해석 분리 중 **최소 3가지**가 근거로 제시된다.
7. **"BCOS가 더 비쌀 수도 있다"는 결과가 유효**하다고 명시된다.
8. `## What BCOS Is Not`에 준하는 서술이 있고, 경쟁 프로젝트 **이름이 0건**이다.
   persona 관련 서술은 **"핵심 추상화가 아니다"** 로 적히며,
   *"persona를 지원하지 않는다"* · *"never have"* 류의 **미래를 막는 절대 표현이 0건**이다.

**C. 역할**

9. **Roles belong to Tasks** 원칙이 유지되고 영구 persona framework로 오해되지 않는다.
10. `role` · `runtime` · `actor_id` **세 축이 구분**된다.
11. 기본 정책 **Claude Manager/Reviewer + Codex Worker**가 유지된다.
12. `--worker claude`가 **선택 능력**으로 적히고 기본이라고 쓰지 않는다.
13. **Role-based Task Template이 이미 있는 것처럼 쓰지 않는다.**

**D. 증거 모델**

14. **Input → Process → Output** 사슬이 설명된다.
15. 언급된 아티팩트가 **전부 현재 실재**한다 (Report · Review · events · RunRecord ·
    benchmark trial).
16. T-016 persisted field를 언급하면 **이름이 source와 정확히 일치**한다.
17. `context_chars`/`context_bytes`/`stdin_bytes`를 **token이라 부르지 않는다.**
18. **token이 `unavailable`일 수 있음**이 유지된다.
19. **최종 PASS 외의 과정 증거**(attempt · 검증 실패 · review 판정)의 의미가 설명되며,
    "요행 통과를 완전히 탐지한다"고 쓰지 않는다.

**E. Benchmark**

20. arms가 **`codex_only` · `claude_only` · `bcos`** 로 정확하다.
21. **T-016 = harness · T-017 = 미래 controlled benchmark** 로 구분된다.
22. `## Benchmark Policy`의 값 라벨이 **T-016의 5값**
    (`measured`/`estimated`/`proxy`/`derived`/`unavailable`)과 일치한다.
23. **효율성 우위 주장·수치적 개선율이 0건**이다
    (`faster` · `cheaper` · `more efficient` · `beats` · `reduces tokens/cost` ·
    `improves quality` · `production-ready` · `stable` · `1.0-ready` ·
    `automatically chooses` 및 동등한 한국어 표현).
24. Adaptive Router · Complexity Classifier가 **Current Capabilities에 0건**이다.
25. **Digital Docent를 검증 완료 사례로 쓰지 않는다.**

**F. 구조·회귀**

26. `docs/README.ko.md`가 영문 README와 **의미상 정합**한다 (정의 · 연구 질문 ·
    반증 가능성 · arms · 미구현 목록).
27. **새 documentation 파일 0개** · `docs/vision.md` diff **0줄**.
28. README의 **순증가를 피했다는 것이 내용으로 확인된다** — 새 서술이 들어간 만큼
    **중복·stale 내용이 제거되거나 통합**됐다. `wc -l README.md`는 baseline **484줄**과
    함께 보고하되 **그 숫자만으로 PASS를 판정하지 않는다.**
    **줄을 합치거나 설명을 압축해 숫자만 맞춘 것은 PASS가 아니다** —
    가독성과 의미 보존이 line count보다 우선한다.
    실제 순증가가 발생했다면 **왜 필요한지 Report에 근거를 남긴다.**
29. `src/` · `tests/` · `package.json` · lockfile diff **0줄** · T-017 **0건**.
30. `npm run build` exit 0 · `npm test` **289/289 pass · 0 fail · 0 skipped**.

## Expected Files

**수정**

- `README.md` — 포지셔닝 · 연구 질문 · 반증 가능성 · 증거 모델 · Benchmark Policy 정정
- `docs/README.ko.md` — 같은 사실을 자연스러운 한국어로

**생성**

- `.bcos/reports/T-019-readme-positioning-evidence-model.md`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-019-readme-positioning-evidence-model.md` (이 파일)
- `README.md`
- `docs/README.ko.md`
- `docs/vision.md` — **읽기 전용. 수정 금지**(§13)
- `docs/architecture.md` — **읽기 전용.** 증거 모델·소유권 근거
- `src/run.ts` — **읽기 전용.** persisted 9 field 이름 근거
- `src/benchmark.ts` — **읽기 전용.** provenance 5값·arms 3종 근거
- `.bcos/tasks/T-016-benchmark-trial-record.md` — **읽기 전용.** harness 경계 근거
- `package.json`

**쓰기**

위 "수정"·"생성" 목록뿐이다. **`src/`·`tests/`·`docs/`(README.ko 제외)는 쓰지 않는다.**

## Test Requirements

**이 Task에는 신규 `node:test`가 없다.** 문서 Task이며 `tests/` diff는 0이어야 한다(AC 29).
검증은 아래를 Report에 **실행 명령과 출력**으로 남긴다.

**T1. 회귀** — `npm run build` exit 0 · `npm test` 289/289.
**단독 실행한다.** 동시 실행이 무관한 테스트를 실패시킨 전례가 있다.

**T2. 금지 표현** — AC 23 목록을 README·ko 양쪽에서 검색하고,
**hit마다 문맥을 직접 읽어** 부정문·인용인지 판별한다. **grep 0건만으로 PASS하지 않는다.**

**T3. field 이름 대조** — README가 언급한 measurement 이름을 `src/run.ts`의
실제 `RunRecord` 필드와 **한 글자씩 대조**한다.

**T4. arms·provenance 대조** — `src/benchmark.ts`의 `arms`·`sources` Set과 문서를 대조.
`N/A` 같은 **존재하지 않는 라벨이 남아 있지 않은지** 확인한다.

**T5. 역할 3축** — `role`·`runtime`·`actor_id` 구분과 기본 정책/선택 능력 분리를 **문맥으로** 확인.

**T6. Current vs Planned** — Adaptive Router·Complexity Classifier·Role Template·
Digital Docent가 Current로 서술되지 않았는지 확인.

**T7. 길이·구조** — `wc -l README.md` ≤ 484 · 새 문서 파일 0 · `docs/vision.md` diff 0.

**T8. 한/영 정합** — 정의·연구 질문·반증 가능성·arms·미구현 목록을 **양쪽에서 읽고** 대조.

**T9. 회귀 diff** — `git diff --stat -- src/ tests/ package.json package-lock.json` 빈 출력.

## Notes

**이 Task의 최대 실패 경로는 두 가지다.**

1. **결론을 미리 쓰는 것.** 아직 controlled evidence가 없다. 질문까지만 쓴다.
2. **README를 더 길게 만드는 것.** 484줄은 이미 길다. `## Why BCOS`를 **재작성**하고
   중복을 걷어내라. AC 28이 이것을 기계적으로 막는다.

**`falsifiable`을 buzzword로 쓰면 실패다.** 왜 반증 가능한지를 실제 동작으로
설명하지 못하면 그 단어를 빼는 편이 낫다.

**경쟁 포지셔닝은 이름 없이 한다.** spec-driven · role persona · multi-agent ·
parallel execution · vendor-neutral runtime · trajectory logging은 이미 흔하다.
**그것들을 BCOS의 차별점처럼 과장하지 않는다.** 차별점은 *"그 비용이 회수되는지를
반증 가능하게 재는 것"* 이다.

**남는 Known Gap — 이 Task에서 해결하지 않는다.**

1. **direct token 측정이 없다.** 세 arm 모두 `unavailable`일 수 있다.
2. **canonical benchmark case·공통 evaluation gate 미정.** T-017 이전에 정해야 한다.
3. **`docs/vision.md`와의 정합**은 조사에서 충돌이 없었으나, 구현 중 실제 모순이
   드러나면 **고치지 말고 보고한다**(§13).
