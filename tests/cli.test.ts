import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

function run(...arguments_) {
  return spawnSync(process.execPath, [cli, ...arguments_], { encoding: "utf8" });
}

const requiredBody = `
## Objective
Build it.

## Scope
Start it.

## Out of Scope
Everything else.

## Acceptance Criteria
1. It starts.

## Expected Files
- src/cli.ts

## Test Requirements
Run tests.
`;

function taskContent(id, status = "TODO", body = requiredBody, attempt = 0) {
  return `---
protocol: "0.1"
id: ${id}
title: Test Task
status: ${status}
attempt: ${attempt}
created: 2026-08-04T00:00:00Z
updated: 2026-08-04T00:00:00Z
---
${body}`;
}

function fixture(tasks = [{ id: "T-001", status: "TODO", body: requiredBody }], events = "") {
  const directory = mkdtempSync(path.join(os.tmpdir(), "bcos-cli-"));
  const bcosDirectory = path.join(directory, ".bcos");
  const tasksDirectory = path.join(bcosDirectory, "tasks");
  const reportsDirectory = path.join(bcosDirectory, "reports");
  const reviewsDirectory = path.join(bcosDirectory, "reviews");
  mkdirSync(tasksDirectory, { recursive: true });
  mkdirSync(reportsDirectory, { recursive: true });
  mkdirSync(reviewsDirectory, { recursive: true });
  for (const task of tasks) {
    writeFileSync(
      path.join(tasksDirectory, `${task.id}-test-task.md`),
      taskContent(task.id, task.status, task.body, task.attempt),
      "utf8",
    );
    if (task.report !== undefined) {
      writeFileSync(
        path.join(reportsDirectory, `${task.id}-test-task.md`),
        task.report,
        "utf8",
      );
    }
    if (task.review !== undefined) {
      writeFileSync(
        path.join(reviewsDirectory, `${task.id}-test-task.md`),
        task.review,
        "utf8",
      );
    }
  }
  writeFileSync(path.join(bcosDirectory, "events.jsonl"), events, "utf8");
  writeFileSync(
    path.join(bcosDirectory, "state.json"),
    `${JSON.stringify({
      protocol: "0.1",
      version: 1,
      project: "test",
      branch: "main",
      counts: { TODO: tasks.length, IN_PROGRESS: 0, IMPLEMENTED: 0, DONE: 0, BLOCKED: 0 },
      current_task: null,
      updated: "2026-08-04T00:00:00Z",
    })}\n`,
    "utf8",
  );
  return directory;
}

function runStart(directory, ...extraArguments) {
  return spawnSync(
    process.execPath,
    [cli, "task", "start", "T-001", "--actor-role", "worker", "--actor-id", "codex-cli", ...extraArguments],
    { cwd: directory, encoding: "utf8" },
  );
}

function runSubmit(directory, ...arguments_) {
  return spawnSync(
    process.execPath,
    [cli, "task", "submit", "T-001", "--actor-role", "worker", "--actor-id", "codex-cli", ...arguments_],
    { cwd: directory, encoding: "utf8" },
  );
}

function runApprove(directory, actorId = "reviewer-a", actorRole = "reviewer", taskId = "T-001") {
  return spawnSync(
    process.execPath,
    [cli, "task", "approve", taskId, "--actor-role", actorRole, "--actor-id", actorId],
    { cwd: directory, encoding: "utf8" },
  );
}

function threeFiles(directory) {
  return [
    readFileSync(path.join(directory, ".bcos", "tasks", "T-001-test-task.md"), "utf8"),
    readFileSync(path.join(directory, ".bcos", "events.jsonl"), "utf8"),
    readFileSync(path.join(directory, ".bcos", "state.json"), "utf8"),
  ];
}

function bcosSnapshot(directory) {
  const rootDirectory = path.join(directory, ".bcos");
  const snapshot = {};
  function visit(currentDirectory) {
    for (const name of readdirSync(currentDirectory, { withFileTypes: true })) {
      const filePath = path.join(currentDirectory, name.name);
      if (name.isDirectory()) visit(filePath);
      else snapshot[path.relative(rootDirectory, filePath)] = readFileSync(filePath, "utf8");
    }
  }
  visit(rootDirectory);
  return snapshot;
}

function withFixture(callback, tasks, events) {
  const directory = fixture(tasks, events);
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function assertStartSucceeds(body) {
  withFixture((directory) => {
    const result = runStart(directory);
    assert.equal(result.status, 0, result.stderr);
  }, [{ id: "T-001", status: "TODO", body }]);
}

function assertStartFailsWithoutChanges(body) {
  withFixture((directory) => {
    const before = threeFiles(directory);
    const result = runStart(directory);
    assert.equal(result.status, 1);
    assert.deepEqual(threeFiles(directory), before);
  }, [{ id: "T-001", status: "TODO", body }]);
}

const actualT004Task = readFileSync(
  path.join(root, ".bcos", "tasks", "T-004-task-submit-command.md"),
  "utf8",
);
const actualRfc001 = readFileSync(
  path.join(root, "docs", "rfcs", "RFC-001-task-protocol.md"),
  "utf8",
);

function contextBody(items, label = "**읽기 허용 (Read List)**") {
  return `
## Objective
Build context.

## Scope
Read files.

## Out of Scope
Writes.

## Acceptance Criteria
1. It prints.

## Expected Files

**생성**

- \`ignored.txt\`

${label}

${items.join("\n")}

**쓰기**

- \`also-ignored.txt\`

## Test Requirements
Run tests.
`;
}

function contextFixture({
  id = "T-100",
  items = ["- `one.txt`", "- `two.txt` — second note"],
  files = { "one.txt": "first file\n", "two.txt": "두 번째 파일\n" },
  body = contextBody(items),
  status = "IN_PROGRESS",
  attempt = 3,
} = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "bcos-context-"));
  const tasksDirectory = path.join(directory, ".bcos", "tasks");
  mkdirSync(tasksDirectory, { recursive: true });
  writeFileSync(
    path.join(tasksDirectory, `${id}-context.md`),
    taskContent(id, status, body, attempt),
    "utf8",
  );
  writeFileSync(path.join(directory, ".bcos", "events.jsonl"), "event-before\n", "utf8");
  writeFileSync(path.join(directory, ".bcos", "state.json"), "state-before\n", "utf8");
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(directory, ...name.split("/"));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
  return directory;
}

function runContext(directory, taskId = "T-100") {
  return spawnSync(process.execPath, [cli, "task", "context", taskId], {
    cwd: directory,
    encoding: "utf8",
  });
}

function withContextFixture(callback, options) {
  const directory = contextFixture(options);
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function assertContextFailure(options) {
  withContextFixture((directory) => {
    const before = bcosSnapshot(directory);
    const result = runContext(directory);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.ok(result.stderr);
    assert.deepEqual(bcosSnapshot(directory), before);
  }, options);
}

test("--version prints the package version", () => {
  const result = run("--version");
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test("--help prints usage", () => {
  const result = run("--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test("an unknown argument fails with an error", () => {
  const result = run("foo");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown argument: foo/);
});

test("task start updates frontmatter and preserves the body", () => withFixture((directory) => {
  const before = threeFiles(directory)[0];
  const result = runStart(directory);
  const after = threeFiles(directory)[0];
  assert.equal(result.status, 0, result.stderr);
  assert.match(after, /^status: IN_PROGRESS$/m);
  assert.match(after, /^attempt: 1$/m);
  assert.equal(after.slice(after.indexOf("---", 3) + 3), before.slice(before.indexOf("---", 3) + 3));
}));

test("task start appends an eight-field event", () => withFixture((directory) => {
  assert.equal(runStart(directory).status, 0);
  const event = JSON.parse(threeFiles(directory)[1].trim());
  assert.deepEqual(Object.keys(event), ["ts", "event", "task", "attempt", "actor_role", "actor_id", "from", "to"]);
  assert.deepEqual({ ...event, ts: "ignored" }, {
    ts: "ignored", event: "TASK_STARTED", task: "T-001", attempt: 1,
    actor_role: "worker", actor_id: "codex-cli", from: "TODO", to: "IN_PROGRESS",
  });
  assert.equal(frontmatterValueForTest(threeFiles(directory)[0], "updated"), event.ts);
}));

test("task start recalculates state", () => withFixture((directory) => {
  assert.equal(runStart(directory).status, 0);
  const state = JSON.parse(threeFiles(directory)[2]);
  assert.deepEqual(state.counts, { TODO: 0, IN_PROGRESS: 1, IMPLEMENTED: 0, DONE: 0, BLOCKED: 0 });
  assert.equal(state.current_task, "T-001");
}));

function frontmatterValueForTest(content, key) {
  return new RegExp(`^${key}:\\s*(.+)$`, "m").exec(content)?.[1];
}

test("a missing Task changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  const result = spawnSync(process.execPath, [cli, "task", "start", "T-999", "--actor-role", "worker", "--actor-id", "codex-cli"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.ok(result.stderr);
  assert.deepEqual(threeFiles(directory), before);
}));

test("a non-TODO Task changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  assert.equal(runStart(directory).status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, [{ id: "T-001", status: "DONE", body: requiredBody }]));

test("an existing IN_PROGRESS Task changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  assert.equal(runStart(directory).status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, [
  { id: "T-001", status: "TODO", body: requiredBody },
  { id: "T-002", status: "IN_PROGRESS", body: requiredBody },
]));

test("an empty required section changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  assert.equal(runStart(directory).status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, [{ id: "T-001", status: "TODO", body: requiredBody.replace("Build it.", "TODO") }]));

test("a missing actor id changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  const result = spawnSync(process.execPath, [cli, "task", "start", "T-001", "--actor-role", "worker"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.deepEqual(threeFiles(directory), before);
}));

test("task start accepts one blank line after headings", () => {
  assertStartSucceeds(requiredBody.replaceAll("\nBuild it.", "\n\nBuild it."));
});

test("task start accepts multiple blank lines after headings", () => {
  assertStartSucceeds(requiredBody.replaceAll("\nBuild it.", "\n\n\nBuild it."));
});

test("task start accepts multiple paragraphs", () => {
  assertStartSucceeds(requiredBody.replace("Build it.", "First paragraph.\n\nSecond paragraph."));
});

test("task start accepts a section that starts with a list", () => {
  assertStartSucceeds(requiredBody.replace("Build it.", "- First item\n- Second item"));
});

test("task start accepts a table in a section", () => {
  assertStartSucceeds(requiredBody.replace(
    "Build it.",
    "| Input | Output |\n|---|---|\n| valid | accepted |",
  ));
});

test("task start accepts a code block in a section", () => {
  assertStartSucceeds(requiredBody.replace("Build it.", "```text\nexample\n```"));
});

test("task start accepts a T-004-style Task fixture", () => {
  const t004StyleBody = `
## Objective

Add the next transition to the CLI.

The transition must preserve the Task body.

\`\`\`text
bcos task submit T-100 --actor-role worker --actor-id codex-cli
\`\`\`

## Scope

- Parse the command arguments.
- Validate every guard before writing.

### Guards

Subheadings remain part of the section body.

## Out of Scope

- Approval commands
- A general CLI framework

## Acceptance Criteria

| Case | Expected |
|---|---|
| valid | exit 0 |
| invalid | exit 1 |

## Expected Files

- src/cli.ts
- tests/cli.test.ts

## Test Requirements

Run the built-in Node test runner.
`;
  assertStartSucceeds(t004StyleBody);
});

test("a whitespace-only section before an extra H2 changes no files", () => {
  assertStartFailsWithoutChanges(requiredBody.replace(
    "Build it.",
    "   \n\n## Notes\nContent in another section does not fill Objective.",
  ));
});

test("a TODO-only section changes no files", () => {
  assertStartFailsWithoutChanges(requiredBody.replace("Build it.", "TODO"));
});

test("a TBD-only or placeholder-only section changes no files", () => {
  for (const placeholder of ["TBD", "<placeholder>"]) {
    assertStartFailsWithoutChanges(requiredBody.replace("Build it.", placeholder));
  }
});

test("a missing required heading changes no files", () => {
  assertStartFailsWithoutChanges(requiredBody.replace("## Scope\nStart it.\n\n", ""));
});

test("required headings out of order change no files", () => {
  assertStartFailsWithoutChanges(requiredBody.replace(
    "## Objective\nBuild it.\n\n## Scope\nStart it.",
    "## Scope\nStart it.\n\n## Objective\nBuild it.",
  ));
});

const attemptOneReport = `---
task: T-001
---

## Attempt 1 — 2026-08-04T00:00:00Z

### Implemented
Test implementation.
`;

const submitTaskFixture = [{
  id: "T-001", status: "IN_PROGRESS", body: requiredBody, attempt: 1, report: attemptOneReport,
}];

test("task submit updates frontmatter without changing attempt or body", () => withFixture((directory) => {
  const before = threeFiles(directory)[0];
  const result = runSubmit(directory);
  const after = threeFiles(directory)[0];
  assert.equal(result.status, 0, result.stderr);
  assert.match(after, /^status: IMPLEMENTED$/m);
  assert.match(after, /^attempt: 1$/m);
  assert.equal(after.slice(after.indexOf("---", 3) + 3), before.slice(before.indexOf("---", 3) + 3));
}, submitTaskFixture));

test("task submit appends an eight-field event", () => withFixture((directory) => {
  assert.equal(runSubmit(directory).status, 0);
  const event = JSON.parse(threeFiles(directory)[1].trim());
  assert.deepEqual(Object.keys(event), ["ts", "event", "task", "attempt", "actor_role", "actor_id", "from", "to"]);
  assert.deepEqual({ ...event, ts: "ignored" }, {
    ts: "ignored", event: "TASK_SUBMITTED", task: "T-001", attempt: 1,
    actor_role: "worker", actor_id: "codex-cli", from: "IN_PROGRESS", to: "IMPLEMENTED",
  });
  assert.equal(frontmatterValueForTest(threeFiles(directory)[0], "updated"), event.ts);
}, submitTaskFixture));

test("task submit recalculates state and clears current task", () => withFixture((directory) => {
  assert.equal(runSubmit(directory).status, 0);
  const state = JSON.parse(threeFiles(directory)[2]);
  assert.deepEqual(state.counts, { TODO: 0, IN_PROGRESS: 0, IMPLEMENTED: 1, DONE: 0, BLOCKED: 0 });
  assert.equal(state.current_task, null);
}, submitTaskFixture));

test("task submit with a missing Task changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  const result = spawnSync(process.execPath, [cli, "task", "submit", "T-999", "--actor-role", "worker", "--actor-id", "codex-cli"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, submitTaskFixture));

test("task submit with a non-IN_PROGRESS Task changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  assert.equal(runSubmit(directory).status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, [{ id: "T-001", status: "TODO", body: requiredBody, attempt: 1, report: attemptOneReport }]));

test("task submit without a Report changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  assert.equal(runSubmit(directory).status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, [{ id: "T-001", status: "IN_PROGRESS", body: requiredBody, attempt: 1 }]));

test("task submit without the current attempt heading changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  assert.equal(runSubmit(directory).status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, [{ id: "T-001", status: "IN_PROGRESS", body: requiredBody, attempt: 2, report: attemptOneReport }]));

test("task submit without an actor id changes no files", () => withFixture((directory) => {
  const before = threeFiles(directory);
  const result = spawnSync(
    process.execPath,
    [cli, "task", "submit", "T-001", "--actor-role", "worker"],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.deepEqual(threeFiles(directory), before);
}, submitTaskFixture));

function reviewContent(attempt, verdict = "APPROVED") {
  return `---
task: T-001
---

## Attempt ${attempt} — 2026-08-04T00:00:00Z — ${verdict}

### Verdict
${verdict}
`;
}

function submittedEvent(attempt, actorId) {
  return `${JSON.stringify({
    ts: "2026-08-04T00:00:00.000Z",
    event: "TASK_SUBMITTED",
    task: "T-001",
    attempt,
    actor_role: "worker",
    actor_id: actorId,
    from: "IN_PROGRESS",
    to: "IMPLEMENTED",
  })}\n`;
}

const approveTaskFixture = [{
  id: "T-001", status: "IMPLEMENTED", body: requiredBody, attempt: 1, review: reviewContent(1),
}];
const attemptOneSubmitted = submittedEvent(1, "worker-a");

test("task approve updates frontmatter without changing attempt or body", () => withFixture((directory) => {
  const before = threeFiles(directory)[0];
  const result = runApprove(directory);
  const after = threeFiles(directory)[0];
  const events = threeFiles(directory)[1].trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(result.status, 0, result.stderr);
  assert.match(after, /^status: DONE$/m);
  assert.match(after, /^attempt: 1$/m);
  assert.equal(after.slice(after.indexOf("---", 3) + 3), before.slice(before.indexOf("---", 3) + 3));
  assert.equal(frontmatterValueForTest(after, "updated"), events.at(-1).ts);
}, approveTaskFixture, attemptOneSubmitted));

test("task approve appends one eight-field event", () => withFixture((directory) => {
  const beforeLines = threeFiles(directory)[1].trim().split(/\r?\n/).length;
  assert.equal(runApprove(directory).status, 0);
  const lines = threeFiles(directory)[1].trim().split(/\r?\n/);
  const event = JSON.parse(lines.at(-1));
  assert.equal(lines.length, beforeLines + 1);
  assert.deepEqual(Object.keys(event), ["ts", "event", "task", "attempt", "actor_role", "actor_id", "from", "to"]);
  assert.deepEqual({ ...event, ts: "ignored" }, {
    ts: "ignored", event: "TASK_APPROVED", task: "T-001", attempt: 1,
    actor_role: "reviewer", actor_id: "reviewer-a", from: "IMPLEMENTED", to: "DONE",
  });
}, approveTaskFixture, attemptOneSubmitted));

test("task approve recalculates state and clears current task", () => withFixture((directory) => {
  assert.equal(runApprove(directory).status, 0);
  const state = JSON.parse(threeFiles(directory)[2]);
  assert.deepEqual(state.counts, { TODO: 0, IN_PROGRESS: 0, IMPLEMENTED: 0, DONE: 1, BLOCKED: 0 });
  assert.equal(state.current_task, null);
}, approveTaskFixture, attemptOneSubmitted));

test("task approve with a missing Task changes no files", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  const result = runApprove(directory, "reviewer-a", "reviewer", "T-999");
  assert.equal(result.status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, approveTaskFixture, attemptOneSubmitted));

test("task approve with a non-IMPLEMENTED Task changes no files", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory).status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, [{ id: "T-001", status: "IN_PROGRESS", body: requiredBody, attempt: 1, review: reviewContent(1) }], attemptOneSubmitted));

test("task approve without a Review changes no files", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory).status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, [{ id: "T-001", status: "IMPLEMENTED", body: requiredBody, attempt: 1 }], attemptOneSubmitted));

test("task approve without the current attempt Review changes no files", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory).status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, [{ id: "T-001", status: "IMPLEMENTED", body: requiredBody, attempt: 2, review: reviewContent(1) }], submittedEvent(2, "worker-a")));

test("task approve rejects a CHANGES_REQUESTED Review without changes", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory).status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, [{ id: "T-001", status: "IMPLEMENTED", body: requiredBody, attempt: 1, review: reviewContent(1, "CHANGES_REQUESTED") }], attemptOneSubmitted));

test("task approve rejects BLOCKED and other verdicts without changes", () => {
  for (const verdict of ["BLOCKED", "REJECTED"]) {
    withFixture((directory) => {
      const before = bcosSnapshot(directory);
      assert.equal(runApprove(directory).status, 1);
      assert.deepEqual(bcosSnapshot(directory), before);
    }, [{ id: "T-001", status: "IMPLEMENTED", body: requiredBody, attempt: 1, review: reviewContent(1, verdict) }], attemptOneSubmitted);
  }
});

test("task approve rejects the current attempt submitter without changes", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory, "worker-a").status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, approveTaskFixture, attemptOneSubmitted));

test("task approve without a current submit event changes no files", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory).status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, approveTaskFixture));

const attemptTwoFixture = [{
  id: "T-001", status: "IMPLEMENTED", body: requiredBody, attempt: 2, review: reviewContent(2),
}];
const twoAttemptEvents = submittedEvent(1, "worker-a") + submittedEvent(2, "worker-b");

test("task approve uses the current attempt and permits the previous submitter", () => withFixture((directory) => {
  const result = runApprove(directory, "worker-a");
  assert.equal(result.status, 0, result.stderr);
}, attemptTwoFixture, twoAttemptEvents));

test("task approve uses the current attempt and rejects the current submitter", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory, "worker-b").status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, attemptTwoFixture, twoAttemptEvents));

test("task approve without an actor id changes no files", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  const result = spawnSync(
    process.execPath,
    [cli, "task", "approve", "T-001", "--actor-role", "reviewer"],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, approveTaskFixture, attemptOneSubmitted));

test("task approve rejects the worker role without changes", () => withFixture((directory) => {
  const before = bcosSnapshot(directory);
  assert.equal(runApprove(directory, "reviewer-a", "worker").status, 1);
  assert.deepEqual(bcosSnapshot(directory), before);
}, approveTaskFixture, attemptOneSubmitted));

test("task context prints the package header and footer without changing .bcos", () => {
  withContextFixture((directory) => {
    const before = bcosSnapshot(directory);
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^=== BCOS CONTEXT PACKAGE v0\.1 ===\n/);
    assert.match(result.stdout, /=== END CONTEXT PACKAGE ===\n$/);
    assert.match(result.stdout, /note: — second note/);
    assert.deepEqual(bcosSnapshot(directory), before);
  });
});

test("task context includes each Read List file exactly once", () => {
  withContextFixture((directory) => {
    const output = runContext(directory).stdout;
    assert.equal(output.match(/--- FILE \d+\/2: one\.txt ---/g)?.length, 1);
    assert.equal(output.match(/--- FILE \d+\/2: two\.txt ---/g)?.length, 1);
  });
});

test("task context removes duplicate paths and updates the file count", () => {
  withContextFixture((directory) => {
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^files: 1$/m);
    assert.equal(result.stdout.match(/--- FILE 1\/1: one\.txt ---/g)?.length, 1);
  }, { items: ["- `one.txt`", "- `one.txt` — duplicate"], files: { "one.txt": "one" } });
});

test("task context preserves Read List order", () => {
  withContextFixture((directory) => {
    const output = runContext(directory).stdout;
    assert.ok(output.indexOf(": two.txt ---") < output.indexOf(": one.txt ---"));
  }, { items: ["- `two.txt`", "- `one.txt`"] });
});

test("task context is byte-for-byte deterministic", () => {
  withContextFixture((directory) => {
    const first = runContext(directory);
    const second = runContext(directory);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(first.stdout, second.stdout);
  });
});

test("task context reads metadata only from the opening frontmatter", () => {
  const body = `${contextBody(["- `one.txt`"])}\n\`\`\`text\nstatus: TODO\nattempt: 0\n\`\`\`\n`;
  withContextFixture((directory) => {
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^task: T-100$/m);
    assert.match(result.stdout, /^status: IN_PROGRESS$/m);
    assert.match(result.stdout, /^attempt: 3$/m);
  }, { body, files: { "one.txt": "one" } });
});

test("task context reports exact file, character, and line totals", () => {
  const files = { "one.txt": "abc\n", "two.txt": "한글" };
  withContextFixture((directory) => {
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^files: 2$/m);
    assert.match(result.stdout, new RegExp(`^characters: ${files["one.txt"].length + files["two.txt"].length}$`, "m"));
    assert.match(result.stdout, /^lines: 3$/m);
  }, { files });
});

test("task context preserves UTF-8 Korean text", () => {
  withContextFixture((directory) => {
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /한글 문맥 패키지/);
  }, { items: ["- `korean.txt`"], files: { "korean.txt": "한글 문맥 패키지\n" } });
});

test("task context accepts a copied real T-004 Task fixture", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "bcos-context-real-task-"));
  try {
    const fixtureFiles = {
      "AGENTS.md": "fixture agents\n",
      ".bcos/tasks/T-004-task-submit-command.md": actualT004Task,
      ".bcos/prompts/T-004-task-submit-command-codex-prompt.md": "fixture prompt\n",
      "src/cli.ts": "fixture cli\n",
      "tests/cli.test.ts": "fixture tests\n",
      "package.json": "{}\n",
      "docs/rfcs/RFC-001-task-protocol.md": actualRfc001,
    };
    for (const [name, content] of Object.entries(fixtureFiles)) {
      const filePath = path.join(directory, ...name.split("/"));
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf8");
    }
    const result = runContext(directory, "T-004");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^task: T-004$/m);
    assert.match(result.stdout, /^files: 7$/m);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("task context includes a copied real RFC-001 fixture in full", () => {
  withContextFixture((directory) => {
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# RFC-001 — BCOS Task Protocol \(Core\)/);
    assert.match(result.stdout, /## 10\. `1\.0` 승격 조건/);
  }, {
    items: ["- `docs/rfcs/RFC-001-task-protocol.md` — full file"],
    files: { "docs/rfcs/RFC-001-task-protocol.md": actualRfc001 },
  });
});

test("task context rejects a missing Task without stdout", () => {
  withContextFixture((directory) => {
    const before = bcosSnapshot(directory);
    const result = runContext(directory, "T-999");
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.deepEqual(bcosSnapshot(directory), before);
  });
});

test("task context rejects a missing Read List label without stdout", () => {
  assertContextFailure({
    body: contextBody(["- `one.txt`"], "**참고 파일**"),
    files: { "one.txt": "one" },
  });
});

test("task context rejects an empty Read List without stdout", () => {
  assertContextFailure({ body: contextBody([]), files: {} });
});

test("task context rejects a missing file without stdout", () => {
  assertContextFailure({ items: ["- `missing.txt`"], files: {} });
});

test("task context rejects parent traversal and absolute paths without stdout", () => {
  for (const item of ["- `../outside.txt`", "- `C:\\outside.txt`", "- `/outside.txt`"]) {
    assertContextFailure({ items: [item], files: {} });
  }
});

test("task context rejects a NUL binary sample without stdout", () => {
  assertContextFailure({ items: ["- `binary.bin`"], files: { "binary.bin": Buffer.from([65, 0, 66]) } });
});

test("task context rejects files larger than 256 KB without stdout", () => {
  assertContextFailure({
    items: ["- `large.txt`"],
    files: { "large.txt": "x".repeat(256 * 1024 + 1) },
  });
});

test("task context rejects every sensitive path pattern without stdout", () => {
  const forbidden = [
    ".env", ".env.local", "secret.pem", "secret.key", "secret.p12", "secret.pfx",
    "id_rsa", "id_rsa.pub", ".git/config", "node_modules/pkg/file.js", "dist/cli.js",
  ];
  for (const name of forbidden) assertContextFailure({ items: [`- \`${name}\``], files: {} });
});

test("task context warns but succeeds when the package exceeds 8,000 characters", () => {
  withContextFixture((directory) => {
    const result = runContext(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Warning: Context Package exceeds 8,000 characters/);
    assert.match(result.stdout, /=== END CONTEXT PACKAGE ===/);
  }, { items: ["- `long.txt`"], files: { "long.txt": "x".repeat(8_001) } });
});

test("lifecycle start, submit, and approve retain success and failure paths", (context) => {
  const statuses = [];
  withFixture((directory) => statuses.push(["start success", runStart(directory).status]));
  withFixture((directory) => statuses.push(["start failure", runStart(directory).status]), [
    { id: "T-001", status: "DONE", body: requiredBody },
  ]);
  withFixture((directory) => statuses.push(["submit success", runSubmit(directory).status]), submitTaskFixture);
  withFixture((directory) => statuses.push(["submit failure", runSubmit(directory).status]), [
    { id: "T-001", status: "IN_PROGRESS", body: requiredBody, attempt: 1 },
  ]);
  withFixture(
    (directory) => statuses.push(["approve success", runApprove(directory).status]),
    approveTaskFixture,
    attemptOneSubmitted,
  );
  withFixture(
    (directory) => statuses.push(["approve failure (SoD)", runApprove(directory, "worker-a").status]),
    approveTaskFixture,
    attemptOneSubmitted,
  );
  assert.deepEqual(statuses.map((entry) => entry[1]), [0, 1, 0, 1, 0, 1]);
  context.diagnostic(statuses.map(([name, status]) => `${name}: exit ${status}`).join(", "));
});

function runnerFixture({
  id = "T-200",
  status = "IN_PROGRESS",
  prompt = "FIXTURE WORKER PROMPT",
  promptCount = 1,
  items,
  files = { "one.txt": "fixture context\n" },
  workerExitCode = 0,
  workerDelay = 0,
} = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "bcos-runner-"));
  const tasksDirectory = path.join(directory, ".bcos", "tasks");
  const promptsDirectory = path.join(directory, ".bcos", "prompts");
  mkdirSync(tasksDirectory, { recursive: true });
  mkdirSync(promptsDirectory, { recursive: true });
  const readItems = items ?? [`- \`.bcos/tasks/${id}-runner.md\``, "- `one.txt`"];
  writeFileSync(
    path.join(tasksDirectory, `${id}-runner.md`),
    taskContent(id, status, contextBody(readItems), 1),
    "utf8",
  );
  for (let index = 0; index < promptCount; index += 1) {
    writeFileSync(
      path.join(promptsDirectory, `${id}-worker-${index}.md`),
      `# Worker Prompt\n\n---\n${prompt}\n---\n`,
      "utf8",
    );
  }
  writeFileSync(path.join(directory, ".bcos", "events.jsonl"), "event-before\n", "utf8");
  writeFileSync(path.join(directory, ".bcos", "state.json"), "state-before\n", "utf8");
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(directory, ...name.split("/"));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");
  }
  const workerPath = path.join(directory, "fake-worker.js");
  writeFileSync(workerPath, `
import { createHash } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  setTimeout(() => {
    const receivedTemp = "received.txt.tmp";
    writeFileSync(receivedTemp, input, "utf8");
    renameSync(receivedTemp, "received.txt");
    console.log("stdin-sha256:" + createHash("sha256").update(input, "utf8").digest("hex"));
    console.log("cwd:" + process.cwd());
    console.log("argv:" + JSON.stringify(process.argv.slice(2)));
    console.error("fake-worker-stderr");
    process.exitCode = ${workerExitCode};
  }, ${workerDelay});
});
`, "utf8");
  return { directory, workerPath, id };
}

function runWorker(directory, workerPath, id = "T-200", ...extraArguments) {
  return spawnSync(process.execPath, [
    cli, "task", "run", id, "--worker", "codex", "--worker-command", workerPath,
    ...extraArguments,
  ], { cwd: directory, encoding: "utf8", timeout: 5_000 });
}

function withRunnerFixture(callback, options) {
  const fixture_ = runnerFixture(options);
  try {
    callback(fixture_);
  } finally {
    rmSync(fixture_.directory, { recursive: true, force: true });
  }
}

function dryRun(fixture_) {
  return runWorker(fixture_.directory, fixture_.workerPath, fixture_.id, "--dry-run");
}

function summaryValue(output, label) {
  return new RegExp(`^${label}: (.+)$`, "m").exec(output)?.[1];
}

function assertRunnerFailureWithoutChanges(options, mutate) {
  withRunnerFixture((fixture_) => {
    if (mutate) mutate(fixture_);
    const before = bcosSnapshot(fixture_.directory);
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id, "--dry-run");
    assert.equal(result.status, 1);
    assert.ok(result.stderr);
    assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  }, options);
}

test("task run dry-run reports command, args, and cwd", (context) => {
  withRunnerFixture((fixture_) => {
    const result = dryRun(fixture_);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(summaryValue(result.stdout, "command"), process.execPath);
    assert.match(result.stdout, /^args: \[.*"exec","-","--cd",.*\]$/m);
    assert.equal(summaryValue(result.stdout, "cwd"), fixture_.directory);
    const reportedArgs = JSON.parse(summaryValue(result.stdout, "args"));
    const sanitizedArgs = reportedArgs.map((value) => {
      if (value === fixture_.workerPath) return "<fake-worker.js>";
      if (value === fixture_.directory) return "<fixture-root>";
      return value;
    });
    context.diagnostic([
      "command: <node>",
      `args: ${JSON.stringify(sanitizedArgs)}`,
      "cwd: <fixture-root>",
      ...result.stdout.trim().split(/\r?\n/).slice(3),
    ].join("\n"));
  });
});

test("task run dry-run reports Context count and hashes", () => {
  withRunnerFixture((fixture_) => {
    const result = dryRun(fixture_);
    assert.match(result.stdout, /^Context file count: 2$/m);
    assert.match(result.stdout, /^Context SHA-256: [a-f0-9]{64}$/m);
    assert.match(result.stdout, /^stdin SHA-256: [a-f0-9]{64}$/m);
  });
});

test("task run dry-run reports stdin character and line counts without its body", () => {
  withRunnerFixture((fixture_) => {
    const result = dryRun(fixture_);
    assert.match(result.stdout, /^stdin characters: \d+$/m);
    assert.match(result.stdout, /^stdin lines: \d+$/m);
    assert.doesNotMatch(result.stdout, /BCOS WORKER EXECUTION/);
    assert.doesNotMatch(result.stdout, /FIXTURE WORKER PROMPT/);
  });
});

test("task run dry-run is deterministic and changes no .bcos files", () => {
  withRunnerFixture((fixture_) => {
    const before = bcosSnapshot(fixture_.directory);
    const first = dryRun(fixture_);
    const second = dryRun(fixture_);
    assert.equal(summaryValue(first.stdout, "stdin SHA-256"), summaryValue(second.stdout, "stdin SHA-256"));
    assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  });
});

test("task run delivers the exact dry-run stdin hash to the fake worker", () => {
  withRunnerFixture((fixture_) => {
    const expected = summaryValue(dryRun(fixture_).stdout, "stdin SHA-256");
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`^stdin-sha256:${expected}$`, "m"));
  });
});

test("task run assembles the fixed preamble and Context once", () => {
  withRunnerFixture((fixture_) => {
    assert.equal(runWorker(fixture_.directory, fixture_.workerPath, fixture_.id).status, 0);
    const input = readFileSync(path.join(fixture_.directory, "received.txt"), "utf8");
    assert.match(input, /  task:   T-200/);
    assert.match(input, /  worker: codex/);
    assert.match(input, /report: \.bcos[\\/]reports[\\/]T-200-runner\.md/);
    assert.match(input, /Task 문서가 있다\. 그것이 네 계약이다/);
    assert.match(input, /목록 밖의 파일을 임의로 열지 마라/);
    assert.match(input, /저장소 전체를 탐색하지 마라/);
    assert.match(input, /git 명령을 실행하지 마라/);
    assert.match(input, /bcos 명령을 실행하지 마라/);
    assert.match(input, /승인을 시도하지 마라/);
    assert.match(input, /Acceptance Criteria를 전부 충족했을 때만 완료/);
    assert.match(input, /Report를 쓰고 멈춰라/);
    assert.doesNotMatch(input, /FIXTURE WORKER PROMPT/);
    assert.equal(input.match(/=== BCOS CONTEXT PACKAGE v0\.1 ===/g)?.length, 1);
    assert.equal(input.match(/title: Test Task/g)?.length, 1);
  });
});

test("task run uses the fixture root as worker cwd and does not pass Task ID in argv", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    assert.match(result.stdout, new RegExp(`^cwd:${fixture_.directory.replaceAll("\\", "\\\\")}$`, "m"));
    const argv = JSON.parse(/^argv:(.+)$/m.exec(result.stdout)?.[1]);
    assert.deepEqual(argv, ["exec", "-", "--cd", fixture_.directory]);
    assert.ok(!argv.includes(fixture_.id));
  });
});

test("task run streams fake worker stdout and stderr and reports byte counts", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    assert.match(result.stdout, /stdin-sha256:/);
    assert.match(result.stderr, /fake-worker-stderr/);
    assert.match(result.stdout, /^telemetry worker_stdout_bytes=\d+$/m);
    assert.match(result.stdout, /^telemetry worker_stderr_bytes=\d+$/m);
  });
});

test("task run reports exit zero and execution duration", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^telemetry worker_exit_code=0$/m);
    assert.match(result.stdout, /^telemetry worker_duration_ms=\d+$/m);
  });
});

test("task run distinguishes and propagates fake worker exit 3", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    assert.equal(result.status, 3);
    assert.match(result.stdout, /^telemetry worker_exit_code=3$/m);
    assert.match(result.stderr, /Worker failed with exit code 3/);
  }, { workerExitCode: 3 });
});

test("task run timeout fails and changes no .bcos files", () => {
  withRunnerFixture((fixture_) => {
    const before = bcosSnapshot(fixture_.directory);
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id, "--timeout", "1");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Worker timed out after 1 seconds/);
    assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  }, { workerDelay: 2_000 });
});

test("task run rejects a missing Task without changes", () => {
  assertRunnerFailureWithoutChanges(undefined, (fixture_) => { fixture_.id = "T-999"; });
});

test("task run rejects a Task not IN_PROGRESS without changes", () => {
  assertRunnerFailureWithoutChanges({ status: "TODO" });
});

test("task run succeeds when the prompts directory has no matching Prompt", () => {
  withRunnerFixture((fixture_) => {
    rmSync(path.join(fixture_.directory, ".bcos", "prompts"), { recursive: true });
    assert.equal(dryRun(fixture_).status, 0);
  }, { promptCount: 0 });
});

test("task run ignores multiple Prompts", () => {
  withRunnerFixture((fixture_) => {
    const result = dryRun(fixture_);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /FIXTURE WORKER PROMPT/);
  }, { promptCount: 2 });
});

test("task run ignores a Prompt without a delimiter pair", () => {
  withRunnerFixture((fixture_) => {
    writeFileSync(path.join(fixture_.directory, ".bcos", "prompts", "T-200-worker-0.md"), "no delimiters\n", "utf8");
    assert.equal(dryRun(fixture_).status, 0);
  });
});

test("task run ignores an empty Prompt body", () => {
  withRunnerFixture((fixture_) => assert.equal(dryRun(fixture_).status, 0), { prompt: "   " });
});

test("task run rejects Context creation failure without changes", () => {
  assertRunnerFailureWithoutChanges({
    items: ["- `.bcos/tasks/T-200-runner.md`", "- `missing.txt`"],
    files: {},
  });
});

function telemetryValues(output) {
  return Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = /^telemetry ([^=]+)=(.*)$/.exec(line);
    return match ? [[match[1], match[2]]] : [];
  }));
}

const telemetryKeys = [
  "task_id", "worker_name", "worker_runtime", "context_files", "context_bytes",
  "context_lines", "context_chars", "context_sha256", "stdin_bytes", "stdin_sha256",
  "worker_timeout_seconds", "first_worker_response_ms", "worker_duration_ms",
  "worker_exit_code", "worker_timed_out", "worker_stdout_bytes", "worker_stderr_bytes",
  "retry_count", "runner_transitions_caused",
];

test("task run dry-run emits telemetry without process-only fields", () => {
  withRunnerFixture((fixture_) => {
    const result = dryRun(fixture_);
    const values = telemetryValues(result.stdout);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(values.worker_timeout_seconds, "1800");
    assert.equal(values.worker_timed_out, "false");
    for (const key of [
      "first_worker_response_ms", "worker_duration_ms", "worker_exit_code",
      "worker_stdout_bytes", "worker_stderr_bytes",
    ]) assert.ok(!(key in values));
  });
});

test("task run execution emits exactly the defined runner telemetry keys", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    const values = telemetryValues(result.stdout);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(Object.keys(values), telemetryKeys);
    assert.equal(values.worker_exit_code, "0");
    assert.equal(values.worker_timed_out, "false");
    assert.equal(values.retry_count, "0");
    assert.equal(values.runner_transitions_caused, "0");
  });
});

test("task run measures first output from a two-second delayed worker", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    const values = telemetryValues(result.stdout);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(Number(values.first_worker_response_ms) > 1_000);
    assert.ok(Number(values.worker_duration_ms) >= Number(values.first_worker_response_ms));
  }, { workerDelay: 2_000 });
});

test("task run timeout override is reported and marks timed out execution", () => {
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id, "--timeout", "1");
    const values = telemetryValues(result.stdout);
    assert.equal(result.status, 1);
    assert.equal(values.worker_timeout_seconds, "1");
    assert.equal(values.worker_timed_out, "true");
  }, { workerDelay: 2_000 });
});

test("task run dry-run and execution report identical context and stdin hashes", () => {
  withRunnerFixture((fixture_) => {
    const dryValues = telemetryValues(dryRun(fixture_).stdout);
    const runValues = telemetryValues(
      runWorker(fixture_.directory, fixture_.workerPath, fixture_.id).stdout,
    );
    assert.equal(runValues.context_sha256, dryValues.context_sha256);
    assert.equal(runValues.stdin_sha256, dryValues.stdin_sha256);
  });
});

test("task run rejects a Read List missing its own Task file without changes", () => {
  assertRunnerFailureWithoutChanges({ items: ["- `one.txt`"] });
});

test("task run explains that the Task file is missing from the Read List", () => {
  withRunnerFixture((fixture_) => {
    const result = dryRun(fixture_);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Read List is missing its Task file: .*T-200-runner\.md/);
  }, { items: ["- `one.txt`"] });
});

test("task run preamble is invariant outside its three value positions", () => {
  const inputs = [];
  for (const id of ["T-201", "T-202"]) {
    withRunnerFixture((fixture_) => {
      assert.equal(runWorker(fixture_.directory, fixture_.workerPath, fixture_.id).status, 0);
      inputs.push(readFileSync(path.join(fixture_.directory, "received.txt"), "utf8")
        .split("\n\n--- CONTEXT PACKAGE ---\n")[0]
        .replace(id, "<id>")
        .replace("codex", "<worker>")
        .replace(new RegExp(`\\.bcos[\\\\/]reports[\\\\/]${id}-runner\\.md`), "<report>"));
    }, { id });
  }
  assert.equal(inputs[0], inputs[1]);
});

test("task run does not write telemetry into .bcos", () => {
  withRunnerFixture((fixture_) => {
    const before = bcosSnapshot(fixture_.directory);
    assert.equal(runWorker(fixture_.directory, fixture_.workerPath, fixture_.id).status, 0);
    assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  });
});

test("task run rejects unsupported workers without changes", () => {
  withRunnerFixture((fixture_) => {
    const before = bcosSnapshot(fixture_.directory);
    const result = spawnSync(process.execPath, [
      cli, "task", "run", fixture_.id, "--worker", "claude", "--worker-command", fixture_.workerPath,
    ], { cwd: fixture_.directory, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported worker/);
    assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  });
});

test("task run rejects a nonexistent worker command without changes", () => {
  withRunnerFixture((fixture_) => {
    const before = bcosSnapshot(fixture_.directory);
    const result = runWorker(fixture_.directory, path.join(fixture_.directory, "missing-worker.js"), fixture_.id);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Worker command does not exist/);
    assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  });
});

test("task run rejects every non-positive-integer timeout without changes", () => {
  for (const timeout of ["0", "-1", "1.5", "text"]) {
    withRunnerFixture((fixture_) => {
      const before = bcosSnapshot(fixture_.directory);
      const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id, "--timeout", timeout);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /positive integer/);
      assert.deepEqual(bcosSnapshot(fixture_.directory), before);
    });
  }
});

test("task run keeps shell metacharacters in stdin and out of worker argv", () => {
  const id = "T-200;echo-injected";
  withRunnerFixture((fixture_) => {
    const result = runWorker(fixture_.directory, fixture_.workerPath, fixture_.id);
    assert.equal(result.status, 0, result.stderr);
    const argv = JSON.parse(/^argv:(.+)$/m.exec(result.stdout)?.[1]);
    assert.ok(!argv.includes(id));
    assert.match(readFileSync(path.join(fixture_.directory, "received.txt"), "utf8"), /task: T-200;echo-injected/);
  }, { id });
});

test("task run requires worker and rejects unknown options without changes", () => {
  withRunnerFixture((fixture_) => {
    for (const args of [
      [cli, "task", "run", fixture_.id],
      [cli, "task", "run", fixture_.id, "--worker", "codex", "--unknown"],
    ]) {
      const before = bcosSnapshot(fixture_.directory);
      const result = spawnSync(process.execPath, args, { cwd: fixture_.directory, encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.deepEqual(bcosSnapshot(fixture_.directory), before);
    }
  });
});

test("task context retains success and failure paths after runner routing", () => {
  withContextFixture((directory) => {
    assert.equal(runContext(directory).status, 0);
    assert.equal(runContext(directory, "T-999").status, 1);
  });
});

function workflowFixture({ status = "TODO", attempt = 0, report = false, scriptsTest = true } = {}) {
  const id = "T-300";
  const directory = mkdtempSync(path.join(os.tmpdir(), "bcos-workflow-"));
  const bcosDirectory = path.join(directory, ".bcos");
  const taskName = `${id}-workflow.md`;
  mkdirSync(path.join(bcosDirectory, "tasks"), { recursive: true });
  mkdirSync(path.join(bcosDirectory, "reports"), { recursive: true });
  mkdirSync(path.join(bcosDirectory, "reviews"), { recursive: true });
  const body = contextBody([`- \`.bcos/tasks/${taskName}\``, "- `package.json`"]);
  writeFileSync(path.join(bcosDirectory, "tasks", taskName), taskContent(id, status, body, attempt), "utf8");
  writeFileSync(path.join(bcosDirectory, "events.jsonl"), "", "utf8");
  writeFileSync(path.join(bcosDirectory, "state.json"), `${JSON.stringify({
    protocol: "0.1", version: 1, project: "test", branch: "main",
    counts: { TODO: status === "TODO" ? 1 : 0, IN_PROGRESS: status === "IN_PROGRESS" ? 1 : 0,
      IMPLEMENTED: status === "IMPLEMENTED" ? 1 : 0, DONE: 0, BLOCKED: 0 },
    current_task: status === "IN_PROGRESS" ? id : null, updated: "2026-08-04T00:00:00Z",
  })}\n`, "utf8");
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({
    type: "module", scripts: scriptsTest ? { test: "fixture" } : {},
  }), "utf8");
  if (report) writeFileSync(path.join(bcosDirectory, "reports", taskName), "## Attempt 1 — fixture\n", "utf8");
  const workerPath = path.join(directory, "fake-worker.js");
  writeFileSync(workerPath, `
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
process.stdin.resume();
process.stdin.on("end", () => {
  if (process.env.WORKER_REPORT !== "no") {
    const report = path.join(process.cwd(), ".bcos", "reports", "T-300-workflow.md");
    mkdirSync(path.dirname(report), { recursive: true });
    writeFileSync(report, "## Attempt 1 — fixture\\n", "utf8");
  }
  console.log("worker-session:" + process.env.BCOS_WORKER_SESSION);
  setTimeout(() => { process.exitCode = Number(process.env.WORKER_EXIT || 0); }, Number(process.env.WORKER_DELAY || 0));
});
`, "utf8");
  const verifierPath = path.join(directory, "fake-verifier.js");
  writeFileSync(verifierPath, `
import { writeFileSync } from "node:fs";
import path from "node:path";
console.log("fixture-verifier-stdout");
console.error("fixture-verifier-stderr");
writeFileSync(path.join(process.cwd(), "verification-ran.txt"), process.cwd(), "utf8");
process.exitCode = Number(process.env.VERIFY_EXIT || 0);
`, "utf8");
  const pathRoot = path.join(directory, "fixture-path");
  const npmPath = path.join(pathRoot, "node_modules", "npm", "bin");
  mkdirSync(npmPath, { recursive: true });
  writeFileSync(path.join(npmPath, "npm-cli.js"), `
import { writeFileSync } from "node:fs";
writeFileSync("npm-test-ran.txt", process.argv.slice(2).join(","), "utf8");
`, "utf8");
  return { directory, id, taskName, workerPath, verifierPath, pathRoot };
}

function runExecute(fixture_, extra = [], environment = {}) {
  return spawnSync(process.execPath, [
    cli, "task", "execute", fixture_.id, "--worker", "codex", "--actor-id", "workflow-actor",
    "--worker-command", fixture_.workerPath, "--verify-command", fixture_.verifierPath, ...extra,
  ], { cwd: fixture_.directory, encoding: "utf8", timeout: 8_000, env: { ...process.env, ...environment } });
}

function withWorkflowFixture(callback, options) {
  const fixture_ = workflowFixture(options);
  try { callback(fixture_); } finally { rmSync(fixture_.directory, { recursive: true, force: true }); }
}

function workflowEvents(fixture_) {
  return readFileSync(path.join(fixture_.directory, ".bcos", "events.jsonl"), "utf8")
    .split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

test("task execute routes a complete TODO workflow", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(path.join(fixture_.directory, ".bcos", "tasks", fixture_.taskName), "utf8"), /^status: IMPLEMENTED$/m);
}));

test("task execute performs start then submit without approval", () => withWorkflowFixture((fixture_) => {
  assert.equal(runExecute(fixture_).status, 0);
  assert.deepEqual(workflowEvents(fixture_).map((event) => event.event), ["TASK_STARTED", "TASK_SUBMITTED"]);
}));

test("task execute records its actor id on both transitions", () => withWorkflowFixture((fixture_) => {
  assert.equal(runExecute(fixture_).status, 0);
  assert.deepEqual(workflowEvents(fixture_).map((event) => event.actor_id), ["workflow-actor", "workflow-actor"]);
}));

test("task execute reports successful workflow telemetry", () => withWorkflowFixture((fixture_) => {
  const values = telemetryValues(runExecute(fixture_).stdout);
  assert.equal(values.workflow_exit_reason, "success");
  assert.equal(values.lifecycle_transitions_caused, "2");
  assert.equal(values.runner_invocations, "1");
  assert.equal(values.verification_runs, "1");
}));

test("task execute sends the BCOS worker-session marker", () => withWorkflowFixture((fixture_) => {
  assert.match(runExecute(fixture_).stdout, /^worker-session:1$/m);
}));

test("task execute rejects a nested worker before lifecycle changes", () => withWorkflowFixture((fixture_) => {
  const before = bcosSnapshot(fixture_.directory);
  const result = runExecute(fixture_, [], { BCOS_WORKER_SESSION: "1" });
  assert.equal(result.status, 1);
  assert.deepEqual(bcosSnapshot(fixture_.directory), before);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "nested_worker");
}));

test("nested worker rejection directs the user to the host shell", () => withWorkflowFixture((fixture_) => {
  assert.match(runExecute(fixture_, [], { BCOS_WORKER_SESSION: "1" }).stderr, /host shell/);
}));

test("nested worker rejection invokes neither runner nor verifier", () => withWorkflowFixture((fixture_) => {
  const values = telemetryValues(runExecute(fixture_, [], { BCOS_WORKER_SESSION: "1" }).stdout);
  assert.equal(values.runner_invocations, "0");
  assert.equal(values.verification_runs, "0");
  assert.ok(!("verification_exit_code" in values));
}));

test("task execute stops before lifecycle and runner when child creation is denied", () => withWorkflowFixture((fixture_) => {
  const before = bcosSnapshot(fixture_.directory);
  const result = spawnSync(process.execPath, [
    "--permission", "--allow-fs-read=*", "--allow-fs-write=*", cli,
    "task", "execute", fixture_.id, "--worker", "codex", "--actor-id", "a",
    "--worker-command", fixture_.workerPath, "--verify-command", fixture_.verifierPath,
  ], { cwd: fixture_.directory, encoding: "utf8" });
  const values = telemetryValues(result.stdout);
  assert.equal(result.status, 1);
  assert.equal(values.workflow_exit_reason, "environment");
  assert.equal(values.runner_invocations, "0");
  assert.deepEqual(bcosSnapshot(fixture_.directory), before);
}));

test("task execute preserves IN_PROGRESS without adding a start event", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(workflowEvents(fixture_).map((event) => event.event), ["TASK_SUBMITTED"]);
}, { status: "IN_PROGRESS", attempt: 1 }));

test("task execute rejects terminal task states", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_);
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
}, { status: "IMPLEMENTED", attempt: 1, report: true }));

test("task execute worker failure leaves the task IN_PROGRESS", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, [], { WORKER_EXIT: "3" });
  assert.equal(result.status, 1);
  assert.match(readFileSync(path.join(fixture_.directory, ".bcos", "tasks", fixture_.taskName), "utf8"), /^status: IN_PROGRESS$/m);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "worker_nonzero");
}));

test("task execute worker failure does not submit", () => withWorkflowFixture((fixture_) => {
  runExecute(fixture_, [], { WORKER_EXIT: "3" });
  assert.deepEqual(workflowEvents(fixture_).map((event) => event.event), ["TASK_STARTED"]);
}));

test("task execute classifies runner timeout", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, ["--timeout", "1"], { WORKER_DELAY: "2000" });
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "timeout");
}));

test("task execute rejects a missing Report before verification", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, [], { WORKER_REPORT: "no" });
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
  assert.equal(existsSync(path.join(fixture_.directory, "verification-ran.txt")), false);
}));

test("task execute verification failure preserves Report and skips submit", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, [], { VERIFY_EXIT: "4" });
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "verification");
  assert.equal(existsSync(path.join(fixture_.directory, ".bcos", "reports", fixture_.taskName)), true);
  assert.deepEqual(workflowEvents(fixture_).map((event) => event.event), ["TASK_STARTED"]);
}));

test("task execute forwards verifier stdout and stderr", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_);
  assert.match(result.stdout, /fixture-verifier-stdout/);
  assert.match(result.stderr, /fixture-verifier-stderr/);
}));

test("task execute runs verification from the fixture root", () => withWorkflowFixture((fixture_) => {
  assert.equal(runExecute(fixture_).status, 0);
  assert.equal(readFileSync(path.join(fixture_.directory, "verification-ran.txt"), "utf8"), fixture_.directory);
}));

test("task execute verify-only skips start and worker", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, ["--verify-only"]);
  const values = telemetryValues(result.stdout);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(values.runner_invocations, "0");
  assert.equal(values.lifecycle_transitions_caused, "1");
  assert.deepEqual(workflowEvents(fixture_).map((event) => event.event), ["TASK_SUBMITTED"]);
}, { status: "IN_PROGRESS", attempt: 1, report: true }));

test("task execute verify-only requires IN_PROGRESS", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, ["--verify-only"]);
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
}, { report: true }));

test("task execute verify-only requires a Report", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, ["--verify-only"]);
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).verification_runs, "0");
}, { status: "IN_PROGRESS", attempt: 1 }));

test("task execute requires worker and actor id", () => withWorkflowFixture((fixture_) => {
  for (const args of [[cli, "task", "execute", fixture_.id, "--actor-id", "a"], [cli, "task", "execute", fixture_.id, "--worker", "codex"]]) {
    const result = spawnSync(process.execPath, args, { cwd: fixture_.directory, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
  }
}));

test("task execute rejects unsupported workers", () => withWorkflowFixture((fixture_) => {
  const result = spawnSync(process.execPath, [cli, "task", "execute", fixture_.id, "--worker", "claude", "--actor-id", "a"], { cwd: fixture_.directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
}));

test("task execute rejects unknown options with telemetry", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, ["--unknown"]);
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
}));

test("task execute rejects a missing custom verifier", () => withWorkflowFixture((fixture_) => {
  const result = runExecute(fixture_, ["--verify-command", "missing.js"]);
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
}));

test("task execute uses package scripts.test through the npm JavaScript entry", () => withWorkflowFixture((fixture_) => {
  const args = [cli, "task", "execute", fixture_.id, "--worker", "codex", "--actor-id", "a", "--worker-command", fixture_.workerPath];
  const result = spawnSync(process.execPath, args, { cwd: fixture_.directory, encoding: "utf8", env: { ...process.env, PATH: fixture_.pathRoot } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(fixture_.directory, "npm-test-ran.txt"), "utf8"), "test");
  assert.equal(telemetryValues(result.stdout).verification_command, "npm-test");
}));

test("task execute rejects package.json without scripts.test", () => withWorkflowFixture((fixture_) => {
  const args = [cli, "task", "execute", fixture_.id, "--worker", "codex", "--actor-id", "a", "--worker-command", fixture_.workerPath];
  const result = spawnSync(process.execPath, args, { cwd: fixture_.directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(telemetryValues(result.stdout).workflow_exit_reason, "protocol");
}, { scriptsTest: false }));

test("task execute emits verification fields only after verification runs", () => withWorkflowFixture((fixture_) => {
  const rejected = telemetryValues(runExecute(fixture_, [], { BCOS_WORKER_SESSION: "1" }).stdout);
  assert.ok(!("verification_exit_code" in rejected));
  const successful = telemetryValues(runExecute(fixture_).stdout);
  assert.equal(successful.verification_exit_code, "0");
  assert.match(successful.verification_duration_ms, /^\d+$/);
}));

test("task execute telemetry uses logical command names and no fixture path", () => withWorkflowFixture((fixture_) => {
  const lines = runExecute(fixture_).stdout.split(/\r?\n/).filter((line) => line.startsWith("telemetry workflow_") || line.startsWith("telemetry verification_") || line.startsWith("telemetry nested_") || line.startsWith("telemetry runner_") || line.startsWith("telemetry lifecycle_"));
  assert.ok(lines.includes("telemetry verification_command=custom-verifier"));
  assert.doesNotMatch(lines.join("\n"), new RegExp(fixture_.directory.replaceAll("\\", "\\\\")));
}));

test("help advertises task execute", () => {
  assert.match(run("--help").stdout, /execute/);
});
