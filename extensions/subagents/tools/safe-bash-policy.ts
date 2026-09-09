import { parse as shellParse } from "shell-quote";

type ShellOperator = { op: string; [key: string]: unknown };
type ShellToken = string | ShellOperator;

const GIT_READ_ONLY_COMMANDS = new Set([
	"cat-file",
	"check-attr",
	"check-ignore",
	"diff",
	"grep",
	"log",
	"ls-files",
	"ls-tree",
	"rev-parse",
	"show",
	"shortlog",
	"status",
]);

function isOperator(token: ShellToken): token is ShellOperator {
	return typeof token === "object" && token !== null && "op" in token;
}

function executableName(value: string): string {
	return value.split("/").pop() || value;
}

function splitCommands(tokens: ShellToken[]): ShellToken[][] {
	const commands: ShellToken[][] = [];
	let current: ShellToken[] = [];
	for (const token of tokens) {
		if (isOperator(token) && ["&&", "||", ";", "|", "&"].includes(token.op)) {
			if (current.length > 0) commands.push(current);
			current = [];
		} else {
			current.push(token);
		}
	}
	if (current.length > 0) commands.push(current);
	return commands;
}

function gitSubcommand(tokens: string[], gitIndex: number): { name: string; index: number } | null {
	let index = gitIndex + 1;
	while (index < tokens.length) {
		const token = tokens[index];
		if (!token.startsWith("-")) return { name: token, index };
		// These options consume a following value. Supporting them prevents a
		// repository path or config value from being mistaken for a subcommand.
		if (["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"].includes(token)) {
			index += 2;
		} else {
			index += 1;
		}
	}
	return null;
}

const SHELL_WRAPPERS = new Set(["sh", "bash", "zsh", "fish", "dash"]);

function nestedShellScript(words: string[], index: number): string | null {
	if (!SHELL_WRAPPERS.has(executableName(words[index]))) return null;
	for (let cursor = index + 1; cursor < words.length - 1; cursor++) {
		if (/^-[A-Za-z]*c$/.test(words[cursor]) || words[cursor] === "--command") {
			return words[cursor + 1] ?? null;
		}
	}
	return null;
}

function inspectGitWords(words: string[]): string | null {
	for (let index = 0; index < words.length; index++) {
		if (executableName(words[index]) !== "git") continue;
		const subcommand = gitSubcommand(words, index);
		if (!subcommand) return "bare git command is not allowed in a worker";
		if (GIT_READ_ONLY_COMMANDS.has(subcommand.name)) continue;
		if (
			subcommand.name === "remote" &&
			["-v", "--verbose", "get-url", "show"].includes(words[subcommand.index + 1] ?? "")
		) {
			continue;
		}
		return `git ${subcommand.name} may mutate repository state; run it in the parent session`;
	}
	return null;
}

/**
 * Return a block reason for worker commands that could mutate Git state.
 * Read-only inspection remains available so workers can report their changes.
 */
export function isWorkerBashBlocked(command: string): string | null {
	let parsed: ShellToken[];
	try {
		parsed = shellParse(command) as ShellToken[];
	} catch {
		return null;
	}

	for (const segment of splitCommands(parsed)) {
		const words = segment.filter((token): token is string => typeof token === "string");
		const directBlock = inspectGitWords(words);
		if (directBlock) return directBlock;

		for (let index = 0; index < words.length; index++) {
			const script = nestedShellScript(words, index);
			if (script) {
				const nestedBlock = isWorkerBashBlocked(script);
				if (nestedBlock) return nestedBlock;
			}
		}
	}
	return null;
}
