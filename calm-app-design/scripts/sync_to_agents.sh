#!/usr/bin/env bash
# Copy this skill to the other coding agents on this Mac, so they all build apps the same way.
#   bash scripts/sync_to_agents.sh            # Codex + Antigravity (Cursor already reads ~/.claude/skills)
#   bash scripts/sync_to_agents.sh --cursor   # also a separate copy for Cursor
#   bash scripts/sync_to_agents.sh --dry-run  # show what would change
# Run it again after every change to the skill: copies don't update themselves.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$(basename "$SRC")"
DRY=""; CURSOR=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY="--dry-run" ;;
    --cursor) CURSOR=1 ;;
    *) echo "Unknown option: $a"; exit 2 ;;
  esac
done

targets=("$HOME/.codex/skills" "$HOME/.gemini/config/skills")
[ -d "$HOME/.gemini/antigravity" ] && [ ! -d "$HOME/.gemini/config" ] && targets+=("$HOME/.gemini/antigravity/skills") # older Antigravity IDE builds
[ "$CURSOR" = 1 ] && targets+=("$HOME/.cursor/skills")

for t in "${targets[@]}"; do
  [ -z "$DRY" ] && mkdir -p "$t"
  # --delete keeps the copy identical (removes files deleted from the master); evals and caches stay out.
  rsync -a --delete $DRY --exclude evals --exclude __pycache__ --exclude .DS_Store "$SRC/" "$t/$NAME/"
  echo "${DRY:+[dry run] }synced → $t/$NAME"
done
echo "Restart Codex / Antigravity / Cursor so they reload skills."
