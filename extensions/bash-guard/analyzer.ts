import { parse as shellParse } from "shell-quote";

/** Risk level returned by the shared shell-aware command analyzer. */
export type Severity = "high" | "medium";

export type Risk = {
	severity: Severity;
	reasons: string[];
};

type OpToken = { op: string; [k: string]: unknown };

type Token = string | OpToken;

const SHELL_WRAPPERS = new Set(["sh", "bash", "zsh", "fish", "dash"]);
const INLINE_CODE_FLAGS: Record<string, RegExp> = {
	python: /^(?:-c|--command|--code|-)$|^-c.+$/,
	python3: /^(?:-c|--command|--code|-)$|^-c.+$/,
	pypy: /^(?:-c|--command|--code|-)$|^-c.+$/,
	node: /^(?:-e|-p|--eval|--print)$|^-[ep].+$/,
	ruby: /^(?:-e|-r|--eval|-)$|^-e.+$/,
	perl: /^(?:-e|-E|-)$|^-[eE].+$/,
	php: /^(?:-r|--run|-)$|^-r.+$/,
};
const OPAQUE_MAKE_TARGETS = new Set(["clean", "deploy", "destroy", "install", "publish", "release", "reset", "uninstall"]);
const MAX_NESTED_DEPTH = 8;

function executableName(value: string): string {
	return value.split("/").pop() || value;
}

function isOpToken(t: Token): t is OpToken {
	return typeof t === "object" && t !== null && "op" in t;
}

function tokensToStrings(tokens: Token[]): string[] {
	return tokens.filter((t) => typeof t === "string") as string[];
}

function splitOnOps(tokens: Token[], splitOps: string[]): Token[][] {
	const out: Token[][] = [];
	let current: Token[] = [];
	for (const t of tokens) {
		if (isOpToken(t) && splitOps.includes(t.op)) {
			if (current.length) out.push(current);
			current = [];
			continue;
		}
		current.push(t);
	}
	if (current.length) out.push(current);
	return out;
}

function hasFlag(args: string[], flag: string): boolean {
	return args.includes(flag) || args.some((a) => a.startsWith(flag) && flag.length === 2 && a.startsWith("-"));
}

function anyArgStartsWith(args: string[], prefix: string): boolean {
	return args.some((a) => a.startsWith(prefix));
}

function isRawDevicePath(value: string): boolean {
	return /^\/dev\/(?:sd[a-z]\d*|hd[a-z]\d*|vd[a-z]\d*|xvd[a-z]\d*|nvme\d+n\d+(?:p\d+)?|mmcblk\d+(?:p\d+)?|(?:r)?disk\d+(?:s\d+)?|md\d+|mapper\/|mem$|kmem$|port$)/.test(value);
}

function commandIndexAfterWrappers(args: string[]): number {
	let index = 0;
	while (index < args.length) {
		const wrapper = executableName(args[index]);
		if (wrapper === "command" || wrapper === "builtin" || wrapper === "exec") {
			index++;
			while (index < args.length && args[index].startsWith("-")) {
				// `command -v/-V` only performs a lookup; it does not execute the
				// following word.
				if (wrapper === "command" && /^-[^-]*[vV]/.test(args[index])) return args.length;
				// `exec -a name command` consumes a value after -a.
				if (wrapper === "exec" && args[index] === "-a") index += 2;
				else index++;
			}
			continue;
		}
		if (wrapper === "env") {
			index++;
			while (index < args.length && args[index].startsWith("-")) {
				if (["-u", "--unset", "-C", "--chdir", "-S", "--split-string"].includes(args[index])) index += 2;
				else if (args[index] === "--") {
					index++;
					break;
				} else index++;
			}
			while (index < args.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[index])) index++;
			continue;
		}
		break;
	}
	return index;
}

function analyzeSegment(seg: Token[]): Risk | null {
	const reasons: string[] = [];
	let severity: Severity = "medium";

	const ops = seg.filter(isOpToken).map((o) => o.op);
	const args = tokensToStrings(seg);
	if (args.length === 0) return null;

	const commandIndex = commandIndexAfterWrappers(args);
	if (commandIndex >= args.length) return null;
	const commandWord = args[commandIndex];
	const cmd = executableName(commandWord);
	const rest = args.slice(commandIndex + 1);

	if (commandWord.startsWith("$")) {
		return { severity: "high", reasons: ["dynamic command expansion (unable to inspect the executed command)"] };
	}

	// Shell redirection / pipes are handled on the whole command, but keep some segment checks too.
	if (ops.includes("|") && args.some((arg) => SHELL_WRAPPERS.has(executableName(arg)))) {
		reasons.push("pipe to a shell (possible remote code execution)");
		severity = "high";
	}

	// sudo
	if (cmd === "sudo") {
		reasons.push("sudo (elevated privileges)");
		severity = "high";
	}

	// eval executes a second shell program that static token analysis cannot
	// safely inspect. Treat it as high risk rather than allowing a hidden
	// destructive command through the worker guard.
	if (cmd === "eval" || (cmd === "builtin" && rest[0] === "eval") || (cmd === "command" && rest[0] === "eval")) {
		severity = "high";
		reasons.push("eval (dynamic shell command execution)");
	}

	// rm/rmdir/unlink
	if (cmd === "rm" || cmd === "rmdir" || cmd === "unlink") {
		severity = "high";
		reasons.push(`${cmd} (file deletion)`);
		if (rest.some((a) => a.includes("-r") || a.includes("-R"))) reasons.push("recursive delete (-r/-R)");
		if (rest.some((a) => a.includes("-f"))) reasons.push("forced delete (-f)");
		if (ops.includes("glob")) reasons.push("glob pattern expansion (may delete many files)");
	}

	// find -delete
	if (cmd === "find" && rest.includes("-delete")) {
		severity = "high";
		reasons.push("find -delete (bulk deletion)");
	}

	// git operations (prompt on ANY git command)
	if (cmd === "git") {
		const sub = rest[0];
		const subArgs = rest.slice(1);

		// Always prompt for git commands (user requested). Keep severity medium unless an explicit high-risk pattern is detected.
		reasons.push(sub ? `git ${sub} (git command)` : "git (git command)");

		if (sub === "rm") {
			severity = "high";
			reasons.push("git rm (deletes files from working tree and stages deletions)");
		}
		if (sub === "clean" && (subArgs.some((a) => a.includes("-f")) || subArgs.includes("-d") || subArgs.includes("-x"))) {
			severity = "high";
			reasons.push("git clean (can delete untracked files)");
		}
		if (sub === "reset" && subArgs.includes("--hard")) {
			severity = "high";
			reasons.push("git reset --hard (discard changes)");
		}
		if ((sub === "checkout" || sub === "restore") && (subArgs.includes(".") || subArgs.includes("--") || subArgs.includes("--source"))) {
			severity = severity === "high" ? "high" : "medium";
			reasons.push("git checkout/restore (can overwrite working tree)");
		}
		if (sub === "push" && (subArgs.includes("--force") || subArgs.includes("--force-with-lease") || subArgs.includes("-f"))) {
			severity = "high";
			reasons.push("git push --force (rewrite remote history)");
		}
		if (sub === "reflog" && subArgs.includes("expire")) {
			severity = "high";
			reasons.push("git reflog expire (can remove recovery history)");
		}
		if (sub === "gc" && subArgs.some((a) => a.startsWith("--prune"))) {
			severity = "high";
			reasons.push("git gc --prune (can permanently delete objects)");
		}
	}

	// truncate
	if (cmd === "truncate") {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("truncate (in-place size change, can erase contents)");
	}

	// dd if=/of= — raw copies can overwrite data or expose a device.
	if (cmd === "dd" && (anyArgStartsWith(rest, "if=") || anyArgStartsWith(rest, "of=") || rest.includes("of"))) {
		severity = "high";
		reasons.push("dd (raw data copy can overwrite or expose data)");
	}

	// Disk / volume management (prompt aggressively; high risk)
	// Linux: mkfs.*, wipefs, parted, fdisk, gdisk/sgdisk, lsblk, cryptsetup, LVM tools, zpool
	// macOS: diskutil, hdiutil, gpt, newfs_*, asr
	if (cmd.startsWith("mkfs")) {
		severity = "high";
		reasons.push("mkfs (filesystem formatting)");
	}
	if (cmd.startsWith("newfs_")) {
		severity = "high";
		reasons.push("newfs_* (filesystem formatting)");
	}
	if (cmd === "wipefs") {
		severity = "high";
		reasons.push("wipefs (disk signature wipe)");
	}
	if (cmd === "diskutil") {
		severity = "high";
		reasons.push("diskutil (disk management command)");
		if (rest.includes("eraseDisk") || rest.includes("eraseVolume")) {
			reasons.push("diskutil erase (destructive disk operation)");
		}
	}
	if (cmd === "hdiutil") {
		severity = "high";
		reasons.push("hdiutil (disk image management command)");
	}
	if (cmd === "gpt") {
		severity = "high";
		reasons.push("gpt (partition table manipulation)");
	}
	if (cmd === "asr") {
		severity = "high";
		reasons.push("asr (Apple Software Restore; can overwrite volumes)");
	}
	if (cmd === "parted" || cmd === "fdisk" || cmd === "gdisk" || cmd === "sgdisk") {
		severity = "high";
		reasons.push(`${cmd} (disk/partition management)`);
	}
	if (cmd === "lsblk") {
		// Usually read-only, but still disk-related; prompt as requested.
		severity = severity === "high" ? "high" : "medium";
		reasons.push("lsblk (disk listing)");
	}
	if (cmd === "cryptsetup") {
		severity = "high";
		reasons.push("cryptsetup (disk encryption management)");
	}
	if (cmd === "pvcreate" || cmd === "vgcreate" || cmd === "lvcreate") {
		severity = "high";
		reasons.push(`${cmd} (LVM volume management)`);
	}
	if (cmd === "zpool") {
		severity = "high";
		reasons.push("zpool (ZFS pool management)");
	}

	// chmod/chown recursive
	if (cmd === "chmod" && (rest.includes("-R") || rest.includes("--recursive"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("chmod -R (recursive permission changes)");
		if (rest.includes("777") && rest.some((arg) => arg === "/" || /^~\/?$/.test(arg))) {
			severity = "high";
			reasons.push("chmod 777 on a root path (can expose the system)");
		}
	}
	if (cmd === "chown" && (rest.includes("-R") || rest.includes("--recursive"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("chown -R (recursive ownership changes)");
	}
	if (cmd === "chown" && rest.some((arg) => arg === "root" || arg.startsWith("root:"))) {
		severity = "high";
		reasons.push("chown to root (changes ownership to a privileged account)");
	}

	// mv/cp overwriting
	if (cmd === "mv" && (rest.includes("-f") || rest.includes("--force"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("mv --force/-f (can overwrite files)");
	}
	if (cmd === "cp" && (rest.includes("-f") || rest.includes("--force"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("cp --force/-f (can overwrite files)");
	}

	// sed/perl in-place
	if (cmd === "sed" && (hasFlag(rest, "-i") || rest.includes("--in-place"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("sed -i (in-place file modification)");
	}
	if (cmd === "perl" && (rest.includes("-pi") || (rest.includes("-p") && rest.includes("-i")))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("perl -pi/-i (in-place file modification)");
	}

	// kill/shutdown/systemctl
	if (cmd === "kill" || cmd === "pkill" || cmd === "killall") {
		severity = cmd === "killall" ? "high" : severity === "high" ? "high" : "medium";
		reasons.push(`${cmd} (process termination)`);
		if (rest.includes("-9")) {
			severity = "high";
			reasons.push("SIGKILL (-9)");
		}
	}
	if (cmd === "shutdown" || cmd === "reboot" || cmd === "halt" || cmd === "poweroff") {
		severity = "high";
		reasons.push(`${cmd} (system power operation)`);
	}
	if (cmd === "init" && rest[0] === "0") {
		severity = "high";
		reasons.push("init 0 (system shutdown operation)");
	}
	if (cmd === "systemctl" && (rest.includes("stop") || rest.includes("disable"))) {
		severity = "high";
		reasons.push("systemctl stop/disable (service disruption)");
	}

	// Inline interpreter code bypasses command-level inspection. Block it rather
	// than guessing whether the embedded program is harmless.
	const inlineCodePattern = INLINE_CODE_FLAGS[cmd];
	if (inlineCodePattern && rest.some((arg) => inlineCodePattern.test(arg))) {
		severity = "high";
		reasons.push(`${cmd} inline code (opaque command execution)`);
	}

	// Make targets can hide arbitrary deploy, deletion, or environment-changing
	// actions in a Makefile. Keep ordinary inspection/test targets available.
	if (cmd === "make" && rest.some((arg) => OPAQUE_MAKE_TARGETS.has(arg) || /^(?:deploy|release|publish)[_:.-]/.test(arg))) {
		severity = "high";
		reasons.push("opaque make target (may deploy, delete, or change the environment)");
	}

	// Remote execution patterns
	if ((cmd === "curl" || cmd === "wget") && ops.includes("|")) {
		severity = "high";
		reasons.push("curl/wget piped (possible remote code execution)");
	}

	// Infra deletes
	if (cmd === "kubectl" && rest[0] === "delete") {
		severity = "high";
		reasons.push("kubectl delete (resource deletion)");
	}
	if (cmd === "terraform" && rest[0] === "destroy") {
		severity = "high";
		reasons.push("terraform destroy (infrastructure teardown)");
	}
	if (cmd === "aws" && rest[0] === "s3" && rest[1] === "rm" && rest.includes("--recursive")) {
		severity = "high";
		reasons.push("aws s3 rm --recursive (bulk deletion)");
	}
	if (cmd === "gcloud" && rest.includes("delete")) {
		severity = "high";
		reasons.push("gcloud delete (resource deletion)");
	}

	if (reasons.length === 0) return null;
	return { severity, reasons };
}

/** Analyze one parsed command, including nested shell invocations and substitutions. */
function analyzeParsedTokens(tokens: Token[], depth = 0): Risk | null {
	const reasons: string[] = [];
	let severity: Severity = "medium";

	// Whole-command operator checks
	const ops = tokens.filter(isOpToken).map((t) => t.op);
	if (ops.some((op) => op === ">" || op === ">>" || op === "2>" || op === "2>>")) {
		reasons.push("shell output redirection (can overwrite files)");
		severity = "medium";
	}
	for (let index = 0; index < tokens.length - 1; index++) {
		const token = tokens[index];
		const target = tokens[index + 1];
		if (
			isOpToken(token) &&
			[">", ">>", "2>", "2>>"].includes(token.op) &&
			typeof target === "string" &&
			isRawDevicePath(target)
		) {
			severity = "high";
			reasons.push("redirection to a raw device (can overwrite a disk)");
		}
	}
	if (ops.includes("<")) {
		reasons.push("shell input redirection (questionable)");
	}
	if (ops.includes("|")) {
		reasons.push("pipe operator (chained commands)");
	}

	// Segment analysis (split on control operators and pipelines). Looking at
	// every pipeline stage prevents `echo data | rm -rf ...` from hiding the
	// destructive command behind the first command name.
	const segments = splitOnOps(tokens, ["&&", "||", ";"]);
	const pipelineSegments = splitOnOps(tokens, ["&&", "||", ";", "|"]);
	for (const seg of [...segments, ...pipelineSegments]) {
		const segRisk = analyzeSegment(seg);
		if (!segRisk) continue;
		if (segRisk.severity === "high") severity = "high";
		for (const r of segRisk.reasons) reasons.push(r);
	}

	if (depth < MAX_NESTED_DEPTH) {
		// A worker must not evade the guard with `bash -c`, `sh -c`, or a
		// command substitution. Parse those nested commands with the same rules.
		for (let index = 0; index < tokens.length; index++) {
			const token = tokens[index];
			if (typeof token === "string" && SHELL_WRAPPERS.has(executableName(token))) {
				for (let cursor = index + 1; cursor < tokens.length - 1; cursor++) {
					const option = tokens[cursor];
					if (typeof option !== "string" || (!/^-[A-Za-z]*c$/.test(option) && option !== "--command")) continue;
					const script = tokens[cursor + 1];
					if (typeof script !== "string") continue;
					try {
						const nested = analyzeParsedTokens(shellParse(script) as Token[], depth + 1);
						if (nested) {
							if (nested.severity === "high") severity = "high";
							reasons.push(...nested.reasons.map((reason) => `nested shell: ${reason}`));
						}
					} catch {
						reasons.push("nested shell: unparsed shell command (unable to analyze safely)");
					}
					break;
				}
			}
			if (!isOpToken(token) || token.op !== "(") continue;
			let closing = index + 1;
			let nesting = 1;
			for (; closing < tokens.length; closing++) {
				const nestedToken = tokens[closing];
				if (!isOpToken(nestedToken)) continue;
				if (nestedToken.op === "(") nesting++;
				if (nestedToken.op === ")" && --nesting === 0) break;
			}
			if (closing >= tokens.length) continue;
			const nested = analyzeParsedTokens(tokens.slice(index + 1, closing), depth + 1);
			if (nested) {
				if (nested.severity === "high") severity = "high";
				reasons.push(...nested.reasons.map((reason) => `command substitution: ${reason}`));
			}
			index = closing;
		}
	}

	// De-duplicate reasons
	const uniq = [...new Set(reasons)];
	if (uniq.length === 0) return null;
	return { severity, reasons: uniq };
}

/** Analyze one shell command after shell-aware tokenization. */
export function analyzeBashCommand(command: string): Risk | null {
	let risk: Risk | null;
	try {
		risk = analyzeParsedTokens(shellParse(command) as Token[]);
	} catch {
		// Fallback: if we can't parse, treat it as questionable
		risk = { severity: "medium", reasons: ["unparsed shell command (unable to analyze safely)"] };
	}

	const extraReasons: string[] = [];
	if (/:\(\)\s*\{[\s\S]*\|[\s\S]*&[\s\S]*\}\s*;\s*:/.test(command)) {
		extraReasons.push("fork bomb syntax (unbounded process spawning)");
	}
	if (command.includes("`")) {
		extraReasons.push("backtick command substitution (unable to safely isolate nested command)");
	}
	if (/(^|[;&|]\s*)(?:(?:command|exec|builtin|env)\s+)*(?:["']?\$(?:\{?[A-Za-z_][A-Za-z0-9_]*\}?|\())/.test(command)) {
		extraReasons.push("dynamic command expansion (unable to inspect the executed command)");
	}
	if (extraReasons.length === 0) return risk;
	return {
		severity: "high",
		reasons: [...new Set([...(risk?.reasons ?? []), ...extraReasons])],
	};
}
