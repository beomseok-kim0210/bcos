# T-001 Metrics

## Experiment Metadata

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Task ID | T-001 | Measured | `.bcos/tasks/T-001-project-scaffold.md` |
| Protocol Version | 0.1 | Measured | Task frontmatter `protocol: "0.1"` |
| Worker Actor | codex-cli | Measured | 프롬프트 `actor_id: codex-cli` |
| Reviewer Actor | claude (opus-5) | Measured | 본 Review 세션 |
| Attempt | 1 | Measured | Report `## Attempt 1` |
| Verdict | APPROVED | Measured | `.bcos/reviews/T-001-project-scaffold.md` |
| Review Timestamp | 2026-08-04T02:14:35Z | Measured | `date -u` |
| Reviewer OS | Windows 10 (10.0.19045) | Measured | 세션 환경 |
| Reviewer Node | v24.11.1 | Measured | `node --version` |
| Reviewer npm | 11.6.2 | Measured | `npm --version` |
| Delivery Mode | 부트스트랩 수동 프롬프트 | Measured | `bcos task show` 미구현, `.bcos/prompts/` 사용 |

> **핵심 주의:** T-001은 `bcos` CLI가 존재하기 이전에 실행됐다. 따라서 RFC-001 §6이 정의한
> **Context Package(`bcos task show` 출력)는 이 실험에 존재하지 않는다.** 아래 Context Efficiency의
> 모든 수치는 그 대체물인 수동 프롬프트 경로를 측정한 것이며, 향후 Context Package와 **직접 비교할 수 없다.**

---

## Context Efficiency

문자 수는 UTF-8 바이트가 아니라 **유니코드 문자 수**로 셌다(한국어 문서라 바이트 기준은 약 1.5배 부풀려짐).
`.bcos/prompts/T-001-codex-prompt.md`는 파일 전체와, 실제로 세션에 붙여넣도록 지시된 `---` 사이 **본문**을 구분해 측정했다.

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Worker Prompt Characters (본문) | 2953 | Measured | `---` 구분자 사이 본문, Node `String.length` |
| Worker Prompt Characters (파일 전체) | 3109 | Measured | 파일 전체 문자 수 |
| Worker Prompt Bytes (파일 전체) | 5003 | Measured | `Buffer.byteLength(utf8)` |
| Worker Prompt Lines (본문) | 122 | Measured | 개행 분할 |
| Worker Prompt Lines (파일 전체) | 130 | Measured | 개행 분할 |
| Worker Prompt Estimated Tokens (본문) | 738 | Estimated | 문자수 ÷ 4 — **실제 tokenizer 미사용** |
| 허용된 Read Source 수 | 4 | Measured | Task `Expected Files` §읽기 허용 |
| 실제 읽은 파일 수 (worker 자기보고) | 5 | Measured | Report `Context Used: Files read: 5` |
| 실제 읽은 파일 수 (독립 검증) | N/A | N/A | 트랜스크립트·읽기 로그 부재 (Review F-4) |
| 허용 목록 밖 읽은 파일 수 | 1 | Measured | Report — `.bcos/prompts/T-001-codex-prompt.md` |
| AGENTS.md Characters | 4433 | Measured | Node `String.length` |
| Task 명세 Characters | 2665 | Measured | Node `String.length` |
| ADR-001 Characters | 2190 | Measured | Node `String.length` |
| RFC-001 §3만 Characters | 713 | Measured | `## 3.`~`## 4.` 구간 추출 |
| RFC-001 전체 Characters (미투입) | 10066 | Measured | 참고 — 워커는 §3만 읽도록 지시받음 |
| **투입 컨텍스트 합계 (프롬프트본문+AGENTS+Task+ADR+RFC§3)** | **12954** | Derived | 위 5개 항목 합 |
| 투입 컨텍스트 Estimated Tokens | 3239 | Estimated | 12954 ÷ 4 — **추정값** |
| Context Package Characters (RFC §6 정의) | N/A | N/A | `bcos task show` 미구현 — 측정 불가 |
| Prompt Usage Rate (합계 기준) | 161.9% | Derived | 12954 / 8000 × 100 |
| Prompt Budget Remaining (합계 기준) | -4954 | Derived | 8000 − 12954 |
| Prompt Usage Rate (프롬프트+Task만) | 70.2% | Derived | 5618 / 8000 × 100 |
| Prompt Budget Remaining (프롬프트+Task만) | 2382 | Derived | 8000 − 5618 |
| Prompt Usage Rate (프롬프트 본문만) | 36.9% | Derived | 2953 / 8000 × 100 |
| Repository 총 파일 수 (worker 시작 시점, 추적 기준) | 18 | Measured | `git ls-files \| wc -l` |
| Repository 총 파일 수 (현재, node_modules/.git/dist 제외) | 24 | Measured | `find` 카운트 |
| Read Scope Ratio (5 / 18) | 27.8% | Derived | 실제 읽은 파일 / worker 시작 시점 추적 파일 |
| Read Scope Ratio (5 / 24) | 20.8% | Derived | 실제 읽은 파일 / 현재 전체 파일 |

**해석 주의 (RFC-001 §6 재검토용).** 8,000자 임계값을 초과한 것은 사실이지만, 이는 **부트스트랩 경로가
RFC §6 명세보다 과잉 투입했기 때문**이다. §6은 Context Package에 `ARCHITECTURE RULES — 해당 규칙만 발췌`와
`RELATED DECISIONS — 링크 + 한 줄 요약`을 요구한다. 즉 명세대로라면 AGENTS.md 전문(4,433)과 ADR-001
전문(2,190)이 아니라 발췌·요약이 들어가야 한다. 그 둘을 명세 수준으로 축약하면 합계는 약 4,000~4,500자로
임계값의 50~56%에 들어온다. **따라서 이 실험은 "8,000자가 부족하다"의 근거가 아니라,
"부트스트랩 프롬프트가 §6 명세보다 무겁다"의 근거다.**

---

## Delivery Speed

worker 측 타임스탬프는 Report의 Attempt 헤더 1개뿐이다. 시작 시각·총 소요시간을 산출할 이벤트 로그가 없다.

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Worker 시작 시각 | N/A | N/A | `events.jsonl` 부재, 트랜스크립트 없음 |
| Worker 완료 시각 | 2026-08-04T02:00:42.970Z | Measured | Report `## Attempt 1` 헤더 |
| 총 Worker 소요시간 | N/A | N/A | 시작 시각 부재로 산출 불가 |
| 의존성 설치 소요시간 (worker, 성공 실행) | ~3 s | Measured | Report npm 출력 `added 3 packages ... in 3s` |
| 의존성 설치 소요시간 (reviewer 재실행, warm) | 3049 ms | Measured | 재실행 계측 — cold install 아님 |
| 빌드 소요시간 (worker) | N/A | N/A | Report에 시간 미기록 |
| 빌드 소요시간 (reviewer 재실행) | 3292 ms | Measured | 재실행 계측 (wall clock) |
| 테스트 소요시간 (worker, 러너 내부) | 415.77 ms | Measured | Report `duration_ms 415.7731` |
| 테스트 소요시간 (reviewer, 러너 내부) | 419.30 ms | Measured | 재실행 `duration_ms 419.2952` |
| 테스트 소요시간 (reviewer, wall clock) | 1683 ms | Measured | 재실행 계측 |
| Human 승인 요청 횟수 | 2 | Measured | Report Deviations — 네트워크 1, 프로세스 생성 1 |
| Worker Task 레벨 중단·재시도 | 0 | Measured | Report에 Attempt 1 단독, block 기록 없음 |
| Worker 명령 레벨 재시도 | 3 | Measured | npm.ps1→npm.cmd, ENOTCACHED 재시도, EPERM 재시도 |

---

## Quality

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Acceptance Criteria 총수 | 9 | Measured | Task `Acceptance Criteria` |
| Acceptance Criteria 통과 수 | 9 | Measured | Review Criteria Assessment — 전 항목 reviewer 재현 |
| Acceptance Criteria 실패 수 | 0 | Measured | 동일 |
| **AC Pass Rate** | **100.0%** | Derived | 9 / 9 × 100 |
| Test Cases 총수 | 3 | Measured | `npm test` → `ℹ tests 3` |
| Test Cases 통과 수 | 3 | Measured | `ℹ pass 3 / fail 0` |
| **Test Pass Rate** | **100.0%** | Derived | 3 / 3 × 100 |
| Test Requirements 요구 최소 테스트 수 | 3 | Measured | Task `Test Requirements` 표 3행 |
| Build Result | SUCCESS | Measured | `npm.cmd run build` exit 0, `dist/cli.js` 생성 |
| CLI 검증 경로 수 (AC 요구) | 3 | Measured | `--version`, `--help`, `foo` |
| CLI 검증 경로 수 (reviewer 실행) | 4 | Measured | 위 3개 + 무인자 경로(AC 아님) |
| 첫 Review 통과 여부 | Yes | Measured | Attempt 1 → APPROVED |
| Review Findings 수 | 5 | Measured | Review Findings F-1~F-5 |
| Blocking Findings 수 | 0 | Measured | 전 항목 non-blocking 분류 |
| 구현 결함성 Findings 수 | 0 | Measured | F-1·F-3=명세 갭, F-4·F-5=프로토콜 갭, F-2=정보성 |
| Rework Required | No | Measured | Required Changes 없음 |
| Attempt 수 | 1 | Measured | Report·Task frontmatter `attempt: 0`(미전이) |

---

## Scope Control

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Expected Files 수 (생성) | 5 | Measured | Task `Expected Files` §생성 |
| Expected Files 수 (쓰기 허용, Report 포함) | 6 | Measured | 생성 5 + Report 1 |
| 실제 생성·수정 파일 수 | 6 | Measured | `git status --short` 미추적 6건 |
| 허용 범위 밖 변경 파일 수 | 0 | Measured | `git diff HEAD --stat` 공백 — 추적 파일 변경 0 |
| Out of Scope 침범 수 | 0 | Measured | 10개 금지 산출물 전부 부재 확인 |
| 예상 밖 런타임 의존성 수 | 0 | Measured | `dependencies` 키 부재 |
| 예상 밖 devDependency 수 | 0 | Measured | `typescript`, `@types/node` — 허용 목록과 정확히 일치 |
| 예상 밖 추상화 수 | 0 | Measured | Interface·Factory·Manager·Wrapper·Service 각 0 |
| 관련 없는 리팩터링 수 | 0 | Measured | 기존 추적 파일 변경 0건 |
| Task 파일 직접 수정 건수 | 0 | Measured | `git log -1 -- .bcos/tasks/...` → `c66e039` 이후 무변경 |
| state.json 직접 수정 건수 | 0 | Measured | `git diff HEAD -- .bcos/` → 0 |
| events.jsonl 직접 수정 건수 | 0 | Measured | 파일 자체가 미생성 |
| 무단 git commit/push 건수 | 0 | Measured | `git log` 최신 커밋 `aa396d0` — T-001 산출물 전부 미추적 |

---

## Simplicity

**LOC 기준: 빈 줄 포함.** 비교 편의를 위해 빈 줄 제외 값을 괄호로 병기한다. 전 파일 동일 기준.

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Source LOC — `src/cli.ts` | 18 (15) | Measured | `wc -l` / 빈 줄 제외 |
| Test LOC — `tests/cli.test.ts` | 32 (27) | Measured | `wc -l` / 빈 줄 제외 |
| README LOC | 5 (5) | Measured | Task 요구 "5줄 이내" 충족 |
| Config LOC — `package.json` | 19 (19) | Measured | `wc -l` |
| Config LOC — `tsconfig.json` | 13 (13) | Measured | `wc -l` |
| Config LOC 합계 | 32 (32) | Derived | 19 + 13 |
| Report LOC | 155 (122) | Measured | `wc -l` |
| **총 추가 LOC (구현 5개 파일)** | **87 (79)** | Derived | 18+32+5+19+13 |
| 총 추가 LOC (Report 포함) | 242 (201) | Derived | 87 + 155 |
| Report / 구현 LOC 비율 | 1.78 | Derived | 155 / 87 |
| Runtime Dependencies 수 | 0 | Measured | `dependencies` 키 부재 |
| Dev Dependencies 수 | 2 | Measured | `typescript@^5.9.0`, `@types/node@^22.0.0` |
| 새 Interface 수 | 0 | Measured | 소스 스캔 |
| 새 Factory 수 | 0 | Measured | 소스 스캔 |
| 새 Manager/Service/Wrapper 수 | 0 | Measured | 소스 스캔 |
| 새 범용 Utility 수 | 0 | Measured | 테스트의 `run()` 3줄은 3개 케이스가 공유하는 지역 헬퍼 |
| 새 디렉터리 수 | 2 | Measured | `src/`, `tests/` — Expected Files가 요구 |
| 소스 파일 수 | 1 | Measured | `find src -type f` |
| 소스 분기 수 | 3 | Measured | `--version` / `--help` / else |
| **Ponytail Violation 수** | **0** | Measured | Review §Review Ponytail 4개 질문 전부 통과 |

---

## Execution Reliability

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| npm install 최초 결과 | FAILED (환경) | Measured | PowerShell 실행 정책이 `npm.ps1` 차단 — `UnauthorizedAccess` |
| npm install 재시도 횟수 | 2 | Measured | ① `npm.cmd` sandbox → ENOTCACHED ② 승인 후 → exit 0 |
| npm install 최종 결과 | SUCCESS | Measured | `added 3 packages, audited 4 packages` |
| build 최초 성공 여부 | Yes | Measured | Report·reviewer 재실행 모두 exit 0 |
| build 실패 횟수 | 0 | Measured | 기록·재현 모두 실패 없음 |
| test 최초 성공 여부 | No (환경) | Measured | 1회차 `spawn EPERM` (errno -4048) — sandbox 프로세스 생성 차단 |
| test 재시도 후 결과 | SUCCESS (3/3) | Measured | 승인 실행 exit 0 |
| **sandbox 관련 실패 수** | **2** | Measured | npm ENOTCACHED 1 + node --test EPERM 1 |
| 기타 환경 실패 수 | 1 | Measured | PowerShell 실행 정책(`npm.ps1`) |
| **환경 문제 실패 수 합계** | **3** | Derived | 2 + 1 |
| **코드 결함으로 인한 실패 수** | **0** | Measured | reviewer 재실행에서 전 명령 무실패 — 코드 원인 실패 없음 확인 |
| reviewer 재현 실패 수 | 0 | Measured | build·test·CLI 3경로·install 전부 1회 통과 |
| **최종 재현 성공 여부** | **Yes** | Measured | 2026-08-04 독립 환경 전 항목 재현 |

> `npm test`의 첫 실패는 **sandbox EPERM(환경)**이며 코드 결함과 분리해 기록했다.
> 동일 코드가 reviewer 환경에서 재시도 없이 3/3 통과했다는 점이 이 분리의 근거다.

---

## Human Effort

| Metric | Value | Type | Evidence |
|---|---:|---|---|
| Human 승인 횟수 | 2 | Measured | 네트워크 접근 1, 프로세스 생성 1 (Report Deviations) |
| Human 승인 성격 | 환경 권한만 | Measured | 구현 내용·설계에 대한 지시 아님 |
| Human 힌트 제공 횟수 | N/A | N/A | 트랜스크립트 부재 — Report에 힌트 수령 기록 없음 |
| Human이 직접 수정한 코드 수 (자기보고 기준) | 0 | Measured | Report에 human 편집 기록 없음 |
| Human이 직접 수정한 코드 수 (독립 검증) | N/A | N/A | 편집 주체를 구분할 로그 없음 |
| Human이 Task 범위를 변경한 횟수 | 0 | Measured | Task 파일 `c66e039` 이후 무변경 (git 검증) |
| Human이 제공한 범위 밖 입력 | 1 | Measured | `.bcos/prompts/T-001-codex-prompt.md` (부트스트랩 설계상 의도된 것) |
| Human 개입 없이 Worker가 완료했는지 | No (부분) | Measured | 내용 개입 0건이나 sandbox 승인 2회 필요 |

---

## Limitations

이 문서의 수치를 인용하기 전에 반드시 함께 읽어야 할 제약이다.

1. **비교군이 없다.** T-001은 단일 실행이며 대조군(예: Task 명세 없이 같은 스캐폴드를 만든 세션)이 없다.
   따라서 **어떤 개선율도 계산하지 않았고 계산해서도 안 된다.** 이 문서는 Baseline 정의가 전부다.
2. **표본 1개다.** 스캐폴드는 BCOS Task 중 가장 단순한 축이다. 기존 코드 이해가 필요 없고 통합 지점도
   없다. 컨텍스트 절감 효과는 **저장소가 커진 뒤에야 실제로 시험된다.**
3. **읽은 파일 수가 자기보고다.** AGENTS.md §7이 지정한 v0.1 성공 지표인데 독립 검증 수단이 없다
   (Review F-4). 현 시점에서 `Files read: 5`는 **반증되지 않았을 뿐 입증되지도 않았다.**
4. **토큰 수가 추정값이다.** 실제 tokenizer를 쓰지 않고 문자수÷4로 계산했다. 한국어는 토큰당 문자수가
   영어보다 낮아 **실제 토큰은 이 추정보다 클 가능성이 높다.** 절대값 인용은 부적절하다.
5. **Context Package를 측정하지 못했다.** `bcos task show`가 없어 RFC §6 산출물이 존재하지 않는다.
   측정한 것은 부트스트랩 프롬프트 경로이며, 8,000자 임계값과의 비교는 **동일 대상 비교가 아니다.**
6. **시간 지표 대부분이 N/A다.** worker 시작 시각과 총 소요시간을 산출할 이벤트 로그가 없다.
   기록된 시간은 reviewer 재실행 계측이 대부분이며 worker 실제 소요와 다르다.
7. **환경 노이즈가 섞였다.** 실행 실패 3건이 전부 sandbox·실행 정책 문제였다. 코드 품질과 무관하지만
   worker의 실제 소요시간과 재시도 횟수를 오염시켰다.
8. **Reviewer 환경이 worker 환경과 다르다.** reviewer는 Node v24.11.1에서 검증했다. Node 22.0–22.17에서는
   `npm test`가 실패한다(Review F-1). **"Windows에서 재현된다"는 주장은 Node 22.18+ 조건부다.**

---

## Baseline Conclusion

**T-001을 BCOS v0.1의 Baseline으로 확정한다. 개선율 주장은 하지 않는다.**

이번 실행에서 **관찰된 사실**은 다음과 같다.

- Task 명세 + 지정 읽기 목록만으로 worker가 **범위 이탈 없이** 스캐폴드를 완성했다.
  Expected Files 밖 변경 0건, Out of Scope 침범 0건, 추적 파일 변경 0건.
- Acceptance Criteria 9/9, 테스트 3/3이 **독립 reviewer 환경에서 재현**됐다.
- 런타임 의존성 0개를 유지했고 구현 소스는 18줄이다. Ponytail 위반 0건.
- **명세와 현실이 충돌한 지점 2곳에서 worker가 임의 확장 대신 준수+보고를 택했다** —
  `bcos` 부재로 상태 전이 불가(→ 정지 후 Known Risks 기록), lockfile이 Expected Files에 없음
  (→ 생성 억제 후 Deviations 기록). 이 Task가 실제로 시험하려던 행동이 관찰됐다.
- 실행 실패 3건은 **전부 환경 문제**였고 코드 원인 실패는 0건이었다.

이번 실행이 **아직 입증하지 못한 것**은 Limitations에 정리했다. 특히 컨텍스트 절감이라는 프로젝트의
핵심 가설은 **비교군과 더 복잡한 Task 없이는 검증되지 않는다.**

**RFC-001 §6에 대한 실측 피드백** (§6이 "T-001 실행 후 실측값으로 재검토한다"고 명시한 항목):
부트스트랩 경로 실측 12,954자는 임계값의 161.9%다. 다만 이는 §6 명세를 초과 투입한 결과이며,
`ARCHITECTURE RULES` 발췌와 `RELATED DECISIONS` 링크+요약 규정을 지키면 약 4,000~4,500자로 추정된다.
**따라서 현재 근거로는 8,000자 임계값을 올릴 이유가 없다.** T-002 이후 실제 `bcos task show` 출력이
나오면 그 값으로 재확정한다.

**다음 Task에서 반드시 비교해야 할 지표**

| 지표 | T-001 Baseline | T-002에서 확인할 것 |
|---|---:|---|
| 실제 읽은 파일 수 | 5 (자기보고) | 저장소가 커져도 유지되는가 — **감사 가능한 로그 확보 후 측정** |
| Read Scope Ratio | 27.8% (5/18) | 분모가 커질 때 비율이 실제로 떨어지는가 |
| Context Package 문자수 | N/A (미구현) | `bcos task show` 실측 — 8,000자 임계값 재확정 |
| AC Pass Rate | 100% (9/9) | 통합 지점이 있는 Task에서도 유지되는가 |
| 첫 Review 통과 | Yes | 1회 통과가 재현되는가, 아니면 T-001이 쉬웠을 뿐인가 |
| Out of Scope 침범 | 0 | 기존 코드 수정이 필요한 Task에서도 0인가 |
| Ponytail Violation | 0 | 추상화 유혹이 실재하는 Task에서도 0인가 |
| Human 승인 횟수 | 2 (환경만) | 내용 개입이 0으로 유지되는가 |
| Report / 구현 LOC 비율 | 1.78 | Task가 커질 때 이 오버헤드가 줄어드는가 |
