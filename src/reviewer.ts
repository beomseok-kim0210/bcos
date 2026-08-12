import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { buildContextPackage } from "./context.js";
import { runModel } from "./model.js";

export type ReviewResult = {
  code: number; duration: number; startedAt: string; completedAt: string;
  timedOut: boolean; errorCode?: string; verdict: "APPROVED" | "CHANGES_REQUESTED" | "unreadable";
  reviewPath: string; runtime: string;
  version: string; stdoutBytes: number; stderrBytes: number; firstResponseMs?: number;
};

function taskInfo(taskId: string, root: string) {
  const directory = path.join(root, ".bcos", "tasks");
  const names = readdirSync(directory).filter((name) => name.startsWith(`${taskId}-`) && name.endsWith(".md"));
  if (names.length !== 1) throw new Error(`Expected exactly one Task for ${taskId}`);
  const content = readFileSync(path.join(directory, names[0]), "utf8");
  const attempt = Number(/^attempt:[ \t]*(\d+)/m.exec(content)?.[1]);
  return { name: names[0], attempt };
}

function input(taskId: string, attempt: number, reviewer: string, reviewPath: string, evidence: { command: string; code: number; duration: number }, context: string): string {
  return `BCOS REVIEW EXECUTION

  task:     ${taskId}
  attempt:  ${attempt}
  reviewer: ${reviewer}
  review:   ${reviewPath}

너는 이 저장소의 reviewer다. actor_role: reviewer.

CONTEXT PACKAGE 안에 Task 문서와 Report가 있다. Report를 신뢰하지 마라.
Task의 Acceptance Criteria를 하나씩 직접 확인하라.

호스트 검증은 BCOS가 이미 실행했다. 결과는 아래에 있다.
그 결과를 증거로 쓰고 테스트를 다시 실행하지 마라.

판정은 APPROVED 또는 CHANGES_REQUESTED 둘 중 하나다.
증거 없는 완료 주장은 CHANGES_REQUESTED다.
CHANGES_REQUESTED면 Required Changes에 "어느 파일의 무엇을 무엇으로"를 적어라.

git 명령을 실행하지 마라. bcos 명령을 실행하지 마라.
구현을 수정하지 마라. 테스트를 수정하지 마라.

--- HOST VERIFICATION EVIDENCE ---
  command:   ${evidence.command}
  exit code: ${evidence.code}
  duration:  ${evidence.duration} ms

--- CONTEXT PACKAGE ---
${context}`;
}

function verdict(reviewPath: string, attempt: number): ReviewResult["verdict"] {
  if (!existsSync(reviewPath)) return "unreadable";
  const headings = readFileSync(reviewPath, "utf8").matchAll(new RegExp(
    `^## Attempt ${attempt} — [^\\r\\n]+ — (APPROVED|CHANGES_REQUESTED|BLOCKED)[ \\t]*\\r?$`,
    "gm",
  ));
  let latest: string | undefined;
  for (const heading of headings) latest = heading[1];
  return latest === "APPROVED" || latest === "CHANGES_REQUESTED" ? latest : "unreadable";
}

export async function runReviewer(taskId: string, reviewer: string, commandOverride: string | undefined, timeoutSeconds: number, evidence: { command: string; code: number; duration: number }): Promise<ReviewResult> {
  const root = process.cwd();
  const task = taskInfo(taskId, root);
  const relativeReviewPath = path.join(".bcos", "reviews", task.name);
  const reviewPath = path.join(root, relativeReviewPath);
  const reportPath = path.join(root, ".bcos", "reports", task.name);
  const report = existsSync(reportPath)
    ? `\n--- REPORT: ${path.join(".bcos", "reports", task.name)} ---\n${readFileSync(reportPath, "utf8")}`
    : "";
  const stdin = input(taskId, task.attempt, reviewer, relativeReviewPath, evidence,
    `${buildContextPackage(taskId, root).output}${report}`);
  const startedAt = new Date().toISOString();
  const environment = { ...process.env };
  delete environment.BCOS_WORKER_SESSION;
  const result = await runModel({ runtime: "claude", cwd: root, stdin, timeoutSeconds,
    commandOverride, env: environment });
  return { code: result.exitCode, duration: result.durationMs, startedAt,
    completedAt: new Date().toISOString(), timedOut: result.timedOut, errorCode: result.errorCode,
    verdict: result.exitCode === 0 && !result.timedOut && !result.error ? verdict(reviewPath, task.attempt) : "unreadable",
    reviewPath: relativeReviewPath, runtime: result.runtimeKind, version: result.version,
    stdoutBytes: result.stdoutBytes, stderrBytes: result.stderrBytes,
    ...(result.firstResponseMs === undefined ? {} : { firstResponseMs: result.firstResponseMs }) };
}
