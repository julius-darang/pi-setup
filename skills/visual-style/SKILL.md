---
name: visual-style
description: Shared visual-style registry for EE/math figures and Marp decks. Use when creating or refining a branded visual, a matplotlib FigureBuilder topic, or a Marp deck; choose a named template instead of inventing a competing style.
---

# Visual Style

This skill is the visual source of truth for reusable styles. It defines named templates and design tokens; `marp-output` handles Marp authoring, structure, rendering, and QA.

## Ownership and handoff

`visual-style` owns visual decisions:

- Template IDs and intended use
- Design tokens, typography, palettes, and page dimensions
- Layout primitives, cover/CTA treatment, and pagination rules
- The shared matplotlib visual system

`marp-output` owns execution:

- Output-profile selection and narrative structure
- Slide authoring and content adaptation
- Marp rendering, output paths, and visual QA

When both skills are loaded, use this registry for design choices and `marp-output` for the build workflow. The selected reference file is the implementation source for CSS and frontmatter.

## Style selection

Choose a named template before creating a new visual:

- `template-1` for generic Marp work and the Pi Agent editorial style.
- `template-2` for dark Polymath tutorial decks and other `brand/tutorials/` instructional outputs.
- `template-3` for explicitly selected light-background Polymath instructional outputs.

Use the repository’s existing template files when they exist. Do not recreate shared styling from memory or introduce a new palette without an explicit decision.

## Marp template registry

Every future template should define:

- ID and name
- Intended use and supported output profiles
- Typography
- Palette and background behavior
- Layout primitives
- Cover and CTA treatment
- Regular-slide treatment
- Watermark and page-number rules
- Reference/template files
- Rendering and inspection requirements

### `template-1` — pi-agent-editorial

The Pi Agent editorial reference style and the global fallback for generic Marp decks.

**Direct reference:**

```text
marp-output/reference/template-1.md
```

The reference is an exact copy of:

```text
brand/tutorials/PI-CODING-AGENT/pi-agent.md
```

**Use for:**

- `brand/tutorials/PI-CODING-AGENT/` decks
- Generic presentations
- Technical explainers without another project brand system
- Minimal editorial/terminal-inspired decks

**Visual contract:**

- 4:3 page size unless the requested profile explicitly requires another size
- Dark `#121313` background with restrained off-white and gray text
- Serif body and heading treatment: STIX Two Text, Latin Modern Roman, Georgia, or an available equivalent
- Monospace code and metadata: JetBrains Mono, IBM Plex Mono, or system monospace
- No negative letter spacing on serif headings
- Plain inline code without pills, borders, or rounded backgrounds
- Generous margins and open whitespace
- Centered, vertically balanced composition
- Thin rules and left-border cards rather than rounded UI panels
- One dominant idea per slide

Use the copied reference directly instead of reconstructing this CSS from memory. `brand/tutorials/_templates/marp-template-mono.md` remains a separate legacy reference and is not `template-1`.

**Cover and CTA:**

- Preserve the dark editorial cover treatment.
- Center the cover content.
- Use concise title and subtitle text.
- Keep the CTA to one concise next step.

### `template-2` — polymath-tutorial

The dark Polymath tutorial and branded instructional reference style.

**Use for:**

```text
Other brand/tutorials/ decks that do not explicitly use the Pi Agent reference.
```

**Direct reference:**

```text
marp-output/reference/template-2.md
```

Resolve the reference relative to the `marp-output` skill directory. Use its frontmatter and CSS as the concrete implementation source; use this section as the stable design contract.

**Visual contract:**

- 4:3 page size unless a profile conversion is explicitly requested
- Near-black `#0a0a0a` background with off-white text
- DM Sans for headings and body copy
- DM Mono for code, metadata, page numbers, and labels
- Orange accent: `#d77600`
- Centered, spacious composition with a 720px content width contract
- Header rows with orange Roman-numeral markers
- Transparent list and card rows with orange left rules or labels
- Dark cover and divider slides
- White CTA slide with orange kicker and concise next action
- Built-in `PI CODING AGENT · n / total` pagination footer on regular and divider slides
- Cover and CTA slides intentionally suppress the footer
- No blue/light-body palette substitution unless a separate project style is explicitly selected

**Named layout primitives:**

- `.cover` with `.cover-content`, `.cover-kicker`, and `.cover-meta`
- `.header-row` with `.page-num`
- `.cards-col` with `.card-row`
- `.list` with `.list-item`, `.list-num`, and `.list-text`
- `.divider`
- `.cta` with `.cta-content`, `.cta-kicker`, and `.cta-line`

A project may add content-specific classes while preserving the reference's typography, palette, page furniture, and pagination. `brand/tutorials/_templates/MARP_STYLING_TEMPLATE.md` and `marp_template_cover.md` remain supporting project-local styles for decks that explicitly select them; they are not the default `template-2` reference.

### `template-3` — polymath-light

The light companion to the dark `template-2` tutorial style.

**Use for:**

```text
Explicitly selected light-background Polymath instructional outputs.
```

**Direct reference:**

```text
marp-output/reference/template-3.md
```

Resolve the reference relative to the `marp-output` skill directory. Use its frontmatter and CSS as the concrete implementation source; use this section as the stable design contract.

**Visual contract:**

- Default 16:9 page size
- Warm off-white `#f7f6f2` body background with dark text
- DM Sans for headings and body copy
- DM Mono for code, metadata, page numbers, and labels
- Orange accent: `#d77600`
- Light cover and light divider slides
- Dark CTA slide with light text and orange kicker
- Centered, spacious composition with a 720px content width contract
- The same header, card, list, and pagination primitives as `template-2`
- Built-in `PI CODING AGENT · n / total` pagination footer on regular and divider slides
- Cover and CTA slides intentionally suppress the footer

`template-3` is an explicit light-theme choice. Do not infer it merely because a deck is instructional; use `template-2` for the default dark tutorial treatment unless the light surface is requested or clearly indicated by the existing deck.

## Tutorial deck requirements

These requirements apply to `template-2` and `template-3`:

- Keep the title short enough to read at carousel size.
- Preserve the tutorial and author/brand identity.
- Check pagination on regular and divider pages; confirm the intentional footer suppression on cover and CTA pages.
- Show a useful command, output, decision, or result early.
- Do not copy dense long-form paragraphs directly onto slides.
- Keep examples legible at final PDF or carousel size.

## Matplotlib visual system

The shared visual language also applies to `software/matplotlib` figures.

**Palette:**

- Accent: `#d77600`
- Series blue: `#4a90d9`
- Muted: `#7a7a78`
- Background: `#0a0a0a`
- Foreground: `#f5f5f4`

**Fonts:**

- Inter for labels and headers
- DM Mono for data values

**Layout classes:**

- `SinglePanel`
- `HeroAndSide`
- `StackedPair`
- `HeroAndStack`
- `QuadPanel`

**Annotation rule:**

At most one callout, one threshold, and one event marker per panel.

## Sources of truth

- `software/matplotlib/design.md` — full matplotlib specification.
- `brand/tutorials/PI-CODING-AGENT/pi-agent.md` — source exemplar for `template-1`.
- `marp-output/reference/template-1.md` — directly accessible copied `template-1` reference.
- `marp-output/reference/template-2.md` — directly accessible `template-2` reference.
- `marp-output/reference/template-3.md` — directly accessible `template-3` reference.
- `brand/tutorials/_templates/MARP_STYLING_TEMPLATE.md` — supporting project-local tutorial style.
- `brand/tutorials/_templates/marp_template_cover.md` — supporting project-local cover style.

Add a future template only when there is a concrete output need. Follow the registry fields above and update `marp-output` only if the template requires a new workflow or selection rule.
