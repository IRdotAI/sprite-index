require('dotenv').config();
const fs = require('fs');

const { ACCOUNT_ID, DEVICE_ID, SECRET } = process.env;

if (!ACCOUNT_ID || !DEVICE_ID || !SECRET) {
  console.error('Missing env vars');
  process.exit(1);
}

const MCP_BASE = 'https://fngw-mcp-gc-livefn.ol.epicgames.com';
const AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';

async function getToken() {
  const res = await fetch(`${AUTH_BASE}/account/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=device_auth&account_id=${ACCOUNT_ID}&device_id=${DEVICE_ID}&secret=${encodeURIComponent(SECRET)}`,
  });

  if (!res.ok) {
    console.error('Auth failed:', await res.text());
    process.exit(1);
  }

  const data = await res.json();
  return { token: data.access_token, accountId: data.account_id, displayName: data.displayName };
}

async function queryProfile(token, accountId, profileId) {
  const url = `${MCP_BASE}/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=${profileId}&rvn=-1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  return { status: res.status, data: await res.json() };
}

(async () => {
  console.log('=== COLLECTION BOOK DUMP TO FILE ===\n');

  const { token, accountId, displayName } = await getToken();
  console.log(`Connected as: ${displayName}`);
  console.log(`Account ID: ${accountId}\n`);

  const profiles = [
    'athena',
    'collections',
    'collection_book_schematics0',
    'collection_book_people0',
    'collection_book_creatures0',
    'collection_book0',
    'collection_book_heroes0',
    'collection_book_survivors0',
    'collection_book_defenders0',
    'outpost0',
    'common_core',
    'common_public',
  ];

  const output = {
    accountId,
    displayName,
    timestamp: new Date().toISOString(),
    profiles: {},
  };

  for (const profileId of profiles) {
    console.log(`Querying ${profileId}...`);
    const result = await queryProfile(token, accountId, profileId);

    output.profiles[profileId] = {
      status: result.status,
      data: result.data,
    };

    if (result.status === 200) {
      const itemCount = Object.keys(result.data?.profileChanges?.[0]?.profile?.items || {}).length;
      console.log(`  ✓ ${itemCount} items`);
    } else {
      console.log(`  ✗ ${result.status} - ${result.data?.errorCode || 'error'}`);
    }
  }

  const outPath = './collectionbook_dump.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
})();
