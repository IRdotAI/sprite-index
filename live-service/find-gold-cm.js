/**
 * Find gold and cheatmaster variant data specifically
 * Looking at Material channel and CosmeticVariantToken items
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

  // Query athena profile
  const res = await fetch(
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

  const athena = await res.json();
  const items = athena.profileChanges?.[0]?.profile?.items || {};

  console.log('\n=== ALL SPRITE ITEMS ===\n');

  const sprites = {};

  for (const [id, item] of Object.entries(items)) {
    const tid = (item.templateId || '');
    const tidLower = tid.toLowerCase();

    // Collect all companion/sprite items
    if (tidLower.includes('cosmeticmimosa:companion_') && !tidLower.includes('reactfx')) {
      const spriteName = tid.split(':')[1];
      sprites[spriteName] = {
        templateId: tid,
        variants: item.attributes?.variants || [],
        level: item.attributes?.level,
        creation_time: item.attributes?.creation_time
      };
    }

    // Look for variant tokens (gold, cheatmaster, etc)
    if (tidLower.includes('varianttoken') && tidLower.includes('companion')) {
      console.log('VARIANT TOKEN:', tid);
      console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
    }

    // Look for ANY item with gold, cheatmaster, material in the name
    if (tidLower.includes('gold') || tidLower.includes('cheat') || tidLower.includes('master')) {
      console.log('GOLD/CM ITEM:', tid);
      console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
    }
  }

  console.log('\n=== SPRITE VARIANT BREAKDOWN ===\n');

  for (const [name, data] of Object.entries(sprites)) {
    console.log(`\n${name}:`);
    console.log(`  Level: ${data.level}`);

    for (const variant of data.variants) {
      console.log(`  ${variant.channel}:`);
      console.log(`    active: ${variant.active}`);
      console.log(`    owned: ${JSON.stringify(variant.owned)}`);
    }
  }

  // Search for any item containing specific keywords
  console.log('\n=== SEARCHING FOR HIDDEN ITEMS ===\n');

  const searchTerms = ['mat1', 'mat2', 'gold', 'cheat', 'master', 'premium', 'exclusive', 'special'];

  for (const [id, item] of Object.entries(items)) {
    const fullJson = JSON.stringify(item).toLowerCase();
    for (const term of searchTerms) {
      if (fullJson.includes(term)) {
        console.log(`Found "${term}" in:`, item.templateId);
        if (term === 'mat1' || term === 'mat2') {
          console.log('  Full item:', JSON.stringify(item, null, 2));
        }
        break;
      }
    }
  }

  // Check stats attributes for any variant-related data
  console.log('\n=== STATS ATTRIBUTES ===\n');
  const stats = athena.profileChanges?.[0]?.profile?.stats?.attributes || {};

  for (const [key, value] of Object.entries(stats)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('variant') || keyLower.includes('companion') ||
        keyLower.includes('sprite') || keyLower.includes('material')) {
      console.log(`${key}:`, JSON.stringify(value, null, 2).substring(0, 200));
    }
  }

  console.log('\n=== KEY INSIGHT ===');
  console.log('The Material channel likely contains gold/CM ownership.');
  console.log('Mat1 = Gold, Mat2 = Cheatmaster (hypothesis)');
  console.log('Check owned[] array in Material channel for each sprite.');
}

main().catch(console.error);
