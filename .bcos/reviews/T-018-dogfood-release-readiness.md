---
task: T-018
---

# Review — T-018

## Attempt 1 — 2026-08-15T04:10:00Z — APPROVED

Reviewer: `claude-code` (worker `codex-cli`와 다름 — G5 충족)

**Worker의 self-check를 근거로 삼지 않았다.** 아래 판정은 Reviewer가 저장소·빌드된
바이너리·임시 외부 프로젝트에서 직접 재현한 값이다. Worker가 샌드박스 제약으로
검증하지 못했다고 스스로 밝힌 항목(AC 25·28·30)은 **Reviewer가 대신 수행했다.**

### Criteria Assessment

**A. 문서가 사실과 일치한다**

| AC | 판정 | 근거 (Reviewer 실측) |
|---|---|---|
| 1 | **PASS** | README·AGENTS가 **지시하는** command가 전부 실존. 미구현 언급은 Planned/Known Missing **서술**이지 지시가 아니다 |
| 2 | **PASS** | `AGENTS.md` `task show` **0건** · `task block` **0건** |
| 3 | **PASS** | `docs/architecture.md` `task show` **0건** |
| 4 | **PASS** | Planned 불릿에서 model adapter·telemetry persistence·verification feedback·`request-changes` **잔존 0건** |
| 5 | **PASS** | 남은 Planned는 `block`/`unblock`/`create`/`list`/`show`/`init`/`status`/`reindex`·templates·worktree·benchmark 결과 — **전부 `cli.ts`에 문자열 0건**으로 실측 |
| 6 | **PASS** | ko README가 같은 미구현 목록·`actor_id` 자기 신고·token `unavailable`·harness 경계를 서술. 영문과 모순 없음 |

**B. 역할 정책**

| AC | 판정 | 근거 |
|---|---|---|
| 7 | **PASS** | `CLAUDE.md:8` *"기본 운영 정책에서 Claude는 Manager·Architect·Reviewer"* · `:11` *"기본 Worker는 Codex다"* |
| 8 | **PASS** | `:12` *"선택적으로 `--worker claude`도 지원하지만, 그것이 기본 역할 정책을 바꾸지는 않는다"* |
| 9 | **PASS** | 능력 부정 문장 **0건**. 기존 *"너는 worker 역할을 맡지 않는다"* 가 정책 서술로 교체됨 |
| 10 | **PASS** | `CLAUDE.md:44` 자기 승인 금지 유지 + *"별도 `actor_id`를 쓰며 자기 구현을 승인하지 않는다"* 추가 |

**C. 아키텍처**

| AC | 판정 | 근거 |
|---|---|---|
| 11 | **PASS** | `src/` 목록이 실제 8개 평면 모듈과 일치 (benchmark·cli·context·model·reviewer·run·runner·workflow) |
| 12 | **PASS** | `src/core/` · `src/util/` **0건** |
| 13 | **PASS** | tasks=manager · reports=worker · reviews=reviewer · amendments=human · runs · benchmarks 소유자 구분 존재 |
| 14 | **PASS** | *"Task가 `IMPLEMENTED`이면서 마지막 Run이 `failed`인 상태도 모순이 아니다"* — 두 사실을 명시 분리 |
| 15 | **PASS** | *"measurement harness다. controlled trial 결과가 아니며"* 경계 반영 |

**D. 역사 보존**

| AC | 판정 | 근거 |
|---|---|---|
| 16 | **PASS** | 상단 *"**역사 문서:** … 현재 CLI reference가 아니며, 실제 command 표면은 README와 `bcos --help`를 따른다"* |
| 17 | **PASS** | `git diff docs/v0.1-scope.md` = **+3줄, 삭제 0줄.** 본문 재작성 없음 — Worker 보고와 일치함을 직접 확인 |

**E. 릴리스 주장**

| AC | 판정 | 근거 |
|---|---|---|
| 18 | **PASS** | `package.json` version `0.1.0` · diff **빈 출력** |
| 19 | **PASS** | protocol `0.1` Experimental 표기 **3개 문서**에 유지 |
| 20 | **PASS** | `production-ready` · `1.0-ready` · `stable` 선언 **0건** |
| 21 | **PASS** | `is/are faster` · `cheaper` · `more efficient` · `beats single-agent` **0건** |

**F. 외부 dogfooding**

| AC | 판정 | 근거 |
|---|---|---|
| 22 | **PASS** | **Reviewer가 임시 프로젝트에서 README 절차를 글자 그대로 재현** — `task context`·`start`·`run --dry-run`·`status` **4개 전부 exit 0** |
| 23 | **PASS** | 절차에 `bcos init`·`task show`·`task block` **없음**. 그 8종을 직접 호출해 **전부 exit 1** 확인 |
| 24 | **PASS** | `--dry-run`이 `worker_exit_code`·`worker_stdout_bytes`를 내지 않음 → **모델 프로세스 미기동**. 네트워크 호출 없음 |
| 25 | **PASS** | **Reviewer가 실행 전후 `git status --short`를 스냅샷 비교 — 완전 동일.** fixture 잔여물 0. *(Worker는 git 금지로 미검증이라고 정직하게 밝혔고, Reviewer가 대신 수행했다)* |

**G. Known Limitations**

| AC | 판정 | 근거 |
|---|---|---|
| 26 | **PASS** | 7항목 전부 확인 — block/unblock 부재(3개 문서) · init 부재(4) · `actor_id` 자기 신고(2) · token `unavailable`(2) · T-016 harness(3) · evaluation gate 미정(3) · Report append(1) |
| 27 | **PASS** | `workflow.ts` 340/340이 *"implementation maintenance note rather than a user-facing capability"* 로 분리 서술 |

**H. 회귀**

| AC | 판정 | 근거 |
|---|---|---|
| 28 | **PASS** | `src/` · `tests/` · `package.json` · lockfile diff **전부 빈 출력** *(Worker 미검증 → Reviewer 수행)* |
| 29 | **PASS** | 의존성 변경 0 · `cli.ts` diff 0줄 → 새 CLI command 0 |
| 30 | **PASS** | **Reviewer 단독 실행: build exit 0 · tests 289 / pass 289 / fail 0 / skipped 0 / todo 0.** 테스트 삭제·개명·skip·todo **각 0건** *(Worker는 `spawn EPERM`으로 미검증이라 명시 → Reviewer가 대신 수행)* |
| 31 | **PASS** | 새 문서 파일 **0개**. 신규는 Report·RunRecord뿐이며 `QUICKSTART.md` 등 없음 |

**집계 — PASS 31 · FAIL 0 · SUPERSEDED 0**

### Independent Verification

**Frozen Contract** — body **15,961 bytes로 lock commit `3ec4a14`와 바이트 동일**.
변경된 frontmatter 키는 `status`·`attempt`·`updated` 셋뿐.

**Diff 범위**

```
문서 7개 + lifecycle 3 + Report + RunRecord
src/ · tests/ · package.json · lockfile · CONTRIBUTING.md · docs/rfcs/ · docs/decisions/  → 전부 빈 diff
git diff --check exit 0 · T-017 0건 · T-019 0건
```

**Reviewer 독립 회귀 (단독 실행)**

```
npm run build → exit 0
npm test      → tests 289 · pass 289 · fail 0 · skipped 0 · todo 0
```

**Reviewer 독립 외부 smoke — 실패 0건**

```
task context T-001    → exit 0, 파일 3건 [.bcos/tasks/…, AGENTS.md, app.txt]
task start   T-001    → exit 0, TODO -> IN_PROGRESS
task run --dry-run    → exit 0, context_files=3 stdin_bytes=1795, worker_* 미출력
task status  T-001    → exit 0

init · reindex · status · task create · list · show · block · unblock → 8종 전부 exit 1
BCOS 저장소 파일 혼입 0 · 사용자명/홈 절대경로 0 · 실행 전후 git status 완전 동일
```

**핵심 수정의 실제 내용 — AGENTS.md**

T-016을 막았던 지시가 정확히 제거됐다.

```diff
-6. … 필요하면 `bcos task block`으로 멈추고 보고한다.
+6. … 필요하면 멈추고 막힌 이유를 보고한다.
-1. bcos task show <id>   2. bcos task start <id>  …  5. bcos task submit <id>
+1. Context Package 수령  2. 구현+테스트  3. Report 작성  4. 멈춘다 (host가 검증 후 submit)
+Worker session은 lifecycle을 소유하지 않는다.
+현재 CLI에는 block/unblock 전이가 없으므로 Worker가 상태를 직접 바꾸지 않는다.
```

외부 프로젝트의 **수동 운용**(`task start`/`submit`을 host 단계로 실행)과
**Worker가 직접 전이하는 것**을 구분해 적었다 — 정확하다.

### Findings

**BLOCKING 0 · MAJOR 0 | MINOR 0 · INFO 3**

**I-1 (INFO) — Worker가 검증하지 못한 AC 3건을 정직하게 표시했다**

Report의 Known Risks가 *"Acceptance Criterion 30 is not verified: the required 289/289
test run is blocked by this Worker's `spawn EPERM` sandbox restriction. **This is an
environment failure before test execution, not a passing regression result.**"* 라고 적었고,
AC 25·28도 git 금지로 미검증이라고 밝혔다.

**전체 통과를 주장하지 않았다.** Reviewer가 세 항목을 직접 수행해 전부 PASS를 확인했다.
**이것은 결함이 아니라 정직한 Report의 사례다.**

**I-2 (INFO) — Manager 단계의 동시 실행 간섭은 제품 결함이 아니다**

Manager가 `npm test` 백그라운드 실행 중 smoke를 동시에 돌려 무관한 테스트 2건
(`status reports latest execution fields` · `worker can switch after verification failure`)이
실패한 기록이 있다. **Reviewer 단독 실행에서 289/289**로 재현되지 않았다.
**harness 운용 문제이며 T-018 산출물의 결함이 아니다.** T-015에서도 같은 성격의
간섭이 있었으므로 **단독 실행 규칙을 계속 지킬 것**을 기록해 둔다.

**I-3 (INFO) — Current Capabilities 불릿 하나가 다소 함축적이다**

*"selecting Claude for a worker session does not make it the default"* 는 앞 절
*"The default operating policy remains Claude as Manager/Reviewer and Codex as Worker"*
에서 목적어가 유추되지만 그 자체로는 축약돼 있다. README의 무마침표 불릿 문체와
일관되고 의미 왜곡이 없어 **수정을 요구하지 않는다.**

### Scope · Ponytail

| 항목 | 실측 |
|---|---|
| `src/` · `tests/` · `package.json` · lockfile | **각 빈 diff** |
| `CONTRIBUTING.md` | **빈 diff** — Contract가 Write List에서 뺀 결정이 지켜졌다 |
| RFC · ADR | **빈 diff** |
| 새 CLI command · 새 helper · 새 문서 파일 | **각 0** |
| version bump · tag · release | **0** |
| T-017 · T-019 | **각 0건** |

**Ponytail 위반 없음.** 이 Task는 **documentation/runtime truth alignment 하나만** 했다.

- 없는 command를 만들어 문제를 해결하려는 시도 **0건** — `bcos init`이 없어서
  Quick Start가 수동이라는 사실을 **그대로 적었다.** Contract가 최대 실패 경로로
  지목한 함정을 피했다
- `QUICKSTART.md` 같은 새 파일을 만들지 않고 **README 기존 섹션을 고쳐** 해결했다
- docs 재구조화·architecture refactor·unrelated cleanup **0건**
- **`docs/v0.1-scope.md`를 +3줄로 처리한 것은 이 Task에서 가장 좋은 판단이다.**
  109줄짜리 역사 문서를 현재 사실에 맞춰 재작성하려 했다면 과거 계획 기록이
  사라졌을 것이다. 배너 한 개로 오해를 막고 역사를 보존했다

### Verdict

**APPROVED**

AC 31개 전부 PASS, BLOCKING·MAJOR·MINOR 0건. 동결 계약 본문이 바이트 단위로 보존됐고
production source·tests·package·CONTRIBUTING·RFC·ADR이 전부 무변경이다.

**T-016을 실제로 막았던 `AGENTS.md`의 존재하지 않는 command 지시가 제거됐고**,
Planned에서 이미 구현된 네 항목이 빠졌으며, `src/core/`·`src/util/` 허구가 실제
8개 평면 모듈로 교체됐고, vision의 *"LLM을 직접 호출하지 않는다"* 가 현재 경계로
정정되면서 Human-Controlled Autonomy는 유지됐다.

외부 프로젝트 부트스트랩을 **Reviewer가 README 절차 그대로 재현해 4단계 전부 통과**했고,
문서가 사용 가능하다고 말하지 않는 8종 command는 전부 정직하게 실패한다.
**효율성 우위 주장 0건 · version 0.1.0 · protocol 0.1 Experimental 유지.**

INFO 3건은 어느 것도 이번 변경의 정확성을 훼손하지 않으며, 그중 I-1은
**Worker가 자기 미검증을 숨기지 않은 사례**로 오히려 긍정적이다.
