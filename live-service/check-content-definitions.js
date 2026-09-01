/**
 * Check Fortnite content service for sprite/companion definitions
 * This will tell us what variant channels exist and what they mean
 */

require('dotenv').config({ path: '.env' });

const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12';
const ANDROID_CLIENT_SECRET = 'b51ee9cb12234f50a69efa67ef53812e';

const EPIC_AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
const FORTNITE_CONTENT = 'https://fortnitecontent-website-prod07.ol.epicgames.com';
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

  // Try to get cosmetic definitions
  console.log('\n=== FORTNITE CONTENT SERVICE ===\n');

  const endpoints = [
    '/content/api/pages/fortnite-game',
    '/content/api/pages/fortnite-game/mp-item-shop',
    '/content/api/pages/fortnite-game/companionapi',
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${FORTNITE_CONTENT}${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`${ep}: ${res.status}`);

      if (res.ok) {
        const data = await res.json();
        const json = JSON.stringify(data);

        // Check if it contains sprite/companion data
        if (json.toLowerCase().includes('companion') || json.toLowerCase().includes('mimosa')) {
          console.log('  Contains companion data!');
          // Look for relevant keys
          const findCompanionKeys = (obj, path = '') => {
            if (!obj || typeof obj !== 'object') return;
            for (const [key, value] of Object.entries(obj)) {
              const keyLower = key.toLowerCase();
              if (keyLower.includes('companion') || keyLower.includes('mimosa') || keyLower.includes('sprite')) {
                console.log(`  ${path}.${key}:`, typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : value);
              }
              if (typeof value === 'object') {
                findCompanionKeys(value, path ? `${path}.${key}` : key);
              }
            }
          };
          findCompanionKeys(data);
        }
      }
    } catch (e) {
      console.log(`${ep}: ERROR - ${e.message}`);
    }
  }

  // Try ItemCollectionsDefinition endpoint
  console.log('\n=== ITEM COLLECTIONS ===\n');
  try {
    const res = await fetch(
      `${FORTNITE_BASE}/fortnite/api/game/v2/world/info`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    console.log('World info:', res.status);
  } catch (e) {}

  // Try catalog endpoint for shop items with companion
  console.log('\n=== STOREFRONT CATALOG ===\n');
  try {
    const res = await fetch(
      `${FORTNITE_BASE}/fortnite/api/storefront/v2/catalog`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (res.ok) {
      const catalog = await res.json();
      const json = JSON.stringify(catalog);

      // Search for companion/sprite items
      const companionMatches = json.match(/companion[a-z_0-9]+/gi) || [];
      console.log('Companion refs in catalog:', [...new Set(companionMatches)].slice(0, 10));

      // Look for gold/material references
      const goldMatches = json.match(/gold|material|mat[0-9]+|cheat|master/gi) || [];
      console.log('Gold/Material refs:', [...new Set(goldMatches)].slice(0, 10));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Query the MCP GetCatalogDefinitions
  console.log('\n=== MCP CATALOG DEFINITIONS ===\n');
  try {
    const res = await fetch(
      `${FORTNITE_BASE}/fortnite/api/game/v2/profile/${auth.account_id}/client/QueryProfile?profileId=common_core&rvn=-1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (res.ok) {
      const data = await res.json();
      const items = data.profileChanges?.[0]?.profile?.items || {};

      // Look for grant/unlock tokens related to sprites
      for (const [id, item] of Object.entries(items)) {
        const tid = (item.templateId || '').toLowerCase();
        if (tid.includes('grant') || tid.includes('unlock')) {
          if (tid.includes('companion') || tid.includes('mimosa') || tid.includes('gold') || tid.includes('material')) {
            console.log(item.templateId);
            console.log('  Attributes:', JSON.stringify(item.attributes, null, 2));
          }
        }
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);
