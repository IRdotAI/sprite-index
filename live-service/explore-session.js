require('dotenv').config();
const fs = require('fs');
const { Client } = require('fnbr');

const { ACCOUNT_ID, DEVICE_ID, SECRET } = process.env;

const MCP_BASE = 'https://fngw-mcp-gc-livefn.ol.epicgames.com';
const AUTH_BASE = 'https://account-public-service-prod.ol.epicgames.com';
const PRESENCE_BASE = 'https://presence-public-service-prod.ol.epicgames.com';

async function getToken() {
  const res = await fetch(`${AUTH_BASE}/account/api/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=device_auth&account_id=${ACCOUNT_ID}&device_id=${DEVICE_ID}&secret=${encodeURIComponent(SECRET)}`,
  });
  const data = await res.json();
  return { token: data.access_token, accountId: data.account_id, displayName: data.displayName };
}

async function tryEndpoint(token, method, url) {
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
  console.log('=== SESSION/MATCHMAKING/PRESENCE EXPLORATION ===\n');

  const { token, accountId, displayName } = await getToken();
  console.log(`Connected as: ${displayName}`);
  console.log(`Account ID: ${accountId}\n`);

  const output = {
    accountId,
    displayName,
    timestamp: new Date().toISOString(),
    endpoints: {},
    partyMeta: null,
    presence: null,
  };

  // ========== PART 1: Session/Matchmaking endpoints ==========
  console.log('=== PART 1: SESSION/MATCHMAKING ENDPOINTS ===\n');

  const endpoints = [
    // Matchmaking
    ['GET', `${MCP_BASE}/fortnite/api/matchmaking/session/findPlayer/${accountId}`],
    ['GET', `${MCP_BASE}/fortnite/api/matchmaking`],
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/matchmaking`],
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/matchmakingservice`],

    // Session
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/session`],
    ['GET', `${MCP_BASE}/fortnite/api/session`],

    // World/game state
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/world`],
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/enabled_features`],
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/privacy/account/${accountId}`],

    // Calendar/events
    ['GET', `${MCP_BASE}/fortnite/api/calendar/v1/timeline`],

    // Stats
    ['GET', `${MCP_BASE}/fortnite/api/stats/accountId/${accountId}/bulk/window/alltime`],
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/br-inventory/account/${accountId}`],

    // Receipts/history
    ['GET', `${MCP_BASE}/fortnite/api/receipts/v1/account/${accountId}/receipts`],

    // Creative
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/creative`],

    // Discovery
    ['GET', `${MCP_BASE}/fortnite/api/game/v2/discovery/surface/CreativeDiscoverySurface_Frontend`],

    // Cloudstorage
    ['GET', `${MCP_BASE}/fortnite/api/cloudstorage/user/${accountId}`],
  ];

  for (const [method, url] of endpoints) {
    const shortUrl = url.replace(MCP_BASE, '');
    console.log(`${method} ${shortUrl}...`);
    const result = await tryEndpoint(token, method, url);

    output.endpoints[shortUrl] = { method, status: result.status, data: result.data };

    if (result.status === 200) {
      const keys = typeof result.data === 'object' ? Object.keys(result.data).slice(0, 8) : [];
      console.log(`  ✓ 200 - keys: ${keys.join(', ')}`);
    } else {
      console.log(`  ✗ ${result.status}`);
    }
  }

  // ========== PART 2: Full party meta via fnbr ==========
  console.log('\n=== PART 2: PARTY META (via fnbr) ===\n');

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
    console.log('fnbr connected\n');

    // Wait for party to initialize
    await new Promise(r => setTimeout(r, 3000));

    const party = client.party;
    const selfMember = party?.me;

    if (selfMember?.meta?.schema) {
      console.log('Party member meta keys (ALL Default:* keys):');
      const schema = selfMember.meta.schema;
      const allKeys = Object.keys(schema).sort();

      output.partyMeta = {
        allKeys,
        fullSchema: schema,
      };

      // Print all keys
      for (const key of allKeys) {
        console.log(`  ${key}`);
      }

      // Highlight anything sprite/creature/companion related
      console.log('\n--- SPRITE/CREATURE/COMPANION KEYWORDS ---');
      const keywords = ['sprite', 'creature', 'companion', 'pet', 'collection', 'figurine', 'summon', 'blockstack'];
      let found = false;
      for (const key of allKeys) {
        const keyLower = key.toLowerCase();
        const valStr = JSON.stringify(schema[key]).toLowerCase();
        for (const kw of keywords) {
          if (keyLower.includes(kw) || valStr.includes(kw)) {
            console.log(`  MATCH: ${key}`);
            console.log(`    value: ${JSON.stringify(schema[key]).slice(0, 200)}`);
            found = true;
            break;
          }
        }
      }
      if (!found) console.log('  (none found)');
    } else {
      console.log('No party meta available');
    }

    // ========== PART 3: Presence ==========
    console.log('\n=== PART 3: OWN PRESENCE ===\n');

    // Try presence endpoint directly
    const presenceResult = await tryEndpoint(token, 'GET',
      `${PRESENCE_BASE}/presence/api/v1/_/${accountId}/settings/subscriptions`);
    output.endpoints['/presence/subscriptions'] = presenceResult;
    console.log(`Presence subscriptions: ${presenceResult.status}`);

    const presenceResult2 = await tryEndpoint(token, 'GET',
      `${PRESENCE_BASE}/presence/api/v1/_/${accountId}/last-online`);
    output.endpoints['/presence/last-online'] = presenceResult2;
    console.log(`Presence last-online: ${presenceResult2.status}`);

    // Get friend list presence
    const friends = client.friend?.list;
    if (friends?.size > 0) {
      console.log(`\nFriend presence samples (first 3):`);
      let count = 0;
      for (const [id, friend] of friends) {
        if (count >= 3) break;
        if (friend.presence) {
          console.log(`  ${friend.displayName}: ${JSON.stringify(friend.presence).slice(0, 150)}`);
          output.presence = output.presence || {};
          output.presence[friend.displayName] = friend.presence;
        }
        count++;
      }
    }

    await client.logout().catch(() => {});
  } catch (err) {
    console.error('fnbr error:', err.message);
  }

  // Write full output
  const outPath = './session_exploration.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);

  console.log('\n=== DONE ===');
  process.exit(0);
})();
