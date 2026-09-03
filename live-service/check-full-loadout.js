require('dotenv').config({ path: '.env' });

const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const ANDROID_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';
const EPIC_AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
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

async function main() {
  const auth = await getToken();
  console.log('Account:', auth.displayName);
  const token = auth.access_token;
  const accountId = auth.account_id;

  const partyRes = await fetch(`${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const partyData = await partyRes.json();

  const member = partyData.current?.[0]?.members?.find(m => m.account_id === accountId);
  
  // Show both loadout slots
  console.log('\n=== MpLoadout1 ===');
  const loadout1 = member?.meta?.['Default:MpLoadout1_j'];
  if (loadout1) console.log(loadout1);

  console.log('\n=== MpLoadout2 ===');
  const loadout2 = member?.meta?.['Default:MpLoadout2_j'];
  if (loadout2) console.log(loadout2);

  console.log('\n=== FrontendMimosa ===');
  const fm = member?.meta?.['Default:FrontendMimosa_j'];
  if (fm) console.log(fm);

  console.log('\n=== LobbyState ===');
  const ls = member?.meta?.['Default:LobbyState_j'];
  if (ls) console.log(ls);
}

main().catch(console.error);
