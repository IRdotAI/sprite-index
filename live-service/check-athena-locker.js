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
  console.log('Account:', auth.displayName, '\n');
  const token = auth.access_token;
  const accountId = auth.account_id;

  const res = await fetch(
    `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=athena&rvn=-1`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}'
    }
  );
  const athena = await res.json();
  const items = athena.profileChanges?.[0]?.profile?.items || {};

  // Look for CosmeticsLocker items (preset loadouts)
  console.log('=== LOOKING FOR LOADOUT PRESETS ===\n');
  
  for (const [id, item] of Object.entries(items)) {
    const tid = item.templateId || '';
    if (tid.includes('CosmeticsLocker') || tid.includes('Loadout') || tid.includes('Preset')) {
      console.log(`${tid}:`);
      const slots = item.attributes?.locker_slots_data?.slots;
      if (slots) {
        // Check for companion/sprite slot
        for (const [slot, data] of Object.entries(slots)) {
          if (slot.toLowerCase().includes('compan') || slot.toLowerCase().includes('sprite') || 
              slot.toLowerCase().includes('mimosa') || JSON.stringify(data).toLowerCase().includes('companion')) {
            console.log(`  ${slot}: ${JSON.stringify(data)}`);
          }
        }
      }
    }
  }

  // Also check for active_loadout_index or similar
  const stats = athena.profileChanges?.[0]?.profile?.stats?.attributes || {};
  console.log('\n=== ACTIVE LOADOUT INDEX ===');
  for (const [key, val] of Object.entries(stats)) {
    if (key.toLowerCase().includes('loadout') || key.toLowerCase().includes('active') ||
        key.toLowerCase().includes('selected') || key.toLowerCase().includes('current')) {
      console.log(`${key}: ${JSON.stringify(val)}`);
    }
  }
}

main().catch(console.error);
