/* ============================================================
   Sprite Index — collection export (v2)
   Run at https://spritetrading.com/profile#collection while
   logged in, filter set to "All", scrolled to the bottom.

   Downloads: spritetrading-export.json
   Import that file in the Sprite Index app (⋯ -> Import).

   Reads only VISIBLE status labels — the page keeps all of
   them in the DOM and toggles them with CSS.
   ============================================================ */
(() => {
  const VARIANTS = ['Gold', 'Gummy', 'Galaxy', 'Gem', 'Holofoil', 'Cube', 'Quack'];

  // spritetrading uses internal codenames for licensed characters
  const ALIAS = {
    'Grim': 'Grim Reaper',
    'Burnt Peanut': 'Burnt Peanut',
    'Coke Parmesan': 'Vini Jr.',
    'Pedicure Antacid': 'Ironmouse',
    'Company Stargazer': 'Pollo',
    'Filler Grunt': 'John Wick',
    'Fossil Meal': 'Batman'
  };

  const visible = el => {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0;
  };
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  const names = [...document.querySelectorAll('span.cname')];
  if (!names.length) {
    console.log('%cNo .cname elements found — are you on the Collection tab?', 'color:#f66');
    return;
  }

  const entries = names.map(cn => {
    // The card wraps both the art and the foot that holds .cname
    const foot = cn.closest('.foot') || cn.parentElement;
    const card = (foot && foot.parentElement) || cn.parentElement;
    const q = s => card.querySelector(s);

    const label = clean(cn.textContent);           // "Gold Water" | "Water"
    let variant = 'Normal', sprite = label;
    for (const v of VARIANTS) {
      if (label.toLowerCase().startsWith(v.toLowerCase() + ' ')) {
        variant = v;
        sprite = clean(label.slice(v.length));
        break;
      }
    }

    // The label is not always right: spritetrading renders Cube Zero Point
    // as plain "Zero Point", which collides with its own Normal. The image
    // filename (cube-zeropoint.webp vs zeropoint.webp) is authoritative.
    const artEl = [...card.querySelectorAll('img')]
      .find(i => /\/sprites\//.test(i.getAttribute('src') || ''));
    const src = artEl ? (artEl.getAttribute('src') || '') : '';
    if (src) {
      const file = src.split('/').pop().split('?')[0];
      const fileVariant = VARIANTS.find(v => file.toLowerCase().startsWith(v.toLowerCase() + '-'));
      variant = fileVariant || 'Normal';
    }

    sprite = ALIAS[sprite] || sprite;

    const mastered = visible(q('.masteredline'));
    const collected = !visible(q('.uncollected'));
    const lvlEl = q('[data-lvl]');
    const level = mastered ? 5
      : (visible(q('.levelline')) && lvlEl ? +clean(lvlEl.textContent) || null : null);

    const pill = q('.sprite-pill');
    const img = q('.sprite-art img') || q('img');

    return {
      sprite, variant, label,
      collected, mastered, level,
      rarity: pill ? clean(pill.textContent) : null,
      img: img ? (img.getAttribute('src') || '').split('&v=')[0] : null
    };
  });

  // De-duplicate in case a card renders twice
  const byKey = new Map();
  for (const e of entries) byKey.set(e.sprite + '|' + e.variant, e);
  const list = [...byKey.values()];

  const payload = {
    source: 'spritetrading.com',
    exportedAt: new Date().toISOString(),
    totals: {
      entries: list.length,
      collected: list.filter(e => e.collected).length,
      mastered: list.filter(e => e.mastered).length,
      notMastered: list.filter(e => e.collected && !e.mastered).length
    },
    entries: list
  };

  // ---- verify against the page's own totals -----------------------------
  // The profile header states the truth ("117 / 117 SPRITES INDEXED",
  // "CUBE 9/9"). If our scrape disagrees, something didn't render.
  const page = (document.body.innerText || '').replace(/\s+/g, ' ');
  const check = { ok: true, problems: [] };

  const totalM = page.match(/(\d+)\s*\/\s*(\d+)\s*SPRITES INDEXED/i);
  if (totalM) {
    const expected = +totalM[2];
    check.expectedEntries = expected;
    if (list.length !== expected) {
      check.ok = false;
      check.problems.push(`page says ${expected} sprites, scraped ${list.length}`);
    }
  }

  const VNAMES = ['BASE', 'GOLD', 'GUMMY', 'GALAXY', 'GEM', 'HOLOFOIL', 'CUBE', 'QUACK'];
  const got = {};
  for (const e of list) got[(e.variant === 'Normal' ? 'BASE' : e.variant).toUpperCase()] =
    (got[(e.variant === 'Normal' ? 'BASE' : e.variant).toUpperCase()] || 0) + 1;
  for (const v of VNAMES) {
    const m = page.match(new RegExp(v + '\\s+(\\d+)\\s*/\\s*(\\d+)', 'i'));
    if (!m) continue;
    const expected = +m[2], mine = got[v] || 0;
    if (mine !== expected) {
      check.ok = false;
      check.problems.push(`${v}: page says ${expected}, scraped ${mine}`);
    }
  }
  payload.check = check;

  const text = JSON.stringify(payload, null, 2);
  window.__export = text;

  if (!check.ok) {
    console.log('%c⚠ INCOMPLETE SCRAPE — do not sync this file',
      'color:#ffb454;font-weight:bold;font-size:14px');
    check.problems.forEach(p => console.log('   • ' + p));
    console.log('%cScroll to the very bottom of the collection (and back up), ' +
      'then run this script again.', 'color:#ffb454');
  } else {
    console.log('%c✓ Complete — matches the page totals', 'color:#7bd88f;font-weight:bold');
  }

  console.log('%c===== SPRITE EXPORT =====', 'color:#4dd4ff;font-weight:bold');
  console.log('entries:', payload.totals.entries,
              '| collected:', payload.totals.collected,
              '| mastered:', payload.totals.mastered,
              '| NOT mastered:', payload.totals.notMastered);
  console.table(list.filter(e => e.collected && !e.mastered)
    .map(e => ({ sprite: e.sprite, variant: e.variant, level: e.level })));

  // Set window.__SPRITE_NO_DOWNLOAD before running this if you only want
  // window.__export - an automated caller downloading a file per run is what
  // once filled ~/Downloads with 35 copies of the export.
  if (window.__SPRITE_NO_DOWNLOAD) return;

  try {
    const b = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'spritetrading-export.json';
    document.body.appendChild(a); a.click(); a.remove();
    console.log('%c✓ Downloaded spritetrading-export.json', 'color:#7bd88f');
  } catch (e) {
    console.log('Download blocked — run:  copy(__export)');
  }
})();
