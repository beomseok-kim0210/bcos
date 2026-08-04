#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { version: string };
const argument = process.argv[2];

if (argument === "--version") {
  console.log(packageJson.version);
} else if (argument === "--help") {
  console.log("Usage: bcos [--version | --help]");
} else {
  console.error(`Unknown argument: ${argument ?? "(none)"}`);
  process.exitCode = 1;
}
