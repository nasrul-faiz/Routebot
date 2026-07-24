import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

function getDatabaseClient() {
  const databaseUrl = String(process.env.DATABASE_URL || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');

  if (!databaseUrl) {
    console.warn('[api] DATABASE_URL not configured; database-backed endpoints will return 500 until configured');
    return null;
  }

  try {
    return neon(databaseUrl);
  } catch (error) {
    console.warn('[api] Invalid DATABASE_URL, database endpoints will return 500 until configured:', error);
    return null;
  }
}

const sql = getDatabaseClient();

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-imgbb-key');
}

// ── /api/calendar ─────────────────────────────────────────────────────────────
async function handleCalendar(req: VercelRequest, res: VercelResponse) {
  if (!sql) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL not configured' });
  }
  await sql`CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL, event_date DATE NOT NULL,
    type VARCHAR(50) DEFAULT 'event', created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`DELETE FROM calendar_events WHERE event_date < CURRENT_DATE - INTERVAL '1 year'`;

  if (req.method === 'GET') {
    const events = await sql`SELECT id, title, event_date, type FROM calendar_events ORDER BY event_date ASC`;
    return res.status(200).json({ success: true, data: events });
  }
  if (req.method === 'POST') {
    const { id, title, event_date, type } = req.body;
    if (!title || !event_date) return res.status(400).json({ success: false, error: 'title dan event_date diperlukan' });
    let result;
    if (id) {
      result = await sql`UPDATE calendar_events SET title=${title}, event_date=${event_date}, type=${type ?? 'event'} WHERE id=${Number(id)} RETURNING id, title, event_date, type`;
    } else {
      result = await sql`INSERT INTO calendar_events (title, event_date, type) VALUES (${title}, ${event_date}, ${type ?? 'event'}) RETURNING id, title, event_date, type`;
    }
    return res.status(200).json({ success: true, data: result[0] });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, error: 'id diperlukan' });
    await sql`DELETE FROM calendar_events WHERE id = ${Number(id)}`;
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
}

// ── /api/deliveries ───────────────────────────────────────────────────────────
async function handleDeliveries(req: VercelRequest, res: VercelResponse) {
  if (!sql) {
    return res.status(500).json({ success: false, error: 'DATABASE_URL not configured' });
  }

  await sql`CREATE TABLE IF NOT EXISTS deliveries (
    id SERIAL PRIMARY KEY, tracking_no VARCHAR(100) UNIQUE NOT NULL,
    recipient_name VARCHAR(255), address TEXT, status VARCHAR(50) DEFAULT 'pending',
    delivery_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`;
  if (req.method === 'GET') {
    const deliveries = await sql`SELECT * FROM deliveries ORDER BY created_at DESC`;
    return res.status(200).json({ success: true, data: deliveries });
  }
  if (req.method === 'POST') {
    const { tracking_no, recipient_name, address, status, delivery_date, notes } = req.body;
    if (!tracking_no) return res.status(400).json({ success: false, error: 'tracking_no diperlukan' });
    const result = await sql`
      INSERT INTO deliveries (tracking_no, recipient_name, address, status, delivery_date, notes)
      VALUES (${tracking_no}, ${recipient_name}, ${address}, ${status ?? 'pending'}, ${delivery_date}, ${notes})
      ON CONFLICT (tracking_no) DO UPDATE
        SET recipient_name=EXCLUDED.recipient_name, address=EXCLUDED.address, status=EXCLUDED.status,
            delivery_date=EXCLUDED.delivery_date, notes=EXCLUDED.notes, updated_at=NOW()
      RETURNING *`;
    return res.status(200).json({ success: true, data: result[0] });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, error: 'id diperlukan' });
    await sql`DELETE FROM deliveries WHERE id = ${Number(id)}`;
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
}

// ── /api/notes ────────────────────────────────────────────────────────────────
async function handleNotes(req: VercelRequest, res: VercelResponse) {
  await sql`CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, type VARCHAR(20) NOT NULL DEFAULT 'note', title VARCHAR(500) NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '', version VARCHAR(50) DEFAULT NULL, author VARCHAR(255) DEFAULT 'Admin',
    pinned BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`;
  if (req.method === 'GET') {
    const { type } = req.query;
    let result;
    if (type === 'note') result = await sql`SELECT * FROM notes WHERE type='note' ORDER BY pinned DESC, created_at DESC`;
    else if (type === 'changelog') result = await sql`SELECT * FROM notes WHERE type='changelog' ORDER BY created_at DESC`;
    else result = await sql`SELECT * FROM notes ORDER BY type ASC, pinned DESC, created_at DESC`;
    return res.status(200).json({ success: true, data: result });
  }
  if (req.method === 'POST') {
    const { id, type, title, content, version, author, pinned } = req.body;
    if (!id || !type || !content) return res.status(400).json({ success: false, error: 'id, type dan content diperlukan' });
    await sql`
      INSERT INTO notes (id, type, title, content, version, author, pinned, updated_at)
      VALUES (${id}, ${type}, ${title ?? ''}, ${content}, ${version ?? null}, ${author ?? 'Admin'}, ${pinned ?? false}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET title=EXCLUDED.title, content=EXCLUDED.content, version=EXCLUDED.version,
            author=EXCLUDED.author, pinned=EXCLUDED.pinned, updated_at=NOW()`;
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ success: false, error: 'id diperlukan' });
    await sql`DELETE FROM notes WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
}

// ── /api/plano ────────────────────────────────────────────────────────────────
async function handlePlano(req: VercelRequest, res: VercelResponse) {
  await sql`CREATE TABLE IF NOT EXISTS plano_vm (id TEXT PRIMARY KEY, pages JSONB DEFAULT '[]', updated_at TIMESTAMP DEFAULT NOW())`;
  await sql`INSERT INTO plano_vm (id, pages) VALUES ('default', '[]') ON CONFLICT (id) DO NOTHING`;
  if (req.method === 'GET') {
    const result = await sql`SELECT pages FROM plano_vm WHERE id = 'default'`;
    return res.status(200).json({ success: true, data: result[0]?.pages ?? [] });
  }
  if (req.method === 'POST') {
    const { pages } = req.body;
    if (!Array.isArray(pages)) return res.status(400).json({ success: false, error: 'pages array diperlukan' });
    await sql`UPDATE plano_vm SET pages=${JSON.stringify(pages)}, updated_at=NOW() WHERE id='default'`;
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
}

// ── /api/proxy-image ──────────────────────────────────────────────────────────
async function handleProxyImage(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL parameter required' });
  if (!url.match(/^https?:\/\//)) return res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
  if (url.length > 2000) return res.status(400).json({ error: 'URL too long' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'QR-Scanner-Bot/1.0' } });
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch image' });
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) return res.status(415).json({ error: 'Not an image' });
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) return res.status(413).json({ error: 'Image too large' });
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch image';
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}

// ── /api/validate-media-url ──────────────────────────────────────────────────
async function handleValidateMediaUrl(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL parameter required' });
  }

  const trimmed = url.trim();
  if (!trimmed.match(/^https?:\/\//i)) {
    return res.status(400).json({ success: false, error: 'Only HTTP/HTTPS URLs allowed' });
  }
  if (trimmed.length > 2000) {
    return res.status(400).json({ success: false, error: 'URL too long' });
  }

  const videoExtensions = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
  const imageExtensions = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i;
  const youtubeMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{6,})/i);
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);

  if (!videoExtensions.test(trimmed) && !imageExtensions.test(trimmed) && !youtubeMatch && !vimeoMatch) {
    return res.status(415).json({ success: false, error: 'URL does not look like a supported image/video link' });
  }

  if (youtubeMatch || vimeoMatch) {
    return res.status(200).json({ success: true, data: { kind: 'video', contentType: 'video/external' } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetch(trimmed, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Frfgg-Media-Validator/1.0' },
    });

    if (response.status === 405 || response.status === 403 || !response.headers.get('content-type')) {
      response = await fetch(trimmed, {
        method: 'GET',
        signal: controller.signal,
        headers: { Range: 'bytes=0-1023', 'User-Agent': 'Frfgg-Media-Validator/1.0' },
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: `Remote server returned ${response.status}` });
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const kind = contentType.startsWith('video/') ? 'video' : contentType.startsWith('image/') ? 'image' : null;

    if (!kind) {
      return res.status(415).json({ success: false, error: 'Remote URL is not an image or video' });
    }

    return res.status(200).json({ success: true, data: { kind, contentType } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(502).json({ success: false, error: message });
  } finally {
    clearTimeout(timeout);
  }
}

// ── /api/upload ───────────────────────────────────────────────────────────────
async function handleUpload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
  }

  const key =
    typeof req.headers['x-imgbb-key'] === 'string'
      ? req.headers['x-imgbb-key']
      : typeof req.query.key === 'string'
      ? req.query.key
      : process.env.IMGBB_API_KEY;

  if (!key) {
    return res.status(500).json({ success: false, error: 'ImgBB API key not configured' });
  }

  const headers: Record<string, string> = {};
  if (req.headers['content-type']) {
    headers['Content-Type'] = req.headers['content-type'];
  }
  if (typeof req.headers['content-length'] === 'string') {
    headers['Content-Length'] = req.headers['content-length'];
  }

  const bodyBuffer = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === 'string'
      ? Buffer.from(req.body)
      : await new Promise<Buffer>((resolve, reject) => {
          const chunks: Uint8Array[] = [];
          req.on('data', chunk => chunks.push(Buffer.from(chunk)));
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', reject);
        });

  const uploadResponse = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers,
      // Node Buffer is a Uint8Array at runtime, but TypeScript's fetch types may not accept Buffer directly.
      // Cast to BodyInit to satisfy the type checker.
      body: bodyBuffer as unknown as globalThis.BodyInit,
    }
  );

  const payload = await uploadResponse.json().catch(() => null);
  if (!uploadResponse.ok || !payload?.success) {
    const message = payload?.error?.message ?? payload?.error ?? 'Upload failed';
    console.error('[api/upload] ImgBB upload failed', { status: uploadResponse.status, message, payload });
    return res.status(uploadResponse.status || 502).json({
      success: false,
      error: message,
    });
  }

  return res.status(200).json({ success: true, data: { url: payload.data?.url } });
}

// ── /api/share ───────────────────────────────────────────────────────────────
async function handleShare(req: VercelRequest, res: VercelResponse) {
  await sql`CREATE TABLE IF NOT EXISTS shared_routes (
    code TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;

  const requestUrl = req.url ?? '';
  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  const parts = pathname.replace(/^\/api\/share\/?/, '').split('/').filter(Boolean);
  const code = parts[0];

  if (req.method === 'POST') {
    const { code: requestCode, data } = req.body;
    if (!requestCode || !data) {
      return res.status(400).json({ success: false, error: 'code and data required' });
    }
    await sql`INSERT INTO shared_routes (code, data, created_at, updated_at)
      VALUES (${requestCode}, ${JSON.stringify(data)}, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    if (!code) {
      return res.status(400).json({ success: false, error: 'code required' });
    }
    const result = await sql`SELECT data FROM shared_routes WHERE code = ${code}`;
    if (!result[0]) {
      return res.status(404).json({ success: false, error: 'not found' });
    }
    return res.status(200).json(result[0].data);
  }

  if (req.method === 'DELETE') {
    if (!code) {
      return res.status(400).json({ success: false, error: 'code required' });
    }
    await sql`DELETE FROM shared_routes WHERE code = ${code}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
}

// ── /api/rooster ──────────────────────────────────────────────────────────────
async function handleRooster(req: VercelRequest, res: VercelResponse) {
  await sql`CREATE TABLE IF NOT EXISTS rooster_resources (
    id TEXT PRIMARY KEY, name VARCHAR(200) NOT NULL, role VARCHAR(100) DEFAULT '',
    color VARCHAR(20) DEFAULT '#3B82F6', off_day INTEGER DEFAULT NULL, created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`ALTER TABLE rooster_resources ADD COLUMN IF NOT EXISTS off_day INTEGER DEFAULT NULL`;
  await sql`CREATE TABLE IF NOT EXISTS rooster_shifts (
    id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES rooster_resources(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL, shift_date DATE NOT NULL, start_hour INTEGER NOT NULL DEFAULT 8,
    end_hour INTEGER NOT NULL DEFAULT 16, color VARCHAR(20) NOT NULL DEFAULT '#3B82F6', created_at TIMESTAMP DEFAULT NOW()
  )`;
  if (req.method === 'GET') {
    const resources = await sql`SELECT id, name, role, color, off_day FROM rooster_resources ORDER BY created_at ASC`;
    const shifts = await sql`SELECT id, resource_id, title, shift_date, start_hour, end_hour, color FROM rooster_shifts ORDER BY shift_date ASC, start_hour ASC`;
    return res.status(200).json({ success: true, resources, shifts });
  }
  if (req.method === 'POST') {
    const { type } = req.body;
    if (type === 'resource') {
      const { id, name, role, color, off_day } = req.body;
      if (!id || !name) return res.status(400).json({ success: false, error: 'id and name required' });
      await sql`INSERT INTO rooster_resources (id, name, role, color, off_day) VALUES (${id}, ${name}, ${role ?? ''}, ${color ?? '#3B82F6'}, ${off_day ?? null})
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, color=EXCLUDED.color, off_day=EXCLUDED.off_day`;
      return res.status(200).json({ success: true });
    }
    if (type === 'shift') {
      const { id, resource_id, title, shift_date, start_hour, end_hour, color } = req.body;
      if (!id || !resource_id || !title || !shift_date) return res.status(400).json({ success: false, error: 'id, resource_id, title, shift_date required' });
      await sql`INSERT INTO rooster_shifts (id, resource_id, title, shift_date, start_hour, end_hour, color)
        VALUES (${id}, ${resource_id}, ${title}, ${shift_date}, ${start_hour ?? 8}, ${end_hour ?? 16}, ${color ?? '#3B82F6'})
        ON CONFLICT (id) DO UPDATE SET resource_id=EXCLUDED.resource_id, title=EXCLUDED.title,
          shift_date=EXCLUDED.shift_date, start_hour=EXCLUDED.start_hour, end_hour=EXCLUDED.end_hour, color=EXCLUDED.color`;
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'type must be "resource" or "shift"' });
  }
  if (req.method === 'DELETE') {
    const { type, id } = req.query;
    if (!id) return res.status(400).json({ success: false, error: 'id required' });
    if (type === 'resource') { await sql`DELETE FROM rooster_resources WHERE id = ${String(id)}`; return res.status(200).json({ success: true }); }
    if (type === 'shift') { await sql`DELETE FROM rooster_shifts WHERE id = ${String(id)}`; return res.status(200).json({ success: true }); }
    return res.status(400).json({ success: false, error: 'type must be "resource" or "shift"' });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
}

// ── /api/route-notes ──────────────────────────────────────────────────────────
async function handleRouteNotes(req: VercelRequest, res: VercelResponse) {
  await sql`CREATE TABLE IF NOT EXISTS route_notes (
    id TEXT PRIMARY KEY, route_id TEXT NOT NULL, type VARCHAR(20) NOT NULL DEFAULT 'note',
    text TEXT NOT NULL DEFAULT '', created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_route_notes_route_id ON route_notes(route_id)`;
  if (req.method === 'GET') {
    const { routeId } = req.query;
    if (!routeId || typeof routeId !== 'string') return res.status(400).json({ success: false, error: 'routeId diperlukan' });
    const notes = await sql`SELECT * FROM route_notes WHERE route_id=${routeId} AND type='note' ORDER BY created_at DESC`;
    const changelog = await sql`SELECT * FROM route_notes WHERE route_id=${routeId} AND type='changelog' ORDER BY created_at DESC LIMIT 200`;
    return res.status(200).json({ success: true, notes, changelog });
  }
  if (req.method === 'POST') {
    const { id, routeId, type, text } = req.body;
    if (!id || !routeId || !type || !text) return res.status(400).json({ success: false, error: 'id, routeId, type, text diperlukan' });
    await sql`INSERT INTO route_notes (id, route_id, type, text) VALUES (${id}, ${routeId}, ${type}, ${text}) ON CONFLICT (id) DO NOTHING`;
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') {
    const { id, routeId, type } = req.query;
    // Clear all changelog entries for a route
    if (routeId && type === 'changelog') {
      if (typeof routeId !== 'string') return res.status(400).json({ success: false, error: 'routeId diperlukan' });
      await sql`DELETE FROM route_notes WHERE route_id=${routeId} AND type='changelog'`;
      return res.status(200).json({ success: true });
    }
    if (!id || typeof id !== 'string') return res.status(400).json({ success: false, error: 'id diperlukan' });
    await sql`DELETE FROM route_notes WHERE id=${id} AND type='note'`;
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
}

// ── /api/road-distance ───────────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 9000;
const OSRM_MAX_ROUTE_COORDS = 50;
const OSRM_MAX_TABLE_COORDS = 99;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function osrmFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Dbrutals/1.0' },
    });
  } finally {
    clearTimeout(t);
  }
}

async function handleRoadDistance(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
  }

  const { coordinates, source, destinations } = req.body;

  try {
    // ── Sequence mode (route A→B→C→…) ────────────────────────────────────────
    if (Array.isArray(coordinates) && coordinates.length > 1) {
      // Try OSRM if within coord limit
      if (coordinates.length <= OSRM_MAX_ROUTE_COORDS) {
        try {
          const coordStr = (coordinates as [number, number][])
            .map(([lng, lat]) => `${lng},${lat}`)
            .join(';');
          const url = `${OSRM_BASE}/route/v1/driving/${coordStr}?overview=false`;
          const resp = await osrmFetch(url);
          if (resp.ok) {
            const data = await resp.json() as {
              code: string;
              routes?: Array<{
                distance: number;
                duration: number;
                legs: Array<{ distance: number; duration: number }>;
              }>;
            };
            if (data.code === 'Ok' && data.routes?.[0]) {
              const route = data.routes[0];
              const segments = route.legs.map((leg) =>
                Math.round(leg.distance / 10) / 100,
              );
              const totalKm = Math.round(route.distance / 10) / 100;
              const totalMin = Math.round(route.duration / 60);
              return res.status(200).json({ mode: 'sequence', segments, totalKm, totalMin });
            }
          }
        } catch (osrmErr) {
          console.warn('[api/road-distance] OSRM route failed, falling back to haversine:', osrmErr);
        }
      }

      // Haversine fallback for sequence
      const segs: number[] = [];
      for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i] as [number, number];
        const [lon2, lat2] = coordinates[i + 1] as [number, number];
        segs.push(Math.round(haversineKm(lat1, lon1, lat2, lon2) * 100) / 100);
      }
      const totalKm = Math.round(segs.reduce((s, v) => s + v, 0) * 100) / 100;
      return res.status(200).json({
        mode: 'sequence',
        segments: segs,
        totalKm,
        totalMin: Math.round(totalKm),
      });
    }

    // ── Matrix mode (one source → many destinations) ──────────────────────────
    if (Array.isArray(source) && Array.isArray(destinations) && destinations.length > 0) {
      // Try OSRM table if within coord limit (source + destinations)
      if (destinations.length <= OSRM_MAX_TABLE_COORDS) {
        try {
          const allCoords = [source, ...destinations as [number, number][]]
            .map(([lng, lat]) => `${lng},${lat}`)
            .join(';');
          const destIdx = (destinations as unknown[]).map((_, i) => i + 1).join(';');
          const url = `${OSRM_BASE}/table/v1/driving/${allCoords}?sources=0&destinations=${destIdx}&annotations=distance,duration`;
          const resp = await osrmFetch(url);
          if (resp.ok) {
            const data = await resp.json() as {
              code: string;
              distances?: (number | null)[][];
              durations?: (number | null)[][];
            };
            if (data.code === 'Ok' && data.distances?.[0] && data.durations?.[0]) {
              const distances = data.distances[0].map((d) =>
                d !== null && d !== undefined ? Math.round(d / 10) / 100 : null,
              );
              const durations = data.durations[0].map((d) =>
                d !== null && d !== undefined ? Math.round((d / 60) * 10) / 10 : null,
              );
              return res.status(200).json({ mode: 'matrix', distances, durations });
            }
          }
        } catch (osrmErr) {
          console.warn('[api/road-distance] OSRM table failed, falling back to haversine:', osrmErr);
        }
      }

      // Haversine fallback for matrix
      const [sourceLon, sourceLat] = source as [number, number];
      const distances: (number | null)[] = [];
      const durations: (number | null)[] = [];
      for (const [destLon, destLat] of destinations as [number, number][]) {
        const km = haversineKm(sourceLat, sourceLon, destLat, destLon);
        distances.push(Math.round(km * 100) / 100);
        durations.push(Math.round(km));
      }
      return res.status(200).json({ mode: 'matrix', distances, durations });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid request: provide either coordinates (≥2) or source+destinations',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[api/road-distance]', error);
    return res.status(500).json({ success: false, error: message });
  }
}

// ── /api/whatsapp ───────────────────────────────────────────────────────────
type WhatsAppSendRequest = {
  to?: string;
  message?: string;
  preview_url?: boolean;
};

function normalizeMsisdn(value: string): string {
  return value.replace(/[^\d]/g, '');
}

async function handleWhatsApp(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0';

  if (!token || !phoneNumberId) {
    return res.status(500).json({
      success: false,
      error: 'WhatsApp not configured: missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID',
    });
  }

  const body = (req.body ?? {}) as WhatsAppSendRequest;
  const rawTo = typeof body.to === 'string' && body.to.trim() !== ''
    ? body.to
    : process.env.WHATSAPP_DEFAULT_TO;

  const to = rawTo ? normalizeMsisdn(rawTo) : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const previewUrl = body.preview_url === true;

  if (!to) {
    return res.status(400).json({ success: false, error: 'Recipient number (to) diperlukan' });
  }
  if (!message) {
    return res.status(400).json({ success: false, error: 'Message diperlukan' });
  }
  if (message.length > 4096) {
    return res.status(400).json({ success: false, error: 'Message terlalu panjang (max 4096 chars)' });
  }

  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: previewUrl,
      body: message,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        responseBody?.error?.message
        ?? responseBody?.error
        ?? `WhatsApp API error (${response.status})`;
      console.error('[api/whatsapp] send failed', {
        status: response.status,
        error: errorMessage,
        details: responseBody,
      });
      return res.status(response.status).json({ success: false, error: errorMessage, details: responseBody });
    }

    const messageId = responseBody?.messages?.[0]?.id ?? null;
    return res.status(200).json({ success: true, data: { messageId, to } });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Failed to send WhatsApp message';
    console.error('[api/whatsapp] unexpected error', error);
    return res.status(502).json({ success: false, error: messageText });
  }
}

// ── /api/routes ───────────────────────────────────────────────────────────────
async function handleRoutes(req: VercelRequest, res: VercelResponse) {
  await sql`CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(100) NOT NULL,
    shift VARCHAR(50) DEFAULT 'AM', delivery_points JSONB DEFAULT '[]',
    color VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT NULL`;
  if (req.method === 'GET') {
    const result = await sql`SELECT * FROM routes ORDER BY created_at ASC`;
    const routes = result.map((row: Record<string, unknown>) => ({
      id: row.id, name: row.name, code: row.code, shift: row.shift,
      color: row.color ?? null,
      deliveryPoints: row.delivery_points, updatedAt: row.updated_at,
    }));
    return res.status(200).json({ success: true, data: routes });
  }
  if (req.method === 'POST') {
    const { routes, changedRouteIds } = req.body;
    if (!Array.isArray(routes)) return res.status(400).json({ success: false, error: 'routes array diperlukan' });
    const changedIds: string[] = Array.isArray(changedRouteIds) ? changedRouteIds : [];
    const ids = routes.map((r: { id: string }) => r.id);
    if (ids.length > 0) { await sql`DELETE FROM routes WHERE id != ALL(${ids}::text[])`; }
    else { await sql`DELETE FROM routes`; }
    for (const route of routes) {
      const isChanged = changedIds.includes(route.id);
      await sql`INSERT INTO routes (id, name, code, shift, delivery_points, color, updated_at)
        VALUES (${route.id}, ${route.name}, ${route.code}, ${route.shift}, ${JSON.stringify(route.deliveryPoints)}, ${route.color ?? null}, NOW())
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code, shift=EXCLUDED.shift,
          delivery_points=EXCLUDED.delivery_points, color=EXCLUDED.color,
          updated_at=CASE WHEN ${isChanged} THEN NOW() ELSE routes.updated_at END`;
    }
    return res.status(200).json({ success: true });
  }
  if (req.method === 'PATCH') {
    const { id, color } = req.body;
    if (!id || !color) return res.status(400).json({ success: false, error: 'id dan color diperlukan' });
    await sql`UPDATE routes SET color=${color}, updated_at=NOW() WHERE id=${id}`;
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });
}

// ── Main router ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Extract path segment after /api/
  const url = req.url ?? '';
  const segment = url.replace(/^\/api\//, '').split('?')[0].split('/')[0];

  try {
    switch (segment) {
      case 'calendar':      return await handleCalendar(req, res);
      case 'deliveries':    return await handleDeliveries(req, res);
      case 'notes':         return await handleNotes(req, res);
      case 'plano':         return await handlePlano(req, res);
      case 'proxy-image':   return await handleProxyImage(req, res);
      case 'validate-media-url': return await handleValidateMediaUrl(req, res);
      case 'upload':        return await handleUpload(req, res);
      case 'share':         return await handleShare(req, res);
      case 'rooster':       return await handleRooster(req, res);
      case 'route-notes':   return await handleRouteNotes(req, res);
      case 'road-distance': return await handleRoadDistance(req, res);
      case 'whatsapp':      return await handleWhatsApp(req, res);
      case 'routes':        return await handleRoutes(req, res);
      default:
        return res.status(404).json({ success: false, error: `Unknown endpoint: /api/${segment}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[api/${segment}]`, error);
    return res.status(500).json({ success: false, error: message });
  }
}
