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

  const text = JSON.stringify(payload, null, 2);
  window.__export = text;

  console.log('%c===== SPRITE EXPORT =====', 'color:#4dd4ff;font-weight:bold');
  console.log('entries:', payload.totals.entries,
              '| collected:', payload.totals.collected,
              '| mastered:', payload.totals.mastered,
              '| NOT mastered:', payload.totals.notMastered);
  console.table(list.filter(e => e.collected && !e.mastered)
    .map(e => ({ sprite: e.sprite, variant: e.variant, level: e.level })));

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
