# Routebot WhatsApp Web Bot

Bot ini guna WhatsApp Web session (QR pairing) dan akan ambil data dari app Routebot melalui API.

## Ciri

- QR pairing dalam terminal.
- Command dalam chat WhatsApp.
- Ambil data terus dari endpoint app:
  - `GET /api/routes`

## Prasyarat

- Node.js 20+ disyorkan.
- App Routebot anda boleh diakses dari internet atau LAN (contoh Vercel URL).

## Setup

1. Masuk folder bot:

```bash
cd bot
```

2. Install dependency:

```bash
npm install
```

3. Copy env template:

```bash
cp .env.example .env
```

4. Edit `.env`:

- `APP_BASE_URL` contoh: `https://routebot-anda.vercel.app`
- `COMMAND_PREFIX` contoh: `!`
- `ALLOWED_NUMBERS` contoh: `60123456789,6281234567890`

5. Jalankan bot:

```bash
npm start
```

6. Scan QR yang muncul dalam terminal:

- WhatsApp -> Linked Devices -> Link a Device

## Command tersedia

Dengan prefix default `!`:

- `!help` - bantuan
- `!ping` - check bot hidup
- `!routes` - ringkasan semua route
- `!route <code|name>` - detail route dan lokasi
- `!today` - ringkasan active stop hari ini

## Nota penting

- Session login disimpan dalam folder `.wa-auth`.
- Jika mahu pair semula dari kosong, stop bot dan padam folder `.wa-auth`.
- Bot ini process command dari chat masuk. Guna `ALLOWED_NUMBERS` untuk limit siapa boleh akses.
