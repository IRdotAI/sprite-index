/* ============================================================
   Sprite Index — collection grab + API endpoint discovery
   Run in the console at https://spritetrading.com/profile#collection
   while logged in, with your Collection tab visible.

   Set the filter to "All" and scroll to the bottom first, so every
   sprite is rendered (some lists lazy-load).

   Produces:  window.__grab   (also auto-copied)
   ============================================================ */
(() => {
  const out = { page: location.href, when: new Date().toISOString() };

  // ---- 1. every request to the API host, with full paths ----------------
  const all = performance.getEntriesByType('resource').map(e => e.name);
  out.apiUrls = [...new Set(all.filter(u => /api\.spritetrading\.com/i.test(u)))]
    .map(u => u.length > 300 ? u.slice(0, 300) + '…' : u).slice(0, 80);
  out.otherHosts = [...new Set(all.map(u => { try { return new URL(u).host } catch { return '' } }))]
    .filter(h => h && h !== location.host).slice(0, 20);

  // ---- 2. scrape the rendered collection --------------------------------
  const VARIANTS = ['Normal','Base','Gold','Gummy','Galaxy','Gem','Holofoil','Cube','Quack'];
  const RARITIES = ['Rare','Epic','Legendary','Mythic','Special','Common','Uncommon'];
  const vRe = new RegExp('\\b(' + VARIANTS.join('|') + ')\\b', 'i');
  const rRe = new RegExp('\\b(' + RARITIES.join('|') + ')\\b', 'i');

  // innerText glues adjacent inline elements together ("WaterGold"), which
  // breaks word-boundary matching. Walk text nodes and join with spaces.
  const textOf = el => {
    const parts = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { const s = n.textContent.trim(); if (s) parts.push(s); }
    el.querySelectorAll('img[alt]').forEach(i => {
      const a = (i.getAttribute('alt') || '').trim(); if (a) parts.push(a);
    });
    return parts.join(' ');
  };

  // A card is the smallest element that has an image and mentions a variant.
  const cands = [...document.querySelectorAll('*')].filter(el => {
    if (el.children.length > 12) return false;
    const t = textOf(el);
    if (!t || t.length > 160) return false;
    return vRe.test(t) && el.querySelector('img');
  });
  // Keep only the innermost such elements (drop ancestors of other candidates).
  const set = new Set(cands);
  const cards = cands.filter(el => ![...set].some(o => o !== el && el.contains(o)));

  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  // The img alt often repeats the visible name, giving "Water Water".
  const dedupe = s => {
    const w = clean(s).split(' ').filter(Boolean);
    const h = w.length / 2;
    if (w.length > 1 && w.length % 2 === 0 &&
        w.slice(0, h).join(' ').toLowerCase() === w.slice(h).join(' ').toLowerCase())
      return w.slice(0, h).join(' ');
    const seen = new Set(), keep = [];
    for (const x of w) { const k = x.toLowerCase(); if (!seen.has(k)) { seen.add(k); keep.push(x) } }
    return keep.join(' ');
  };
  out.entries = cards.map(el => {
    const t = clean(textOf(el));
    const img = el.querySelector('img');
    const variant = (t.match(vRe) || [])[1] || null;
    const rarity = (t.match(rRe) || [])[1] || null;
    const mastered = /mastered/i.test(t);
    const lvl = t.match(/(?:lvl|level)\s*(\d+)/i) || t.match(/\b([1-5])\s*\/\s*5\b/);
    // Name = the text with the known labels stripped out.
    let name = t.replace(/mastered/ig, '');
    if (variant) name = name.replace(new RegExp('\\b' + variant + '\\b', 'ig'), '');
    if (rarity) name = name.replace(new RegExp('\\b' + rarity + '\\b', 'ig'), '');
    name = dedupe(name.replace(/lvl\s*\d+|level\s*\d+|\d\s*\/\s*5/ig, ''));
    return {
      name: name || null,
      variant, rarity, mastered,
      level: lvl ? +lvl[1] : null,
      img: img ? (img.getAttribute('src') || '').slice(0, 200) : null,
      alt: img ? clean(img.getAttribute('alt')) : null
    };
  }).filter(e => e.name || e.alt);

  out.entryCount = out.entries.length;
  out.masteredCount = out.entries.filter(e => e.mastered).length;

  // ---- 3. structure sample, so the scraper can be fixed if it missed ----
  out.sampleCardHTML = cards.slice(0, 2).map(el => el.outerHTML.slice(0, 1200));
  out.headlineText = clean((document.body.innerText || '').slice(0, 1200));

  const text = JSON.stringify(out, null, 2);
  window.__grab = text;
  console.log('%c===== GRAB =====', 'color:#4dd4ff;font-weight:bold');
  console.log('entries found:', out.entryCount, '| mastered:', out.masteredCount);
  console.log('api urls:', out.apiUrls.length);
  console.log(text);
  try { copy(text); console.log('%c✓ copied to clipboard', 'color:#7bd88f'); }
  catch { console.log('Run:  copy(__grab)'); }
})();
