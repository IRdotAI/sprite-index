/**
 * Deep dive to find ALL sprite variant ownership data
 * Looking for where gold/CM ownership is stored persistently
 */

require('dotenv').config({ path: '.env' });

const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const ANDROID_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';

const EPIC_AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
const FORTNITE_BASE = 'https://fortnite-public-service-prod11.ol.epicgames.com';
const PARTY_BASE = 'https://party-service-prod.ol.epicgames.com';

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

async function queryProfile(token, accountId, profileId) {
  const res = await fetch(
    `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=${profileId}&rvn=-1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }
  );
  if (!res.ok) return null;
  return await res.json();
}

async function main() {
  const auth = await getToken();
  console.log('Logged in as:', auth.displayName);
  const token = auth.access_token;
  const accountId = auth.account_id;

  // 1. Check collections profile for sprite data
  console.log('\n=== COLLECTIONS PROFILE ===\n');
  const collections = await queryProfile(token, accountId, 'collections');
  if (collections) {
    const items = collections.profileChanges?.[0]?.profile?.items || {};

    // Look for any companion/sprite related items
    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('companion') || tid.includes('sprite') || tid.includes('blockstack')) {
        console.log(`\n${item.templateId}:`);
        console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
      }
    }
  }

  // 2. Check athena profile - look at ALL locker presets
  console.log('\n=== ATHENA LOCKER PRESETS ===\n');
  const athena = await queryProfile(token, accountId, 'athena');
  if (athena) {
    const items = athena.profileChanges?.[0]?.profile?.items || {};
    const stats = athena.profileChanges?.[0]?.profile?.stats?.attributes || {};

    // Check loadout_shuffles or any variant storage
    console.log('Stats with "variant" or "companion":',
      Object.keys(stats).filter(k =>
        k.includes('variant') || k.includes('companion') || k.includes('loadout')
      )
    );

    // Look at cosmetic locker items for variant channels
    let lockerCount = 0;
    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('cosmeticlocker')) {
        lockerCount++;
        const slots = item.attributes?.locker_slots_data?.slots || {};

        // Check if there's a companion/mascot slot with variants
        for (const [slotName, slotData] of Object.entries(slots)) {
          if (slotName.toLowerCase().includes('companion') ||
              slotName.toLowerCase().includes('mascot') ||
              slotName.toLowerCase().includes('pet')) {
            console.log(`\nLocker ${id} - ${slotName}:`);
            console.log(JSON.stringify(slotData, null, 2));
          }
        }

        // Also check itemToSlot for any variant references
        const itemToSlot = item.attributes?.itemToSlot || {};
        for (const [itemId, slot] of Object.entries(itemToSlot)) {
          if (itemId.toLowerCase().includes('companion')) {
            console.log(`\nitemToSlot: ${itemId} -> ${slot}`);
          }
        }
      }
    }
    console.log(`\nTotal locker presets: ${lockerCount}`);

    // Look for AthenaCosmeticItem entries for companions
    console.log('\n=== COMPANION COSMETIC ITEMS ===\n');
    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('athenacompanion') || tid.includes('companion_')) {
        console.log(`\n${item.templateId}:`);
        console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));

        // THIS IS KEY - check for variants array
        if (item.attributes?.variants) {
          console.log('  VARIANTS FOUND:', JSON.stringify(item.attributes.variants, null, 2));
        }
      }
    }
  }

  // 3. Check common_core for purchases/grants
  console.log('\n=== COMMON_CORE (Purchases) ===\n');
  const commonCore = await queryProfile(token, accountId, 'common_core');
  if (commonCore) {
    const items = commonCore.profileChanges?.[0]?.profile?.items || {};

    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('companion') || tid.includes('sprite')) {
        console.log(`\n${item.templateId}:`);
        console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
      }
    }
  }

  // 4. Check br_social profile
  console.log('\n=== BR_SOCIAL PROFILE ===\n');
  const brSocial = await queryProfile(token, accountId, 'br_social');
  if (brSocial) {
    const items = brSocial.profileChanges?.[0]?.profile?.items || {};
    const stats = brSocial.profileChanges?.[0]?.profile?.stats?.attributes || {};

    console.log('Stats keys:', Object.keys(stats).slice(0, 20));

    // Look for sprite/companion related data
    for (const [id, item] of Object.entries(items)) {
      const tid = (item.templateId || '').toLowerCase();
      if (tid.includes('companion') || tid.includes('sprite') || tid.includes('creature')) {
        console.log(`\n${item.templateId}:`);
        console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
      }
    }
  }

  // 5. Try the party locker endpoint directly
  console.log('\n=== PARTY LOCKER ENDPOINT ===\n');
  try {
    const lockerRes = await fetch(
      `${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}/pings/self`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('Pings self:', lockerRes.status);
    if (lockerRes.ok) {
      const data = await lockerRes.json();
      console.log(JSON.stringify(data, null, 2));
    }
  } catch(e) {
    console.log('Error:', e.message);
  }

  // 6. Try presence service for extended data
  console.log('\n=== PRESENCE SERVICE ===\n');
  try {
    const presenceRes = await fetch(
      `https://presence-public-service-prod.ol.epicgames.com/presence/api/v1/_/${accountId}/settings`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('Presence settings:', presenceRes.status);
  } catch(e) {}

  // 7. Check for MCP operations that might query variants
  console.log('\n=== TRYING MCP OPERATIONS ===\n');

  // QueryPublicProfile might have different data
  try {
    const publicRes = await fetch(
      `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/public/QueryPublicProfile?profileId=athena`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      }
    );
    console.log('QueryPublicProfile:', publicRes.status);
    if (publicRes.ok) {
      const data = await publicRes.json();
      const items = data.profileChanges?.[0]?.profile?.items || {};
      for (const [id, item] of Object.entries(items)) {
        if ((item.templateId || '').toLowerCase().includes('companion')) {
          console.log(`\n${item.templateId}:`, JSON.stringify(item.attributes, null, 2));
        }
      }
    }
  } catch(e) {
    console.log('Error:', e.message);
  }

  // 8. Check party member meta more thoroughly when online
  console.log('\n=== FULL PARTY META DUMP ===\n');
  try {
    const partyRes = await fetch(
      `${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (partyRes.ok) {
      const partyData = await partyRes.json();
      if (partyData.current?.length > 0) {
        const party = partyData.current[0];
        for (const member of party.members || []) {
          if (member.account_id === accountId) {
            console.log('All meta keys:', Object.keys(member.meta || {}));

            // Dump EVERYTHING that might have variant data
            for (const [key, value] of Object.entries(member.meta || {})) {
              if (key.includes('Loadout') || key.includes('Cosmetic') || key.includes('Asset')) {
                console.log(`\n${key}:`);
                try {
                  const parsed = JSON.parse(value);
                  console.log(JSON.stringify(parsed, null, 2));
                } catch {
                  console.log(value);
                }
              }
            }
          }
        }
      } else {
        console.log('Not in party - need to be in Fortnite lobby');
      }
    }
  } catch(e) {
    console.log('Error:', e.message);
  }

  console.log('\n=== SUMMARY ===');
  console.log('Looking for where ALL variant ownership is stored...');
  console.log('Key places to check:');
  console.log('1. AthenaCosmeticItem attributes.variants array');
  console.log('2. Locker slot data with variant channels');
  console.log('3. Party meta LoadoutMeta_j vAssets field');
}

main().catch(console.error);
