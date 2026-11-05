/* Builds the da.live documents of eds-intact-da from the AEM (xwalk) render of the Intact site.
 *   - /en/personal-insurance: the page plain html with a metadata block (title, description)
 *   - /nav, /footer: documents mapped from the header / footer Experience Fragments (structure
 *     expected by blocks/header and blocks/footer)
 *   - /metadata.json (nav / footer for /**), /redirects.json (/ -> /en/personal-insurance)
 *   - DAM images /content/dam/intact/<path> -> https://content.da.live/<org>/<repo>/media/intact/<file>;
 *     Edge Delivery rejects SVG > 40 KB: such SVGs are minified (svgo), else replaced by the PNG of
 *     ../source/overrides/
 * usage: node build-da.mjs [--fetch]   --fetch refreshes ../source/ from AEM (read-only GETs)
 * out: ../da/ */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const { JSDOM } = createRequire('/Users/azouaoui/Documents/eds-intact/import-work/tools/package.json')('jsdom');
const sharp = createRequire('/Users/azouaoui/.codex/skills/adobe__plugins__aem__edge-delivery-services__skills__scrape-webpage/scripts/package.json')('sharp');

const ORG = 'azouaoui-deloitte';
const REPO = 'eds-intact-da';
const AEM = 'https://localhost:8444';
const AUTHOR = 'http://localhost:4802';
const PAGE = '/content/intact/en/personal-insurance';
const XF = '/content/experience-fragments/intact/en/site';
const WORK = new URL('../', import.meta.url).pathname;
const SOURCE = path.join(WORK, 'source');
const OUT = path.join(WORK, 'da');
const MEDIA = path.join(OUT, 'media/intact');
const MEDIA_URL = `https://content.da.live/${ORG}/${REPO}/media/intact`;
const SVG_LIMIT = 40 * 1024;

const sources = {
  'personal-insurance.plain.html': `${AEM}${PAGE}.plain.html`,
  'header.content.html': `${AEM}${XF}/header/master.content.html?wcmmode=disabled`,
  'footer.content.html': `${AEM}${XF}/footer/master.content.html?wcmmode=disabled`,
};
const auth = { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` };
if (process.argv.includes('--fetch')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  await Promise.all(Object.entries(sources).map(async ([file, url]) => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status} ${url}`);
    fs.writeFileSync(path.join(SOURCE, file), await resp.text());
  }));
}
const read = (file) => fs.readFileSync(path.join(SOURCE, file), 'utf8');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(MEDIA, { recursive: true });

/**
 * Embedded bitmaps of an SVG (Figma image fills, e.g. the Olympic rings) re-encoded as 600 px JPEG
 * on white: they are drawn with mix-blend-mode multiply, where white is neutral.
 */
async function shrinkEmbeddedImages(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const images = [...svg.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)];
  if (!images.length || !svg.includes('mix-blend-mode:multiply')) return;
  const jpegs = await Promise.all(images.map(([, data]) => sharp(Buffer.from(data, 'base64'))
    .resize({ width: 600, withoutEnlargement: true }).flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer()));
  fs.writeFileSync(file, images.reduce((s, [uri], i) => s.replace(uri, `data:image/jpeg;base64,${jpegs[i].toString('base64')}`), svg));
}

/** DAM image -> da.live media file name (cached in ../source/dam/) */
const media = new Map();
async function addMedia(damPath) {
  const name = path.basename(damPath);
  if (media.has(damPath)) return media.get(damPath);
  const cache = path.join(SOURCE, 'dam', damPath.replace('/content/dam/intact/', ''));
  if (!fs.existsSync(cache) || process.argv.includes('--fetch')) {
    const resp = await fetch(`${AUTHOR}${damPath}`, { headers: auth });
    if (!resp.ok) throw new Error(`${resp.status} ${damPath}`);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, Buffer.from(await resp.arrayBuffer()));
  }
  let out = name;
  const target = path.join(MEDIA, name);
  fs.copyFileSync(cache, target);
  if (name.endsWith('.svg') && fs.statSync(target).size > SVG_LIMIT) {
    // svgo precision would break the tiny pattern transforms of embedded bitmaps: re-encode first
    await shrinkEmbeddedImages(target);
    if (fs.statSync(target).size > SVG_LIMIT) {
      execFileSync('npx', ['-y', 'svgo@3', '--multipass', '-p', '2', '-q', target, '-o', target]);
    }
    if (fs.statSync(target).size > SVG_LIMIT) {
      fs.rmSync(target);
      out = name.replace(/\.svg$/, '.png');
      fs.copyFileSync(path.join(SOURCE, 'overrides', out), path.join(MEDIA, out));
    }
  }
  media.set(damPath, out);
  return out;
}
async function rewriteMedia(html) {
  const paths = [...new Set([...html.matchAll(/src="(\/content\/dam\/intact\/[^"]+)"/g)].map((m) => m[1]))];
  const names = await Promise.all(paths.map(addMedia));
  return paths.reduce((h, p, i) => h.replaceAll(`src="${p}"`, `src="${MEDIA_URL}/${names[i]}"`), html);
}

const clean = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+data-richtext-[a-z-]+="[^"]*"/g, '')
  .replace(/\s+id="[^"]*"/g, '')
  .replace(/\s+(width|height)="\d+"/g, '')
  .replace(/>\s+</g, '><')
  .trim();
const doc = (main) => `<body><header></header><main>${main}</main><footer></footer></body>\n`;
const block = (name, rows) => `<div class="${name}">${rows.map((cells) => `<div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`).join('')}</div>`;
const write = (file, html) => {
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), html);
};

// page
const metadata = block('metadata', [
  ['Title', 'Personal insurance | Intact Insurance'],
  ['Description', 'Intact is Canada\'s largest property and casualty insurer, protecting one in four Canadians through 6,000+ broker offices with car and home insurance.'],
]);
const page = clean(await rewriteMedia(read('personal-insurance.plain.html')));
write('en/personal-insurance.html', doc(page.replace(/<\/div>$/, `${metadata}</div>`)));

// nav / footer documents from the Experience Fragments
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');
const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const a = (href, label, title) => `<a href="${escAttr(href)}"${title ? ` title="${escAttr(title)}"` : ''}>${label.startsWith(':') ? label : escText(label)}</a>`;
const link = (el, label = txt(el)) => a(el.getAttribute('href'), label, el.getAttribute('title'));
const li = (content, overflow) => `<li>${overflow ? `<em>${content}</em>` : content}</li>`;
const ul = (items) => `<ul>${items.join('')}</ul>`;
const section = (...content) => `<div>${content.join('')}</div>`;
const isOverflow = (el) => el.closest('li')?.classList.contains('is-overflow');
const iconOf = (img) => `:${path.basename(img.getAttribute('src'), '.svg')}:`;

const header = new JSDOM(read('header.content.html')).window.document.querySelector('nav#nav');
const q = (sel, root = header) => root.querySelector(sel);
const qa = (sel, root = header) => [...root.querySelectorAll(sel)];
const utilityItem = (el) => li(el.tagName === 'BUTTON'
  ? a('#province', txt(el), el.getAttribute('title'))
  : link(el), isOverflow(el));
const mainLinks = qa('.nav-drawer-links > li');
const menus = [];
for (const [i, item] of mainLinks.entries()) {
  const next = q('.nav-drawer-next', item);
  if (!next) continue; // eslint-disable-line no-continue
  const panel = q(`#nav-menu-${i}`);
  const parts = [`<h2>${a(q('.nav-drawer-link', item).getAttribute('href'), next.dataset.label)}</h2>`];
  qa('.nav-menu-column', panel).forEach((col) => {
    parts.push(`<h3>${escText(txt(q('.nav-menu-label', col)))}</h3>`, ul(qa('a', col).map((l) => li(link(l)))));
  });
  const card = q('.nav-menu-card', panel);
  if (card) {
    const img = q('img', card);
    // eslint-disable-next-line no-await-in-loop
    if (img) parts.push(`<p><picture><img src="${MEDIA_URL}/${await addMedia(img.getAttribute('src'))}" alt="${escAttr(img.getAttribute('alt') || '')}"></picture></p>`);
    if (q('.nav-menu-card-tag', card)) parts.push(`<p>${escText(txt(q('.nav-menu-card-tag', card)))}</p>`);
    parts.push(`<h4>${a(card.getAttribute('href'), txt(q('.nav-menu-card-title', card)))}</h4>`);
    if (q('.nav-menu-card-text', card)) parts.push(`<p>${escText(txt(q('.nav-menu-card-text', card)))}</p>`);
  }
  menus.push(section(...parts));
}
const logo = q('.nav-logo');
const searchForm = q('#nav-search form');
write('nav.html', doc([
  section(
    ul(qa('.nav-segments a').map((l) => li(l.hasAttribute('aria-current') ? `<strong>${link(l)}</strong>` : link(l)))),
    ul(qa('.nav-utility .nav-utility-link').map(utilityItem)),
  ),
  section(
    `<p>${a(logo.getAttribute('href'), iconOf(q('img', logo)), logo.getAttribute('aria-label'))}</p>`,
    ul(mainLinks.map((item) => li(link(q('.nav-drawer-link', item)), item.classList.contains('is-overflow')))),
    `<p>${link(q('.nav-login'))}</p>`,
    `<p><strong>${link(q('.nav-cta'))}</strong></p>`,
  ),
  section(
    `<p>${escText(txt(q('label', searchForm)))}</p>`,
    `<p>${escText(q('input', searchForm).getAttribute('placeholder'))}</p>`,
    `<p>${a(searchForm.getAttribute('action'), q('button', searchForm).getAttribute('aria-label'))}</p>`,
    `<h2>${escText(txt(q('.nav-search-suggestions .nav-menu-label')))}</h2>`,
    ul(qa('.nav-search-suggestion').map((l) => li(link(l)))),
  ),
  ...menus,
].join('')));

const footer = new JSDOM(read('footer.content.html')).window.document.querySelector('.footer-inner');
const f = (sel) => footer.querySelector(sel);
const fa = (sel, root = footer) => [...root.querySelectorAll(sel)];
const group = (g) => {
  const items = fa('li a', g).map((l) => {
    const img = l.querySelector('img');
    return li(img ? a(l.getAttribute('href'), iconOf(img), l.getAttribute('aria-label')) : link(l));
  });
  return `<h2>${escText(txt(g.querySelector('.footer-label')))}</h2>${ul(items)}`;
};
write('footer.html', doc([
  section(...fa('.footer-column:not(.footer-aside)').map(group)),
  section(...fa('.footer-aside .footer-group').map(group)),
  section(
    ul(fa('.footer-selectors .footer-selector').map((el) => li(el.tagName === 'BUTTON' ? a('#province', txt(el), el.getAttribute('title')) : link(el)))),
    ul(fa('.footer-legal .footer-legal-link').map((el) => li(el.tagName === 'BUTTON' ? a('#footer-notes', txt(el)) : link(el)))),
    ...fa('#footer-notes > p').map((p) => `<p>${p.innerHTML.replace(/<em>(\S+) <\/em>/g, '<em>$1</em> ')}</p>`),
  ),
  section(
    `<p>${escText(txt(f('.footer-related-label')))}</p>`,
    ul(fa('.footer-related-list a').map((l) => li(link(l)))),
    `<p>${a(f('.footer-logo').getAttribute('href'), iconOf(f('.footer-logo img')), f('.footer-logo').getAttribute('aria-label'))}</p>`,
    `<p>${escText(txt(f('.footer-copyright-text')))}</p>`,
  ),
].join('')));

const sheet = (data) => ({
  total: data.length, limit: data.length, offset: 0, data, ':type': 'sheet',
});
write('metadata.json', JSON.stringify(sheet([{ URL: '/**', nav: '/nav', footer: '/footer' }])));
write('redirects.json', JSON.stringify(sheet([
  { Source: '/', Destination: '/en/personal-insurance' },
  { Source: '/en', Destination: '/en/personal-insurance' },
  { Source: '/en/', Destination: '/en/personal-insurance' },
  { Source: '/index', Destination: '/en/personal-insurance' },
])));
console.log(`docs 3, sheets 2, media ${media.size} -> ${OUT}`);
