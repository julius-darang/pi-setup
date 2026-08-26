# filechanges (pi extension)

Tracks files changed (modified/created) by **pi** via the built-in `edit` and `write` tools.

## Features

- Persistent log (stored in session as custom entries)
- Status line + widget listing changed files
- `/filechanges` overlay to inspect diffs
- `/filechanges-accept` to clear the log (keep files)
- `/filechanges-decline` to revert safely logged changes (restore original contents / delete created files; retain external-edit conflicts)

## Usage

1. Reload pi: `/reload`
2. Make changes through pi (using `edit`/`write`)
3. Run:
   - `/filechanges` to inspect
   - `/filechanges-accept` to accept (clear log)
   - `/filechanges-decline` to decline (revert safe entries; retain conflicts)

### Non-interactive usage

If `ctx.hasUI` is false (print/json mode), accept/decline require explicit confirmation:

- `/filechanges-accept force`
- `/filechanges-decline force`

## Notes

- Only tracks changes performed through `edit` and `write` tools.
- To support “decline”, the extension stores the original file contents (before the first pi change) in the session file as a custom entry.
- Decline checks the file against the last state observed after a successful pi edit/write. If another process changed it, the entry is retained and the file is left untouched.
