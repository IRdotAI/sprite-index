/* ============================================================
   Sprite Index — API discovery
   Paste this whole thing into the browser console while logged
   in at https://spritetrading.com, then reload the page.
   After ~15 seconds it prints a REPORT block. Copy that back.

   It NEVER prints token/cookie VALUES — only key names, lengths
   and shapes, so the output is safe to paste into chat.
   ============================================================ */
(() => {
  const SECRET = /token|auth|session|bearer|secret|password|jwt|refresh|credential|cookie|key/i;
  const seen = [];
  const MAX = 60;

  const redact = (k, v) => {
    if (v == null) return null;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (SECRET.test(k) || s.length > 220) return `<${typeof v}, ${s.length} chars, redacted>`;
    return s;
  };

  // ---- 1. storage -------------------------------------------------------
  const dumpStore = (store, label) => {
    const out = {};
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        out[k] = redact(k, store.getItem(k));
      }
    } catch (e) { out._error = String(e); }
    return { [label]: out };
  };

  // ---- 2. network capture ----------------------------------------------
  const note = (method, url, status, body) => {
    if (seen.length >= MAX) return;
    let sample = null;
    if (body && typeof body === 'string') {
      try {
        const j = JSON.parse(body);
        // Report the SHAPE of the response, plus tiny value samples.
        const shape = o => {
          if (Array.isArray(o)) return [o.length ? shape(o[0]) : '?', `…×${o.length}`];
          if (o && typeof o === 'object') {
            const r = {};
            for (const k of Object.keys(o).slice(0, 25)) {
              const v = o[k];
              r[k] = (v && typeof v === 'object') ? shape(v)
                   : SECRET.test(k) ? '<redacted>'
                   : String(v).slice(0, 40);
            }
            return r;
          }
          return typeof o;
        };
        sample = shape(j);
      } catch { sample = '<non-JSON ' + body.length + ' chars>'; }
    }
    seen.push({ method, url: url.split('?')[0], query: (url.split('?')[1] || '').slice(0, 120), status, sample });
  };

  const of = window.fetch;
  window.fetch = async function (...a) {
    const req = a[0], url = typeof req === 'string' ? req : req.url;
    const m = (a[1] && a[1].method) || (req && req.method) || 'GET';
    const res = await of.apply(this, a);
    try { note(m, url, res.status, await res.clone().text()); } catch {}
    return res;
  };

  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...r) { this.__m = m; this.__u = u; return oo.call(this, m, u, ...r); };
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('load', () => { try { note(this.__m, this.__u, this.status, this.responseText); } catch {} });
    return os.apply(this, a);
  };

  // ---- 3. probe likely endpoints ---------------------------------------
  const probes = [
    '/api/me', '/api/user', '/api/profile', '/api/session',
    '/api/sprites', '/api/index', '/api/collection', '/api/inventory',
    '/api/user/sprites', '/api/me/sprites', '/api/v1/sprites',
    '/api/epic/sync', '/api/sync', '/api/auth/session'
  ];

  const probe = async () => {
    const hits = [];
    await Promise.all(probes.map(async p => {
      try {
        const r = await of(location.origin + p, { credentials: 'include' });
        const t = (await r.text()).slice(0, 400);
        if (r.status !== 404) hits.push({ path: p, status: r.status, preview: t.slice(0, 200) });
      } catch (e) { /* ignore */ }
    }));
    return hits;
  };

  // ---- 4. report --------------------------------------------------------
  console.log('%c[Sprite Index] Capturing… reload the page, open your sprite index, then wait.',
    'color:#4dd4ff;font-weight:bold');

  setTimeout(async () => {
    const hits = await probe();
    const report = {
      page: location.href,
      cookieNames: document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean),
      ...dumpStore(localStorage, 'localStorage'),
      ...dumpStore(sessionStorage, 'sessionStorage'),
      probedEndpoints: hits,
      capturedRequests: seen
    };
    const text = JSON.stringify(report, null, 2);
    console.log('%c===== REPORT (copy everything below) =====', 'color:#4dd4ff;font-weight:bold');
    console.log(text);
    try { await navigator.clipboard.writeText(text); console.log('%c✓ Copied to clipboard.', 'color:#7bd88f'); }
    catch { console.log('(Select the JSON above and copy it manually.)'); }
    window.__spriteReport = text;
  }, 15000);
})();
