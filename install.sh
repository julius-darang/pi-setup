#!/usr/bin/env bash
# Install this setup into the user's global Pi directory.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"

if ! command -v pi >/dev/null 2>&1; then
  printf '%s\n' 'Pi is not installed or is not on PATH.' >&2
  printf '%s\n' 'Install it first: npm install -g --ignore-scripts @earendil-works/pi-coding-agent' >&2
  exit 1
fi

mkdir -p "${PI_DIR}/extensions" "${PI_DIR}/skills"

# Copy source resources without local state or credentials.
cp -R "${ROOT_DIR}/extensions/." "${PI_DIR}/extensions/"
cp -R "${ROOT_DIR}/skills/." "${PI_DIR}/skills/"

# Install runtime dependencies for the extensions that declare them.
for extension_dir in "${PI_DIR}/extensions/bash-guard" "${PI_DIR}/extensions/filechanges" "${PI_DIR}/extensions/web-fetch"; do
  if [[ -f "${extension_dir}/package-lock.json" ]]; then
    (cd "${extension_dir}" && npm ci --omit=dev)
  fi
done

# pi-web-access is an external package used by the researcher subagent.
if ! pi list 2>/dev/null | grep -q 'npm:pi-web-access'; then
  pi install npm:pi-web-access
fi

# Provide a safe settings template without overwriting personal settings.
if [[ ! -f "${PI_DIR}/settings.example.json" ]]; then
  cp "${ROOT_DIR}/settings.example.json" "${PI_DIR}/settings.example.json"
fi

printf '\nInstalled Pi setup resources into: %s\n' "${PI_DIR}"
printf '%s\n' 'Next steps:'
printf '%s\n' '  1. Restart Pi or run /reload.'
printf '%s\n' '  2. Optional: copy skills/send-email/.env.example to the installed send-email skill and configure it locally.'
printf '%s\n' '  3. Optional: configure PI_SUBAGENT_MODEL_SCOUT, PI_SUBAGENT_MODEL_RESEARCHER, and PI_SUBAGENT_MODEL_WORKER.'
printf '%s\n' '  4. Inspect loaded resources in Pi startup output or with pi config.'
