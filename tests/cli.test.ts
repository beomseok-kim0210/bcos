import assert from "node:assert/strict";
import {
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
