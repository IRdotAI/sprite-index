/**
 * Try to get sprite loadout data for users who might be offline
 * Exploring cloud storage, profile data, and other persistent sources
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

  // 1. Check athena profile for loadout slots
  console.log('\n=== ATHENA PROFILE LOADOUTS ===\n');

  const athenaRes = await fetch(
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

  if (athenaRes.ok) {
    const athena = await athenaRes.json();
    const items = athena.profileChanges?.[0]?.profile?.items || {};
    const stats = athena.profileChanges?.[0]?.profile?.stats?.attributes || {};

    // Look for loadout data
    console.log('Stats keys:', Object.keys(stats).filter(k =>
      k.includes('loadout') || k.includes('favorite') || k.includes('companion')
    ));

    // Check favorite_companion (might store sprite loadouts)
    if (stats.favorite_companion) {
      console.log('\nfavorite_companion:', stats.favorite_companion);
    }

    // Search items for loadout slots
    let loadoutItems = [];
    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('cosmeticlocker') || tid.includes('loadout')) {
        loadoutItems.push({ id, templateId: item.templateId, attrs: item.attributes });
      }
    }

    if (loadoutItems.length > 0) {
      console.log('\nLoadout items found:', loadoutItems.length);

      for (const item of loadoutItems.slice(0, 5)) {
        console.log(`\n${item.templateId}:`);

        // Check locker_slots_data for companion/sprite slot
        const lockerSlots = item.attrs?.locker_slots_data?.slots || {};
        for (const [slotName, slotData] of Object.entries(lockerSlots)) {
          if (slotName.toLowerCase().includes('companion') ||
              slotName.toLowerCase().includes('pet') ||
              slotName.toLowerCase().includes('mascot')) {
            console.log(`  ${slotName}:`, JSON.stringify(slotData, null, 2));
          }
        }

        // Look for any companion references
        const attrJson = JSON.stringify(item.attrs);
        if (attrJson.toLowerCase().includes('companion')) {
          const matches = attrJson.match(/companion[^"]*"/gi) || [];
          console.log('  Companion refs:', [...new Set(matches)].slice(0, 5));
        }
      }
    }

    // Check for BlockStack items (sprites)
    console.log('\n=== BLOCKSTACK/SPRITE ITEMS ===\n');

    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('blockstack') || tid.includes('companion') || tid.includes('sprite')) {
        console.log(`${item.templateId}:`);
        console.log('  Attributes:', JSON.stringify(item.attributes, null, 2).substring(0, 300));
      }
    }
  }

  // 2. Check cloud storage for client settings
  console.log('\n=== CLOUD STORAGE ===\n');

  const cloudRes = await fetch(
    `${FORTNITE_BASE}/fortnite/api/cloudstorage/user/${accountId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (cloudRes.ok) {
    const files = await cloudRes.json();
    console.log('Files:', files.map(f => f.filename));

    // ClientSettings might have loadout data
    const settingsFile = files.find(f => f.filename === 'ClientSettings.Sav');
    if (settingsFile) {
      const fileRes = await fetch(
        `${FORTNITE_BASE}/fortnite/api/cloudstorage/user/${accountId}/${settingsFile.uniqueFilename}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (fileRes.ok) {
        const buf = await fileRes.arrayBuffer();
        const content = new TextDecoder('utf-8', { fatal: false }).decode(buf);

        // Search for companion/sprite references in binary
        const companionMatches = content.match(/companion[a-z_0-9]+/gi) || [];
        console.log('\nCompanion refs in ClientSettings:', [...new Set(companionMatches)].slice(0, 10));
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('The loadout data in athena profile stores WHICH sprite is equipped,');
  console.log('but NOT the variant channels (gold/cheatmaster).');
  console.log('Variant info is only in live party session data.');
}

main().catch(console.error);
