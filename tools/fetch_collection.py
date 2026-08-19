#!/usr/bin/env python3
"""
Fetch the collection straight from spritetrading.com - no browser involved.

The profile page is server-rendered, and every card carries its true state in
data-* attributes (data-owned / data-mastered / data-level / data-tier), so a
single authenticated GET plus a parse gives the same result the headless-Chrome
scrape used to produce - and gets it right by construction rather than by
reading CSS-toggled labels.

  ST_SESSION=<cookie> python3 tools/fetch_collection.py [--out data/collection.json]

Exits non-zero without writing anything if the session is dead or the page
disagrees with itself, so a bad run can never overwrite good data.
"""
import argparse, html, json, os, re, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone

URL = "https://spritetrading.com/profile"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/149.0.0.0 Safari/537.36")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# spritetrading's own tier ids -> the variant names the app uses.
TIERS = {"base": "Normal", "gold": "Gold", "gummy": "Gummy", "galaxy": "Galaxy",
         "gem": "Gem", "holofoil": "Holofoil", "cube": "Cube", "quack": "Quack"}

# spritetrading uses internal codenames for licensed characters.
ALIAS = {"Grim": "Grim Reaper", "Coke Parmesan": "Vini Jr.",
         "Pedicure Antacid": "Ironmouse", "Company Stargazer": "Pollo",
         "Filler Grunt": "John Wick", "Fossil Meal": "Batman"}


def fetch(session, tries=3):
    req = urllib.request.Request(URL, headers={
        "Cookie": f"st_session={session}",
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    last = None
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                sys.exit(f"Session rejected (HTTP {e.code}). The st_session cookie "
                         "has expired - refresh it with tools/session_from_chrome.py.")
            last = e
        except Exception as e:
            last = e
        if attempt < tries:
            print(f"  network hiccup ({last}) - retrying {attempt}/{tries - 1}…")
            time.sleep(2 * attempt)
    sys.exit(f"Could not reach spritetrading.com after {tries} tries: {last}")


def text_of(fragment):
    return html.unescape(re.sub(r"<[^>]+>", " ", fragment)).strip()


def parse(page):
    if "holder-li" not in page:
        if re.search(r"Sign in to Sprite Trading", page, re.I):
            sys.exit("spritetrading.com returned the sign-in page - the session "
                     "cookie is no longer valid. Refresh it with "
                     "tools/session_from_chrome.py.")
        sys.exit("No sprite cards in the response - the page layout may have changed.")

    # Split on the card boundary so each chunk holds exactly one card.
    chunks = re.split(r'(?=<li class="holder-li")', page)
    entries = []
    for chunk in chunks:
        if not chunk.startswith('<li class="holder-li"') or "data-card" not in chunk[:400]:
            continue
        tag = chunk[:chunk.index(">") + 1]
        a = dict(re.findall(r'(data-[\w-]+)="([^"]*)"', tag))

        variant = TIERS.get(a.get("data-tier", ""), (a.get("data-tier") or "Normal").title())

        m = re.search(r'<span class="cname"[^>]*>(.*?)</span>', chunk, re.S)
        label = text_of(m.group(1)) if m else ""
        # The label carries the variant as a prefix ("Gold Water"), except where
        # spritetrading omits it (Cube Zero Point renders as plain "Zero Point").
        # data-tier is authoritative either way; strip the prefix if it's there.
        sprite = label
        if variant != "Normal" and label.lower().startswith(variant.lower() + " "):
            sprite = label[len(variant):].strip()
        sprite = ALIAS.get(sprite, sprite)

        m = re.search(r'<span class="sprite-pill[^"]*"[^>]*>(.*?)</span>', chunk, re.S)
        rarity = text_of(m.group(1)) if m else (a.get("data-rarity") or "").title() or None

        img = None
        for msrc in re.finditer(r'<img[^>]+src="([^"]+)"', chunk):
            src = html.unescape(msrc.group(1))
            if "/sprites/" in src:
                img = src.split("&v=")[0]
                break

        mastered = a.get("data-mastered") == "true"
        collected = a.get("data-owned") == "true"
        try:
            level = int(a.get("data-level") or 0) or None
        except ValueError:
            level = None
        if mastered:
            level = 5

        def num(attr):
            try:
                return int(a.get(attr) or 0) or None
            except ValueError:
                return None

        entries.append({
            "sprite": sprite, "variant": variant, "label": label,
            "collected": collected, "mastered": mastered, "level": level,
            "rarity": rarity, "img": img,
            "slug": a.get("data-slug"),
            # Extras spritetrading already publishes on the card - the app's
            # info panel shows these.
            "cost": num("data-cost"),          # sprite dust to summon
            "dex": num("data-dex"),            # index number
            "acquired": num("data-acquired"),  # epoch ms, when you got it
        })

    # De-duplicate defensively, the way the browser scraper did.
    by_key = {}
    for e in entries:
        by_key[e["sprite"] + "|" + e["variant"]] = e
    return list(by_key.values())


def verify(page, entries):
    """Cross-check against the page's own headline totals."""
    check = {"ok": True, "problems": []}

    # The headline reads "<n> / <total> Sprites indexed". Several other dials on
    # the page use the same markup, so look only at the run of HTML immediately
    # before that label rather than matching across the whole document.
    label = page.find("Sprites indexed")
    window = page[max(0, label - 800):label] if label != -1 else ""
    m = None
    for m in re.finditer(r'data-to="(\d+)".*?class="suffix"[^>]*>\s*/\s*(\d+)\s*<',
                         window, re.S):
        pass  # keep the last match: the one nearest the label
    if m:
        owned_says, total_says = int(m.group(1)), int(m.group(2))
        check["expectedEntries"] = total_says
        if len(entries) != total_says:
            check["ok"] = False
            check["problems"].append(
                f"page says {total_says} sprites, parsed {len(entries)}")
        got_owned = sum(1 for e in entries if e["collected"])
        if got_owned != owned_says:
            check["ok"] = False
            check["problems"].append(
                f"page says {owned_says} collected, parsed {got_owned}")
    return check


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "collection.json"))
    args = ap.parse_args()

    session = os.environ.get("ST_SESSION", "").strip()
    if not session:
        sys.exit("ST_SESSION is not set. Locally: "
                 "ST_SESSION=$(python3 tools/session_from_chrome.py) "
                 "python3 tools/fetch_collection.py")

    page = fetch(session)
    entries = parse(page)
    check = verify(page, entries)

    collected = sum(1 for e in entries if e["collected"])
    mastered = sum(1 for e in entries if e["mastered"])
    payload = {
        "source": "spritetrading.com",
        "exportedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds")
                              .replace("+00:00", "Z"),
        "totals": {
            "entries": len(entries),
            "collected": collected,
            "mastered": mastered,
            "notMastered": collected - mastered,
        },
        "entries": entries,
        "check": check,
    }

    print(f"  {len(entries)} entries | {collected} collected | {mastered} mastered "
          f"| {collected - mastered} not mastered")
    if not check["ok"]:
        for p in check["problems"]:
            print("    * " + p)
        sys.exit("Parsed data disagrees with the page's own totals - not writing.")

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"  wrote {args.out}")


if __name__ == "__main__":
    main()
