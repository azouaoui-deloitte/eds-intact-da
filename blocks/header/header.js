import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import initHeader from './header-behavior.js';

const CHEVRON = '<svg class="nav-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.6663 6.3455C12.6663 6.54661 12.5849 6.7469 12.4246 6.89313L8.49871 10.4727C8.21597 10.7305 7.78338 10.7305 7.50064 10.4727L3.57471 6.89313C3.27241 6.6175 3.25071 6.1489 3.52634 5.84668C3.80204 5.54439 4.27049 5.52276 4.57279 5.79831L7.99967 8.9229L11.4266 5.79831C11.7289 5.52276 12.1973 5.54439 12.473 5.84668C12.6025 5.98868 12.6663 6.16742 12.6663 6.3455Z"/></svg>';
const SEARCH = '<svg class="nav-icon-search" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.6999 13.7029C12.5791 14.8252 11.0864 15.4425 9.49986 15.4425C7.91333 15.4425 6.42215 14.8252 5.29986 13.7029C4.17913 12.5821 3.56015 11.0893 3.56015 9.50278C3.56015 7.91626 4.17913 6.42508 5.29986 5.30294C6.42215 4.18222 7.91333 3.56308 9.49986 3.56308C10.2939 3.56308 11.0629 3.71782 11.7741 4.0134C12.4853 4.30726 13.1387 4.7418 13.6999 5.30294C14.8221 6.42508 15.4396 7.91626 15.4396 9.50278C15.4396 11.0893 14.8221 12.5821 13.6999 13.7029ZM21.7685 20.6663L15.3301 14.228C16.4134 12.8964 17.0026 11.2442 17.0026 9.50278C17.0026 8.50085 16.8073 7.52877 16.4352 6.63C16.0632 5.73279 15.5146 4.90733 14.8049 4.19769C13.3888 2.78154 11.5037 2 9.49986 2C7.49599 2 5.61247 2.78154 4.19476 4.19769C2.77861 5.61556 1.99707 7.49907 1.99707 9.50278C1.99707 11.5067 2.77861 13.3919 4.19476 14.8079C5.61247 16.2257 7.49599 17.0056 9.49986 17.0056C11.2411 17.0056 12.8933 16.4163 14.225 15.3332L20.6634 21.7714C20.8166 21.9247 21.0166 22.0013 21.2167 22.0013C21.4168 22.0013 21.6169 21.9247 21.7685 21.7714C22.0733 21.4668 22.0733 20.9713 21.7685 20.6663Z"/></svg>';
const BURGER = '<svg class="nav-icon-burger" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 5a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2H4Z"/></svg>';
const CLOSE = '<svg class="nav-icon-close" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"/></svg>';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const text = (el) => el?.textContent.trim() || '';
const href = (a) => esc(a?.getAttribute('href'));
const attr = (name, value) => (value ? ` ${name}="${esc(value)}"` : '');

/** language switch link (text "FR" to a /fr/ page): lang / hreflang of the target page */
function langAttrs(a) {
  const code = text(a).toLowerCase();
  return /^[a-z]{2}$/.test(code) && (a.getAttribute('href') || '').includes(`/${code}/`)
    ? `${attr('lang', code)}${attr('hreflang', code)}` : '';
}

/** utility item: a link, or a button for `#` links (province selector) */
function utilityItem(a) {
  if (!a) return '';
  const title = attr('title', a.title);
  if ((a.getAttribute('href') || '').startsWith('#')) {
    return `<li><button type="button" class="nav-utility-link"${title}><span>${esc(text(a))}</span>${CHEVRON}</button></li>`;
  }
  return `<li><a class="nav-utility-link" href="${href(a)}"${title}${langAttrs(a)}><span>${esc(text(a))}</span></a></li>`;
}

const navLinks = (links) => links.map((a) => `<li><a class="nav-link" href="${href(a)}">${esc(text(a))}</a></li>`).join('');

function searchForm(search, id) {
  return `<form class="nav-search-form" role="search" action="${href(search.link)}" method="get"><label class="nav-search-title" for="${id}">${esc(search.label)}</label><div class="nav-search-field"><input type="search" id="${id}" name="q" placeholder="${esc(search.placeholder)}" required/><button type="submit" class="nav-search-submit">${esc(text(search.link) || 'Search')}</button></div></form>`;
}

/**
 * Nav document (`/nav`), one section per area:
 *  1. top bar: list of Intact sites (current one in bold), list of utility links
 *     (`#` link = province selector button, link title = tooltip)
 *  2. main bar: logo link (`:intact-logo:`), list of main links, login link, bold CTA link
 *  3. search: label, placeholder, link to the search page (form action, submit label)
 * @param {Element} fragment decorated nav fragment
 */
function parseNav(fragment) {
  const [topbar, mainbar, search] = [...fragment.querySelectorAll(':scope > .section')];
  const [segments, utility] = topbar ? [...topbar.querySelectorAll('ul')] : [];
  const mainLinks = [...(mainbar?.querySelectorAll('ul a[href]') || [])];
  const others = [...(mainbar?.querySelectorAll('a[href]') || [])].filter((a) => !a.closest('ul'));
  const logo = others.find((a) => a.querySelector('.icon, img'));
  const cta = others.find((a) => a !== logo && a.classList.contains('button'));
  const login = others.find((a) => a !== logo && a !== cta);
  const searchTexts = [...(search?.querySelectorAll('p') || [])].filter((p) => !p.querySelector('a'));
  return {
    segments: [...(segments?.querySelectorAll('a[href]') || [])].map((a) => ({ a, current: !!a.closest('strong') })),
    utility: [...(utility?.querySelectorAll('a[href]') || [])],
    logo,
    mainLinks,
    login,
    cta,
    search: {
      link: search?.querySelector('a[href]'),
      label: text(searchTexts[0]),
      placeholder: text(searchTexts[1]),
    },
  };
}

/** same DOM as the AEM header component (intact/components/header) of the header XF */
function buildNav(nav) {
  const logoName = [...(nav.logo?.querySelector('.icon')?.classList || [])].find((c) => c.startsWith('icon-'))?.substring(5) || 'intact-logo';
  const segments = nav.segments.map(({ a, current }) => `<li><a class="i-lineselector" href="${href(a)}"${current ? ' aria-current="true"' : ''}>${esc(text(a))}</a></li>`).join('');
  const utility = nav.utility.map(utilityItem).join('');
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.innerHTML = `<nav id="nav" class="i-nav" aria-label="Main">
    <div class="nav-topbar"><div class="nav-container">
      <ul class="nav-segments" aria-label="Intact sites">${segments}</ul>
      <ul class="nav-utility">${utility}</ul>
    </div></div>
    <div class="nav-mainbar"><div class="nav-container">
      <div class="nav-left">
        <a class="nav-logo" href="${href(nav.logo) || '/'}" aria-label="${esc(nav.logo?.title || 'Intact Insurance')}"><img src="${window.hlx.codeBasePath}/icons/${logoName}.svg" alt="" width="92" height="40"/></a>
        <ul class="nav-links">${navLinks(nav.mainLinks)}</ul>
      </div>
      <div class="nav-actions">
        <div class="nav-tools">
          ${nav.login ? `<a class="nav-link nav-login" href="${href(nav.login)}">${esc(text(nav.login))}</a>` : ''}
          ${nav.search.link ? `<button type="button" class="nav-search-toggle" aria-expanded="false" aria-controls="nav-search" aria-label="${esc(text(nav.search.link) || 'Search')}">${SEARCH}${CLOSE}</button>` : ''}
        </div>
        ${nav.cta ? `<a class="nav-cta" href="${href(nav.cta)}">${esc(text(nav.cta))}</a>` : ''}
        <button type="button" class="nav-hamburger" aria-expanded="false" aria-controls="nav-drawer" aria-label="Menu" data-label-open="Menu" data-label-close="Close menu">${BURGER}${CLOSE}</button>
      </div>
    </div></div>
    ${nav.search.link ? `<div class="nav-search" id="nav-search" hidden><div class="nav-container">${searchForm(nav.search, 'nav-search-input')}</div></div>` : ''}
    <div class="nav-drawer" id="nav-drawer" hidden>
      <ul class="nav-drawer-links">${navLinks(nav.mainLinks)}</ul>
      <ul class="nav-drawer-secondary">${nav.login ? navLinks([nav.login]) : ''}${utility}</ul>
      ${nav.search.link ? searchForm(nav.search, 'nav-drawer-search-input') : ''}
    </div>
  </nav>`;
  return wrapper;
}

/**
 * Intact header (Figma i-nav) built from the nav document set in the `nav` metadata.
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  block.textContent = '';
  if (!fragment) return;
  const wrapper = buildNav(parseNav(fragment));
  block.append(wrapper);
  initHeader(wrapper.querySelector('nav#nav'));
}
