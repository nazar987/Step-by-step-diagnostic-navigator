// Растеризация собственного SVG-значка для упаковщиков Windows и Android.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const svg = await readFile('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  return page.locator('svg').screenshot({ omitBackground: true });
}
try {
  await mkdir('build', { recursive: true });
  const image = await png(256);
  await writeFile('build/icon.png', image);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
  await writeFile('build/icon.ico', Buffer.concat([header, image]));
  for (const [density, size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    const folder = path.join('android/app/src/main/res', `mipmap-${density}`);
    await mkdir(folder, { recursive: true });
    const raster = await png(size);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) await writeFile(path.join(folder, name), raster);
  }
} finally { await browser.close(); }
