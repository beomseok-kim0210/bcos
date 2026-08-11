import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const stageNames = ["start", "worker", "report_check", "verification", "submit",
  "review", "approve", "request_changes"] as const;
export type Stage = typeof stageNames[number];
export type StageStatus = "not_started" | "skipped" | "running" | "success" | "failed";
export type RunRecord = {
  execution_id: string; task_id: string; attempt: number; started_at: string; updated_at: string;
  completed_at?: string; workflow_status: "running" | "success" | "failed";
  workflow_exit_reason?: string; current_stage?: Stage; verification_command?: string;
  stages: Record<Stage, StageStatus>;
};

function runsDirectory(root = process.cwd()): string {
  return path.join(root, ".bcos", "runs");
}

function write(record: RunRecord, root = process.cwd()): void {
  const directory = runsDirectory(root);
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${record.execution_id}.json`);
  const temporary = path.join(directory, `.${record.execution_id}.${process.pid}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  renameSync(temporary, target);
}

export function createRun(taskId: string, attempt: number, skipped: Stage[] = []): RunRecord {
  const now = new Date();
  const timestamp = now.toISOString();
  const compact = timestamp.replace(/[-:.]/g, "");
  const executionId = `${compact}-${randomBytes(4).toString("hex")}`;
  const stages = Object.fromEntries(stageNames.map((name) => [name,
    skipped.includes(name) ? "skipped" : "not_started"])) as Record<Stage, StageStatus>;
  const record: RunRecord = { execution_id: executionId, task_id: taskId, attempt,
    started_at: timestamp, updated_at: timestamp, workflow_status: "running", stages };
  write(record);
  return record;
}

export function markStage(record: RunRecord, stage: Stage, status: StageStatus): void {
  record.current_stage = stage;
  record.stages[stage] = status;
  record.updated_at = new Date().toISOString();
  write(record);
}

export function finishRun(record: RunRecord, success: boolean, reason: string): void {
  const timestamp = new Date().toISOString();
  record.updated_at = timestamp;
  record.completed_at = timestamp;
  record.workflow_status = success ? "success" : "failed";
  record.workflow_exit_reason = reason;
  write(record);
}

export function updateRun(record: RunRecord): void {
  record.updated_at = new Date().toISOString();
  write(record);
}

export function readRuns(taskId: string, root = process.cwd()): RunRecord[] {
  const directory = runsDirectory(root);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((name) => /^[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}\.json$/.test(name))
    .sort().map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8")) as RunRecord)
    .filter((record) => record.task_id === taskId);
}
