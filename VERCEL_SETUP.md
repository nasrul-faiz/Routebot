# 🚀 Vercel Deployment Setup Guide

## Penting untuk WhatsApp Bot

Vercel sesuai untuk frontend + API serverless, tetapi **tidak sesuai** untuk WhatsApp Web bot yang perlukan proses Node berterusan, session file (`.wa-auth`), dan reconnect loop.

Jika anda mahu guna `.sticker`, `.tts`, atau command WhatsApp lain secara production:

- Deploy bot/unified server di Railway (rujuk [RAILWAY_SETUP.md](RAILWAY_SETUP.md)).
- Kekalkan Vercel untuk frontend/API sahaja jika diperlukan.

## Masalah: Calendar events hilang selepas save?

Kalau calendar events tak save atau hilang bila refresh, ini bermaksud **DATABASE_URL tak configure** di Vercel environment variables.

---

## ✅ Penyelesaian: Setup DATABASE_URL di Vercel

### Step 1: Dapatkan Neon PostgreSQL Connection String

1. Pergi ke [https://neon.tech](https://neon.tech)
2. Login atau create account
3. Create new project (Free tier available)
4. Copy **Connection String** yang diberikan
   - Format: `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`

### Step 2: Add DATABASE_URL ke Vercel

1. Pergi ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project **Dbrutals**
3. Klik **Settings** tab
4. Pilih **Environment Variables** dari sidebar
5. Klik **Add New**
6. Masukkan:
   - **Name**: `DATABASE_URL`
   - **Value**: (paste connection string dari Neon)
   - **Environment**: Pilih **Production**, **Preview**, dan **Development**
7. Klik **Save**

### Optional: Setup WhatsApp Bot API (untuk hantar mesej dari app)

Jika nak guna butang **Send WhatsApp** dalam Route List, tambah environment variables ini juga:

1. Di Vercel project yang sama, pergi ke **Settings → Environment Variables**
2. Tambah variable berikut:
   - **Name**: `WHATSAPP_ACCESS_TOKEN`
   - **Value**: Permanent token dari Meta WhatsApp Cloud API
   - **Environment**: Production, Preview, Development
3. Tambah lagi:
   - **Name**: `WHATSAPP_PHONE_NUMBER_ID`
   - **Value**: Phone Number ID dari WhatsApp Cloud API
4. (Optional) Tambah default penerima:
   - **Name**: `WHATSAPP_DEFAULT_TO`
   - **Value**: nombor telefon format international (contoh: `60123456789`)
5. (Optional) Kalau API version berbeza:
   - **Name**: `WHATSAPP_GRAPH_VERSION`
   - **Value**: contoh `v21.0`

Notes:
- Endpoint app akan guna `POST /api/whatsapp`
- Nombor penerima mesti format digits only (tanpa `+`, space, atau `-`)
- Dalam mode development Meta, nombor penerima perlu jadi test number yang dibenarkan

### Step 3: Redeploy

1. Pergi ke **Deployments** tab
2. Klik **...** (three dots) pada latest deployment
3. Pilih **Redeploy**
4. Tunggu deployment selesai

---

## 🔍 Verify Setup Berjaya

Selepas redeploy:

1. Buka aplikasi di browser
2. Buka **Developer Console** (F12)
3. Navigate ke **Calendar** page
4. Add event baru
5. Refresh page

**Kalau berjaya:**
- ✅ Event masih ada selepas refresh
- ✅ Tiada "offline mode" banner
- ✅ Console log tunjuk API success (bukan localStorage fallback)

**Kalau masih gagal:**
- ❌ Check Vercel logs: `Deployments → Latest → View Function Logs`
- ❌ Pastikan DATABASE_URL betul-betul di-copy dengan lengkap
- ❌ Pastikan tiada typo dalam variable name (must be `DATABASE_URL`)

---

## 🛡️ Offline Mode Fallback

Aplikasi ini automatically fallback ke **localStorage** bila:
- DATABASE_URL tak configure
- Network offline
- Neon database unreachable

**localStorage limitations:**
- ⚠️ Data saved locally di browser sahaja
- ⚠️ Tak sync across devices
- ⚠️ Data hilang kalau clear browser cache

**Production setup:**
- ✅ Sentiasa configure DATABASE_URL untuk sync database yang proper
- ✅ Data sync across all devices
- ✅ Data persistent

---

## 📞 Troubleshooting

### Error: "DATABASE_URL not configured"
```
✅ Solution: Follow Step 2 above
```

### Events save tapi hilang bila refresh
```
✅ DATABASE_URL configured tapi connection gagal
✅ Check Neon dashboard - database mungkin suspended (free tier idle timeout)
✅ Visit neon.tech dashboard untuk "wake up" database
```

### "Offline mode" banner appears
```
✅ This means localStorage fallback is active
✅ Events save locally, but won't sync to database
✅ Fix: Ensure DATABASE_URL properly configured
```

---

## 🎯 Quick Checklist

- [ ] Neon PostgreSQL project created
- [ ] DATABASE_URL copied
- [ ] Environment variable added in Vercel
- [ ] Application redeployed
- [ ] Events persist after refresh
- [ ] No offline mode banner showing

---

**Selesai! Calendar events sekarang save ke database dengan betul.** 🎉
