// WebP batch converter for MiniJungle product images
// Usage: node scripts/convert-webp.mjs
// Requires: npm install sharp

import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const INPUT_DIR = join(import.meta.dirname, '..', 'img');
const OUTPUT_DIR = join(import.meta.dirname, '..', 'img', 'webp');

const SIZES = [
  { width: 600, suffix: '-sm' },   // variant cards
  { width: 1200, suffix: '-md' },  // product bg
  { width: 1920, suffix: '-lg' },  // full bleed
];

async function convert() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = await readdir(INPUT_DIR);

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const inputPath = join(INPUT_DIR, file);
    const baseName = file.replace(ext, '');

    for (const size of SIZES) {
      const outputPath = join(OUTPUT_DIR, `${baseName}${size.suffix}.webp`);
      await sharp(inputPath)
        .resize(size.width)
        .webp({ quality: 80 })
        .toFile(outputPath);

      const outStat = await stat(outputPath);
      console.log(`✓ ${baseName}${size.suffix}.webp (${(outStat.size / 1024).toFixed(1)} KB)`);
    }
  }
  console.log('\nDone! Update image URLs in index.html to use /img/webp/');
}

convert().catch(console.error);
