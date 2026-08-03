# BCOS — Git Commit Convention

Git 이력은 작업 기록이 아니라 **Development Timeline**이다.
GitHub·오픈소스·포트폴리오·발표에서 그대로 읽히므로,
**커밋 하나만 봐도 무엇을 왜 했는지 이해할 수 있어야 한다.**

**과장하지 않는다. 사실만 쓴다.** "혁신적인", "최고의", "대폭 개선" 같은 표현은 금지한다.

---

## 1. 커밋 단위

- **하나의 커밋은 하나의 목적만 가진다.** RFC 작성 + README 수정 + CLI 구현을 한 커밋에 넣지 않는다.
- **너무 잘게 쪼개지도 않는다.** 오타·띄어쓰기·주석 하나마다 커밋하지 않는다.
- **논리적으로 하나의 작업 단위가 끝났을 때** 커밋한다.
- **문서 작업과 코드 작업을 분리한다.** `docs(rfc)` → `docs(adr)` → `feat(cli)` 순서가 좋다.
- **역할별로 분리한다.** manager의 문서 변경은 `docs`, worker의 구현은 `feat`/`refactor`.
- RFC·ADR·Architecture·Vision·Roadmap은 각각 별도 커밋이 가능하다.
  **같은 주제라면 하나로 합쳐도 된다.**

## 2. 형식

```
<type>(<scope>): <subject>

<body>

<trailer>
```

### Type

| Type | 용도 | | Type | 용도 |
|---|---|---|---|---|
| `feat` | 새로운 기능 | | `perf` | 성능 개선 |
| `fix` | 버그 수정 | | `style` | 포맷팅 |
| `docs` | 문서 | | `build` | 빌드 |
| `refactor` | 리팩터링 | | `ci` | CI/CD |
| `test` | 테스트 | | `chore` | 프로젝트 관리 |
| | | | `revert` | 되돌리기 |

### Scope

가능하면 쓴다 — `cli` `rfc` `adr` `architecture` `vision` `roadmap` `worker` `runtime` `memory` `protocol`

### Subject

한 줄, 50~72자, **명령형**, 마침표 없음, 영문.

```
docs(rfc): define initial task protocol
feat(cli): add scaffold command
docs(adr): introduce task-centric worker architecture
refactor(worker): simplify worker lifecycle
```

### Body

**필요할 때만 쓴다.** 쓴다면 Why / What / Impact를 담는다.

```
Why
Task ownership was previously ambiguous.

What
Introduced ADR-003 describing task-centric workers.

Impact
Future worker templates can share the same protocol.
```

### Metrics

**측정 가능한 변경은 수치로 남긴다.** 추측값을 쓰지 않는다 — 실제로 잰 값만 적는다.

```
Metrics
- Files: +5
- LOC: +183
- Tests: 6 passed
- Context Package: 5,003 → 3,821 chars (-23.6%)
```

### Breaking Change

필요할 때만 body 끝에 `BREAKING CHANGE:` 로 명시한다.

### Trailer

Claude가 작성한 커밋에는 다음을 붙인다.

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 3. 커밋 절차 — 반드시 지킨다

> **커밋을 자동 실행하지 않는다.**
> **제안 → 사용자 승인 → `git commit`** 순서를 예외 없이 따른다.

### 제안 전 확인 (manager)

1. `git diff` 와 `git status` 를 실제로 본다
2. 변경 파일과 변경 목적을 대조한다
3. **논리적으로 하나의 커밋인지 판단한다.** 아니면 **여러 개로 분리할 것을 제안한다**

### 제안 형식

커밋 메시지를 만들면 **항상 영문과 한국어를 함께 출력한다.**

> **## English**
> `docs(adr): introduce task-centric worker architecture`
>
> **## 한국어**
> ADR-003에 Task-Centric Worker Architecture 결정을 추가

**한국어는 Git에 넣지 않는다.** 사용자 이해를 돕는 설명일 뿐이다.

### 커밋 후

**다음 추천 커밋을 함께 제안한다.** 예: 현재 `docs(rfc)` → 다음 `feat(cli)`.
이렇게 Timeline의 연속성을 유지한다.

---

## 4. worker는 git을 실행하지 않는다

`worker` 세션은 `git commit` / `git push` / `git checkout` 을 실행하지 않는다.
worker의 산출물은 **작업 트리의 변경과 Report**까지이며,
커밋은 manager가 제안하고 human이 승인·실행한다.

이유는 두 가지다. Rule 6(자동 커밋 금지)을 우회할 통로를 만들지 않기 위해서이고,
worker 세션이 소모품이므로 이력에 대한 책임을 질 수 없기 때문이다.
