/**
 * Dump complete sprite item data to find gold/CM storage
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

  console.log('\n=== ALL COMPANION/SPRITE ITEMS (FULL DUMP) ===\n');

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.includes('cosmeticmimosa:companion_') && !tid.includes('reactfx')) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`ID: ${id}`);
      console.log(`Template: ${item.templateId}`);
      console.log(`Full item:`);
      console.log(JSON.stringify(item, null, 2));
    }
  }

  // Also dump all CosmeticMimosaC (particle effects) items
  console.log('\n=== PARTICLE EFFECT ITEMS ===\n');
  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '').toLowerCase();
    if (tid.includes('cosmeticmimosac:')) {
      console.log(`\n${item.templateId}:`);
      console.log(JSON.stringify(item, null, 2));
    }
  }

  // Check if there's any item that tracks gold/CM ownership separately
  console.log('\n=== SEARCHING FOR GOLD/CM TRACKING ===\n');

  const keywords = ['gold', 'cheat', 'master', 'premium', 'material', 'variant', 'unlock', 'grant'];

  for (const [id, item] of Object.entries(items)) {
    const tidLower = (item.templateId || '').toLowerCase();
    const attrJson = JSON.stringify(item.attributes || {}).toLowerCase();

    for (const kw of keywords) {
      if (tidLower.includes(kw) || attrJson.includes(kw)) {
        if (tidLower.includes('companion') || tidLower.includes('mimosa')) {
          console.log(`Match "${kw}" in:`, item.templateId);
          console.log('  Attributes:', JSON.stringify(item.attributes, null, 2).substring(0, 500));
        }
      }
    }
  }
}

main().catch(console.error);
