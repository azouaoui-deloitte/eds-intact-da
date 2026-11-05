import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import initHeader from './header-behavior.js';
import {
  CHEVRON, SEARCH, CLOSE, BURGER, CARD_ARROW, SUGGESTION, BACK, NEXT,
} from './header-icons.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const text = (el) => el?.textContent.trim() || '';
const href = (a) => esc(a?.getAttribute('href'));
const attr = (name, value) => (value ? ` ${name}="${esc(value)}"` : '');
const cls = (...names) => {
  const value = names.filter(Boolean).join(' ');
  return value ? ` class="${value}"` : '';
};

/** language switch link (text "FR" to a /fr/ page): lang / hreflang of the target page */
function langAttrs(a) {
  const code = text(a).toLowerCase();
  return /^[a-z]{2}$/.test(code) && (a.getAttribute('href') || '').includes(`/${code}/`)
    ? `${attr('lang', code)}${attr('hreflang', code)}` : '';
}

/** list item link: italic = overflow item (moved to the menu when the bar is too narrow) */
const item = (a) => ({ a, overflow: !!a.closest('em') });

/** utility item: a link, or a dropdown button for `#` links (province selector) */
function utilityItem({ a, overflow }) {
  const title = attr('title', a.title);
  const control = (a.getAttribute('href') || '').startsWith('#')
    ? `<button type="button" class="nav-utility-link"${title}><span>${esc(text(a))}</span>${CHEVRON}</button>`
    : `<a class="nav-utility-link" href="${href(a)}"${title}${langAttrs(a)}><span>${esc(text(a))}</span></a>`;
  return `<li${cls(overflow && 'is-overflow')}>${control}</li>`;
}

function searchForm(search, id) {
  return `<form class="nav-search-form" role="search" action="${href(search.link)}" method="get"><label class="nav-visually-hidden" for="${id}">${esc(search.label)}</label><input type="search" id="${id}" name="q" placeholder="${esc(search.placeholder)}" required/><button type="submit" class="nav-search-submit" aria-label="${esc(text(search.link) || 'Search')}">${SEARCH}</button></form>`;
}

function card(menu) {
  const c = menu?.card;
  if (!c?.title) return '';
  const img = c.image ? `<img class="nav-menu-card-image" src="${esc(c.image.src)}" alt="${esc(c.image.alt)}" loading="lazy" width="324" height="443"/>` : '';
  const tag = c.tag ? `<span class="nav-menu-card-tag">${esc(c.tag)}</span>` : '';
  const copy = `<span class="nav-menu-card-title">${esc(c.title)}</span>${c.text ? `<span class="nav-menu-card-text">${esc(c.text)}</span>` : ''}`;
  return `<a class="nav-menu-card" href="${esc(c.href)}"><span class="nav-menu-card-media">${img}${tag}</span><span class="nav-menu-card-lockup"><span class="nav-menu-card-copy">${copy}</span>${CARD_ARROW}</span></a>`;
}

/**
 * Menu section: heading linking to its main link (text = short title of the mobile lvl 2),
 * columns (heading + list) and an optional featured card (image, tag, heading link, text).
 */
function parseMenu(section) {
  const wrapper = section.querySelector('.default-content-wrapper') || section;
  const [head, ...rest] = [...wrapper.children];
  const menu = {
    href: head?.querySelector('a')?.getAttribute('href'), title: text(head), columns: [], card: null,
  };
  rest.forEach((el) => {
    const picture = el.querySelector('picture');
    if (picture || menu.card) {
      menu.card ||= {};
      const img = picture?.querySelector('img');
      if (img) menu.card.image = { src: img.getAttribute('src'), alt: img.getAttribute('alt') || '' };
      else if (/^H\d$/.test(el.tagName)) {
        menu.card.title = text(el);
        menu.card.href = el.querySelector('a')?.getAttribute('href');
      } else if (el.tagName === 'P') {
        if (menu.card.title) menu.card.text = text(el);
        else menu.card.tag = text(el);
      }
    } else if (/^H\d$/.test(el.tagName)) {
      menu.columns.push({ label: text(el), links: [] });
    } else if (el.tagName === 'UL' && menu.columns.length) {
      menu.columns[menu.columns.length - 1].links = [...el.querySelectorAll('a[href]')];
    }
  });
  return menu;
}

/**
 * Nav document (`/nav`), one section per area:
 *  1. top bar: list of Intact sites (current one in bold), list of utility links
 *     (`#` link = province dropdown button, link title = tooltip, italic = overflow item)
 *  2. main bar: logo link (`:intact-logo:`), list of main links (italic = overflow item), login
 *     link, bold CTA link
 *  3. search: label, placeholder, link to the search page (form action, button label),
 *     heading + list of top suggestions
 *  4+. menus, one per main link with a mega menu: see parseMenu
 * @param {Element} fragment decorated nav fragment
 */
function parseNav(fragment) {
  const [topbar, mainbar, search, ...menus] = [...fragment.querySelectorAll(':scope > .section')];
  const [segments, utilityList] = topbar ? [...topbar.querySelectorAll('ul')] : [];
  const others = [...(mainbar?.querySelectorAll('a[href]') || [])].filter((a) => !a.closest('ul'));
  const logo = others.find((a) => a.querySelector('.icon, img'));
  const cta = others.find((a) => a !== logo && a.classList.contains('button'));
  const login = others.find((a) => a !== logo && a !== cta);
  const searchTexts = [...(search?.querySelectorAll('p') || [])].filter((p) => !p.querySelector('a'));
  const parsedMenus = menus.map(parseMenu);
  const links = [...(mainbar?.querySelectorAll('ul a[href]') || [])].map((a) => ({
    ...item(a),
    menu: parsedMenus.find((m) => m.href && m.href === a.getAttribute('href')),
  }));
  return {
    segments: [...(segments?.querySelectorAll('a[href]') || [])].map((a) => ({ a, current: !!a.closest('strong') })),
    utility: [...(utilityList?.querySelectorAll('a[href]') || [])].map(item),
    logo,
    links,
    login,
    cta,
    search: {
      link: search?.querySelector('p a[href]'),
      label: text(searchTexts[0]),
      placeholder: text(searchTexts[1]),
      suggestionsTitle: text(search?.querySelector('h1, h2, h3, h4')),
      suggestions: [...(search?.querySelectorAll('ul a[href]') || [])],
    },
  };
}

/** same DOM as the AEM header component (intact/components/header) of the header XF */
function buildNav(nav) {
  const logoName = [...(nav.logo?.querySelector('.icon')?.classList || [])].find((c) => c.startsWith('icon-'))?.substring(5) || 'intact-logo';
  const current = nav.segments.find((s) => s.current);
  const segments = (linkClass) => nav.segments.map(({ a, current: active }) => `<li><a${cls(linkClass)} href="${href(a)}"${active ? ' aria-current="true"' : ''}>${esc(text(a))}</a></li>`).join('');
  const utility = nav.utility.map(utilityItem).join('');
  const mainLinks = nav.links.map(({ a, overflow, menu }, i) => `<li${cls(overflow && 'is-overflow')}>${menu
    ? `<button type="button" class="nav-link nav-menu-toggle" aria-expanded="false" aria-controls="nav-menu-${i}">${esc(text(a))}</button>`
    : `<a class="nav-link" href="${href(a)}">${esc(text(a))}</a>`}</li>`).join('');
  const columns = (menu, prefix, linkClass) => menu.columns.map((c) => `<div class="${prefix}-column"><p class="nav-menu-label">${esc(c.label)}</p><ul class="${prefix === 'nav-menu' ? 'nav-menu-links' : 'nav-drawer-sublinks'}">${c.links.map((a) => `<li><a class="${linkClass}" href="${href(a)}">${esc(text(a))}</a></li>`).join('')}</ul></div>`).join('');
  const menus = nav.links.map(({ menu }, i) => (menu ? `<div class="nav-menu" id="nav-menu-${i}" hidden><div class="nav-container">${columns(menu, 'nav-menu', 'nav-menu-link')}${card(menu)}</div></div>` : '')).join('');
  const subs = nav.links.map(({ menu }, i) => (menu ? `<div class="nav-drawer-sub" id="nav-sub-${i}" hidden><div class="nav-drawer-columns">${columns(menu, 'nav-drawer', 'nav-drawer-sublink')}</div>${card(menu)}</div>` : '')).join('');
  const drawerLinks = nav.links.map(({ a, overflow, menu }, i) => `<li${cls('nav-drawer-item', overflow && 'is-overflow')}><a class="nav-drawer-link" href="${href(a)}">${esc(text(a))}</a>${menu
    ? `<button type="button" class="nav-drawer-next" aria-expanded="false" aria-controls="nav-sub-${i}" aria-label="${esc(text(a))}" data-label="${esc(menu.title)}">${NEXT}</button>` : ''}</li>`).join('');
  const { search } = nav;
  const suggestions = search.suggestions.length ? `<div class="nav-search-suggestions">${search.suggestionsTitle ? `<p class="nav-menu-label">${esc(search.suggestionsTitle)}</p>` : ''}<ul>${search.suggestions.map((a) => `<li><a class="nav-search-suggestion" href="${href(a)}">${SUGGESTION}${esc(text(a))}</a></li>`).join('')}</ul></div>` : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.innerHTML = `<nav id="nav" class="i-nav" aria-label="Main">
    <div class="nav-topbar"><div class="nav-container">
      <ul class="nav-segments" aria-label="Intact sites">${segments('i-lineselector')}</ul>
      <ul class="nav-utility">${utility}</ul>
    </div></div>
    <div class="nav-mainbar"><div class="nav-container">
      <div class="nav-left">
        <a class="nav-logo" href="${href(nav.logo) || '/'}" aria-label="${esc(nav.logo?.title || 'Intact Insurance')}"><img src="${window.hlx.codeBasePath}/icons/${logoName}.svg" alt="" width="92" height="40"/></a>
        <ul class="nav-links">${mainLinks}</ul>
      </div>
      <div class="nav-actions">
        <div class="nav-tools">
          ${nav.login ? `<a class="nav-link nav-login" href="${href(nav.login)}">${esc(text(nav.login))}</a>` : ''}
          ${search.link ? `<button type="button" class="nav-search-toggle" aria-expanded="false" aria-controls="nav-search" aria-label="${esc(text(search.link) || 'Search')}">${SEARCH}${CLOSE}</button>` : ''}
        </div>
        ${nav.cta ? `<a class="nav-cta" href="${href(nav.cta)}">${esc(text(nav.cta))}</a>` : ''}
        <button type="button" class="nav-hamburger" aria-expanded="false" aria-controls="nav-drawer" aria-label="Menu" data-label-open="Menu" data-label-close="Close menu">${BURGER}${CLOSE}</button>
      </div>
    </div></div>
    ${menus}
    ${search.link ? `<div class="nav-search" id="nav-search" hidden><div class="nav-container">${searchForm(search, 'nav-search-input')}${suggestions}</div></div>` : ''}
    <div class="nav-drawer" id="nav-drawer" hidden>
      <div class="nav-drawer-bar">
        ${nav.segments.length ? `<div class="nav-drawer-segments"><button type="button" class="nav-drawer-segment-toggle" aria-expanded="false" aria-controls="nav-drawer-segment-list">${current ? `<span>${esc(text(current.a))}</span>` : ''}${CHEVRON}</button><ul class="nav-drawer-segment-list" id="nav-drawer-segment-list" aria-label="Intact sites" hidden>${segments()}</ul></div>` : ''}
        <button type="button" class="nav-drawer-back" hidden aria-label="Back to main menu">${BACK}<span class="nav-drawer-back-label"></span></button>
        <button type="button" class="nav-drawer-close" aria-label="Close menu">${CLOSE}</button>
      </div>
      <div class="nav-drawer-body">
        <div class="nav-drawer-main">
          <ul class="nav-drawer-links">${drawerLinks}</ul>
          <div class="nav-drawer-bottom">
            <ul class="nav-drawer-secondary">${nav.login ? `<li class="is-overflow"><a class="nav-utility-link" href="${href(nav.login)}"><span>${esc(text(nav.login))}</span></a></li>` : ''}${utility}</ul>
            ${search.link ? searchForm(search, 'nav-drawer-search-input') : ''}
          </div>
        </div>
        ${subs}
      </div>
      ${nav.cta ? `<div class="nav-drawer-footer"><a class="nav-drawer-cta" href="${href(nav.cta)}">${esc(text(nav.cta))}</a></div>` : ''}
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
