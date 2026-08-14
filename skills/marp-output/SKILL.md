---
name: marp-output
description: Author, structure, style, render, and validate Marp decks. Use for presentations, carousels, tutorial decks, and other Markdown files rendered with Marp; choose a descriptive named template and its local reference when one exists.
---

# Marp Output

A standalone workflow for creating fixed-page Marp decks: choose the output profile, select a visual template, adapt the content, render the deck, and inspect the result.

All concrete template references used by this skill live in this skill's own `reference/` directory. This document defines the workflow and the stable template contracts; the reference files provide the complete Marp frontmatter, CSS, and representative markup.

## Scope

Use this skill for fixed-page Marp outputs:

- Presentations
- Social carousels
- Tutorial decks
- Visual walkthroughs
- Technical reference decks

This skill does not define the canonical source prose for a long-form publication, and it does not generate flowing book-like PDFs. Treat those as separate editorial outputs. A Marp deck is an adaptation of source content, not automatically the source of truth for another output.

## Decision protocol

Before editing, inspect the target deck, its source content, and any local assets that the deck intentionally uses. Infer decisions from the task and existing deck whenever possible.

Ask the user only when an unresolved decision materially changes the output. Ask one question at a time, in this order:

1. **Output profile** — presentation, carousel, vertical carousel, print/reference deck, or custom.
2. **Visual template** — `template-1`, `template-2`, `template-3`, or custom.
3. **Deliverables** — source only, PDF, image preview, or a combination.
4. **Audience, length, or CTA** — only when the structure cannot be inferred.

Do not ask for information already present in the task or target files.

### Defaults

| Situation | Default |
|---|---|
| Generic technical presentation | 4:3, `template-1` |
| Dark instructional or tutorial deck | 4:3, `template-2` |
| Light instructional or tutorial deck | 16:9, explicitly selected `template-3` |
| Existing deck with a deliberate format | Preserve its profile and selected template |
| Unspecified deliverable | Preserve the source and render a PDF for verification |
| Visual inspection | Render image previews into `/tmp` or another ignored directory |

Do not infer a template from a project or brand name. Choose based on the intended visual treatment and the existing deck.

## Output profiles

Choose the smallest profile that matches the request:

- **Presentation** — use the selected template's dimensions; do not assume 16:9.
- **Carousel** — usually 4:5; concise cards for social/tutorial use.
- **Vertical carousel** — usually 9:16; mobile-first cards.
- **Print/reference deck** — dimensions and typography defined by the selected reference or explicit request.
- **Custom** — ask for dimensions and intended use.

Do not silently change aspect ratio or page size. If an existing deck has a deliberate format, preserve it unless the user asks for a conversion.

## Source and authoring workflow

### 1. Identify the source

Determine whether the target is:

- Canonical long-form Markdown
- A concise deck
- An expanded deck
- A generated PDF or image
- A template/reference deck

For editorial tutorials, use this relationship:

```text
source prose → adapted Marp deck → rendered fixed-page output
```

Do not edit a generated PDF as if it were source content. Do not copy a full prose chapter into slides without adapting it.

### 2. Build the narrative

A tutorial or explanatory deck will usually benefit from:

1. Cover — title, promise, and identity
2. Orientation — what the audience will understand or build
3. Core concepts — one clear idea per slide
4. Demonstration — show a useful result early
5. Workflow or practice — give a bounded next action
6. Safety and constraints — explain where judgment remains necessary
7. Recap — checklist or decision rule
8. References or CTA — one clear next step

A short carousel may combine or omit sections. A technical reference deck may prioritize orientation, reference sections, and a final checklist. Do not force every deck into the same slide count.

### 3. Write for slides

- Keep one dominant idea per slide.
- Show the result, decision, or useful command before a long explanation.
- Prefer short headings, compact explanations, and one visual or code example.
- Use generous margins and deliberate whitespace.
- Split crowded slides instead of shrinking text until it becomes unreadable.
- Use one column by default; use two columns only when comparison or sequencing improves comprehension.
- Keep code examples small and legible.
- Preserve factual distinctions and safety warnings from the source.
- Do not fabricate screenshots, command output, links, or product capabilities.
- Avoid generic hype, filler, and decorative complexity.

## Visual templates

Visual design is governed by the `visual-style` skill when it is available. This skill owns the Marp workflow, while `visual-style` owns template contracts, design tokens, and the shared matplotlib system. The local reference files remain the concrete implementation sources.

| ID | Use | Profile | Reference |
|---|---|---|---|
| `template-1` | Pi Agent editorial and generic technical decks | 4:3 | `reference/template-1.md` |
| `template-2` | Dark Polymath instructional decks | 4:3 | `reference/template-2.md` |
| `template-3` | Explicitly light instructional decks | 16:9 by default | `reference/template-3.md` |

When `visual-style` is not loaded, read the selected reference relative to this skill directory and preserve its frontmatter, CSS, layout primitives, typography, palette, and pagination behavior. Do not invent a competing style from memory.

### Skill handoff

| Concern | Owner |
|---|---|
| Template IDs, design tokens, and visual contracts | `visual-style` |
| Narrative structure and slide authoring | `marp-output` |
| CSS/frontmatter implementation | Selected reference file |
| Marp rendering and output paths | `marp-output` |
| Visual inspection and output validation | `marp-output` |

## Template discipline

When using one of the named templates:

- Use the selected template's local reference as the implementation source.
- Copy its frontmatter and CSS structure rather than reconstructing the style from memory.
- Reuse its layout primitives and cover/CTA structure.
- Replace the reference deck's example content; do not treat that content as canonical source prose.
- Preserve required page furniture, pagination behavior, and contrast rules.
- Add a focused class for a genuinely new layout instead of copying a second full style system.
- Do not mix palettes, font systems, or CTA treatments between named templates without an explicit design decision.
- If an existing deck already uses a deliberate custom style, preserve it unless the user asks for a template conversion.

The reference files are self-contained implementation exemplars. They are the only template files required by this skill.

## Runtime requirements

- Marp CLI is required for rendering.
- PDF output requires the browser backend used by the Marp installation.
- The references import web fonts and define fallbacks. Offline rendering works with fallback fonts but may differ visually.
- Local images or other assets are optional and should be reviewed before enabling local-file access.

## Required frontmatter

Every Marp deck must begin with appropriate Marp frontmatter. At minimum:

```yaml
---
marp: true
paginate: true
---
```

Preserve the selected reference's additional frontmatter:

### Templates 1 and 2

```yaml
html: true
size: 4:3
```

Also preserve the reference's font imports, pagination setting, and CSS variables.

### Template 3

```yaml
html: true
theme: default
```

Template 3 intentionally uses Marp's default 16:9 size. Do not add `size: 4:3` unless the user explicitly requests a profile conversion.

Do not put Marp frontmatter or slide separators into canonical long-form Markdown.

## Rendering

Render from the directory containing the target deck or pass an explicit path. Always use an explicit output path outside the source directory:

```bash
marp <deck>.md --pdf --output /tmp/<deck>.pdf
```

For image previews:

```bash
marp <deck>.md --images png --output /tmp/<deck>-preview
```

If another artifact uses the same basename, never let Marp write beside the source deck. Use an unambiguous output name such as:

```bash
marp <deck>.md --pdf --output /tmp/<deck>-marp.pdf
```

Use `--allow-local-files` only when the deck intentionally references reviewed local assets.

Keep generated previews outside the repository or in an ignored output path unless the project explicitly requires committed output.

## Validation and visual inspection

Before declaring the work complete:

- Confirm frontmatter includes `marp: true`.
- Confirm the selected profile and page size are correct.
- Confirm the selected template is used consistently.
- Confirm cover and closing/CTA slides are readable.
- Inspect the densest content slide.
- Inspect the code or installation slide when present.
- Inspect the final slide.
- Check for clipping, overflow, weak contrast, and accidental overlap.
- Check that code is legible at the final output size.
- Check that links and commands are accurate.
- Check required watermarks, pagination, and page furniture.
- Check that no private paths, credentials, session content, or secrets entered the deck.
- If `pdfinfo` is available, inspect PDF metadata and dimensions:

```bash
pdfinfo /tmp/<deck>.pdf | grep -E 'Pages|Page size|Title|Author'
```

Use image previews for visual QA; do not rely on successful Marp exit status alone.

## Completion contract

A completed Marp task should leave:

1. The correct source Markdown edited or preserved.
2. A coherent deck narrative for the selected profile.
3. One selected visual template applied consistently.
4. A rendered output or an explicit explanation of why rendering was not possible.
5. Visual inspection of representative slides.
6. No generated clutter or temporary files in the repository unless explicitly requested.
7. Clear follow-up information when another output must be rebuilt separately.

## Extension points

- Add a small number of named layout classes for genuinely different slide types.
- Add a new reference file only when there is a concrete visual use case.
- A new reference must include complete frontmatter, concrete CSS, representative cover/content/closing markup, supported dimensions, and known pagination behavior.
- Update this skill's template registry whenever a new reference is added.
- Add scripts only when rendering or validation becomes repeatable enough to justify them.
