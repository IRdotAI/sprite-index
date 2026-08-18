#!/usr/bin/env python3
"""
One-time Epic login -> long-lived device auth, then dump the Fortnite
profile so we can locate the sprite items.

Run:   python3 tools/epic_login.py

You'll be asked for an authorization code. The script prints the URL to
get it from. Nothing is sent anywhere except Epic.

Writes:
  ~/.config/sprite-index/device_auth.json   (secret - never commit)
  tools/profile_dump.json                   (for finding sprite templateIds)

Note: this authenticates as the Fortnite game client, which is outside
Epic's documented/public API surface. Read-only, but it is against Epic's
ToS and may stop working after any patch.
"""
import json, os, sys, time, base64, socket, urllib.request, urllib.parse, urllib.error

# Epic's hosts advertise AAAA records that stall on some networks (the Deck
# included), which shows up as a TLS handshake timeout. curl falls back to
# IPv4; Python doesn't. Force IPv4 for every lookup.
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


socket.getaddrinfo = _ipv4_only

UA = ("Fortnite/++Fortnite+Release-Live Windows/10.0.19041.1.256.64bit")

# Fortnite iOS game client - the credentials community tools use.
CLIENT_ID = "3446cd72694c4a4485d81b77adbb2141"
CLIENT_SECRET = "9209d4a5e25a457fb9b07489d313b41a"
BASIC = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()

OAUTH = "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token"
DEVICE = "https://account-public-service-prod.ol.epicgames.com/account/api/public/account/{aid}/deviceAuth"
PROFILE = ("https://fortnite-public-service-prod11.ol.epicgames.com"
           "/fortnite/api/game/v2/profile/{aid}/client/QueryProfile?profileId={pid}&rvn=-1")

CODE_URL = ("https://www.epicgames.com/id/api/redirect"
            f"?clientId={CLIENT_ID}&responseType=code")

CFG_DIR = os.path.expanduser("~/.config/sprite-index")
CFG = os.path.join(CFG_DIR, "device_auth.json")
HERE = os.path.dirname(os.path.abspath(__file__))


def post(url, data, headers, tries=3):
    body = urllib.parse.urlencode(data).encode() if isinstance(data, dict) else data
    headers = {**headers, "User-Agent": UA}
    last = None
    for attempt in range(1, tries + 1):
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            # A real answer from Epic - retrying won't change it.
            detail = e.read().decode(errors="replace")
            raise SystemExit(f"\nEpic returned HTTP {e.code}:\n{detail}\n")
        except (urllib.error.URLError, TimeoutError, socket.timeout) as e:
            last = e
            if attempt < tries:
                print(f"  network hiccup ({e}) - retrying {attempt}/{tries - 1}…")
                time.sleep(2 * attempt)
    raise SystemExit(f"\nCould not reach Epic after {tries} tries: {last}\n"
                     "Check your connection and run the script again.")


def main():
    print(__doc__)
    print("STEP 1 - make sure you're logged into Epic in your browser, then open:\n")
    print("   " + CODE_URL + "\n")
    print("You'll see JSON like {\"redirectUrl\":...,\"authorizationCode\":\"abc123...\"}")
    code = input("\nPaste the authorizationCode value here: ").strip().strip('"')
    if not code:
        raise SystemExit("No code given.")

    print("\nExchanging code for a token…")
    tok = post(OAUTH, {"grant_type": "authorization_code", "code": code},
               {"Authorization": "basic " + BASIC,
                "Content-Type": "application/x-www-form-urlencoded"})

    access, aid = tok["access_token"], tok["account_id"]
    print(f"Logged in as {tok.get('displayName', aid)}")

    print("Creating device auth (so we never need the password again)…")
    dev = post(DEVICE.format(aid=aid), b"",
               {"Authorization": "bearer " + access, "Content-Type": "application/json"})

    os.makedirs(CFG_DIR, exist_ok=True)
    creds = {"accountId": dev["accountId"], "deviceId": dev["deviceId"], "secret": dev["secret"]}
    with open(CFG, "w") as f:
        json.dump(creds, f, indent=2)
    os.chmod(CFG, 0o600)
    print(f"Saved device auth -> {CFG}  (keep this private)")

    # ---- dump profiles so we can find the sprites -------------------------
    dump = {}
    for pid in ("athena", "common_core", "campaign", "collections", "metadata"):
        print(f"Querying profile '{pid}'…")
        try:
            dump[pid] = post(PROFILE.format(aid=aid, pid=pid), b"{}",
                             {"Authorization": "bearer " + access,
                              "Content-Type": "application/json"})
        except SystemExit as e:
            dump[pid] = {"error": str(e)}

    out = os.path.join(HERE, "profile_dump.json")
    with open(out, "w") as f:
        json.dump(dump, f, indent=2)
    print(f"\nWrote {out}")

    # ---- summarise what template types exist ------------------------------
    print("\nItem template prefixes found (this is how we locate sprites):")
    for pid, d in dump.items():
        try:
            items = d["profileChanges"][0]["profile"]["items"]
        except Exception:
            continue
        kinds = {}
        for it in items.values():
            t = str(it.get("templateId", "")).split(":")[0]
            kinds[t] = kinds.get(t, 0) + 1
        print(f"\n  [{pid}] {len(items)} items")
        for k, n in sorted(kinds.items(), key=lambda x: -x[1]):
            mark = "  <-- LOOK" if any(w in k.lower() for w in
                                       ("sprite", "companion", "pet", "buddy")) else ""
            print(f"     {k:<32} {n}{mark}")

    print("\nDone. Send me the prefix list above (not the dump file - it's large "
          "and contains your account data) and I'll wire up the sync.")


if __name__ == "__main__":
    main()
