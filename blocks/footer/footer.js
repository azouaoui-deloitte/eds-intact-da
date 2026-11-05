import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import initFooter from './footer-behavior.js';

const CHEVRON = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M19 9.51922C19 9.82089 18.8779 10.1213 18.6374 10.3407L12.7486 15.71C12.3244 16.0967 11.6756 16.0967 11.2514 15.71L5.36256 10.3407C4.90911 9.92722 4.87656 9.22433 5.29 8.771C5.70356 8.31756 6.40622 8.28511 6.85967 8.69845L12 13.3853L17.1403 8.69845C17.5938 8.28511 18.2964 8.31756 18.71 8.771C18.9042 8.984 19 9.25211 19 9.51922Z"/></svg>';
const CHEVRON_SMALL = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5642 6.80721C11.5642 6.95583 11.504 7.10384 11.3856 7.2119L8.48436 9.85713C8.27542 10.0476 7.95574 10.0476 7.7468 9.85713L4.84561 7.2119C4.62222 7.00821 4.60618 6.66193 4.80986 6.43859C5.0136 6.2152 5.35978 6.19922 5.58317 6.40285L8.11558 8.71187L10.648 6.40285C10.8714 6.19922 11.2176 6.2152 11.4213 6.43859C11.517 6.54353 11.5642 6.67561 11.5642 6.80721Z"/></svg>';
const ICON_SIZES = { social: [24, 24], badge: [135, 40], 'intact-logo': [92, 40] };

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const text = (el) => el?.textContent.trim() || '';
const href = (a) => esc(a?.getAttribute('href'));
const attr = (name, value) => (value ? ` ${name}="${esc(value)}"` : '');
const iconName = (el) => [...(el?.querySelector('.icon')?.classList || [])]
  .find((c) => c.startsWith('icon-'))?.substring(5);

function iconImg(name) {
  const size = Object.keys(ICON_SIZES).find((k) => name.startsWith(k));
  const [width, height] = ICON_SIZES[size] || [24, 24];
  return `<img src="${window.hlx.codeBasePath}/icons/${name}.svg" alt="" width="${width}" height="${height}" loading="lazy"/>`;
}

/** link list: text links (`footer-list`) or icon links (social / app badges, title = label) */
function list(ul) {
  const links = [...ul.querySelectorAll('a[href]')];
  const icons = links.map(iconName);
  if (icons.some(Boolean)) {
    const type = icons.every((n) => n?.startsWith('social')) ? 'social' : 'apps';
    const items = links.map((a, i) => `<li><a href="${href(a)}" aria-label="${esc(a.title || icons[i])}" target="_blank" rel="noopener noreferrer">${iconImg(icons[i] || '')}</a></li>`).join('');
    return { type, html: `<ul class="footer-${type}-list">${items}</ul>` };
  }
  return { type: 'list', html: `<ul class="footer-list">${links.map((a) => `<li><a class="footer-link" href="${href(a)}">${esc(text(a))}</a></li>`).join('')}</ul>` };
}

/** heading + list pairs of a section */
const groups = (section) => [...(section?.querySelectorAll('h2, h3, h4') || [])].map((h) => {
  let ul = h.nextElementSibling;
  while (ul && ul.tagName !== 'UL' && !/^H\d$/.test(ul.tagName)) ul = ul.nextElementSibling;
  return { label: text(h), ...(ul?.tagName === 'UL' ? list(ul) : { type: 'list', html: '' }) };
});

const langAttrs = (a) => {
  const code = text(a).toLowerCase();
  return /^[a-z]{2}$/.test(code) && (a.getAttribute('href') || '').includes(`/${code}/`)
    ? `${attr('lang', code)}${attr('hreflang', code)}` : '';
};

/** selector item: a link, or a button for `#` links (province selector) */
function selector(a) {
  const title = attr('title', a.title);
  if ((a.getAttribute('href') || '').startsWith('#')) {
    return `<li><button type="button" class="footer-selector"${title}><span>${esc(text(a))}</span>${CHEVRON}</button></li>`;
  }
  return `<li><a class="footer-selector" href="${href(a)}"${title}${langAttrs(a)}><span>${esc(text(a))}</span>${CHEVRON}</a></li>`;
}

/** legal item: a link, or the legal notes toggle for the `#footer-notes` link */
function legal(a) {
  if ((a.getAttribute('href') || '').startsWith('#')) {
    return `<li><button type="button" class="footer-legal-link footer-notes-toggle" aria-expanded="false" aria-controls="footer-notes">${esc(text(a))}${CHEVRON_SMALL}</button></li>`;
  }
  return `<li><a class="footer-legal-link" href="${href(a)}">${esc(text(a))}</a></li>`;
}

/**
 * Footer document (`/footer`), one section per area:
 *  1. link columns: heading + list, per column
 *  2. aside: heading + list groups (portal links, social icon links, app badge icon links)
 *  3. bottom: list of selectors (`#` link = province button), list of legal links
 *     (`#footer-notes` link = legal notes toggle), legal notes paragraphs
 *  4. meta: "also of interest" label + list, logo link (`:intact-logo-fr-white:`), copyright
 * @param {Element} fragment decorated footer fragment
 * @returns {Element} same DOM as the AEM footer component of the footer XF
 */
function buildFooter(fragment) {
  const [columnsSection, asideSection, bottom, meta] = [...fragment.querySelectorAll(':scope > .section')];
  const columns = groups(columnsSection).map((g) => `<div class="footer-column"><h2 class="footer-label">${esc(g.label)}</h2>${g.html}</div>`).join('');
  const aside = groups(asideSection).map((g) => {
    const cls = g.type === 'list' ? '' : ` footer-${g.type}`;
    return `<div class="footer-group${cls}"><h2 class="footer-label">${esc(g.label)}</h2>${g.html}</div>`;
  }).join('');
  const [selectors, legals] = bottom ? [...bottom.querySelectorAll('ul')] : [];
  const notes = bottom ? [...bottom.querySelectorAll('.default-content-wrapper > p')] : [];
  const metaWrapper = meta?.querySelector('.default-content-wrapper') || meta;
  const related = metaWrapper?.querySelector('ul');
  const metaParagraphs = [...(metaWrapper?.querySelectorAll(':scope > p') || [])];
  const logo = metaParagraphs.map((p) => p.querySelector('a[href]')).find((a) => a && iconName(a));
  const [relatedLabel, copyright] = metaParagraphs.filter((p) => !p.querySelector('a[href]'));

  const inner = document.createElement('div');
  inner.className = 'footer-inner i-footer';
  inner.dataset.variant = 'scrolled-red';
  inner.innerHTML = `<div class="footer-main"><div class="footer-card">
      <div class="footer-columns">${columns}${aside ? `<div class="footer-column footer-aside">${aside}</div>` : ''}</div>
      <div class="footer-bottom">
        <div class="footer-actions">
          <ul class="footer-selectors">${[...(selectors?.querySelectorAll('a[href]') || [])].map(selector).join('')}</ul>
          <ul class="footer-legal">${[...(legals?.querySelectorAll('a[href]') || [])].map(legal).join('')}</ul>
        </div>
        <div class="footer-notes" id="footer-notes" hidden></div>
      </div>
    </div></div>
    <div class="footer-meta">
      <div class="footer-related">
        <p class="footer-related-label">${esc(text(relatedLabel))}</p>
        <ul class="footer-related-list" role="list">${[...(related?.querySelectorAll('a[href]') || [])].map((a) => `<li><a href="${href(a)}">${esc(text(a))}</a></li>`).join('')}</ul>
      </div>
      <div class="footer-copyright">
        ${logo ? `<a class="footer-logo" href="${href(logo)}" aria-label="${esc(logo.title || 'Intact Insurance')}">${iconImg(iconName(logo))}</a>` : ''}
        <p class="footer-copyright-text">${esc(text(copyright))}</p>
      </div>
    </div>`;
  const notesPanel = inner.querySelector('#footer-notes');
  notes.forEach((p) => {
    p.removeAttribute('class');
    notesPanel.append(p);
  });
  return inner;
}

/**
 * Intact footer (Figma i-footer) built from the footer document set in the `footer` metadata.
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);
  block.textContent = '';
  if (!fragment) return;
  const inner = buildFooter(fragment);
  block.append(inner);
  initFooter(inner);
}
