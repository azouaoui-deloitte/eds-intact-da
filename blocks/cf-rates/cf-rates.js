import { getMetadata, toClassName } from '../../scripts/aem.js';

/*
 * Mortgage rates read from an AEM Content Fragment through the persisted GraphQL query
 * intact/mortgage-rates, on every page load (no cache), see docs/demo/cf-rates.md.
 * On the AEM render the query is same-origin; elsewhere (da.live) it targets the AEM endpoint of
 * the block config / "aem-endpoint" page metadata (default: the local AEM proxy), and falls back
 * to a static sheet when AEM is not reachable.
 */
const FIELDS = ['reference', 'variation'];
const ALIASES = {
  'content-fragment': 'reference',
  fragment: 'reference',
  'aem-endpoint': 'endpoint',
  'fallback-sheet': 'fallback',
};
const QUERY = 'intact/mortgage-rates';
const DEFAULT_ENDPOINT = 'https://localhost:8444';
const TIMEOUT = 8000;
const PRODUCTS = [
  { key: 'fixed1', term: '1-year', type: 'Fixed' },
  { key: 'fixed3', term: '3-year', type: 'Fixed' },
  { key: 'fixed5', term: '5-year', type: 'Fixed' },
  { key: 'variable5', term: '5-year', type: 'Variable' },
];

/**
 * Block config: xwalk renders one row per model field (in model order), da.live a two-column
 * key / value table. Links (aem-content fields, sheet links) resolve to their path.
 * @param {Element} block
 * @returns {Object<string, string>}
 */
function readConfig(block) {
  const rows = [...block.children];
  const keyValue = rows.length > 0 && rows.every((row) => row.children.length >= 2);
  return rows.reduce((config, row, i) => {
    const cells = [...row.children];
    const name = keyValue ? toClassName(cells[0].textContent) : FIELDS[i];
    const cell = keyValue ? cells[1] : cells[0];
    if (!name || !cell) return config;
    const link = cell.querySelector('a[href]');
    let value = cell.textContent.trim();
    if (link) {
      const url = new URL(link.getAttribute('href'), window.location.href);
      value = url.origin === window.location.origin ? url.pathname : url.href;
    }
    config[ALIASES[name] || name] = value;
    return config;
  }, {});
}

const isAemRender = () => window.location.pathname.startsWith('/content/');
const inUniversalEditor = () => !!document.querySelector('meta[name="urn:adobe:aue:system:aemconnection"]');

function endpointBase(config) {
  if (isAemRender()) return '';
  return (config.endpoint || getMetadata('aem-endpoint') || DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

const toNumber = (value) => {
  const n = Number.parseFloat(String(value ?? '').replace(/[,%]/g, ''));
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** persisted query variables: AEM does not decode %2F in the ;name=value matrix parameters */
const queryVar = (value) => encodeURIComponent(value).replace(/%2F/gi, '/');

async function fromAem(base, path, variation) {
  const url = `${base}/graphql/execute.json/${QUERY};path=${queryVar(path)};variation=${queryVar(variation)}?ts=${Date.now()}`;
  const json = await fetchJson(url);
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const item = json?.data?.mortgageRatesByPath?.item;
  if (!item) throw new Error(`no content fragment at ${path}`);
  return { ...item, disclaimer: item.disclaimer?.plaintext || '' };
}

async function fromSheet(url) {
  const sheet = new URL(url, window.location.href);
  sheet.searchParams.set('ts', Date.now());
  const json = await fetchJson(sheet.href);
  const [row] = json?.data || [];
  if (!row) throw new Error(`empty sheet ${url}`);
  return row;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

const formatRate = (value) => (value === null ? '–' : `${value.toFixed(2)}%`);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCards(list, data) {
  list.replaceChildren(...PRODUCTS.map(({ key, term, type }) => {
    const li = el('li', `cf-rates-card ${type.toLowerCase()}`);
    const rate = toNumber(data?.[`${key}Rate`]);
    const apr = toNumber(data?.[`${key}Apr`]);
    const label = el('p', 'cf-rates-term');
    label.append(el('span', 'cf-rates-term-length', term), el('span', 'cf-rates-term-type', type));
    const value = el('p', 'cf-rates-rate', data ? formatRate(rate) : '');
    value.dataset.field = `${key}Rate`;
    const aprLine = el('p', 'cf-rates-apr', data ? `APR ${formatRate(apr)}` : '');
    aprLine.dataset.field = `${key}Apr`;
    li.append(label, value, aprLine);
    return li;
  }));
}

/** Universal Editor: the rendered values point to the content fragment (in-context CF editing) */
function instrument(content, title, disclaimer, path, variation) {
  content.dataset.aueResource = `urn:aemconnection:${path}/jcr:content/data/${variation}`;
  content.dataset.aueType = 'reference';
  content.dataset.aueFilter = 'cf';
  content.dataset.aueLabel = 'Mortgage rates (Content Fragment)';
  title.dataset.aueProp = 'title';
  title.dataset.aueType = 'text';
  title.dataset.aueLabel = 'Title';
  disclaimer.dataset.aueProp = 'disclaimer';
  disclaimer.dataset.aueType = 'text';
  disclaimer.dataset.aueLabel = 'Disclaimer';
}

export default function decorate(block) {
  const config = readConfig(block);
  const path = (config.reference || '/content/dam/intact/demo/mortgage-rates').replace(/\.html$/, '');
  const variation = config.variation || 'master';
  const base = endpointBase(config);

  const content = el('div', 'cf-rates-content');
  const header = el('div', 'cf-rates-header');
  const tag = el('p', 'cf-rates-tag', 'Demo');
  const title = el('h2', 'cf-rates-title');
  const date = el('p', 'cf-rates-date');
  header.append(tag, title, date);
  const list = el('ul', 'cf-rates-list');
  const disclaimer = el('p', 'cf-rates-disclaimer');
  content.append(header, list, disclaimer);

  const status = el('div', 'cf-rates-status');
  status.setAttribute('aria-live', 'polite');
  const statusText = el('p', 'cf-rates-status-text');
  const retry = el('button', 'button secondary', 'Retry');
  retry.type = 'button';
  status.append(statusText, retry);

  block.replaceChildren(content, status);
  renderCards(list, null);

  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    block.classList.add('is-loading');
    block.classList.remove('is-live', 'is-fallback', 'is-error');
    content.setAttribute('aria-busy', 'true');
    retry.disabled = true;
    statusText.textContent = 'Loading rates from the content fragment…';
    const where = base || window.location.origin;
    let data;
    let mode = 'live';
    let reason = '';
    let unreachable = false;
    try {
      data = await fromAem(base, path, variation);
    } catch (e) {
      unreachable = e.name === 'AbortError' || e instanceof TypeError;
      reason = e.name === 'AbortError' ? 'timeout' : e.message;
      // eslint-disable-next-line no-console
      console.warn(`cf-rates: AEM ${where} unreachable (${reason})`);
      mode = 'error';
      if (config.fallback) {
        try {
          data = await fromSheet(config.fallback);
          mode = 'fallback';
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('cf-rates: fallback sheet unavailable', err);
        }
      }
    }

    block.classList.remove('is-loading');
    block.classList.add(`is-${mode}`);
    content.removeAttribute('aria-busy');
    loading = false;
    retry.disabled = false;
    retry.textContent = mode === 'live' ? 'Reload' : 'Retry';
    if (!data) {
      title.textContent = 'Rates unavailable';
      date.textContent = '';
      disclaimer.textContent = '';
      renderCards(list, {});
      statusText.textContent = unreachable
        ? `AEM (${where}) is not reachable from this browser (${reason}).`
        : `AEM (${where}) returned no rates: ${reason}`;
      return;
    }
    title.textContent = data.title || 'Mortgage rates';
    date.textContent = data.effectiveDate ? `Effective ${formatDate(data.effectiveDate)}` : '';
    disclaimer.textContent = data.disclaimer || '';
    renderCards(list, data);
    const time = new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' }).format(new Date());
    if (mode === 'live') {
      tag.textContent = 'Demo · Live from AEM';
      statusText.textContent = `Content Fragment ${path} (${variation}) via ${where}/graphql/execute.json/${QUERY}, loaded ${time}.`;
      if (inUniversalEditor()) instrument(content, title, disclaimer, path, variation);
    } else {
      tag.textContent = 'Demo · Fallback';
      const cause = unreachable ? `is not reachable from this browser (${reason})` : `returned no rates (${reason})`;
      statusText.textContent = `Fallback data (static sheet): AEM (${where}) ${cause}. Only the machine running the local AEM shows the live Content Fragment.`;
    }
  }

  retry.addEventListener('click', load);
  load();
}
