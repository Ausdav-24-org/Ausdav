#!/usr/bin/env node

/**
 * 📸 Image Compression Script
 * 
 * Compresses all images in src/assets/ using Sharp
 * Targets:
 * - PNG files: 80% quality, WebP alternative
 * - JPG files: 75% quality
 * 
 * Usage: npm run compress-images
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, '../src/assets');
const compressionTargets = [
  { name: 'official page.png', quality: 75 },
  { name: 'who we are.png', quality: 75 },
  { name: 'Thaya2.png', quality: 75 },
  { name: 'seraja.jpg', quality: 70 },
  { name: 'apply_portal_banner.png', quality: 80 },
  { name: 'check_registration_banner.png', quality: 80 },
  { name: 'abinaya.jpg', quality: 75 },
  { name: 'thani.jpg', quality: 75 },
  { name: 'AUSDAV_llogo.png', quality: 85 },
];

async function getFilePath(filename) {
  // Search recursively in assets folder
  const walk = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const result = walk(fullPath);
        if (result) return result;
      } else if (file === filename) {
        return fullPath;
      }
    }
    return null;
  };
  return walk(assetsDir);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function compressImage(inputPath, quality) {
  try {
    const ext = path.extname(inputPath).toLowerCase();
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, ext);
    
    // Original size
    const originalSize = fs.statSync(inputPath).size;
    
    // Compress and replace original
    if (ext === '.png') {
      await sharp(inputPath)
        .png({ quality: quality, compressionLevel: 9 })
        .toFile(inputPath + '.tmp');
      fs.renameSync(inputPath + '.tmp', inputPath);
      
      // Also create WebP version
      const webpPath = path.join(dir, basename + '.webp');
      await sharp(inputPath)
        .webp({ quality: quality })
        .toFile(webpPath);
      
      const newSize = fs.statSync(inputPath).size;
      const webpSize = fs.statSync(webpPath).size;
      const reduction = Math.round((1 - newSize / originalSize) * 100);
      
      console.log(
        `✅ ${basename}${ext}\n` +
        `   Original: ${formatBytes(originalSize)}\n` +
        `   Compressed: ${formatBytes(newSize)} (${reduction}% reduction)\n` +
        `   WebP: ${formatBytes(webpSize)}\n`
      );
    } else if (ext === '.jpg' || ext === '.jpeg') {
      await sharp(inputPath)
        .jpeg({ quality: quality, progressive: true })
        .toFile(inputPath + '.tmp');
      fs.renameSync(inputPath + '.tmp', inputPath);
      
      // Also create WebP version
      const webpPath = path.join(dir, basename + '.webp');
      await sharp(inputPath)
        .webp({ quality: quality })
        .toFile(webpPath);
      
      const newSize = fs.statSync(inputPath).size;
      const webpSize = fs.statSync(webpPath).size;
      const reduction = Math.round((1 - newSize / originalSize) * 100);
      
      console.log(
        `✅ ${basename}${ext}\n` +
        `   Original: ${formatBytes(originalSize)}\n` +
        `   Compressed: ${formatBytes(newSize)} (${reduction}% reduction)\n` +
        `   WebP: ${formatBytes(webpSize)}\n`
      );
    }
  } catch (error) {
    console.error(`❌ Error compressing ${inputPath}:`, error.message);
  }
}

async function main() {
  console.log('🖼️  Image Compression Starting...\n');
  console.log('Target Quality Settings:');
  console.log('- PNG files: 75-85% quality');
  console.log('- JPG files: 70-75% quality');
  console.log('- All files: Maximum compression\n');
  console.log('-----------------------------------\n');

  for (const target of compressionTargets) {
    const filePath = await getFilePath(target.name);
    if (filePath) {
      console.log(`🔄 Processing: ${target.name}`);
      await compressImage(filePath, target.quality);
    } else {
      console.log(`⏭️  File not found: ${target.name}\n`);
    }
  }

  console.log('-----------------------------------');
  console.log('✨ Compression complete!\n');
  console.log('📝 Next steps:');
  console.log('1. Review compressed images in src/assets/');
  console.log('2. Update HTML/CSS to use .webp with PNG fallback:');
  console.log('   <picture>');
  console.log('     <source srcset="image.webp" type="image/webp">');
  console.log('     <img src="image.png" alt="...">');
  console.log('   </picture>');
  console.log('3. Run: npm run build');
  console.log('4. Check bundle size reduction\n');
}

main().catch(console.error);
