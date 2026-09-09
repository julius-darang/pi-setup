/**
 * Safe bash extension for worker subagent.
 * Wraps the built-in bash tool with the shared shell-aware risk analyzer.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { analyzeBashCommand } from "../../bash-guard/analyzer.ts";
import { isWorkerBashBlocked } from "./safe-bash-policy.ts";

function isDangerous(command: string): string | null {
	const workerBlock = isWorkerBashBlocked(command);
	if (workerBlock) return workerBlock;

	const risk = analyzeBashCommand(command);
	if (!risk) return null;
	if (risk.severity !== "high" && !risk.reasons.some((reason) => reason.startsWith("unparsed shell command"))) {
		return null;
	}
	return `Command blocked by safe_bash: ${risk.reasons.join("; ")}`;
}

export default function (pi: ExtensionAPI) {
	const bashTool = createBashTool(process.cwd());

	pi.registerTool({
		name: "safe_bash",
		label: "Safe Bash",
		description:
			"Execute a bash command. Blocks high-risk commands and Git mutations using the shared shell-aware safety policy.",
		parameters: Type.Object({
			command: Type.String({ description: "Bash command to execute" }),
			timeout: Type.Optional(
				Type.Number({ description: "Timeout in seconds (optional)" }),
			),
		}),
		async execute(toolCallId, params, signal, onUpdate) {
			const danger = isDangerous(params.command);
			if (danger) {
				throw new Error(danger);
			}
			return bashTool.execute(toolCallId, params, signal, onUpdate);
		},
	});
}
