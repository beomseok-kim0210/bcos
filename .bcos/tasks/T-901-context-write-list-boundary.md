---
protocol: "0.1"
id: T-901
title: Accept the symmetric Write List label as a Read List boundary
status: TODO
attempt: 0
created: 2026-08-13T13:30:00Z
updated: 2026-08-13T13:30:00Z
---

# T-901 — Context Write List Boundary

## Objective

**Context Package 파서가 Read List의 시작 라벨은 긴 형태를 받아주면서
종료 라벨은 짧은 형태만 아는 비대칭을 없앤다. 그 한 곳만 고친다.**

`src/context.ts`의 `readList()`는 두 정규식을 쓴다.

| 역할 | 현재 정규식 | `**읽기 허용 (Read List)**` | `**쓰기 허용 (Write List)**` |
|---|---|---|---|
| 시작 | `/^\*\*읽기 허용(?: \(Read List\))?\*\*/` | **인식 O** | — |
| 종료 | `/^\*\*(?:생성\|수정\|쓰기)\*\*/` | — | **인식 X** ← 결함 |

시작은 `(Read List)` 접미사를 허용하는데 **종료는 `**쓰기**` 같은 짧은 형태만 안다.**
대칭을 맞춰 `**쓰기 허용 (Write List)**`라고 쓰면 **종료가 발동하지 않고,
Write List 항목이 Read List로 흡수된다.**

Write List에는 **아직 만들지 않은 파일**이 들어 있는 것이 정상이므로,
흡수된 순간 파서는 그 파일을 "존재해야 할 읽기 대상"으로 요구하고 실패한다.

### 실제 재현 — T-016 attempt 1

```
telemetry workflow_exit_reason=protocol
telemetry stage_status=failed          (worker 단계, 230ms)
Read List file does not exist: src/benchmark.ts
```

**worker는 한 번도 spawn되지 않았다.** Codex는 실행조차 되지 않았고,
Context Package 조립 단계에서 workflow가 끝났다.

실측 — T-016의 Expected Files에서 Read List로 수집된 항목은 **16건**이다.
의도한 것은 **10건**이고, 나머지 6건이 Write List에서 흡수됐다.
그중 `src/benchmark.ts`와 T-016 Report는 **아직 존재하지 않는 신규 생성 대상**이다.

### 조사 결과 — 저장소 전체 실측

| 사실 | 실측 |
|---|---|
| `**쓰기 허용 (Write List)**` 형태를 쓴 Task | **T-016 하나뿐** |
| T-001~T-015 · T-900이 쓴 종료 라벨 | **전부 `**쓰기**`** (짧은 형태) |
| Read List 구간에 `**생성`/`**수정`/`**쓰기`로 시작하는 산문 | **0건** (전체 Task) |
| 기존 `task context` 테스트 | **20건** |

**따라서 이 수정은 기존 Task 어느 것의 파싱도 바꾸지 않는다.**
바뀌는 것은 지금까지 **거부되던 형태 하나가 받아들여지는 것**뿐이다.

**오류 메시지가 원인을 가리키지 않는다는 점도 사실이다** — 진짜 원인은 섹션 경계
미인식인데 메시지는 "Read List에 파일이 없다"고 말한다.
**그러나 이 Task는 메시지 체계를 손대지 않는다** (Out of Scope). 경계 인식만 고친다.

## Scope

### 1. 고치는 것 — 종료 경계 하나

`readList()`의 **종료 판정**이 짧은 형태와 긴 형태를 **모두** 인식하게 한다.

```
계속 인식해야 함 (기존)      새로 인식해야 함
  **생성**                    **쓰기 허용 (Write List)**
  **수정**
  **쓰기**
```

**시작 라벨 정규식은 건드리지 않는다.** 이미 대칭 형태를 받아준다.

### 2. 넓히지 않는다

**"굵은 글씨로 시작하는 줄은 전부 경계"** 같은 일반화를 하지 않는다.
Read List 구간에는 설명 산문이 정상적으로 존재한다 — 예를 들어 T-016의
`**여기 없는 파일은 읽지 않는다.**`. 이런 줄을 경계로 오인하면
**Read List가 조용히 잘려 새로운 결함이 된다.**

인식 대상은 **`생성` · `수정` · `쓰기`로 시작하는 라벨로 한정한다.**

### 3. 바뀌지 않아야 하는 것

`readList()`가 항목을 모으는 방식 — `- ` 로 시작하는 줄, 첫 백틱 경로,
뒤따르는 주석 — 은 **그대로다.**

`isForbidden` · 경로 traversal 거부 · 중복 제거 · 크기 상한 · 바이너리 거부 ·
파일 수·문자 수·줄 수 계수 · 출력 바이트 — **전부 그대로다.**

**Read List가 비었을 때와 라벨이 없을 때의 오류도 그대로다.**

### 4. 왜 T-016을 고치지 않는가

T-016은 `TASK_STARTED` 이후 **본문이 동결**됐다 (RFC-001 §2.3).
§2.3은 *"동결 후 명세 결함을 고치려고 원본을 수정하지 않는다"* (**MUST NOT**)고 못박는다.

**T-016의 의미는 처음부터 옳았다.** 파서가 그 표기를 몰랐을 뿐이다.
따라서 Amendment도 필요 없다 — 정정할 명세 내용이 없다.

**이 Task는 T-016을 읽되 수정하지 않는다.** 실제 실패 형태를 테스트 근거로 쓰기 위해서다.

### 5. 이 Task가 만들지 않는 것

`src/context.ts` 한 파일의 **정규식 하나**가 바뀌는 문제다.
**새 파서·새 모듈·새 유틸·새 추상화를 만들지 않는다.**

## Out of Scope

- 범용 Markdown 파서 · Expected Files 스키마 재설계 · 새 parser framework
- 새 source module · regex utility 추상화
- **오류 메시지 체계 개편 · error taxonomy 재설계**
- RFC-001 변경 · Amendment 작성
- **T-016 수정** (본문 동결) · T-016 unblock · T-016 attempt 2
- block/unblock CLI 구현 (Known Product Gap으로 남긴다)
- benchmark 구현 · T-017 생성
- `CLAUDE.md` · `AGENTS.md` · `README` · `docs/` 변경
- 의존성 추가

## Acceptance Criteria

1. `**쓰기 허용 (Write List)**`가 Read List의 **종료 경계로 인식된다.**
2. `**생성**` · `**수정**` · `**쓰기**`는 **이전과 동일하게** 종료 경계로 동작한다.
3. T-016의 **현재 Expected Files 실제 형태**에서 Read List 결과가
   **의도한 기존 파일 10건으로 끝난다.**
4. 그 결과에 Write List의 신규 대상인 `src/benchmark.ts`와
   `.bcos/reports/T-016-benchmark-trial-record.md`가 **포함되지 않는다.**
5. Read List 구간의 설명 산문(`**여기 없는 파일은 읽지 않는다.**` 등)은
   **경계로 오인되지 않는다** — 그 뒤의 항목이 계속 수집된다.
6. 기존 보호가 그대로다 — forbidden 경로 · 상위 경로/절대 경로 거부 ·
   중복 제거 · 크기 상한 · 바이너리 거부.
7. Read List 라벨 누락·빈 Read List의 **오류 동작이 그대로다.**
8. `src/context.ts` 외 production source 변경이 **0줄**이다.
9. 의존성 추가가 **0건**이다.
10. 기존 테스트 **272개가 전부 통과**한다.
11. `npm run build`가 exit 0이다.
12. `src/context.ts` ≤ 170줄.

## Expected Files

**수정**

- `src/context.ts` — `readList()`의 종료 경계 판정 한 곳
- `tests/cli.test.ts` — 신규 테스트

**생성**

- `.bcos/reports/T-901-context-write-list-boundary.md`

**읽기 허용 (Read List)**

- `AGENTS.md`
- `.bcos/tasks/T-901-context-write-list-boundary.md` (이 파일)
- `src/context.ts`
- `tests/cli.test.ts`
- `.bcos/tasks/T-016-benchmark-trial-record.md` — **실패 재현 근거. 읽기 전용, 수정 금지**
- `package.json`

**쓰기**

위 "수정"·"생성" 목록뿐이다. **`.bcos/tasks/`와 `docs/`는 쓰지 않는다.**

## Test Requirements

**모든 테스트는 `node:test`.** 새 test framework·assertion 라이브러리를 추가하지 않는다.
기존 `contextBody()` 픽스처 헬퍼를 재사용한다 — **새 헬퍼를 만들지 않는다.**

**T1. 새 경계 인식 (AC 1)**
- `**쓰기 허용 (Write List)**` 뒤의 항목이 Read List에 **포함되지 않음**

**T2. 기존 경계 회귀 (AC 2)**
- `**생성**` · `**수정**` · `**쓰기**` 각각 **독립 케이스**로 종료 확인

**T3. Real-shape 재현 (AC 3–4) — 필수**
- **합성 픽스처만으로 채우지 않는다.**
- 실제 `.bcos/tasks/T-016-benchmark-trial-record.md`를 **복사한** 픽스처를 쓴다
  (T-900의 "실제 Task 복사" 선례와 동일).
- Read List가 **정확히 10건**이고 `src/benchmark.ts`가 **없음**을 단언한다.
- **원본 T-016을 읽기만 하고 수정하지 않는다.**

**T4. 산문 오인 방지 (AC 5)**
- Read List 중간에 `**…**` 산문 줄을 넣고, **그 뒤 항목이 계속 수집됨**을 확인
- 이것이 없으면 "굵은 줄은 전부 경계" 구현이 통과해 버린다

**T5. 기존 보호 회귀 (AC 6–7)**
- 기존 20건이 이미 덮는다. **새로 중복 작성하지 않는다.**
- 한 픽스처가 여러 규칙을 동시에 위반하게 만들지 않는다 (T-900 교훈)

**개수를 미리 약속하지 않는다.** 위 계열을 덮는 데 필요한 만큼 쓴다.
**기존 272개는 전부 유지되어야 한다** (AC 10).

## Notes

**예상 production diff는 한 줄 남짓이다.** 정규식 하나의 대안 추가다.
그보다 커지면 범위를 벗어난 것이므로 멈추고 보고한다.

**이 Task는 T-016을 뚫기 위한 것만이 아니다.** 시작 라벨과 종료 라벨의 비대칭은
대칭 형태를 쓰는 **다음 작성자도 똑같이 걸리는 함정**이다.
T-016 attempt 1이 그 함정의 첫 실측 사례다.

**남는 Known Product Gap — 이 Task에서 해결하지 않는다.**

1. **`block`/`unblock` CLI가 없다.** RFC-001 §1.2는 두 전이를 모두 정의하지만
   현재 CLI에는 command가 없어 T-016의 `IN_PROGRESS → BLOCKED`를
   **수동으로** 적용해야 했다. 정상 운영 경로가 아니다.
2. **오류 메시지가 원인을 지목하지 않는다.** `Read List file does not exist: …`는
   증상이고, 원인은 종료 라벨 미인식이다. 이 Task는 경계 인식만 고친다.

**T-016 복귀 경로 — 이 Task의 책임이 아니다.**
T-901이 APPROVED/DONE된 뒤 Human이 T-016을 `BLOCKED → TODO`로 unblock하고
**attempt 2**로 다시 시작한다. attempt 1은 실패 증거로 그대로 보존된다.
