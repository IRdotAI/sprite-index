/**
 * Find ALL possible gold/CM tracking mechanisms in the profile
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

  // Search for ANY item containing gold/cheatmaster references
  console.log('\n=== ALL ITEMS WITH GOLD/CHEATMASTER REFERENCES ===\n');

  const keywords = ['_gold', 'gold_', 'cheatmaster', 'cheat_master', '_cm_', 'cm_sprite'];

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    const fullJson = JSON.stringify(item).toLowerCase();

    for (const kw of keywords) {
      if (fullJson.includes(kw)) {
        console.log(`\n${item.templateId}:`);
        console.log(`  State: ${item.attributes?.quest_state || 'n/a'}`);
        console.log(`  Match: "${kw}"`);
        break;
      }
    }
  }

  // List ALL quests containing sprite names
  console.log('\n=== ALL SPRITE-RELATED QUESTS ===\n');

  const spriteKeywords = ['crown', 'sizetribe', '8bit', 'dwarf', 'adventure', 'bush', 'bushranger',
    'jonesy', 'stormscout', 'killswitch', 'shadow', 'reloadovertime', 'sonic', 'narrowflea',
    'tails', 'narrowfleamonkey', 'jackrabbit', 'doublejump', 'klombo'];

  const spriteQuests = {};

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();

    if (!tid.startsWith('quest:')) continue;

    for (const kw of spriteKeywords) {
      if (tid.includes(kw)) {
        if (!spriteQuests[kw]) spriteQuests[kw] = [];
        spriteQuests[kw].push({
          templateId: item.templateId,
          state: item.attributes?.quest_state
        });
        break;
      }
    }
  }

  for (const [sprite, quests] of Object.entries(spriteQuests)) {
    console.log(`\n${sprite} (${quests.length} quests):`);
    for (const q of quests) {
      // Highlight gold/CM quests
      const isGoldCM = q.templateId.toLowerCase().includes('gold') ||
                       q.templateId.toLowerCase().includes('cheatmaster');
      console.log(`  ${isGoldCM ? '*** ' : ''}${q.templateId}: ${q.state}`);
    }
  }

  // Check for cosmetic items that ARE gold/CM variants
  console.log('\n=== COSMETIC ITEMS (CosmeticMimosa) ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.includes('cosmeticmimosa:')) {
      console.log(item.templateId);
      // Check if name contains gold/cm
      if (tid.includes('gold') || tid.includes('cheat')) {
        console.log('  ^^^ GOLD/CM VARIANT ITEM');
      }
    }
  }

  // Search stats for any gold/CM tracking
  console.log('\n=== STATS ATTRIBUTES ===\n');

  const stats = athena.profileChanges?.[0]?.profile?.stats?.attributes || {};
  const statsJson = JSON.stringify(stats).toLowerCase();

  if (statsJson.includes('gold') || statsJson.includes('cheat')) {
    console.log('Found gold/cheat references in stats:');
    for (const [key, val] of Object.entries(stats)) {
      const valJson = JSON.stringify(val).toLowerCase();
      if (valJson.includes('gold') || valJson.includes('cheat')) {
        console.log(`  ${key}: ${JSON.stringify(val).substring(0, 200)}`);
      }
    }
  } else {
    console.log('No gold/cheat references in stats');
  }
}

main().catch(console.error);
