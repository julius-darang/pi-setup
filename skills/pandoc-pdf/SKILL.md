---
name: pandoc-pdf
description: Build and validate vertical tutorial PDFs from canonical Markdown with Pandoc and XeLaTeX. Use when producing a book-like PDF rather than a fixed-page Marp deck.
---

# pandoc-pdf

Use this skill for long-form, vertical tutorial PDFs in `brand/tutorials/`. The target is a readable document with flowing prose, code blocks, a table of contents, page furniture, and stable printed pages.

## Pipeline

The PDF pipeline is deliberately separate from Marp:

```text
canonical Markdown
        ↓
temporary cleaned Markdown input
        ↓
Pandoc
        ↓
XeLaTeX + project header/template
        ↓
vertical PDF
```

For the Pi Coding Agent tutorial:

```text
brand/tutorials/PI-CODING-AGENT/pi-agent-contents.md
        ↓
brand/tutorials/PI-CODING-AGENT/build-pdf.sh
        ↓
brand/tutorials/PI-CODING-AGENT/pi-agent-full.pdf
```

Do not use `pi-agent.md` or `pi-agent-full.md` as the PDF source. They are Marp presentations with fixed slide pages.

## Files and responsibilities

The expected project layout is:

```text
PI-CODING-AGENT/
├── pi-agent-contents.md   # canonical long-form content
├── pi-agent-full.pdf      # generated output; normally Git-ignored
├── build-pdf.sh           # reproducible build entry point
├── _pdf-header.tex        # PDF layout and styling
└── _pdf-parts.json        # PDF-only part boundaries
```

- Put tutorial prose, commands, examples, and references in the Markdown source.
- Put page size, fonts, colors, headings, code styling, headers, footers, and PDF metadata in the XeLaTeX header.
- Put build orchestration and preflight checks in the shell script.
- Do not put tutorial prose in `_pdf-header.tex`.
- Do not manually edit the generated PDF.

## Four-part tutorial structure

For a long tutorial, use PDF-only part metadata rather than inserting raw LaTeX into the canonical Markdown. The Pi Coding Agent tutorial uses:

```text
_pdf-parts.json
```

Each entry defines a Roman numeral, title, description, and the Markdown heading before which the divider should appear. The current four parts are:

1. **Foundations** — installation through trust and project context
2. **Operating Workflow** — Git, commands, sessions, compaction, and models
3. **Automation and Customization** — print, JSON, RPC, skills, extensions, and packages
4. **Integration and Shipping** — custom models, SDK, sandboxing, capstone, and operations

The build script injects a temporary `\partpage{...}` marker before each configured heading. `_pdf-header.tex` renders that marker as a full-page dark divider and adds a table-of-contents entry and PDF bookmark. The source Markdown and Marp decks remain free of PDF-only LaTeX.

When changing the part boundaries:

- Update `_pdf-parts.json`.
- Use exact canonical Markdown heading anchors.
- Keep the four parts in reading order.
- Rebuild and confirm all four divider pages appear.
- Check the table of contents and PDF bookmarks.

## Prerequisites

The current implementation requires:

```bash
command -v pandoc
command -v xelatex
```

On macOS with Homebrew:

```bash
brew install pandoc
```

XeLaTeX may come from an existing TeX distribution. Do not add Pandoc, TeX, or other renderer binaries to the repository. Record the required tools in the project's README instead.

Quarto and Typst are valid alternatives for future projects, but do not silently change the renderer for an existing tutorial. The renderer, header, and build script should be treated as a coordinated implementation.

## Build procedure

Run the project build script from any directory:

```bash
brand/tutorials/PI-CODING-AGENT/build-pdf.sh
```

Or run it from the tutorial directory:

```bash
cd brand/tutorials/PI-CODING-AGENT
./build-pdf.sh
```

Use a custom output path for previews or release staging:

```bash
./build-pdf.sh /tmp/pi-agent-preview.pdf
```

A robust build script should:

1. Resolve paths relative to the script, not the caller's current directory.
2. Fail when `pandoc` or `xelatex` is missing.
3. Create a temporary input file with `mktemp`.
4. Register cleanup with `trap`.
5. Read the PDF part metadata and inject only the configured divider markers into the temporary copy.
6. Make only deliberate source normalization changes in the temporary copy.
7. Invoke Pandoc with explicit input format, raw LaTeX support, output engine, header, table of contents, and syntax highlighting options.
8. Write the requested output path.
9. Leave no temporary Markdown, `.aux`, `.log`, or credential files in the tutorial directory.

The essential Pandoc options are:

```bash
pandoc INPUT.md \
  --from=markdown+raw_tex+pipe_tables+autolink_bare_uris+strikeout+task_lists+gfm_auto_identifiers \
  --to=pdf \
  --pdf-engine=xelatex \
  --include-in-header=_pdf-header.tex \
  --toc \
  --toc-depth=2 \
  --syntax-highlighting=pygments \
  --output=OUTPUT.pdf
```

## Layout guidance

Use the shared tutorial visual language rather than inventing a separate brand system:

- Accent: `#D77600`
- Blue support color: `#4A90D9`
- Muted text: `#7A7A78`
- Dark cover: `#0A0A0A`
- Light readable body pages
- Sans-serif body and headings
- Monospace commands and code

The current PDF uses A4 pages, a dark cover, orange headings, restrained typography, a table of contents, page headers, footers, and page numbers. Keep body pages readable on paper and on screen; do not copy a slide layout into the PDF.

## Source preparation

If the Markdown source contains a title and subtitle that are used by a custom cover, remove them only from the temporary build input. Do not remove them from the canonical source.

If the renderer's selected font cannot represent a source character, normalize that character in the temporary copy or add an intentional font fallback. Do not silently alter the canonical tutorial.

Use heading levels consistently:

```markdown
## Main chapter

### Subsection
```

Set the table-of-contents depth to match the source hierarchy. Do not include every small subsection unless the document is short enough for that to remain useful.

## PDF validation

After building, inspect metadata and dimensions:

```bash
pdfinfo pi-agent-full.pdf | grep -E 'Pages|Page size|Title|Author'
```

The expected format for the current tutorial is A4:

```text
Page size: 595.44 x 841.68 pts
```

Confirm that text is present and important sections survived conversion:

```bash
pdftotext pi-agent-full.pdf - | less
pdftotext pi-agent-full.pdf - | rg 'Install Pi|Troubleshooting|Official references'
```

Preview the cover, contents, and a body page visually when changing layout:

```bash
mkdir -p /tmp/tutorial-pdf-preview
pdftoppm -png -f 1 -singlefile -r 120 \
  pi-agent-full.pdf /tmp/tutorial-pdf-preview/cover
pdftoppm -png -f 2 -singlefile -r 120 \
  pi-agent-full.pdf /tmp/tutorial-pdf-preview/contents
pdftoppm -png -f 3 -singlefile -r 100 \
  pi-agent-full.pdf /tmp/tutorial-pdf-preview/body
```

Also validate the build script before handing it off:

```bash
bash -n build-pdf.sh
```

## Content and renderer boundaries

- Use `tutorial-content` when changing the written lesson.
- Use `marp-output` when changing a Marp deck or its fixed-page rendering workflow.
- Use `pandoc-pdf` when changing the vertical PDF pipeline or PDF layout.
- Use `visual-style` as the shared palette and visual-template registry.

A content change may require rebuilding multiple outputs, but no output should be treated as the source of truth for another output.

## Security and reproducibility

The PDF build should only read the tutorial source and local style files. It must not read:

- `~/.pi/agent/auth.json`
- `.env` files
- private keys
- session files
- unrelated project credentials

Use placeholders in examples. Keep generated PDFs ignored when the repository convention is to rebuild release artifacts. Never pipe secrets into Pandoc, XeLaTeX, or a build script.

## Troubleshooting

### Pandoc is missing

Install it with the project-approved package manager, then rerun the command:

```bash
brew install pandoc
```

### XeLaTeX is missing

Install or activate a TeX distribution and confirm its binary is on `PATH`:

```bash
command -v xelatex
```

### The PDF is stale

Confirm that the script reads the canonical Markdown source and rebuild to a known output path. Do not inspect or edit the Marp deck expecting the vertical PDF to change.

### The table of contents is empty or too detailed

Check the Markdown heading levels and the `--toc-depth` setting. Confirm that the four part entries are being added by the PDF header macro. Rebuild twice if using a LaTeX workflow that requires auxiliary-file resolution, and verify the extracted PDF text.

### A part divider appears as literal text

The temporary Markdown input must allow raw LaTeX. Use the explicit Markdown extensions in `build-pdf.sh`, including `raw_tex`; plain `gfm` intentionally treats the `\partpage{...}` marker as text.

### Code is clipped or unreadable

Shorten very wide examples, split them into multiple code blocks, or adjust the code font and wrapping in `_pdf-header.tex`. Do not solve a body-page overflow by turning the whole tutorial into fixed-size slides.
