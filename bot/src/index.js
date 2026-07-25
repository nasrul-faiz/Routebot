import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createInterface } from 'node:readline/promises';
import { config as loadDotenv } from 'dotenv';
import axios from 'axios';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { buildLocationLinks as buildLocationLinksFromPoint, chunkLinksForButtons } from './link-buttons.js';
import { buildTtsCommandResult } from './tts.js';
import { buildUnzipCommandReply, buildZipCommandReply, buildZipMediaCommandReply } from './zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const botDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(botDir, '..');

function loadEnvironment() {
  const rootEnvPath = path.join(rootDir, '.env');
  const botEnvPath = path.join(botDir, '.env');

  // Load shared root env first, then allow bot-specific overrides.
  if (fs.existsSync(rootEnvPath)) {
    loadDotenv({ path: rootEnvPath, override: false });
  }
  if (fs.existsSync(botEnvPath)) {
    loadDotenv({ path: botEnvPath, override: true });
  }
}

loadEnvironment();

let baileysModule;
let useInteractiveButtons = false;

try {
  baileysModule = await import('atexovi-baileys');
  useInteractiveButtons = true;
} catch (error) {
  console.warn('atexovi-baileys unavailable, using @whiskeysockets/baileys fallback:', error.message || error);
  baileysModule = await import('@whiskeysockets/baileys');
}

const makeWASocket =
  (typeof baileysModule.default === 'function' ? baileysModule.default : null)
  || baileysModule.makeWASocket
  || baileysModule.default?.makeWASocket;
const downloadContentFromMessage = baileysModule.downloadContentFromMessage ?? baileysModule.default?.downloadContentFromMessage;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = {
  DisconnectReason: baileysModule.DisconnectReason ?? baileysModule.default?.DisconnectReason,
  fetchLatestBaileysVersion: baileysModule.fetchLatestBaileysVersion ?? baileysModule.default?.fetchLatestBaileysVersion,
  useMultiFileAuthState: baileysModule.useMultiFileAuthState ?? baileysModule.default?.useMultiFileAuthState,
};

function buildRuntimeConfig(overrides = {}) {
  const merged = {
    appBaseUrl: process.env.APP_BASE_URL || '',
    commandPrefix: process.env.COMMAND_PREFIX || '.',
    authDir: process.env.AUTH_DIR || '.wa-auth',
    allowedNumbers: process.env.ALLOWED_NUMBERS || '',
    ...overrides,
  };

  const appBaseUrl = String(merged.appBaseUrl || '').replace(/\/$/, '');
  const commandPrefix = String(merged.commandPrefix || '.');
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

export function normalizePhoneNumber(value) {
  return String(value || '').trim().replace(/\D/g, '');
}

async function choosePairingMethod(overrides = {}) {
  const configuredMethod = String(
    overrides.pairingMethod
    || process.env.BOT_PAIRING_METHOD
    || process.env.PAIRING_METHOD
    || '',
  ).trim().toLowerCase();

  if (configuredMethod === 'qr' || configuredMethod === 'phone') {
    return configuredMethod;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return 'qr';
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = String(
        await rl.question('Pilih pairing: [1] QR code / [2] number phone: '),
      ).trim().toLowerCase();

      if (answer === '1' || answer === 'qr' || answer === 'q') return 'qr';
      if (answer === '2' || answer === 'phone' || answer === 'p') return 'phone';
    }
  } finally {
    rl.close();
  }
}

async function choosePairingPhoneNumber(overrides = {}) {
  const configuredNumber = normalizePhoneNumber(
    overrides.pairingPhoneNumber
    || process.env.BOT_PAIRING_PHONE_NUMBER
    || process.env.PAIRING_PHONE_NUMBER
    || '',
  );

  if (configuredNumber) {
    return configuredNumber;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('PAIRING_PHONE_NUMBER is required for phone pairing when stdin is not interactive.');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = normalizePhoneNumber(
        await rl.question('Masukkan nombor telefon untuk pairing (contoh 60123456789): '),
      );

      if (answer) return answer;
    }
  } finally {
    rl.close();
  }
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

function getQuotedMessageContent(message) {
  const contextInfo =
    message?.extendedTextMessage?.contextInfo
    || message?.imageMessage?.contextInfo
    || message?.videoMessage?.contextInfo
    || message?.documentMessage?.contextInfo
    || message?.audioMessage?.contextInfo
    || null;

  const quotedMessage = contextInfo?.quotedMessage;
  if (!quotedMessage) return '';

  return getTextMessageContent(quotedMessage);
}

function hasDownloadableMedia(media) {
  return Boolean(media && (media.url || media.thumbnailDirectPath));
}

function getMessageMedia(message) {
  const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'stickerMessage'];

  for (const key of mediaKeys) {
    const media = message?.[key];
    if (media && typeof media === 'object' && hasDownloadableMedia(media)) {
      return {
        mediaType: key.replace('Message', ''),
        media,
      };
    }
  }

  const nestedMessage = message?.viewOnceMessage?.message || message?.viewOnceMessageV2?.message;
  if (nestedMessage && typeof nestedMessage === 'object') {
    return getMessageMedia(nestedMessage);
  }

  return null;
}

function getQuotedMediaMessage(message) {
  const contextInfo =
    message?.extendedTextMessage?.contextInfo
    || message?.imageMessage?.contextInfo
    || message?.videoMessage?.contextInfo
    || message?.documentMessage?.contextInfo
    || message?.audioMessage?.contextInfo
    || null;

  const quotedMessage = contextInfo?.quotedMessage;
  if (!quotedMessage) return null;

  const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'stickerMessage'];
  for (const key of mediaKeys) {
    const media = quotedMessage[key];
    if (media && typeof media === 'object' && hasDownloadableMedia(media)) {
      return {
        quotedMessage,
        mediaType: key.replace('Message', ''),
        media,
      };
    }
  }

  const nestedQuotedMessage = quotedMessage?.viewOnceMessage?.message || quotedMessage?.viewOnceMessageV2?.message;
  if (nestedQuotedMessage && typeof nestedQuotedMessage === 'object') {
    return getMessageMedia(nestedQuotedMessage);
  }

  return null;
}

function getAllQuotedMediaMessages(message) {
  const results = [];
  const contextInfo =
    message?.extendedTextMessage?.contextInfo
    || message?.imageMessage?.contextInfo
    || message?.videoMessage?.contextInfo
    || message?.documentMessage?.contextInfo
    || message?.audioMessage?.contextInfo
    || null;

  const quotedMessage = contextInfo?.quotedMessage;
  if (!quotedMessage) return results;

  const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'stickerMessage'];
  for (const key of mediaKeys) {
    const media = quotedMessage[key];
    if (media && typeof media === 'object' && hasDownloadableMedia(media)) {
      results.push({
        quotedMessage,
        mediaType: key.replace('Message', ''),
        media,
      });
    }
  }

  if (results.length > 0) return results;

  const nestedQuotedMessage = quotedMessage?.viewOnceMessage?.message || quotedMessage?.viewOnceMessageV2?.message;
  if (nestedQuotedMessage && typeof nestedQuotedMessage === 'object') {
    const nestedMedia = getMessageMedia(nestedQuotedMessage);
    if (nestedMedia) {
      results.push(nestedMedia);
    }
  }

  return results;
}

function isViewOnceMedia(media) {
  return Boolean(media?.viewOnce || media?.isViewOnce || media?.viewOnceMessage);
}

function getQuotedMediaFileName(mediaType, media) {
  const fallbackExtByType = {
    image: 'jpg',
    video: 'mp4',
    audio: 'mp3',
    sticker: 'webp',
    document: 'bin',
  };

  const fileName = String(media?.fileName || '').trim();
  if (mediaType === 'document' && fileName) return fileName;

  const extension = fileName.includes('.')
    ? fileName.split('.').pop()
    : fallbackExtByType[mediaType] || 'bin';

  return `quoted-${mediaType}.${extension}`;
}

async function downloadQuotedMediaBuffer(media, mediaType) {
  if (typeof downloadContentFromMessage !== 'function') {
    return null;
  }

  try {
    const stream = await downloadContentFromMessage(media, mediaType, {});
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.warn('Failed to download quoted media:', error);
    return null;
  }
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
  const qrCodeImageUrl = String(point.qrCodeImageUrl || '').trim();
  const candidates = [
    ...avatarImages,
    point.avatarImageUrl,
  ];
  return candidates.find((url) => {
    if (!isLikelyImageUrl(url)) return false;
    if (!qrCodeImageUrl) return true;
    return String(url || '').trim() !== qrCodeImageUrl;
  }) || null;
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

async function resolveStickerHelpers(runtime = {}) {
  const runtimeBuilder = typeof runtime.buildStickerCommandReply === 'function'
    ? runtime.buildStickerCommandReply
    : null;
  const runtimeFlagParser = typeof runtime.parseStickerCommandFlags === 'function'
    ? runtime.parseStickerCommandFlags
    : null;

  if (runtimeBuilder && runtimeFlagParser) {
    return {
      buildStickerCommandReply: runtimeBuilder,
      parseStickerCommandFlags: runtimeFlagParser,
    };
  }

  try {
    const module = await import('./sticker.js');
    return {
      buildStickerCommandReply: runtimeBuilder || module.buildStickerCommandReply,
      parseStickerCommandFlags: runtimeFlagParser || module.parseStickerCommandFlags,
    };
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

function buildLocationMessage(summary, descriptions) {
  if (!descriptions) return summary;

  return [
    summary,
    '',
    'Description:',
    descriptions,
  ].join('\n');
}

export function buildTtsAudioMessage(audioBuffer) {
  return {
    audio: audioBuffer,
    mimetype: 'audio/mpeg',
    ptt: false,
  };
}

async function sendLocationLinksWithFallback(sock, jid, quotedMessage, links, textBody = '') {
  if (links.length === 0) return true;

  const messageChunks = chunkLinksForButtons(links);

  let sentButtons = false;

  for (let i = 0; i < messageChunks.length; i += 1) {
    const chunk = messageChunks[i];
    const intro = i === 0
      ? (textBody || 'Pilih link di bawah:')
      : 'Pilihan link tambahan:';
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
  const locationMessage = buildLocationMessage(summary, descriptions);

  if (imageUrl) {
    try {
      await sock.sendMessage(
        jid,
        {
          image: { url: imageUrl },
        },
        { quoted: quotedMessage },
      );
    } catch (error) {
      console.warn('Failed to send location image, fallback to text summary:', error);
      await sock.sendMessage(jid, { text: locationMessage }, { quoted: quotedMessage });
    }
  }

  if (links.length === 0) {
    await sock.sendMessage(
      jid,
      { text: locationMessage },
      { quoted: quotedMessage },
    );
    return;
  }

  const sentButtons = await sendLocationLinksWithFallback(
    sock,
    jid,
    quotedMessage,
    links,
    locationMessage,
  );

  if (!sentButtons && links.length > 0) {
    await sock.sendMessage(jid, { text: locationMessage }, { quoted: quotedMessage });

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

export async function executeCommand(text, runtime, message = null) {
  const { commandPrefix, http } = runtime;
  const raw = text.trim();
  const quotedText = getQuotedMessageContent(message);
  const quotedMedia = getQuotedMediaMessage(message);
  const quotedMediaDownloader = typeof runtime.downloadQuotedMediaBuffer === 'function'
    ? runtime.downloadQuotedMediaBuffer
    : downloadQuotedMediaBuffer;

  if (/^\.[0-9]+$/.test(raw)) {
    const locationCode = raw.slice(1);
    try {
      const routes = await fetchRoutes(http);
      const foundLocation = findLocationByCode(routes, locationCode);
      if (foundLocation) {
        return {
          type: 'location',
          route: foundLocation.route,
          point: foundLocation.point,
        };
      }

      return `Lokasi tidak dijumpai untuk: ${locationCode}`;
    } catch (error) {
      console.warn('Failed to resolve dot location command:', error);
    }
  }

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
      `${commandPrefix}tts <text> - Hantar teks + audio TTS`,
      `${commandPrefix}vv - Hantar semula media view-once (gambar/video)`,
      `${commandPrefix}qr <text> - Hasilkan QR code PNG berkualiti tinggi`,
      `${commandPrefix}txt <text> - Hasilkan fail .txt daripada teks`,
      `${commandPrefix}pdf <text> - Hasilkan fail .pdf daripada teks`,
      `${commandPrefix}sticker - Reply gambar/video jadi sticker`,
      `${commandPrefix}sticker nobg - Reply gambar jadi sticker tanpa background`,
      `${commandPrefix}zip <text> - Compress teks ke gzip+base64 atau reply media jadi zip file`,
      `${commandPrefix}unzip <base64> - Nyahmampat gzip+base64 atau reply chat/media ke teks`,
      `${commandPrefix}<location_code> - Detail lokasi + gambar + link`,
      `.<location_code> - Alias lokasi guna dot (contoh: .33)`,
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

  if (command === 'tts' || command === 'voice') {
    const textToRead = arg || quotedText || 'Halo, bot Routebot siap membantu.';
    return buildTtsCommandResult(textToRead, { lang: 'ms' });
  }

  if (command === 'vv') {
    const sourceMedia = getMessageMedia(message) || quotedMedia;
    if (!sourceMedia) {
      return `Hantar atau reply media view-once (gambar/video) dan kemudian ${commandPrefix}vv`;
    }

    if (sourceMedia.mediaType !== 'image' && sourceMedia.mediaType !== 'video') {
      return 'Media ini tidak disokong untuk .vv. Guna gambar atau video view-once.';
    }

    if (!isViewOnceMedia(sourceMedia.media)) {
      return 'Media ini bukan view-once. Hantar gambar/video view-once dan cuba lagi.';
    }

    const mediaBuffer = await quotedMediaDownloader(sourceMedia.media, sourceMedia.mediaType);
    if (!mediaBuffer) {
      return 'Gagal memuat turun media view-once.';
    }

    const caption = arg || quotedText || '';

    return {
      type: 'view-once',
      mediaBuffer,
      mediaType: sourceMedia.mediaType,
      mimetype: sourceMedia.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      caption: caption || undefined,
    };
  }

  if (command === 'qr') {
    const qrText = arg || quotedText || '';
    if (!qrText) {
      return `Sila isi teks untuk QR code. Contoh: ${commandPrefix}qr https://example.com`;
    }

    const qrBuffer = await QRCode.toBuffer(qrText, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return {
      type: 'qrcode',
      imageBuffer: qrBuffer,
      mimetype: 'image/png',
      caption: qrText,
    };
  }

  if (command === 'txt') {
    const textContent = arg || quotedText || '';
    if (!textContent) {
      return `Sila isi teks untuk fail .txt. Contoh: ${commandPrefix}txt hello world`;
    }

    return {
      type: 'document',
      document: Buffer.from(textContent, 'utf8'),
      fileName: 'document.txt',
      mimetype: 'text/plain',
    };
  }

  if (command === 'pdf') {
    const textContent = arg || quotedText || '';
    const allQuotedMedia = getAllQuotedMediaMessages(message);
    const supportedMedia = allQuotedMedia.filter((item) => item.mediaType === 'image');

    const imageBuffers = [];
    for (const item of supportedMedia) {
      const mediaBuffer = await quotedMediaDownloader(item.media, item.mediaType);
      if (mediaBuffer) {
        imageBuffers.push(mediaBuffer);
      }
    }

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (textContent) {
        doc.fontSize(12).text(textContent, { align: 'left' });
        doc.moveDown(1.2);
      }

      if (imageBuffers.length > 0) {
        imageBuffers.forEach((imageBuffer, index) => {
          try {
            doc.image(Buffer.from(imageBuffer), {
              fit: [500, 250],
              align: 'center',
              valign: 'center',
            });
            if (index < imageBuffers.length - 1) {
              doc.moveDown(0.7);
            }
          } catch (error) {
            console.warn('Failed to embed image into PDF:', error);
            doc.fontSize(10).text('Satu atau lebih gambar tidak dapat dimasukkan ke dalam PDF.', { align: 'left' });
          }
        });
      } else if (allQuotedMedia.length > 0) {
        doc.fontSize(10).text('Hanya gambar yang disokong untuk PDF. Video tidak dimasukkan.', { align: 'left' });
      }

      doc.end();
    });

    return {
      type: 'document',
      document: pdfBuffer,
      fileName: 'document.pdf',
      mimetype: 'application/pdf',
    };
  }

  if (command === 'sticker' || command === 'stiker') {
    if (!quotedMedia) {
      return `Reply gambar/video dan hantar ${commandPrefix}sticker`;
    }

    if (quotedMedia.mediaType !== 'image' && quotedMedia.mediaType !== 'video') {
      return 'Media tidak disokong untuk sticker. Guna gambar atau video.';
    }

    const mediaBuffer = await quotedMediaDownloader(quotedMedia.media, quotedMedia.mediaType);
    if (!mediaBuffer) {
      return 'Gagal memuat turun media yang direply untuk diproses jadi sticker.';
    }

    const stickerHelpers = await resolveStickerHelpers(runtime);
    if (!stickerHelpers) {
      return 'Fitur sticker belum tersedia pada server ini. Sila pasang dependency sticker dan restart bot.';
    }

    const flags = stickerHelpers.parseStickerCommandFlags(arg);
    const stickerBuilder = stickerHelpers.buildStickerCommandReply;

    return stickerBuilder(mediaBuffer, {
      mediaType: quotedMedia.mediaType,
      removeBackground: flags.removeBackground,
      removeBgApiKey: process.env.REMOVE_BG_API_KEY || '',
    });
  }

  if (command === 'zip') {
    if (!arg && quotedMedia) {
      const mediaBuffer = await quotedMediaDownloader(quotedMedia.media, quotedMedia.mediaType);
      if (mediaBuffer) {
        const entryName = getQuotedMediaFileName(quotedMedia.mediaType, quotedMedia.media);
        const archiveName = `${entryName.replace(/\.[^.]+$/, '')}.zip`;
        return buildZipMediaCommandReply(mediaBuffer, entryName, archiveName);
      }
    }

    return buildZipCommandReply(arg || quotedText);
  }

  if (command === 'unzip') {
    return buildUnzipCommandReply(arg || quotedText);
  }

  if (!arg) {
    try {
      const routes = await fetchRoutes(http);
      const foundLocation = findLocationByCode(routes, command);
      if (foundLocation) {
        return {
          type: 'location',
          route: foundLocation.route,
          point: foundLocation.point,
        };
      }
    } catch (error) {
      console.warn('Failed to resolve location command:', error);
    }
  }

  return [
    'Command not found.',
    '',
    `Klik button di bawah untuk lihat semua command: ${commandPrefix}help`,
  ].join('\n');
}

export async function startBot(overrides = {}) {
  const onQr = typeof overrides.onQr === 'function' ? overrides.onQr : null;
  const onStatus = typeof overrides.onStatus === 'function' ? overrides.onStatus : null;
  const onPairingCode = typeof overrides.onPairingCode === 'function' ? overrides.onPairingCode : null;
  const { appBaseUrl, commandPrefix, authDir, allowedNumbers } = buildRuntimeConfig(overrides);
  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is required. Example: https://your-app.vercel.app');
  }

  onStatus?.('starting');

  const http = createHttpClient(appBaseUrl);
  const runtime = { commandPrefix, allowedNumbers, http };
  const pairingMethod = await choosePairingMethod(overrides);
  const shouldDisplayQr = pairingMethod !== 'phone';

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

  if (!sock.authState.creds.registered) {
    if (pairingMethod === 'phone') {
      const phoneNumber = await choosePairingPhoneNumber(overrides);
      onStatus?.('pairing-phone');
      const pairingCode = await sock.requestPairingCode(phoneNumber);
      onPairingCode?.(pairingCode, phoneNumber);
      onStatus?.('pairing-code');
      console.log(`Pairing code untuk ${phoneNumber}: ${pairingCode}`);
    } else {
      onStatus?.('qr');
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && shouldDisplayQr) {
      onQr?.(qr);
      onStatus?.('qr');
      console.log('\nScan QR ini dalam WhatsApp > Linked Devices > Link a Device\n');
      qrcodeTerminal.generate(qr, { small: true });
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

        const reply = await executeCommand(text, runtime, msg.message);
        if (!reply) continue;

        if (typeof reply === 'string') {
          await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
          continue;
        }

        if (reply.type === 'zip-file') {
          if (reply.document) {
            await sock.sendMessage(
              remoteJid,
              {
                document: reply.document,
                fileName: reply.fileName || 'attachment.zip',
                mimetype: reply.mimetype || 'application/zip',
              },
              { quoted: msg },
            );
            continue;
          }

          await sock.sendMessage(remoteJid, { text: 'Gagal membina zip file untuk media yang direply.' }, { quoted: msg });
          continue;
        }

        if (reply.type === 'sticker') {
          if (reply.stickerBuffer) {
            await sock.sendMessage(
              remoteJid,
              { sticker: reply.stickerBuffer },
              { quoted: msg },
            );
            continue;
          }

          await sock.sendMessage(remoteJid, {
            text: reply.text || 'Gagal membina sticker.',
          }, { quoted: msg });
          continue;
        }

        if (reply.type === 'tts') {
          if (reply.audioBuffer) {
            await sock.sendMessage(
              remoteJid,
              buildTtsAudioMessage(reply.audioBuffer),
              { quoted: msg },
            );
            continue;
          }

          const audioMessage = reply.audioUrl
            ? {
                text: `Suara siap: ${reply.audioUrl}`,
              }
            : { text: 'Audio tidak tersedia pada saat ini.' };
          await sock.sendMessage(remoteJid, audioMessage, { quoted: msg });
          continue;
        }

        if (reply.type === 'view-once') {
          if (reply.mediaBuffer) {
            const payload = reply.mediaType === 'video'
              ? {
                  video: reply.mediaBuffer,
                  mimetype: reply.mimetype || 'video/mp4',
                  caption: reply.caption,
                }
              : {
                  image: reply.mediaBuffer,
                  mimetype: reply.mimetype || 'image/jpeg',
                  caption: reply.caption,
                };
            await sock.sendMessage(remoteJid, payload, { quoted: msg });
            continue;
          }

          await sock.sendMessage(remoteJid, { text: 'Gagal memuat turun media view-once.' }, { quoted: msg });
          continue;
        }

        if (reply.type === 'qrcode') {
          if (reply.imageBuffer) {
            await sock.sendMessage(
              remoteJid,
              {
                image: reply.imageBuffer,
                mimetype: reply.mimetype || 'image/png',
                caption: reply.caption,
              },
              { quoted: msg },
            );
            continue;
          }

          await sock.sendMessage(remoteJid, { text: 'Gagal menghasilkan QR code.' }, { quoted: msg });
          continue;
        }

        if (reply.type === 'document') {
          if (reply.document) {
            await sock.sendMessage(
              remoteJid,
              {
                document: reply.document,
                fileName: reply.fileName || 'document.txt',
                mimetype: reply.mimetype || 'text/plain',
              },
              { quoted: msg },
            );
            continue;
          }

          await sock.sendMessage(remoteJid, { text: 'Gagal menghasilkan dokumen.' }, { quoted: msg });
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
