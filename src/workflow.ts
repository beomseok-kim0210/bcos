import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { runCodexWorker } from "./runner.js";
import { runReviewer, type ReviewResult } from "./reviewer.js";

type ExitReason = "success" | "nested_worker" | "permission" | "environment" |
  "protocol" | "worker_nonzero" | "timeout" | "verification" | "unknown" |
  "reviewer_failed" | "verdict_unreadable" | "review_cycles_exhausted";

type WorkflowOptions = {
  worker?: string;
  actorId?: string;
  timeoutSeconds?: number;
  workerCommand?: string;
  verifyCommand?: string;
  verifyOnly: boolean;
  review?: boolean;
  reviewer?: string;
  reviewerActorId?: string;
  maxReviewCycles?: number;
  reviewerCommand?: string;
};

function value(content: string, key: string): string | undefined {
  return new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)`, "m").exec(content)?.[1].trim();
}

function taskRecord(taskId: string) {
  const directory = path.join(process.cwd(), ".bcos", "tasks");
  const names = readdirSync(directory).filter((name) =>
    name.startsWith(`${taskId}-`) && name.endsWith(".md")
  );
  if (names.length !== 1) throw new Error(`Expected exactly one Task for ${taskId}`);
  const content = readFileSync(path.join(directory, names[0]), "utf8");
  return { name: names[0], content };
}

function hasReport(taskId: string, taskName: string, attempt: number): boolean {
  const reportPath = path.join(process.cwd(), ".bcos", "reports", taskName);
  if (!existsSync(reportPath)) return false;
  return new RegExp(`^## Attempt ${attempt}(?:[ \\t]|$)`, "m")
    .test(readFileSync(reportPath, "utf8"));
}

function lifecycle(command: "start" | "submit" | "approve" | "request-changes", taskId: string, actorId: string): boolean {
  const role = command === "approve" || command === "request-changes" ? "reviewer" : "worker";
  const result = spawnSync(process.execPath, [
    process.argv[1], "task", command, taskId,
    "--actor-role", role, "--actor-id", actorId,
  ], { cwd: process.cwd(), encoding: "utf8", shell: false });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

function npmCommand(): string | undefined {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory.replace(/^"|"$/g, ""), "node_modules", "npm", "bin", "npm-cli.js");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function verify(command: string): Promise<{ code: number; duration: number; errorCode?: string }> {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const child = spawn(process.execPath, [command, ...(command.endsWith("npm-cli.js") ? ["test"] : [])], {
      cwd: process.cwd(), shell: false, stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (!settled) resolve({ code: 1, duration: Date.now() - started, errorCode: error.code });
      settled = true;
    });
    child.on("close", (code) => {
      if (!settled) resolve({ code: code ?? 1, duration: Date.now() - started });
      settled = true;
    });
  });
}

export async function executeWorkflow(taskId: string | undefined, options: WorkflowOptions): Promise<number> {
  const started = Date.now();
  const startedAt = new Date().toISOString();
  let transitions = 0;
  let runners = 0;
  let verificationRuns = 0;
  let verificationCommand: string | undefined;
  let verificationResult: { code: number; duration: number } | undefined;
  let reviewResult: ReviewResult | undefined;
  let reviewCycle = 0;
  let reviewerInvocations = 0;
  let reworkInvocations = 0;
  let reworkAttempt = 0;
  let feedbackHandoffs = 0;
  let approved = false;
  const nested = process.env.BCOS_WORKER_SESSION !== undefined;
  const finish = (reason: ExitReason, message?: string) => {
    if (message) console.error(message);
    const fields: Record<string, string | number | boolean> = {
      workflow_started_at: startedAt,
      workflow_completed_at: new Date().toISOString(),
      workflow_duration_ms: Date.now() - started,
      workflow_exit_reason: reason,
      nested_worker_detected: nested,
      verification_runs: verificationRuns,
      runner_invocations: runners,
      lifecycle_transitions_caused: transitions,
    };
    if (verificationCommand) fields.verification_command = verificationCommand;
    if (verificationResult) {
      fields.verification_exit_code = verificationResult.code;
      fields.verification_duration_ms = verificationResult.duration;
    }
    if (options.review) {
      fields.reviewer_name = options.reviewer ?? "";
      if (reviewResult) {
        fields.reviewer_runtime = reviewResult.runtime;
        fields.reviewer_duration_ms = reviewResult.duration;
        fields.reviewer_exit_code = reviewResult.code;
        fields.review_started_at = reviewResult.startedAt;
        fields.review_completed_at = reviewResult.completedAt;
        fields.review_verdict = reviewResult.verdict;
      }
      fields.review_cycle = reviewCycle;
      fields.reviewer_invocations = reviewerInvocations;
      fields.rework_invocations = reworkInvocations;
      fields.rework_attempt = reworkAttempt;
      fields.feedback_handoff_count = feedbackHandoffs;
      fields.approval_transition_caused = approved;
      if (reason !== "success") fields.human_escalation_reason = reason;
    }
    for (const [key, fieldValue] of Object.entries(fields)) console.log(`telemetry ${key}=${fieldValue}`);
    return reason === "success" ? 0 : 1;
  };

  if (nested) return finish("nested_worker", "Workflow execution is not allowed inside a BCOS worker session.\nRun this command from the host shell.");
  let probeError: NodeJS.ErrnoException | undefined;
  try {
    probeError = spawnSync(process.execPath, ["-e", ""], { shell: false, stdio: "ignore" }).error;
  } catch (error) {
    probeError = error as NodeJS.ErrnoException;
  }
  if (probeError) {
    return finish(probeError.code === "EPERM" ? "permission" : "environment", "Child process creation is unavailable.");
  }
  if (!taskId || !options.worker || !options.actorId) return finish("protocol", "Task id, --worker, and --actor-id are required");
  if (options.worker !== "codex") return finish("protocol", `Unsupported worker: ${options.worker}`);
  if (options.timeoutSeconds !== undefined && (!Number.isInteger(options.timeoutSeconds) || options.timeoutSeconds <= 0)) {
    return finish("protocol", "--timeout must be a positive integer");
  }
  const maxCycles = options.maxReviewCycles ?? 2;
  if (options.review) {
    if (options.reviewer !== "claude") return finish("protocol", "--reviewer must be claude");
    if (!options.reviewerActorId) return finish("protocol", "--reviewer-actor-id is required");
    if (options.reviewerActorId === options.actorId) return finish("protocol", "Reviewer and worker actor ids must differ");
    if (!Number.isInteger(maxCycles) || maxCycles <= 0) return finish("protocol", "--max-review-cycles must be a positive integer");
    if (options.reviewerCommand && !existsSync(path.resolve(process.cwd(), options.reviewerCommand))) {
      return finish("protocol", `Reviewer command does not exist: ${options.reviewerCommand}`);
    }
  }

  let command: string | undefined;
  if (options.verifyCommand) {
    command = path.resolve(process.cwd(), options.verifyCommand);
    verificationCommand = "custom-verifier";
    if (!existsSync(command)) return finish("protocol", `Verification command does not exist: ${options.verifyCommand}`);
  } else {
    let packageContent: { scripts?: { test?: string } };
    try {
      packageContent = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    } catch {
      return finish("protocol", "Cannot read package.json");
    }
    if (!packageContent.scripts?.test) return finish("protocol", "package.json scripts.test is required");
    command = npmCommand();
    verificationCommand = "npm-test";
    if (!command) return finish("environment", "Cannot find the npm JavaScript entry point on PATH");
  }

  let record: ReturnType<typeof taskRecord>;
  try { record = taskRecord(taskId); } catch (error) {
    return finish("protocol", error instanceof Error ? error.message : String(error));
  }
  const status = value(record.content, "status");
  const attempt = Number(value(record.content, "attempt"));
  if (options.verifyOnly && status !== "IN_PROGRESS") return finish("protocol", "--verify-only requires an IN_PROGRESS Task");
  if (!options.verifyOnly && status !== "TODO" && status !== "IN_PROGRESS") return finish("protocol", `Task ${taskId} is not TODO or IN_PROGRESS`);
  if (!options.verifyOnly && status === "TODO") {
    if (!lifecycle("start", taskId, options.actorId)) return finish("protocol");
    transitions += 1;
  }
  if (!options.verifyOnly) {
    runners += 1;
    let timedOut = false;
    let code: number;
    try {
      code = await runCodexWorker(taskId, {
        worker: options.worker, dryRun: false, timeoutSeconds: options.timeoutSeconds,
        workerCommand: options.workerCommand, onTimeout: () => { timedOut = true; },
      });
    } catch (error) {
      return finish("protocol", error instanceof Error ? error.message : String(error));
    }
    if (code !== 0) return finish(timedOut ? "timeout" : "worker_nonzero");
  }
  const currentAttempt = status === "TODO" ? attempt + 1 : attempt;
  if (!hasReport(taskId, record.name, currentAttempt)) return finish("protocol", `Report for Task ${taskId} is missing attempt ${currentAttempt}`);

  verificationRuns += 1;
  const result = await verify(command);
  verificationResult = { code: result.code, duration: result.duration };
  if (result.errorCode) return finish(result.errorCode === "EPERM" ? "permission" : "environment");
  if (result.code !== 0) return finish("verification");
  if (!lifecycle("submit", taskId, options.actorId)) return finish("unknown");
  transitions += 1;
  if (!options.review) return finish("success");

  while (true) {
    if (reviewCycle >= maxCycles) return escalate("review_cycles_exhausted", "review cycle limit reached");
    reviewCycle += 1;
    reviewerInvocations += 1;
    try {
      reviewResult = await runReviewer(taskId, options.reviewer!, options.reviewerCommand,
        options.timeoutSeconds ?? 1_800, { command: verificationCommand!, code: verificationResult.code, duration: verificationResult.duration });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return escalate(/permission|EPERM/i.test(message) ? "permission" : "environment", message);
    }
    if (reviewResult.timedOut) return escalate("environment", "reviewer timed out");
    if (reviewResult.errorCode) return escalate(reviewResult.errorCode === "EPERM" ? "permission" : "environment", "reviewer failed to start");
    if (reviewResult.code !== 0) return escalate("reviewer_failed", `reviewer exited ${reviewResult.code}`);
    if (reviewResult.verdict === "unreadable") return escalate("verdict_unreadable", "review verdict is unreadable");
    if (reviewResult.verdict === "APPROVED") {
      if (!lifecycle("approve", taskId, options.reviewerActorId!)) return finish("unknown");
      transitions += 1; approved = true;
      return finish("success");
    }
    if (!lifecycle("request-changes", taskId, options.reviewerActorId!)) return finish("unknown");
    transitions += 1; feedbackHandoffs += 1; reworkInvocations += 1;
    const changed = taskRecord(taskId);
    reworkAttempt = Number(value(changed.content, "attempt"));
    let timedOut = false;
    const workerCode = await runCodexWorker(taskId, { worker: options.worker, dryRun: false,
      timeoutSeconds: options.timeoutSeconds, workerCommand: options.workerCommand,
      onTimeout: () => { timedOut = true; } });
    runners += 1;
    if (workerCode !== 0) return finish(timedOut ? "timeout" : "worker_nonzero");
    if (!hasReport(taskId, changed.name, reworkAttempt)) return finish("protocol", `Report for Task ${taskId} is missing attempt ${reworkAttempt}`);
    verificationRuns += 1;
    const nextVerification = await verify(command);
    verificationResult = { code: nextVerification.code, duration: nextVerification.duration };
    if (nextVerification.errorCode) return finish(nextVerification.errorCode === "EPERM" ? "permission" : "environment");
    if (nextVerification.code !== 0) return escalate("verification", "rework verification failed");
    if (!lifecycle("submit", taskId, options.actorId)) return finish("unknown");
    transitions += 1;
  }

  function escalate(reason: ExitReason, detail: string): number {
    let state = "unknown";
    try { state = value(taskRecord(taskId!).content, "status") ?? state; } catch { /* reported below */ }
    const verdict = reviewResult?.verdict ?? "unreadable";
    const reviewPath = reviewResult?.reviewPath ?? path.join(".bcos", "reviews", record.name);
    console.error(`Human escalation: ${detail}\nStopped at: review workflow\nTask state: ${state}\nLast verdict: ${verdict}\nReview: ${reviewPath}\nNext action: inspect the Review and continue the lifecycle manually.`);
    return finish(reason);
  }
}
