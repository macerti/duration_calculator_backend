#!/usr/bin/env bash
# Repository hygiene checks — Work Package G, REPOSITORY_ARCHITECTURE.md
# section "G. Repository hygiene". Deliberately lightweight (git/grep/find
# only, no new dependency) per that section's own "do not add heavyweight
# tooling merely to satisfy a generic best-practice checklist" rule.
#
# Run from anywhere: scripts/check-repo-hygiene.sh
# Exits 0 if every check passes, non-zero (with a summary of which failed)
# otherwise. Safe to run repeatedly; makes no changes to the working tree.
#
# Scope note on check 4 (stale path references): this intentionally only
# scans non-Markdown tracked files (code/config/build tooling). Markdown
# docs are excluded because several of them (root README.md, SECURITY.md)
# correctly explain OLD path names as history ("audit-app/ no longer
# exists..."), which a plain grep cannot distinguish from a doc that wrongly
# still treats an old name as current — and misclassifying the former as a
# hygiene failure would just teach people to ignore this check. Two other
# already-known, separately-tracked situations are deliberately not
# re-reported here: src/backend/data/parameters.php's "Mirrors
# audit-engine/..." comment (verified historical-lineage only, not a live
# import/require — see docs/DEV_STATUS.md's sixth-session entry), and
# src/frontend/BUGLOG.md + src/frontend/ROADMAP.md, which carry their own
# already-flagged numbering/staleness problem (same entry) that is a
# distinct piece of work, not something this check should duplicate.

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

echo "== 1. config.example.php presence =="
if [ -f src/backend/config.example.php ]; then
  pass "src/backend/config.example.php exists"
else
  fail "src/backend/config.example.php is missing — real config.php has nothing to be copied from"
fi

echo "== 2. no real credentials/secrets in tracked files =="
if git ls-files | grep -qx "src/backend/config.php"; then
  fail "src/backend/config.php is tracked by git — this file holds real DB credentials and must stay gitignored"
else
  pass "config.php is not tracked"
fi

SECRET_HITS=$(git ls-files -z | xargs -0 grep -lIE \
  'github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  2>/dev/null || true)
if [ -n "$SECRET_HITS" ]; then
  fail "possible secret material committed in:$(echo "$SECRET_HITS" | sed 's/^/ /')"
else
  pass "no known secret-token patterns found in tracked files"
fi

echo "== 3. README presence for top-level source modules =="
for d in src/backend src/frontend; do
  if [ -f "$d/README.md" ]; then
    pass "$d/README.md exists"
  else
    fail "$d/README.md is missing — a new developer landing in $d has no entry point"
  fi
done

echo "== 4. stale references to deleted pre-restructure paths (code/config only, see header) =="
STALE_PATTERN='audit-app|audit-mobile|duration-calculator-php|audit-engine'
# src/backend/data/parameters.php: verified historical-lineage comment, not a
# live import (see header). This script itself and check-deploy-artifact.sh
# are exempted too — they necessarily name these old paths in comments/docs
# to describe what they check for, which is the same "explaining history,
# not treating it as current" situation the header describes for Markdown.
KNOWN_EXCEPTIONS="src/backend/data/parameters.php scripts/check-repo-hygiene.sh scripts/check-deploy-artifact.sh"

STALE_HITS=""
while IFS= read -r f; do
  [[ "$f" == *.md ]] && continue
  skip=0
  for ex in $KNOWN_EXCEPTIONS; do
    [[ "$f" == "$ex" ]] && skip=1 && break
  done
  [ "$skip" -eq 1 ] && continue
  if grep -lIE "$STALE_PATTERN" "$f" >/dev/null 2>&1; then
    STALE_HITS="$STALE_HITS $f"
  fi
done < <(git ls-files)

if [ -n "$STALE_HITS" ]; then
  fail "stale pre-restructure references found in:$STALE_HITS"
else
  pass "no stale pre-restructure path references in tracked code/config"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "Repository hygiene: ALL CHECKS PASSED"
else
  echo "Repository hygiene: FAILED — see FAIL lines above"
fi
exit $FAIL
