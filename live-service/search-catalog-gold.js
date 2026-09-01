/**
 * Search catalog specifically for gold/cheatmaster variant items
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

  // Get catalog
  const res = await fetch(
    `${FORTNITE_BASE}/fortnite/api/storefront/v2/catalog`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const catalog = await res.json();

  console.log('\n=== SEARCHING CATALOG FOR GOLD/CM ===\n');

  // Search all storefronts
  for (const storefront of catalog.storefronts || []) {
    for (const entry of storefront.catalogEntries || []) {
      const entryJson = JSON.stringify(entry).toLowerCase();

      // Check if this entry is related to companions and gold/material
      if ((entryJson.includes('companion') || entryJson.includes('mimosa')) &&
          (entryJson.includes('gold') || entryJson.includes('material') || entryJson.includes('cheat'))) {
        console.log('\n=== FOUND COMPANION GOLD/MATERIAL ENTRY ===');
        console.log('Offer ID:', entry.offerId);
        console.log('Dev Name:', entry.devName);

        // Show item grants
        for (const grant of entry.itemGrants || []) {
          console.log('  Grant:', grant.templateId);
          if (grant.attributes) {
            console.log('    Attributes:', JSON.stringify(grant.attributes, null, 2));
          }
        }

        // Show requirements
        if (entry.requirements?.length) {
          console.log('  Requirements:', JSON.stringify(entry.requirements, null, 2));
        }

        // Show meta info
        if (entry.metaInfo?.length) {
          console.log('  Meta:', JSON.stringify(entry.metaInfo.slice(0, 5), null, 2));
        }
      }
    }
  }

  // Also search for variant token definitions
  console.log('\n=== SEARCHING FOR VARIANT TOKENS IN CATALOG ===\n');

  for (const storefront of catalog.storefronts || []) {
    for (const entry of storefront.catalogEntries || []) {
      for (const grant of entry.itemGrants || []) {
        const tid = (grant.templateId || '').toLowerCase();
        if (tid.includes('varianttoken') && tid.includes('companion')) {
          console.log('Variant Token Grant:', grant.templateId);
          console.log('  From offer:', entry.devName || entry.offerId);
        }
      }
    }
  }
}

main().catch(console.error);
