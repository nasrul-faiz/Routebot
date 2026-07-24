# Dbrutals - Route & Calendar Management PWA

Professional route planning and calendar management application for delivery services. Built as a Progressive Web App (PWA) for installation on any device.

## ✨ Features

- 📍 **Route Management** - Create, edit, and manage delivery routes with interactive maps
- 📅 **Calendar** - Track and schedule deliveries
- 🗺️ **Plano VM** - Visual van management planning
- 🎨 **Dark/Light Mode** - Automatic theme switching
- 📱 **PWA Support** - Install as native app on any device
- 🔄 **Offline Mode** - Works without internet connection
- 💾 **Auto-save** - Track and save changes with confirmation
- 🎯 **Edit Mode** - Conditional editing with save/discard options

## 🚀 Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Untuk guna API + database lokal, jalankan server sekali:

```bash
npm start
```

## 📱 PWA & Deployment

See [PWA_DEPLOYMENT_GUIDE.md](./PWA_DEPLOYMENT_GUIDE.md) for complete setup and deployment instructions.
Railway unified deploy guide (web + API + WhatsApp bot): [RAILWAY_SETUP.md](./RAILWAY_SETUP.md)

**⚠️ Calendar Database Setup Required:**
- Calendar events require PostgreSQL database (Neon)
- See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for DATABASE_URL configuration
- Without database, events fallback to localStorage (device-only, not synced)

## 🛠️ Tech Stack

React 19 + TypeScript + Vite + Tailwind CSS + Radix UI + React Leaflet

## 🤖 WhatsApp Web Bot (QR)

This repository now includes a WhatsApp Web bot module that can fetch route data from this app via command.

Quick start:

```bash
npm install
npm start
```

Bot kini baca konfigurasi dari root `.env` secara automatik.
Jika perlukan setting khas untuk bot sahaja, anda boleh tambah fail `bot/.env` sebagai override optional.
Prefix default bot ialah `.` jadi command seperti `.help`, `.zip`, dan `.unzip` terus boleh digunakan.

Then scan the QR in terminal from WhatsApp Linked Devices.

Kalau nak guna pairing nombor telefon, bot akan tanya pilihan semasa start. Format nombor ialah antarabangsa tanpa `+`, contohnya `60123456789`.

If running unified server (`npm start`), bot dashboard URL is:

- `/bot/dashboard`
- optional protected access: `/bot/dashboard?token=...` (set `BOT_DASHBOARD_TOKEN`)

Full guide: [bot/README.md](./bot/README.md)
