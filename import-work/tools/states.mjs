/* Interactive states and header / footer DOM parity: AEM render vs da.live render.
 * usage: node states.mjs <aemUrl> <daUrl> [outDir=/tmp/intact-da/states] */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('/Users/azouaoui/.codex/skills/adobe__plugins__aem__edge-delivery-services__skills__scrape-webpage/scripts/package.json');
const { chromium } = require('playwright');

const [,, aemUrl, daUrl, outDir = '/tmp/intact-da/states'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const normalize = (html) => html
  .replace(/\s+/g, ' ')
  .replace(/> </g, '><')
  .replace(/ (data-block-status|data-nav-init|data-footer-init|loading|title)="[^"]*"/g, '')
  .replace(/src="[^"]*\/icons\//g, 'src="/icons/')
  .replace(/ class="([^"]*) false"/g, ' class="$1"')
  .replace(/ alt=""/g, '')
  .replace(/(class="nav-menu-card-image" src=")[^"]*"/g, '$1"')
  .replace(/&amp;/g, '&');

async function run(url, label) {
  const out = { errors: [], checks: {} };
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  page.on('pageerror', (e) => out.errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('footer .footer-inner', { timeout: 30000 });
  out.nav = normalize(await page.$eval('nav#nav', (n) => n.outerHTML));
  out.footer = normalize(await page.$eval('footer .footer-inner', (n) => n.outerHTML));
  const c = out.checks;
  c.buttons = await page.$$eval('main a.button', (as) => as.map((a) => a.className.replace('button ', '')).join(','));
  const primary = page.locator('main a.button.primary').first();
  const before = await primary.evaluate((a) => getComputedStyle(a).backgroundColor);
  await primary.hover();
  await page.waitForTimeout(400);
  c.primaryHover = `${before} -> ${await primary.evaluate((a) => getComputedStyle(a).backgroundColor)}`;
  const item = page.locator('.accordion details').nth(1);
  await item.locator('summary').click();
  c.accordionOpen = await item.evaluate((d) => d.open && d.querySelector('.accordion-item-body').offsetHeight > 0);
  c.marquee = await page.$eval('.marquee-track', (t) => `${getComputedStyle(t).animationName} ${getComputedStyle(t).animationPlayState}`);
  await page.click('.nav-menu-toggle');
  c.megaMenu = await page.$eval('.nav-menu:not([hidden])', (m) => `${m.id} ${m.querySelectorAll('.nav-menu-column').length} columns, card ${!!m.querySelector('.nav-menu-card img')?.naturalWidth}, h ${m.offsetHeight}`).catch(() => 'closed');
  await page.screenshot({ path: `${outDir}/${label}-megamenu-1440.png` });
  await page.keyboard.press('Escape');
  await page.hover('.product-list li:nth-child(2) .product-list-item');
  await page.waitForTimeout(700);
  c.productHover = await page.$eval('.product-list li:nth-child(2) .product-list-illustration img', (i) => `${i.naturalWidth > 0} ${getComputedStyle(i.closest('picture')).opacity}`).catch(() => 'none');
  await page.click('.nav-search-toggle');
  c.searchOpen = await page.$eval('#nav-search', (p) => `${!p.hidden && p.contains(document.activeElement)} suggestions ${p.querySelectorAll('.nav-search-suggestion').length}`);
  await page.screenshot({ path: `${outDir}/${label}-search-1440.png` });
  await page.keyboard.press('Escape');
  c.searchClosed = await page.$eval('#nav-search', (p) => p.hidden);
  await page.click('.footer-notes-toggle');
  c.notesOpen = await page.$eval('#footer-notes', (p) => !p.hidden && p.offsetHeight > 0);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  c.scrolled = await page.$eval('nav#nav', (n) => n.classList.contains('is-scrolled'));
  await page.setViewportSize({ width: 375, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.click('.nav-hamburger');
  c.drawerOpen = await page.$eval('#nav-drawer', (d) => !d.hidden && d.offsetHeight > 0);
  await page.screenshot({ path: `${outDir}/${label}-drawer-375.png` });
  await page.click('.nav-drawer-next');
  await page.waitForTimeout(300);
  c.drawerLevel2 = await page.$eval('#nav-drawer', (d) => `${d.classList.contains('is-level-2')} ${d.querySelector('.nav-drawer-back-label').textContent} ${!!d.querySelector('.nav-drawer-sub:not([hidden]) .nav-menu-card')}`);
  await page.screenshot({ path: `${outDir}/${label}-drawer-l2-375.png` });
  await page.click('.nav-drawer-back');
  c.drawerBack = await page.$eval('#nav-drawer', (d) => !d.classList.contains('is-level-2') && !d.querySelector('.nav-drawer-main').hidden);
  await page.click('.nav-drawer-close');
  c.drawerClosed = await page.$eval('#nav-drawer', (d) => d.hidden);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.click('.nav-hamburger');
  c.burger1280 = await page.$eval('#nav-drawer', (d) => `${!d.hidden} overflow visible ${[...d.querySelectorAll('.is-overflow')].filter((e) => e.offsetHeight > 0).length}`);
  await page.close();
  return out;
}

const aem = await run(aemUrl, 'aem');
const da = await run(daUrl, 'da');
await browser.close();
fs.writeFileSync(`${outDir}/dom.json`, JSON.stringify({
  aemNav: aem.nav, daNav: da.nav, aemFooter: aem.footer, daFooter: da.footer,
}, null, 1));
const lines = Object.keys(aem.checks).map((k) => `${k}: aem ${aem.checks[k]} | da ${da.checks[k]}`);
lines.push(`nav DOM identical: ${aem.nav === da.nav}`, `footer DOM identical: ${aem.footer === da.footer}`);
lines.push(`js errors: aem ${aem.errors.length} | da ${da.errors.length} ${da.errors.join(' ; ').slice(0, 200)}`);
console.log(lines.join('\n'));
