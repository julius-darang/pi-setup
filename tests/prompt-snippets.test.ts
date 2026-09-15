import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { composePrompt, loadSnippets, parseSnippet } from "../extensions/prompt-snippets/index.ts";

test("parseSnippet reads frontmatter and applies safe defaults", () => {
	const snippet = parseSnippet(
		"verify.md",
		"---\nname: Verify\nplacement: prepend\norder: 12\n---\nCheck the evidence.",
	);

	assert.deepEqual(snippet, {
		id: "verify.md",
		name: "Verify",
		description: "",
		placement: "prepend",
		order: 12,
		body: "Check the evidence.",
	});
	assert.equal(parseSnippet("broken.md", "not frontmatter"), null);
});

test("user snippets override package snippets by filename and remain sorted", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "pi-snippets-test-"));
	try {
		const packageDir = path.join(root, "package");
		const userDir = path.join(root, "user");
		await mkdir(packageDir);
		await mkdir(userDir);
		await writeFile(
			path.join(packageDir, "verify.md"),
			"---\nname: Package verify\nplacement: prepend\norder: 20\n---\nPackage rule.",
		);
		await writeFile(
			path.join(userDir, "verify.md"),
			"---\nname: User verify\nplacement: prepend\norder: 10\n---\nUser rule.",
		);
		await writeFile(
			path.join(packageDir, "concise.md"),
			"---\nname: Concise\nplacement: append\norder: 30\n---\nBe concise.",
		);

		const snippets = loadSnippets([{ directory: packageDir }, { directory: userDir }]);
		assert.deepEqual(snippets.map((snippet) => snippet.name), ["User verify", "Concise"]);
		assert.equal(snippets[0].body, "User rule.");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("composePrompt applies selected snippets in placement and order", () => {
	const snippets = [
		{ id: "late.md", name: "Late", description: "", placement: "append" as const, order: 20, body: "After two." },
		{ id: "first.md", name: "First", description: "", placement: "prepend" as const, order: 10, body: "Before one." },
		{ id: "early.md", name: "Early", description: "", placement: "append" as const, order: 10, body: "After one." },
	];

	assert.equal(
		composePrompt("User request.", new Set(["late.md", "first.md", "early.md"]), snippets),
		"Before one.\n\nUser request.\n\nAfter one.\n\nAfter two.",
	);
	assert.equal(composePrompt("User request.", new Set(), snippets), null);
});
