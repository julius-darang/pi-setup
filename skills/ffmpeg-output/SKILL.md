---
name: ffmpeg-output
description: Create silent MP4 clips by stitching images or rendering a Marp deck to PNG first, with explicit image durations.
---

# FFmpeg Output

Create fixed-frame video clips from raster images or a Marp Markdown deck. Workflow: inspect the input → resolve image order and durations → render Marp if needed → encode outside the repository → validate the video.

This skill handles video assembly, not slide authoring. Use `marp-output` for deck content, template, and visual decisions.

## v1 scope

Supported inputs:

- A directory of PNG, JPG, or WebP images.
- A Marp `.md` deck; render every slide to PNG in Marp order first.

The output is a silent MP4 with H.264 video, `yuv420p` pixel format, and a fixed 30 fps. Use `/tmp` or another ignored directory for all generated files. Do not modify the source deck or images.

Not supported in v1: PDF input, audio, captions, transitions, animation, slide selection, image scaling, padding, cropping, or GIF output.

## Decisions and defaults

Inspect the source, assets, and requested deliverable before running commands. Ask one question at a time only when a missing choice materially changes the result:

1. Input source — image directory or Marp `.md`.
2. Timing — uniform duration or a complete timing manifest.
3. Output path — default to `/tmp/<source-name>.mp4` when unspecified.

Use these defaults:

- A Marp deck renders all slides in deck order.
- An image directory without a manifest uses natural filename order.
- No duration is assumed. Require an explicit uniform duration unless every manifest entry supplies its own duration.
- Do not infer cropping, padding, scaling, transitions, or audio behavior.

## Timing manifest

A manifest defines the complete image order. List every image exactly once, one per line:

```text
001.png
002.png 3.5
003.png
004.png 6
```

The duration is in seconds and may be an integer or decimal. A line without a duration uses the explicit uniform duration. A line with a duration overrides it. If any line omits a duration, a uniform duration is required. Reject missing files, duplicate entries, extra entries, zero/negative durations, and malformed lines.

Resolve manifest paths relative to the manifest file. Keep v1 paths free of unescaped whitespace. Generate the internal FFmpeg concat file separately; do not pass the user manifest directly to FFmpeg.

## Image constraints

All input images must have matching width, height, and aspect ratio. Check dimensions before encoding with `ffprobe` or an equivalent installed tool. Reject mismatches instead of silently scaling, padding, or cropping.

For an image directory, filter to supported raster extensions and sort naturally. For a manifest, use its order and require that its entries match the intended source image set exactly.

## Marp input

When the input is `.md`:

1. Verify Marp CLI is available.
2. Render all pages to a temporary PNG directory:

   ```bash
   marp <deck>.md --images png --output /tmp/<deck>-frames
   ```

3. Add `--allow-local-files` only when the deck intentionally references reviewed local assets.
4. Apply the timing rules to the generated PNGs.

Preserve the deck’s frontmatter, CSS, content, and existing page order. Never write rendered images beside the source deck.

## Encoding

Create a temporary concat file from the resolved image paths and durations. Escape paths safely. The final image must be listed twice because FFmpeg’s concat demuxer does not apply the final `duration` entry unless the last file is repeated. Calculate the sum of all requested durations and cap the output with `-t`; otherwise the repeated final image can extend the clip.

A representative encode is:

```bash
ffmpeg -y -f concat -safe 0 -i /tmp/<source>-concat.txt \
  -t <sum-of-durations> -vf fps=30 -c:v libx264 -pix_fmt yuv420p \
  -an -movflags +faststart /tmp/<source>.mp4
```

Use an explicit output path. Do not write generated video or concat files into the repository.

## Validation

Before completion, verify:

- `ffmpeg`, and `marp` for Markdown input, are available.
- Every source image is present, ordered once, readable, and dimensionally compatible.
- The output exists, is playable, contains an H.264 video stream, and has no audio stream.
- Output dimensions match the input images and the duration is approximately the sum of image durations.
- The output uses the intended frame rate and `yuv420p` pixel format.

Inspect metadata with:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate \
  -of default=noprint_wrappers=1 /tmp/<source>.mp4
```

Extract representative frames—at minimum the first, a middle frame, and the last—to `/tmp` and inspect them when visual QA is relevant. Confirm that no frame is clipped, blank, corrupted, or unexpectedly reordered.

## Completion contract

A completed task leaves the requested silent MP4 at the chosen output path, preserves the source files, applies the requested durations, passes metadata and visual checks, and leaves no generated clutter in the repository. Explain any unavailable tool or skipped validation.

## Future extensions

Add features only when a concrete need exists: audio, transitions, slide ranges, scaling/padding/cropping, PDF rasterization, or GIF output. Keep each addition explicit rather than changing v1 defaults silently.
