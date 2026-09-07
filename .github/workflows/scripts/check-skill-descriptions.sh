#!/usr/bin/env bash
# Hermes skill_manage convention validator for AgentSurgery_Skills.
# Validates that each skill SKILL.md description is substantive (>=50 chars,
# <=20000 chars, no placeholder tokens). The "Use when ..." trigger prefix is
# encouraged but not required for backwards compatibility with skills authored
# before the convention existed.
set -euo pipefail

skills=(surgical-HermesDotHealth surgical-implementation surgical-orchestration)

for skill in "${skills[@]}"; do
  file="$skill/SKILL.md"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: $file missing"
    exit 1
  fi

  # Extract the full description body. Supports both:
  #   description: "literal text"
  #   description: >-
  #     folded multi-line text
  desc=$(awk '
    /^description:[[:space:]]*"/ {
      flag=1
      sub(/^description:[[:space:]]*"/, "")
      sub(/"[[:space:]]*$/, "")
      print
      next
    }
    /^description:[[:space:]]*>/ {
      flag=1
      next
    }
    /^description:[[:space:]]*[A-Za-z]/ {
      flag=1
      sub(/^description:[[:space:]]*/, "")
      print
      next
    }
    flag && /^[[:space:]]+[^[:space:]]/ {
      sub(/^[[:space:]]+/, "")
      print
      next
    }
    flag && /^[^[:space:]]/ {
      exit
    }
  ' "$file" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')

  if [[ -z "$desc" ]]; then
    echo "ERROR: $file could not parse description body"
    exit 1
  fi

  len=${#desc}
  if (( len < 50 )); then
    echo "ERROR: $file description too short ($len chars; min 50)"
    echo "       first 200 chars: ${desc:0:200}"
    exit 1
  fi
  if (( len > 20000 )); then
    echo "ERROR: $file description too long ($len chars; max 20000)"
    exit 1
  fi
  if [[ "$desc" == *"<describe>"* || "$desc" == *"TODO"* || "$desc" == *"FIXME"* ]]; then
    echo "ERROR: $file description contains placeholder token"
    exit 1
  fi

  if [[ "$desc" == "Use when"* ]]; then
    echo "VALID: $file description starts with trigger (${len} chars)"
  else
    echo "WARN: $file description missing trigger prefix (allowed; ${len} chars)"
  fi
done

echo "All ${#skills[@]} skill descriptions pass substantive-content gate."
