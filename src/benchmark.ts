import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type Measure = { value: number | null; source: "measured" | "estimated" | "proxy" | "derived" | "unavailable" };
export type UsageComponent = { phase: "planning" | "worker" | "review" | "single_agent";
  runtime: "codex" | "claude"; input_tokens: Measure; output_tokens: Measure };
export type Trial = { measurement_version: "0.1"; case_id: string;
  arm: "codex_only" | "claude_only" | "bcos"; repetition: number;
  repository_base_commit: string; requirement_sha256: string; environment: Record<string, unknown>;
  system_usage: UsageComponent[]; evaluation_usage: { input_tokens: Measure; output_tokens: Measure };
  human: { intervention_count: Measure; active_ms: Measure }; proxies?: Record<string, Measure>;
  outcome: { status: "success" | "verification_failed" | "review_failed" | "timeout" |
    "worker_error" | "protocol_error" | "aborted"; [key: string]: unknown };
  bcos?: { task_id: string; execution_ids: string[] } };

const sources = new Set(["measured", "estimated", "proxy", "derived", "unavailable"]);
const arms = new Set(["codex_only", "claude_only", "bcos"]);
const statuses = new Set(["success", "verification_failed", "review_failed", "timeout",
  "worker_error", "protocol_error", "aborted"]);
const phases = new Set(["planning", "worker", "review", "single_agent"]);
const runtimes = new Set(["codex", "claude"]);

function fail(name: string, rule: string): never { throw new Error(`${name}: ${rule}`); }
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function measure(value: unknown, name: string, rule: string): asserts value is Measure {
  if (!object(value) || !("value" in value) || !("source" in value)) fail(name, `${rule} must be { value, source }`);
  if (!sources.has(value.source as string)) fail(name, `${rule}.source is invalid`);
  if (value.value !== null && (typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0))
    fail(name, `${rule}.value must be a nonnegative number or null`);
  if (value.source === "unavailable" && value.value !== null) fail(name, `${rule}: unavailable requires null`);
  if (value.source !== "unavailable" && value.value === null) fail(name, `${rule}: available source requires a value`);
}
function tokens(value: unknown, name: string, rule: string): asserts value is Measure {
  measure(value, name, rule);
  if (value.source === "proxy") fail(name, `${rule} must not contain a proxy`);
}
function numericFields(value: unknown, name: string, rule = "trial"): void {
  if (Array.isArray(value)) value.forEach((item, index) => numericFields(item, name, `${rule}[${index}]`));
  else if (object(value)) {
    if ("value" in value || "source" in value) measure(value, name, rule);
    else for (const [key, child] of Object.entries(value)) numericFields(child, name, `${rule}.${key}`);
  } else if (typeof value === "number" && rule !== "trial.repetition") fail(name, `${rule} must use provenance`);
}
function validate(raw: unknown, name: string, root: string): Trial {
  if (!object(raw)) fail(name, "trial must be an object");
  if (raw.measurement_version !== "0.1") fail(name, "measurement_version must be 0.1");
  if (typeof raw.case_id !== "string" || !/^CASE-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(raw.case_id)) fail(name, "case_id slug is invalid");
  if (!arms.has(raw.arm as string)) fail(name, "arm is invalid");
  if (!Number.isInteger(raw.repetition) || (raw.repetition as number) < 1) fail(name, "repetition must be a positive integer");
  const expected = `${raw.case_id}-${raw.arm}-${raw.repetition}.json`;
  if (name !== expected) fail(name, `canonical filename must be ${expected}`);
  if (typeof raw.repository_base_commit !== "string" || !/^[a-fA-F0-9]{40}$/.test(raw.repository_base_commit)) fail(name, "repository_base_commit must be 40 hex characters");
  if (typeof raw.requirement_sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(raw.requirement_sha256)) fail(name, "requirement_sha256 must be 64 hex characters");
  if (!object(raw.outcome) || !statuses.has(raw.outcome.status as string)) fail(name, "outcome.status is invalid");
  if (!Array.isArray(raw.system_usage)) fail(name, "system_usage must be a component list");
  for (const component of raw.system_usage) {
    if (!object(component) || !phases.has(component.phase as string)) fail(name, "system_usage phase is invalid");
    if (!runtimes.has(component.runtime as string)) fail(name, "system_usage runtime is invalid");
    tokens(component.input_tokens, name, "component.input_tokens"); tokens(component.output_tokens, name, "component.output_tokens");
    if (raw.arm === "bcos" ? component.phase === "single_agent" : component.phase !== "single_agent") fail(name, "component phase contradicts arm");
    const baselineRuntime = raw.arm === "codex_only" ? "codex" : "claude";
    if (raw.arm !== "bcos" && component.runtime !== baselineRuntime) fail(name, "component runtime contradicts arm");
  }
  if (!object(raw.evaluation_usage)) fail(name, "evaluation_usage must exist separately");
  tokens(raw.evaluation_usage.input_tokens, name, "evaluation_usage.input_tokens");
  tokens(raw.evaluation_usage.output_tokens, name, "evaluation_usage.output_tokens");
  if (!object(raw.human)) fail(name, "human measurements are required");
  measure(raw.human.intervention_count, name, "human.intervention_count"); measure(raw.human.active_ms, name, "human.active_ms");
  if (raw.human.intervention_count.value !== null && !Number.isInteger(raw.human.intervention_count.value)) fail(name, "human.intervention_count must be an integer");
  if (raw.arm === "bcos") {
    if ("proxies" in raw) fail(name, "bcos trial must not contain proxies");
    if (!object(raw.bcos) || typeof raw.bcos.task_id !== "string" || !/^T-\d{3,}$/.test(raw.bcos.task_id)) fail(name, "bcos.task_id is invalid");
    if (!Array.isArray(raw.bcos.execution_ids) || raw.bcos.execution_ids.length === 0 || raw.bcos.execution_ids.some((id) =>
      typeof id !== "string" || !existsSync(path.join(root, ".bcos", "runs", `${id}.json`)))) fail(name, "bcos.execution_ids must reference run artifacts");
  } else if ("bcos" in raw) fail(name, "baseline trial must not contain bcos");
  if ("proxies" in raw && !object(raw.proxies)) fail(name, "proxies must be an object");
  numericFields(raw, name);
  return raw as Trial;
}

export function readTrials(root = process.cwd()): Trial[] {
  const directory = path.join(root, ".bcos", "benchmarks");
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name) => {
    try { return validate(JSON.parse(readFileSync(path.join(directory, name), "utf8")), name, root); }
    catch (error) { if (error instanceof SyntaxError) fail(name, `invalid JSON: ${error.message}`); throw error; }
  });
}
