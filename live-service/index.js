require('dotenv').config();
const { Client } = require('fnbr');

const { ACCOUNT_ID, DEVICE_ID, SECRET } = process.env;

if (!ACCOUNT_ID || !DEVICE_ID || !SECRET) {
  console.error('Missing required env vars: ACCOUNT_ID, DEVICE_ID, SECRET');
  console.error('Create a .env file with your device auth credentials');
  process.exit(1);
}

function timestamp() {
  return new Date().toISOString();
}

function logEvent(eventName, ...args) {
  console.log(`\n[${timestamp()}] EVENT: ${eventName}`);
  args.forEach((arg, i) => {
    try {
      // Try to get raw data if it's an fnbr object
      const data = arg?.toJSON?.() || arg?.data || arg;
      console.log(`  arg[${i}]:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log(`  arg[${i}]:`, arg);
    }
  });
}

(async () => {
  console.log(`[${timestamp()}] Starting fnbr client...`);
  console.log(`[${timestamp()}] Account ID: ${ACCOUNT_ID}`);

  const client = new Client({
    auth: {
      deviceAuth: {
        accountId: ACCOUNT_ID,
        deviceId: DEVICE_ID,
        secret: SECRET,
      },
    },
    // Don't auto-join parties
    partyConfig: {
      joinConfirmation: false,
    },
  });

  // Cast wide net: log ALL events fnbr emits
  const events = [
    // Connection/session
    'ready',
    'deviceauth:created',
    'refreshtoken:created',
    'disconnected',
    'reconnect',

    // Friends
    'friend:added',
    'friend:removed',
    'friend:request',
    'friend:request:sent',
    'friend:request:aborted',
    'friend:presence',
    'friend:message',

    // Party
    'party:created',
    'party:joined',
    'party:updated',
    'party:left',
    'party:invite',
    'party:member:joined',
    'party:member:left',
    'party:member:updated',
    'party:member:expired',
    'party:member:kicked',
    'party:member:disconnected',
    'party:member:promoted',
    'party:member:confirmation',
    'party:member:state:updated',
    'party:message',

    // Presence
    'presence:updated',

    // XMPP raw
    'xmpp:message',
    'xmpp:presence',
    'xmpp:stanza',

    // MCP / Profile events (if any)
    'mcp:response',
    'profile:updated',

    // Catch-all for anything we might miss
    'raw',
    'error',
  ];

  events.forEach(eventName => {
    client.on(eventName, (...args) => logEvent(eventName, ...args));
  });

  // Also try to catch any event at all via newListener
  client.on('newListener', (event) => {
    if (!events.includes(event)) {
      console.log(`[${timestamp()}] New listener registered for: ${event}`);
    }
  });

  try {
    await client.login();
    console.log(`\n[${timestamp()}] === CONNECTED as ${client.user.displayName} ===`);
    console.log(`[${timestamp()}] Account ID: ${client.user.id}`);
    console.log(`[${timestamp()}] Listening for events... (Ctrl+C to stop)\n`);
  } catch (err) {
    console.error(`[${timestamp()}] Login failed:`, err.message);
    process.exit(1);
  }

  // Keep alive
  process.on('SIGINT', () => {
    console.log(`\n[${timestamp()}] Shutting down...`);
    client.logout();
    process.exit(0);
  });
})();
