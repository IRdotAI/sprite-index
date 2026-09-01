/**
 * Extract Gold and Cheatmaster sprite ownership from quest/progression data
 * This is the key to getting ALL variants without live party data
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

// Map quest IDs to sprite names
const SPRITE_QUEST_MAP = {
  'crown': ['crownspriteprogression', 'sizetribe'],
  '8bit': ['8bit'],
  'adventure': ['dwarf'],
  'bush': ['bushranger'],
  'jonesy': ['jonesy'],
  'stormscout': ['stormscout'],
  'killswitch': ['killswitch'],
  'shadow': ['reloadovertime'],
  'sonic': ['narrowflea'],
  'tails': ['narrowfleamonkey'],
  'jackrabbit': ['doublejump'],
  'klombo': ['klombo'],
};

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

  // Find all progression quests for each sprite
  console.log('\n=== SPRITE VARIANT OWNERSHIP FROM QUESTS ===\n');

  const ownership = {};

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();

    // Check for gold/cheatmaster progression quests
    if (tid.includes('spriteprogression') || tid.includes('sprite_progression')) {
      const state = item.attributes?.quest_state;

      // Parse the quest ID
      // Format: Quest:quest_s42_crownspriteprogression_00_complete_gold
      const parts = tid.split('_');
      const isGold = tid.includes('_gold');
      const isCheatmaster = tid.includes('_cheatmaster');
      const isAcquire = tid.includes('_acquire_');
      const isComplete = tid.includes('_complete_');

      if ((isGold || isCheatmaster) && (isAcquire || isComplete)) {
        // Find which sprite this is for
        let spriteName = null;
        for (const [name, keywords] of Object.entries(SPRITE_QUEST_MAP)) {
          for (const kw of keywords) {
            if (tid.includes(kw)) {
              spriteName = name;
              break;
            }
          }
          if (spriteName) break;
        }

        if (spriteName) {
          if (!ownership[spriteName]) ownership[spriteName] = { gold: false, cheatmaster: false };

          // "Claimed" state means completed/unlocked
          if (state === 'Claimed') {
            if (isGold && isComplete) ownership[spriteName].gold = true;
            if (isCheatmaster && isComplete) ownership[spriteName].cheatmaster = true;
          }

          console.log(`${item.templateId}: ${state}`);
        }
      }
    }
  }

  // Also check for CosmeticMimosa items that might be gold/CM variants
  console.log('\n=== CHECKING COSMETIC ITEMS FOR VARIANTS ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();

    // Check for gold/cheatmaster sprite cosmetics
    if (tid.includes('cosmeticmimosa:') && (tid.includes('gold') || tid.includes('cheatmaster') || tid.includes('cheat'))) {
      console.log('FOUND VARIANT COSMETIC:', item.templateId);
      console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));

      // Parse sprite name from ID
      for (const [name, keywords] of Object.entries(SPRITE_QUEST_MAP)) {
        for (const kw of keywords) {
          if (tid.includes(kw)) {
            if (!ownership[name]) ownership[name] = { gold: false, cheatmaster: false };
            if (tid.includes('gold')) ownership[name].gold = true;
            if (tid.includes('cheatmaster') || tid.includes('cheat')) ownership[name].cheatmaster = true;
          }
        }
      }
    }
  }

  // Check for lobby hack tokens that unlock cheatmaster sprites
  console.log('\n=== LOBBY HACK TOKENS (Cheatmaster unlocks) ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();

    if (tid.includes('lobbyhack') || tid.includes('cheatcodeunlock') || tid.includes('cheat_code')) {
      console.log(item.templateId);

      // These tokens might grant access to specific cheatmaster sprites
      // Parse which sprite it's for
    }
  }

  // Also look for specific sprite mastery completion that grants variants
  console.log('\n=== MASTERY COMPLETION QUESTS ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();

    if (tid.includes('spritemastery') && item.attributes?.quest_state === 'Claimed') {
      // Check if this grants gold/CM
      for (const [name, keywords] of Object.entries(SPRITE_QUEST_MAP)) {
        for (const kw of keywords) {
          if (tid.includes(kw)) {
            // Check quest rewards in the full item data
            if (item.attributes?.premium_rewards?.rewards) {
              for (const reward of item.attributes.premium_rewards.rewards) {
                if (reward.templateId?.toLowerCase().includes('gold')) {
                  if (!ownership[name]) ownership[name] = { gold: false, cheatmaster: false };
                  ownership[name].gold = true;
                  console.log(`${name}: Gold unlocked via ${item.templateId}`);
                }
                if (reward.templateId?.toLowerCase().includes('cheatmaster')) {
                  if (!ownership[name]) ownership[name] = { gold: false, cheatmaster: false };
                  ownership[name].cheatmaster = true;
                  console.log(`${name}: Cheatmaster unlocked via ${item.templateId}`);
                }
              }
            }
          }
        }
      }
    }
  }

  console.log('\n=== FINAL OWNERSHIP SUMMARY ===\n');
  console.log(JSON.stringify(ownership, null, 2));

  // Count totals
  let goldCount = 0, cmCount = 0;
  for (const sprite of Object.values(ownership)) {
    if (sprite.gold) goldCount++;
    if (sprite.cheatmaster) cmCount++;
  }
  console.log(`\nTotal Gold variants: ${goldCount}`);
  console.log(`Total Cheatmaster variants: ${cmCount}`);
}

main().catch(console.error);
