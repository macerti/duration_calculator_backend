#!/usr/bin/env bash
# Deployment-artifact content check — Work Package G,
# REPOSITORY_ARCHITECTURE.md "G. Repository hygiene" bullet 5:
# "deployment package contains only intended files."
#
# The Makefile/CI "assemble deployment artifact" step already asserts a
# handful of required files are PRESENT (test -f ...). This script checks
# the other direction: that nothing UNEXPECTED is present — e.g. a real
# config.php, a stray .env, .git/node_modules, or OS/editor cruft that
# would end up published to the public duration_calculator artifact repo
# if the assembly step's file list ever changes carelessly.
#
# Usage: scripts/check-deploy-artifact.sh [dir]   (default: _deploy)

set -uo pipefail
DEPLOY_DIR="${1:-_deploy}"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "  FAIL: '$DEPLOY_DIR' does not exist — run 'make build-deploy' first"
  exit 1
fi

FAIL=0
pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

echo "== deployment artifact content check: $DEPLOY_DIR =="

# Allowed top-level entries. Update this list deliberately (in the same
# commit as any Makefile/CI assembly change) — that's the point of the
# check: an unreviewed drift here should fail loudly, not pass silently.
ALLOWED_TOP_LEVEL="_expo assets api data db engine tests .htaccess config.example.php favicon.ico index.html metadata.json seed.php"

UNEXPECTED=""
for entry in "$DEPLOY_DIR"/* "$DEPLOY_DIR"/.[!.]*; do
  [ -e "$entry" ] || continue
  name="$(basename "$entry")"
  found=0
  for allowed in $ALLOWED_TOP_LEVEL; do
    [ "$name" = "$allowed" ] && found=1 && break
  done
  if [ "$found" -eq 0 ]; then
    UNEXPECTED="$UNEXPECTED $name"
  fi
done

if [ -n "$UNEXPECTED" ]; then
  fail "unexpected top-level entries in $DEPLOY_DIR:$UNEXPECTED — update ALLOWED_TOP_LEVEL in this script deliberately if this is intentional"
else
  pass "top-level contents match the expected allowlist"
fi

# Forbidden anywhere in the tree, regardless of the allowlist above.
FORBIDDEN_HITS=$(find "$DEPLOY_DIR" \( \
  -name "config.php" -o -name ".env" -o -name ".git" -o -iname ".ds_store" \
  -o -name "*.log" \
  \) 2>/dev/null)

if [ -n "$FORBIDDEN_HITS" ]; then
  fail "forbidden files/dirs found in artifact:$(echo "$FORBIDDEN_HITS" | sed 's/^/ /')"
else
  pass "no forbidden files (config.php, .env, .git, logs, OS cruft) in artifact"
fi

# A vendored node_modules dependency tree (as opposed to a static asset that
# merely happens to live at a path Expo mirrors under assets/, e.g.
# assets/node_modules/@expo/vector-icons/.../SomeFont.ttf, which is normal
# and expected) would contain its own package.json manifests. Check for
# that specifically rather than banning any path segment literally named
# "node_modules", which produced a false positive here on the very first run.
VENDORED_NM=$(find "$DEPLOY_DIR" -type d -name node_modules -exec sh -c \
  'find "$1" -maxdepth 6 -name package.json | head -1' _ {} \; 2>/dev/null)

if [ -n "$VENDORED_NM" ]; then
  fail "a node_modules dir under $DEPLOY_DIR contains package.json manifest(s) — looks like a real vendored dependency tree, not just mirrored asset paths"
else
  pass "no vendored node_modules dependency tree in artifact (asset-path mirroring under node_modules/, if any, contains no package manifests)"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "Deployment artifact hygiene: ALL CHECKS PASSED"
else
  echo "Deployment artifact hygiene: FAILED — see FAIL lines above"
fi
exit $FAIL
