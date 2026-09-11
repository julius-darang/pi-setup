import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
	buildPiArgs,
	resolveAgentModel,
	runSubagent,
	type AgentConfig,
} from "../extensions/subagents/index.ts";

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function testAgent(model?: string): AgentConfig {
	return {
		name: "worker",
		description: "test worker",
		tools: ["read", "safe_bash", "subagent"],
		model,
		thinking: "low",
		systemPrompt: "Test prompt",
		filePath: "test-agent.md",
		subagentAgents: ["scout", "researcher"],
	};
}

test("explicit subagent models resolve through Pi's model registry", () => {
	const calls: string[] = [];
	const registry = {
		find(provider: string, modelId: string) {
			calls.push(`${provider}/${modelId}`);
			return provider === "openrouter" && modelId === "org/model/name" ? { contextWindow: 128_000 } : undefined;
		},
	};

	assert.deepEqual(resolveAgentModel("openrouter/org/model/name", registry), {
		provider: "openrouter",
		modelId: "org/model/name",
		contextWindow: 128_000,
	});
	assert.deepEqual(calls, ["openrouter/org/model/name"]);
	assert.throws(
		() => resolveAgentModel("missing/model", registry),
		/Subagent model "missing\/model" was not found in Pi's model registry/,
	);
	assert.throws(
		() => resolveAgentModel("model-without-provider", registry),
		/Invalid subagent model/,
	);
	assert.equal(resolveAgentModel(undefined, registry), undefined);
});

test("preflight works with Pi's offline ModelRegistry implementation", async () => {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-model-registry-test-"));
	try {
		const runtime = await ModelRuntime.create({
			refreshOnCreate: false,
			modelsPath: null,
			authPath: path.join(tempDir, "auth.json"),
		});
		const registry = new ModelRegistry(runtime);
		const model = registry.getAll()[0];
		assert.ok(model, "Pi should expose its built-in model catalog offline");
		assert.deepEqual(
			resolveAgentModel(`${model.provider}/${model.id}`, registry),
			{
				provider: model.provider,
				modelId: model.id,
				contextWindow: model.contextWindow,
			},
		);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("subagent child receives depth and inherited/explicit model arguments", async () => {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-test-"));
	const fakePi = path.join(tempDir, "fake-pi.mjs");
	const childLog = path.join(tempDir, "child.json");
	await writeFile(
		fakePi,
		[
			'import { appendFileSync } from "node:fs";',
			"appendFileSync(process.env.PI_TEST_CHILD_LOG, JSON.stringify({ depth: process.env.PI_SUBAGENT_DEPTH, allowed: process.env.PI_SUBAGENT_ALLOWED, args: process.argv.slice(2) }) + \"\\n\");",
			"if (process.env.PI_TEST_CHILD_MODE === \"error\") process.exit(7);",
			"process.stdout.write(JSON.stringify({ type: \"message_end\", message: { role: \"assistant\", model: \"fake/model\", content: [{ type: \"text\", text: \"child output\" }], usage: { input: 3, output: 2, cacheRead: 0, cacheWrite: 0, cost: { total: 0 }, totalTokens: 5 } } }) + \"\\n\");",
		].join("\n"),
		{ mode: 0o700 },
	);

	const previousArgv = process.argv[1];
	const previousDepth = process.env.PI_SUBAGENT_DEPTH;
	const previousLog = process.env.PI_TEST_CHILD_LOG;
	const previousMode = process.env.PI_TEST_CHILD_MODE;
	process.argv[1] = fakePi;
	process.env.PI_SUBAGENT_DEPTH = "2";
	process.env.PI_TEST_CHILD_LOG = childLog;
	delete process.env.PI_TEST_CHILD_MODE;

	try {
		const inherited = await buildPiArgs(testAgent(), "inherited model", process.cwd());
		const explicit = await buildPiArgs(testAgent("provider/model"), "explicit model", process.cwd());
		const bashAgent = await buildPiArgs(
			{ ...testAgent(), tools: ["bash"] },
			"guarded bash",
			process.cwd(),
		);
		try {
			assert.equal(inherited.childEnv?.PI_SUBAGENT_DEPTH, "3");
			assert.equal(inherited.childEnv?.PI_SUBAGENT_ALLOWED, "scout,researcher");
			assert.equal(inherited.args.includes("--model"), false);
			const modelIndex = explicit.args.indexOf("--model");
			assert.notEqual(modelIndex, -1);
			assert.deepEqual(explicit.args.slice(modelIndex, modelIndex + 2), ["--model", "provider/model"]);
			assert.equal(bashAgent.args.includes("--extension"), true);
			assert.equal(bashAgent.args.some((arg) => arg.endsWith("/bash-guard/index.ts")), true);
		} finally {
			await Promise.all([
				rm(inherited.tempDir, { recursive: true, force: true }),
				rm(explicit.tempDir, { recursive: true, force: true }),
				rm(bashAgent.tempDir, { recursive: true, force: true }),
			]);
		}

		const result = await runSubagent(testAgent(), "run child", process.cwd(), undefined);
		assert.equal(result.exitCode, 0);
		assert.equal(result.progress.status, "completed");
		assert.equal(result.output, "child output");
		assert.equal(result.model, "fake/model");
		assert.equal(result.progress.tokens, 5);

		const invocation = JSON.parse(await readFile(childLog, "utf8")) as {
			depth: string;
			allowed: string;
			args: string[];
		};
		assert.equal(invocation.depth, "3");
		assert.equal(invocation.allowed, "scout,researcher");
		assert.equal(invocation.args.includes("--no-session"), true);
		assert.equal(invocation.args.includes("--no-skills"), true);
		assert.equal(invocation.args.includes("--no-prompt-templates"), true);
		assert.equal(invocation.args.includes("--no-extensions"), true);
	} finally {
		process.argv[1] = previousArgv;
		restoreEnv("PI_SUBAGENT_DEPTH", previousDepth);
		restoreEnv("PI_TEST_CHILD_LOG", previousLog);
		restoreEnv("PI_TEST_CHILD_MODE", previousMode);
		await rm(tempDir, { recursive: true, force: true });
	}
});

test("subagent reports a useful error when the child exits without JSON or stderr", async () => {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-subagent-error-test-"));
	const fakePi = path.join(tempDir, "fake-pi.mjs");
	const childLog = path.join(tempDir, "child.json");
	await writeFile(
		fakePi,
		[
			'import { appendFileSync } from "node:fs";',
			"appendFileSync(process.env.PI_TEST_CHILD_LOG, \"started\\n\");",
			"process.exit(7);",
		].join("\n"),
		{ mode: 0o700 },
	);

	const previousArgv = process.argv[1];
	const previousLog = process.env.PI_TEST_CHILD_LOG;
	process.argv[1] = fakePi;
	process.env.PI_TEST_CHILD_LOG = childLog;

	try {
		const result = await runSubagent(testAgent(), "fail child", process.cwd(), undefined);
		assert.equal(result.exitCode, 7);
		assert.equal(result.progress.status, "failed");
		assert.equal(result.progress.error, "Pi child exited with code 7");
		assert.equal(result.output, "Error: Pi child exited with code 7");
	} finally {
		process.argv[1] = previousArgv;
		restoreEnv("PI_TEST_CHILD_LOG", previousLog);
		await rm(tempDir, { recursive: true, force: true });
	}
});
