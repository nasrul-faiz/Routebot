import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiHandler from '../api/index.ts';
import { startBot } from '../bot/src/index.js';

const apiHandlerFn = typeof apiHandler === 'function' ? apiHandler : (apiHandler as { default?: unknown })?.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const app = express();
const port = Number(process.env.PORT || 3000);

type BotRuntimeState = {
  enabled: boolean;
  status: 'disabled' | 'starting' | 'qr' | 'pairing-phone' | 'pairing-code' | 'connected' | 'closed' | 'reconnecting' | 'logged-out' | 'error';
  qr: string | null;
  pairingMethod: 'qr' | 'phone' | null;
  pairingPhoneNumber: string | null;
  pairingCode: string | null;
  updatedAt: string | null;
  lastError: string | null;
};

const botState: BotRuntimeState = {
  enabled: false,
  status: 'disabled',
  qr: null,
  pairingMethod: null,
  pairingPhoneNumber: null,
  pairingCode: null,
  updatedAt: null,
  lastError: null,
};

const dashboardToken = process.env.BOT_DASHBOARD_TOKEN || '';

function isDashboardAuthorized(req: express.Request): boolean {
  if (!dashboardToken) return true;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const headerToken = typeof req.headers['x-bot-dashboard-token'] === 'string' ? req.headers['x-bot-dashboard-token'] : '';
  return queryToken === dashboardToken || headerToken === dashboardToken;
}

function ensureDashboardAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (isDashboardAuthorized(req)) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized dashboard access' });
}

app.disable('x-powered-by');

// Upload endpoint expects raw stream/bytes.
app.all('/api/upload', express.raw({ type: '*/*', limit: '15mb' }));
// JSON payload endpoints.
app.use('/api', express.json({ limit: '10mb' }));
app.use('/api', express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.all('/api/:path*', async (req, res, next) => {
  if (typeof apiHandlerFn !== 'function') {
    return res.status(500).json({ success: false, error: 'API handler unavailable' });
  }

  try {
    const request = req as unknown as Parameters<NonNullable<typeof apiHandlerFn>>[0];
    const response = res as unknown as Parameters<NonNullable<typeof apiHandlerFn>>[1];
    await apiHandlerFn(request, response);
  } catch (error) {
    console.error('[server/api]', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'API request failed' });
    }
  }
});

function buildBotStatusResponse() {
  return {
    success: true,
    data: {
      ...botState,
      qr: botState.status === 'qr' ? botState.qr : null,
      pairingCode: botState.status === 'pairing-code' ? botState.pairingCode : null,
    },
  };
}

app.get('/bot/status', ensureDashboardAuth, (_req, res) => {
  res.status(200).json(buildBotStatusResponse());
});

app.get('/api/bot-status', ensureDashboardAuth, (_req, res) => {
  const response = {
    ...buildBotStatusResponse(),
    source: 'api',
  };
  res.status(200).json(response);
});

app.get('/bot/dashboard', ensureDashboardAuth, (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Routebot WhatsApp Dashboard</title>
    <style>
      :root {
        --bg: #f4f6f8;
        --card: #ffffff;
        --text: #111827;
        --muted: #6b7280;
        --ok: #059669;
        --warn: #d97706;
        --err: #dc2626;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .wrap {
        max-width: 860px;
        margin: 24px auto;
        padding: 0 14px;
      }
      .card {
        background: var(--card);
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        padding: 18px;
      }
      h1 { margin: 0 0 8px; font-size: 22px; }
      p { margin: 0; color: var(--muted); }
      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 14px;
        margin-top: 14px;
      }
      @media (min-width: 820px) {
        .grid { grid-template-columns: 360px 1fr; }
      }
      .qr-box {
        min-height: 330px;
        border: 1px dashed #d1d5db;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: #fafafa;
        padding: 16px;
        text-align: center;
      }
      .qr-box img { width: 280px; height: 280px; border-radius: 12px; }
      .pairing-code {
        width: 100%;
        margin-top: 12px;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        background: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 16px;
        letter-spacing: 0.2em;
        word-break: break-all;
      }
      .qr-instructions {
        margin-top: 12px;
        font-size: 14px;
        color: var(--muted);
        line-height: 1.6;
      }
      .status {
        font-weight: 700;
        margin-bottom: 10px;
      }
      .status.ok { color: var(--ok); }
      .status.warn { color: var(--warn); }
      .status.err { color: var(--err); }
      .meta {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.5;
      }
      code {
        display: block;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
        background: #f3f4f6;
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="card">
        <h1>WhatsApp Bot Dashboard</h1>
        <p>Pair bot melalui QR code atau nombor telefon, kemudian pantau status sambungan.</p>
        <div class="qr-instructions">
          1. Pilih QR code jika mahu scan kod.<br/>
          2. Pilih nombor telefon jika mahu dapat pairing code.<br/>
          3. QR mode guna Linked Devices &gt; Link a Device.<br/>
          4. Phone mode guna Linked Devices &gt; Link with phone number.
        </div>
        <div class="grid">
          <section>
            <div class="qr-box" id="qrBox">Menunggu status bot...</div>
          </section>
          <section>
            <div id="status" class="status warn">Initializing</div>
            <div class="meta" id="meta"></div>
            <code id="debug"></code>
          </section>
        </div>
      </div>
    </main>
    <script>
      const statusEl = document.getElementById('status');
      const metaEl = document.getElementById('meta');
      const qrBox = document.getElementById('qrBox');
      const debugEl = document.getElementById('debug');

      function statusClass(status) {
        if (status === 'connected') return 'status ok';
        if (status === 'error' || status === 'logged-out') return 'status err';
        return 'status warn';
      }

      function statusLabel(status) {
        const labels = {
          disabled: 'Disabled',
          starting: 'Starting',
          qr: 'Waiting QR Scan',
          'pairing-phone': 'Pairing Phone',
          'pairing-code': 'Pairing Code Ready',
          connected: 'Connected',
          closed: 'Connection Closed',
          reconnecting: 'Reconnecting',
          'logged-out': 'Logged Out',
          error: 'Error',
        };
        return labels[status] || status || 'Unknown';
      }

      function render(data) {
        statusEl.className = statusClass(data.status);
        statusEl.textContent = 'Status: ' + statusLabel(data.status);
        metaEl.innerHTML = [
          'Bot enabled: <strong>' + (data.enabled ? 'yes' : 'no') + '</strong>',
          'Updated: <strong>' + (data.updatedAt || '-') + '</strong>',
          'Error: <strong>' + (data.lastError || '-') + '</strong>',
          'Pairing method: <strong>' + (data.pairingMethod || '-') + '</strong>',
          'Phone number: <strong>' + (data.pairingPhoneNumber || '-') + '</strong>',
        ].join('<br/>');

        if (data.status === 'pairing-code' && data.pairingCode) {
          qrBox.innerHTML = '<div class="qr-instructions">Masukkan pairing code ini dalam WhatsApp > Linked Devices > Link with phone number.</div><div class="pairing-code">' + data.pairingCode + '</div>';
        } else if (data.status === 'pairing-phone') {
          qrBox.innerHTML = '<div class="qr-instructions">Tunggu seketika, bot sedang minta pairing code daripada WhatsApp.</div>';
        } else if (data.status === 'qr' && data.qr) {
          const src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(data.qr);
          qrBox.innerHTML = '<img alt="WhatsApp QR" src="' + src + '" /><div class="qr-instructions">Imbas kod ini pada telefon anda untuk sambungkan bot.</div>';
        } else if (data.status === 'connected') {
          qrBox.innerHTML = '<div class="qr-instructions">Bot connected. QR tidak diperlukan lagi.</div>';
        } else {
          qrBox.innerHTML = '<div class="qr-instructions">QR belum tersedia. Tunggu sehingga bot mengeluarkan kod sambungan.</div>';
        }

        debugEl.textContent = JSON.stringify(data, null, 2);
      }

      async function refresh() {
        try {
          const statusUrl = '/bot/status' + tokenParam;
          const response = await fetch(statusUrl);
          const payload = await response.json();
          if (payload?.success) {
            render(payload.data);
          } else {
            statusEl.className = 'status err';
            statusEl.textContent = 'Status: error';
            qrBox.textContent = payload?.error || 'Failed to fetch bot status';
          }
        } catch (error) {
          statusEl.className = 'status err';
          statusEl.textContent = 'Status: error';
          qrBox.textContent = 'Tidak dapat sambung ke endpoint status.';
        }
      }

      refresh();
      setInterval(refresh, 3000);
    </script>
  </body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

app.all('/api/*', async (req, res) => {
  try {
    await apiHandler(req as never, res as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown API error';
    console.error('[server/api]', error);
    res.status(500).json({ success: false, error: message });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, error: `Unknown endpoint: ${req.path}` });
    }

    return res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => {
    res.status(503).send('Frontend dist not found. Run npm run build first.');
  });
}

app.listen(port, async () => {
  console.log(`Routebot server running on port ${port}`);

  const enableBot = String(process.env.ENABLE_WHATSAPP_BOT || 'false').toLowerCase() === 'true';
  botState.enabled = enableBot;
  botState.updatedAt = new Date().toISOString();
  if (!enableBot) {
    console.log('WhatsApp bot disabled (set ENABLE_WHATSAPP_BOT=true to enable).');
    return;
  }

  try {
    const appBaseUrl = process.env.APP_BASE_URL || `http://127.0.0.1:${port}`;
    const pairingMethod = String(process.env.BOT_PAIRING_METHOD || process.env.PAIRING_METHOD || '').trim().toLowerCase();
    const pairingPhoneNumber = String(process.env.BOT_PAIRING_PHONE_NUMBER || process.env.PAIRING_PHONE_NUMBER || '').trim();

    botState.pairingMethod = pairingMethod === 'phone' ? 'phone' : pairingMethod === 'qr' ? 'qr' : null;
    botState.pairingPhoneNumber = botState.pairingMethod === 'phone' && pairingPhoneNumber ? pairingPhoneNumber : null;
    await startBot({
      appBaseUrl,
      authDir: process.env.AUTH_DIR || path.join(rootDir, '.wa-auth'),
      pairingMethod: pairingMethod || undefined,
      pairingPhoneNumber: pairingPhoneNumber || undefined,
      onQr: (qr: string) => {
        botState.qr = qr;
        botState.status = 'qr';
        botState.pairingCode = null;
        botState.updatedAt = new Date().toISOString();
      },
      onPairingCode: (pairingCode: string, phoneNumber: string) => {
        botState.pairingMethod = 'phone';
        botState.pairingPhoneNumber = phoneNumber;
        botState.pairingCode = pairingCode;
        botState.updatedAt = new Date().toISOString();
      },
      onStatus: (status: BotRuntimeState['status']) => {
        botState.status = status;
        if (status === 'connected') {
          botState.qr = null;
          botState.pairingCode = null;
        }
        if (status === 'closed' || status === 'logged-out' || status === 'error') {
          botState.pairingCode = null;
        }
        botState.updatedAt = new Date().toISOString();
      },
    });
    botState.status = 'starting';
    botState.lastError = null;
    botState.updatedAt = new Date().toISOString();
    console.log('WhatsApp bot startup initialized.');
  } catch (error) {
    botState.status = 'error';
    botState.lastError = error instanceof Error ? error.message : 'Unknown bot startup error';
    botState.updatedAt = new Date().toISOString();
    console.error('Failed to start WhatsApp bot:', error);
  }
});
