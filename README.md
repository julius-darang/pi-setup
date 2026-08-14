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
| `pandoc-pdf` | Produce flowing book-like PDFs with Pandoc and XeLaTeX |
| `send-email` | Compose, preview, and explicitly confirm Gmail SMTP messages |
| `tutorial-content` | Structure canonical long-form tutorial content |
| `visual-style` | Reuse a named visual system for figures and decks |

The `researcher` subagent also uses the separately installed `pi-web-access` package for search, source checking, and richer web retrieval.

## Requirements

- Pi Coding Agent 0.84 or newer
- Node.js and npm
- Python 3 for the optional `send-email` helper
- A configured Pi provider or subscription
- Optional: `pi-web-access` for the researcher agent
- Optional: Pandoc and XeLaTeX for `pandoc-pdf`
- Optional: Marp CLI and its browser backend for `marp-output`

## Installation

### Option A: Install as a Pi package

After publishing this repository, install it with:

```bash
pi install git:github.com/YOUR-USERNAME/pi-setup
```

Pin a release or commit for reproducibility:

```bash
pi install git:github.com/YOUR-USERNAME/pi-setup@v0.1.0
```

Then install the web-access dependency:

```bash
pi install npm:pi-web-access
```

### Option B: Clone and run the installer

This installs the extensions and skills into the global Pi directory (`~/.pi/agent/` by default), installs their npm dependencies, and installs `pi-web-access` if it is missing.

```bash
git clone https://github.com/YOUR-USERNAME/pi-setup.git
cd pi-setup
./install.sh
```

Use another Pi directory when needed:

```bash
PI_CODING_AGENT_DIR="$HOME/.config/pi/agent" ./install.sh
```

Restart Pi or run `/reload` after installation.

## Configuration

Pi's personal settings should remain outside this repository. Copy `settings.example.json` only when you want a starting point:

```bash
cp settings.example.json ~/.pi/agent/settings.example.json
```

Do not copy credentials into the repository. Pi authentication belongs in Pi's normal auth flow (`/login`) or in the user's local environment.

### Subagent models

The bundled agent definitions contain example model IDs. Override them without editing the files:

```bash
export PI_SUBAGENT_MODEL_SCOUT='your-provider/your-model'
export PI_SUBAGENT_MODEL_RESEARCHER='your-provider/your-model'
export PI_SUBAGENT_MODEL_WORKER='your-provider/your-model'
```

The environment variable names are derived from the agent names. The override is useful when a provider does not offer the example models.

### Email skill (optional)

The email skill is disabled in practice until you configure it locally. Never commit the real credentials or recipient list.

```bash
cp skills/send-email/.env.example ~/.pi/agent/skills/send-email/.env
cp skills/send-email/recipients.example.txt ~/.pi/agent/skills/send-email/recipients.txt
chmod 600 ~/.pi/agent/skills/send-email/.env
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

The `subagents` extension starts isolated Pi processes:

```text
parent session
  └── subagent tool
      ├── scout       read-only codebase exploration
      ├── researcher  web research
      └── worker      implementation; may call scout/researcher
```

Child processes do not inherit the parent's conversation or session. The parent must pass all relevant context in the task description. Worker edits happen on the same filesystem, so inspect `git diff` after delegated work.

## Safety model

`bash-guard` inspects Bash commands issued by the agent. The main interactive session asks whether to run or abort commands classified as risky. Spawned child sessions receive an explicit `PI_SUBAGENT_DEPTH` and use headless blocking for catastrophic patterns.

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

For a clone-based installation, pull the repository and rerun:

```bash
git pull
./install.sh
```

Remove individual resources from `~/.pi/agent/extensions/` or `~/.pi/agent/skills/`, then restart Pi. Keep a backup before removing resources shared with another setup.

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
