#!/usr/bin/env bash
# AgentSurgery_Skills installer
# Copies each surgical skill folder into the local Hermes skills tree.
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
SKILLS_DIR="$HERMES_HOME/skills"

# skill folder -> target category
declare -A CATEGORY=(
  ["surgical-HermesDotHealth"]="devops"
  ["surgical-implementation"]="software-development"
  ["surgical-orchestration"]="software-development"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Optional single-skill arg
ONLY="${1:-}"

mkdir -p "$SKILLS_DIR"

for skill in "${!CATEGORY[@]}"; do
  if [[ -n "$ONLY" && "$ONLY" != "$skill" ]]; then
    continue
  fi
  src="$SCRIPT_DIR/$skill"
  if [[ ! -d "$src" ]]; then
    echo "SKIP: $skill not found in package" >&2
    continue
  fi
  dst="$SKILLS_DIR/${CATEGORY[$skill]}/$skill"
  mkdir -p "$(dirname "$dst")"
  rm -rf "$dst"
  cp -R "$src" "$dst"
  echo "INSTALLED: $dst"
done

echo "Done. Restart Hermes or run 'hermes skills list' to see them."
