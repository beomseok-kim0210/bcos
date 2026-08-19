---
task: T-019
---

# Review — T-019

## Attempt 1 — 2026-08-19T08:30:00Z — CHANGES_REQUESTED

Reviewer: `claude-code` (worker `codex-cli`와 다름 — G5 충족)

**판정 기준을 먼저 밝힌다.** 줄 수 감소 자체는 결함이 아니다. **의미 손실이 결함이다.**
문장이 삭제됐더라도 같은 사실·제약·provenance·trust boundary가 더 정확하고 간결하게
다른 위치에 보존됐다면 PASS다. 삭제 4건을 각각 증거로 판정했다.

**결론부터** — 포지셔닝 작업 자체의 품질은 높다. 그러나 **`actor_id`가 자기 신고
값이라는 trust boundary가 EN·KO 양쪽에서 소실**됐다. T-018이 세운 정직성 기준의
회귀이므로 `CHANGES_REQUESTED`다.

### Criteria Assessment

**A. 포지셔닝**

| AC | 결과 | 근거 |
|---|---|---|
| 1 | **PASS** | `README:3` — *"A Git-native, task-contract-first engineering protocol for auditable, reproducible, and falsifiable AI coding workflows."* |
| 2 | **PASS** | 네 의미 모두 한 줄 정의에 존재 |
| 3 | **PASS** | `README:19` 인용구로 핵심 질문 노출. `## Why BCOS` 안, 첫 화면 |
| 4 | **PASS** | `unique` · `first` · `only` **0건** |
| 5 | **PASS** | `README:21-23` — *"There is no answer yet … without claiming a speed, cost, or quality advantage"* |

**B. 반증 가능성**

| AC | 결과 | 근거 |
|---|---|---|
| 6 | **PASS** | `## Why the Evidence Is Falsifiable`에 근거 **5개** — 실패 RunRecord 보존 · 재작업 이력 · `unavailable`이면 `null` · proxy 미승격 · T-016 무집계. 요구치 3개 초과 |
| 7 | **PASS** | `README:80-82` — *"may favor BCOS, show no meaningful difference, or show that BCOS is more expensive. All three are valid outcomes."* |
| 8 | **PASS** | `## What BCOS Is Not` 존재. 경쟁 프로젝트 이름 **0건**. 절대 표현(`never have` · `does not support`) **0건** |

**C. 역할**

| AC | 결과 | 근거 |
|---|---|---|
| 9 | **PASS** | `Task Contract → Role → Runtime` + *"The same Codex runtime can implement backend work in one session and tests in another because the Task changes"* |
| 10 | **PASS** | `README:96-99` 3축 표 — `role`(Task 요구 책임) · `runtime`(실행기) · `actor_id`(책임 주체) |
| 11 | **PASS** | `README:101-102` — Claude Manager/Architect/Reviewer + Codex default Worker |
| 12 | **PASS** | `README:102-103` — *"`--worker claude` is an optional runtime capability, not the default policy"* |
| 13 | **PASS** | `README:104` — *"Role-based Task Templates are planned and do not exist today"* |

**D. 증거 모델**

| AC | 결과 | 근거 |
|---|---|---|
| 14 | **PASS** | `## Input → Process → Output` ASCII 블록. 복잡한 다이어그램 없음 |
| 15 | **PASS** | 언급된 아티팩트 전부 실재 — Report · Review · events · RunRecord · benchmark trial |
| 16 | **PASS** | 9필드를 `src/run.ts:16-18`과 **한 글자씩 대조 — 9/9 일치.** 9개 외 측정형 식별자 **0건** |
| 17 | **PASS** | `README:61-66` — `context_chars ≠ context_bytes ≠ input_tokens ≠ billed cost` + *"they are not token measurements"* |
| 18 | **PASS** | `README:66-67` — *"Direct token values can be `unavailable`; in that case the value is `null`, never zero."* |
| 19 | **PASS** | `README:47-51` — attempt · 검증 실패 · `CHANGES_REQUESTED` · human 개입 보존 + *"they do not claim to detect every accidental success"* |

**E. Benchmark**

| AC | 결과 | 근거 |
|---|---|---|
| 20 | **PASS** | arms 표 — `codex_only` · `claude_only` · `bcos` |
| 21 | **PASS** | `README:181-182` — *"T-016 supplies the measurement harness … T-017 is the future controlled benchmark/report and has not been performed."* |
| 22 | **PASS** | `README:184-185` 5값 정확. **`N/A` EN·KO 각 0건** — 계약이 지적한 drift 해소 |
| 23 | **PASS** | 금지 표현 hit 6건 전수 문맥 판독 — **전부 부정문 또는 오탐**(`provenance`가 `proven`에 매치). 한국어 2건도 *"낫다고 주장하지 않는다"* · *"우월하다는 주장도 아니며"* |
| 24 | **PASS** | Adaptive Router · Complexity Classifier가 `### Planned`에 위치. `README:167-169`가 *"hypothesis for later experiments, not a current routing capability"* |
| 25 | **PASS** | `Digital Docent validation`이 `### Planned`에 있음. 검증 완료 서술 0건 |

**F. 구조·회귀**

| AC | 결과 | 근거 |
|---|---|---|
| 26 | **FAIL** | 헤딩 13:13 대응, 핵심 의미 8종 EN/KO 동수 확인. **그러나 `actor_id` trust boundary가 양쪽 모두 소실** — F-1. 양쪽이 똑같이 누락됐으므로 EN/KO 불일치는 아니나, 계약이 요구한 **한계 서술의 정합**을 충족하지 못한다 |
| 27 | **PASS** | 새 문서 파일 **0개** · `docs/vision.md` diff **0줄** |
| 28 | **PASS** | 484→248, ko 366→233. **압축이 아니라 섹션 재구성**이다 — 신규 4섹션이 들어가며 `Core Idea` · `ClawDev to BCOS`를 흡수했다. bullet 붙이기·설명 압축 흔적 없음 |
| 29 | **PASS** | `src/` · `tests/` · `package.json` · lockfile diff **각 0줄** · T-017 **0건** |
| 30 | **PASS** | Reviewer 단독 순차 실행 — build exit 0, 이어서 **289/289 pass · 0 fail · 0 skipped · 0 todo** |

**집계 — PASS 29 · FAIL 1 · N/A 0**

### Semantic Deletion Review

**1. `## Historical Baselines Through T-012`**

```
Previous purpose:     T-003~T-012의 AC·테스트·범위위반·재작업 실측 표.
                      T-018이 "historical baselines, not improvements"로 재분류해
                      현재 성능 주장과 분리했다
Current replacement:  README:190 "No conclusion is drawn from a single task or from
                      incomparable historical observations"
                      README:240 docs/benchmarks/TELEMETRY.md 링크
Semantic coverage:    부분적. "과거 관측을 현재 결론으로 쓰지 않는다"는 원칙은 남았으나,
                      historical benchmark 기록이 저장소에 존재한다는 사실 자체를
                      독자가 알 수 없다. docs/benchmarks/ 15건으로 가는 경로가
                      TELEMETRY.md 한 줄뿐이다
Verdict:              SEMANTIC_REGRESSION (MINOR)
```

**2. `## Roadmap`**

```
Previous purpose:     미구현 항목 표(Role Templates·Worktree·Controlled Benchmark) +
                      "no controlled result or efficiency conclusion exists yet"
Current replacement:  ### Planned — task block/unblock/create/list/show, bcos init,
                      project-wide status, reindex, Role-based Task Templates,
                      worktree parallelism, Adaptive Router, Complexity Classifier,
                      Digital Docent validation, canonical case·evaluation gate·
                      controlled benchmark report
                      + README:21-23 "There is no answer yet"
Semantic coverage:    완전. 미구현 항목이 3개에서 9개로 더 구체화됐고, controlled result
                      부재는 Why BCOS와 Benchmark Policy 두 곳에서 확인된다
Verdict:              VALID_INTEGRATION
```

**3. `## ClawDev to BCOS`**

```
Previous purpose:     선행 실험에서 BCOS로 온 경위
Current replacement:  ## Why BCOS가 문제 정의를 직접 서술하고,
                      ## Roles Belong to Tasks가 역할 추상화 차이를 설명
Semantic coverage:    충분. 현재 구현 상태·한계·provenance 중 이 섹션에만 있던 것은 없다.
                      기원 서사는 Ground Truth가 아니다
Verdict:              VALID_REMOVAL
```

**4. `## Core Idea`**

```
Previous purpose:     핵심 개념 요약
Current replacement:  ## Why BCOS + ## Input → Process → Output +
                      ## Roles Belong to Tasks
Semantic coverage:    충분하고 더 정확하다. "프로젝트가 AI를 기억한다" 인용구도
                      README:30에 보존됐다. 이 섹션에만 있던 system invariant는
                      발견되지 않았다
Verdict:              VALID_REMOVAL
```

### Findings

**BLOCKING 0 · MAJOR 1 · MINOR 1**

---

```
Finding ID:  F-1
Severity:    MAJOR
AC:          26 · T-018이 세운 Known Limitation 기준의 회귀
```

**Evidence**

T-018 종료 시점(`HEAD:README.md:212-214`)에 존재했던 서술:

> `actor_id` is self-declared, so separation of duties assumes a trusted environment;
> authentication is a known limit of protocol `0.1`.

한국어(`HEAD:docs/README.ko.md:169-170`):

> `actor_id`는 자기 신고 값이므로 SoD는 신뢰 환경을 전제한다. 다른 문자열을 넣으면
> 통과한다. 인증은 프로토콜 `0.1`의 알려진 한계이며 별도 RFC의 대상이다.

현재 README에서 `actor_id`가 등장하는 곳은 **두 군데뿐**이다.

- `README:99` — `| actor_id | Accountable subject for a lifecycle action |`
- `README:135` — *"Separation of duties by `actor_id`: the subject that submitted an
  attempt cannot approve that attempt"*

한국어도 `ko:96` · `ko:128` 두 곳뿐이다.
`self-declared` · `자기 신고` · `trusted` · `신뢰 환경` · `authentication` · `인증`
**EN·KO 전부 0건**으로 실측했다. 동등한 의미의 대체 표현도 찾지 못했다.

**Why this matters**

현재 문서는 `actor_id`를 *"Accountable subject"* 로 소개하고 직무 분리가 그것으로
강제된다고 말한다. **그러나 실제 구현에서 `actor_id`는 호출자가 문자열로 자기 신고하는
값이며 인증되지 않는다.** 독자는 이를 검증된 신원으로 오해할 수 있고, 그 오해는
이 프로젝트가 강조하는 직무 분리의 강도를 실제보다 높게 읽게 만든다.

**이것은 이 Task 자신의 기준을 어기는 것이다.** 계약은 반증 가능성을
*"없는 값을 만들지 않음"* · *"proxy를 measured로 승격하지 않음"* 으로 정의했다.
인증되지 않은 식별자를 인증된 것처럼 읽히게 두는 것은 같은 종류의 과장이다.

**Required semantic outcome**

`actor_id`가 **인증된 신원이 아니라 자기 신고 값이며, 따라서 직무 분리는 신뢰 환경을
전제하고 인증은 현재 제공되지 않는 알려진 한계**라는 사실을 EN·KO 양쪽에서 읽을 수
있어야 한다. **위치·분량·문장 형태는 Worker가 정한다** — 3축 표의 비고, `### Planned`
인접 문단, `## Why the Evidence Is Falsifiable`의 한 줄 중 무엇이든 최소 변경으로
해결할 수 있다. **이전 문장을 그대로 복원할 필요는 없다.**

---

```
Finding ID:  F-2
Severity:    MINOR
AC:          28 (정보 구조)
```

**Evidence**

`## Historical Baselines Through T-012`(약 20줄, 10열 실측 표)가 삭제됐고, 현재
README에서 `docs/benchmarks/`로 가는 경로는 `README:240`의
`| [Telemetry](docs/benchmarks/TELEMETRY.md) | Measurement field definitions |`
한 줄뿐이다. `historical` · `baseline` · `T-012` 검색 결과 EN·KO 모두 실측 기록의
존재를 알리는 서술이 없다. `docs/benchmarks/`에는 여전히 **15건**이 있다.

**Why this matters**

원자료가 저장소에 남아 있다는 사실만으로는 부족하다. **T-018이 이 섹션을 굳이
"Historical … not improvements"로 재분류한 이유는 과거 관측을 현재 성능 주장과
분리해서 보여주기 위해서였다.** 지금은 분리 원칙(`README:190`)만 남고 **분리할
대상의 존재 자체가 보이지 않는다.** 독자는 README만 읽고는 BCOS에 과거 실측 기록이
있다는 것을 알 수 없다.

**Required semantic outcome**

README가 **historical benchmark 기록이 존재하며 그것이 현재 결과나 성능 주장이
아니라는 점**을 독자에게 알려야 한다. **전체 표 복원은 요구하지 않는다** —
한 문장과 `docs/benchmarks/` 링크로 충분할 수 있다. 구현 방식은 Worker가 정한다.

---

**Finding으로 올리지 않은 것 — `## Roadmap` 삭제**

계약의 정보 구조 우선순위는 *"중복 제거 → 재작성 → 통합 → 신규"* 이고, Roadmap의
의미는 `### Planned`가 **더 구체적으로** 대체했다(항목 3개 → 9개). controlled result
부재도 두 곳에서 확인된다. **VALID_INTEGRATION이며 회귀가 아니다.**

### Regression

```
npm run build → exit 0                                              (단독 실행)
npm test      → tests 289 · pass 289 · fail 0 · skipped 0 · todo 0   (build 이후 단독 실행)
```

계약 Test Requirements의 "단독 실행" 조건을 지켜 순차 실행했다.

### Scope

| 항목 | 실측 |
|---|---|
| `src/` · `tests/` · `package.json` · lockfile | **각 diff 0줄** |
| `docs/vision.md` | **diff 0줄** — 계약대로 읽기 전용 유지 |
| RFC · ADR · `CLAUDE.md` · `AGENTS.md` · `CONTRIBUTING.md` · `docs/architecture.md` · `docs/v0.1-scope.md` | **각 diff 0줄** |
| 새 documentation 파일 | **0개** |
| T-017 | **0건** |
| 계약 본문 | `c4758e4`와 **18,682 bytes 바이트 동일.** frontmatter `status` · `attempt` · `updated`만 변경 |
| `x` | **접근하지 않음** |

### Verdict

**CHANGES_REQUESTED**

포지셔닝 작업의 품질은 높다. 한 줄 정의가 네 의미를 담고, 핵심 연구 질문이 첫 화면에
있으며, `falsifiable`이 **실제 동작 5가지**로 뒷받침된다. 9개 측정 필드가 source와
한 글자씩 일치하고, provenance 5값이 정확하며 `N/A` drift가 해소됐다. 금지 주장은
전수 문맥 판독 결과 0건이고, 삭제 4건 중 3건은 정당한 제거·통합이다.
줄 수 감소는 그 자체로 결함이 아니며, 압축이 아니라 재구성이었다.

**그러나 F-1은 Ground Truth 회귀다.** `actor_id`가 자기 신고 값이라는 사실은 편의상
뺄 수 있는 배경 설명이 아니라, **이 프로젝트가 주장하는 직무 분리의 실제 강도를
정직하게 말하는 문장**이다. 그것이 사라진 상태로 승인하면 *"근거 없는 주장을 하지
않는다"* 는 이 Task 자신의 기준을 어기게 된다.

F-2는 T-018이 의도적으로 보존한 historical 구분이 옅어진 건이며 MINOR다.

**두 Finding 모두 최소 변경으로 해결 가능하고 삭제된 섹션의 전체 복원을 요구하지
않는다.** 나머지 재작성은 그대로 유지해도 좋다.

---

## Attempt 2 — 2026-08-19T09:05:00Z — APPROVED

Reviewer: `claude-code` (worker `codex-cli`와 다름 — G5 충족)

**이번 Review의 범위는 두 가지뿐이다.** F-1·F-2가 실제로 닫혔는가, 그리고 그 수정이
attempt 1에서 PASS였던 Ground Truth를 새로 깨뜨리지 않았는가. **attempt 1에서 이미
승인한 README 재구성은 다시 평가하지 않는다.**

Worker Report는 참고만 했고 모든 판정은 직접 재현했다.

### Finding Closure

```
F-1
Previous severity: MAJOR
Result:            CLOSED

Evidence:
  README:105-106
    "`actor_id` is self-declared rather than an authenticated identity. Separation of
     duties therefore assumes a trusted environment; authentication is a known limit
     of protocol `0.1`."
  docs/README.ko.md:102-103
    "`actor_id`는 인증된 신원이 아니라 자기 신고 값이다. 따라서 직무 분리는 신뢰 환경을
     전제하며, 인증은 protocol `0.1`이 현재 제공하지 않는 알려진 한계다."

Reason:
  요구한 5개 semantic outcome이 EN·KO 양쪽에서 전부 읽힌다.
  (1) authenticated identity 아님 — "rather than an authenticated identity" /
      "인증된 신원이 아니라"
  (2) self-declared — "is self-declared" / "자기 신고 값"
  (3)(4) SoD가 그 값을 신뢰하며 trusted environment 전제 — "assumes a trusted
      environment" / "신뢰 환경을 전제하며"
  (5) authentication 부재가 known limitation — "a known limit of protocol 0.1" /
      "제공하지 않는 알려진 한계"

  위치도 적절하다. 3축 표(README:97-99) 바로 아래에 두어 `actor_id`를 "Accountable
  subject"로 읽은 직후 그 한계를 만나게 했다. 반복도 없다 — 각 문서에 한 번씩이다.
```

**보안 과장 검사 — 0건.** `authenticates the actor` · `verified identity` ·
`verifies identity` · `enforces identity` · `prevents impersonation` ·
`cryptograph*` · `authenticated user` · `securely` 를 EN·KO에서 검색해 **전부 0건**.
유일한 `authentication` 등장은 *"a known limit"* 이라는 **부재 서술**이다.
현재 구현이 제공하지 않는 security property를 새로 주장하지 않았다.

```
F-2
Previous severity: MINOR
Result:            CLOSED

Evidence:
  README:195-196
    "[Historical benchmark records](docs/benchmarks/) remain available as observations,
     not as current benchmark results or performance claims."
  docs/README.ko.md:180-181
    "[과거 benchmark 기록](benchmarks/)은 관찰 자료로 남아 있으며, 현재 benchmark
     결과나 성능 주장으로 취급하지 않는다."

Reason:
  요구한 두 사실이 모두 확인된다.
  (1) 존재와 위치 — `docs/benchmarks/`로 직접 링크. 실측: 디렉터리 존재, 파일 15건.
      한국어는 `docs/README.ko.md` 기준 상대경로 `benchmarks/`로 정확히 해석된다.
  (2) 현재 결과가 아님 — "not as current benchmark results or performance claims" /
      "현재 benchmark 결과나 성능 주장으로 취급하지 않는다"

  배치도 정확하다. Benchmark Policy 마지막 항목 "No conclusion is drawn from a single
  task or from incomparable historical observations" 바로 뒤에 붙어, 원칙과 그 원칙이
  적용되는 대상이 이어서 읽힌다.

  전체 표를 복원하지 않았고 두 문장 + 링크로 해결했다 — Ponytail 기준에 부합한다.
```

### Attempt 2 Scope Audit

**Fix the findings, not the document** 원칙이 지켜졌다.

| 항목 | 실측 |
|---|---|
| README | 248 → **254줄** (+6) |
| 한국어 README | 233 → **239줄** (+6) |
| 정당하다고 판정했던 삭제 섹션 복원 | `Roadmap` · `ClawDev to BCOS` · `Core Idea` **EN·KO 각 0건** |
| 대규모 재작성 | 없음. 증가분이 정확히 두 Finding 분량이다 |

**줄 수 자체를 판정 근거로 쓰지 않았다.** 다만 +6/+6이 각각 두 문단(F-1 2줄, F-2 2줄과
빈 줄)에 대응하며, 다른 곳을 건드린 흔적이 없다는 **의미적 근거**로 확인했다.

### Existing Ground Truth Regression

**회귀 0건.**

```
build:  exit 0                                              (단독 실행)
tests:  289 · pass 289 · fail 0 · skipped 0 · todo 0        (build 이후 단독 실행)
```

계약이 요구한 **순차 단독 실행**을 지켰다. attempt 2 workflow의 verification이
진행 중일 때는 검증을 시작하지 않고 완료를 기다렸다 — 동시 실행이 무관한 테스트를
거짓 실패시킨 전례가 이 프로젝트에 두 번 있다.

| 항목 | 실측 |
|---|---|
| `src/` · `tests/` · `package.json` · lockfile | **각 diff 0줄** |
| `docs/vision.md` | **diff 0줄** |
| RFC · ADR · `CLAUDE.md` · `AGENTS.md` · `CONTRIBUTING.md` · `docs/architecture.md` · `docs/v0.1-scope.md` | **각 diff 0줄** |
| T-017 · dependency · version · tag | **각 0건** |
| 새 documentation 파일 | **0개** (신규는 Report·Review·RunRecord뿐) |
| 계약 본문 | `c4758e4`와 **18,682 bytes 바이트 동일** |
| `x` | **접근하지 않음** |

**provenance** — EN·KO 모두 `measured` · `estimated` · `proxy` · `derived` ·
`unavailable` 5값 정확. **`N/A` 재발 EN·KO 각 0건.** 5값 외 라벨 없음.

**RunRecord 측정 필드** — 9개를 `src/run.ts`와 다시 대조해 **9/9 일치**.
9개 외 측정형 식별자 **0건**. 존재하지 않는 measurement를 새로 주장하지 않았다.

**token/cost 경계** — `context_chars ≠ context_bytes ≠ input_tokens ≠ billed cost`가
EN·KO 각 1회 유지. proxy를 measured token으로 승격하는 서술 없음.

**claim boundary** — 금지 표현 후보 hit 6건을 전수 문맥 판독했다.

- `README:113` — `## What BCOS Is Not` 안의 *"…is not … superior, a benchmark result
  showing a speed or cost advantage…"* → **부정문**
- `README:196` — *"not as current benchmark results or performance claims"* → **부정문**
- `README:150` · `README:187` · `ko:140` · `ko:174` — `provenance`가 `proven`에
  매치된 **substring 오탐**

**근거 없는 성능·효율·우월성 주장 0건.**

**EN/KO 정합** — F-1·F-2 관련 의미가 양쪽에서 동등하다. `actor_id` 자기 신고 ·
인증 부재 · 신뢰 환경 전제 · historical 기록의 존재와 위치 · 현재 결과가 아님 —
**한쪽에만 있는 항목 없음.** 직역이 아니라 자연스러운 한국어이며 의미는 같다.

### New Findings

**None.**

attempt 2는 두 Finding만 최소 수정했고 새로운 계약 위반이나 Ground Truth 회귀를
만들지 않았다. 문체 취향이나 "더 좋게 쓸 수 있음"은 Finding으로 올리지 않는다.

### Verdict

**APPROVED**

F-1 **CLOSED** · F-2 **CLOSED** · build exit 0 · 289/289 · scope 위반 0 ·
기존 Ground Truth 회귀 0 · 신규 blocking/major 0.

attempt 1이 만든 포지셔닝과 압축이 그대로 보존됐고, Reviewer가 정당하다고 판정한
세 섹션 삭제도 복원되지 않았다. 수정은 정확히 두 Finding 분량이다.

**특히 F-1의 해결 방식이 옳다.** 이전 문장을 복사하지 않고 현재 3축 표 구조에 맞춰
새로 썼으며, 없는 보안 속성을 만들지 않으면서 한계를 정확히 말한다.
`actor_id`를 "Accountable subject"로 읽은 독자가 **바로 다음 문단에서 그것이 인증된
신원이 아님을 알게 된다.**
