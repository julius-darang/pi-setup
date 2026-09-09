#!/usr/bin/env node
/**
 * Move manually copied Pi resources aside after the package is installed.
 *
 * This is deliberately a dry run unless --apply is supplied. The move is
 * reversible: resources are kept under ~/.pi/agent/backups/ by default.
 */

import { chmod, copyFile, mkdir, rename, lstat, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const PRIVATE_EMAIL_FILES = [".env", "recipients.txt", "receiptients.txt"];

const DUPLICATE_RESOURCES = [
	"extensions/ask-user-question.ts",
	"extensions/bash-guard",
	"extensions/context.ts",
	"extensions/custom-header.ts",
	"extensions/filechanges",
	"extensions/subagents",
	"extensions/web-fetch",
	"skills/ffmpeg-output",
	"skills/marp-output",
	"skills/pandapower-analysis",
	"skills/send-email",
];

function parseArgs(argv) {
	let apply = false;
	let backupDir;
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (arg === "--apply") apply = true;
		else if (arg === "--backup-dir") backupDir = argv[++index];
		else if (arg === "--help" || arg === "-h") {
			console.log("Usage: migrate-global-resources.mjs [--backup-dir PATH] [--apply]");
			console.log("Default: show duplicate resources without moving them.");
			return null;
		} else throw new Error(`unknown argument: ${arg}`);
	}
	return { apply, backupDir };
}

function agentDirectory() {
	return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
}

async function existingResources(agentDir) {
	const found = [];
	for (const relative of DUPLICATE_RESOURCES) {
		const source = path.join(agentDir, relative);
		try {
			const info = await lstat(source);
			if (info.isSymbolicLink()) throw new Error(`refusing to move symlink: ${source}`);
			if (info.isDirectory()) {
				// A migrated email config directory intentionally remains at this
				// path, but without SKILL.md it is no longer a Pi skill duplicate.
				const marker = relative.startsWith("skills/") ? "SKILL.md" : "index.ts";
				const markerInfo = await lstat(path.join(source, marker));
				if (!markerInfo.isFile()) continue;
			}
			found.push({ relative, source });
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}
	}
	return found;
}

async function backupDirectory(agentDir, requested) {
	if (requested) return path.resolve(requested);
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	return path.join(agentDir, "backups", `pi-setup-migration-${stamp}`);
}

export async function planMigration({ agentDir = agentDirectory(), backupDir } = {}) {
	const resources = await existingResources(agentDir);
	const destination = await backupDirectory(agentDir, backupDir);
	return { agentDir, destination, resources };
}

export async function applyMigration(plan) {
	if (plan.resources.length === 0) return;
	await mkdir(plan.destination, { recursive: true, mode: 0o700 });
	const destinationEntries = new Set(await readdir(plan.destination));
	for (const resource of plan.resources) {
		const topLevel = resource.relative.split(/[\\/]/)[0];
		if (destinationEntries.has(topLevel)) {
			throw new Error(`backup destination already contains ${topLevel}: ${plan.destination}`);
		}
	}
	await mkdir(path.join(plan.destination, "extensions"), { recursive: true, mode: 0o700 });
	await mkdir(path.join(plan.destination, "skills"), { recursive: true, mode: 0o700 });
	for (const resource of plan.resources) {
		const destination = path.join(plan.destination, resource.relative);
		await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
		await rename(resource.source, destination);
	}

	// The package's send-email helper deliberately keeps credentials and recipient
	// data in the stable global config path. Keep private files active after
	// moving the duplicate skill code, while retaining a backup copy as well.
	const backedUpEmailDir = path.join(plan.destination, "skills", "send-email");
	const activeEmailDir = path.join(plan.agentDir, "skills", "send-email");
	if (plan.resources.some(({ relative }) => relative === "skills/send-email")) {
		for (const filename of PRIVATE_EMAIL_FILES) {
			const source = path.join(backedUpEmailDir, filename);
			try {
				const info = await lstat(source);
				if (!info.isFile()) continue;
				const destination = path.join(activeEmailDir, filename);
				await mkdir(activeEmailDir, { recursive: true, mode: 0o700 });
				await copyFile(source, destination);
				await chmod(destination, 0o600);
			} catch (error) {
				if (error?.code !== "ENOENT") throw error;
			}
		}
	}
	const settings = path.join(plan.agentDir, "settings.json");
	try {
		const backupSettings = path.join(plan.destination, "settings.json");
		await copyFile(settings, backupSettings);
		await chmod(backupSettings, 0o600);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (!options) return 0;
	const plan = await planMigration({ backupDir: options.backupDir });
	console.log(`Pi directory: ${plan.agentDir}`);
	console.log(`Backup directory: ${plan.destination}`);
	if (plan.resources.length === 0) {
		console.log("No manually copied resources overlap the installed package.");
		return 0;
	}
	console.log("Duplicate resources:");
	for (const resource of plan.resources) console.log(`- ${resource.relative}`);
	if (!options.apply) {
		console.log("Dry run: pass --apply after verifying the package loads correctly.");
		return 0;
	}
	await applyMigration(plan);
	console.log("Moved duplicates to the backup directory. Restart Pi or run /reload.");
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
