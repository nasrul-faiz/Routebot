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
  status: 'disabled' | 'starting' | 'qr' | 'connected' | 'closed' | 'reconnecting' | 'logged-out' | 'error';
  qr: string | null;
  updatedAt: string | null;
  lastError: string | null;
};

const botState: BotRuntimeState = {
  enabled: false,
  status: 'disabled',
  qr: null,
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
        padding: 10px;
      }
      .qr-box img { width: 280px; height: 280px; }
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
        <p>Scan QR ini di WhatsApp > Linked Devices > Link a Device.</p>
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

      function render(data) {
        statusEl.className = statusClass(data.status);
        statusEl.textContent = 'Status: ' + data.status;
        metaEl.innerHTML = [
          'Bot enabled: <strong>' + (data.enabled ? 'yes' : 'no') + '</strong>',
          'Updated: <strong>' + (data.updatedAt || '-') + '</strong>',
          'Error: <strong>' + (data.lastError || '-') + '</strong>',
        ].join('<br/>');

        if (data.status === 'qr' && data.qr) {
          const src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(data.qr);
          qrBox.innerHTML = '<img alt="WhatsApp QR" src="' + src + '" />';
        } else if (data.status === 'connected') {
          qrBox.textContent = 'Bot connected. QR tidak diperlukan.';
        } else {
          qrBox.textContent = 'QR belum tersedia. Tunggu pairing event.';
        }

        debugEl.textContent = JSON.stringify(data, null, 2);
      }

      async function refresh() {
        try {
          const response = await fetch('/bot/status${tokenParam}');
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
    await startBot({
      appBaseUrl,
      authDir: process.env.AUTH_DIR || path.join(rootDir, '.wa-auth'),
      onQr: (qr: string) => {
        botState.qr = qr;
        botState.status = 'qr';
        botState.updatedAt = new Date().toISOString();
      },
      onStatus: (status: BotRuntimeState['status']) => {
        botState.status = status;
        if (status === 'connected') {
          botState.qr = null;
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
