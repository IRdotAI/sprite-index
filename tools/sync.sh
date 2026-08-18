#!/usr/bin/env bash
# Publish a SpriteTrading export to the live site.
#
#   1. On spritetrading.com, run tools/grab2.js  (downloads spritetrading-export.json)
#   2. ./tools/sync.sh
#
# Picks up the newest spritetrading-export.json from ~/Downloads (or takes a
# path), publishes it as data/collection.json, and pushes. Every device that
# opens the site then shows the new state - no tapping anything.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-}"
if [ -z "$SRC" ]; then
  SRC=$(ls -t ~/Downloads/spritetrading-export*.json 2>/dev/null | head -1 || true)
fi
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "No export found."
  echo "Run tools/grab2.js on spritetrading.com first, or pass the file path:"
  echo "  ./tools/sync.sh ~/Downloads/spritetrading-export.json"
  exit 1
fi

# Validate before publishing - never push a truncated scrape over good data.
python3 - "$SRC" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
e = d.get("entries") or []
if not e:
    sys.exit("Export contains no entries - re-run the grab with the filter on 'All'.")
col = sum(1 for x in e if x.get("collected"))
mas = sum(1 for x in e if x.get("mastered"))
print(f"  {len(e)} entries | {col} collected | {mas} mastered | {col-mas} not mastered")
if len(e) < 50:
    sys.exit(f"Only {len(e)} entries - looks truncated. Scroll to the bottom and re-run.")

# The grab script compares itself against the page's own totals.
chk = d.get("check")
if chk and not chk.get("ok", True):
    print("\n  INCOMPLETE - the scrape disagrees with spritetrading's own counts:")
    for p in chk.get("problems", []):
        print("    * " + p)
    sys.exit("\nNot publishing. Scroll the collection to the very bottom, re-run "
             "tools/grab2.js, then try again.")
if chk is None:
    print("  (no completeness check in this file - from an older grab script)")
PY

mkdir -p data
cp "$SRC" data/collection.json
echo "Published data/collection.json (from $(basename "$SRC"))"

STAMP="$(date +%Y%m%d%H%M)"
sed -i "s/^const CACHE = 'sprite-index-[^']*'/const CACHE = 'sprite-index-v${STAMP}'/" sw.js

git add -A
git commit -qm "Sync collection ${STAMP}" || { echo "No change since last sync."; exit 0; }
git push -q origin HEAD
echo
echo "Synced. Open https://IRdotAI.github.io/sprite-index/ - it updates itself."
