/**
 * Search for ALL gold/cheatmaster items in the profile
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

  console.log('\n=== SEARCHING FOR GOLD/CM IN ALL ITEMS ===\n');

  // Search ALL items for gold/cheatmaster references
  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '');
    const tidLower = tid.toLowerCase();
    const attrJson = JSON.stringify(item.attributes || {}).toLowerCase();
    const fullJson = JSON.stringify(item).toLowerCase();

    // Check both templateId and attributes
    if (fullJson.includes('gold_sprite') || fullJson.includes('goldsprite') ||
        fullJson.includes('cheatmaster') || fullJson.includes('cheat_master') ||
        tidLower.includes('cm_') || tidLower.includes('_cm') ||
        (tidLower.includes('gold') && tidLower.includes('companion'))) {
      console.log('\nFOUND:', tid);
      console.log(JSON.stringify(item, null, 2).substring(0, 800));
    }
  }

  // Search specifically for crown sprite gold/CM items
  console.log('\n=== CROWN SPRITE SPECIFIC ===\n');

  const crownKeywords = ['sizetribe', 'crown'];
  for (const [id, item] of Object.entries(items)) {
    const fullJson = JSON.stringify(item).toLowerCase();

    for (const kw of crownKeywords) {
      if (fullJson.includes(kw) &&
          (fullJson.includes('gold') || fullJson.includes('cheat') || fullJson.includes('master'))) {
        console.log('\nCROWN RELATED:', item.templateId);
        console.log(JSON.stringify(item, null, 2).substring(0, 600));
      }
    }
  }

  // List ALL CosmeticMimosa items (the sprite type)
  console.log('\n=== ALL SPRITE (CosmeticMimosa) ITEMS ===\n');

  for (const [id, item] of Object.entries(items)) {
    if (item.templateId?.toLowerCase().includes('cosmeticmimosa:')) {
      console.log(item.templateId);
    }
  }
}

main().catch(console.error);
