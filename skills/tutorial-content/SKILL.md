---
name: tutorial-content
description: Author canonical long-form tutorial content for brand/tutorials. Use when drafting or editing a tutorial source that may be published as a PDF, Marp deck, video script, article, or lesson.
---

# tutorial-content

Use this skill for the **canonical written source** of a tutorial in `brand/tutorials/`. The source should be useful as a complete reading experience before it is adapted into presentation or social formats.

## Source-of-truth rule

- Treat the long-form Markdown file as the canonical source for the complete tutorial.
- For the Pi Coding Agent tutorial, the source is `brand/tutorials/PI-CODING-AGENT/pi-agent-contents.md`.
- Do not treat a Marp deck or generated PDF as an editable source.
- Do not manually edit generated PDFs.
- When the source changes, rebuild the affected outputs and review them separately.
- A deck is an adaptation of the source, not a slide-by-slide dump of every paragraph.

## Choose the right output

Keep the publishing roles distinct:

| Artifact | Purpose | Source | Rendering |
|---|---|---|---|
| concise deck | social, carousel, introduction | authored/adapted Markdown | Marp |
| full deck | visual walkthrough | authored/adapted Markdown | Marp |
| complete tutorial | flowing reading experience | canonical long-form Markdown | Pandoc + XeLaTeX |
| video lesson | narration and demonstrations | canonical Markdown plus an editorial script pass | recording/editing workflow |

Use `marp-output` for decks and `pandoc-pdf` for the vertical PDF. Do not mix their layout conventions.

## Tutorial structure

A complete technical tutorial should normally include:

1. A clear promise and audience
2. Prerequisites and environment assumptions
3. Installation or setup
4. A first successful result
5. Core concepts in increasing complexity
6. Practical workflows and examples
7. Safety, boundaries, and failure modes
8. Advanced or optional integrations
9. A capstone or repeatable operating procedure
10. Troubleshooting
11. Checklist, glossary, or references

For the Pi Coding Agent tutorial, preserve coverage of installation, authentication, tools, prompting, context files, trust, Git, sessions, compaction, models, print/JSON/RPC modes, skills, prompt templates, extensions, packages, custom models, SDK, sandboxing, troubleshooting, and references unless the scope explicitly changes.

## Editorial rules

- Show the useful output or command early, then explain why it works.
- Prefer concrete commands, file paths, and bounded examples over abstract claims.
- Introduce a concept before relying on it in a later example.
- Explain what the reader should observe after running a command.
- State prerequisites and platform limitations close to the command that needs them.
- Separate Pi documentation from personal recommendations. Use language such as “Pi supports...” versus “A practical default is...”.
- Keep the reader's next action explicit.
- End major sections with a takeaway, verification step, or decision rule.
- Avoid filler, repeated introductions, and generic claims about AI.
- Do not turn every paragraph into a slide. The long-form source may contain detail that belongs only in the PDF or script.

## Technical accuracy

For claims about Pi itself:

- Check the installed Pi documentation under `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/README.md` and `docs/` when accuracy matters.
- Prefer documented command names, flags, paths, event types, and API names.
- Mark provider- or model-dependent behavior as dependent on the provider or model.
- Do not present an illustrative command as universally safe.
- Recheck versions, provider names, model identifiers, and URLs before publishing.
- Never fabricate a tool, API, output, credential path, or feature to fill a gap.

## Code and command examples

Every substantial example should be:

- Runnable or clearly labelled as pseudocode/configuration
- Scoped to a directory or project when that matters
- Safe to copy without exposing credentials
- Followed by expected behavior or a verification command

Use placeholders such as:

```text
/path/to/your/project
YOUR_API_KEY
@your-org/your-package
```

Never include real API keys, auth files, private keys, `.env` contents, session files, or personal machine paths in tutorial content.

When demonstrating destructive or consequential operations:

- Explain the risk.
- Prefer a dry run, focused path, branch, or disposable workspace.
- Show how to inspect the result before committing or publishing.
- Do not normalize broad commands such as `git add .`, recursive deletion, or unattended execution without a specific safety explanation.

## Markdown rules

- Keep the canonical source as plain Markdown; do not add Marp frontmatter or slide separators to it.
- Use `##` for main tutorial chapters and `###` for subsections.
- Use fenced code blocks with language identifiers where possible.
- Use blockquotes for short principles or callouts, not long paragraphs.
- Keep headings descriptive enough to work in a table of contents.
- Keep links as real Markdown links or complete URLs.
- Avoid layout-specific HTML unless the source explicitly requires it and all output targets support it.

## Review checklist

Before calling the content complete:

- [ ] The first section gives the reader a useful first result.
- [ ] Prerequisites and platform assumptions are stated.
- [ ] Commands and paths match the current tool documentation.
- [ ] Examples use placeholders rather than credentials.
- [ ] Safety boundaries are explicit.
- [ ] The chapter progression is coherent without slides.
- [ ] The expected output or verification step follows important commands.
- [ ] The operating checklist reflects the actual workflow.
- [ ] References are official or clearly labelled as examples.
- [ ] No Marp markers appear in the canonical long-form source.
- [ ] Derived decks and PDFs are rebuilt or explicitly marked as needing regeneration.
