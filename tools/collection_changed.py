#!/usr/bin/env python3
"""
Did the collection actually move, or only its timestamp?

Every fetch rewrites exportedAt, so a plain `git diff` is always dirty.
Committing on that alone would push 144 empty commits a day.

Exit 0 = something really changed (publish it), 1 = nothing did.
"""
import json, subprocess, sys

PATH = "data/collection.json"


def body(text):
    d = json.loads(text)
    d.pop("exportedAt", None)
    return d


def main():
    new = open(PATH).read()
    old = subprocess.run(["git", "show", f"HEAD:{PATH}"],
                         capture_output=True, text=True)
    if old.returncode != 0:
        print("No published collection yet - publishing.")
        return 0
    try:
        changed = body(old.stdout) != body(new)
    except json.JSONDecodeError:
        print("Published collection isn't readable JSON - republishing.")
        return 0
    print("Collection changed." if changed else "No change since last sync.")
    return 0 if changed else 1


if __name__ == "__main__":
    sys.exit(main())
