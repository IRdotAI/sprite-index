#!/usr/bin/env bash
# One-time setup + deploy for the Sprite Index PWA -> GitHub Pages.
# Usage:  ./deploy.sh          (after the first run, this is all you need)
set -euo pipefail

REPO="sprite-index"
USER="IRdotAI"
cd "$(dirname "$0")"

# Bump the service-worker cache so phones actually pick up new sprite data.
STAMP="$(date +%Y%m%d%H%M)"
sed -i "s/^const CACHE = 'sprite-index-[^']*'/const CACHE = 'sprite-index-v${STAMP}'/" sw.js
echo "cache -> sprite-index-v${STAMP}"

git add -A
git commit -qm "Deploy ${STAMP}" || echo "(nothing new to commit)"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo
  echo "No 'origin' remote yet. Create the repo first, then re-run:"
  echo
  echo "  gh repo create ${USER}/${REPO} --public --source=. --remote=origin --push"
  echo
  echo "…or, if you don't have the gh CLI, make an empty repo named '${REPO}'"
  echo "at https://github.com/new and then run:"
  echo
  echo "  git remote add origin https://github.com/${USER}/${REPO}.git"
  echo "  git push -u origin main"
  echo
  echo "Then in the repo: Settings -> Pages -> Source: 'Deploy from a branch',"
  echo "branch 'main', folder '/ (root)'."
  echo
  echo "Your app will be live at: https://${USER}.github.io/${REPO}/"
  exit 0
fi

git push origin HEAD
echo
echo "Deployed -> https://${USER}.github.io/${REPO}/"
