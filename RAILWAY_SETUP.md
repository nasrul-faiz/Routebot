# Railway Unified Deploy (Web + API + WhatsApp Bot)

Dokumen ini untuk deploy Routebot sebagai satu servis di Railway.

## Apa yang akan berjalan

- Frontend SPA (fail `dist`)
- API (`/api/*`)
- WhatsApp Web bot (optional, toggle guna env)

## 1) Environment Variables

Set variable ini di Railway:

- `DATABASE_URL` = PostgreSQL/Neon connection string
- `IMGBB_API_KEY` = optional untuk upload image
- `ENABLE_WHATSAPP_BOT` = `true` jika nak hidupkan bot
- `APP_BASE_URL` = URL public app (contoh `https://routebot-production.up.railway.app`)
- `COMMAND_PREFIX` = contoh `.`
- `ALLOWED_NUMBERS` = optional, contoh `60123456789,6281234567890`
- `AUTH_DIR` = optional, default `.wa-auth`
- `BOT_DASHBOARD_TOKEN` = optional token untuk lindungi page dashboard bot

## 2) Build and Start Command

Railway biasanya auto-detect dari `package.json`:

- Build: `npm run build`
- Start: `npm start`

Untuk release terkini (ada fitur `.sticker`), pastikan dependency root dipasang lengkap semasa build. Jika anda guna custom command di Railway, disyorkan:

- Build command: `npm ci && npm run build`
- Start command: `npm start`

Nota:

- Server unified akan import modul bot dari path root (`/app/bot/src/...`), jadi dependency sticker mesti ada dalam root `node_modules`.
- Jika anda disable bot (`ENABLE_WHATSAPP_BOT=false`), web+API tetap berjalan normal.

Jika anda hanya mahu semak bot sahaja secara manual, command lokal ialah `npm run start:bot`, tetapi untuk Railway unified deploy kekalkan `npm start`.

## 3) Persistent Volume (penting untuk QR session)

Untuk elak scan QR setiap restart:

1. Tambah volume di Railway service
2. Mount path ke project root (contoh `/app`)
3. Pastikan `AUTH_DIR` menunjuk folder persistent (contoh `/app/.wa-auth`)
4. Untuk kestabilan WhatsApp Web session, gunakan single replica sahaja.

## 4) First Pairing

Selepas deploy:

1. Buka dashboard bot:
	- Tanpa token: `/bot/dashboard`
	- Dengan token: `/bot/dashboard?token=YOUR_TOKEN`
2. Jika `ENABLE_WHATSAPP_BOT=true`, QR akan muncul di dashboard (dan di logs terminal secara default)
3. Scan QR: WhatsApp -> Linked Devices -> Link a Device
4. Status bot boleh disemak di endpoint:
	- `/bot/status`
	- `/api/bot-status` (fallback path)

## 5) Health Check

- Endpoint: `/health`
- API test: `/api/routes`

## Nota penting

- Jika anda deploy lebih dari 1 replica, WhatsApp session boleh konflik.
- Untuk bot WhatsApp Web, guna single replica.
- Pastikan `APP_BASE_URL` ialah URL public Railway service, bukan `127.0.0.1`, supaya bot boleh capai endpoint app sendiri selepas deploy.
