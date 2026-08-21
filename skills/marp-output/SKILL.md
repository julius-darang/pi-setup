---
name: marp-output
description: Create, adapt, render, and validate fixed-page Marp decks using the named templates in `reference/`.
---

# Marp Output

Workflow: inspect the source and assets → choose a profile and template → adapt the content → render outside the repository → inspect and validate.

The self-contained references in `reference/` are the implementation authority for frontmatter, CSS, layout primitives, typography, palette, and page furniture. A deck is an adaptation of source content, not the source of truth for long-form prose.

## Decide before editing

Inspect the target deck, source content, and intentionally used local assets. Infer decisions from the task and existing deck. Ask one question at a time only when an unresolved choice materially changes the output, in this order:

1. Output profile — presentation, carousel, vertical carousel, print/reference, or custom.
2. Visual template — `template-1`, `template-2`, `template-3`, or custom.
3. Deliverables — source, PDF, previews, or a combination.
4. Audience, length, or CTA — only when structure cannot be inferred.

### Defaults

| Situation | Default |
|---|---|
| Generic technical presentation | 16:9, `template-1` |
| Dark instructional/tutorial deck | 4:3, `template-2` |
| Light instructional/tutorial deck | 16:9, explicitly selected `template-3` |
| Existing deck with a deliberate profile | Preserve it unless conversion is requested |
| Unspecified deliverable | Preserve source; render a PDF for verification |
| Visual inspection | Render previews into `/tmp` or another ignored directory |

Do not infer a template from a project or brand name. Do not silently change aspect ratio or page size.

## Profiles and authoring

Choose the smallest suitable profile: **presentation** (selected template dimensions), **carousel** (usually 4:5), **vertical carousel** (usually 9:16), **print/reference** (selected reference or request), **progressive** (duplicated static states), or **custom** (ask for dimensions and use).

Identify whether the source is long-form prose, a concise/expanded deck, a generated artifact, or a template. For editorial tutorials: `source prose → adapted Marp deck → rendered fixed-page output`. Never edit a generated PDF as source or copy a full prose chapter into slides without adaptation.

A typical tutorial arc is: cover → orientation → core concepts → early demonstration → bounded practice → safety/constraints → recap → references or CTA. Combine or omit sections when the profile calls for it; do not force a fixed slide count.

Write for slides:

- One dominant idea per slide; use short headings and compact explanations.
- Show the result, decision, command, or visual before extended explanation.
- Prefer one column; use two only for a useful comparison or sequence.
- Keep code examples small and legible; preserve factual distinctions and safety warnings.
- Split crowded slides instead of shrinking type.
- Do not fabricate screenshots, output, links, capabilities, or decorative hype.

## Progressive slide states

For click-by-click or part-by-part reveals compatible with PDF, PNG, and PPTX, duplicate complete static slide states; do not use CSS animation.

Keep repeated states geometrically fixed. Do not vertically center variable-height lists or card groups: later additions will move earlier content. Prefer a dedicated class:

```css
section.progressive-state {
  justify-content: flex-start;
  padding-top: 184px; /* adjust for the template and page size */
}
```

For an existing deck without a progressive class, preserve centered cover and CTA slides with:

```css
section:not(.cover):not(.cta) {
  justify-content: flex-start;
  padding-top: 184px;
}
```

Keep heading, container, item order, spacing, and layout mode identical across states; append only newly revealed items. Use a separate progressive deck when the concise deck is also distributed as a carousel or single-page PDF.

Validate first, intermediate, final, and densest states side by side. Confirm stable coordinates for existing content, no bottom clipping, and page count/pagination appropriate to the selected template. (`template-1` intentionally has no pagination.)

## Templates

When `visual-style` is available, it owns design tokens and visual contracts; this skill owns workflow, authoring, rendering, and QA. Otherwise, read the selected local reference and do not invent a competing style.

| ID | Use | Profile | Reference |
|---|---|---|---|
| `template-1` | Pi Agent editorial and generic technical decks; pagination disabled; progressive variant supported | 16:9 (default) | `reference/template-1.md` |
| `template-2` | Dark Polymath instructional decks | 4:3 | `reference/template-2.md` |
| `template-3` | Explicitly light instructional decks | 16:9 (default) | `reference/template-3.md` |

For named templates:

- Copy the selected reference’s frontmatter and CSS structure; reuse its primitives and cover/CTA treatment.
- Replace example content; do not treat reference prose as canonical.
- Preserve page furniture, pagination, contrast, fonts, variables, and palette.
- Add a focused class for a genuinely new layout; do not copy in a second style system.
- Preserve a deliberate custom style unless conversion is requested.

## Frontmatter and runtime

Marp CLI and its browser backend are required. References import web fonts with fallbacks; offline rendering may differ. Review local assets before using `--allow-local-files`.

Every deck begins with Marp frontmatter containing `marp: true`; set `paginate` deliberately because the selected reference may require `false`.

Preserve the selected reference’s additional frontmatter:

| Template | Required profile/frontmatter |
|---|---|
| `template-1` | `html: true`, `theme: default`, default 16:9, `paginate: false`, no page-number footer |
| `template-2` | `html: true`, `size: 4:3` |
| `template-3` | `html: true`, `theme: default`, default 16:9 |

Do not add `size: 4:3` to templates 1 or 3 unless explicitly converting the profile. Do not put Marp frontmatter or slide separators in canonical long-form Markdown.

## Rendering

Render from the deck’s directory or pass an explicit path. Always write outside the source directory:

```bash
marp <deck>.md --pdf --output /tmp/<deck>-marp.pdf
marp <deck>.md --images png --output /tmp/<deck>-preview
```

Use `--allow-local-files` only for reviewed local assets. Keep generated files in `/tmp` or another ignored path.

## Validation

Before completion, verify:

- `marp: true`, selected profile, page size, template, frontmatter, and pagination are correct.
- Cover, closing/CTA, densest slide, and code/install slide (when present) are readable.
- No clipping, overflow, overlap, weak contrast, or illegible code exists at output size.
- Links and commands are accurate; no private paths, credentials, session content, or secrets entered the deck.
- Required watermarks, pagination, and page furniture are present—or intentionally absent.

Use image previews for visual QA; a successful Marp exit status is not enough. If available, inspect PDF metadata:

```bash
pdfinfo /tmp/<deck>-marp.pdf | grep -E 'Pages|Page size|Title|Author'
```

## Completion contract

A task is complete only when the correct source is edited or preserved, the narrative fits the selected profile, one template is applied consistently, output is rendered (or failure is explained), representative slides are visually inspected, and no generated clutter remains in the repository. State any separate artifact that must be rebuilt.

## Extension points

Add only a small number of focused layout classes. Add a reference only for a concrete visual use case; it must include complete frontmatter, CSS, representative cover/content/closing markup, dimensions, and pagination behavior, and must be added to the registry. Add scripts only when rendering or validation is repeatable enough to justify them.
