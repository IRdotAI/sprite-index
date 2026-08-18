/* ============================================================
   Sprite Index — API discovery v2
   Paste into the console at https://spritetrading.com while
   viewing your collection.  DO NOT RELOAD — this reads the
   browser's existing request log, so it sees everything the
   page already fetched.
   Prints a REPORT. Token/cookie VALUES are never printed.
   ============================================================ */
(() => {
  const SECRET = /token|auth|session|bearer|secret|password|jwt|refresh|credential/i;
  const out = { page: location.href };

  // ---- 1. every request this page has already made ----------------------
  // performance entries survive across the whole page lifetime, so this
  // works without re-running or reloading anything.
  const res = performance.getEntriesByType('resource')
    .map(e => e.name)
    .filter(u => !/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|css|ico|mp4)(\?|$)/i.test(u));

  const sameOrigin = u => { try { return new URL(u).origin === location.origin } catch { return false } };
  out.apiLikeRequests = res.filter(u =>
    /\/api\/|\/graphql|\/trpc|\/_next\/data\/|\/rest\/|\/v\d+\/|\.json(\?|$)/i.test(u)
  ).slice(0, 60);
  out.thirdPartyHosts = [...new Set(res.filter(u => !sameOrigin(u))
    .map(u => { try { return new URL(u).host } catch { return null } }).filter(Boolean))].slice(0, 40);
  out.totalRequests = res.length;
  out.allSameOrigin = res.filter(sameOrigin).slice(0, 40);

  // ---- 2. framework + any server-embedded data --------------------------
  const fw = [];
  if (window.__NEXT_DATA__) fw.push('next.js');
  if (window.__NUXT__) fw.push('nuxt');
  if (window.__remixContext) fw.push('remix');
  if (document.querySelector('#__svelte, [data-sveltekit]')) fw.push('sveltekit');
  if (window.React || document.querySelector('[data-reactroot]')) fw.push('react');
  out.framework = fw.length ? fw : ['unknown'];

  // Server-rendered pages often embed your data straight into the HTML.
  // If so, we may not need an API at all.
  const shape = (o, d = 0) => {
    if (d > 4) return '…';
    if (Array.isArray(o)) return o.length ? [shape(o[0], d + 1), `…×${o.length}`] : [];
    if (o && typeof o === 'object') {
      const r = {};
      for (const k of Object.keys(o).slice(0, 30))
        r[k] = SECRET.test(k) ? '<redacted>'
             : (o[k] && typeof o[k] === 'object') ? shape(o[k], d + 1)
             : String(o[k]).slice(0, 40);
      return r;
    }
    return typeof o;
  };
  if (window.__NEXT_DATA__) { try { out.nextDataShape = shape(window.__NEXT_DATA__.props) } catch {} }

  // Any inline JSON blobs that mention sprites
  out.inlineJsonBlobs = [...document.querySelectorAll('script[type*="json"]')]
    .map(s => (s.textContent || '').slice(0, 100000))
    .filter(t => /sprite|collect|master|variant/i.test(t))
    .map(t => { try { return shape(JSON.parse(t)) } catch { return t.slice(0, 300) } })
    .slice(0, 5);

  // ---- 3. login / session state ----------------------------------------
  out.cookieNames = document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean);
  out.hasCookies = out.cookieNames.length > 0;
  const keys = s => { try { return Object.keys(s) } catch { return ['<blocked>'] } };
  out.localStorageKeys = keys(localStorage);
  out.sessionStorageKeys = keys(sessionStorage);
  try {
    if (window.indexedDB && indexedDB.databases)
      indexedDB.databases().then(d => console.log('indexedDB:', d.map(x => x.name)));
  } catch {}

  // ---- 4. what does the page actually say? ------------------------------
  const txt = (document.body && document.body.innerText) || '';
  out.looksLoggedIn = /sign out|log ?out|my collection|my profile|my index/i.test(txt);
  out.looksLoggedOut = /sign in|log ?in|connect (your )?epic|link account/i.test(txt);
  out.pageTextSample = txt.replace(/\s+/g, ' ').slice(0, 700);

  // ---- 5. how many sprite tiles are actually rendered? ------------------
  const counts = {};
  for (const sel of ['[class*=sprite]', '[class*=card]', '[class*=item]', '[class*=tile]', 'img']) {
    try { counts[sel] = document.querySelectorAll(sel).length } catch {}
  }
  out.domCounts = counts;

  const text = JSON.stringify(out, null, 2);
  console.log('%c===== REPORT v2 =====', 'color:#4dd4ff;font-weight:bold');
  console.log(text);
  window.__spriteReport2 = text;
  try { copy(text); console.log('%c✓ copied', 'color:#7bd88f'); }
  catch { console.log('Run:  copy(__spriteReport2)'); }
})();
