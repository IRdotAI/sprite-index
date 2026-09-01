/**
 * Find sprite mastery data - Gold and Cheatmaster unlocks
 * These are unlocked through mastery progression and special codes
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
  console.log('Logged in as:', auth.displayName);
  const token = auth.access_token;
  const accountId = auth.account_id;

  // Query athena profile
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
  const stats = athena.profileChanges?.[0]?.profile?.stats?.attributes || {};

  console.log('\n=== SPRITE ITEMS WITH LEVEL/MASTERY ===\n');

  // Find all sprite items
  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.includes('cosmeticmimosa:companion_') && !tid.includes('reactfx')) {
      console.log(`${item.templateId}:`);
      console.log(`  Level: ${item.attributes?.level || 0}`);
      console.log(`  item_seen: ${item.attributes?.item_seen}`);

      // Check all attributes
      for (const [key, val] of Object.entries(item.attributes || {})) {
        if (key !== 'variants' && key !== 'creation_time' && key !== 'level' && key !== 'item_seen') {
          console.log(`  ${key}: ${JSON.stringify(val)}`);
        }
      }

      // Check for mastered flag or similar
      if (item.attributes?.mastered) console.log('  MASTERED: true');
      if (item.attributes?.gold) console.log('  GOLD: true');
      if (item.attributes?.cheatmaster) console.log('  CHEATMASTER: true');
    }
  }

  // Search for mastery-related items
  console.log('\n=== SPRITE MASTERY QUESTS/TOKENS ===\n');

  const masteryItems = [];
  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.includes('spritemastery') || tid.includes('sprite_mastery')) {
      masteryItems.push({ id, templateId: item.templateId, attributes: item.attributes });
    }
  }

  // Group by type
  const quests = masteryItems.filter(i => i.templateId.toLowerCase().startsWith('quest:'));
  const tokens = masteryItems.filter(i => i.templateId.toLowerCase().startsWith('token:'));

  console.log(`Found ${quests.length} sprite mastery quests`);
  console.log(`Found ${tokens.length} sprite mastery tokens`);

  // Show claimed quests
  console.log('\n=== CLAIMED MASTERY QUESTS ===\n');
  for (const q of quests) {
    if (q.attributes?.quest_state === 'Claimed') {
      console.log(`${q.templateId}`);
    }
  }

  // Show tokens (these might indicate what's unlocked)
  console.log('\n=== MASTERY TOKENS OWNED ===\n');
  for (const t of tokens) {
    console.log(`${t.templateId}`);
  }

  // Check for cheatmaster or gold specific items
  console.log('\n=== CHEATMASTER/GOLD SPECIFIC ITEMS ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    const attrJson = JSON.stringify(item.attributes || {}).toLowerCase();

    if (tid.includes('cheatmaster') || tid.includes('cheat_master') ||
        attrJson.includes('cheatmaster') || attrJson.includes('cheat_master')) {
      console.log('CHEATMASTER:', item.templateId);
      console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
    }

    if ((tid.includes('gold') && tid.includes('companion')) ||
        (attrJson.includes('gold') && tid.includes('companion'))) {
      console.log('GOLD:', item.templateId);
      console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
    }
  }

  // Check stats for sprite-related data
  console.log('\n=== STATS RELATED TO SPRITES ===\n');

  for (const [key, value] of Object.entries(stats)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('sprite') || keyLower.includes('companion') ||
        keyLower.includes('mastery') || keyLower.includes('mimosa')) {
      console.log(`${key}:`, typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
    }
  }

  // Look for lobby hack codes applied
  console.log('\n=== LOBBY HACK / CHEAT CODES ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.includes('lobbyhack') || tid.includes('lobby_hack') ||
        tid.includes('cheatcode') || tid.includes('cheat_code') ||
        tid.includes('hackreward') || tid.includes('hack_reward')) {
      console.log(item.templateId);
      console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
    }
  }
}

main().catch(console.error);
