const fs = require('fs');

// Codename → Sprite ID mapping (from index.html)
const S42_CODENAME_MAP = {
  '8bit': '8bit',
  'dwarf': 'adventure',
  'bushranger': 'bush',
  'jonesy': 'jonesy',
  'stormscout': 'stormscout',
  'killswitch': 'killswitch',
  'reloadovertime': 'shadow',
  'narrowflea': 'sonic',
  'narrowfleamonkey': 'tails',
  'doublejump': 'jackrabbit',
  'crown': 'crown',
  'klombo': 'klombo',
  // Unmapped codenames found in quests - need to resolve
  'consumableoverdrive': null,
  'overshield': null,
  'squibbly': null,
};

// All known S4 sprites
const S4_SPRITES = ['8bit', 'adventure', 'bush', 'jonesy', 'stormscout', 'killswitch', 'shadow', 'sonic', 'tails', 'jackrabbit', 'crown', 'klombo'];

function parseS42Sprites(athenaProfile) {
  const items = athenaProfile?.profileChanges?.[0]?.profile?.items || {};

  const results = {};
  const questStates = {};
  const tokenPresent = {};

  // Scan all items for S42 sprite quests and tokens
  for (const [itemId, item] of Object.entries(items)) {
    const templateId = item.templateId || '';

    // Quest: quest_s42_spritemastery_<codename>[_01|_02]
    const questMatch = templateId.match(/^Quest:quest_s42_spritemastery_(\w+?)(?:_(01|02))?$/);
    if (questMatch) {
      const codename = questMatch[1];
      const suffix = questMatch[2] || 'base'; // base, 01 (gold), 02 (cheatmaster)
      const state = item.attributes?.quest_state || 'Unknown';

      if (!questStates[codename]) questStates[codename] = {};
      questStates[codename][suffix] = state;
    }

    // Token: athena_s42_spritemastery_token_<codename>[_01|_02]
    const tokenMatch = templateId.match(/^Token:athena_s42_spritemastery_token_(\w+?)(?:_(01|02))?$/);
    if (tokenMatch) {
      const codename = tokenMatch[1];
      const suffix = tokenMatch[2] || 'base';

      if (!tokenPresent[codename]) tokenPresent[codename] = {};
      tokenPresent[codename][suffix] = true;
    }
  }

  console.log('=== RAW QUEST STATES ===\n');
  for (const [codename, states] of Object.entries(questStates).sort()) {
    const spriteId = S42_CODENAME_MAP[codename];
    const mapped = spriteId ? `→ ${spriteId}` : '(UNMAPPED)';
    console.log(`${codename} ${mapped}`);
    console.log(`  base: ${states.base || '-'}, gold(_01): ${states['01'] || '-'}, cm(_02): ${states['02'] || '-'}`);
    console.log(`  tokens: base=${tokenPresent[codename]?.base || false}, gold=${tokenPresent[codename]?.['01'] || false}, cm=${tokenPresent[codename]?.['02'] || false}`);
  }

  console.log('\n=== DERIVED SPRITE STATE ===\n');

  // Derive owned/mastered for each sprite
  for (const spriteId of S4_SPRITES) {
    // Find the codename for this sprite
    let codename = null;
    for (const [cn, sid] of Object.entries(S42_CODENAME_MAP)) {
      if (sid === spriteId) { codename = cn; break; }
    }

    if (!codename) {
      console.log(`${spriteId}: NO CODENAME FOUND`);
      results[spriteId] = { owned: false, mastered: false, goldOwned: false, goldMastered: false, cmOwned: false, cmMastered: false };
      continue;
    }

    const qs = questStates[codename] || {};
    const tk = tokenPresent[codename] || {};

    // OWNERSHIP LOGIC:
    // - Base sprite owned = base quest exists (Active or Claimed)
    // - Base sprite mastered = base quest Claimed
    // - Gold owned = _01 quest exists (Active or Claimed)
    // - Gold mastered = _01 quest Claimed
    // - CM owned = _02 quest exists (Active or Claimed)
    // - CM mastered = _02 quest Claimed

    const baseOwned = qs.base === 'Active' || qs.base === 'Claimed';
    const baseMastered = qs.base === 'Claimed';
    const goldOwned = qs['01'] === 'Active' || qs['01'] === 'Claimed';
    const goldMastered = qs['01'] === 'Claimed';
    const cmOwned = qs['02'] === 'Active' || qs['02'] === 'Claimed';
    const cmMastered = qs['02'] === 'Claimed';

    results[spriteId] = {
      codename,
      normal: { owned: baseOwned, mastered: baseMastered },
      gold: { owned: goldOwned, mastered: goldMastered },
      cheatmaster: { owned: cmOwned, mastered: cmMastered },
    };

    const ownedStr = baseOwned ? '✓ OWNED' : '✗ not owned';
    const masteredStr = baseMastered ? '(mastered)' : '';
    const goldStr = goldOwned ? (goldMastered ? 'Gold✓M' : 'Gold✓') : '';
    const cmStr = cmOwned ? (cmMastered ? 'CM✓M' : 'CM✓') : '';

    console.log(`${spriteId.padEnd(12)} ${ownedStr} ${masteredStr} ${goldStr} ${cmStr}`);
  }

  return results;
}

// Load profile
const dumpPath = './collectionbook_dump.json';
if (!fs.existsSync(dumpPath)) {
  console.error('collectionbook_dump.json not found');
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
const athenaProfile = dump.profiles?.athena?.data;

if (!athenaProfile) {
  console.error('No athena profile in dump');
  process.exit(1);
}

console.log(`Account: ${dump.displayName} (${dump.accountId})\n`);

const results = parseS42Sprites(athenaProfile);

console.log('\n=== SUMMARY TABLE ===\n');
console.log('Sprite       | Normal      | Gold        | Cheatmaster');
console.log('-------------|-------------|-------------|-------------');
for (const sprite of S4_SPRITES) {
  const r = results[sprite];
  const norm = r.normal?.owned ? (r.normal?.mastered ? 'Mastered' : 'Owned') : '-';
  const gold = r.gold?.owned ? (r.gold?.mastered ? 'Mastered' : 'Owned') : '-';
  const cm = r.cheatmaster?.owned ? (r.cheatmaster?.mastered ? 'Mastered' : 'Owned') : '-';
  console.log(`${sprite.padEnd(12)} | ${norm.padEnd(11)} | ${gold.padEnd(11)} | ${cm}`);
}

// Save results
fs.writeFileSync('./s42_sprites_parsed.json', JSON.stringify(results, null, 2));
console.log('\nSaved to s42_sprites_parsed.json');
