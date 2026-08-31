require('dotenv').config();

const { ACCOUNT_ID, DEVICE_ID, SECRET } = process.env;

// Our sanctioned Sprite Dex client
const SPRITEDEX_CLIENT_ID = 'ec684b8c687f479fadea3cb2ad83f5c6';
const SPRITEDEX_CLIENT_SECRET = 'e1f31c211f28413186262d37a13fc84d';

// Android client for getting initial token
const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const ANDROID_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';

const AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
const EOS_AUTH = 'https://api.epicgames.dev/auth/v1/oauth/token';
const EOS_LOCKER = 'https://fngw-svc-gc-livefn.ol.epicgames.com/api/locker/v4';
const DEPLOYMENT_ID = '62a9473a2dca46b29ccf17577fcf42d7';

async function getEpicToken() {
  console.log('Step 1: Getting Epic access token via device auth...');
  const res = await fetch(`${AUTH_BASE}/account/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ANDROID_CLIENT_ID}:${ANDROID_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=device_auth&account_id=${ACCOUNT_ID}&device_id=${DEVICE_ID}&secret=${encodeURIComponent(SECRET)}`,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Epic auth failed:', data);
    return null;
  }
  console.log(`  ✓ Got Epic token for ${data.displayName} (${data.account_id})`);
  console.log(`  Token type: ${data.token_type}, expires in: ${data.expires_in}s`);
  return data;
}

async function exchangeForEOSToken(epicToken) {
  console.log('\nStep 2: Attempting EOS Connect token exchange with SPRITEDEX client...');
  console.log(`  Client ID: ${SPRITEDEX_CLIENT_ID}`);

  const nonce = Math.random().toString(36).substring(2);

  const res = await fetch(EOS_AUTH, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${SPRITEDEX_CLIENT_ID}:${SPRITEDEX_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'external_auth',
      external_auth_type: 'epicgames_access_token',
      external_auth_token: epicToken,
      deployment_id: DEPLOYMENT_ID,
      nonce: nonce,
    }).toString(),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  console.log(`  Response status: ${res.status}`);

  if (!res.ok) {
    console.log('  ✗ EOS token exchange FAILED');
    console.log('  Error:', JSON.stringify(data, null, 2));
    return null;
  }

  console.log('  ✓ EOS token exchange SUCCEEDED');
  console.log('  Features:', data.features?.join(', ') || 'none');
  console.log('  Product User ID:', data.product_user_id);
  return data;
}

async function getCosmeticData(eosToken, accountId) {
  console.log('\nStep 3: Calling EOS Locker cosmetic-data endpoint...');

  const url = `${EOS_LOCKER}/${DEPLOYMENT_ID}/account/${accountId}/cosmetic-data?limit=100`;
  console.log(`  URL: ${url}`);

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${eosToken}`,
    },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  console.log(`  Response status: ${res.status}`);

  if (!res.ok) {
    console.log('  ✗ Cosmetic data fetch FAILED');
    console.log('  Error:', JSON.stringify(data, null, 2));
    return null;
  }

  console.log('  ✓ Cosmetic data fetch SUCCEEDED');
  return data;
}

function analyzeForSprites(cosmeticData) {
  console.log('\nStep 4: Analyzing for sprite-related items...');

  const items = cosmeticData?.cosmeticItems || [];
  console.log(`  Total items returned: ${items.length}`);

  // Look for sprite-related items
  const spriteKeywords = ['sprite', 'creature', 'companion', 'mimosa', 'blockstack',
    '8bit', 'dwarf', 'bushranger', 'jonesy', 'stormscout', 'killswitch',
    'reloadovertime', 'narrowflea', 'klombo', 'crown', 'doublejump'];

  const spriteItems = items.filter(item => {
    const tid = (item.templateId || '').toLowerCase();
    return spriteKeywords.some(kw => tid.includes(kw));
  });

  console.log(`  Sprite-related items found: ${spriteItems.length}`);

  if (spriteItems.length > 0) {
    console.log('\n=== SPRITE ITEMS ===\n');
    for (const item of spriteItems) {
      console.log(`Template: ${item.templateId}`);
      console.log(`  ownedVariants: ${JSON.stringify(item.ownedVariants || {})}`);
      console.log(`  activeVariants: ${JSON.stringify(item.activeVariants || {})}`);
      console.log();
    }
  }

  // Also look for any items with interesting ownedVariants
  const itemsWithVariants = items.filter(item =>
    item.ownedVariants && Object.keys(item.ownedVariants).length > 0
  );
  console.log(`\nItems with ownedVariants: ${itemsWithVariants.length}`);

  // Sample a few
  if (itemsWithVariants.length > 0) {
    console.log('\n=== SAMPLE ITEMS WITH VARIANTS ===\n');
    for (const item of itemsWithVariants.slice(0, 5)) {
      console.log(`${item.templateId}:`);
      console.log(`  ownedVariants: ${JSON.stringify(item.ownedVariants)}`);
    }
  }

  return { spriteItems, itemsWithVariants };
}

(async () => {
  console.log('=== EOS LOCKER COSMETIC-DATA TEST ===\n');
  console.log('Testing with SANCTIONED Sprite Dex client only.\n');

  // Step 1: Get Epic token
  const epicAuth = await getEpicToken();
  if (!epicAuth) {
    console.log('\nABORTED: Could not get Epic token');
    process.exit(1);
  }

  // Step 2: Exchange for EOS token
  const eosAuth = await exchangeForEOSToken(epicAuth.access_token);
  if (!eosAuth) {
    console.log('\n=== RESULT ===');
    console.log('EOS Connect token exchange FAILED with our sanctioned client.');
    console.log('This endpoint likely requires a DIFFERENT client (first-party game client).');
    console.log('STOPPING - do not proceed with borrowed clients.');
    process.exit(1);
  }

  // Step 3: Get cosmetic data
  const cosmeticData = await getCosmeticData(eosAuth.access_token, epicAuth.account_id);
  if (!cosmeticData) {
    console.log('\n=== RESULT ===');
    console.log('EOS token worked but cosmetic-data endpoint failed.');
    process.exit(1);
  }

  // Step 4: Analyze
  const analysis = analyzeForSprites(cosmeticData);

  console.log('\n=== FINAL RESULT ===');
  console.log('EOS Locker endpoint accessible with our sanctioned client: YES');
  console.log(`Sprite items found: ${analysis.spriteItems.length}`);
  console.log(`Items with ownedVariants: ${analysis.itemsWithVariants.length}`);
})();
