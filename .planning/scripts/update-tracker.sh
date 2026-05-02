#!/usr/bin/env bash
# update-tracker.sh — auto-update .planning/TRACKER.md dopo step GSD significativi
#
# Trigger: PostToolUse hook su Bash (in .claude/settings.json) — passa i tool input via stdin JSON
# Strategy: il hook chiama questo script SEMPRE; lo script decide se aggiornare basato sull'ultimo commit
#
# Update conditions:
# - Ultimo commit modifica .planning/phases/<phase>/*-SUMMARY.md → aggiorna progress + last_updated + last completed plan
# - Ultimo commit modifica .planning/STATE.md → re-sync stato corrente
# - Ultimo commit modifica .planning/phases/<phase>/*-CONTEXT.md → segnala nuova decisione
#
# Idempotente: se TRACKER.md non esiste o lo stato non è cambiato, no-op.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo '.')" || exit 0

TRACKER=".planning/TRACKER.md"
STATE=".planning/STATE.md"

[[ -f "$TRACKER" ]] || exit 0
[[ -f "$STATE" ]] || exit 0

# Leggi ultimo commit; se non è un commit GSD-relevante, exit silenzioso
LAST_COMMIT=$(git log -1 --format="%h %s" 2>/dev/null) || exit 0
LAST_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null) || exit 0

# Trigger conditions: TRACKER.md update SOLO se l'ultimo commit ha toccato uno di questi pattern
TRIGGER=false
echo "$LAST_FILES" | grep -qE '\.planning/phases/.+-SUMMARY\.md$' && TRIGGER=true || true
echo "$LAST_FILES" | grep -qE '\.planning/STATE\.md$' && TRIGGER=true || true
echo "$LAST_FILES" | grep -qE '\.planning/phases/.+-CONTEXT\.md$' && TRIGGER=true || true
echo "$LAST_FILES" | grep -qE '\.planning/ROADMAP\.md$' && TRIGGER=true || true

[[ "$TRIGGER" == "true" ]] || exit 0

# Estrai stato corrente da STATE.md (frontmatter YAML)
CURRENT_PLAN=$(awk '/^current_plan:/ {gsub(/^current_plan: */,""); print; exit}' "$STATE" 2>/dev/null || echo "?")
COMPLETED_PHASES=$(awk '/^  completed_phases:/ {gsub(/^  completed_phases: */,""); print; exit}' "$STATE" 2>/dev/null || echo "?")
COMPLETED_PLANS=$(awk '/^  completed_plans:/ {gsub(/^  completed_plans: */,""); print; exit}' "$STATE" 2>/dev/null || echo "?")
TOTAL_PLANS=$(awk '/^  total_plans:/ {gsub(/^  total_plans: */,""); print; exit}' "$STATE" 2>/dev/null || echo "?")
PERCENT=$(awk '/^  percent:/ {gsub(/^  percent: */,""); print; exit}' "$STATE" 2>/dev/null || echo "?")

# Conta SUMMARY.md per la fase corrente (se identificabile)
CURRENT_PHASE_DIR=$(ls -d .planning/phases/*/ 2>/dev/null | sort | tail -1 | sed 's:/$::')
PHASE_SUMMARIES=0
PHASE_PLANS=0
if [[ -n "$CURRENT_PHASE_DIR" ]]; then
  PHASE_SUMMARIES=$(ls "$CURRENT_PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')
  PHASE_PLANS=$(ls "$CURRENT_PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
fi

# Last completed plan: ultimo SUMMARY.md per mtime
LAST_SUMMARY=$(ls -t .planning/phases/*/*-SUMMARY.md 2>/dev/null | head -1)
LAST_SUMMARY_NAME=$(basename "$LAST_SUMMARY" 2>/dev/null | sed 's/-SUMMARY\.md$//')

# Timestamp ISO 8601 (UTC)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TODAY=$(date -u +"%Y-%m-%d")

# Update TRACKER.md frontmatter — usa Python per robustezza YAML (sed YAML è fragile)
python3 - "$TRACKER" "$NOW" "$TODAY" "$LAST_COMMIT" "$LAST_SUMMARY_NAME" "$PHASE_SUMMARIES" "$PHASE_PLANS" "$COMPLETED_PLANS" "$TOTAL_PLANS" "$PERCENT" <<'PYEOF'
import sys, re, pathlib

(tracker_path, now, today, last_commit, last_summary, phase_summaries,
 phase_plans, completed_plans, total_plans, percent) = sys.argv[1:]

p = pathlib.Path(tracker_path)
text = p.read_text()

# Update frontmatter last_updated
text = re.sub(r'^last_updated:\s*.*$', f'last_updated: {today}', text, count=1, flags=re.MULTILINE)

# Update "Ultimo step completato" section if last_summary changed
if last_summary:
    new_marker = (
        f"## Ultimo step completato (auto-update {now})\n\n"
        f"- Plan: **{last_summary}** → SUMMARY.md committed\n"
        f"- Commit: `{last_commit}`\n"
        f"- Phase progress: **{phase_summaries}/{phase_plans}** plan completati con SUMMARY.md\n"
        f"- Project progress: {completed_plans}/{total_plans} plan ({percent}%)\n"
    )
    # Replace the existing "## Ultimo step completato" block (until next ##)
    pattern = r'## Ultimo step completato.*?(?=\n## )'
    if re.search(pattern, text, re.DOTALL):
        text = re.sub(pattern, new_marker + '\n', text, count=1, flags=re.DOTALL)
    # If the section pattern doesn't match (no trailing ## section), best-effort prepend after frontmatter

p.write_text(text)
print(f"[update-tracker] TRACKER.md aggiornato — {last_summary} → {phase_summaries}/{phase_plans} ({completed_plans}/{total_plans}) {today}")
PYEOF
