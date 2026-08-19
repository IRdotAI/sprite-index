#!/usr/bin/env python3
"""
Fully automatic sync.

Drives your own Chrome (headless, using your real logged-in profile) to
spritetrading.com, scrapes the collection, and publishes it. No console
pasting, no clicking.

  python3 tools/auto_sync.py            # sync once
  python3 tools/auto_sync.py --install  # run it every 30 min via systemd

Chrome must NOT already be running (it locks the profile).
Requires stdlib only - talks the DevTools protocol over a hand-rolled
WebSocket, because this machine has no websockets/selenium/playwright.
"""
import base64, json, os, re, socket, struct, subprocess, sys, time
import urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PROFILE = os.path.expanduser("~/.var/app/com.google.Chrome/config/google-chrome")
PORT = 9222
URL = "https://spritetrading.com/profile#collection"


# ----------------------------------------------------------------- websocket
class WS:
    """Minimal RFC6455 client - enough for CDP."""

    def __init__(self, url):
        m = re.match(r"ws://([^:/]+):(\d+)(/.*)", url)
        if not m:
            raise RuntimeError("bad ws url: " + url)
        host, port, path = m.group(1), int(m.group(2)), m.group(3)
        self.s = socket.create_connection((host, port), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((
            f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        ).encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.s.recv(4096)
            if not chunk:
                raise RuntimeError("handshake failed")
            buf += chunk
        # Localhost DevTools: a 101 is sufficient proof of upgrade.
        if b"101" not in buf.split(b"\r\n")[0]:
            raise RuntimeError("handshake rejected: " + buf[:200].decode("replace"))
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(65536)
            if not chunk:
                raise RuntimeError("connection closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, text):
        data = text.encode()
        hdr = bytearray([0x81])
        n = len(data)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < (1 << 16):
            hdr.append(0x80 | 126); hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", n)
        mask = os.urandom(4)
        hdr += mask
        self.s.sendall(bytes(hdr) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        while True:
            b0, b1 = self._read(2)
            op, masked, n = b0 & 0x0F, b1 & 0x80, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if masked else None
            payload = self._read(n)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if op == 0x8:
                raise RuntimeError("server closed websocket")
            if op == 0x9:  # ping -> pong
                continue
            if op in (0x1, 0x2):
                return payload.decode("utf-8", "replace")


class CDP:
    def __init__(self, ws_url):
        self.ws = WS(ws_url)
        self.n = 0

    def call(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.n:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def eval(self, expr, timeout_ms=60000):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True,
                      returnByValue=True, timeout=timeout_ms)
        if "exceptionDetails" in r:
            raise RuntimeError("page error: " +
                               json.dumps(r["exceptionDetails"])[:400])
        return r.get("result", {}).get("value")


# --------------------------------------------------------------------- chrome
WORKDIR = os.path.expanduser("~/.cache/sprite-index/chrome")


def prepare_profile():
    """Copy just enough of the real profile to reuse the login session.

    Chrome holds an exclusive lock on its profile, so we can't read the live
    one while the browser is open. Copying the cookie jar plus 'Local State'
    (which holds the key those cookies are encrypted with) gives a throwaway
    profile that is still logged in.
    """
    if not os.path.isdir(PROFILE):
        sys.exit(f"Chrome profile not found at {PROFILE}")
    import shutil
    dst_default = os.path.join(WORKDIR, "Default")
    os.makedirs(os.path.join(dst_default, "Network"), exist_ok=True)

    copied = []
    for rel in ("Local State",
                "Default/Cookies",
                "Default/Network/Cookies",
                "Default/Preferences",
                "Default/Login Data"):
        src = os.path.join(PROFILE, rel)
        if os.path.exists(src):
            dst = os.path.join(WORKDIR, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            try:
                shutil.copy2(src, dst)
                copied.append(rel)
            except Exception as e:
                print(f"  (couldn't copy {rel}: {e})")
    if not any("Cookies" in c for c in copied):
        sys.exit("Could not copy your Chrome cookies - is Chrome installed and "
                 "logged into spritetrading.com?")
    return WORKDIR


def start_chrome():
    profile = prepare_profile()
    proc = subprocess.Popen([
        "flatpak", "run",
        f"--filesystem={WORKDIR}",
        "com.google.Chrome",
        "--headless=new", "--disable-gpu", "--no-first-run",
        f"--user-data-dir={profile}",
        f"--remote-debugging-port={PORT}",
        "--remote-allow-origins=*",
        "--window-size=1400,2000",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for _ in range(120):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2):
                return proc
        except Exception:
            time.sleep(0.5)
    proc.terminate()
    sys.exit("Chrome did not expose its debug port.")


def new_tab(url):
    # Chrome requires PUT on /json/new (older builds allowed GET).
    q = urllib.parse.quote(url, safe="")
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?{q}", method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)["webSocketDebuggerUrl"]
    except urllib.error.HTTPError:
        # Fall back: reuse the existing blank tab and navigate it.
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/list", timeout=15) as r:
            tabs = json.load(r)
        page = next((t for t in tabs if t.get("type") == "page"), None)
        if not page:
            raise RuntimeError("no page target available")
        cdp = CDP(page["webSocketDebuggerUrl"])
        cdp.call("Page.enable")
        cdp.call("Page.navigate", url=url)
        return page["webSocketDebuggerUrl"]


# ----------------------------------------------------------------------- main
SCROLL = """
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let last = -1;
  for (let i = 0; i < 60; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(400);
    const n = document.querySelectorAll('span.cname').length;
    if (n === last && i > 4) break;
    last = n;
  }
  window.scrollTo(0, 0);
  await sleep(600);
  return document.querySelectorAll('span.cname').length;
})()
"""


def sync_once():
    proc = start_chrome()
    try:
        cdp = CDP(new_tab(URL))
        cdp.call("Runtime.enable")
        cdp.call("Page.enable")
        print("Loading collection…")
        time.sleep(6)

        title = cdp.eval("document.title") or ""
        body = cdp.eval("(document.body.innerText||'').slice(0,400)") or ""
        if "sign in" in body.lower() or "log in" in body.lower():
            sys.exit("Chrome isn't logged into spritetrading.com.\n"
                     "Open Chrome normally, log in, close it, then re-run.")

        n = cdp.eval(SCROLL, timeout_ms=90000)
        print(f"Rendered {n} sprite cards")

        grab = open(os.path.join(HERE, "grab2.js")).read()
        cdp.eval(grab, timeout_ms=90000)
        payload = cdp.eval("window.__export")
        if not payload:
            sys.exit("Scrape produced nothing - is the Collection tab present?")

        data = json.loads(payload)
        chk = data.get("check", {})
        t = data["totals"]
        print(f"  {t['entries']} entries | {t['collected']} collected | "
              f"{t['mastered']} mastered | {t['notMastered']} not mastered")
        if not chk.get("ok", True):
            for p in chk.get("problems", []):
                print("  ! " + p)
            sys.exit("Incomplete scrape - not publishing.")

        out = os.path.join(ROOT, "data", "collection.json")
        prev = None
        if os.path.exists(out):
            try:
                prev = json.load(open(out))
            except Exception:
                pass
        if prev and prev.get("entries") == data.get("entries"):
            print("No change since last sync.")
            return
        os.makedirs(os.path.dirname(out), exist_ok=True)
        json.dump(data, open(out, "w"), indent=1)
        print("Publishing…")
        subprocess.run([os.path.join(HERE, "publish.sh")], check=True, cwd=ROOT)
    finally:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/close", timeout=2)
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()


UNIT = """[Unit]
Description=Sprite Index auto-sync

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 {script}
"""

TIMER = """[Unit]
Description=Sprite Index auto-sync every 10 minutes

[Timer]
# Fires on clock boundaries: :00, :10, :20, :30, :40, :50
OnCalendar=*:00/10
Persistent=true
AccuracySec=10s

[Install]
WantedBy=timers.target
"""


def install():
    d = os.path.expanduser("~/.config/systemd/user")
    os.makedirs(d, exist_ok=True)
    script = os.path.join(HERE, "auto_sync.py")
    open(os.path.join(d, "sprite-sync.service"), "w").write(UNIT.format(script=script))
    open(os.path.join(d, "sprite-sync.timer"), "w").write(TIMER)
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", "sprite-sync.timer"], check=True)
    print("Installed. It will sync every 10 minutes while the Deck is on.")
    print("  status:  systemctl --user list-timers sprite-sync.timer")
    print("  logs:    journalctl --user -u sprite-sync.service -n 40")
    print("  stop:    systemctl --user disable --now sprite-sync.timer")


if __name__ == "__main__":
    if "--install" in sys.argv:
        install()
    else:
        sync_once()
