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
import { buildContextPackage } from "./context.js";
import { runCodexWorker, type RunWorkerOptions } from "./runner.js";
import { executeWorkflow } from "./workflow.js";

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

  for (const [index, name] of names.entries()) {
    const match = new RegExp(`^## ${name}[ \\t]*(?:\\r?\\n|$)`, "m").exec(content);
    if (!match || match.index <= previousIndex) return false;
    const bodyStart = match.index + match[0].length;
    const nextHeading = index < names.length - 1
      ? /^## /m.exec(content.slice(bodyStart))
      : undefined;
    const bodyEnd = nextHeading ? bodyStart + nextHeading.index : content.length;
    const value = content.slice(bodyStart, bodyEnd).trim();
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

function actorArguments(): { actorRole: string; actorId: string } {
  const args = process.argv.slice(2);
  const roleIndex = args.indexOf("--actor-role");
  const idIndex = args.indexOf("--actor-id");
  const actorRole = roleIndex >= 0 ? args[roleIndex + 1] : undefined;
  const actorId = idIndex >= 0 ? args[idIndex + 1] : undefined;

  if (!actorRole || !actorId) fail("Both --actor-role and --actor-id are required");
  return { actorRole, actorId };
}

function readTaskSet(taskId: string) {
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

  return { bcosDirectory, tasksDirectory, matchingName: matchingNames[0], taskRecords, target };
}

function persistTransition(
  taskSet: ReturnType<typeof readTaskSet>,
  taskId: string,
  targetStatus: string,
  updatedTask: string,
  event: Record<string, unknown>,
  timestamp: string,
): void {
  const { bcosDirectory, tasksDirectory, matchingName, taskRecords, target } = taskSet;
  const eventsPath = path.join(bcosDirectory, "events.jsonl");
  const statePath = path.join(bcosDirectory, "state.json");
  const existingEvents = readFileSync(eventsPath, "utf8");
  const existingState = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const statuses = ["TODO", "IN_PROGRESS", "IMPLEMENTED", "DONE", "BLOCKED"];
  const counts = Object.fromEntries(statuses.map((taskStatus) => [taskStatus, 0]));
  let currentTask: string | null = null;
  for (const record of taskRecords) {
    const recordStatus = record === target ? targetStatus : frontmatterValue(record.content, "status");
    if (recordStatus && recordStatus in counts) counts[recordStatus] += 1;
    if (recordStatus === "IN_PROGRESS") {
      currentTask = record === target ? taskId : frontmatterValue(record.content, "id") ?? null;
    }
  }
  const updatedState = {
    protocol: existingState.protocol,
    version: existingState.version,
    project: existingState.project,
    branch: existingState.branch,
    counts,
    current_task: currentTask,
    updated: timestamp,
  };

  const taskTempPath = path.join(tasksDirectory, `.${matchingName}.${process.pid}.tmp`);
  writeFileSync(taskTempPath, updatedTask, "utf8");
  renameSync(taskTempPath, target.filePath);
  const separator = existingEvents.length > 0 && !existingEvents.endsWith("\n") ? "\n" : "";
  appendFileSync(eventsPath, `${separator}${JSON.stringify(event)}\n`, "utf8");
  const stateTempPath = path.join(bcosDirectory, `.state.json.${process.pid}.tmp`);
  writeFileSync(stateTempPath, `${JSON.stringify(updatedState, null, 2)}\n`, "utf8");
  renameSync(stateTempPath, statePath);
}

function startTask(): void {
  const taskId = process.argv[4];
  const { actorRole, actorId } = actorArguments();
  const taskSet = readTaskSet(taskId);
  const { taskRecords, target } = taskSet;

  const status = frontmatterValue(target.content, "status");
  if (status !== "TODO") fail(`Task ${taskId} is not TODO`);
  if (taskRecords.some(({ content }) => frontmatterValue(content, "status") === "IN_PROGRESS")) {
    fail("Another Task is already IN_PROGRESS");
  }
  if (!hasRequiredSections(target.content)) fail(`Task ${taskId} has an empty required section`);

  const currentAttempt = Number(frontmatterValue(target.content, "attempt"));
  if (!Number.isInteger(currentAttempt) || currentAttempt < 0) fail(`Task ${taskId} has an invalid attempt`);

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

  persistTransition(taskSet, taskId, "IN_PROGRESS", updatedTask, event, timestamp);
}

function submitTask(): void {
  const taskId = process.argv[4];
  const { actorRole, actorId } = actorArguments();
  const taskSet = readTaskSet(taskId);
  const { bcosDirectory, target } = taskSet;
  if (frontmatterValue(target.content, "status") !== "IN_PROGRESS") {
    fail(`Task ${taskId} is not IN_PROGRESS`);
  }

  const attempt = Number(frontmatterValue(target.content, "attempt"));
  if (!Number.isInteger(attempt) || attempt < 1) fail(`Task ${taskId} has an invalid attempt`);
  const reportsDirectory = path.join(bcosDirectory, "reports");
  let reportNames: string[];
  try {
    reportNames = readdirSync(reportsDirectory)
      .filter((name) => name.startsWith(`${taskId}-`) && name.endsWith(".md"));
  } catch {
    fail(`Report for Task ${taskId} is missing attempt ${attempt}`);
  }
  const attemptHeading = new RegExp(`^## Attempt ${attempt}(?:[ \\t]|$)`, "m");
  const hasReport = reportNames.some((name) =>
    attemptHeading.test(readFileSync(path.join(reportsDirectory, name), "utf8"))
  );
  if (!hasReport) fail(`Report for Task ${taskId} is missing attempt ${attempt}`);

  const timestamp = new Date().toISOString();
  const updatedTask = replaceFrontmatterValue(
    replaceFrontmatterValue(target.content, "status", "IMPLEMENTED"),
    "updated",
    timestamp,
  );
  const event = {
    ts: timestamp,
    event: "TASK_SUBMITTED",
    task: taskId,
    attempt,
    actor_role: actorRole,
    actor_id: actorId,
    from: "IN_PROGRESS",
    to: "IMPLEMENTED",
  };

  persistTransition(taskSet, taskId, "IMPLEMENTED", updatedTask, event, timestamp);
}

function submittedActor(bcosDirectory: string, taskId: string, attempt: number): string | undefined {
  const eventsPath = path.join(bcosDirectory, "events.jsonl");
  const events = readFileSync(eventsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const submitted = events.find((event) =>
    event.task === taskId && event.event === "TASK_SUBMITTED" && event.attempt === attempt
  );
  return typeof submitted?.actor_id === "string" ? submitted.actor_id : undefined;
}

function approveTask(): void {
  const taskId = process.argv[4];
  const { actorRole, actorId } = actorArguments();
  const taskSet = readTaskSet(taskId);
  const { bcosDirectory, target } = taskSet;
  if (frontmatterValue(target.content, "status") !== "IMPLEMENTED") {
    fail(`Task ${taskId} is not IMPLEMENTED`);
  }
  if (actorRole !== "reviewer" && actorRole !== "human") {
    fail("Only reviewer or human may approve a Task");
  }

  const attempt = Number(frontmatterValue(target.content, "attempt"));
  if (!Number.isInteger(attempt) || attempt < 1) fail(`Task ${taskId} has an invalid attempt`);
  const reviewsDirectory = path.join(bcosDirectory, "reviews");
  let reviewNames: string[];
  try {
    reviewNames = readdirSync(reviewsDirectory)
      .filter((name) => name.startsWith(`${taskId}-`) && name.endsWith(".md"));
  } catch {
    fail(`Approved Review for Task ${taskId} attempt ${attempt} is missing`);
  }
  const approvedHeading = new RegExp(
    `^## Attempt ${attempt} — .+ — APPROVED[ \\t]*\\r?$`,
    "m",
  );
  const hasApproval = reviewNames.some((name) =>
    approvedHeading.test(readFileSync(path.join(reviewsDirectory, name), "utf8"))
  );
  if (!hasApproval) fail(`Approved Review for Task ${taskId} attempt ${attempt} is missing`);

  const submitterId = submittedActor(bcosDirectory, taskId, attempt);
  if (!submitterId) fail(`Submit event for Task ${taskId} attempt ${attempt} is missing`);
  if (submitterId === actorId) fail("The submitting actor cannot approve the same attempt");

  const timestamp = new Date().toISOString();
  const updatedTask = replaceFrontmatterValue(
    replaceFrontmatterValue(target.content, "status", "DONE"),
    "updated",
    timestamp,
  );
  const event = {
    ts: timestamp,
    event: "TASK_APPROVED",
    task: taskId,
    attempt,
    actor_role: actorRole,
    actor_id: actorId,
    from: "IMPLEMENTED",
    to: "DONE",
  };

  persistTransition(taskSet, taskId, "DONE", updatedTask, event, timestamp);
}

function contextTask(): void {
  const taskId = process.argv[4];
  if (!taskId) fail("Task id is required");
  try {
    const contextPackage = buildContextPackage(taskId);
    if (contextPackage.warning) console.error(contextPackage.warning);
    process.stdout.write(contextPackage.output);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function runTask(): void {
  const taskId = process.argv[4];
  if (!taskId) fail("Task id is required");
  const args = process.argv.slice(5);
  const workerIndex = args.indexOf("--worker");
  const timeoutIndex = args.indexOf("--timeout");
  const commandIndex = args.indexOf("--worker-command");
  const worker = workerIndex >= 0 ? args[workerIndex + 1] : undefined;
  if (!worker) fail("--worker is required");

  const options: RunWorkerOptions = {
    worker,
    dryRun: args.includes("--dry-run"),
    timeoutSeconds: timeoutIndex >= 0 ? Number(args[timeoutIndex + 1]) : undefined,
    workerCommand: commandIndex >= 0 ? args[commandIndex + 1] : undefined,
  };
  const valued = new Set(["--worker", "--timeout", "--worker-command"]);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (valued.has(value)) {
      if (!args[index + 1] || args[index + 1].startsWith("--")) fail(`${value} requires a value`);
      index += 1;
    } else if (value !== "--dry-run") {
      fail(`Unknown task run option: ${value}`);
    }
  }

  runCodexWorker(taskId, options)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

function executeTask(): void {
  const taskId = process.argv[4];
  const args = process.argv.slice(5);
  const valued = new Set(["--worker", "--actor-id", "--timeout", "--worker-command", "--verify-command"]);
  const parsed = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (valued.has(option)) {
      if (!args[index + 1] || args[index + 1].startsWith("--")) {
        executeWorkflow(taskId, { verifyOnly: args.includes("--verify-only") })
          .then((code) => { process.exitCode = code; });
        return;
      }
      parsed.set(option, args[index + 1]);
      index += 1;
    } else if (option !== "--verify-only") {
      console.error(`Unknown task execute option: ${option}`);
      executeWorkflow(undefined, { verifyOnly: args.includes("--verify-only") })
        .then((code) => { process.exitCode = code; });
      return;
    }
  }
  executeWorkflow(taskId, {
    worker: parsed.get("--worker"),
    actorId: parsed.get("--actor-id"),
    timeoutSeconds: parsed.has("--timeout") ? Number(parsed.get("--timeout")) : undefined,
    workerCommand: parsed.get("--worker-command"),
    verifyCommand: parsed.get("--verify-command"),
    verifyOnly: args.includes("--verify-only"),
  }).then((code) => { process.exitCode = code; });
}

if (argument === "task" && process.argv[3] === "start") {
  startTask();
} else if (argument === "task" && process.argv[3] === "submit") {
  submitTask();
} else if (argument === "task" && process.argv[3] === "approve") {
  approveTask();
} else if (argument === "task" && process.argv[3] === "context") {
  contextTask();
} else if (argument === "task" && process.argv[3] === "run") {
  runTask();
} else if (argument === "task" && process.argv[3] === "execute") {
  executeTask();
} else if (argument === "--version") {
  console.log(packageJson.version);
} else if (argument === "--help") {
  console.log("Usage: bcos [--version | --help | task <start|submit|approve|context|run|execute> <id>]");
} else {
  console.error(`Unknown argument: ${argument ?? "(none)"}`);
  process.exitCode = 1;
}
