/* Builds the da.live documents of eds-intact-da from the AEM (xwalk) render of the Intact page.
 *   - /en/personal-insurance: the page plain html (AEM localhost:8444, snapshot in ../source/)
 *     with a metadata block (title, description)
 *   - /nav, /footer: documents authored from the header / footer Experience Fragments
 *   - /metadata.json (nav / footer for /**), /redirects.json (/ -> /en/personal-insurance)
 *   - DAM images /content/dam/intact/<dir>/<file> -> https://content.da.live/<org>/<repo>/media/intact/<file>
 * usage: node build-da.mjs [--fetch]   (--fetch refreshes the snapshot from AEM)   out: ../da/ */
import fs from 'fs';
import path from 'path';

const ORG = 'azouaoui-deloitte';
const REPO = 'eds-intact-da';
const AEM = 'https://localhost:8444';
const PAGE = '/content/intact/en/personal-insurance';
const WORK = new URL('../', import.meta.url).pathname;
const SOURCE = path.join(WORK, 'source/personal-insurance.plain.html');
const DAM = path.resolve(WORK, '../../eds-intact/import-work/content/dam/intact');
const OUT = path.join(WORK, 'da');
const MEDIA = path.join(OUT, 'media/intact');
const MEDIA_URL = `https://content.da.live/${ORG}/${REPO}/media/intact`;

if (process.argv.includes('--fetch')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const resp = await fetch(`${AEM}${PAGE}.plain.html`);
  if (!resp.ok) throw new Error(`${resp.status} ${PAGE}.plain.html`);
  fs.mkdirSync(path.dirname(SOURCE), { recursive: true });
  fs.writeFileSync(SOURCE, await resp.text());
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(MEDIA, { recursive: true });

const used = new Set();
const media = (html) => html.replace(/src="\/content\/dam\/intact\/([^"]+)"/g, (m, rel) => {
  used.add(rel);
  return `src="${MEDIA_URL}/${path.basename(rel)}"`;
});
const clean = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+data-richtext-[a-z-]+="[^"]*"/g, '')
  .replace(/\s+id="[^"]*"/g, '')
  .replace(/\s+(width|height)="\d+"/g, '')
  .replace(/>\s+</g, '><')
  .replace(/<picture>\s*/g, '<picture>')
  .trim();
const doc = (main) => `<body><header></header><main>${main}</main><footer></footer></body>\n`;
const block = (name, rows) => `<div class="${name}">${rows.map((cells) => `<div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`).join('')}</div>`;

const metadata = block('metadata', [
  ['Title', 'Personal insurance | Intact Insurance'],
  ['Description', 'Intact is Canada\'s largest property and casualty insurer, protecting one in four Canadians through 6,000+ broker offices with car and home insurance.'],
]);
const page = clean(media(fs.readFileSync(SOURCE, 'utf8')));
fs.mkdirSync(path.join(OUT, 'en'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'en/personal-insurance.html'), doc(page.replace(/<\/div>$/, `${metadata}</div>`)));

const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const a = (href, label, title) => `<a href="${href.replace(/&/g, '&amp;')}"${title ? ` title="${title}"` : ''}>${label}</a>`;
const section = (...content) => `<div>${content.join('')}</div>`;
const W = 'https://www.intact.ca';
const QUOTE = 'https://webquote.app.intact.ca/?language=EN&province=QC&f=ch&origin=INTACT&intcid=personalhomepage';
const LOGIN = `${W}/etc.clientlibs/intact/clientlibs/branch/resources/index.html?b=in_login_headerintact_website_login_en&lang=EN&prov=QC`;
const FR = a(`${W}/fr/assurance-particuliers`, 'FR', 'Français');
const BROKER = `${W}/en/personal-insurance/find-a-broker`;

fs.writeFileSync(path.join(OUT, 'nav.html'), doc([
  section(
    ul([`<strong>${a(`${W}/en/personal-insurance`, 'Personal')}</strong>`, a(`${W}/en/business-insurance`, 'Business'), a('https://www.intactprestige.com', 'Prestige')]),
    ul([FR, a('#province', 'QC', 'Province: Quebec'), a(BROKER, 'Find a representative')]),
  ),
  section(
    `<p>${a(`${W}/en`, ':intact-logo:', 'Intact Insurance')}</p>`,
    ul([
      a(`${W}/en/personal-insurance/vehicle`, 'Vehicle insurance'),
      a(`${W}/en/personal-insurance/home`, 'Home insurance'),
      a(`${W}/en/personal-insurance/claims`, 'Claims'),
      a(`${W}/en/personal-insurance/online-services`, 'Online services'),
      a(`${W}/en/jiffy`, 'Home helper'),
    ]),
    `<p>${a(LOGIN, 'Login')}</p>`,
    `<p><strong>${a(QUOTE, 'Get my price')}</strong></p>`,
  ),
  section('<p>What are you looking for?</p>', '<p>Search by keyword</p>', `<p>${a(`${W}/en/search`, 'Search')}</p>`),
].join('')));

const quickLinks = ul([
  a(`${W}/en/personal-insurance/online-services/client-centre`, 'Client Centre'),
  a(`${W}/en/personal-insurance/claims`, 'Submit a claim'),
  a('https://clients.intact.ca/i_makeapayment_website_c001_en', 'Make a payment (personal)'),
  a('https://apps.intactinsurance.com/onlinepayment/qc', 'Make a payment (business)'),
  a(BROKER, 'Find a representative'),
  a(`${W}/en/faq`, 'Frequently asked questions'),
  a(`${W}/en/glossary`, 'Glossary'),
  a(`${W}/en/blog`, 'Blog'),
]);
fs.writeFileSync(path.join(OUT, 'footer.html'), doc([
  section(
    '<h2>PRODUCTS</h2>',
    ul([
      a(`${W}/en/personal-insurance/vehicle`, 'Vehicle insurance'),
      a(`${W}/en/personal-insurance/home`, 'Home insurance'),
      a(`${W}/en/business-insurance/coverage/property-insurance`, 'Business property insurance'),
      a(`${W}/en/business-insurance/coverage/commercial-vehicle-insurance`, 'Commercial vehical insurance'),
      a(`${W}/en/personal-insurance/intact-prestige`, 'Prestige insurance'),
    ]),
    '<h2>QUICK LINKS</h2>',
    quickLinks,
    '<h2>QUICK LINKS</h2>',
    quickLinks,
  ),
  section(
    '<h2>INTACT PORTAL</h2>',
    ul([a('https://portal.intactinsurance.com/en', 'Access for representatives')]),
    '<h2>SOCIAL MEDIA</h2>',
    ul([
      a('https://www.facebook.com/intact', ':social-facebook:', 'Facebook'),
      a('https://twitter.com/intactinsurance', ':social-x:', 'X'),
      a('https://www.linkedin.com/company/intact', ':social-linkedin:', 'LinkedIn'),
      a('https://www.instagram.com/intactinsurance', ':social-instagram:', 'Instagram'),
      a('https://www.youtube.com/channel/UC_HXmZRxOXX9V3PpHIxj3KQ', ':social-youtube:', 'YouTube'),
    ]),
    '<h2>DOWNLOAD THE APP</h2>',
    ul([
      a('https://apps.apple.com/app/apple-store/id1363223619?pt=118337975&ct=FooterIntact&mt=8&l=en', ':badge-app-store:', 'Download on the App Store'),
      a('https://play.google.com/store/apps/details?id=com.intact&referrer=utm_source%3D0000-si-FooterIntact&hl=en_CA', ':badge-google-play:', 'Get it on Google Play'),
    ]),
  ),
  section(
    ul([a('#province', 'Quebec', 'Province: Quebec'), FR]),
    ul([
      a(`${W}/en/intact-sitemap`, 'Sitemap'),
      a(`${W}/en/legal`, 'Legal'),
      a(`${W}/en/privacy`, 'Privacy'),
      a(`${W}/en/accessibility-feedback-form`, 'Accessibility Feedback Form'),
      a(`${W}/en/customer-satisfaction`, 'Customer Satisfaction'),
      a('#footer-notes', 'Legal notes'),
    ]),
    '<p><sup>1</sup>Savings amount is based on filed and approved discounts and rates. These amounts may vary based on each person’s individual insurance profile.</p>',
    '<p><sup>3</sup>Intact Insurance voted Most Trusted auto insurance brand by Canadian shoppers, 2025 BrandSpark<sup>®</sup> Most Trusted Awards.</p>',
    '<p><sup>4</sup>Certain conditions, limitations, and exclusions apply to all offers. Offers may change without notice. The information that appears on this website is provided to you for informational purposes only. Your insurance policy always prevails; please consult it for a complete description of coverage and exclusions.</p>',
    `<p><sup>5</sup>Certain conditions and limitations apply. Please consult the ${a(`${W}/en/terms-intact-app`, 'Terms of Use')} of the <em>my</em> Drive<sup>™</sup> program.</p>`,
    '<p><sup>6</sup>The savings amount is based on filed and approved discounts and rates. These amounts may vary based on each person’s individual insurance profile.</p>',
    '<p>Apple and the Apple logo are trademarks of Apple Inc. App Store is a service mark of Apple Inc. Google Play, the Google Play logo and Android are trademarks of Google LLC.</p>',
  ),
  section(
    '<p>Also of Interest</p>',
    ul([
      a(`${W}/en/agents`, 'Ellipse Damage Insurance Agency, Saint-Siméon'),
      a(`${W}/en/personal-insurance/vehicle/car-insurance/car-insurance-glossary`, 'What is a deductible in car insurance?'),
      a(`${W}/en/personal-insurance/vehicle/car-insurance/car-insurance-glossary`, 'What is Comprehensive car insurance coverage?'),
    ]),
    `<p>${a(`${W}/en`, ':intact-logo-fr-white:', 'Intact Insurance')}</p>`,
    '<p>© 2026 Copyright Intact Insurance Company. All Rights Reserved.</p>',
  ),
].join('')));

used.forEach((rel) => fs.copyFileSync(path.join(DAM, rel), path.join(MEDIA, path.basename(rel))));

const sheet = (data) => ({
  total: data.length, limit: data.length, offset: 0, data, ':type': 'sheet',
});
fs.writeFileSync(path.join(OUT, 'metadata.json'), JSON.stringify(sheet([{ URL: '/**', nav: '/nav', footer: '/footer' }])));
fs.writeFileSync(path.join(OUT, 'redirects.json'), JSON.stringify(sheet([
  { Source: '/', Destination: '/en/personal-insurance' },
  { Source: '/en', Destination: '/en/personal-insurance' },
  { Source: '/en/', Destination: '/en/personal-insurance' },
  { Source: '/index', Destination: '/en/personal-insurance' },
])));
console.log(`docs 3, sheets 2, media ${used.size} -> ${OUT}`);
