# Demo block `cf-rates` — mortgage rates from an AEM Content Fragment

The block reads a Content Fragment through a persisted GraphQL query **on every page load** (no
cache), so a change saved in the Content Fragment shows on the next reload of the Edge Delivery page.
Same code in `eds-intact` (AEM / Universal Editor) and `eds-intact-da` (da.live).

## AEM (local SDK author 4802)

| Item | Path / URL |
|---|---|
| Configuration capabilities | `/conf/intact`: Content Fragment Models + GraphQL Persisted Queries enabled (Configuration Browser) |
| CF model *Mortgage Rates* | `/conf/intact/settings/dam/cfm/models/mortgage-rates` |
| Demo fragment | `/content/dam/intact/demo/mortgage-rates` (folder `cq:conf=/conf/intact`) |
| GraphQL endpoint | `/content/cq:graphql/intact/endpoint` |
| Persisted query | `/conf/intact/settings/graphql/persistentQueries/mortgage-rates` (`intact/mortgage-rates`, `cache-control: max-age=0`) |
| Query URL | https://localhost:8444/graphql/execute.json/intact/mortgage-rates;path=/content/dam/intact/demo/mortgage-rates |
| CF editor | http://localhost:4802/editor.html/content/dam/intact/demo/mortgage-rates |
| CORS (author) | `com.adobe.granite.cors.impl.CORSPolicyImpl` for `https://*--eds-intact-da--azouaoui-deloitte.aem.(page\|live)`, paths `/graphql/execute.json/intact/.*`, GET / HEAD / OPTIONS, no credentials |

Model fields: `title` (text, required), `effectiveDate` (date, required), `fixed1Rate`,
`fixed1Apr`, `fixed3Rate`, `fixed3Apr`, `fixed5Rate`, `fixed5Apr`, `variable5Rate`, `variable5Apr`
(float numbers, %), `disclaimer` (multi-line plain text).

Persisted in `aem-intact` (redeployable, `merge` mode = never overwrites author edits):
`ui.content` filters `/conf/intact/settings/dam/cfm`, `/conf/intact/settings/graphql`,
`/content/cq:graphql/intact`, `/content/dam/intact/demo`; `ui.config` `config.author`
`com.adobe.granite.cors.impl.CORSPolicyImpl~intact-eds-da.cfg.json`.

## Block

- Config: `reference` (UE field `aem-content-fragment`, root `/content/dam/intact`, the picker stores
  the variation in `variation`), `variation` (default `master`). da.live table: `Content Fragment`,
  `Variation`, `AEM endpoint` (default `https://localhost:8444`, or page metadata `aem-endpoint`),
  `Fallback` (sheet).
- Request: `<endpoint>/graphql/execute.json/intact/mortgage-rates;path=<cf>;variation=<v>?ts=<now>`,
  `cache: 'no-store'`, 8 s timeout. The `/` of the path must stay unencoded (AEM does not decode
  `%2F` in the matrix parameters). On the AEM render (`/content/...`) the request is same-origin
  (the proxy logs in as admin).
- Fallback (da.live): when AEM is not reachable the block renders the sheet
  `/en/demo-mortgage-rates.json` (same field names), tagged **Demo · Fallback**, with the reason and
  **Retry**. Without a fallback: *Rates unavailable*.
- Universal Editor (AEM render only): the rendered rates are instrumented as a `reference` to
  `urn:aemconnection:<cf>/jcr:content/data/<variation>`; `title` and `disclaimer` are editable
  in place (text). The rate numbers are not instrumented: an inline text edit would store them as
  strings instead of the model `Double`. Edit the rates in the CF editor (or the UE properties rail
  if the CF form loads there).

## da.live → local AEM

`https://main--eds-intact-da--azouaoui-deloitte.aem.live` (public) calling `https://localhost:8444`
(loopback) is a cross-origin **Local Network Access** request:

- the 8444 proxy (`~/ue-service/aem-https-proxy.cjs`, env `CORS_ORIGINS`, `CORS_PATHS` set in
  `daemon-start-scotia.sh`) answers the preflight itself (`Access-Control-Allow-Origin`,
  `Access-Control-Allow-Private-Network: true`) and adds `Access-Control-Allow-Origin` to the
  responses of `/graphql/execute.json/intact/` for the eds-intact-da origins only;
- Chrome 142+ asks once *“… wants to access other apps and services on this device / local
  network”*: click **Allow**, then **Retry** (or reload). Denied or ignored = fallback data.
  Headless Chromium denies it unless the `local-network-access` permission is granted.

Only the machine running the local AEM + proxy sees the live fragment; everyone else gets the
fallback sheet.

## Demo script

1. Open both pages: https://localhost:8444/content/intact/en/demo-dynamic.html and
   https://main--eds-intact-da--azouaoui-deloitte.aem.live/en/demo-dynamic (on da.live allow the
   local network prompt once). Both show **Demo · Live from AEM** and the 5-year fixed rate 4.39%.
2. Open the fragment in AEM: http://localhost:4802/editor.html/content/dam/intact/demo/mortgage-rates,
   change *5-year fixed - rate (%)* (e.g. 4.39 → 3.99), **Save**.
3. Reload both pages (or select **Reload** in the block): the 5-year fixed card shows 3.99%.
4. Universal Editor (AEM page):
   https://experience.adobe.com/#/aem/editor/canvas/localhost:8444/content/intact/en/demo-dynamic.html
   — select the rates to edit the fragment title / disclaimer in place, select the block to change
   the fragment or the variation.
5. Restore 4.39 in the CF editor.

Verified 2026-11-05: Sling POST `fixed5Rate=3.99` (`@TypeHint=Double`) on the master variation →
both pages showed 3.99% on reload → restored 4.39.
