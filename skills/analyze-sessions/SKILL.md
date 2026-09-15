---
name: analyze-sessions
description: Analyze Pi session history for cost, errors, project/model usage, prompt patterns, transcript search, and focused session review. Use when the user asks what happened in previous Pi sessions or wants to improve their workflow.
---

# Analyze Pi sessions

This skill provides read-only Python scripts for the JSONL sessions stored in
Pi's agent directory. The scripts honor `PI_CODING_AGENT_DIR`; without it they
use `~/.pi/agent`.

The scripts live beside this file under `scripts/`. Resolve that directory
from this skill's package path and invoke scripts with Python 3. Do not assume
the current working directory. In this workspace, the checkout path is:

```bash
python3 ~/polymath/infra/pi-setup/skills/analyze-sessions/scripts/cost.py
```

## Privacy

Session logs can contain source code, prompts, tool output, credentials, and
personal data. Reports that print prompt or transcript text redact common
credential-shaped values by default. Use `--include-sensitive` only for local
inspection, never paste that output into a remote service, and prefer narrow
filters and small output limits.

The scripts never modify sessions. They only read and summarize them.

## Cost rollups

`cost.py` includes subagent sessions by default so totals represent actual
spend. It defaults to the last seven days when no time filter is supplied:

```bash
python3 "$SKILL_DIR/scripts/cost.py"
python3 "$SKILL_DIR/scripts/cost.py" --since 30d --by project --limit 10
python3 "$SKILL_DIR/scripts/cost.py" --since 30d --by model
python3 "$SKILL_DIR/scripts/cost.py" --since 30d --by session --limit 10
python3 "$SKILL_DIR/scripts/cost.py" --since 30d --by total
python3 "$SKILL_DIR/scripts/cost.py" --since 30d --json
```

Groupings are `total`, `day`, `project`, `model`, and `session`. Use
`--show-subagents` to show the subagent share or `--no-subagents` to exclude
subagent transcripts.

## Prompt mining

`prompts.py` prints user prompts grouped by project. Long prompts are skipped
by default because they are often pasted context rather than reusable
instructions:

```bash
python3 "$SKILL_DIR/scripts/prompts.py" --since 30d
python3 "$SKILL_DIR/scripts/prompts.py" --since 7d --max-chars 1500 --format jsonl
python3 "$SKILL_DIR/scripts/prompts.py" --cwd /path/to/project --since 30d
python3 "$SKILL_DIR/scripts/prompts.py" --grep "rate limit" --since 60d
```

Use the output to identify corrections or constraints that recur across
projects and belong in a skill, prompt snippet, or project `AGENTS.md`.

## Search and inspect

Search user prompts, assistant text, and thinking (both by default):

```bash
python3 "$SKILL_DIR/scripts/search.py" "supabase RLS"
python3 "$SKILL_DIR/scripts/search.py" --regex "TODO\\(.+\\)"
python3 "$SKILL_DIR/scripts/search.py" "global instruction" --in user --since 60d
python3 "$SKILL_DIR/scripts/search.py" "rate limit" --context 2 --since 30d
```

Inspect the newest matching session or select one by ID prefix:

```bash
python3 "$SKILL_DIR/scripts/show_session.py" --latest --max-thinking -1
python3 "$SKILL_DIR/scripts/show_session.py" --session 019e475b
python3 "$SKILL_DIR/scripts/show_session.py" --cwd /path/to/project --latest
python3 "$SKILL_DIR/scripts/show_session.py" --latest --max-tool-output 1000
python3 "$SKILL_DIR/scripts/show_session.py" --session 019e475b --include-subagents-content
```

`show_session.py` truncates large tool and assistant outputs by default and
omits thinking when `--max-thinking -1` is supplied. It also supports the
shared filters below.

## Shared filters

All four reporting scripts accept:

- `--since WHEN` / `--until WHEN`: `YYYY-MM-DD`, ISO datetime, or relative `7d`, `2w`, `3h`, `30m`
- `--cwd SUBSTR`: match session working directory; repeatable
- `--model SUBSTR`: match model ID; repeatable
- `--provider anthropic|openai|google`
- `--session ID`: exact ID or prefix
- `--include-subagents` / `--no-subagents`
- `--limit N`
- `--min-cost USD`
- `--min-messages N`
- `--errors-only`
- `--grep SUBSTR`: case-insensitive match on user prompts

`prompts.py`, `search.py`, and `show_session.py` also accept
`--include-sensitive` to disable output redaction for local use only.

## Subagent defaults

- `cost.py`: subagents included by default
- `prompts.py`, `search.py`, and `show_session.py`: subagents excluded by default
- `show_session.py --include-subagents-content`: append nested subagent transcripts

Use the retention script in the Pi setup package for deletion decisions; these
analysis scripts do not delete anything.
