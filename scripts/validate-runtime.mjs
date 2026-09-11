import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pi = process.env.PI_BIN || resolve(root, "node_modules/.bin/pi");

if (!existsSync(pi)) {
  console.error(`Pi runtime not found at ${pi}; run npm install first.`);
  process.exit(1);
}

const extensionFiles = [
  "extensions/ask-user-question.ts",
  "extensions/bash-guard/index.ts",
  "extensions/context.ts",
  "extensions/custom-header.ts",
  "extensions/filechanges/index.ts",
  "extensions/subagents/index.ts",
  "extensions/web-fetch/index.ts",
];

const scriptFiles = [
  "scripts/retain-sessions.mjs",
  "scripts/migrate-global-resources.mjs",
];

for (const relativePath of scriptFiles) {
  const script = resolve(root, relativePath);
  const result = spawnSync(process.execPath, ["--check", script], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0 || result.error || result.stderr.trim()) {
    console.error(`Runtime validation failed for ${relativePath}`);
    if (result.error) console.error(result.error);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
  console.log(`ok ${relativePath}`);
}

for (const relativePath of extensionFiles) {
  const extension = resolve(root, relativePath);
  const result = spawnSync(
    pi,
    [
      "--offline",
      "--no-extensions",
      "--no-skills",
      "--no-prompt-templates",
      "--extension",
      extension,
      "--help",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PI_OFFLINE: "1" },
    },
  );

  if (result.status !== 0 || result.error || result.stderr.trim()) {
    console.error(`Runtime validation failed for ${relativePath}`);
    if (result.error) console.error(result.error);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
  console.log(`ok ${relativePath}`);
}
