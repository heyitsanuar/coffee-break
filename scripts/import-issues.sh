#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 1 ]]; then echo 'Usage: scripts/import-issues.sh OWNER/REPO [--epic EP-03] [--apply]' >&2; exit 2; fi
REPO="$1"; shift
APPLY=""; EPIC=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      if [[ -n "$APPLY" ]]; then echo 'Duplicate --apply option' >&2; exit 2; fi
      APPLY="--apply"; shift ;;
    --epic)
      if [[ $# -lt 2 || "$2" != 'EP-03' || -n "$EPIC" ]]; then echo 'Only --epic EP-03 is supported' >&2; exit 2; fi
      EPIC="EP-03"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
command -v gh >/dev/null || { echo 'Install GitHub CLI (gh)' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js required' >&2; exit 1; }
if [[ "$APPLY" == '--apply' || "$EPIC" == 'EP-03' ]]; then gh auth status >/dev/null; gh repo view "$REPO" >/dev/null; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CB_REPO="$REPO" CB_APPLY="$APPLY" CB_ROOT="$ROOT"
if [[ "$EPIC" == 'EP-03' ]]; then
  node "$ROOT/scripts/import-ep-03.mjs"
else
  node "$ROOT/scripts/import-issues.mjs"
fi
