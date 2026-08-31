const fs = require('fs');

// Codename → Sprite ID mapping
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
};

const S4_SPRITES = ['8bit', 'adventure', 'bush', 'jonesy', 'stormscout', 'killswitch', 'shadow', 'sonic', 'tails', 'jackrabbit', 'crown', 'klombo'];

// Reverse map: sprite ID → codename
const SPRITE_TO_CODENAME = {};
for (const [cn, sid] of Object.entries(S42_CODENAME_MAP)) {
  if (sid) SPRITE_TO_CODENAME[sid] = cn;
}

function parseAthenaProfile(profileData) {
  const items = profileData?.profileChanges?.[0]?.profile?.items || {};
  const questStates = {};

  for (const [itemId, item] of Object.entries(items)) {
    const templateId = item.templateId || '';
    const questMatch = templateId.match(/^Quest:quest_s42_spritemastery_(\w+?)(?:_(01|02))?$/);
    if (questMatch) {
      const codename = questMatch[1];
      const suffix = questMatch[2] || 'base';
      const state = item.attributes?.quest_state || 'Unknown';
      if (!questStates[codename]) questStates[codename] = {};
      questStates[codename][suffix] = state;
    }
  }

  const results = {};
  for (const spriteId of S4_SPRITES) {
    const codename = SPRITE_TO_CODENAME[spriteId];
    const qs = questStates[codename] || {};

    // Suffix mapping: _01 = cheatmaster, _02 = gold
    results[spriteId] = {
      normal: {
        owned: qs.base === 'Active' || qs.base === 'Claimed',
        mastered: qs.base === 'Claimed',
      },
      gold: {
        owned: qs['02'] === 'Active' || qs['02'] === 'Claimed',
        mastered: qs['02'] === 'Claimed',
      },
      cheatmaster: {
        owned: qs['01'] === 'Active' || qs['01'] === 'Claimed',
        mastered: qs['01'] === 'Claimed',
      },
    };
  }
  return results;
}

function loadAnswerKey(keyData) {
  const sprites = keyData?.collection?.sprites || {};
  const results = {};

  for (const spriteId of S4_SPRITES) {
    // Answer key format: base = spriteId, gold = gold-<spriteId>, cheatmaster = cheatmaster-<spriteId>
    const base = sprites[spriteId];
    const gold = sprites[`gold-${spriteId}`];
    const cm = sprites[`cheatmaster-${spriteId}`];

    results[spriteId] = {
      normal: {
        owned: base?.indexed || false,
        mastered: base?.mastered || false,
      },
      gold: {
        owned: gold?.indexed || false,
        mastered: gold?.mastered || false,
      },
      cheatmaster: {
        owned: cm?.indexed || false,
        mastered: cm?.mastered || false,
      },
    };
  }
  return results;
}

// Load files
const freshProfile = JSON.parse(fs.readFileSync('./fresh_athena.json', 'utf-8'));
const answerKey = JSON.parse(fs.readFileSync('/home/deck/Downloads/spritetrading-8ccdb3aa4f (2).json', 'utf-8'));

console.log('=== S42 SPRITE CALIBRATION ===\n');
console.log('Profile timestamp:', new Date().toISOString());
console.log('Answer key exported:', answerKey.exportedAt);
console.log();

const parsed = parseAthenaProfile(freshProfile);
const expected = loadAnswerKey(answerKey);

// Compare
let matches = 0;
let total = 0;
const mismatches = [];

console.log('Sprite       | Variant     | Parser O/M    | Key O/M       | Match?');
console.log('-------------|-------------|---------------|---------------|-------');

for (const spriteId of S4_SPRITES) {
  for (const variant of ['normal', 'gold', 'cheatmaster']) {
    const p = parsed[spriteId][variant];
    const e = expected[spriteId][variant];

    const pStr = `${p.owned ? 'Y' : 'N'}/${p.mastered ? 'Y' : 'N'}`;
    const eStr = `${e.owned ? 'Y' : 'N'}/${e.mastered ? 'Y' : 'N'}`;

    const ownedMatch = p.owned === e.owned;
    const masteredMatch = p.mastered === e.mastered;
    const fullMatch = ownedMatch && masteredMatch;

    total++;
    if (fullMatch) {
      matches++;
      console.log(`${spriteId.padEnd(12)} | ${variant.padEnd(11)} | ${pStr.padEnd(13)} | ${eStr.padEnd(13)} | ✓`);
    } else {
      const issue = !ownedMatch ? 'OWNED' : 'MASTERED';
      console.log(`${spriteId.padEnd(12)} | ${variant.padEnd(11)} | ${pStr.padEnd(13)} | ${eStr.padEnd(13)} | ✗ ${issue}`);
      mismatches.push({ spriteId, variant, parser: p, expected: e, issue });
    }
  }
}

console.log();
console.log(`=== MATCH RATE: ${matches}/${total} ===`);
console.log();

if (mismatches.length > 0) {
  console.log('=== MISMATCHES ===\n');
  for (const m of mismatches) {
    console.log(`${m.spriteId} ${m.variant}:`);
    console.log(`  Parser:   owned=${m.parser.owned}, mastered=${m.parser.mastered}`);
    console.log(`  Expected: owned=${m.expected.owned}, mastered=${m.expected.mastered}`);
    console.log(`  Issue: ${m.issue} mismatch`);
    console.log();
  }
}
