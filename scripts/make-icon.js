/**
 * One-time script to regenerate assets/icon.ico from the SVG logo.
 * Run manually if the logo changes: node scripts/make-icon.js
 *
 * Requires: npm install --save-dev sharp to-ico
 * Remove them after running: npm uninstall sharp to-ico
 */
const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/icon.svg');
const outPath = path.join(__dirname, '../assets/icon.ico');

fs.mkdirSync(path.dirname(outPath), { recursive: true });

const svg = fs.readFileSync(svgPath);
const sizes = [256, 128, 64, 48, 32, 16];

Promise.all(sizes.map(s => sharp(svg).resize(s, s).png().toBuffer()))
  .then(bufs => toIco(bufs, { resize: false }))
  .then(ico => {
    fs.writeFileSync(outPath, ico);
    console.log(`icon.ico created — ${(ico.length / 1024).toFixed(1)} KB`);
  })
  .catch(err => {
    console.error('make-icon failed:', err.message);
    process.exit(1);
  });
