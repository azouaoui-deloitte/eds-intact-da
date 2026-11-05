/* AEM render vs da.live render: full-page screenshots per viewport, side-by-side image, pixel diff,
 * section heights and console errors.
 * usage: node compare.mjs <aemUrl> <daUrl> [outDir=/tmp/intact-da/compare] [widths=1440,768,375] */
import fs from 'fs';
import { createRequire } from 'module';

const requireTools = createRequire('/Users/azouaoui/Documents/eds-intact/import-work/tools/package.json');
const { PNG } = requireTools('pngjs');
const pixelmatch = requireTools('pixelmatch');
const require = createRequire('/Users/azouaoui/.codex/skills/adobe__plugins__aem__edge-delivery-services__skills__scrape-webpage/scripts/package.json');
const { chromium } = require('playwright');

const [,, aemUrl, daUrl, outDir = '/tmp/intact-da/compare', widthsArg = '1440,768,375'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function capture(url, width) {
  const page = await browser.newPage({
    viewport: { width, height: 900 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('rum')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 80); });
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.marquee-track, .marquee-viewport * { animation: none !important; transform: none !important; }' });
  const sections = await page.$$eval('header, main > .section, footer', (els) => els.map((el) => `${el.tagName === 'DIV' ? [...el.classList].filter((c) => c !== 'section').join('.') : el.tagName.toLowerCase()}:${Math.round(el.getBoundingClientRect().height)}`));
  const png = PNG.sync.read(await page.screenshot({ fullPage: true }));
  await page.close();
  return { png, sections, errors };
}

const report = [];
for (const width of widthsArg.split(',').map(Number)) {
  // eslint-disable-next-line no-await-in-loop
  const [a, b] = [await capture(aemUrl, width), await capture(daUrl, width)];
  const h = Math.min(a.png.height, b.png.height);
  const crop = (png) => {
    const o = new PNG({ width, height: h });
    PNG.bitblt(png, o, 0, 0, width, h, 0, 0);
    return o;
  };
  const diff = new PNG({ width, height: h });
  const n = pixelmatch(crop(a.png).data, crop(b.png).data, diff.data, width, h, { threshold: 0.2 });
  const side = new PNG({ width: width * 2 + 20, height: Math.max(a.png.height, b.png.height) });
  side.data.fill(255);
  PNG.bitblt(a.png, side, 0, 0, width, a.png.height, 0, 0);
  PNG.bitblt(b.png, side, 0, 0, width, b.png.height, width + 20, 0);
  fs.writeFileSync(`${outDir}/side-${width}.png`, PNG.sync.write(side));
  fs.writeFileSync(`${outDir}/diff-${width}.png`, PNG.sync.write(diff));
  report.push(`${width}: height aem ${a.png.height} / da ${b.png.height}, ${((100 * n) / (width * h)).toFixed(2)}% pixels differ`);
  a.sections.forEach((s, i) => { if (s !== b.sections[i]) report.push(`  section aem ${s} / da ${b.sections[i]}`); });
  if (a.sections.length !== b.sections.length) report.push(`  sections aem ${a.sections.length} / da ${b.sections.length}`);
  [...new Set(b.errors)].forEach((e) => report.push(`  da error: ${e.slice(0, 160)}`));
  [...new Set(a.errors)].forEach((e) => report.push(`  aem error: ${e.slice(0, 160)}`));
}
await browser.close();
fs.writeFileSync(`${outDir}/summary.txt`, `${report.join('\n')}\n`);
console.log(report.join('\n'));
