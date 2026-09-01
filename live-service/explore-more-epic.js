/**
 * Explore more Epic API endpoints for gold/CM data
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

async function tryEndpoint(token, accountId, url, method = 'GET', body = null) {
  try {
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.substring(0, 200); }

    return { status: res.status, data };
  } catch (e) {
    return { status: 'ERROR', data: e.message };
  }
}

async function main() {
  const auth = await getToken();
  console.log('Logged in as:', auth.displayName);
  const token = auth.access_token;
  const accountId = auth.account_id;

  const endpoints = [
    // Different profile types
    { url: `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=creative&rvn=-1`, method: 'POST', body: {} },
    { url: `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=outpost0&rvn=-1`, method: 'POST', body: {} },
    { url: `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=metadata&rvn=-1`, method: 'POST', body: {} },
    { url: `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=theater0&rvn=-1`, method: 'POST', body: {} },

    // Other MCP operations
    { url: `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/GetMcpTimeForLogin?profileId=athena&rvn=-1`, method: 'POST', body: {} },

    // Calendar/events
    { url: `${FORTNITE_BASE}/fortnite/api/calendar/v1/timeline` },

    // Stats
    { url: `${FORTNITE_BASE}/fortnite/api/stats/accountId/${accountId}/bulk/window/alltime` },
    { url: `${FORTNITE_BASE}/fortnite/api/leaderboards/type/global/stat/br_placetop1_keyboardmouse_m0_playlist_defaultsolo/window/weekly` },

    // Content
    { url: `https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/spriteapi` },
    { url: `https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/companionapi` },
    { url: `https://fortnitecontent-website-prod07.ol.epicgames.com/content/api/pages/fortnite-game/cosmeticdata` },

    // Friends service (might show party/loadout of friends)
    { url: `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/summary` },

    // Account service
    { url: `${EPIC_AUTH_BASE}/account/api/public/account/${accountId}/externalAuths` },

    // Discovery service
    { url: `https://fn-service-discovery-live-public.ogs.live.on.epicgames.com/api/v1/discovery/surface/CreativeDiscoverySurface_Frontend?appId=Fortnite` },
  ];

  for (const ep of endpoints) {
    const result = await tryEndpoint(token, accountId, ep.url, ep.method || 'GET', ep.body);
    console.log(`\n${ep.url.substring(0, 80)}...`);
    console.log(`  Status: ${result.status}`);

    // Check if result contains sprite/companion/gold data
    const dataStr = JSON.stringify(result.data).toLowerCase();
    if (dataStr.includes('gold') || dataStr.includes('cheatmaster') || dataStr.includes('companion') || dataStr.includes('mimosa')) {
      console.log('  *** CONTAINS SPRITE DATA ***');
      console.log('  Preview:', JSON.stringify(result.data).substring(0, 300));
    }
  }
}

main().catch(console.error);
