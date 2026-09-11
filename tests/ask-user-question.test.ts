import assert from "node:assert/strict";
import test from "node:test";
import askUserQuestion from "../extensions/ask-user-question.ts";

test("ask_user_question uses the RPC dialog protocol for single-select", async () => {
	let registeredTool: any;
	askUserQuestion({
		registerTool(tool: unknown) {
			registeredTool = tool;
		},
	} as any);

	const requests: string[] = [];
	const result = await registeredTool.execute(
		"test-call",
		{
			question: "Which environment?",
			options: [
				{ label: "Staging", value: "staging" },
				{ label: "Production", value: "production" },
			],
		},
		undefined,
		undefined,
		{
			mode: "rpc",
			hasUI: true,
			ui: {
				select: async (_title: string, options: string[]) => {
					requests.push("select");
					return options[0];
				},
				input: async () => undefined,
			},
		},
	);

	assert.deepEqual(requests, ["select"]);
	assert.equal(result.content[0].text, "User selected: 1. Staging");
	assert.equal(result.details.status, "answered");
	assert.deepEqual(result.details.answers, [
		{ type: "option", label: "Staging", value: "staging", index: 1 },
	]);
});
