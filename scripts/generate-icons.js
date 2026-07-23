// Icon Generator Script for PWA
// Run with: node scripts/generate-icons.js

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'icon.svg');

async function generateIcons() {
  try {
    // Try to import sharp
    const sharp = await import('sharp').catch(() => null);
    
    if (!sharp) {
      console.log('⚠️  Sharp not installed. Install it with: npm install --save-dev sharp');
      console.log('📝 Or use online tools to generate icons from icon.svg');
      console.log('   - https://realfavicongenerator.net/');
      console.log('   - https://www.pwabuilder.com/imageGenerator');
      return;
    }

    console.log('🎨 Generating PWA icons...');

    const svgBuffer = readFileSync(svgPath);

    for (const size of sizes) {
      const outputPath = join(publicDir, `icon-${size}x${size}.png`);
      
      await sharp.default(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated: icon-${size}x${size}.png`);
    }

    console.log('✨ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    console.log('\n📝 Alternative: Use online tools to generate icons from icon.svg');
    console.log('   - https://realfavicongenerator.net/');
    console.log('   - https://www.pwabuilder.com/imageGenerator');
  }
}

generateIcons();
