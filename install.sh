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

for command_name in git npm tar; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'Required command is not installed or is not on PATH: %s\n' "${command_name}" >&2
    exit 1
  fi
done

if ! git -C "${ROOT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '%s\n' 'The installer must be run from a Git checkout so it can install tracked files only.' >&2
  exit 1
fi

if ! git -C "${ROOT_DIR}" diff --quiet HEAD --; then
  printf '%s\n' 'Warning: installing the checked-out HEAD; tracked uncommitted changes will not be installed.' >&2
fi

RESOURCE_STAGE="$(mktemp -d "${TMPDIR:-/tmp}/pi-setup-install.XXXXXX")"
cleanup() {
  rm -rf "${RESOURCE_STAGE}"
}
trap cleanup EXIT

# Archive only the checked-out, tracked resources. This deliberately excludes
# ignored files such as .env, recipient lists, node_modules, and local caches.
git -C "${ROOT_DIR}" archive --format=tar HEAD -- extensions skills settings.example.json \
  | tar -xf - -C "${RESOURCE_STAGE}"

mkdir -p "${PI_DIR}/extensions" "${PI_DIR}/skills"
cp -R "${RESOURCE_STAGE}/extensions/." "${PI_DIR}/extensions/"
cp -R "${RESOURCE_STAGE}/skills/." "${PI_DIR}/skills/"

# Install runtime dependencies for the extensions that declare them. Lifecycle
# scripts are disabled because these packages are being installed automatically.
for extension_dir in "${PI_DIR}/extensions/bash-guard" "${PI_DIR}/extensions/filechanges" "${PI_DIR}/extensions/web-fetch"; do
  if [[ -f "${extension_dir}/package-lock.json" ]]; then
    (cd "${extension_dir}" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
  fi
done

# pi-web-access is an external package used by the researcher subagent. Pass
# npm's standard environment setting through Pi's package manager as well.
if ! pi list 2>/dev/null | grep -q 'npm:pi-web-access'; then
  npm_config_ignore_scripts=true pi install npm:pi-web-access
fi

# Provide a safe settings template without overwriting personal settings.
if [[ ! -f "${PI_DIR}/settings.example.json" ]]; then
  cp "${RESOURCE_STAGE}/settings.example.json" "${PI_DIR}/settings.example.json"
fi

printf '\nInstalled Pi setup resources into: %s\n' "${PI_DIR}"
printf '%s\n' 'Next steps:'
printf '%s\n' '  1. Restart Pi or run /reload.'
printf '%s\n' '  2. Optional: copy skills/send-email/.env.example to the installed send-email skill and configure it locally.'
printf '%s\n' '  3. Optional: configure PI_SUBAGENT_MODEL_SCOUT, PI_SUBAGENT_MODEL_RESEARCHER, and PI_SUBAGENT_MODEL_WORKER.'
printf '%s\n' '  4. Inspect loaded resources in Pi startup output or with pi config.'
