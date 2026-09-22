#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 1 ]]; then echo 'Usage: scripts/import-issues.sh OWNER/REPO [--apply]' >&2; exit 2; fi
REPO="$1"; APPLY="${2:-}"
if [[ -n "$APPLY" && "$APPLY" != '--apply' ]]; then echo 'Second argument must be --apply' >&2; exit 2; fi
command -v gh >/dev/null || { echo 'Install GitHub CLI (gh)' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js required' >&2; exit 1; }
if [[ "$APPLY" == '--apply' ]]; then gh auth status >/dev/null; gh repo view "$REPO" >/dev/null; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CB_REPO="$REPO" CB_APPLY="$APPLY" CB_ROOT="$ROOT"
node "$ROOT/scripts/import-issues.mjs"
