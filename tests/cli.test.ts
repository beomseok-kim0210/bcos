import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
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

function taskContent(id, status = "TODO", body = requiredBody) {
  return `---
protocol: "0.1"
id: ${id}
title: Test Task
status: ${status}
attempt: 0
created: 2026-08-04T00:00:00Z
updated: 2026-08-04T00:00:00Z
---
${body}`;
}

function fixture(tasks = [{ id: "T-001", status: "TODO", body: requiredBody }]) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "bcos-cli-"));
  const bcosDirectory = path.join(directory, ".bcos");
  const tasksDirectory = path.join(bcosDirectory, "tasks");
  mkdirSync(tasksDirectory, { recursive: true });
  for (const task of tasks) {
    writeFileSync(
      path.join(tasksDirectory, `${task.id}-test-task.md`),
      taskContent(task.id, task.status, task.body),
      "utf8",
    );
  }
  writeFileSync(path.join(bcosDirectory, "events.jsonl"), "", "utf8");
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

function threeFiles(directory) {
  return [
    readFileSync(path.join(directory, ".bcos", "tasks", "T-001-test-task.md"), "utf8"),
    readFileSync(path.join(directory, ".bcos", "events.jsonl"), "utf8"),
    readFileSync(path.join(directory, ".bcos", "state.json"), "utf8"),
  ];
}

function withFixture(callback, tasks) {
  const directory = fixture(tasks);
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
