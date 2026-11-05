# Demo block `stock-quote` — live share price (TSLA)

Shows a live quote (price in USD, change, % change, last update time in America/New_York, market
state) fetched **in the browser on every page load**. Edge Delivery has no server side, so the data
source must answer CORS for any origin. Same code in `eds-intact` (AEM / Universal Editor) and
`eds-intact-da` (da.live).

| Page | URL |
|---|---|
| AEM (xwalk) | https://localhost:8444/content/intact/en/demo-dynamic.html |
| da.live | https://main--eds-intact-da--azouaoui-deloitte.aem.live/en/demo-dynamic |

## Data source

Candidates tested on 2026-11-05 with `fetch()` in Chromium (Playwright) from both origins
`https://localhost:8444` and `https://main--eds-intact-da--azouaoui-deloitte.aem.live`:

| Source | Key | CORS from both origins | Freshness | Result |
|---|---|---|---|---|
| CNBC quote service `quote.cnbc.com/quote-html-webservice/restQuote/...` | none | yes (`Access-Control-Allow-Origin: *`) | real time (`realTime: true`), market state, pre / after hours | **primary** |
| TradingView scanner `scanner.tradingview.com/america/scan` (POST `text/plain`) | none | yes (origin reflected) | 15 min delayed | **fallback** |
| Yahoo chart v8 `query1/query2.finance.yahoo.com/v8/finance/chart/TSLA` | none | no (blocked; 429 from curl) | — | rejected |
| Stooq `stooq.com/q/l/?s=tsla.us...` | none | no (404, endpoint moved) | — | rejected |
| Nasdaq `api.nasdaq.com/api/quote/TSLA/info` | none | no CORS header | real time | rejected |
| Finnhub / Twelve Data / Alpha Vantage | personal key | yes | varies | not needed (a key in a block would be public) |

Both chosen endpoints are **unofficial** (no SLA, terms of use of the providers, may change or
throttle). Fine for a demo; production needs a licensed market data feed behind a server-side proxy
or an Edge function owned by the project. No key or secret is used or committed.

## Behaviour

- Block config: `ticker` (default `TSLA`), `title` (empty = company name from the quote), `note`
  (currency note). UE model `stock-quote` (three text fields); da.live: two-column table
  `Ticker | TSLA`, `Title | …`, `Note | …`.
- Request: CNBC with a `ts` cache-busting parameter and `cache: 'no-store'`, 8 s timeout; on error or
  unknown symbol the TradingView scanner; both failing = *Quote unavailable* with **Retry**.
- **Refresh** button reloads the quote without reloading the page.
- Change is teal (`--color-teal`, up ▲) or dark red (`--color-brand-red-dark`, down ▼).
- Every line keeps its height in the loading skeleton, data and error states (measured CLS 0 at 1440
  and 375); the meta line reserves two lines on phones.
- Market state from CNBC `curmktstatus`: `REG_MKT` *Market open*, `PRE_MKT` *Pre-market*,
  `POST_MKT` *After hours*, otherwise *Market closed*; the pre / after hours price is shown outside
  the regular session.
