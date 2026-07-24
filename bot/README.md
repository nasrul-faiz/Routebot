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

3. Setup env utama di root project:

```bash
cd ..
cp .env.example .env
```

4. (Optional) Buat override khusus bot jika perlu:

```bash
cd bot
cp .env.example .env
```

5. Edit env:

- Root `.env` untuk setting shared (disyorkan)
- `bot/.env` hanya jika anda mahu override bot sahaja
- `APP_BASE_URL` contoh: `https://routebot-anda.vercel.app`
- `COMMAND_PREFIX` contoh: `.`
- `ALLOWED_NUMBERS` contoh: `60123456789,6281234567890`

6. Jalankan bot:

```bash
npm start
```

7. Bila bot mula, anda akan ditanya untuk pilih pairing:

- `1` = QR code
- `2` = nombor telefon

Jika pilih nombor telefon, bot akan keluarkan pairing code dan tidak akan paparkan QR. Masukkan nombor dalam format antarabangsa tanpa `+` dan tanpa space, contoh `60123456789`.

8. Jika pilih QR, scan QR yang muncul dalam terminal:

- WhatsApp -> Linked Devices -> Link a Device

### Pilihan automasi

Kalau anda tak mahu prompt interaktif, set env berikut:

- `BOT_PAIRING_METHOD=qr` atau `BOT_PAIRING_METHOD=phone`
- `BOT_PAIRING_PHONE_NUMBER=60123456789`

## Command tersedia

Dengan prefix default `.`:

- `.help` - bantuan
- `.ping` - check bot hidup
- `.routes` - ringkasan semua route
- `.route <code|name>` - detail route dan lokasi
- `.today` - ringkasan active stop hari ini
- `.tts <text>` - hantar teks dan voice note TTS
- `.sticker` - reply gambar/video untuk jadikan sticker
- `.sticker nobg` - reply gambar untuk jadikan sticker tanpa background (perlukan `REMOVE_BG_API_KEY`)
- `.zip <text>` - compress teks jadi `gzip+base64`
- `.unzip <base64>` - buka semula data `gzip+base64` jadi teks

## Sticker no background

Jika mahu guna mode `.sticker nobg`, isi env berikut dalam root `.env`:

- `REMOVE_BG_API_KEY=...`

API key boleh didapatkan dari remove.bg.

## Nota penting

- Session login disimpan dalam folder `.wa-auth`.
- Jika mahu pair semula dari kosong, stop bot dan padam folder `.wa-auth`.
- Bot ini process command dari chat masuk. Guna `ALLOWED_NUMBERS` untuk limit siapa boleh akses.
