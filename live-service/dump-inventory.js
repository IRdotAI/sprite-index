require('dotenv').config();
const fs = require('fs');

const { ACCOUNT_ID, DEVICE_ID, SECRET } = process.env;

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
  const data = await res.json();
  return { token: data.access_token, accountId: data.account_id, displayName: data.displayName };
}

(async () => {
  console.log('=== BR INVENTORY + CLOUDSTORAGE DUMP ===\n');

  const { token, accountId, displayName } = await getToken();
  console.log(`Connected as: ${displayName}`);
  console.log(`Account ID: ${accountId}\n`);

  const output = {
    accountId,
    displayName,
    timestamp: new Date().toISOString(),
    brInventory: null,
    cloudStorage: null,
    cloudStorageFiles: {},
  };

  // ========== 1. BR Inventory ==========
  console.log('=== BR INVENTORY ===\n');

  const invRes = await fetch(`${MCP_BASE}/fortnite/api/game/v2/br-inventory/account/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (invRes.ok) {
    const invData = await invRes.json();
    output.brInventory = invData;

    console.log('BR Inventory top-level keys:', Object.keys(invData));

    // Analyze stash
    if (invData.stash) {
      console.log('\nStash contents:');
      for (const [key, val] of Object.entries(invData.stash)) {
        const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
        console.log(`  ${key}: ${valStr.slice(0, 100)}`);
      }

      // Search for sprite keywords
      const stashStr = JSON.stringify(invData.stash).toLowerCase();
      const keywords = ['sprite', 'creature', 'dust', 'collection', 'figurine', 'blockstack', 'summon'];
      console.log('\nKeyword search in stash:');
      for (const kw of keywords) {
        if (stashStr.includes(kw)) {
          console.log(`  ✓ Found: ${kw}`);
        }
      }
    }

    // Check all keys recursively for keywords
    const fullStr = JSON.stringify(invData).toLowerCase();
    console.log('\nKeyword search in full response:');
    const keywords = ['sprite', 'creature', 'dust', 'collection', 'figurine', 'blockstack', 'summon', 'companion', 'pet'];
    for (const kw of keywords) {
      if (fullStr.includes(kw)) {
        console.log(`  ✓ Found: ${kw}`);
      }
    }
  } else {
    console.log(`BR Inventory failed: ${invRes.status}`);
    output.brInventory = { error: invRes.status };
  }

  // ========== 2. Cloud Storage ==========
  console.log('\n=== CLOUD STORAGE ===\n');

  const csRes = await fetch(`${MCP_BASE}/fortnite/api/cloudstorage/user/${accountId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (csRes.ok) {
    const csData = await csRes.json();
    output.cloudStorage = csData;

    console.log(`Found ${csData.length} cloud storage files:\n`);

    for (const file of csData) {
      console.log(`File: ${file.filename || file.uniqueFilename}`);
      console.log(`  Size: ${file.length} bytes`);
      console.log(`  Uploaded: ${file.uploaded}`);

      // Try to fetch small files (< 100KB)
      if (file.length < 100000) {
        const fileUrl = `${MCP_BASE}/fortnite/api/cloudstorage/user/${accountId}/${file.uniqueFilename}`;
        try {
          const fileRes = await fetch(fileUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (fileRes.ok) {
            const contentType = fileRes.headers.get('content-type') || '';
            const fileData = await fileRes.text();

            // Try to parse as JSON
            let parsed = null;
            try {
              parsed = JSON.parse(fileData);
              console.log(`  Content: JSON (${Object.keys(parsed).length} keys)`);
            } catch {
              // Check if it looks like structured data
              if (fileData.startsWith('{') || fileData.startsWith('[')) {
                console.log(`  Content: JSON-like but failed to parse`);
              } else {
                console.log(`  Content: Binary/text (first 50 chars: ${fileData.slice(0, 50).replace(/[^\x20-\x7E]/g, '?')})`);
              }
            }

            output.cloudStorageFiles[file.uniqueFilename] = {
              filename: file.filename,
              length: file.length,
              contentType,
              parsed,
              raw: parsed ? null : fileData.slice(0, 500), // Only store raw if not JSON
            };

            // Search for keywords in file content
            const contentLower = fileData.toLowerCase();
            const keywords = ['sprite', 'creature', 'dust', 'collection', 'figurine', 'blockstack'];
            for (const kw of keywords) {
              if (contentLower.includes(kw)) {
                console.log(`  ⚠️  KEYWORD FOUND: ${kw}`);
              }
            }
          }
        } catch (e) {
          console.log(`  Failed to fetch: ${e.message}`);
        }
      } else {
        console.log(`  (skipped - too large)`);
      }
      console.log();
    }
  } else {
    console.log(`Cloud Storage failed: ${csRes.status}`);
    output.cloudStorage = { error: csRes.status };
  }

  // Write output
  const outPath = './br_inventory_dump.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);

  console.log('\n=== DONE ===');
})();
