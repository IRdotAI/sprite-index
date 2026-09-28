#!/usr/bin/env python3
"""
Rebuild data/sprites.json from the game's own data instead of hand-kept lists.

Everything here comes from Fortnite's game files, as parsed by fn-api.cc:

  * The sprite list, names, rarities, abilities and the exact variants each
    sprite has come from /v1/sprites (the SpriteLibrary_* data tables).
  * The mastery IDs that show up in your Epic athena profile come from the
    quest assets themselves:
      - S3: QuestDisplayData_quest_s41_spritemastery_pNN_qNN[x] carries the text
        "Sprite Mastery - <Sprite> <Letter>", which ties each qNN to a sprite.
      - S4: Quest_S42_SpriteMastery_<Codename>[_NN] rewards a backbling style
        (VTID_Backbling_WarmPrize_<Codename>[_Gold|_Cheatmaster|_Hacker]),
        which ties each _NN suffix to a variant.

  python3 tools/build_sprites.py [--out data/sprites.json]

Exits non-zero without writing if the game data disagrees with itself (a quest
letter pointing at a variant the sprite doesn't have, an ambiguous codename…),
so a bad run never overwrites good data.
"""
import argparse, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

API = "https://fn-api.cc/api"
UA = "sprite-index/1.0 (+https://github.com/IRdotAI/sprite-index)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Game variant suffix (last "_" segment of a variant id) -> the app's variant id.
VARIANT_SUFFIX = {
    "a": "normal", "base": "normal", "0": "normal",
    "gold": "gold", "candy": "gummy", "galaxy": "galaxy", "galactic": "galaxy",
    "gem": "gem", "holofoil": "holofoil", "cube": "cube", "quack": "quack",
    "cheatmaster": "cheatmaster", "loothacker": "loothack", "reaper": "reaper",
}

# S3 mastery quest letter -> variant.
#   d/e/f/g are pinned down by the game data: each sprite's quest letters must be
#   a subset of its real variants, and across all 22 sprites the only assignment
#   that fits is d=gem, e=holofoil, f=cube, g=quack (build() re-checks this).
#   a/b/c can't be separated that way - every S3 sprite with variants has gold,
#   gummy AND galaxy - so this order is carried over from the old tracker and is
#   NOT verified against game data.
S3_LETTER = {"": "normal", "a": "gold", "b": "gummy", "c": "galaxy",
             "d": "gem", "e": "holofoil", "f": "cube", "g": "quack"}

# S4 mastery quest suffix -> variant, from each quest's backbling style reward.
# _04.._06 grant no style, so the game data doesn't say which variant they are.
S4_VTID_SUFFIX = {"": "normal", "cheatmaster": "cheatmaster", "gold": "gold",
                  "hacker": "loothack"}

# S3 quest text uses short names that don't all appear in the sprite's id or
# display name. Everything else is matched automatically.
S3_TEXT_ALIAS = {"zp": "ZeroPointSprite", "grimreap": "GrimSprite"}

PNG_MAGIC = bytes([0x89]) + b"PNG"

VARIANT_ORDER = ["normal", "gold", "gummy", "galaxy", "holofoil", "gem", "cube",
                 "quack", "cheatmaster", "loothack", "reaper"]

norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())


def get(path, tries=4):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except Exception as e:
            last = e
        time.sleep(1.5 * (attempt + 1))
    sys.exit(f"fn-api.cc request failed after {tries} tries: {url}\n  {last}")


def asset(path):
    """Fetch a parsed game asset by package path (no extension)."""
    return get("/assets/json?path=" + urllib.parse.quote(path))


def search(q):
    d = get("/assets/search?limit=500&q=" + urllib.parse.quote(q)) or {}
    return [i["path"] for i in d.get("items", [])]


def download_icon(url, name, problems):
    """Save a game icon under img/sprites/game/ and return its site path."""
    if not url:
        return None
    rel = f"img/sprites/game/{name}.png"
    dest = os.path.join(ROOT, rel)
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                body = r.read()
        except Exception as e:
            problems.append(f"could not download {url}: {e}")
            return None
        if not body.startswith(PNG_MAGIC):
            problems.append(f"{url} is not a PNG")
            return None
        with open(dest, "wb") as f:
            f.write(body)
    return rel


def app_id(game_sprite):
    """Stable app id: the display name without 'Sprite', squashed ('8-Bit' -> '8bit')."""
    return norm(re.sub(r"\s*Sprite$", "", game_sprite["name"]))


def variant_of(game_variant_id):
    tail = game_variant_id.rsplit("_", 1)[-1].lower()
    return VARIANT_SUFFIX.get(tail)


# ---------------------------------------------------------------- S3 mastery
def s3_mastery(library, problems):
    """Map S3 quest numbers to sprites from the quests' own display text."""
    by_game = {g["id"]: g for g in library if g["season"].lower() == "ch7s3"}
    quests = {}
    for p in search("QuestDisplayData_quest_s41_spritemastery_p"):
        m = re.search(r"spritemastery_p\d\d_q(\d\d)([a-z]?)\.uasset$", p)
        if not m:
            continue  # the REDEEM quests mirror these, skip them
        d = asset(p[:-len(".uasset")])
        try:
            text = d[0]["Properties"]["Objectives"][0]["Description"]["SourceString"]
        except (TypeError, KeyError, IndexError):
            problems.append(f"S3: unreadable quest display data {p}")
            continue
        t = re.search(r"Sprite Mastery - (.+?)(?: ([A-G]))?$", text)
        if not t:
            problems.append(f"S3: unexpected quest text {text!r} in {p}")
            continue
        quests[(m.group(1), m.group(2))] = norm(t.group(1))
        time.sleep(0.1)

    q_to_game = {}
    for (q, _), name in sorted(quests.items()):
        if name in S3_TEXT_ALIAS:
            hits = [S3_TEXT_ALIAS[name]]
        else:
            hits = [gid for gid, g in by_game.items()
                    if name in norm(gid) or name in norm(g["name"])]
        if len(hits) != 1:
            problems.append(f"S3: quest q{q} ({name}) matches {hits or 'no sprite'}")
            continue
        if q_to_game.setdefault(q, hits[0]) != hits[0]:
            problems.append(f"S3: q{q} maps to both {q_to_game[q]} and {hits[0]}")

    mastery = {}
    for (q, letter), _ in quests.items():
        gid = q_to_game.get(q)
        if gid:
            mastery.setdefault(gid, {"q": q, "letters": set()})["letters"].add(letter)
    return mastery


# ---------------------------------------------------------------- S4 mastery
def extractable_tag(game_sprite):
    """The sprite definition's Sprites.Extractable.<Codename> tag - the same
    codename its mastery quests use (GhostDamage -> CloakOnDamage)."""
    tags = set(game_sprite.get("gameplayTags") or [])
    for v in game_sprite.get("variants") or []:
        tags |= set(v.get("gameplayTags") or [])
    names = {t.split(".", 2)[2] for t in tags if t.startswith("Sprites.Extractable.")}
    names.discard("BlockNormalXPGain")
    return norm(names.pop()) if len(names) == 1 else None


def s4_mastery(library, problems):
    """Map S4 quest codenames to sprites and verify suffix -> variant from rewards."""
    by_game = {g["id"]: g for g in library if g["season"].lower() == "ch7s4"}
    tags = {gid: extractable_tag(g) for gid, g in by_game.items()}
    quests = {}  # codename -> {suffix: package path}
    for p in search("Quest_S42_SpriteMastery_"):
        m = re.search(r"/Quest_S42_SpriteMastery_([A-Za-z0-9]+?)(?:_(\d\d))?\.uasset$", p)
        if m:
            quests.setdefault(m.group(1).lower(), {})[m.group(2) or ""] = p[:-len(".uasset")]

    suffix_variant, mastery, unmatched = {}, {}, []
    for code, paths in sorted(quests.items()):
        # Exact tag match; otherwise the tag may carry an extra prefix
        # (Jackrabbit is tagged CosmicThunderDoubleJump, its quests say DoubleJump).
        hits = ([gid for gid, t in tags.items() if t == code] or
                [gid for gid, t in tags.items() if t and t.endswith(code)])
        if not hits:
            unmatched.append(code)
            continue
        if len(hits) > 1:
            problems.append(f"S4: quest codename {code!r} is ambiguous: {hits}")
            continue
        gid = hits[0]
        for suffix, path in paths.items():
            if suffix > "03":
                continue  # no style reward to identify these by
            d = asset(path)
            vt = re.findall(r"VTID_Backbling_WarmPrize_[A-Za-z0-9]+?(?:_(Gold|Cheatmaster|Hacker))?\.",
                            json.dumps(d or ""))
            if not vt:
                continue
            v = S4_VTID_SUFFIX[vt[0].lower()]
            if suffix_variant.setdefault(suffix, v) != v:
                problems.append(f"S4: suffix _{suffix} is {suffix_variant[suffix]} for most "
                                f"sprites but {v} for {code}")
            time.sleep(0.1)
        mastery[gid] = {"quest": code, "suffixes": sorted(paths)}
    return mastery, suffix_variant, unmatched


# ---------------------------------------------------------------- assemble
def build(old):
    lib = get("/sprites") or {}
    library = lib.get("data") or []
    if len(library) < 20:
        sys.exit(f"fn-api.cc returned {len(library)} sprites - refusing to continue.")
    problems = []

    print(f"  {len(library)} sprites in the game's sprite libraries")
    s3 = s3_mastery(library, problems)
    print(f"  S3: {len(s3)} sprites tied to mastery quests")
    s4, s4_suffix, s4_unmatched = s4_mastery(library, problems)
    print(f"  S4: {len(s4)} sprites tied to mastery quests, suffixes {s4_suffix}")
    if s4_unmatched:
        print(f"  S4: quest codenames with no sprite in the library yet: {s4_unmatched}")

    old_by_id = {s["id"]: s for s in old.get("sprites", [])}
    sprites, seen = [], set()
    for g in library:
        season = {"ch7s3": "s3", "ch7s4": "s4"}.get(g["season"].lower())
        if not season:
            continue
        sid = app_id(g)
        if sid in seen:
            problems.append(f"duplicate app id {sid!r}")
        seen.add(sid)

        variants, imgs = [], {}
        for v in g.get("variants") or []:
            vid = variant_of(v["id"])
            if not vid:
                problems.append(f"{g['id']}: unknown variant {v['id']}")
                continue
            if vid not in variants:
                variants.append(vid)
                imgs[vid] = (v.get("images") or {}).get("icon")
        variants.sort(key=VARIANT_ORDER.index)

        prev = old_by_id.get(sid, {})
        # Keep the committed local art; download the game icon for anything new
        # so the site never hotlinks a third-party CDN.
        local = {k: p for k, p in (prev.get("variant_imgs") or {}).items()
                 if k in variants and not p.startswith("http") and os.path.exists(os.path.join(ROOT, p))}
        if "normal" not in local and prev.get("img") and not prev["img"].startswith("http")                 and os.path.exists(os.path.join(ROOT, prev["img"])):
            local["normal"] = prev["img"]
        variant_imgs = {}
        for v in variants:
            variant_imgs[v] = local.get(v) or download_icon(imgs.get(v), f"{g['id']}_{v}", problems)
        variant_imgs = {k: p for k, p in variant_imgs.items() if p}

        entry = {
            "id": sid,
            "name": re.sub(r"\s*Sprite$", "", g["name"]),
            "rarity": g["rarity"]["value"] if isinstance(g["rarity"], dict) else g["rarity"],
            "season": season,
            "ability": g.get("description") or prev.get("ability"),
            "location": g.get("acquisitionHint") or prev.get("location"),
            "variants": variants,
            "variant_imgs": variant_imgs,
            "img": variant_imgs.get("normal") or prev.get("img"),
            "summonCost": g.get("summonCost"),
            "dex": g.get("dexNumber"),
            "gameId": g["id"],
        }

        if season == "s3" and g["id"] in s3:
            m = s3[g["id"]]
            for letter in sorted(m["letters"]):
                if S3_LETTER[letter] not in variants:
                    problems.append(f"{sid}: mastery quest q{m['q']}{letter} = "
                                    f"{S3_LETTER[letter]}, but the sprite has {variants}")
            entry["mastery"] = {"q": m["q"]}
        elif season == "s4" and g["id"] in s4:
            entry["mastery"] = {"quest": s4[g["id"]]["quest"]}
        sprites.append(entry)

    if problems:
        print("\n  Game data disagrees with itself - not writing:")
        for p in problems:
            print("    * " + p)
        sys.exit(1)

    # Variant metadata: keep the existing copy text, drop the letters (the letter
    # mapping now lives in masteryKeys), add anything new.
    old_variants = {v["id"]: v for v in old.get("variants", [])}
    variants_meta = []
    for vid in VARIANT_ORDER:
        v = dict(old_variants.get(vid) or {"id": vid, "name": vid.title(), "rarity": "special"})
        v.pop("letter", None)
        variants_meta.append(v)

    return {
        "_meta": {
            "schemaVersion": 9,
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "source": "fn-api.cc /v1/sprites (SpriteLibrary data tables) + sprite mastery quest assets",
            "gameHotfix": lib.get("hotfixAppliedAt"),
            "note": "Generated by tools/build_sprites.py - edit that, not this file.",
        },
        # How mastery shows up in the Epic athena profile. The sync code reads
        # these instead of hard-coding them.
        "masteryKeys": {
            "s3": {"token": "Token:athena_s41_spritemastery_token_q{q}{letter}",
                   "letters": S3_LETTER,
                   "unverifiedLetters": ["a", "b", "c"]},
            "s4": {"quest": "Quest:quest_s42_spritemastery_{quest}{suffix}",
                   "suffixes": {("_" + k if k else ""): v for k, v in sorted(s4_suffix.items())}},
        },
        "variants": variants_meta,
        "rarities": old.get("rarities", []),
        "sprites": sprites,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "sprites.json"))
    args = ap.parse_args()
    try:
        old = json.load(open(args.out, encoding="utf-8"))
    except FileNotFoundError:
        old = {}
    data = build(old)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    by_season = {}
    for s in data["sprites"]:
        by_season[s["season"]] = by_season.get(s["season"], 0) + 1
    print(f"  wrote {args.out}: {by_season}")


if __name__ == "__main__":
    main()
