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

  // Get current party
  let partyRes = await fetch(`${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  let partyData = await partyRes.json();
  
  if (!partyData.current?.[0]) {
    console.log('Not in party');
    return;
  }

  const partyId = partyData.current[0].id;
  console.log('Party ID:', partyId);

  // Try to trigger a party meta update by patching our own member data
  console.log('\nTrying to trigger party refresh...');
  
  const patchRes = await fetch(
    `${PARTY_BASE}/party/api/v1/Fortnite/parties/${partyId}/members/${accountId}/meta`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delete: [],
        update: {
          // Just update a harmless field to trigger sync
          'Default:DownloadOnDemandProgress_d': '1.0'
        }
      })
    }
  );
  
  console.log('Patch status:', patchRes.status);
  const patchData = await patchRes.text();
  console.log('Patch response:', patchData.substring(0, 200));

  // Wait a moment and check again
  await new Promise(r => setTimeout(r, 1000));

  partyRes = await fetch(`${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  partyData = await partyRes.json();

  const member = partyData.current[0]?.members?.find(m => m.account_id === accountId);
  const loadout = JSON.parse(member?.meta?.['Default:MpLoadout1_j'] || '{}');
  const mm = loadout.MpLoadout1?.s?.mm;

  console.log('\n=== AFTER REFRESH ATTEMPT ===');
  console.log('Sprite:', mm?.i);
  console.log('Updated:', member?.updated_at);
}

main().catch(console.error);
