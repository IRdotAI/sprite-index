#!/usr/bin/env bash
# Commit and push whatever is currently in data/collection.json.
# The cloud sync commits for itself; this is for publishing a hand-made
# collection.json (e.g. after tools/sync.sh imports a manual grab2.js export).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f data/collection.json ] || { echo "No data/collection.json to publish."; exit 1; }

STAMP="$(date +%Y%m%d%H%M)"
sed -i "s/^const CACHE = 'sprite-index-[^']*'/const CACHE = 'sprite-index-v${STAMP}'/" sw.js

git add -A
if git diff --cached --quiet; then
  echo "Nothing changed."
  exit 0
fi
git commit -qm "Sync collection ${STAMP}"
git push -q origin HEAD
echo "Published -> https://IRdotAI.github.io/sprite-index/"
