---
task: T-015
---

# Review — T-015 Multi-model Worker Switching

## Attempt 1 — 2026-08-13T04:00:24Z — APPROVED

**Reviewer:** `claude-code` (actor_role: reviewer) · **Submitter:** `codex-cli` — SoD 충족 (G5)

**Worker 실행기를 고를 수 있게 됐고, 그 외에는 아무것도 바뀌지 않았다.**

`--worker claude`가 실제로 Claude 실행 형태로 나가고, `--worker codex`의 stdin은
구현 전과 **바이트 단위로 동일**하다. 두 실행기의 Worker 입력은 preamble의
`worker:` **한 줄만** 다르다. 폴백은 존재하지 않는다.

제품 변경은 `src/runner.ts` **17줄**, `src/workflow.ts` **2줄**이 전부다.
`model.ts` · `context.ts` · `run.ts` · `cli.ts` · `reviewer.ts` · `CLAUDE.md` ·
`AGENTS.md` · `package.json` · `package-lock.json` · `TELEMETRY.md` **전부 변경 0건**.

---

## 판정 요약

| | |
|---|---|
| **Verdict** | **APPROVED** |
| BLOCKING **0** · MAJOR **0** | MINOR 1 · INFO 4 |
| AC | **PASS 50 / 50** |
| Reviewer 독립 재현 | build exit 0 · **272 / 272 pass · fail 0 · skip 0 · todo 0** |
| 새 파일 · 새 옵션 · 새 이벤트 · 새 telemetry 키 | **각 0** |

---

## 1. Ground Truth

```
branch main · HEAD e3ad7cb == origin/main
 M .bcos/events.jsonl · .bcos/state.json · .bcos/tasks/T-015-…md
 M src/runner.ts (17) · src/workflow.ts (2) · tests/cli.test.ts (+127)
?? .bcos/reports/T-015-…md · .bcos/runs/20260812T124928305Z-7b47aa44.json
?? x   ← 세션 이전부터 존재. 건드리지 않았다
```

T-015와 무관한 변경 **0건**.

## 2. Lifecycle — 정확히 일치

| | |
|---|---|
| status / attempt | **IMPLEMENTED / 1** ✓ |
| `TASK_STARTED` | **1건** ✓ (재발생 없음) |
| `TASK_SUBMITTED` | **1건** ✓ |
| `TASK_APPROVED` | **0건** ✓ |
| `TASK_CHANGES_REQUESTED` | **0건** ✓ |
| switch 전용 이벤트 | **0건** ✓ |
| `current_task` | **null** ✓ · counts IMPLEMENTED 1 / DONE 15 |

runtime switching 때문에 attempt가 증가한 흔적 **없음**.

## 3. Host Verification 독립 재현

```
npm run build → exit 0
npm test      → tests 272 · pass 272 · fail 0 · skipped 0 · todo 0
                duration_ms 98834.6
```

**Reviewer 절차 기록** — 첫 재현 시도는 243개에서 정지했다. 원인은 제품이 아니라
**Reviewer가 격리 검증 harness를 테스트와 동시에 돌린 것**이다
(harness가 수십 개의 `task execute` 자식을 띄운다). 병행 실행을 중단하고
suite를 단독으로 다시 돌려 98.8초에 272/272를 얻었다. **제품 결함이 아니다.**

**T-900 교훈 적용 — fixture shape 검증.** 신규 16개가 숫자 채우기인지 확인했다.
전부 독립 행동을 본다: Claude argv · stdout/stderr 전달 · nonzero · timeout ·
stdin 한 줄 차이 · Context SHA 동일 · 두 피드백 전달 · 폴백 금지 ·
`native` 실행 형태 · artifact identity/version · 세션 마커 · attempt 간 전환 ·
같은 attempt 내 전환. **vacuous한 테스트 없음.**

**AC 50 검증 — 테스트가 설치된 CLI에 의존하지 않는다.** `runWorkerAs`가 항상
`--worker-command`를 넘긴다. `native` 분기 테스트는 `.js`가 아닌
`process.execPath`를 override로 써서 **실제 Claude 없이** `runtimeKind: "native"`를
만들어낸다. `claudeEntry`/`codexEntry`/PATH 참조 **0건**.

## 4. Scope — 전부 준수

| 파일 | diff |
|---|---|
| `src/model.ts` · `context.ts` · `run.ts` · `cli.ts` · `reviewer.ts` | **각 0건** |
| `CLAUDE.md` · `AGENTS.md` | **각 0건** |
| `package.json` · `package-lock.json` | **각 0건** |
| `docs/benchmarks/TELEMETRY.md` | **0건** |

새 source file **0** · 새 CLI 옵션 **0**(`--help` 불변) · 새 lifecycle state **0** ·
새 이벤트 **0** · 새 telemetry 키 **0**(테스트의 `telemetryKeys` 목록 diff 0) ·
provider/plugin/registry/factory/strategy **0** · dependency **0**.

## 5. Codex backward compatibility — 독립 재현, 동일

구 소스 mirror + 새 dist로 `--worker codex --dry-run`을 다시 계산했다.

```
기준선(구현 전)  stdin f054d8e256cd5a72905a7e072bb082c0ccd4a2dd69e19301c72a65564f07e240
Reviewer 재현    stdin f054d8e256cd5a72905a7e072bb082c0ccd4a2dd69e19301c72a65564f07e240
context 807e488d… (동일) · 203,923자 (동일) · 10 files (동일)
```

**기존 Codex 경로는 한 바이트도 바뀌지 않았다.**

## 6. Runtime 선택 실제 실행 형태 — argv 직접 캡처

가짜 worker가 자기가 받은 argv를 파일로 남기게 해서 확인했다.

```
codex  → ["exec", "-", "--cd", <root>]
claude → ["-p", "--output-format", "text"]
```

- `--worker codex` → Codex path ✓
- `--worker claude` → Claude path ✓
- **Claude argv에 `exec` · `--cd` 섞이지 않음** ✓
- Codex argv 의미 기존과 동일 ✓
- runtime 분기가 `model.ts` 밖으로 복제되지 않음 — `runner.ts`는 `runtime` 하나만 넘긴다 ✓

## 7. dry-run telemetry

```
--worker codex   worker_name=codex   worker_runtime=node
--worker claude  worker_name=claude  worker_runtime=native
```

`worker_name` = 실행기 정체 · `worker_runtime` = 실행 형태.
**T-013의 semantic collision 재발 없음** — run artifact에 `worker_runtime` 필드가
**존재하지 않고**, identity는 `worker_name`에만 있다.

설계가 지목한 `runner.ts:144`의 `worker_runtime: "node"` 하드코딩이
`prepared.runtimeKind`로 교체됐다. **결함 해소 확인.**

## 8. stdin runtime-neutrality

동일 Task·Context·피드백으로 두 stdin을 만들어 줄 단위 비교했다.

```
다른 줄: 1개
  line 3: "  worker: codex"  vs  "  worker: claude"
줄 수 동일
```

model-specific prompt · Claude-only / Codex-only 블록 · runtime별 피드백 변형
**전부 0건**.

## 9. BCOS_WORKER_SESSION

| | |
|---|---|
| Codex worker | `BCOS_WORKER_SESSION=1` ✓ |
| Claude worker | `BCOS_WORKER_SESSION=1` ✓ |
| Reviewer | `src/reviewer.ts` **변경 0건** — 기존 삭제 정책 유지 ✓ |

runtime별 nested guard를 새로 만든 흔적 **없음**.

## 10. Run Artifact

| runtime | `worker_name` | `worker_version` |
|---|---|---|
| codex | `codex` | 기록됨 |
| claude | `claude` | 기록됨 |

`worker_runtime` artifact 필드 **신설 안 함** · 기존 run schema 유지 ·
JSON 유효 · 홈 절대경로 **0건** · 환경변수 덤프 **0건**.

실제 lifecycle artifact도 `worker_name: codex` · `worker_version: 0.147.0`으로 정상이다.

## 11. Verification Failure Feedback — 양방향

| 시나리오 | 결과 |
|---|---|
| Codex 실패 → 같은 attempt Claude 재개 | 블록 포함 · 증거 보존 ✓ |
| Claude 실패 → 같은 attempt Codex 재개 | 블록 포함 · 증거 보존 ✓ |

번역/재작성 **없음** · runtime-specific feedback 코드 **없음** ·
attempt 증가 **없음** · 새 이벤트 **없음**.
**T-014 코드는 한 줄도 수정되지 않았다** — 기존 구조가 그대로 동작한다.

## 12. Review Feedback Handoff

Codex · Claude **양쪽 모두** `--- REVIEW OF PREVIOUS ATTEMPT ---`와 본문을 받는다.
**T-011 코드 수정 0건** — runtime-neutral 구조가 그대로 통했다.

## 13. Switching semantics

같은 attempt에서 `codex → claude → codex` 3회 전환을 재현했다.

```
attempt = 1 유지 · TASK_STARTED 추가 없음 · switch 이벤트 없음
run artifact의 worker_name만으로 전환 이력 재구성 가능
```

attempt 간 전환도 확인 — `a1=codex → a2=claude`.
**attempt 증가는 review rework 때문이지 runtime 변경 때문이 아니다.**

## 14. No Silent Fallback

| 경우 | 결과 |
|---|---|
| `--worker codex` + 실행 파일 없음 | 명시적 실패 · worker **미실행** · Claude 대체 **없음** |
| `--worker claude` + 실행 파일 없음 | 명시적 실패 · worker **미실행** · Codex 대체 **없음** |
| `--worker gpt` | 거부 · **어떤 worker도 실행되지 않음** |

## 15. Reviewer policy 회귀

`--reviewer claude` 허용 유지 · `--reviewer codex` 거부 유지
(`workflow.ts:177` 그대로, 거부 테스트 존치) · `src/reviewer.ts` **변경 0건**.

**same-runtime 제한을 새로 추가하지 않았다** — 소스에서 관련 문자열 **0건**.
현재 SoD는 actor identity separation이며 model diversity 강제가 아니라는
설계 결정이 그대로 보존됐다.

## 16. Permission bypass 금지

전체 diff **0건** · `src/` 전체 **0건**.
`--dangerously-skip-permissions` · `bypassPermissions` · `acceptEdits` ·
`danger-full-access` 어느 것도 추가되지 않았다.
BCOS가 사용자 Claude 권한 설정을 완화한 흔적 **없음**.

## 17. LOC / Ponytail

```
runner.ts   195 / 205
workflow.ts 326 / 330
```

abstraction 남발 **없음** · provider interface · registry · factory · plugin ·
runtime framework **전부 0**. 두 개의 닫힌 runtime을 위해 계층을 만들지 않았다.

**Ponytail 위반 없음.**

## 18. Bootstrap limitation

T-015 자신의 workflow는 T-015 이전 dist로 시작했다. 다만 **이 실행은 `--worker codex`
하나만 썼고, codex 경로는 구·신 코드가 같은 결과를 낸다** — 따라서 이 artifact에는
bootstrap 모호성이 없다 (`worker_name: codex` · `worker_version: 0.147.0` 정상).

**Claude 경로는 실제 lifecycle에서 한 번도 실행되지 않았고**, 새 build를 쓴
격리 fixture에서만 검증됐다. **이것은 설계가 의도한 바다.**

Report는 미검증 항목을 검증했다고 주장하지 않는다 — 아래 §20 참조.

## 19. CLAUDE.md Known Risk — 유지 판정

`CLAUDE.md:11`은 여전히 *"하지 않는 일: 대규모 구현 코드 작성 — 실제 구현은 Codex가
담당한다"*로, Claude를 manager/architect/reviewer로 전제한다.
T-015가 Claude를 Worker runtime으로 허용하므로, 실제 Claude Worker 실행 시
**BCOS stdin의 worker 계약과 저장소 지침이 충돌**할 수 있다.

**판정 — T-015 구현 결함이 아니다.** 저장소 지침 구성 문제이며, 일반 사용자의
저장소에는 없을 수 있다. 이번 Review에서 `CLAUDE.md`를 수정하지 않았고
실제 Claude Worker dogfooding도 하지 않았다.

**Known Risk로 유지하며, T-015 승인 후 Human 결정 항목으로 기록한다.**
근거 문서는 Task Contract §6과 Notes에 이미 상세히 남아 있다 (INFO-1 참조).

## 20. Worker self-test vs Host Verification

Report는 두 결과를 **명확히 분리**한다.

> `npm test` 실패 0건 요건은 실행 환경이 모든 Node 자식 프로세스 생성을 `EPERM`으로
> 차단해 검증하지 못했다. … **완료로 주장하지 않는다.**

worker 샌드박스 self-test 실패(`spawn EPERM`, 11개 Task 연속)를
제품 검증 실패로 혼동하지 않았고 숨기지도 않았다.
**권위는 Host Verification이며, Reviewer가 272/272를 독립 재현했다.**

---

## Criteria Assessment (RFC-001 §4 MUST — 50항목 전수)

증거: `M` 기계 검증 · `T` 테스트 · `X` 격리 실행 · `R` 실행 기록

| # | 판정 | 근거 |
|---|---|---|
| 1 | PASS | X `--worker codex` stdin SHA 기준선과 동일 |
| 2 | PASS | X+T `task execute --worker claude` 수락 |
| 3 | PASS | T `task run accepts a Claude worker` |
| 4 | PASS | X `--worker gpt` → `Unsupported worker`, worker 미실행 |
| 5 | PASS | T `task run rejects unsupported workers without changes` |
| 6 | PASS | T 거부 시 파일 무변경 (`bcosSnapshot` 비교) |
| 7 | PASS | M `reviewer.ts` diff 0 · suite 통과 |
| 8 | PASS | T `review rejects unsupported reviewer` 존치 |
| 9 | PASS | X codex argv `["exec","-","--cd",<root>]` |
| 10 | PASS | X claude argv `["-p","--output-format","text"]` |
| 11 | PASS | M `model.ts` 무변경 · `modelCommand` 테스트 유지 |
| 12 | PASS | X dry-run `node` / `native` |
| 13 | PASS | X argv 캡처로 선택 runtime 실행 확인 |
| 14 | PASS | M `model.ts` 무변경 (`shell:false`) |
| 15 | PASS | T `Claude task run forwards stdout and stderr` |
| 16 | PASS | T `Claude task run kills and marks a timeout` |
| 17 | PASS | T `Claude task run reports a nonzero exit unchanged` |
| 18 | PASS | X+T 실행 파일 없음 → 명시적 실패 |
| 19 | PASS | X claude 없음 → 실패, codex 미실행 |
| 20 | PASS | X codex 없음 → 실패, claude 미실행 |
| 21 | PASS | X artifact `worker_name` = 선택값 |
| 22 | PASS | X telemetry `worker_name` = 선택값 |
| 23 | PASS | X 다른 줄 정확히 1개 (line 3) |
| 24 | PASS | T+X Context SHA 동일 |
| 25 | PASS | M 모델별 프롬프트·마커 0건 |
| 26 | PASS | X Review 블록 양쪽 동일 |
| 27 | PASS | X 검증 실패 블록 양쪽 동일 |
| 28 | PASS | X 블록 순서 동일 |
| 29 | PASS | X codex env `BCOS_WORKER_SESSION=1` |
| 30 | PASS | X claude env `BCOS_WORKER_SESSION=1` |
| 31 | PASS | M `reviewer.ts` 무변경 — 삭제 정책 유지 |
| 32 | PASS | T nested 가드 테스트 통과 |
| 33 | PASS | X artifact `worker_name: codex` |
| 34 | PASS | X+T artifact `worker_name: claude` |
| 35 | PASS | X+T `worker_version` 기록 |
| 36 | PASS | X dry-run runtime 정확 (결함 수정) |
| 37 | PASS | X artifact에 `worker_runtime` 필드 없음 |
| 38 | PASS | M `telemetryKeys` diff 0 · `fields.` 추가 0 |
| 39 | PASS | X 전환 3회에도 attempt 1 유지 |
| 40 | PASS | X `TASK_STARTED` 추가 0 · switch 이벤트 0 |
| 41 | PASS | T+X 같은 attempt 내 전환 가능 |
| 42 | PASS | M `workflow.ts` 검증 단계가 runtime을 읽지 않음 |
| 43 | PASS | X 검증 실패 시 submit 차단 |
| 44 | PASS | T G3·G5 테스트 통과 |
| 45 | PASS | M 새 파일 0 · 5개 파일 diff 0 |
| 46 | PASS | M runner 195≤205 · workflow 326≤330 |
| 47 | PASS | M class·interface·registry·plugin·factory 0건 |
| 48 | PASS | M deps 0 / devDeps 2 |
| 49 | PASS | **Reviewer 직접** build exit 0 · 272 pass (≥272) |
| 50 | PASS | M skip 0 · 실제 CLI 참조 0건 (모든 테스트가 override 사용) |

**집계 — PASS 50 · FAIL 0.** T-015에 Amendment가 없으므로 `SUPERSEDED`를 쓰지 않았다.

---

## Findings

| | 등급 | 유형 | 내용 |
|---|---|---|---|
| **M-1** | **MINOR** | Architecture | **`runCodexWorker`가 이제 Claude도 실행하는데 이름이 그대로다.** 정의 1 + import 1 + 호출 2 = **4곳**. 동작은 정확하고 어떤 AC도 위반하지 않지만, **함수 이름이 runtime을 단언하면서 실제로는 runtime 중립**이다. 이 프로젝트가 T-013·T-900에서 경계해 온 "이름과 의미의 조용한 어긋남"과 같은 계열이다. `runWorker`로 바꾸면 4줄이면 끝난다. **승인을 막지 않는다** — 소스 내부 이름이라 BCOS 출력 소비자를 오도할 수 없다 |
| I-1 | INFO | Process | Report의 `Known Risks`에 **`CLAUDE.md` 충돌이 빠져 있다.** 다만 **Task Contract가 Report 기재를 요구하지 않았고**(§6·Notes에만 기술), 근거는 커밋된 Task 문서에 온전히 남아 있다. **Worker 결함으로 보지 않는다** |
| I-2 | INFO | — | `options.worker as ModelRuntime` 캐스트가 `runCodexWorker` 안에서 **2회 반복**된다. `prepareRun`이 먼저 검증하므로 **안전하다**. `PreparedRun`에 `runtime`을 실어 나르면 1회로 줄지만 크기 차이는 없다 |
| I-3 | INFO | Process | **Claude 경로는 실제 lifecycle에서 실행된 적이 없다** — 격리 fixture 검증뿐이다. 설계가 의도한 바이며 Report도 그렇게 적는다. 첫 실제 Claude Worker 실행 전에 §19를 해소해야 한다 |
| I-4 | INFO | Process | **Reviewer 절차 기록** — 첫 테스트 재현이 243개에서 정지했다. 원인은 Reviewer가 검증 harness를 suite와 **동시에** 실행한 것이며, 단독 재실행 시 98.8초에 272/272를 얻었다. **제품 결함이 아니다** |

**BLOCKING 0 · MAJOR 0.**

---

## Required Changes

**없다.** M-1은 승인 조건이 아니며 후속 Task에서 다룰 후보로 남긴다.

---

## Verdict

**APPROVED**

50개 Acceptance Criteria를 전부 충족하고, Host Verification 272/272를 Reviewer가
독립 재현했으며, BLOCKING·MAJOR Finding이 없다.

**세 가지를 특히 평가한다.**

첫째, **기존 Codex 경로가 바이트 단위로 불변**이다. 구현 전 지문을 미리 떠두고
구 소스 mirror + 새 dist로 재현해 확인했다 — 회귀 위험을 설계 단계에서 제거했다.

둘째, **선택한 runtime이 실제로 실행되는지를 argv 캡처로 증명**했다. "수락된다"가
아니라 "그 실행기의 실행 형태로 나간다"를 확인했고, 폴백이 존재하지 않음도
세 경우로 확인했다.

셋째, **T-011·T-014 코드를 한 줄도 고치지 않고 runtime 중립성이 성립**했다.
이는 T-013 경계 설계가 옳았다는 사후 증거다.

**M-1(`runCodexWorker` 명명)은 기록만 하고 넘어간다** — 동작에 영향이 없고
데이터 계약을 오도하지 않는다. 다만 이 프로젝트의 기준에서는 정리해 둘 가치가 있다.

**이 Review는 어떤 lifecycle 명령도 실행하지 않았다.**
Task는 `IMPLEMENTED / attempt 1`, `TASK_APPROVED` 0건 그대로다.
