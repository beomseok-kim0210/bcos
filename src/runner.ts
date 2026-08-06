import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildContextPackage } from "./context.js";

export type RunWorkerOptions = {
  worker: string;
  dryRun: boolean;
  timeoutSeconds?: number;
  workerCommand?: string;
};

type PreparedRun = {
  command: string;
  args: string[];
  cwd: string;
  promptPath: string;
  contextFileCount: number;
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

function extractPrompt(content: string): string {
  const match = /(?:^|\r?\n)---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match || !match[1].trim()) throw new Error("Worker Prompt body is missing or empty");
  return match[1];
}

function prepareRun(taskId: string, options: RunWorkerOptions): PreparedRun {
  if (options.worker !== "codex") throw new Error(`Unsupported worker: ${options.worker}`);
  if (options.timeoutSeconds !== undefined
    && (!Number.isInteger(options.timeoutSeconds) || options.timeoutSeconds <= 0)) {
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

  const promptsDirectory = path.join(rootDirectory, ".bcos", "prompts");
  let promptNames: string[];
  try {
    promptNames = readdirSync(promptsDirectory)
      .filter((name) => name.startsWith(`${taskId}-`) && name.endsWith(".md"));
  } catch {
    throw new Error(`Cannot read prompts directory: ${promptsDirectory}`);
  }
  if (promptNames.length !== 1) throw new Error(`Expected exactly one Worker Prompt for ${taskId}`);
  const promptRelativePath = path.join(".bcos", "prompts", promptNames[0]);
  const promptBody = extractPrompt(readFileSync(path.join(rootDirectory, promptRelativePath), "utf8"));
  const contextPackage = buildContextPackage(taskId, rootDirectory);
  if (contextPackage.warning) console.error(contextPackage.warning);
  const contextFileCount = Number(/^files: (\d+)$/m.exec(contextPackage.output)?.[1]);
  if (!Number.isInteger(contextFileCount)) throw new Error("Context Package file count is missing");

  const reportPath = path.join(".bcos", "reports", taskNames[0]);
  const stdin = [
    "BCOS WORKER EXECUTION",
    "",
    `task: ${taskId}`,
    `worker: ${options.worker}`,
    `report: ${reportPath}`,
    "",
    "이 입력은 BCOS가 조립했다. CONTEXT PACKAGE 안의 파일이 네가 읽어야 할 전부다.",
    "그 목록 밖의 파일을 임의로 열지 마라. git 명령을 실행하지 마라.",
    "`task submit`을 비롯한 어떤 bcos 명령도 실행하지 마라. 작업을 마치면 Report를 쓰고 멈춰라.",
    "",
    "--- WORKER INSTRUCTIONS ---",
    promptBody,
    "",
    "--- CONTEXT PACKAGE ---",
    contextPackage.output,
  ].join("\n");
  const workerCommand = findWorkerCommand(rootDirectory, options.workerCommand);
  return {
    command: process.execPath,
    args: [workerCommand, "exec", "-", "--cd", rootDirectory],
    cwd: rootDirectory,
    promptPath: promptRelativePath,
    contextFileCount,
    contextSha256: sha256(contextPackage.output),
    stdin,
  };
}

function printDryRun(prepared: PreparedRun): void {
  console.log(`command: ${prepared.command}`);
  console.log(`args: ${JSON.stringify(prepared.args)}`);
  console.log(`cwd: ${prepared.cwd}`);
  console.log(`Prompt: ${prepared.promptPath}`);
  console.log(`Context file count: ${prepared.contextFileCount}`);
  console.log(`Context SHA-256: ${prepared.contextSha256}`);
  console.log(`stdin SHA-256: ${sha256(prepared.stdin)}`);
  console.log(`stdin characters: ${prepared.stdin.length}`);
  console.log(`stdin lines: ${prepared.stdin.split(/\r\n|\r|\n/).length}`);
}

export async function runCodexWorker(
  taskId: string,
  options: RunWorkerOptions,
): Promise<number> {
  const prepared = prepareRun(taskId, options);
  if (options.dryRun) {
    printDryRun(prepared);
    return 0;
  }

  return new Promise((resolve) => {
    const started = Date.now();
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let settled = false;
    const child = spawn(prepared.command, prepared.args, {
      cwd: prepared.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timer = options.timeoutSeconds === undefined
      ? undefined
      : setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutSeconds * 1_000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      console.error(`Worker failed to start: ${error.message}`);
      resolve(1);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const duration = Date.now() - started;
      if (timedOut) {
        console.error(`Worker timed out after ${options.timeoutSeconds} seconds`);
        console.error(`Worker duration ms: ${duration}`);
        resolve(1);
        return;
      }
      console.log(`Worker exit code: ${code ?? "none"}`);
      console.log(`Worker duration ms: ${duration}`);
      console.log(`Worker stdout bytes: ${stdoutBytes}`);
      console.log(`Worker stderr bytes: ${stderrBytes}`);
      if (code && code !== 0) console.error(`Worker failed with exit code ${code}`);
      resolve(code ?? 1);
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(prepared.stdin, "utf8");
  });
}
