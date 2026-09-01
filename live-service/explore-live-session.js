/**
 * Explore live in-game session data for sprite variants
 * Uses Fortnite client credentials to access party/presence/session APIs
 */

require('dotenv').config({ path: '.env' });

const FORTNITE_CLIENT_ID = '98f7e42c2e3a4f86a74eb43fbb41ed39';
const FORTNITE_CLIENT_SECRET = '0a2449a2-001a-451e-afec-3e812901c4d7';

const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const ANDROID_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';

const EPIC_AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
const PARTY_BASE = 'https://party-service-prod.ol.epicgames.com';
const PRESENCE_BASE = 'https://presence-public-service-prod.ol.epicgames.com';
const FORTNITE_BASE = 'https://fortnite-public-service-prod11.ol.epicgames.com';
const LIGHTSWITCH_BASE = 'https://lightswitch-public-service-prod.ol.epicgames.com';

// Device auth credentials (from your account)
const DEVICE_AUTH = {
  account_id: process.env.ACCOUNT_ID,
  device_id: process.env.DEVICE_ID,
  secret: process.env.SECRET
};

async function getFortniteToken() {
  // Login with device auth using Android client (supports device_auth)
  const basicAuth = Buffer.from(`${ANDROID_CLIENT_ID}:${ANDROID_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${EPIC_AUTH_BASE}/account/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=device_auth&account_id=${DEVICE_AUTH.account_id}&device_id=${DEVICE_AUTH.device_id}&secret=${encodeURIComponent(DEVICE_AUTH.secret)}`
  });

  const data = await res.json();
  if (data.error) throw new Error(data.errorMessage || data.error);
  return data;
}

async function exchangeToFortnite(accessToken) {
  // Get exchange code
  const exchangeRes = await fetch(`${EPIC_AUTH_BASE}/account/api/oauth/exchange`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const { code } = await exchangeRes.json();

  // Exchange to Fortnite Switch client (might have different access)
  const basicAuth = Buffer.from(`${FORTNITE_CLIENT_ID}:${FORTNITE_CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch(`${EPIC_AUTH_BASE}/account/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=exchange_code&exchange_code=${code}`
  });

  return await tokenRes.json();
}

async function explorePartyService(token, accountId) {
  console.log('\n=== PARTY SERVICE ===\n');

  // Get user's party info
  const partyRes = await fetch(`${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!partyRes.ok) {
    console.log('Party fetch failed:', partyRes.status);
    return null;
  }

  const partyData = await partyRes.json();
  console.log('Party data keys:', Object.keys(partyData));

  if (partyData.current && partyData.current.length > 0) {
    const party = partyData.current[0];
    console.log('\nParty ID:', party.id);
    console.log('Party members:', party.members?.length);

    for (const member of party.members || []) {
      console.log(`\n--- Member: ${member.account_id} ---`);
      console.log('Meta keys:', Object.keys(member.meta || {}));

      // Dump all meta for sprite hunting
      for (const [key, value] of Object.entries(member.meta || {})) {
        if (key.toLowerCase().includes('sprite') ||
            key.toLowerCase().includes('creature') ||
            key.toLowerCase().includes('pet') ||
            key.toLowerCase().includes('loadout')) {
          console.log(`\n${key}:`);
          try {
            const parsed = JSON.parse(value);
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            console.log(value);
          }
        }
      }

      // Also check AthenaCosmeticLoadout for any sprite references
      const loadoutKey = 'Default:AthenaCosmeticLoadout_j';
      if (member.meta?.[loadoutKey]) {
        console.log('\n=== COSMETIC LOADOUT ===');
        const loadout = JSON.parse(member.meta[loadoutKey]);
        console.log(JSON.stringify(loadout, null, 2));
      }
    }
  } else {
    console.log('User not in a party or offline');
  }

  return partyData;
}

async function explorePresenceService(token, accountId) {
  console.log('\n=== PRESENCE SERVICE ===\n');

  // Get user presence
  const presenceRes = await fetch(`${PRESENCE_BASE}/presence/api/v1/_/${accountId}/settings/subscriptions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Presence settings:', presenceRes.status);

  // Try to get last online
  const lastOnlineRes = await fetch(`${PRESENCE_BASE}/presence/api/v1/_/${accountId}/last-online`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (lastOnlineRes.ok) {
    const lastOnline = await lastOnlineRes.json();
    console.log('Last online:', JSON.stringify(lastOnline, null, 2));
  }

  // Get subscriptions (friends online status)
  const subsRes = await fetch(`${PRESENCE_BASE}/presence/api/v1/_/${accountId}/subscriptions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (subsRes.ok) {
    const subs = await subsRes.json();
    console.log('Subscriptions count:', subs.length);
  }
}

async function exploreFortniteService(token, accountId) {
  console.log('\n=== FORTNITE SERVICE - Live Session Data ===\n');

  // Try various Fortnite endpoints that might have sprite data
  const endpoints = [
    `/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=athena&rvn=-1`,
    `/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=common_core&rvn=-1`,
    `/fortnite/api/storeaccess/v1/request_access/${accountId}`,
    `/fortnite/api/game/v2/enabled_features`,
    `/fortnite/api/cloudstorage/user/${accountId}`,
    `/fortnite/api/matchmaking/session/findPlayer/${accountId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${FORTNITE_BASE}${endpoint}`, {
        method: endpoint.includes('QueryProfile') ? 'POST' : 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: endpoint.includes('QueryProfile') ? '{}' : undefined
      });

      console.log(`\n${endpoint}: ${res.status}`);

      if (res.ok) {
        const data = await res.json();

        // Search for sprite-related data
        const json = JSON.stringify(data);
        if (json.toLowerCase().includes('sprite') ||
            json.toLowerCase().includes('creature') ||
            json.toLowerCase().includes('blockstack')) {
          console.log('FOUND SPRITE DATA!');

          // Find the specific keys
          const findSpriteKeys = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;
            for (const [key, value] of Object.entries(obj)) {
              const newPath = path ? `${path}.${key}` : key;
              const strVal = JSON.stringify(value).toLowerCase();
              if (strVal.includes('sprite') || strVal.includes('blockstack') || strVal.includes('creature_sprite')) {
                console.log(`\n${newPath}:`, JSON.stringify(value, null, 2).substring(0, 500));
              }
              if (typeof value === 'object') {
                findSpriteKeys(value, newPath);
              }
            }
          };
          findSpriteKeys(data);
        }
      }
    } catch (e) {
      console.log(`${endpoint}: ERROR - ${e.message}`);
    }
  }
}

async function exploreLightswitch(token) {
  console.log('\n=== LIGHTSWITCH SERVICE ===\n');

  const res = await fetch(`${LIGHTSWITCH_BASE}/lightswitch/api/service/Fortnite/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (res.ok) {
    const data = await res.json();
    console.log('Fortnite status:', JSON.stringify(data, null, 2));
  }
}

async function exploreCloudStorage(token, accountId) {
  console.log('\n=== CLOUD STORAGE (Settings/Loadouts) ===\n');

  const res = await fetch(`${FORTNITE_BASE}/fortnite/api/cloudstorage/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (res.ok) {
    const files = await res.json();
    console.log('Cloud storage files:', files.length);

    for (const file of files) {
      console.log(`\nFile: ${file.filename} (${file.length} bytes)`);

      // Download files that might have sprite loadout data
      if (file.filename.includes('ClientSettings') ||
          file.filename.includes('Loadout') ||
          file.filename.includes('Sprite')) {
        const fileRes = await fetch(
          `${FORTNITE_BASE}/fortnite/api/cloudstorage/user/${accountId}/${file.uniqueFilename}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (fileRes.ok) {
          const content = await fileRes.text();
          console.log('Content preview:', content.substring(0, 500));
        }
      }
    }
  }
}

async function main() {
  if (!DEVICE_AUTH.account_id || !DEVICE_AUTH.device_id || !DEVICE_AUTH.secret) {
    console.log('Set ACCOUNT_ID, DEVICE_ID, DEVICE_SECRET in .env');
    console.log('Get these from the admin endpoint: /admin/device-auth/:account_id');
    return;
  }

  console.log('Getting Fortnite client token...');
  const fnToken = await getFortniteToken();
  console.log('Logged in as:', fnToken.displayName);
  console.log('Account ID:', fnToken.account_id);

  // Try both Android and Fortnite Switch clients
  const tokens = [
    { name: 'Android', token: fnToken.access_token },
  ];

  try {
    console.log('\nExchanging to Fortnite Switch client...');
    const switchToken = await exchangeToFortnite(fnToken.access_token);
    tokens.push({ name: 'Fortnite Switch', token: switchToken.access_token });
  } catch (e) {
    console.log('Switch exchange failed:', e.message);
  }

  for (const { name, token } of tokens) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`EXPLORING WITH ${name.toUpperCase()} CLIENT`);
    console.log('='.repeat(50));

    await explorePartyService(token, fnToken.account_id);
    await explorePresenceService(token, fnToken.account_id);
    await exploreFortniteService(token, fnToken.account_id);
    await exploreCloudStorage(token, fnToken.account_id);
  }

  await exploreLightswitch(fnToken.access_token);
}

main().catch(console.error);
