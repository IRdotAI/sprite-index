require('dotenv').config();
const { Client } = require('fnbr');

const { ACCOUNT_ID, DEVICE_ID, SECRET } = process.env;

if (!ACCOUNT_ID || !DEVICE_ID || !SECRET) {
  console.error('Missing env vars');
  process.exit(1);
}

const MCP_BASE = 'https://fngw-mcp-gc-livefn.ol.epicgames.com';

async function tryOperation(token, accountId, operation, profileId, body = {}) {
  const url = `${MCP_BASE}/fortnite/api/game/v2/profile/${accountId}/client/${operation}?profileId=${profileId}&rvn=-1`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

async function tryPath(token, method, path) {
  const url = `${MCP_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? '{}' : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

(async () => {
  console.log('=== SPRITE ENDPOINT DISCOVERY ===\n');
  console.log('Logging in via fnbr...\n');

  const client = new Client({
    auth: {
      deviceAuth: {
        accountId: ACCOUNT_ID,
        deviceId: DEVICE_ID,
        secret: SECRET,
      },
    },
  });

  try {
    await client.login();
  } catch (err) {
    console.error('Login failed:', err.message);
    process.exit(1);
  }

  // Verify login succeeded - use client.user.self, not client.user
  const displayName = client.user?.self?.displayName;
  const accountId = client.user?.self?.id;

  if (!displayName || !accountId) {
    console.error('Login incomplete - user data missing');
    process.exit(1);
  }

  console.log(`Connected as: ${displayName}`);
  console.log(`Account ID: ${accountId}`);

  // Get the fortnite session token - try multiple ways
  let token = null;

  // Method 1: Check auth.sessions
  if (client.auth?.sessions) {
    const fortniteSession = client.auth.sessions.get('fortnite') || client.auth.sessions.get('prod-fn');
    if (fortniteSession?.accessToken) {
      token = fortniteSession.accessToken;
      console.log('Got token from auth.sessions');
    }
  }

  // Method 2: Check auth.auths
  if (!token && client.auth?.auths) {
    for (const [key, auth] of Object.entries(client.auth.auths)) {
      if (auth?.token || auth?.accessToken) {
        token = auth.token || auth.accessToken;
        console.log(`Got token from auth.auths[${key}]`);
        break;
      }
    }
  }

  // Method 3: Direct http property
  if (!token && client.http?.accessToken) {
    token = client.http.accessToken;
    console.log('Got token from client.http');
  }

  // Method 4: Check internal auth
  if (!token && client.auth?.accessToken) {
    token = client.auth.accessToken;
    console.log('Got token from client.auth.accessToken');
  }

  // Method 5: Dig into auth internals (keys only, no values)
  if (!token) {
    console.log('\nDebug - auth structure keys:', client.auth ? Object.keys(client.auth) : 'null');
    if (client.auth?.sessions) {
      console.log('sessions keys:', [...client.auth.sessions.keys()]);
    }
  }

  if (!token) {
    console.error('\nCould not find access token in fnbr client');
    console.error('Will try using device auth directly...\n');

    // Fallback: authenticate directly
    const authRes = await fetch('https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=device_auth&account_id=${ACCOUNT_ID}&device_id=${DEVICE_ID}&secret=${encodeURIComponent(SECRET)}`,
    });

    if (authRes.ok) {
      const authData = await authRes.json();
      token = authData.access_token;
      console.log('Got token via direct device_auth');
    } else {
      console.error('Direct auth failed:', await authRes.text());
      process.exit(1);
    }
  }

  console.log(`\nToken obtained: ${token ? 'YES' : 'NO'} (${token?.length || 0} chars)\n`);

  if (!token) {
    console.error('No token available, exiting');
    process.exit(1);
  }

  // ========== PART 1: MCP Operations ==========
  console.log('========== PART 1: MCP OPERATIONS ==========\n');

  const operations = [
    'QueryProfile',
    'ClientQuestLogin',
    'RefreshExpeditions',
    'GetMcpTimeForLogin',
    'SetItemFavoriteStatusBatch',
    'QuerySpriteCollection',
    'GetSpriteCollection',
    'MarkItemSeen',
    'GetCollectionsData',
    'QueryCollections',
    'GetSpriteMastery',
    'ClaimQuestReward',
  ];

  const profiles = ['athena', 'collections'];

  for (const profile of profiles) {
    console.log(`--- profileId=${profile} ---\n`);
    for (const op of operations) {
      const result = await tryOperation(token, accountId, op, profile);
      const statusStr = result.status === 200 ? '✓ 200' : `✗ ${result.status}`;

      if (result.status === 200) {
        const keys = Object.keys(result.data || {});
        const profileChanges = result.data?.profileChanges?.[0];
        const itemCount = profileChanges?.profile?.items ? Object.keys(profileChanges.profile.items).length : 0;
        console.log(`${statusStr} ${op}`);
        console.log(`    keys: ${keys.join(', ')}`);
        if (itemCount) console.log(`    items: ${itemCount}`);
        if (profileChanges?.profile?.stats?.attributes) {
          const attrs = Object.keys(profileChanges.profile.stats.attributes).slice(0, 5);
          console.log(`    attrs sample: ${attrs.join(', ')}...`);
        }
      } else {
        const errCode = result.data?.errorCode || result.data?.error || 'unknown';
        const errMsg = result.data?.errorMessage || '';
        console.log(`${statusStr} ${op}`);
        console.log(`    error: ${errCode}`);
        if (errMsg && errMsg !== errCode) console.log(`    msg: ${errMsg.slice(0, 150)}`);
      }
      console.log();
    }
  }

  // ========== PART 2: Non-profile paths ==========
  console.log('========== PART 2: NON-PROFILE PATHS ==========\n');

  const paths = [
    ['GET', '/fortnite/api/sprites'],
    ['GET', '/fortnite/api/sprite'],
    ['GET', '/fortnite/api/collections'],
    ['GET', '/fortnite/api/collection'],
    ['GET', `/fortnite/api/sprites/${accountId}`],
    ['GET', `/fortnite/api/collections/${accountId}`],
    ['POST', '/fortnite/api/game/v2/sprite'],
    ['POST', '/fortnite/api/game/v2/collection'],
    ['GET', '/fortnite/api/game/v2/world/sprite'],
    ['GET', '/fortnite/api/storefront/v2/catalog'],
    ['POST', `/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=collection_book_schematics0&rvn=-1`],
    ['POST', `/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=collection_book_people0&rvn=-1`],
    ['POST', `/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=outpost0&rvn=-1`],
  ];

  for (const [method, path] of paths) {
    const result = await tryPath(token, method, path);
    const statusStr = result.status === 200 ? '✓ 200' : `✗ ${result.status}`;
    console.log(`${statusStr} ${method} ${path}`);

    if (result.status === 200) {
      const keys = typeof result.data === 'object' ? Object.keys(result.data).slice(0, 5) : [];
      console.log(`    shape: ${keys.join(', ')}`);
    } else {
      const errCode = result.data?.errorCode || result.data?.error || '';
      const errMsg = result.data?.errorMessage || '';
      if (errCode) console.log(`    error: ${errCode}`);
      if (errMsg && errMsg.length < 200) console.log(`    msg: ${errMsg}`);
    }
    console.log();
  }

  console.log('========== DONE ==========\n');

  await client.logout().catch(() => {});
  process.exit(0);
})();
