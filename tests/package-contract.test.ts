import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function findTypeScriptFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await findTypeScriptFiles(fullPath)));
		else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(fullPath);
	}
	return files;
}

test("extensions use the Pi 0.84 package namespaces", async () => {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	for (const file of await findTypeScriptFiles(path.join(root, "extensions"))) {
		const source = await readFile(file, "utf8");
		assert.equal(source.includes("@mariozechner/") || source.includes("@sinclair/typebox"), false, file);
	}
});

test("npm package contains the helper but not private email configuration", () => {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
		cwd: root,
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	const files = new Set((JSON.parse(result.stdout) as Array<{ files: Array<{ path: string }> }>)[0]?.files.map((file) => file.path));
	assert.equal(files.has("skills/send-email/scripts/send_gmail_smtp.py"), true);
	assert.equal(files.has("skills/send-email/SKILL.md"), true);
	for (const privatePath of [
		"skills/send-email/.env",
		"skills/send-email/recipients.txt",
		"skills/send-email/receiptients.txt",
	]) {
		assert.equal(files.has(privatePath), false, privatePath);
	}
});
