#!/usr/bin/env python3
"""
Print your spritetrading.com session cookie, read out of Chrome's cookie jar.

This is the one thing the cloud sync can't do for itself: the cookie is proof
you're logged in, and only your browser has it. Run this whenever the sync
reports an expired session (roughly monthly), and store the value as the
ST_SESSION secret on the repo.

  python3 tools/session_from_chrome.py            # print it
  python3 tools/session_from_chrome.py --push     # store it as a GitHub secret

Nothing is sent anywhere except, with --push, to GitHub via the gh CLI.
"""
import hashlib, os, shutil, sqlite3, subprocess, sys, tempfile

PROFILE = os.path.expanduser("~/.var/app/com.google.Chrome/config/google-chrome")
COOKIE_DBS = ("Default/Network/Cookies", "Default/Cookies")


def read_encrypted():
    for rel in COOKIE_DBS:
        src = os.path.join(PROFILE, rel)
        if not os.path.exists(src):
            continue
        # Chrome holds the live DB open; work on a copy.
        tmp = tempfile.mktemp()
        shutil.copy2(src, tmp)
        try:
            row = sqlite3.connect(tmp).execute(
                "select encrypted_value from cookies "
                "where name='st_session' and host_key like '%spritetrading%'").fetchone()
        finally:
            os.unlink(tmp)
        if row:
            return row[0]
    sys.exit("No spritetrading.com session cookie in Chrome. Open Chrome, log in "
             "at spritetrading.com, then run this again.")


def decrypt(blob):
    if not blob.startswith(b"v10"):
        sys.exit(f"Unexpected cookie encryption {blob[:3]!r}. If this is v11 the "
                 "cookie is in your keyring; log out and back in at "
                 "spritetrading.com with kwallet closed, then retry.")
    # Linux 'basic' key store: a fixed passphrase, no keyring involved.
    key = hashlib.pbkdf2_hmac("sha1", b"peanuts", b"saltysalt", 1, 16)
    r = subprocess.run(
        ["openssl", "enc", "-d", "-aes-128-cbc", "-K", key.hex(),
         "-iv", (b" " * 16).hex(), "-nopad"],
        input=blob[3:], capture_output=True)
    if r.returncode != 0:
        sys.exit("openssl could not decrypt the cookie: " + r.stderr.decode()[:200])
    out = r.stdout
    pad = out[-1] if out else 0
    if 1 <= pad <= 16:
        out = out[:-pad]
    # Chrome 118+ prefixes the plaintext with a 32-byte SHA-256 of the domain.
    value = out[32:].decode("utf-8", "replace")
    if not value.strip():
        sys.exit("Decrypted an empty cookie value - Chrome's format may have changed.")
    return value.strip()


def main():
    value = decrypt(read_encrypted())
    if "--push" in sys.argv:
        if not shutil.which("gh"):
            sys.exit("The gh CLI isn't installed, so I can't set the secret for you.\n"
                     "Run without --push and paste the value into GitHub yourself:\n"
                     "  Settings -> Secrets and variables -> Actions -> ST_SESSION")
        subprocess.run(["gh", "secret", "set", "ST_SESSION", "--body", value],
                       check=True, cwd=os.path.dirname(os.path.dirname(
                           os.path.abspath(__file__))))
        print("ST_SESSION updated on the repo. The next scheduled sync will use it.")
    else:
        print(value)


if __name__ == "__main__":
    main()
