/**
 * Check current party data to compare with athena profile
 */

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
  console.log('Logged in as:', auth.displayName);
  const token = auth.access_token;
  const accountId = auth.account_id;

  const partyRes = await fetch(`${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!partyRes.ok) {
    console.log('Party fetch failed:', partyRes.status);
    return;
  }

  const partyData = await partyRes.json();

  if (!partyData.current?.length) {
    console.log('\n⚠️  NOT IN FORTNITE LOBBY');
    console.log('Open Fortnite and sit in lobby, then run this again.');
    return;
  }

  const party = partyData.current[0];
  console.log('\n✓ In party:', party.id);

  for (const member of party.members || []) {
    if (member.account_id !== accountId) continue;

    console.log('\n=== YOUR PARTY META ===\n');

    // Check MpLoadout for sprite data
    for (const loadoutKey of ['Default:MpLoadout1_j', 'Default:MpLoadout2_j']) {
      const loadoutJson = member.meta?.[loadoutKey];
      if (!loadoutJson) continue;

      console.log(`${loadoutKey}:`);
      const loadout = JSON.parse(loadoutJson);
      console.log(JSON.stringify(loadout, null, 2));

      // Extract mm (mascot/sprite) slot
      const slots = loadout.MpLoadout1?.s || loadout.MpLoadout2?.s || {};
      if (slots.mm) {
        console.log('\n=== SPRITE SLOT (mm) BREAKDOWN ===');
        console.log('Raw mm:', JSON.stringify(slots.mm, null, 2));
        console.log('\nInterpreted:');
        console.log('  Sprite ID (mm.i):', slots.mm.i);
        console.log('  Variants (mm.v):');
        const v = slots.mm.v || [];
        console.log('    v[0] (particle):', v[0] || 'none');
        console.log('    v[1] (gold?):', v[1], v[1] === '1' ? '← OWNED' : '← not owned');
        console.log('    v[2] (CM?):', v[2], v[2] === '1' ? '← OWNED' : '← not owned');
      }
    }

    // Check LoadoutMeta for vAssets
    const loadoutMeta = member.meta?.['Default:LoadoutMeta_j'];
    if (loadoutMeta) {
      console.log('\n=== LOADOUT META ===');
      const meta = JSON.parse(loadoutMeta);
      console.log(JSON.stringify(meta, null, 2));
    }

    // Check AthenaCosmeticLoadout
    const cosmeticLoadout = member.meta?.['Default:AthenaCosmeticLoadout_j'];
    if (cosmeticLoadout) {
      console.log('\n=== ATHENA COSMETIC LOADOUT ===');
      const loadout = JSON.parse(cosmeticLoadout);

      // Look for companion slot
      const companionSlot = loadout.AthenaCosmeticLoadout?.companionDef || '';
      console.log('Companion def:', companionSlot);

      // Check variant channels
      if (loadout.AthenaCosmeticLoadout?.companionVariants) {
        console.log('Companion variants:', JSON.stringify(loadout.AthenaCosmeticLoadout.companionVariants, null, 2));
      }

      // Full dump
      console.log('\nFull loadout:');
      console.log(JSON.stringify(loadout, null, 2));
    }
  }
}

main().catch(console.error);
