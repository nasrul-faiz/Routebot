import 'dotenv/config';
import axios from 'axios';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { pathToFileURL } from 'url';
import { buildLocationLinks as buildLocationLinksFromPoint, chunkLinksForButtons } from './link-buttons.js';

let baileysModule;
let useInteractiveButtons = false;

try {
  baileysModule = await import('atexovi-baileys');
  useInteractiveButtons = true;
} catch (error) {
  console.warn('atexovi-baileys unavailable, using @whiskeysockets/baileys fallback:', error.message || error);
  baileysModule = await import('@whiskeysockets/baileys');
}

const makeWASocket = baileysModule.default ?? baileysModule.makeWASocket;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = baileysModule;

function buildRuntimeConfig(overrides = {}) {
  const merged = {
    appBaseUrl: process.env.APP_BASE_URL || '',
    commandPrefix: process.env.COMMAND_PREFIX || '!',
    authDir: process.env.AUTH_DIR || '.wa-auth',
    allowedNumbers: process.env.ALLOWED_NUMBERS || '',
    ...overrides,
  };

  const appBaseUrl = String(merged.appBaseUrl || '').replace(/\/$/, '');
  const commandPrefix = String(merged.commandPrefix || '!');
  const authDir = String(merged.authDir || '.wa-auth');
  const allowedNumbers = new Set(
    String(merged.allowedNumbers || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\D/g, '')),
  );

  return { appBaseUrl, commandPrefix, authDir, allowedNumbers };
}

function createHttpClient(baseUrl) {
  return axios.create({
    baseURL: baseUrl,
    timeout: 15000,
  });
}

const logger = pino({ level: 'info' });

function getTextMessageContent(message) {
  if (!message) return '';

  return (
    message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || message.documentMessage?.caption
    || ''
  );
}

function normalizeSender(jid) {
  if (!jid) return '';
  return jid.split('@')[0].replace(/\D/g, '');
}

function isAllowedSender(jid, allowedNumbers) {
  if (allowedNumbers.size === 0) return true;
  const sender = normalizeSender(jid);
  return allowedNumbers.has(sender);
}

function isDeliveryActiveToday(deliveryLabel, date = new Date()) {
  const label = String(deliveryLabel || '').trim().toLowerCase();
  if (!label) return true;

  if (label === 'daily') return true;
  if (label === 'weekday') return date.getDay() >= 1 && date.getDay() <= 5;
  if (label === 'alt 1') return date.getDate() % 2 === 1;
  if (label === 'alt 2') return date.getDate() % 2 === 0;

  return true;
}

async function fetchRoutes(http) {
  const response = await http.get('/api/routes');
  if (!response.data?.success || !Array.isArray(response.data?.data)) {
    throw new Error('Invalid response from /api/routes');
  }
  return response.data.data;
}

function summarizeRoutes(routes) {
  if (routes.length === 0) {
    return 'Tiada route dalam sistem.';
  }

  const lines = routes.slice(0, 20).map((route, idx) => {
    const points = Array.isArray(route.deliveryPoints) ? route.deliveryPoints : [];
    return `${idx + 1}. ${route.name} (${route.code} - ${route.shift}) | Stops: ${points.length}`;
  });

  const extra = routes.length > 20 ? `\n... +${routes.length - 20} route lagi` : '';
  return `Route Summary\nTotal route: ${routes.length}\n\n${lines.join('\n')}${extra}`;
}

function summarizeRouteDetail(route) {
  const points = Array.isArray(route.deliveryPoints) ? route.deliveryPoints : [];
  const activePoints = points.filter((point) => isDeliveryActiveToday(point.delivery));
  const lines = points.slice(0, 30).map((point, idx) => {
    const delivery = point.delivery || 'Daily';
    return `${idx + 1}. [${point.code}] ${point.name} (${delivery})`;
  });
  const extra = points.length > 30 ? `\n... +${points.length - 30} lokasi lagi` : '';

  return [
    `Route: ${route.name}`,
    `Code: ${route.code}`,
    `Shift: ${route.shift}`,
    `Total stops: ${points.length}`,
    `Active today: ${activePoints.length}`,
    '',
    'Lokasi:',
    lines.join('\n') + extra,
  ].join('\n');
}

function findRoute(routes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const byCodeExact = routes.find((route) => String(route.code || '').trim().toLowerCase() === q);
  if (byCodeExact) return byCodeExact;

  const byNameExact = routes.find((route) => String(route.name || '').trim().toLowerCase() === q);
  if (byNameExact) return byNameExact;

  const byCodeContains = routes.find((route) => String(route.code || '').toLowerCase().includes(q));
  if (byCodeContains) return byCodeContains;

  return routes.find((route) => String(route.name || '').toLowerCase().includes(q)) || null;
}

function flattenLocations(routes) {
  const locations = [];
  for (const route of routes) {
    const points = Array.isArray(route.deliveryPoints) ? route.deliveryPoints : [];
    for (const point of points) {
      if (!point || typeof point !== 'object') continue;
      locations.push({ route, point });
    }
  }
  return locations;
}

function findLocationByCode(routes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  const locations = flattenLocations(routes);
  const exact = locations.find(({ point }) => String(point.code || '').trim().toLowerCase() === q);
  if (exact) return exact;

  return locations.find(({ point }) => String(point.code || '').toLowerCase().includes(q)) || null;
}

function isLikelyImageUrl(url) {
  if (!url) return false;
  const cleaned = String(url).trim();
  if (!cleaned) return false;
  if (cleaned.startsWith('data:image/')) return true;
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return !/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(cleaned);
  }
  return false;
}

function getLocationPrimaryImage(point) {
  const avatarImages = Array.isArray(point.avatarImages) ? point.avatarImages : [];
  const candidates = [
    ...avatarImages,
    point.avatarImageUrl,
    point.qrCodeImageUrl,
  ];
  return candidates.find((url) => isLikelyImageUrl(url)) || null;
}

function buildLocationLinks(point) {
  return buildLocationLinksFromPoint(point);
}

function formatPointDescriptions(point) {
  const descriptions = Array.isArray(point.descriptions) ? point.descriptions : [];
  const lines = descriptions
    .map((item) => {
      const key = String(item?.key || '').trim();
      const value = String(item?.value || '').trim();
      if (!key || !value) return null;
      return `- ${key}: ${value}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '';
}

function buildLocationSummary(route, point) {
  const delivery = point.delivery || 'Daily';
  return [
    `Lokasi [${point.code}] ${point.name}`,
    `Route: ${route.name} (${route.code} - ${route.shift})`,
    `Delivery: ${delivery}`,
  ].join('\n');
}

async function sendLocationLinksWithFallback(sock, jid, quotedMessage, links) {
  if (links.length === 0) return true;

  const messageChunks = chunkLinksForButtons(links);

  let sentButtons = false;

  for (let i = 0; i < messageChunks.length; i += 1) {
    const chunk = messageChunks[i];
    const intro = i === 0 ? 'Pilih link di bawah:' : 'Pilihan link tambahan:';
    try {
      const messagePayload = useInteractiveButtons
        ? {
            text: intro,
            footer: 'Routebot',
            interactiveButtons: chunk.map((link) => ({
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: link.label,
                url: link.url,
                merchant_url: link.url,
              }),
            })),
          }
        : {
            text: intro,
            footer: 'Routebot',
            templateButtons: chunk.map((link, index) => ({
              index: index + 1,
              urlButton: {
                displayText: link.label,
                url: link.url,
              },
            })),
          };

      await sock.sendMessage(
        jid,
        messagePayload,
        { quoted: quotedMessage },
      );
      sentButtons = true;
    } catch (error) {
      console.warn('Failed to send interactive buttons, fallback to text links:', error);
      sentButtons = false;
      break;
    }
  }

  if (!sentButtons) {
    const linkText = links
      .map((link, idx) => `${idx + 1}. ${link.label}: ${link.url}`)
      .join('\n');
    await sock.sendMessage(
      jid,
      { text: `Link lokasi:\n${linkText}` },
      { quoted: quotedMessage },
    );
  }

  return sentButtons;
}

async function sendLocationResponse(sock, jid, quotedMessage, route, point) {
  const summary = buildLocationSummary(route, point);
  const imageUrl = getLocationPrimaryImage(point);
  const links = buildLocationLinks(point);
  const descriptions = formatPointDescriptions(point);

  if (imageUrl) {
    try {
      await sock.sendMessage(
        jid,
        {
          image: { url: imageUrl },
          caption: summary,
        },
        { quoted: quotedMessage },
      );
    } catch (error) {
      console.warn('Failed to send location image, fallback to text summary:', error);
      await sock.sendMessage(jid, { text: summary }, { quoted: quotedMessage });
    }
  } else {
    await sock.sendMessage(jid, { text: summary }, { quoted: quotedMessage });
  }

  const sentButtons = await sendLocationLinksWithFallback(sock, jid, quotedMessage, links);

  if (descriptions) {
    await sock.sendMessage(
      jid,
      { text: `Description:\n${descriptions}` },
      { quoted: quotedMessage },
    );
  }

  if (!sentButtons && links.length > 0) {
    const allLinksText = links
      .map((link, idx) => `${idx + 1}. ${link.label}: ${link.url}`)
      .join('\n');
    await sock.sendMessage(
      jid,
      { text: `Semua link:\n${allLinksText}` },
      { quoted: quotedMessage },
    );
  }
}

async function executeCommand(text, runtime) {
  const { commandPrefix, http } = runtime;
  const raw = text.trim();
  if (!raw.startsWith(commandPrefix)) return null;

  const withoutPrefix = raw.slice(commandPrefix.length).trim();
  if (!withoutPrefix) return null;

  const [name, ...rest] = withoutPrefix.split(/\s+/);
  const command = name.toLowerCase();
  const arg = rest.join(' ').trim();

  if (command === 'help') {
    return [
      `Command list (${commandPrefix})`,
      `${commandPrefix}help - Tunjuk bantuan`,
      `${commandPrefix}ping - Cek bot aktif`,
      `${commandPrefix}routes - Senarai semua route`,
      `${commandPrefix}route <code|name> - Detail route`,
      `${commandPrefix}today - Ringkasan stop aktif hari ini`,
      `${commandPrefix}<location_code> - Detail lokasi + gambar + link (contoh: ${commandPrefix}33)`,
    ].join('\n');
  }

  if (command === 'ping') {
    return 'Bot aktif.';
  }

  if (command === 'routes') {
    const routes = await fetchRoutes(http);
    return summarizeRoutes(routes);
  }

  if (command === 'route') {
    if (!arg) {
      return `Sila isi code atau nama route.\nContoh: ${commandPrefix}route 3PVK04`;
    }

    const routes = await fetchRoutes(http);
    const route = findRoute(routes, arg);
    if (!route) {
      return `Route tidak dijumpai untuk: ${arg}`;
    }

    return summarizeRouteDetail(route);
  }

  if (command === 'today') {
    const routes = await fetchRoutes(http);
    const details = routes.map((route) => {
      const points = Array.isArray(route.deliveryPoints) ? route.deliveryPoints : [];
      const active = points.filter((point) => isDeliveryActiveToday(point.delivery)).length;
      return { route, total: points.length, active };
    });

    const lines = details.slice(0, 20).map((item, idx) => (
      `${idx + 1}. ${item.route.code} ${item.route.name} | Active ${item.active}/${item.total}`
    ));
    const extra = details.length > 20 ? `\n... +${details.length - 20} route lagi` : '';

    return `Active Stops Today\n\n${lines.join('\n')}${extra}`;
  }

  if (!arg) {
    const routes = await fetchRoutes(http);
    const foundLocation = findLocationByCode(routes, command);
    if (foundLocation) {
      return {
        type: 'location',
        route: foundLocation.route,
        point: foundLocation.point,
      };
    }
  }

  return `Command tidak dikenali. Guna ${commandPrefix}help`;
}

export async function startBot(overrides = {}) {
  const onQr = typeof overrides.onQr === 'function' ? overrides.onQr : null;
  const onStatus = typeof overrides.onStatus === 'function' ? overrides.onStatus : null;
  const printTerminalQr = overrides.printTerminalQr !== false;
  const { appBaseUrl, commandPrefix, authDir, allowedNumbers } = buildRuntimeConfig(overrides);
  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is required. Example: https://your-app.vercel.app');
  }

  onStatus?.('starting');

  const http = createHttpClient(appBaseUrl);
  const runtime = { commandPrefix, allowedNumbers, http };

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger,
    browser: ['Routebot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      onQr?.(qr);
      onStatus?.('qr');
      if (printTerminalQr) {
        console.log('\nScan QR ini dalam WhatsApp > Linked Devices > Link a Device\n');
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === 'open') {
      onStatus?.('connected');
      console.log('WhatsApp bot connected.');
    }

    if (connection === 'close') {
      onStatus?.('closed');
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        onStatus?.('reconnecting');
        console.log('Connection closed. Reconnecting...');
        startBot(overrides).catch((err) => {
          onStatus?.('error');
          console.error('Reconnect failed:', err);
        });
      } else {
        onStatus?.('logged-out');
        console.log('Logged out. Delete auth folder and re-run to pair again.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const remoteJid = msg.key.remoteJid;
        const senderJid = msg.key.participant || remoteJid;
        if (!remoteJid || !senderJid) continue;

        if (!isAllowedSender(senderJid, runtime.allowedNumbers)) {
          await sock.sendMessage(remoteJid, {
            text: 'Anda tidak dibenarkan guna bot ini.',
          });
          continue;
        }

        const text = getTextMessageContent(msg.message).trim();
        if (!text.startsWith(runtime.commandPrefix)) continue;

        const reply = await executeCommand(text, runtime);
        if (!reply) continue;

        if (typeof reply === 'string') {
          await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
          continue;
        }

        if (reply.type === 'location' && reply.route && reply.point) {
          await sendLocationResponse(sock, remoteJid, msg, reply.route, reply.point);
          continue;
        }
      } catch (error) {
        onStatus?.('error');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Message handling error:', errorMessage);
        try {
          const jid = msg.key.remoteJid;
          if (jid) {
            await sock.sendMessage(jid, {
              text: `Ralat: ${errorMessage}`,
            });
          }
        } catch {
          // Ignore send error for error response.
        }
      }
    }
  });

  return sock;
}

const entryArg = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryArg) {
  startBot().catch((error) => {
    console.error('Fatal startup error:', error);
    process.exit(1);
  });
}
