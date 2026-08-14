import {
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";

const MAX_FILE_BYTES = 256 * 1024;
const BINARY_SAMPLE_BYTES = 8_000;

type ReadListItem = {
  path: string;
  note: string;
};

type LoadedFile = ReadListItem & {
  content: string;
};

function taskFrontmatter(content: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) throw new Error("Task frontmatter is missing");
  return match[1];
}

function frontmatterValue(frontmatter: string, key: string): string {
  const match = new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)$`, "m").exec(frontmatter);
  if (!match) throw new Error(`Task frontmatter is missing ${key}`);
  return match[1].trim();
}

function readList(content: string): ReadListItem[] {
  const expectedFiles = /^## Expected Files[ \t]*\r?\n/m.exec(content);
  if (!expectedFiles) throw new Error("Expected Files section is missing");
  const bodyStart = expectedFiles.index + expectedFiles[0].length;
  const remainder = content.slice(bodyStart);
  const nextHeading = /^## /m.exec(remainder);
  const section = nextHeading ? remainder.slice(0, nextHeading.index) : remainder;
  const lines = section.split(/\r?\n/);
  const labelIndex = lines.findIndex((line) =>
    /^\*\*읽기 허용(?: \(Read List\))?\*\*/.test(line)
  );
  if (labelIndex < 0) throw new Error("Read List label is missing");

  const items: ReadListItem[] = [];
  for (const line of lines.slice(labelIndex + 1)) {
    if (/^\*\*(?:생성|수정|쓰기(?: 허용 \(Write List\))?)\*\*/.test(line)) break;
    if (!/^- /.test(line)) continue;
    const match = /`([^`]+)`/.exec(line);
    if (match) {
      const closingBacktick = match.index + match[0].length;
      items.push({ path: match[1], note: line.slice(closingBacktick).trim() });
    }
  }
  if (items.length === 0) throw new Error("Read List is empty");
  return items;
}

function isForbidden(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]+/);
  const lowerParts = parts.map((part) => part.toLowerCase());
  const name = lowerParts.at(-1) ?? "";
  const extension = path.extname(name);
  return name.startsWith(".env")
    || name.startsWith("id_rsa")
    || [".pem", ".key", ".p12", ".pfx"].includes(extension)
    || lowerParts.some((part) => [".git", "node_modules", "dist"].includes(part));
}

function loadFiles(rootDirectory: string, items: ReadListItem[]): LoadedFile[] {
  const root = realpathSync(rootDirectory);
  const loaded: LoadedFile[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const parts = item.path.split(/[\\/]+/);
    if (
      path.isAbsolute(item.path)
      || path.win32.isAbsolute(item.path)
      || path.posix.isAbsolute(item.path)
      || parts.includes("..")
    ) {
      throw new Error(`Read List path must stay inside the repository: ${item.path}`);
    }
    if (isForbidden(item.path)) throw new Error(`Read List path is forbidden: ${item.path}`);

    const filePath = path.resolve(root, item.path);
    let resolvedPath: string;
    let stats;
    try {
      resolvedPath = realpathSync(filePath);
      stats = statSync(resolvedPath);
    } catch {
      throw new Error(`Read List file does not exist: ${item.path}`);
    }
    const relative = path.relative(root, resolvedPath);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Read List path must stay inside the repository: ${item.path}`);
    }
    if (!stats.isFile()) throw new Error(`Read List path is not a file: ${item.path}`);
    if (stats.size > MAX_FILE_BYTES) throw new Error(`Read List file exceeds 256 KB: ${item.path}`);

    const duplicateKey = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
    if (seen.has(duplicateKey)) continue;
    const buffer = readFileSync(resolvedPath);
    if (buffer.subarray(0, BINARY_SAMPLE_BYTES).includes(0)) {
      throw new Error(`Read List file appears to be binary: ${item.path}`);
    }
    seen.add(duplicateKey);
    loaded.push({ ...item, content: buffer.toString("utf8") });
  }
  return loaded;
}

function lineCount(content: string): number {
  return content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length;
}

export function buildContextPackage(
  taskId: string,
  rootDirectory = process.cwd(),
): { output: string; warning?: string } {
  const tasksDirectory = path.join(rootDirectory, ".bcos", "tasks");
  let matchingNames: string[];
  try {
    matchingNames = readdirSync(tasksDirectory)
      .filter((name) => name.startsWith(`${taskId}-`) && name.endsWith(".md"));
  } catch {
    throw new Error(`Cannot read tasks directory: ${tasksDirectory}`);
  }
  if (matchingNames.length !== 1) throw new Error(`Expected exactly one Task for ${taskId}`);

  const taskContent = readFileSync(path.join(tasksDirectory, matchingNames[0]), "utf8");
  const frontmatter = taskFrontmatter(taskContent);
  const metadata = {
    task: frontmatterValue(frontmatter, "id"),
    status: frontmatterValue(frontmatter, "status"),
    attempt: frontmatterValue(frontmatter, "attempt"),
  };
  const files = loadFiles(rootDirectory, readList(taskContent));
  const characters = files.reduce((sum, file) => sum + file.content.length, 0);
  const lines = files.reduce((sum, file) => sum + lineCount(file.content), 0);
  const header = [
    "=== BCOS CONTEXT PACKAGE v0.1 ===",
    `task: ${metadata.task}`,
    `status: ${metadata.status}`,
    `attempt: ${metadata.attempt}`,
    `files: ${files.length}`,
    `characters: ${characters}`,
    `lines: ${lines}`,
    "",
  ].join("\n");
  const sections = files.map((file, index) => {
    const note = file.note ? `\nnote: ${file.note}` : "";
    return `--- FILE ${index + 1}/${files.length}: ${file.path} ---${note}\n${file.content}`;
  });
  const output = `${header}${sections.join("\n\n")}\n=== END CONTEXT PACKAGE ===\n`;
  return {
    output,
    warning: output.length > 8_000
      ? `Warning: Context Package exceeds 8,000 characters (${output.length})`
      : undefined,
  };
}
