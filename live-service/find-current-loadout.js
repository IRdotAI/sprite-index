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

async function tryEndpoint(token, name, url, method = 'GET', body = null) {
  try {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.substring(0, 300); }
    
    // Check if it contains companion/sprite data
    const dataStr = JSON.stringify(data).toLowerCase();
    const hasSprite = dataStr.includes('companion') || dataStr.includes('klombo') || dataStr.includes('generalhound');
    
    console.log(`${name}: ${res.status}${hasSprite ? ' *** HAS SPRITE DATA ***' : ''}`);
    if (hasSprite && res.status === 200) {
      console.log('  Preview:', JSON.stringify(data).substring(0, 400));
    }
    return { status: res.status, data };
  } catch (e) {
    console.log(`${name}: ERROR - ${e.message}`);
    return null;
  }
}

async function main() {
  const auth = await getToken();
  console.log('Account:', auth.displayName, '\n');
  const token = auth.access_token;
  const accountId = auth.account_id;

  // Try various endpoints that might have current loadout
  await tryEndpoint(token, 'SetCosmeticLockerSlot', 
    `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/SetCosmeticLockerSlot?profileId=athena&rvn=-1`,
    'POST', { lockerItem: '', category: 'Companion', itemToSlot: '', slotIndex: 0, variantUpdates: [] });

  await tryEndpoint(token, 'GetMcpTimeForLogin',
    `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${accountId}/client/GetMcpTimeForLogin?profileId=athena&rvn=-1`,
    'POST', {});

  // Try locker service
  await tryEndpoint(token, 'LockerService',
    `https://locker-public-service-prod.ol.epicgames.com/locker/api/public/account/${accountId}/locker`);

  // Try presence service for current game state
  await tryEndpoint(token, 'PresenceSelf',
    `https://presence-public-service-prod.ol.epicgames.com/presence/api/v1/_/${accountId}/last-online`);

  // Try dedicated server status
  await tryEndpoint(token, 'DedicatedServer',
    `https://fgame-prod.ol.epicgames.com/fortnite/api/matchmaking/session/${accountId}`);

  // Try lightswitch
  await tryEndpoint(token, 'Lightswitch',
    `https://lightswitch-public-service-prod.ol.epicgames.com/lightswitch/api/service/bulk/status?serviceId=Fortnite`);
}

main().catch(console.error);
