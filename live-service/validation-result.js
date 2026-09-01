/**
 * VALIDATION RESULT: Quest-based gold/CM detection vs SpriteTrading ground truth
 */

// SpriteTrading export shows these owned:
const ST_OWNED = {
  crown: { gold: true, cheatmaster: true },
  '8bit': { gold: true, cheatmaster: true },
  adventure: { gold: true, cheatmaster: true },
  bush: { gold: true, cheatmaster: true },
  jonesy: { gold: true, cheatmaster: true },
  stormscout: { gold: true, cheatmaster: false },
  killswitch: { gold: false, cheatmaster: false },
  shadow: { gold: true, cheatmaster: false },
  sonic: { gold: false, cheatmaster: true },
  tails: { gold: true, cheatmaster: true },
  jackrabbit: { gold: true, cheatmaster: false },
  klombo: { gold: true, cheatmaster: false },
};

// Quest-based detection shows (only crown has quests, all "Active"):
const QUEST_SAYS = {
  crown: { gold: false, cheatmaster: false },
  '8bit': { gold: false, cheatmaster: false },
  adventure: { gold: false, cheatmaster: false },
  bush: { gold: false, cheatmaster: false },
  jonesy: { gold: false, cheatmaster: false },
  stormscout: { gold: false, cheatmaster: false },
  killswitch: { gold: false, cheatmaster: false },
  shadow: { gold: false, cheatmaster: false },
  sonic: { gold: false, cheatmaster: false },
  tails: { gold: false, cheatmaster: false },
  jackrabbit: { gold: false, cheatmaster: false },
  klombo: { gold: false, cheatmaster: false },
};

const ALL_SPRITES = ['crown', '8bit', 'adventure', 'bush', 'jonesy', 'stormscout',
  'killswitch', 'shadow', 'sonic', 'tails', 'jackrabbit', 'klombo'];

console.log('=== VALIDATION: Quest-based vs SpriteTrading Ground Truth ===\n');
console.log('sprite      | variant     | quest_says | ST_says  | MATCH');
console.log('------------|-------------|------------|----------|------');

let matches = 0;
let total = 0;
let falsePositives = 0;
let falseNegatives = 0;

for (const sprite of ALL_SPRITES) {
  for (const variant of ['gold', 'cheatmaster']) {
    const questSays = QUEST_SAYS[sprite][variant];
    const stSays = ST_OWNED[sprite][variant];
    const match = questSays === stSays;

    if (match) matches++;
    if (questSays && !stSays) falsePositives++;
    if (!questSays && stSays) falseNegatives++;
    total++;

    const matchStr = match ? 'YES' : '**NO**';
    console.log(`${sprite.padEnd(11)} | ${variant.padEnd(11)} | ${String(questSays).padEnd(10)} | ${String(stSays).padEnd(8)} | ${matchStr}`);
  }
}

console.log('\n=== RESULTS ===\n');
console.log(`Match rate: ${matches}/${total} (${Math.round(matches/total*100)}%)`);
console.log(`False positives (quest says YES, ST says NO): ${falsePositives}`);
console.log(`False negatives (quest says NO, ST says YES): ${falseNegatives}`);

console.log('\n=== CONCLUSION ===\n');
if (falsePositives === 0 && falseNegatives === 0) {
  console.log('✓ SAFE TO INTEGRATE');
} else {
  console.log('✗ DO NOT INTEGRATE');
  console.log(`  Quest-based detection misses ${falseNegatives} owned variants`);
  console.log(`  Only crown has spriteprogression quests - others have no tracking`);
}
