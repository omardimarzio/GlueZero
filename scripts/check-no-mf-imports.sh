#!/bin/bash
# scripts/check-no-mf-imports.sh
# P-01 mitigation: vieta diff in packages/core/src/ fuori da F8 milestone branch.
#
# F8 (`gsd/v2.0.0-microfrontend-governance` branch): diff ammesso (MIN-1/MIN-2).
# F9-F17: vieta qualunque diff salvo `packages/devtools/src/` in F16 (eccezione documentata).
#
# Usage:
#   bash scripts/check-no-mf-imports.sh
#   Exit 0 = OK (no forbidden diff o su milestone branch)
#   Exit 1 = FORBIDDEN diff detected outside F8 scope

set -euo pipefail

# Branch corrente (CI usa GITHUB_REF, locale usa git symbolic-ref)
CURRENT_BRANCH="${GITHUB_REF:-$(git symbolic-ref --short HEAD 2>/dev/null || echo 'detached')}"
CURRENT_BRANCH="${CURRENT_BRANCH#refs/heads/}"

# Milestone branch v2.0 ammette diff (F8 MIN-1/MIN-2)
if [ "$CURRENT_BRANCH" = "gsd/v2.0.0-microfrontend-governance" ] || \
   [[ "$CURRENT_BRANCH" == gsd/phase-8-* ]]; then
  echo "OK Milestone/phase F8 branch ($CURRENT_BRANCH) - diff in packages/core/src/ allowed (MIN-1/MIN-2)"
  exit 0
fi

# Calcola diff vs main (fallback se main non disponibile)
BASE_REF="${BASE_REF:-main}"
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "WARN Base ref '$BASE_REF' not found - skipping check (assumed local working tree)"
  exit 0
fi

DIFF=$(git diff --name-only "$BASE_REF"...HEAD packages/core/src/ 2>/dev/null || echo "")

if [ -n "$DIFF" ]; then
  echo "FAIL FORBIDDEN diff in packages/core/src/ outside F8 scope (branch=$CURRENT_BRANCH):"
  echo "$DIFF"
  echo ""
  echo "  D-83 strict carryover esteso v2.0: solo F8 puo modificare packages/core/src/."
  echo "  Se questa e F8, lavora su 'gsd/v2.0.0-microfrontend-governance' o 'gsd/phase-8-*' branch."
  exit 1
fi

echo "OK No core diff outside F8 scope (branch=$CURRENT_BRANCH)"
