#!/usr/bin/env node

/**
 * Seed development data into Neon PostgreSQL
 * Run: node scripts/seed-dev-data.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function seedData() {
  try {
    console.log('🌱 Seeding development data...\n');

    // ─── Calendar Events ──────────────────────────────────────────────────
    console.log('📅 Creating calendar events...');
    const today = new Date();
    const events = [
      { title: 'System Maintenance', event_date: new Date(today.getTime() + 1000*60*60*24*7).toISOString().split('T')[0], type: 'maintenance' },
      { title: 'Team Meeting', event_date: new Date(today.getTime() + 1000*60*60*24*2).toISOString().split('T')[0], type: 'meeting' },
      { title: 'Holiday - National Day', event_date: '2026-08-31', type: 'holiday' },
      { title: 'Delivery Ops Review', event_date: new Date(today.getTime() + 1000*60*60*24*14).toISOString().split('T')[0], type: 'event' },
    ];

    for (const event of events) {
      await sql`INSERT INTO calendar_events (title, event_date, type) 
        VALUES (${event.title}, ${event.event_date}, ${event.type})
        ON CONFLICT DO NOTHING`;
    }
    console.log('✅ Calendar events created\n');

    // ─── Delivery Data ────────────────────────────────────────────────────
    console.log('🚚 Creating deliveries...');
    await sql`CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      tracking_no VARCHAR(100) UNIQUE NOT NULL,
      recipient_name VARCHAR(255),
      address TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      delivery_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;
    const deliveries = [
      { tracking_no: 'TRK001', recipient_name: 'Ahmad Ali', address: 'Jalan Merdeka 123, KL', status: 'delivered', delivery_date: new Date(today.getTime() - 1000*60*60*24*2).toISOString().split('T')[0] },
      { tracking_no: 'TRK002', recipient_name: 'Siti Aisyah', address: 'Petaling Jaya, Selangor', status: 'in-transit', delivery_date: new Date(today.getTime() + 1000*60*60*24).toISOString().split('T')[0] },
      { tracking_no: 'TRK003', recipient_name: 'Raj Kumar', address: 'Damansara Heights, KL', status: 'pending', delivery_date: new Date(today.getTime() + 1000*60*60*24*2).toISOString().split('T')[0] },
      { tracking_no: 'TRK004', recipient_name: 'Michelle Chen', address: 'Shah Alam, Selangor', status: 'pending', delivery_date: new Date(today.getTime() + 1000*60*60*24*3).toISOString().split('T')[0] },
      { tracking_no: 'TRK005', recipient_name: 'Aminah Hassan', address: 'Kuala Lumpur', status: 'delivered', delivery_date: new Date(today.getTime() - 1000*60*60*24).toISOString().split('T')[0] },
    ];

    for (const delivery of deliveries) {
      await sql`INSERT INTO deliveries (tracking_no, recipient_name, address, status, delivery_date)
        VALUES (${delivery.tracking_no}, ${delivery.recipient_name}, ${delivery.address}, ${delivery.status}, ${delivery.delivery_date})
        ON CONFLICT (tracking_no) DO UPDATE SET status=EXCLUDED.status`;
    }
    console.log('✅ Deliveries created\n');

    // ─── Routes with Delivery Points ──────────────────────────────────────
    console.log('🗺️  Creating routes and delivery points...');
    await sql`CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) NOT NULL,
      shift VARCHAR(50) DEFAULT 'AM',
      delivery_points JSONB DEFAULT '[]',
      color VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT NULL`;
    const routes = [
      {
        id: 'route-001',
        name: 'Central KL Morning Route',
        code: 'CKL-AM-001',
        shift: 'AM',
        color: '#ef4444',
        deliveryPoints: [
          { code: 'KL001', name: 'Petronas Twin Towers', delivery: 'Daily', latitude: 3.1578, longitude: 101.6871, descriptions: [{ key: 'tel', value: '03-2331 8080' }] },
          { code: 'KL002', name: 'Mid Valley Megamall', delivery: 'Weekday', latitude: 3.1230, longitude: 101.5800, descriptions: [{ key: 'tel', value: '03-2287 1111' }] },
          { code: 'KL003', name: 'KL Convention Centre', delivery: 'Alt 1', latitude: 3.1890, longitude: 101.6920, descriptions: [{ key: 'tel', value: '03-2020 1000' }] },
        ]
      },
      {
        id: 'route-002',
        name: 'Subang Afternoon Route',
        code: 'SBG-PM-001',
        shift: 'PM',
        color: '#3b82f6',
        deliveryPoints: [
          { code: 'SBG001', name: 'Empire Shopping Gallery', delivery: 'Daily', latitude: 3.0573, longitude: 101.5453, descriptions: [{ key: 'tel', value: '03-5632 8100' }] },
          { code: 'SBG002', name: 'The Summit USJ', delivery: 'Weekday', latitude: 3.0667, longitude: 101.5513, descriptions: [{ key: 'tel', value: '03-8070 0500' }] },
          { code: 'SBG003', name: 'Subang Jaya Business Hub', delivery: 'Alt 2', latitude: 3.0559, longitude: 101.5517, descriptions: [{ key: 'tel', value: '03-5610 3333' }] },
        ]
      },
      {
        id: 'route-003',
        name: 'Petaling Jaya Distribution',
        code: 'PJ-WD-001',
        shift: 'AM',
        color: '#10b981',
        deliveryPoints: [
          { code: 'PJ001', name: 'One Utama Shopping Centre', delivery: 'Daily', latitude: 3.0397, longitude: 101.6013, descriptions: [{ key: 'tel', value: '03-7727 1111' }] },
          { code: 'PJ002', name: 'Armada Shopping Mall', delivery: 'Weekday', latitude: 3.0433, longitude: 101.5844, descriptions: [{ key: 'tel', value: '03-7620 2201' }] },
          { code: 'PJ003', name: 'Pavilion KL', delivery: 'Alt 1', latitude: 3.0343, longitude: 101.6188, descriptions: [{ key: 'tel', value: '03-2118 8833' }] },
          { code: 'PJ004', name: 'Atria Shopping Gallery', delivery: 'Alt 2', latitude: 3.0285, longitude: 101.6060, descriptions: [{ key: 'tel', value: '03-7622 5566' }] },
        ]
      },
    ];

    for (const route of routes) {
      await sql`INSERT INTO routes (id, name, code, shift, delivery_points, color)
        VALUES (${route.id}, ${route.name}, ${route.code}, ${route.shift}, ${JSON.stringify(route.deliveryPoints)}, ${route.color})
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, delivery_points=EXCLUDED.delivery_points`;
    }
    console.log('✅ Routes and delivery points created\n');

    // ─── Notes ────────────────────────────────────────────────────────────
    console.log('📝 Creating notes...');
    await sql`CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255),
      content TEXT,
      author VARCHAR(255),
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;
    const notes = [
      { id: 'note-001', type: 'note', title: 'System Setup Complete', content: 'Database is now configured and seeded with sample data. Ready for development.', author: 'Admin', pinned: true },
      { id: 'changelog-001', type: 'changelog', title: 'v1.0.0 - Initial Release', content: '- Location management with GPS coordinates\n- Route optimization\n- Delivery tracking\n- Calendar events', author: 'Dev Team', pinned: false },
      { id: 'note-002', type: 'note', title: 'Development Tips', content: 'Remember to test with different screen sizes and delivery statuses. Use the map feature to visualize routes.', author: 'Admin', pinned: false },
    ];

    for (const note of notes) {
      await sql`INSERT INTO notes (id, type, title, content, author, pinned)
        VALUES (${note.id}, ${note.type}, ${note.title}, ${note.content}, ${note.author}, ${note.pinned})
        ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content`;
    }
    console.log('✅ Notes created\n');

    console.log('🎉 All sample data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ 4 Calendar events');
    console.log('   ✓ 5 Deliveries');
    console.log('   ✓ 3 Routes with 11 delivery points');
    console.log('   ✓ 3 Notes');
    console.log('\n💡 Ready to start developing! 🚀');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
