import { toClassName } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Stock quote, fetched in the browser on every page load (see docs/demo/stock-quote.md).
 * Keyless sources that answer CORS for any origin: CNBC quote service (real time, market state,
 * extended hours), then the TradingView scanner (15 min delayed) when CNBC fails.
 * Neither is an official public API: demo use only.
 */
const FIELDS = ['ticker', 'title', 'note'];
const TIMEOUT = 8000;
const TIME_ZONE = 'America/New_York';
const MARKET_STATES = {
  REG_MKT: 'Market open',
  PRE_MKT: 'Pre-market',
  POST_MKT: 'After hours',
  CLOSED: 'Market closed',
};

/**
 * Block config: xwalk renders one row per model field (in model order), da.live a two-column
 * key / value table.
 * @param {Element} block
 * @returns {Object<string, {value: string, cell: Element}>}
 */
function readConfig(block) {
  const rows = [...block.children];
  const keyValue = rows.length > 0 && rows.every((row) => row.children.length >= 2);
  return rows.reduce((config, row, i) => {
    const cells = [...row.children];
    const key = keyValue ? toClassName(cells[0].textContent) : FIELDS[i];
    const cell = keyValue ? cells[1] : cells[0];
    if (key && cell) config[key] = { value: cell.textContent.trim(), cell };
    return config;
  }, {});
}

const toNumber = (value) => {
  const n = Number.parseFloat(String(value ?? '').replace(/[,%$]/g, ''));
  return Number.isFinite(n) ? n : null;
};

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { cache: 'no-store', ...init, signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fromCnbc(symbol) {
  const params = new URLSearchParams({
    symbols: symbol,
    requestMethod: 'itv',
    noform: '1',
    partnerId: '2',
    fund: '1',
    exthrs: '1',
    output: 'json',
    ts: Date.now(),
  });
  const json = await fetchJson(`https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?${params}`);
  const q = json?.FormattedQuoteResult?.FormattedQuote?.[0];
  if (!q || q.code !== 0 || toNumber(q.last) === null) throw new Error(`no CNBC quote for ${symbol}`);
  const ext = q.ExtendedMktQuote;
  return {
    source: 'CNBC',
    realTime: q.realTime === 'true' || q.realTime === true,
    symbol: q.symbol,
    name: q.name,
    exchange: q.exchange,
    currency: q.currencyCode || 'USD',
    price: toNumber(q.last),
    change: toNumber(q.change),
    changePercent: toNumber(q.change_pct),
    time: q.last_time ? new Date(q.last_time) : null,
    marketState: q.curmktstatus,
    extended: ext && toNumber(ext.last) !== null ? {
      type: ext.type,
      price: toNumber(ext.last),
      change: toNumber(ext.change),
      changePercent: toNumber(ext.change_pct),
    } : null,
  };
}

async function fromTradingView(symbol) {
  const body = {
    filter: [{ left: 'name', operation: 'equal', right: symbol }],
    columns: ['name', 'close', 'change', 'change_abs', 'currency', 'exchange', 'description'],
    sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
    range: [0, 1],
  };
  // text/plain keeps it a CORS "simple" request (no preflight)
  const json = await fetchJson('https://scanner.tradingview.com/america/scan', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const row = json?.data?.[0]?.d;
  if (!row || toNumber(row[1]) === null) throw new Error(`no TradingView quote for ${symbol}`);
  const [name, close, changePercent, change, currency, exchange, description] = row;
  return {
    source: 'TradingView',
    realTime: false,
    symbol: name,
    name: description,
    exchange,
    currency: currency || 'USD',
    price: close,
    change,
    changePercent,
    time: new Date(),
    marketState: null,
    extended: null,
  };
}

async function fetchQuote(symbol) {
  try {
    return await fromCnbc(symbol);
  } catch (e) {
    return fromTradingView(symbol);
  }
}

function formatPrice(value, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(value);
}

function formatChange(change, percent) {
  const sign = change > 0 ? '+' : '';
  const abs = change === null ? '' : `${sign}${change.toFixed(2)}`;
  const pct = percent === null ? '' : ` (${sign}${percent.toFixed(2)}%)`;
  return `${abs}${pct}`.trim();
}

const trend = (change) => {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
};

function formatTime(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
  return `${text} ET`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export default function decorate(block) {
  const config = readConfig(block);
  const symbol = (config.ticker?.value || 'TSLA').toUpperCase().replace(/[^A-Z0-9.-]/g, '') || 'TSLA';
  const titleText = config.title?.value || `${symbol} share price`;
  const noteText = config.note?.value || 'Price in US dollars (USD). Demo only, not investment advice.';

  const header = el('div', 'stock-quote-header');
  const tag = el('p', 'stock-quote-tag', symbol);
  const title = el('h2', 'stock-quote-title', titleText);
  if (config.title) moveInstrumentation(config.title.cell.querySelector('[data-aue-prop]') || config.title.cell, title);
  const refresh = el('button', 'button secondary stock-quote-refresh', 'Refresh');
  refresh.type = 'button';
  header.append(tag, title);

  const body = el('div', 'stock-quote-body');
  body.setAttribute('aria-live', 'polite');
  const price = el('p', 'stock-quote-price');
  const change = el('p', 'stock-quote-change');
  const meta = el('p', 'stock-quote-meta');
  const extended = el('p', 'stock-quote-extended');
  const error = el('div', 'stock-quote-error');
  const errorText = el('p', 'stock-quote-error-text', 'Quote unavailable');
  const retry = el('button', 'button secondary', 'Retry');
  retry.type = 'button';
  error.append(errorText, retry);
  error.hidden = true;
  body.append(price, change, meta, extended, error);

  const footer = el('div', 'stock-quote-footer');
  const note = el('p', 'stock-quote-note', noteText);
  if (config.note) moveInstrumentation(config.note.cell.querySelector('[data-aue-prop]') || config.note.cell, note);
  footer.append(note, refresh);

  block.replaceChildren(header, body, footer);

  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    block.classList.add('is-loading');
    block.classList.remove('is-error');
    body.setAttribute('aria-busy', 'true');
    refresh.disabled = true;
    error.hidden = true;
    try {
      const q = await fetchQuote(symbol);
      const direction = trend(q.change);
      price.replaceChildren(
        el('span', 'stock-quote-amount', formatPrice(q.price, q.currency)),
        el('span', 'stock-quote-currency', q.currency),
      );
      change.className = `stock-quote-change ${direction}`;
      change.textContent = formatChange(q.change, q.changePercent);
      change.setAttribute('aria-label', `Change ${direction === 'flat' ? 'unchanged' : direction} ${change.textContent}`);
      tag.textContent = q.exchange ? `${q.exchange} · ${q.symbol}` : q.symbol;
      if (!config.title?.value && q.name) title.textContent = `${q.name} (${q.symbol})`;
      const state = MARKET_STATES[q.marketState] || (q.marketState ? 'Market closed' : '');
      const delay = q.realTime ? 'Real time' : '15 min delayed';
      meta.textContent = [`Last update ${formatTime(q.time)}`, state, `${delay} · ${q.source}`].filter(Boolean).join(' · ');
      const ext = q.extended && q.marketState !== 'REG_MKT' ? q.extended : null;
      extended.hidden = !ext;
      if (ext) {
        extended.textContent = `${ext.type === 'PRE_MKT' ? 'Pre-market' : 'After hours'}: ${formatPrice(ext.price, q.currency)} ${formatChange(ext.change, ext.changePercent)}`;
      }
      block.dataset.quoteSource = q.source;
    } catch (e) {
      block.classList.add('is-error');
      error.hidden = false;
      // eslint-disable-next-line no-console
      console.warn(`stock-quote: ${symbol} quote unavailable`, e);
    } finally {
      loading = false;
      block.classList.remove('is-loading');
      body.removeAttribute('aria-busy');
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', load);
  retry.addEventListener('click', load);
  load();
}
