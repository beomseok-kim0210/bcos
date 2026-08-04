#!/usr/bin/env node

import {
  appendFileSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { version: string };
const argument = process.argv[2];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function frontmatterValue(content: string, key: string): string | undefined {
  return new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)`, "m").exec(content)?.[1].trim();
}

function hasRequiredSections(content: string): boolean {
  const names = [
    "Objective",
    "Scope",
    "Out of Scope",
    "Acceptance Criteria",
    "Expected Files",
    "Test Requirements",
  ];
  let previousIndex = -1;

  for (const name of names) {
    const match = new RegExp(`^## ${name}[ \\t]*\\r?\\n([\\s\\S]*?)(?=^## |\\s*$)`, "m").exec(content);
    if (!match || match.index <= previousIndex) return false;
    const value = match[1].trim();
    if (!value || /^(?:TBD|TODO|<[^>]*>)$/i.test(value)) return false;
    previousIndex = match.index;
  }

  return true;
}

function replaceFrontmatterValue(content: string, key: string, value: string): string {
  return content.replace(
    new RegExp(`(^${key}:[ \\t]*)[^\\r\\n]*(?=\\r?$)`, "m"),
    `$1${value}`,
  );
}

function startTask(): void {
  const args = process.argv.slice(2);
  const taskId = args[2];
  const roleIndex = args.indexOf("--actor-role");
  const idIndex = args.indexOf("--actor-id");
  const actorRole = roleIndex >= 0 ? args[roleIndex + 1] : undefined;
  const actorId = idIndex >= 0 ? args[idIndex + 1] : undefined;

  if (!actorRole || !actorId) fail("Both --actor-role and --actor-id are required");

  const bcosDirectory = path.join(process.cwd(), ".bcos");
  const tasksDirectory = path.join(bcosDirectory, "tasks");
  let taskNames: string[];
  try {
    taskNames = readdirSync(tasksDirectory).filter((name) => name.endsWith(".md"));
  } catch {
    fail(`Cannot read tasks directory: ${tasksDirectory}`);
  }

  const matchingNames = taskNames.filter((name) => name.startsWith(`${taskId}-`));
  if (matchingNames.length !== 1) fail(`Expected exactly one Task for ${taskId}`);

  const taskRecords = taskNames.map((name) => {
    const filePath = path.join(tasksDirectory, name);
    return { filePath, content: readFileSync(filePath, "utf8") };
  });
  const target = taskRecords.find(({ filePath }) => path.basename(filePath) === matchingNames[0]);
  if (!target) fail(`Task not found: ${taskId}`);

  const status = frontmatterValue(target.content, "status");
  if (status !== "TODO") fail(`Task ${taskId} is not TODO`);
  if (taskRecords.some(({ content }) => frontmatterValue(content, "status") === "IN_PROGRESS")) {
    fail("Another Task is already IN_PROGRESS");
  }
  if (!hasRequiredSections(target.content)) fail(`Task ${taskId} has an empty required section`);

  const currentAttempt = Number(frontmatterValue(target.content, "attempt"));
  if (!Number.isInteger(currentAttempt) || currentAttempt < 0) fail(`Task ${taskId} has an invalid attempt`);

  const eventsPath = path.join(bcosDirectory, "events.jsonl");
  const statePath = path.join(bcosDirectory, "state.json");
  const existingEvents = readFileSync(eventsPath, "utf8");
  const existingState = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const attempt = currentAttempt + 1;
  const timestamp = new Date().toISOString();
  const updatedTask = replaceFrontmatterValue(
    replaceFrontmatterValue(
      replaceFrontmatterValue(target.content, "status", "IN_PROGRESS"),
      "attempt",
      String(attempt),
    ),
    "updated",
    timestamp,
  );
  const event = {
    ts: timestamp,
    event: "TASK_STARTED",
    task: taskId,
    attempt,
    actor_role: actorRole,
    actor_id: actorId,
    from: "TODO",
    to: "IN_PROGRESS",
  };
  const statuses = ["TODO", "IN_PROGRESS", "IMPLEMENTED", "DONE", "BLOCKED"];
  const counts = Object.fromEntries(statuses.map((taskStatus) => [taskStatus, 0]));
  for (const record of taskRecords) {
    const recordStatus = record === target ? "IN_PROGRESS" : frontmatterValue(record.content, "status");
    if (recordStatus && recordStatus in counts) counts[recordStatus] += 1;
  }
  const updatedState = {
    protocol: existingState.protocol,
    version: existingState.version,
    project: existingState.project,
    branch: existingState.branch,
    counts,
    current_task: taskId,
    updated: timestamp,
  };

  const taskTempPath = path.join(tasksDirectory, `.${matchingNames[0]}.${process.pid}.tmp`);
  writeFileSync(taskTempPath, updatedTask, "utf8");
  renameSync(taskTempPath, target.filePath);
  const separator = existingEvents.length > 0 && !existingEvents.endsWith("\n") ? "\n" : "";
  appendFileSync(eventsPath, `${separator}${JSON.stringify(event)}\n`, "utf8");
  const stateTempPath = path.join(bcosDirectory, `.state.json.${process.pid}.tmp`);
  writeFileSync(stateTempPath, `${JSON.stringify(updatedState, null, 2)}\n`, "utf8");
  renameSync(stateTempPath, statePath);
}

if (argument === "task" && process.argv[3] === "start") {
  startTask();
} else if (argument === "--version") {
  console.log(packageJson.version);
} else if (argument === "--help") {
  console.log("Usage: bcos [--version | --help | task start <id> --actor-role <role> --actor-id <id>]");
} else {
  console.error(`Unknown argument: ${argument ?? "(none)"}`);
  process.exitCode = 1;
}
