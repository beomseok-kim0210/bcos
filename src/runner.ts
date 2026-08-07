import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildContextPackage } from "./context.js";

const DEFAULT_TIMEOUT_SECONDS = 1_800;

export type RunWorkerOptions = {
  worker: string;
  dryRun: boolean;
  timeoutSeconds?: number;
  workerCommand?: string;
  onTimeout?: () => void;
};

type PreparedRun = {
  command: string;
  args: string[];
  cwd: string;
  taskId: string;
  worker: string;
  timeoutSeconds: number;
  contextFileCount: number;
  contextBytes: number;
  contextLines: number;
  contextChars: number;
  contextSha256: string;
  stdin: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function frontmatterValue(content: string, key: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1];
  return frontmatter
    ? new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)$`, "m").exec(frontmatter)?.[1].trim()
    : undefined;
}

function findWorkerCommand(rootDirectory: string, override?: string): string {
  if (override) {
    const resolved = path.resolve(rootDirectory, override);
    if (!existsSync(resolved)) throw new Error(`Worker command does not exist: ${override}`);
    return resolved;
  }

  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(
      directory.replace(/^"|"$/g, ""),
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js",
    );
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Cannot find the Codex JavaScript entry point on PATH");
}

function buildPreamble(taskId: string, worker: string, reportPath: string): string {
  return `BCOS WORKER EXECUTION

  task:   ${taskId}
  worker: ${worker}
  report: ${reportPath}

너는 이 저장소의 worker다. actor_role: worker.

CONTEXT PACKAGE 안에 Task 문서가 있다. 그것이 네 계약이다. 먼저 끝까지 읽어라.
행동 규칙은 같은 패키지의 AGENTS.md에 있다.

CONTEXT PACKAGE 안의 파일이 네가 읽어야 할 전부다.
그 목록 밖의 파일을 임의로 열지 마라. 저장소 전체를 탐색하지 마라.
git 명령을 실행하지 마라. bcos 명령을 실행하지 마라.
승인을 시도하지 마라. 독립 reviewer가 검토한다.

Task의 Acceptance Criteria를 전부 충족했을 때만 완료라고 보고하라.
막히면 추측하지 말고 멈추고 무엇이 막혔는지 적어라.

작업을 마치면 위 경로에 Report를 쓰고 멈춰라.`;
}

function headerNumber(output: string, key: string): number {
  const value = Number(new RegExp(`^${key}: (\\d+)$`, "m").exec(output)?.[1]);
  if (!Number.isInteger(value)) throw new Error(`Context Package ${key} is missing`);
  return value;
}

function prepareRun(taskId: string, options: RunWorkerOptions): PreparedRun {
  if (options.worker !== "codex") throw new Error(`Unsupported worker: ${options.worker}`);
  const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error("--timeout must be a positive integer");
  }

  const rootDirectory = process.cwd();
  const tasksDirectory = path.join(rootDirectory, ".bcos", "tasks");
  let taskNames: string[];
  try {
    taskNames = readdirSync(tasksDirectory)
      .filter((name) => name.startsWith(`${taskId}-`) && name.endsWith(".md"));
  } catch {
    throw new Error(`Cannot read tasks directory: ${tasksDirectory}`);
  }
  if (taskNames.length !== 1) throw new Error(`Expected exactly one Task for ${taskId}`);
  const taskContent = readFileSync(path.join(tasksDirectory, taskNames[0]), "utf8");
  if (frontmatterValue(taskContent, "status") !== "IN_PROGRESS") {
    throw new Error(`Task ${taskId} is not IN_PROGRESS`);
  }

  const contextPackage = buildContextPackage(taskId, rootDirectory);
  if (contextPackage.warning) console.error(contextPackage.warning);
  const taskRelativePath = path.join(".bcos", "tasks", taskNames[0]);
  const expectedTaskPath = taskRelativePath.replaceAll("\\", "/");
  const hasTaskFile = contextPackage.output.replaceAll("\\", "/").split("\n")
    .some((line) => /^--- FILE \d+\/\d+: /.test(line) && line.endsWith(`: ${expectedTaskPath} ---`));
  if (!hasTaskFile) {
    throw new Error(`Read List is missing its Task file: ${taskRelativePath}`);
  }

  const reportPath = path.join(".bcos", "reports", taskNames[0]);
  const stdin = `${buildPreamble(taskId, options.worker, reportPath)}\n\n--- CONTEXT PACKAGE ---\n${contextPackage.output}`;
  const workerCommand = findWorkerCommand(rootDirectory, options.workerCommand);
  return {
    command: process.execPath,
    args: [workerCommand, "exec", "-", "--cd", rootDirectory],
    cwd: rootDirectory,
    taskId,
    worker: options.worker,
    timeoutSeconds,
    contextFileCount: headerNumber(contextPackage.output, "files"),
    contextBytes: Buffer.byteLength(contextPackage.output, "utf8"),
    contextLines: headerNumber(contextPackage.output, "lines"),
    contextChars: headerNumber(contextPackage.output, "characters"),
    contextSha256: sha256(contextPackage.output),
    stdin,
  };
}

function telemetry(prepared: PreparedRun, values: Record<string, string | number | boolean> = {}): void {
  const fields: Record<string, string | number | boolean> = {
    task_id: prepared.taskId,
    worker_name: prepared.worker,
    worker_runtime: "node",
    context_files: prepared.contextFileCount,
    context_bytes: prepared.contextBytes,
    context_lines: prepared.contextLines,
    context_chars: prepared.contextChars,
    context_sha256: prepared.contextSha256,
    stdin_bytes: Buffer.byteLength(prepared.stdin, "utf8"),
    stdin_sha256: sha256(prepared.stdin),
    worker_timeout_seconds: prepared.timeoutSeconds,
    ...values,
    retry_count: 0,
    runner_transitions_caused: 0,
  };
  for (const [key, value] of Object.entries(fields)) console.log(`telemetry ${key}=${value}`);
}

function printDryRun(prepared: PreparedRun): void {
  console.log(`command: ${prepared.command}`);
  console.log(`args: ${JSON.stringify(prepared.args)}`);
  console.log(`cwd: ${prepared.cwd}`);
  console.log(`Context file count: ${prepared.contextFileCount}`);
  console.log(`Context SHA-256: ${prepared.contextSha256}`);
  console.log(`stdin SHA-256: ${sha256(prepared.stdin)}`);
  console.log(`stdin characters: ${prepared.stdin.length}`);
  console.log(`stdin lines: ${prepared.stdin.split(/\r\n|\r|\n/).length}`);
  telemetry(prepared, { worker_timed_out: false });
}

export async function runCodexWorker(taskId: string, options: RunWorkerOptions): Promise<number> {
  const prepared = prepareRun(taskId, options);
  if (options.dryRun) {
    printDryRun(prepared);
    return 0;
  }

  return new Promise((resolve) => {
    const started = Date.now();
    let firstResponse: number | undefined;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let settled = false;
    const child = spawn(prepared.command, prepared.args, {
      cwd: prepared.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, BCOS_WORKER_SESSION: "1" },
    });
    const timer = setTimeout(() => {
      timedOut = true;
      options.onTimeout?.();
      child.kill();
    }, prepared.timeoutSeconds * 1_000);

    const noteResponse = () => { firstResponse ??= Date.now() - started; };
    child.stdout.on("data", (chunk: Buffer) => {
      noteResponse();
      stdoutBytes += chunk.length;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      noteResponse();
      stderrBytes += chunk.length;
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.error(`Worker failed to start: ${error.message}`);
      telemetry(prepared, {
        worker_duration_ms: Date.now() - started,
        worker_exit_code: 1,
        worker_timed_out: false,
        worker_stdout_bytes: stdoutBytes,
        worker_stderr_bytes: stderrBytes,
      });
      resolve(1);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const duration = Date.now() - started;
      if (timedOut) console.error(`Worker timed out after ${prepared.timeoutSeconds} seconds`);
      else if (code && code !== 0) console.error(`Worker failed with exit code ${code}`);
      const execution = {
        ...(firstResponse === undefined ? {} : { first_worker_response_ms: firstResponse }),
        worker_duration_ms: duration,
        worker_exit_code: code ?? "N/A",
        worker_timed_out: timedOut,
        worker_stdout_bytes: stdoutBytes,
        worker_stderr_bytes: stderrBytes,
      };
      telemetry(prepared, execution);
      resolve(timedOut ? 1 : code ?? 1);
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(prepared.stdin, "utf8");
  });
}
