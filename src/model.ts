import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type ModelRuntime = "codex" | "claude";
export type ModelResult = {
  exitCode: number; durationMs: number; stdoutBytes: number; stderrBytes: number;
  firstResponseMs?: number; timedOut: boolean; error?: "not_found" | "spawn_failed";
  errorCode?: string; runtime: ModelRuntime; runtimeKind: "node" | "native"; version: string;
};
export type ModelOptions = {
  runtime: ModelRuntime; cwd: string; stdin: string; timeoutSeconds: number;
  env?: NodeJS.ProcessEnv; commandOverride?: string; onTimeout?: () => void;
};
export type ModelCommand = {
  command?: string; args: string[]; runtimeKind: "node" | "native"; version: string;
};

function pathEntries(): string[] {
  return (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)
    .map((entry) => entry.replace(/^"|"$/g, ""));
}

function codexEntry(): string | undefined {
  for (const directory of pathEntries()) {
    const candidate = path.join(directory, "node_modules", "@openai", "codex", "bin", "codex.js");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function claudeEntry(): string | undefined {
  const name = process.platform === "win32" ? "claude.exe" : "claude";
  for (const directory of pathEntries()) {
    const candidate = path.join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function codexVersion(entry: string): string {
  try {
    const packageFile = path.resolve(path.dirname(entry), "..", "package.json");
    const value = JSON.parse(readFileSync(packageFile, "utf8")) as { version?: unknown };
    return typeof value.version === "string" ? value.version : "unknown";
  } catch { return "unknown"; }
}

function claudeVersion(command: string): string {
  try {
    const probe = spawnSync(command, ["--version"], { encoding: "utf8", shell: false, timeout: 5_000 });
    return /^\s*(\d+\.\d+\.\d+)/.exec(probe.stdout ?? "")?.[1] ?? "unknown";
  } catch { return "unknown"; }
}

export function modelCommand(options: Pick<ModelOptions, "runtime" | "cwd" | "commandOverride">): ModelCommand {
  if (options.commandOverride) {
    const entry = path.resolve(options.cwd, options.commandOverride);
    const node = options.runtime === "codex" || entry.endsWith(".js");
    const args = options.runtime === "codex" ? [entry, "exec", "-", "--cd", options.cwd]
      : [entry, "-p", "--output-format", "text"];
    return { command: existsSync(entry) ? (node ? process.execPath : entry) : undefined,
      args: node ? args : args.slice(1), runtimeKind: node ? "node" : "native", version: "override" };
  }
  if (options.runtime === "codex") {
    const entry = codexEntry();
    return { command: entry ? process.execPath : undefined,
      args: entry ? [entry, "exec", "-", "--cd", options.cwd] : [], runtimeKind: "node",
      version: entry ? codexVersion(entry) : "unknown" };
  }
  const entry = claudeEntry();
  return { command: entry, args: ["-p", "--output-format", "text"], runtimeKind: "native",
    version: entry ? claudeVersion(entry) : "unknown" };
}

export function runModel(options: ModelOptions): Promise<ModelResult> {
  const prepared = modelCommand(options);
  const base = { runtime: options.runtime, runtimeKind: prepared.runtimeKind, version: prepared.version };
  if (!prepared.command) return Promise.resolve({ ...base, exitCode: 1, durationMs: 0,
    stdoutBytes: 0, stderrBytes: 0, timedOut: false, error: "not_found" });
  return new Promise((resolve) => {
    const started = Date.now(); let firstResponseMs: number | undefined;
    let stdoutBytes = 0; let stderrBytes = 0; let timedOut = false; let settled = false;
    let child;
    try {
      child = spawn(prepared.command!, prepared.args, { cwd: options.cwd, shell: false,
        stdio: ["pipe", "pipe", "pipe"], env: options.env ?? process.env });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      resolve({ ...base, exitCode: 1, durationMs: Date.now() - started, stdoutBytes, stderrBytes,
        timedOut: false, error: "spawn_failed", ...(code ? { errorCode: code } : {}) });
      return;
    }
    const timer = setTimeout(() => { timedOut = true; options.onTimeout?.(); child.kill(); },
      options.timeoutSeconds * 1_000);
    const output = (chunk: Buffer, stderr: boolean) => {
      firstResponseMs ??= Date.now() - started;
      if (stderr) { stderrBytes += chunk.length; process.stderr.write(chunk); }
      else { stdoutBytes += chunk.length; process.stdout.write(chunk); }
    };
    child.stdout.on("data", (chunk: Buffer) => output(chunk, false));
    child.stderr.on("data", (chunk: Buffer) => output(chunk, true));
    const done = (exitCode: number, error?: "spawn_failed", errorCode?: string) => {
      if (settled) return; settled = true; clearTimeout(timer);
      resolve({ ...base, exitCode, durationMs: Date.now() - started, stdoutBytes, stderrBytes,
        ...(firstResponseMs === undefined ? {} : { firstResponseMs }), timedOut, ...(error ? { error } : {}),
        ...(errorCode ? { errorCode } : {}) });
    };
    child.on("error", (error: NodeJS.ErrnoException) => done(1, "spawn_failed", error.code));
    child.on("close", (code) => done(code ?? 1));
    child.stdin.on("error", () => undefined); child.stdin.end(options.stdin, "utf8");
  });
}
