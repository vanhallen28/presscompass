// Renders the SVG scenes from scenes.py to the JPEG illustrations in ../images (1800 × 1200).
// Usage (from the project folder):
//   python3 content/starter/tools/scenes.py /tmp/scenes
//   node content/starter/tools/render.mjs /tmp/scenes content/starter/images
// Uses the Playwright Chromium from the test setup (PW_CHROME_PATH may point at an installed Chrome) and sharp.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const [dir, out] = process.argv.slice(2);
const browser = await chromium.launch(process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
for (const file of readdirSync(dir).filter((name) => name.endsWith('.svg'))) {
  await page.setContent(`<html><body style="margin:0">${readFileSync(`${dir}/${file}`, 'utf8')}</body></html>`);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(`${out}/${file.replace('.svg', '.jpg')}`);
}
await browser.close();
console.log('Rendered.');
