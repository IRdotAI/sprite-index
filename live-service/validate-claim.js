/**
 * VALIDATION: Compare quest-based gold/CM detection against SpriteTrading answer key
 */

require('dotenv').config({ path: '.env' });

const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const ANDROID_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';

const EPIC_AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
const FORTNITE_BASE = 'https://fortnite-public-service-prod11.ol.epicgames.com';

const DEVICE_AUTH = {
  account_id: process.env.ACCOUNT_ID,
  device_id: process.env.DEVICE_ID,
  secret: process.env.SECRET
};

// All 12 sprites
const ALL_SPRITES = [
  'crown', '8bit', 'adventure', 'bush', 'jonesy', 'stormscout',
  'killswitch', 'shadow', 'sonic', 'tails', 'jackrabbit', 'klombo'
];

async function getToken() {
  const basicAuth = Buffer.from(`${ANDROID_CLIENT_ID}:${ANDROID_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${EPIC_AUTH_BASE}/account/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=device_auth&account_id=${DEVICE_AUTH.account_id}&device_id=${DEVICE_AUTH.device_id}&secret=${encodeURIComponent(DEVICE_AUTH.secret)}`
  });
  return await res.json();
}

async function main() {
  const auth = await getToken();
  console.log('Account:', auth.displayName);
  console.log('Account ID:', auth.account_id);
  const token = auth.access_token;
  const accountId = auth.account_id;

  // 1. Get athena profile
  const res = await fetch(
    `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=athena&rvn=-1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }
  );

  const athena = await res.json();
  const items = athena.profileChanges?.[0]?.profile?.items || {};

  console.log('\n=== STEP 1: ALL SPRITEPROGRESSION QUESTS ===\n');

  // Find ALL spriteprogression quests for gold and cheatmaster
  const questResults = [];

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();

    if (tid.includes('spriteprogression') &&
        (tid.includes('_complete_gold') || tid.includes('_complete_cheatmaster'))) {

      const isGold = tid.includes('_gold');
      const variant = isGold ? 'gold' : 'cheatmaster';
      const state = item.attributes?.quest_state || 'unknown';

      // Extract sprite name
      const match = tid.match(/quest_s\d+_(\w+)spriteprogression/);
      const spriteName = match ? match[1] : 'unknown';

      questResults.push({
        templateId: item.templateId,
        sprite: spriteName,
        variant,
        state,
        owned: state === 'Claimed'
      });

      console.log(`${item.templateId}`);
      console.log(`  Sprite: ${spriteName}, Variant: ${variant}, State: ${state}`);
    }
  }

  console.log(`\nFound ${questResults.length} spriteprogression gold/CM quests`);

  // 2. Derive ownership map
  console.log('\n=== STEP 2: DERIVED OWNERSHIP ===\n');

  const questOwnership = {};
  for (const sprite of ALL_SPRITES) {
    questOwnership[sprite] = { gold: false, cheatmaster: false };
  }

  for (const q of questResults) {
    if (questOwnership[q.sprite]) {
      questOwnership[q.sprite][q.variant] = q.owned;
    }
  }

  console.log('Quest-derived ownership:');
  for (const [sprite, variants] of Object.entries(questOwnership)) {
    console.log(`  ${sprite}: gold=${variants.gold}, cm=${variants.cheatmaster}`);
  }

  // 3. Get SpriteTrading answer key
  console.log('\n=== STEP 3: FETCHING SPRITETRADING DATA ===\n');

  // We need to fetch the user's data from spritetrading
  // The endpoint appears to be: https://api.spritetrading.com/user/{epicId} or similar
  // Let me try to find their API

  let stData = null;
  const stEndpoints = [
    `https://api.spritetrading.com/v1/user/${accountId}`,
    `https://api.spritetrading.com/user/${accountId}`,
    `https://spritetrading.com/api/user/${accountId}`,
    `https://spritetrading.com/api/v1/sprites/${accountId}`,
  ];

  for (const ep of stEndpoints) {
    try {
      const stRes = await fetch(ep, {
        headers: { 'Accept': 'application/json' }
      });
      if (stRes.ok) {
        stData = await stRes.json();
        console.log(`Found data at: ${ep}`);
        break;
      } else {
        console.log(`${ep}: ${stRes.status}`);
      }
    } catch (e) {
      console.log(`${ep}: ERROR - ${e.message}`);
    }
  }

  if (!stData) {
    console.log('\nCould not fetch SpriteTrading data via API.');
    console.log('Please provide your SpriteTrading export manually.');
    console.log('\nTo get it:');
    console.log('1. Go to spritetrading.com');
    console.log('2. Log in and view your profile');
    console.log('3. Export or screenshot your gold/CM variants');
    console.log('\nOr paste the raw JSON if you have API access.');

    // Output the quest data for manual comparison
    console.log('\n=== QUEST DATA FOR MANUAL COMPARISON ===\n');
    console.log('sprite,variant,quest_says_owned');
    for (const sprite of ALL_SPRITES) {
      console.log(`${sprite},gold,${questOwnership[sprite].gold}`);
      console.log(`${sprite},cheatmaster,${questOwnership[sprite].cheatmaster}`);
    }
    return;
  }

  // 4. Compare
  console.log('\n=== STEP 4: COMPARISON TABLE ===\n');

  const stOwnership = {};
  // Parse ST data - structure depends on their API format
  // This is a placeholder - need actual ST data structure

  console.log('sprite | variant | quest_says | key_says | MATCH');
  console.log('-------|---------|------------|----------|------');

  let matches = 0;
  let total = 0;
  let falsePositives = 0;

  for (const sprite of ALL_SPRITES) {
    for (const variant of ['gold', 'cheatmaster']) {
      const questSays = questOwnership[sprite][variant];
      const keySays = stOwnership[sprite]?.[variant] || false;
      const match = questSays === keySays;

      if (match) matches++;
      if (questSays && !keySays) falsePositives++;
      total++;

      console.log(`${sprite.padEnd(7)} | ${variant.padEnd(7)} | ${String(questSays).padEnd(10)} | ${String(keySays).padEnd(8)} | ${match ? 'YES' : '**NO**'}`);
    }
  }

  console.log('\n=== STEP 5: RESULTS ===\n');
  console.log(`Match rate: ${matches}/${total} (${Math.round(matches/total*100)}%)`);
  console.log(`False positives: ${falsePositives}`);

  if (falsePositives === 0) {
    console.log('\n✓ SAFE TO INTEGRATE');
  } else {
    console.log('\n✗ DO NOT INTEGRATE - FALSE POSITIVES DETECTED');
  }
}

main().catch(console.error);
