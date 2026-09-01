/**
 * Extract sprite variant ownership from live party session data
 * The mm field in party loadout contains equipped sprite with variant info
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

// Sprite ID mappings (companion_x -> sprite name)
const SPRITE_MAP = {
  'companion_sizetribe': 'crown',
  'companion_8bit': '8bit',
  'companion_dwarf': 'adventure',
  'companion_bushranger': 'bush',
  'companion_jonesy': 'jonesy',
  'companion_stormscout': 'stormscout',
  'companion_killswitch': 'killswitch',
  'companion_reloadovertime': 'shadow',
  'companion_narrowflea': 'sonic',
  'companion_narrowfleamonkey': 'tails',
  'companion_doublejump': 'jackrabbit',
  'companion_klombo': 'klombo',
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

async function getPartyData(token, accountId) {
  const res = await fetch(`${PARTY_BASE}/party/api/v1/Fortnite/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) return null;
  return await res.json();
}

function extractSpriteVariants(memberMeta) {
  const results = [];

  // Check MpLoadout1_j and MpLoadout2_j
  for (const loadoutKey of ['Default:MpLoadout1_j', 'Default:MpLoadout2_j']) {
    const loadoutJson = memberMeta[loadoutKey];
    if (!loadoutJson) continue;

    try {
      const loadout = JSON.parse(loadoutJson);
      const slots = loadout.MpLoadout1?.s || loadout.MpLoadout2?.s || {};

      // mm = mascot/sprite slot
      if (slots.mm) {
        const spriteId = (slots.mm.i || '').toLowerCase();
        const variants = slots.mm.v || [];

        console.log('\nRaw sprite data:');
        console.log('  ID:', slots.mm.i);
        console.log('  Variants:', JSON.stringify(variants));

        // Parse variant array
        // v[0] = particle effect name (e.g. "companion_reactfx_sizetribe")
        // v[1] = material variant 1 (gold?)
        // v[2] = material variant 2 (cheatmaster?)

        const particleEffect = variants[0] || '';
        const materialVar1 = variants[1];
        const materialVar2 = variants[2];

        // Map to sprite name
        let spriteName = null;
        for (const [key, name] of Object.entries(SPRITE_MAP)) {
          if (spriteId.includes(key)) {
            spriteName = name;
            break;
          }
        }

        results.push({
          raw_id: slots.mm.i,
          sprite_name: spriteName,
          particle_effect: particleEffect,
          variant_1: materialVar1,
          variant_2: materialVar2,
          has_gold: materialVar1 === '1',
          has_cheatmaster: materialVar2 === '1',
        });
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  }

  // Also check LoadoutMeta_j for vAssets
  const loadoutMeta = memberMeta['Default:LoadoutMeta_j'];
  if (loadoutMeta) {
    try {
      const meta = JSON.parse(loadoutMeta);
      const vAssets = meta.LoadoutMeta?.vAssets || [];

      console.log('\nvAssets (variant assets):');
      for (const asset of vAssets) {
        console.log(' ', asset);
        // Format: CosmeticMimosaC:Companion_ReactFX_SizeTribe
        // This might indicate which variant is equipped
      }
    } catch (e) {}
  }

  return results;
}

async function main() {
  console.log('=== SPRITE VARIANT EXTRACTION ===\n');

  const auth = await getToken();
  console.log('Logged in as:', auth.displayName);

  const partyData = await getPartyData(auth.access_token, auth.account_id);

  if (!partyData?.current?.length) {
    console.log('\nUser is not in a party/lobby. Need to be in Fortnite to get live data.');
    console.log('Try again while the user is in the Fortnite lobby.');
    return;
  }

  const party = partyData.current[0];
  console.log('\nParty ID:', party.id);
  console.log('Members:', party.members?.length);

  for (const member of party.members || []) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Member: ${member.account_id}`);
    console.log('='.repeat(50));

    const sprites = extractSpriteVariants(member.meta || {});

    if (sprites.length > 0) {
      console.log('\nExtracted sprite variants:');
      for (const s of sprites) {
        console.log(JSON.stringify(s, null, 2));
      }
    } else {
      console.log('No sprite equipped');
    }
  }

  // Summary
  console.log('\n\n=== VARIANT INTERPRETATION ===');
  console.log('Based on the mm field in MpLoadout:');
  console.log('- mm.i = sprite cosmetic ID');
  console.log('- mm.v[0] = particle/FX variant name');
  console.log('- mm.v[1] = "1" likely means GOLD variant owned');
  console.log('- mm.v[2] = "1" likely means CHEATMASTER variant owned');
  console.log('\nNeed more party samples to confirm mapping!');
}

main().catch(console.error);
