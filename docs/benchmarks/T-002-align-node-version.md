# T-002 Benchmark

**작은 유지보수 Task의 두 번째 기준선.**
T-001(스캐폴드 생성)과 난이도·성격이 다르므로 **개선율을 계산하지 않는다.**
두 기준선은 향후 비교 가능한 Task가 쌓였을 때의 참조점일 뿐이다.

값의 종류를 반드시 구분한다 — **Measured**(직접 관측) · **Derived**(관측값에서 계산) ·
**Estimated**(추정, 근거 명시) · **N/A**(수집 불가).

| 항목 | 값 |
|---|---|
| Task | T-002 — Align minimum Node version with tested environment |
| Protocol | 0.1 (Experimental) |
| Worker | `codex-cli` |
| Reviewer | `claude-code` |
| Reviewer 환경 | Node v24.11.1, Windows 10 |

---

## 1. Context

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| Worker Prompt Characters (본문) | 3,170 | Measured | `---` 사이 본문, 코드포인트 수 |
| Worker Prompt Characters (파일 전체) | 3,326 | Measured | 파일 전체 코드포인트 수 |
| Worker Prompt Lines (본문) | 128 | Measured | 본문 개행 수 |
| Worker Prompt Lines (파일 전체) | 135 | Measured | `wc -l` |
| Task Specification Characters | 2,881 | Measured | `.bcos/tasks/T-002-align-node-version.md` |
| Estimated Tokens (프롬프트 본문) | 793 | **Estimated** | 문자수 ÷ 4. **tokenizer 미사용** |
| Worker 자기보고 Files Read | 7 | Measured (자기보고) | Report `Context Used`. **독립 검증 불가** |
| Task Read List 항목 수 | 6 | Measured | Task `Expected Files` §읽기 허용 |
| Read List 밖 읽은 파일 수 | 1 | Measured (자기보고) | `.bcos/prompts/T-002-codex-prompt.md` |
| 현재 tracked repository 파일 수 | 29 | Measured | `git ls-files \| wc -l` |
| **Read Scope Ratio** | **24.1%** | Derived | 7 / 29 |

**해석 주의**

`Files Read: 7`은 **worker 자기보고이며 감사 로그가 없다.** 반증되지 않았을 뿐 입증되지도 않았다.
T-001(27.8%, 5/18)과 수치를 나란히 두는 것은 가능하지만, **분모(저장소 크기)와 Task 성격이
모두 달라 개선으로 해석해서는 안 된다.** 이 비율이 의미를 갖는 시점은 동종 Task가 3건 이상
쌓인 뒤다.

Read List 밖 1건은 **실행 프롬프트 자신**이다. 프롬프트를 읽지 않으면 지시를 받을 수 없으므로
불가피하며, Task 설계 측 갭이다(Review F-4). T-001에서도 동일하게 발생했다.

---

## 2. Quality

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| AC total | 11 | Measured | Task `Acceptance Criteria` |
| AC passed | 11 | Measured | reviewer 독립 재현 |
| AC failed | 0 | Measured | — |
| **AC Pass Rate** | **100.0%** | Derived | 11 / 11 |
| Tests total | 3 | Measured | `node:test` |
| Tests passed | 3 | Measured | `pass 3 / fail 0` |
| **Test Pass Rate** | **100.0%** | Derived | 3 / 3 |
| Test duration | 417.5 ms | Measured | reviewer 재실행 |
| Build result | SUCCESS | Measured | `tsc` exit 0, `dist/cli.js` 생성 |
| First Review verdict | APPROVED | Measured | `.bcos/reviews/T-002-align-node-version.md` |
| Rework required | No | Measured | attempt 1에 승인 |
| Attempt | 1 | Measured | — |
| **Scope Violations** | **0** | Measured | Expected Files 밖 변경 0, Out of Scope 침범 0 |
| **Ponytail Violations** | **0** | Measured | Review §Approval Rationale 4 |

**Scope Violation 0의 의미가 T-001보다 강하다.** T-002의 Out of Scope에는
"테스트 파일을 `.js`로 바꾸면 Node 22를 살릴 수 있다", "`@types/node`가 낡았다" 같은
**실제로 타당한 유혹**이 명시돼 있었고, worker는 하나도 실행하지 않았다.
범위 이탈 방지 장치가 "할 일이 없어서"가 아니라 "억제해서" 작동한 첫 사례다.

---

## 3. Change Size

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| 제품 수정 파일 수 | 2 | Measured | `package.json`, `README.md` |
| 전체 변경 파일 수 (Report 포함) | 3 | Measured | `git status --short` |
| **실제 제품 변경 줄 수** | **2** | Measured | `git diff --shortstat` = +2 / −2 |
| Report LOC | 105 | Measured | `wc -l` |
| Report / 제품 LOC 비율 | 52.5 | Derived | 105 / 2 |
| runtime dependencies | 0 | Measured | `dependencies` 키 부재 |
| devDependencies | 2 | Measured | `@types/node`, `typescript` |
| 새 dependency 수 | 0 | Measured | 버전 문자열도 무변경 |

**Report/제품 비율 52.5는 이 지표의 한계를 보여준다.** T-001은 1.78이었다.
2줄 변경에 6개 명령의 출력 전문을 요구했으므로 비율이 커지는 것은 당연하며,
**작은 Task일수록 이 지표는 무의미해진다.** 향후 이 비율은 동종 규모 Task끼리만 비교한다.

---

## 4. Reliability

| 지표 | 값 | 종류 | 근거 |
|---|---:|---|---|
| PowerShell execution policy failure | 1 | Measured | `npm.ps1` 차단 → `cmd /c` 우회 |
| Sandbox EPERM failure | 1 | Measured | 첫 테스트 실행 `spawn EPERM` |
| **Code failures** | **0** | Measured | 구현 결함으로 인한 실패 없음 |
| **Environment failures** | **2** | Derived | PowerShell 1 + sandbox 1 |
| Human approvals | N/A | **N/A** | Report에 승인 횟수 기록 없음. **추정하지 않는다** |
| Human 내용 개입 | 0 | Measured (자기보고) | Deviations에 지시 변경 기록 없음 |
| 최종 재현 성공 | Yes | Measured | reviewer가 `dist/` 삭제 후 전 과정 재실행, 재시도 없이 통과 |

**환경 실패 2건은 T-001의 3건과 같은 계열이다** — PowerShell 실행 정책과 sandbox 권한.
둘 다 코드와 무관하며 재실행으로 해소됐다. 반복되므로 환경 설정으로 제거할 가치가 있다.

`Human approvals`는 Report에 기록이 없어 **N/A로 둔다.** T-001은 2회였으나
T-002를 같은 값으로 추정하지 않는다. 향후 Report 포맷에 이 항목을 넣을지는 별도 결정이다.

---

## 5. 두 기준선 병기

**개선율을 계산하지 않는다.** Task 성격이 다르다 — T-001은 신규 생성, T-002는 2줄 수정이다.

| 지표 | T-001 (scaffold) | T-002 (maintenance) |
|---|---:|---:|
| Worker Prompt (본문 chars) | 2,953 | 3,170 |
| Files Read (자기보고) | 5 | 7 |
| tracked 파일 수 (분모) | 18 | 29 |
| Read Scope Ratio | 27.8% | 24.1% |
| 제품 변경 줄 수 | 87 | 2 |
| Report LOC | 155 | 105 |
| AC Pass Rate | 100% (9/9) | 100% (11/11) |
| Test Pass Rate | 100% (3/3) | 100% (3/3) |
| Scope Violations | 0 | 0 |
| Ponytail Violations | 0 | 0 |
| Rework | 0 | 0 |
| Environment failures | 3 | 2 |
| Code failures | 0 | 0 |

**Read Scope Ratio가 27.8% → 24.1%로 낮아졌으나 이를 개선으로 주장하지 않는다.**
분모가 18에서 29로 커진 효과가 섞여 있고, 읽은 파일 수 자체는 5에서 7로 늘었다.
**비율 하락의 원인이 컨텍스트 규율인지 저장소 성장인지 현재 데이터로 분리할 수 없다.**

---

## 6. 지금 쓸 수 있는 사실

- 두 번째 Task도 **1회 시도에 승인**됐다. AC 11/11, 테스트 3/3을 독립 리뷰에서 재현했다.
- **범위 이탈 0건이 유혹이 실재하는 조건에서 재현됐다.** Out of Scope에 명시된
  타당한 대안 3가지를 worker가 모두 억제했다.
- 제품 변경 2줄, 런타임 의존성 0 유지, 신규 의존성 0.

## 7. 아직 쓸 수 없는 주장

- **"컨텍스트 N% 절감"** — 비교군이 없고 Read Scope Ratio 변화에 분모 효과가 섞여 있다.
- **"개발 속도 향상"** — 시간을 측정하지 않았다(시작 시각 로그 부재).
- **"비용 절감"** — 비교 대상 워크플로를 측정한 적이 없다.
- **"Production-ready"** — 구현된 명령이 `--version`·`--help` 둘뿐이다.

## 8. 다음 Task에서 확보할 것

| 항목 | 현재 문제 | 필요한 것 |
|---|---|---|
| Files Read | 자기보고, 검증 불가 | 감사 가능한 기록 수단 |
| Worker Time | 시작 시각 로그 부재 | 전이 이벤트의 실시간 기록 = `bcos` CLI |
| Human approvals | Report에 항목 없음 | Report 포맷 결정 |
| Read Scope Ratio | 분모 효과와 규율 효과가 미분리 | 동종 규모 Task 3건 이상 |
