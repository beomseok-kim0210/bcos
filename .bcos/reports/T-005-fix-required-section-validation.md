---
task: T-005
---

# Report — T-005

## Attempt 1 — 2026-08-04T07:30:18Z

### Implemented
필수 heading을 문서 순서대로 찾고, 각 heading 줄 끝부터 다음 임의의 `## ` heading 또는 파일 끝까지 본문을 잘라 `trim()` 후 검증하도록 `hasRequiredSections()`를 수정했다. 표준 Markdown 공백과 다중 문단·목록·표·코드 블록을 허용하고, 빈 본문·placeholder·누락·순서 오류를 쓰기 전에 거부하는 격리 테스트를 추가했다.

### Files Changed
- src/cli.ts (modified)
- tests/cli.test.ts (modified)
- .bcos/reports/T-005-fix-required-section-validation.md (new)

### Test Evidence

`npm run build`

```text
> bcos@0.1.0 build
> tsc

Exit code: 0
```

`npm test`

```text
> bcos@0.1.0 test
> node --test tests/cli.test.ts

✔ --version prints the package version (87.6605ms)
✔ --help prints usage (77.4266ms)
✔ an unknown argument fails with an error (81.353ms)
✔ task start updates frontmatter and preserves the body (99.0817ms)
✔ task start appends an eight-field event (96.3527ms)
✔ task start recalculates state (105.7039ms)
✔ a missing Task changes no files (89.6419ms)
✔ a non-TODO Task changes no files (114.2649ms)
✔ an existing IN_PROGRESS Task changes no files (104.0467ms)
✔ an empty required section changes no files (87.891ms)
✔ a missing actor id changes no files (85.1854ms)
✔ task start accepts one blank line after headings (96.9576ms)
✔ task start accepts multiple blank lines after headings (117.5802ms)
✔ task start accepts multiple paragraphs (102.252ms)
✔ task start accepts a section that starts with a list (92.1888ms)
✔ task start accepts a table in a section (90.0533ms)
✔ task start accepts a code block in a section (110.1264ms)
✔ task start accepts a T-004-style Task fixture (90.1331ms)
✔ a whitespace-only section before an extra H2 changes no files (97.4915ms)
✔ a TODO-only section changes no files (85.1971ms)
✔ a TBD-only or placeholder-only section changes no files (179.8821ms)
✔ a missing required heading changes no files (87.0935ms)
✔ required headings out of order change no files (90.2802ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2452.6473

Exit code: 0
```

T-004 형식 fixture 및 공백-only fixture 실행 결과 (`npm test` 출력에서 발췌):

```text
✔ task start accepts a T-004-style Task fixture (90.1331ms)
✔ a whitespace-only section before an extra H2 changes no files (97.4915ms)
```

`node dist/cli.js --version`

```text
0.1.0
Exit code: 0
```

`node dist/cli.js --help`

```text
Usage: bcos [--version | --help | task start <id> --actor-role <role> --actor-id <id>]
Exit code: 0
```

`node dist/cli.js foo`

```text
Unknown argument: foo
Exit code: 1
```

추가 제약 확인:

```text
package_lock_exists=False
src_cli_lines=159
```

### Deviations
전역 `bcos` 명령이 PATH에 없어 `bcos task show T-005`는 실행되지 않았다. 허용된 T-005 Task 파일을 직접 읽어 Context Package를 확인했으며, 이 부트스트랩 수정의 명세대로 실제 저장소의 `.bcos/` 상태 파일은 변경하지 않았다.

### Known Risks
None

### Context Used
- Files read: 8
- Outside Expected Files: 0
