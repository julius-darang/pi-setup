#!/usr/bin/env bash
# Register this setup as a local Pi package.
#
# The old installer copied resources into ~/.pi/agent, which allowed the
# installed files and this repository to drift. Pi package installation keeps
# the repository as the single source of truth and manages its dependencies.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
WEB_ACCESS_VERSION="${PI_WEB_ACCESS_VERSION:-0.27.0}"

if ! command -v pi >/dev/null 2>&1; then
  printf '%s\n' 'Pi is not installed or is not on PATH.' >&2
  printf '%s\n' 'Install it first: npm install -g --ignore-scripts @earendil-works/pi-coding-agent' >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'npm is required to install this package and its runtime dependencies.' >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/package.json" ]]; then
  printf 'Not a Pi package: %s\n' "${ROOT_DIR}" >&2
  exit 1
fi

mkdir -p "${PI_DIR}"

# A local package is loaded from this checkout, so install its locked
# dependencies (including the repository's validation tools) before registering
# it. Do not run dependency lifecycle scripts from an installer.
(cd "${ROOT_DIR}" && npm ci --ignore-scripts --no-audit --no-fund)
(cd "${ROOT_DIR}" && npm run validate)

# Use Pi's package manager rather than copying individual resources. The
# environment override keeps custom agent directories working as well. Keep
# npm lifecycle scripts disabled for the package-manager installs too.
PI_CODING_AGENT_DIR="${PI_DIR}" npm_config_ignore_scripts=true pi install "${ROOT_DIR}"
PI_CODING_AGENT_DIR="${PI_DIR}" npm_config_ignore_scripts=true pi install "npm:pi-web-access@${WEB_ACCESS_VERSION}"

# Provide a settings template without overwriting personal settings.
if [[ ! -f "${PI_DIR}/settings.example.json" ]]; then
  cp "${ROOT_DIR}/settings.example.json" "${PI_DIR}/settings.example.json"
fi

printf '\nRegistered Pi setup package from: %s\n' "${ROOT_DIR}"
printf 'Pi directory: %s\n' "${PI_DIR}"
printf '%s\n' 'Existing manually copied extensions/skills were not removed.'
printf '%s\n' 'Review `npm run migration:report`, then run its --apply form to move duplicates into a backup before restarting Pi.'
printf '%s\n' 'Restart Pi or run /reload. Use npm test in this repository before publishing a release.'
