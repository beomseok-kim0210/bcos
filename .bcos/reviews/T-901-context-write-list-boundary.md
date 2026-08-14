---
task: T-901
---

# Review — T-901

## Attempt 1 — 2026-08-13T14:41:00Z — APPROVED

Reviewer: `claude-code` (worker `codex-cli`와 다름 — G5 충족)

**Worker Report의 주장을 근거로 삼지 않았다.** 아래 모든 판정은 Reviewer가
저장소와 빌드된 코드에서 직접 재현한 값이다. 파일 개수는 Context Package 본문
문자열이 아니라 **파서가 낸 `--- FILE n/m: ---` 헤더**로 측정했다.

### Criteria Assessment

| AC | 판정 | 근거 (Reviewer 실측) |
|---|---|---|
| 1 | **PASS** | 실제 CLI 재현 — `**쓰기 허용 (Write List)**` 뒤 항목이 제외됨. `files=[one.txt]` |
| 2 | **PASS** | 3형태 **각각 독립** 재현 — `**생성**` `**수정**` `**쓰기**` 모두 `files=[one.txt]` |
| 3 | **PASS** | 저장소에서 `task context T-016` 실행 → **FILE 헤더 정확히 10건** |
| 4 | **PASS** | 그 10건에 `src/benchmark.ts` **0건**, `.bcos/reports/` **0건** |
| 5 | **PASS** | bold 산문 4종(`**여기 없는…**` 포함) 투입 → 뒤 항목 계속 수집, `files=2` |
| 6 | **PASS** | diff hunk **1개**가 `readList()` 안에만 존재. `isForbidden`·크기·바이너리·traversal·dedup 관련 변경 **0줄**. 추가로 traversal·절대경로·`.env`·중복 제거를 **직접 재현** — 전부 기존대로 거부/제거 |
| 7 | **PASS** | 라벨 누락 → `Read List label is missing`, 빈 목록 → `Read List is empty` **직접 재현** |
| 8 | **PASS** | `git diff --name-only -- src/` = `src/context.ts` **1개뿐** |
| 9 | **PASS** | `package.json`·`package-lock.json` 변경 **0개** |
| 10 | **PASS** | 테스트 이름 대조 — 기존 272건 **삭제·개명 0건**, 신규 6건. Reviewer 독립 실행 **278/278 pass** |
| 11 | **PASS** | Reviewer 독립 `npm run build` **exit 0** |
| 12 | **PASS** | `src/context.ts` **165줄** (상한 170) |

**집계 — PASS 12 · FAIL 0 · SUPERSEDED 0**

### Independent Verification

**Production diff — 실측 1 logical line**

```diff
-    if (/^\*\*(?:생성|수정|쓰기)\*\*/.test(line)) break;
+    if (/^\*\*(?:생성|수정|쓰기(?: 허용 \(Write List\))?)\*\*/.test(line)) break;
```

`git diff --check` exit 0. hunk 1개. 더 넓은 parser rewrite **없음**.

**Reviewer 재현 결과 — 실패 0건**

```
A. **생성** / **수정** / **쓰기**        → 각각 종료  PASS
B. **쓰기 허용 (Write List)**            → 종료        PASS
C. bold 산문 4종                          → 비경계      PASS
D. T-016 실제 형태                        → 10건 정확   PASS
   src/benchmark.ts · Report              → 미흡수      PASS
F. 라벨누락·빈목록·traversal·절대경로
   ·.env·중복                             → 기존대로    PASS
```

**Reviewer 독립 회귀**

```
npm run build → exit 0
npm test      → tests 278 · pass 278 · fail 0 · skipped 0 · todo 0
```

**실행 이력 — 실패가 보존되어 있다**

| RunRecord | 결과 | stages |
|---|---|---|
| `…T140601178Z-34c6d809` | `failed / verification` (exit 1) | start=success worker=success report_check=success **verification=failed** |
| `…T141459509Z-b15aa298` | `success / success` (exit 0) | **start=skipped** worker=success report_check=success verification=success submit=success |

`TASK_STARTED` **1건** · `TASK_SUBMITTED` **1건** · attempt **1**.
실패 RunRecord는 **삭제되지 않았고** 성공 RunRecord와 별도로 존재한다.
`start=skipped`가 attempt 증가 없이 같은 attempt에서 재개됐음을 증명한다.

### Findings

**BLOCKING 0 · MAJOR 0 | MINOR 2 · INFO 2**

**M-1 (MINOR) — Report append-only 위반: 1차 Report가 덮어써졌다**

RFC-001 §3은 *"**Append-only.** 재제출 시 기존 내용을 **MUST NOT** 수정하고
새 항목을 파일 끝에 추가한다"*고 규정한다.

실측 — 1차 실행(14:06:01~14:13:33)에서 `report_check=success`였으므로
그 시점에 Report가 **존재했다.** 그러나 현재 파일의 유일한 `## Attempt 1` 헤딩은
**`14:19:00Z`** 로, 2차 실행(14:14:59~14:21:09) 중에 쓰인 것이다.
**1차 Report 원문은 남아 있지 않다.**

**다만 실질 증거는 소실되지 않았다.** 권위 있는 실패 기록은 RunRecord에 그대로 있고,
현재 Report는 오히려 그 실패를 명시적으로 적고 있다(F-1 참조).

**근본 원인은 worker의 부주의라기보다 RFC의 공백으로 보인다** — §3은
*"본문은 attempt마다 다음 항목을 가진다"*로 **attempt 1건 = Report 항목 1건**을 전제하는데,
T-014가 연 재개 경로는 **한 attempt 안에서 worker가 여러 번 실행될 수 있게** 만들었다.
같은 attempt에 두 번째 블록을 추가하는 것 역시 §3의 "attempt마다" 서술과 어긋나므로,
**worker에게 규정을 지키면서 append할 방법이 없었다.** → I-1로 분리해 기록한다.

BLOCKING으로 올리지 않는 이유 — 코드 정확성과 무관하고, 감사에 필요한 실패 사실이
RunRecord와 현재 Report 양쪽에 보존되어 있다.

**M-2 (MINOR) — 비대칭이 완전히 해소되지는 않았다**

Objective는 *"비대칭을 없앤다"*고 서술하지만, 실제로 열린 것은 **긴 형태 하나**다.

| 폼 | 시작 라벨 | 종료 라벨 |
|---|---|---|
| 짧은 형태 | `**읽기 허용**` **인식 O** | `**쓰기**` 인식 O |
| 중간 형태 | — | `**쓰기 허용**` **인식 X** ← 남은 함정 |
| 긴 형태 | `**읽기 허용 (Read List)**` 인식 O | `**쓰기 허용 (Write List)**` 인식 O (신규) |

Reviewer 직접 재현 — `**쓰기 허용**`은 **여전히 종료하지 않는다**(`files=[one.txt,two.txt]`).
시작 라벨은 `(Read List)` 접미사가 **선택적**이므로, 짧은 `**읽기 허용**`이 동작하는 것을 본
작성자가 대칭으로 `**쓰기 허용**`을 쓰면 **T-016과 똑같은 방식으로, 똑같이 오도하는
오류 메시지와 함께 실패한다.**

**AC 위반은 아니다.** AC 1은 `**쓰기 허용 (Write List)**`만 요구하고 그것은 충족됐다.
Contract가 범위를 그렇게 좁혔으므로 이번 Verdict를 막지 않는다.
다만 *"함정을 없앴다"*고 말하려면 남은 폼이 있다는 사실을 기록해 둔다.

**I-1 (INFO) — RFC §3에 "한 attempt 안의 재실행" 규정이 없다**

M-1의 근본 원인. T-014의 검증실패 재개 경로가 만든 새 상황을 §3이 다루지 않는다.
**이 Task에서 고칠 문제가 아니다**(RFC 변경은 Out of Scope). Human이 §3 개정 여부를
판단할 사안으로 남긴다.

**I-2 (INFO) — 오류 메시지가 여전히 원인을 지목하지 않는다**

`Read List file does not exist: src/benchmark.ts`는 증상이고 원인은 경계 미인식이다.
**Contract가 명시적으로 Out of Scope로 선언했으므로 결함으로 잡지 않는다.**
M-2의 남은 폼에 걸리는 사람도 같은 오해를 겪게 된다는 점만 기록한다.

### Report 정직성 평가

**숨기지 않았다.** Report는 다음을 스스로 적고 있다.

- 1차 Host Verification 실패 — `tests 278 / pass 277 / fail 1`과 실패한 테스트 이름·단언
- 실패가 **새로 추가한 자기 테스트의 픽스처 오류**였다는 사실
- 같은 attempt에서 픽스처를 고쳤다는 사실
- worker 샌드박스의 `spawn EPERM`으로 전체 재실행을 완료하지 못했다는 사실
- Known Risks: *"수정 후 전체 278개를 한 번에 통과한 Host Verification 결과는 아직 없다.
  독립 reviewer/host가 `npm test`를 다시 실행해야 한다."*

**"처음부터 모두 통과"로 읽히게 쓰지 않았다.** 오히려 Host 재검증이 필요하다고
스스로 요구했고, Reviewer가 그것을 수행해 278/278을 확인했다.
`spawn EPERM`을 성공으로 포장하지 않은 점도 정확하다.

Report의 `tests 278 / pass 277 / fail 1` 수치는 1차 RunRecord의
`verification_exit_code: 1`과 **일치**한다 — 조작 흔적 없음.

### Scope · Ponytail

| 항목 | 실측 |
|---|---|
| `src/context.ts` 외 production 변경 | **0** |
| 새 source module · 추상화 · regex 유틸 | **0** (신규 함수 선언 0건, 기존 `contextBody()` 재사용) |
| 새 의존성 | **0** |
| 범용 Markdown 파서 · label registry · schema version | **없음** |
| Expected Files 재설계 · error taxonomy 개편 | **없음** |
| block/unblock CLI | **없음** (Known Gap 유지) |
| T-016 수정 | **diff 0줄** — 실제 파일을 읽어 임시 픽스처로 복사만 함 |
| Amendment · T-017 | **0건** |
| README · docs · RFC · CLAUDE.md · AGENTS.md | **무변경** |

**Ponytail 판정 — 위반 없음.**

더 작은 대안을 검토했다. `/^\*\*(?:생성|수정|쓰기)/`처럼 접미사를 통째로 버리면
문자는 줄지만 **`**쓰기 목록은…**` 같은 산문을 경계로 오인**해 Contract §2가 금지한
과잉 일반화가 된다. `(?: 허용 \(Write List\))?`를 그룹 밖으로 빼는 변형은 길이가 같으면서
`**생성 허용 (Write List)**` 같은 무의미 조합까지 허용한다.
**현재 1 logical line보다 의미 있게 더 작은 대안은 없다.**

테스트 83줄도 과다가 아니다 — 6건이 각각 **다른 회귀**를 증명한다
(대칭 경계 · 짧은 3형태 **각각 독립** · 산문 비경계 · 실제 T-016 복사본).
Contract Test Requirements T2가 "각각 독립 케이스"를 명시적으로 요구했고,
real-shape 테스트는 실제 `.bcos/tasks/T-016-…md`를 읽어 픽스처로 복사한다(T3 충족).
중복이나 불필요한 추상화는 발견되지 않았다.

### Verdict

**APPROVED**

AC 12개 전부 PASS, BLOCKING·MAJOR 0건. Production 변경은 실측 1 logical line이고
기존 272 테스트가 하나도 사라지지 않은 채 278/278이 Reviewer 독립 실행에서 통과했다.
T-016의 실제 형태가 의도한 10건으로 정확히 파싱되며 신규 생성 대상은 흡수되지 않는다.

MINOR 2건은 이번 변경의 정확성을 훼손하지 않는다. **M-1은 이 Task에서 고칠 수 없다** —
Report는 worker 소유이고 Reviewer가 수정하지 않으며, 근본 원인은 RFC의 공백(I-1)이다.
**M-2는 Contract가 명시적으로 범위를 좁힌 결과이므로 계약 위반이 아니다.**
두 건 모두 후속 Human 판단 사항으로 남긴다.
