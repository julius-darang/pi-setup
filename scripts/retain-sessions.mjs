#!/usr/bin/env node
/**
 * Report or remove old Pi JSONL sessions.
 *
 * The default is a dry run. Deletion requires --apply so an accidental install
 * or scheduled invocation cannot silently remove recoverable session history.
 */

import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const DEFAULT_DAYS = 30;

function usage() {
	console.log(`Usage: retain-sessions.mjs [--days N] [--apply]\n\nDefault: report sessions older than ${DEFAULT_DAYS} days without deleting them.`);
}

function parseArgs(argv) {
	let days = DEFAULT_DAYS;
	let apply = false;
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (arg === "--apply") {
			apply = true;
		} else if (arg === "--days") {
			const value = Number(argv[++index]);
			if (!Number.isInteger(value) || value < 1) throw new Error("--days must be a positive integer");
			days = value;
		} else if (arg === "--help" || arg === "-h") {
			usage();
			return null;
		} else {
			throw new Error(`unknown argument: ${arg}`);
		}
	}
	return { days, apply };
}

async function collectJsonlFiles(directory) {
	const files = [];
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if (error?.code === "ENOENT") return files;
		throw error;
	}
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...await collectJsonlFiles(fullPath));
		else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(fullPath);
	}
	return files;
}

export async function findExpiredSessions({ sessionsDir, days = DEFAULT_DAYS, now = Date.now() }) {
	const cutoff = now - days * 24 * 60 * 60 * 1000;
	const files = await collectJsonlFiles(sessionsDir);
	const expired = [];
	for (const file of files) {
		const info = await stat(file);
		if (info.mtimeMs < cutoff) expired.push({ path: file, bytes: info.size, mtimeMs: info.mtimeMs });
	}
	return expired.sort((left, right) => left.mtimeMs - right.mtimeMs);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (!options) return 0;
	const agentDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
	const sessionsDir = path.join(agentDir, "sessions");
	const expired = await findExpiredSessions({ sessionsDir, days: options.days });
	const bytes = expired.reduce((total, file) => total + file.bytes, 0);
	console.log(`${expired.length} session file(s) older than ${options.days} day(s), ${bytes} bytes: ${sessionsDir}`);
	for (const file of expired) {
		console.log(`- ${file.path} (${file.bytes} bytes; ${new Date(file.mtimeMs).toISOString()})`);
	}
	if (!options.apply || expired.length === 0) {
		if (!options.apply) console.log("Dry run: pass --apply after reviewing this list to delete them.");
		return 0;
	}
	for (const file of expired) {
		await unlink(file.path);
		console.log(`deleted ${file.path}`);
	}
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		process.exitCode = await main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
