# Pi Setup

Reusable extensions and skills for the [Pi Coding Agent](https://pi.dev).

This repository is a **capability layer**, not a complete Pi installation. It adds tools, safety hooks, subagents, UI commands, and task-specific instructions to an existing Pi installation while leaving provider credentials and personal settings under the user's control.

## What is included

### Extensions

| Extension | Adds |
|---|---|
| `ask-user-question` | Structured questions and confirmations |
| `bash-guard` | Confirmation gates for risky agent-issued Bash commands |
| `context` | `/context`, a context-window usage view |
| `custom-header` | A customizable startup header |
| `filechanges` | `/filechanges` and reversible `edit`/`write` tracking |
| `subagents` | `scout`, `researcher`, and `worker` agents through one `subagent` tool |
| `web-fetch` | Readable extraction from one webpage or PDF |

### Skills

| Skill | Purpose |
|---|---|
| `marp-output` | Author, render, and validate Marp decks |
| `ffmpeg-output` | Stitch images or rendered Marp slides into silent MP4 clips |
| `pandapower-analysis` | Run preliminary load flow, load-profile, and IEC 60909 short-circuit studies |
| `pandoc-pdf` | Produce flowing book-like PDFs with Pandoc and XeLaTeX |
| `send-email` | Compose, preview, and explicitly confirm Gmail SMTP messages |
| `tutorial-content` | Structure canonical long-form tutorial content |
| `visual-style` | Reuse a named visual system for figures and decks |

The `researcher` subagent also uses the separately installed `pi-web-access` package for search, source checking, and richer web retrieval.

## Requirements

- Pi Coding Agent 0.84.4 (the package currently targets the 0.84.x API)
- Node.js 22.19 or newer and npm
- Python 3 for the optional `send-email` helper
- A configured Pi provider or subscription
- Optional: `pi-web-access` for the researcher agent
- Optional: Pandoc and XeLaTeX for `pandoc-pdf`
- Optional: Marp CLI and its browser backend for `marp-output` or Markdown input to `ffmpeg-output`
- Optional: FFmpeg and `ffprobe` for `ffmpeg-output`
- Optional: a user-managed Python environment with `pandapower`, `pandas`, `PyYAML`, and `matplotlib` for `pandapower-analysis`

## Installation

### Option A: Install as a Pi package

After publishing this repository, install it with:

```bash
pi install git:github.com/julius-darang/pi-setup
```

Pin a release or commit for reproducibility:

```bash
pi install git:github.com/julius-darang/pi-setup@v0.1.0
```

Then install the web-access dependency:

```bash
pi install npm:pi-web-access@0.27.0
```

### Option B: Clone and run the installer

This registers the checkout as a local Pi package, installs its locked npm dependencies without lifecycle scripts, runs the full `npm run validate` gate before registration, and registers the pinned `pi-web-access` package. Existing manually copied extensions and skills are not removed.

```bash
git clone https://github.com/julius-darang/pi-setup.git
cd pi-setup
./install.sh
```

Use another Pi directory when needed:

```bash
PI_CODING_AGENT_DIR="$HOME/.config/pi/agent" ./install.sh
```

If the global directory already contains manually copied copies of this package's resources, review the migration plan before restarting Pi:

```bash
npm run migration:report
node scripts/migrate-global-resources.mjs --apply
```

The migration moves only the overlapping extension and skill paths into a dated backup; it leaves unrelated resources such as `stop-slop` in place. It restores the private email `.env` and recipient files to the stable config path (with mode `600`) so moving the duplicate skill code does not disable email. Use the dry-run output and keep the backup until the package has loaded successfully.

Restart Pi or run `/reload` after installation.

### Session retention

Pi sessions remain local and may contain sensitive prompts and tool output. Review old JSONL sessions with the dry-run report before removing anything:

```bash
npm run sessions:report
node scripts/retain-sessions.mjs --days 30
```

Only delete after reviewing the report and confirming you have any backup you need:

```bash
node scripts/retain-sessions.mjs --days 30 --apply
```

The command uses `PI_CODING_AGENT_DIR` when set, keeps the default retention window at 30 days, and never deletes by default.

## Configuration

Pi's personal settings should remain outside this repository. Copy `settings.example.json` only when you want a starting point:

```bash
cp settings.example.json ~/.pi/agent/settings.example.json
```

Do not copy credentials into the repository. Pi authentication belongs in Pi's normal auth flow (`/login`) or in the user's local environment.

### Subagent models

The bundled agent definitions inherit Pi's configured model by default. Override individual agents without editing the files. Explicit overrides must be exact `provider/model` identifiers registered in Pi's model registry; invalid overrides are rejected before a child process starts. Model IDs containing additional slashes are supported:

```bash
export PI_SUBAGENT_MODEL_SCOUT='your-provider/your-model'
export PI_SUBAGENT_MODEL_RESEARCHER='your-provider/your-model'
export PI_SUBAGENT_MODEL_WORKER='your-provider/your-model'
# Optional fallback for agents whose frontmatter omits `model`:
export PI_SUBAGENT_DEFAULT_MODEL='your-provider/your-model'
```

The environment variable names are derived from the agent names. The override is useful when a provider does not offer the example models.

### Email skill (optional)

The email skill is disabled in practice until you configure it locally. Never commit the real credentials or recipient list.

```bash
PI_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
mkdir -p "$PI_DIR/skills/send-email"
cp skills/send-email/.env.example "$PI_DIR/skills/send-email/.env"
cp skills/send-email/recipients.example.txt "$PI_DIR/skills/send-email/recipients.txt"
chmod 600 "$PI_DIR/skills/send-email/.env" "$PI_DIR/skills/send-email/recipients.txt"
```

Edit those files locally. The SMTP password must be a Google App Password, not a normal Google password. The skill always requires an exact preview and explicit confirmation before sending.

## How it works

```text
Pi runtime
  ├── global settings and authentication
  ├── installed extensions  ── tools, commands, hooks, UI
  ├── installed skills       ── task-specific model instructions
  └── optional packages      ── pi-web-access and other capabilities
```

The `subagents` extension starts isolated Pi processes. Agents inherit the user's configured Pi model unless a `PI_SUBAGENT_MODEL_*` or `PI_SUBAGENT_DEFAULT_MODEL` override is set:

```text
parent session
  └── subagent tool
      ├── scout       read-only codebase exploration
      ├── researcher  web research
      └── worker      implementation; may call scout/researcher
```

Child processes do not inherit the parent's conversation or session. The parent must pass all relevant context in the task description. Worker edits happen on the same filesystem, so inspect `git diff` after delegated work.

## Safety model

`bash-guard` inspects Bash commands issued by the agent. The main interactive session asks whether to run or abort commands classified as risky. Spawned child sessions receive an explicit `PI_SUBAGENT_DEPTH` and use headless blocking for catastrophic patterns. Worker `safe_bash` also blocks Git mutations; workers may inspect Git state but commits, pushes, pulls, and other repository mutations belong in the parent session.

The safety layer is not a sandbox and is not a complete security boundary:

- it covers agent-issued `bash`, not every possible tool or user-entered shell command;
- `edit` and `write` remain powerful operations;
- extensions execute TypeScript with the permissions of the current user;
- skills are instructions and can influence model actions;
- inspect all code before installing third-party Pi packages.

Use a container, VM, restricted OS account, or other sandbox when the task requires a stronger boundary.

## Project-local resources

This repository intentionally does not include workspace-specific context such as `AGENTS.md`, `STATUS.md` conventions, or a project `/doctor` command. Those belong in the consuming project. The resources here are reusable global capabilities.

A project can still add its own resources under `.pi/`:

```text
project/
├── AGENTS.md
└── .pi/
    ├── settings.json
    ├── extensions/
    └── skills/
```

## Updating and removing

For a package installation:

```bash
pi update --extensions
```

For a checkout-based installation, pull the repository and rerun:

```bash
git pull
./install.sh
```

Remove the package through Pi's package manager when it is no longer needed. Do not remove manually copied resources until you have confirmed they are duplicates; keep a backup before any cleanup.

## Public-repository policy

This repository deliberately excludes:

- `auth.json`, provider credentials, and API keys;
- `.env` files;
- personal recipient lists;
- Pi sessions and trust state;
- `node_modules/`, Python caches, and machine-specific generated files;
- personal project context such as `AGENTS.md` and workspace maps.

If a credential has ever been committed, revoke or rotate it before publishing, even if the file is later deleted from the working tree.

## License

MIT. See [LICENSE](LICENSE).
