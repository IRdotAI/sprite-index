/**
 * FINAL: Extract Gold and Cheatmaster ownership from athena profile
 * NO LIVE PARTY DATA NEEDED - quest states tell us everything
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

// Sprite progression quest patterns
// Format: quest_s{season}_{spritename}spriteprogression_00_complete_{variant}
const SPRITE_NAMES = [
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

function extractVariantOwnership(items) {
  const ownership = {};

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    const state = item.attributes?.quest_state;

    // Check for sprite progression quests
    // Pattern: quest_s{season}_{spritename}spriteprogression_00_complete_{gold|cheatmaster}
    if (tid.includes('spriteprogression') && tid.includes('_complete_')) {
      const isGold = tid.includes('_gold');
      const isCheatmaster = tid.includes('_cheatmaster');

      if (!isGold && !isCheatmaster) continue;

      // Extract sprite name from quest ID
      // quest_s42_crownspriteprogression_00_complete_gold -> crown
      const match = tid.match(/quest_s\d+_(\w+)spriteprogression/);
      if (match) {
        const spriteName = match[1];

        if (!ownership[spriteName]) {
          ownership[spriteName] = { gold: false, cheatmaster: false };
        }

        // "Claimed" = completed = variant unlocked
        if (state === 'Claimed') {
          if (isGold) ownership[spriteName].gold = true;
          if (isCheatmaster) ownership[spriteName].cheatmaster = true;
        }
      }
    }

    // Also check for cheatmaster sprites granted via lobby hacks
    // These might be separate cosmetic items like CosmeticMimosa:companion_X_cheatmaster
    if (tid.includes('cosmeticmimosa:') && tid.includes('cheatmaster')) {
      const match = tid.match(/companion_(\w+)_cheatmaster/);
      if (match) {
        const spriteName = match[1];
        if (!ownership[spriteName]) ownership[spriteName] = { gold: false, cheatmaster: false };
        ownership[spriteName].cheatmaster = true;
      }
    }

    // Check for gold sprite cosmetics
    if (tid.includes('cosmeticmimosa:') && tid.includes('gold')) {
      const match = tid.match(/companion_(\w+)_gold/);
      if (match) {
        const spriteName = match[1];
        if (!ownership[spriteName]) ownership[spriteName] = { gold: false, cheatmaster: false };
        ownership[spriteName].gold = true;
      }
    }
  }

  return ownership;
}

async function main() {
  const auth = await getToken();
  console.log('Logged in as:', auth.displayName);
  const token = auth.access_token;
  const accountId = auth.account_id;

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

  console.log('\n=== EXTRACTING VARIANT OWNERSHIP FROM PROFILE ===\n');

  const ownership = extractVariantOwnership(items);

  console.log('Variant ownership:');
  console.log(JSON.stringify(ownership, null, 2));

  // List all sprites owned and their mastery status
  console.log('\n=== SPRITES OWNED ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.startsWith('cosmeticmimosa:companion_') && !tid.includes('reactfx')) {
      const name = tid.split(':')[1].replace('companion_', '');
      const variants = ownership[name] || { gold: false, cheatmaster: false };

      console.log(`${name}:`);
      console.log(`  Owned: YES`);
      console.log(`  Gold: ${variants.gold ? 'YES' : 'no'}`);
      console.log(`  Cheatmaster: ${variants.cheatmaster ? 'YES' : 'no'}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Gold/CM data CAN be extracted from athena profile quests!');
  console.log('No live party session needed.');
  console.log('Check quest_s##_XspritEprogression_00_complete_gold/cheatmaster');
  console.log('If quest_state === "Claimed", user has that variant.');
}

main().catch(console.error);
