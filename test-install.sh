#!/usr/bin/env bash
# Idempotency probe for install.sh: runs the installer twice against a temp
# HERMES_HOME and confirms the resulting destination tree is byte-identical.
#
# Exit codes:
#   0  both runs succeeded, trees match
#   1  install.sh failed on run #1 or #2
#   2  resulting trees differ (NOT idempotent)
#   3  internal setup error
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_SH="$REPO_ROOT/install.sh"

if [[ ! -x "$INSTALL_SH" ]]; then
  echo "FAIL: install.sh not executable at $INSTALL_SH" >&2
  exit 3
fi

# Per-run scratch dir, deleted on EXIT.
SCRATCH="$(mktemp -d -t agentsurgery-test-install.XXXXXX)"
trap 'rm -rf "$SCRATCH"' EXIT

# Two independent HERMES_HOME trees so we can diff them after both runs.
H1="$SCRATCH/home1"
H2="$SCRATCH/home2"
mkdir -p "$H1" "$H2"

echo "=== Run #1 (HERMES_HOME=$H1) ==="
HERMES_HOME="$H1" "$INSTALL_SH"
echo "=== Run #2 (HERMES_HOME=$H2) ==="
HERMES_HOME="$H2" "$INSTALL_SH"

# Compare the skills trees. We expect three installed skills under
# software-development/ and devops/ categories.
T1="$H1/skills"
T2="$H2/skills"

if [[ ! -d "$T1" ]]; then
  echo "FAIL: run #1 did not create $T1" >&2
  exit 1
fi
if [[ ! -d "$T2" ]]; then
  echo "FAIL: run #2 did not create $T2" >&2
  exit 1
fi

echo "=== diff -r tree1 vs tree2 ==="
if diff -r "$T1" "$T2" > "$SCRATCH/diff.out" 2>&1; then
  echo "PASS: both runs produced byte-identical skills trees"
  echo "      installed count: $(find "$T1" -mindepth 1 -maxdepth 2 -type d | wc -l) skill folders"
  exit 0
else
  echo "FAIL: trees differ (install.sh is NOT idempotent)" >&2
  cat "$SCRATCH/diff.out" >&2
  exit 2
fi
