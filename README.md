# Intact personal insurance — da.live site

The Intact personal insurance page (implemented from the client Figma on the xwalk site
[eds-intact](https://github.com/azouaoui-deloitte/eds-intact)) published with Edge Delivery and
Document Authoring (`azouaoui-deloitte/eds-intact-da`). Blocks, styles, tokens and icons are shared with
eds-intact; header and footer are built from the `/nav` and `/footer` documents with the same DOM as the
AEM header / footer components.

Documents: `/en/personal-insurance`, `/nav`, `/footer`, sheets `/metadata.json` (nav / footer for `/**`)
and `/redirects.json` (`/` -> `/en/personal-insurance`). Edit: https://da.live/#/azouaoui-deloitte/eds-intact-da

Intact brand fonts are licensed and not versioned: pages use the sized Arial / Georgia fallbacks.

## Environments
- Preview: https://main--eds-intact-da--azouaoui-deloitte.aem.page/en/personal-insurance
- Live: https://main--eds-intact-da--azouaoui-deloitte.aem.live/en/personal-insurance

## Content
`import-work/tools/build-da.mjs [--fetch]` builds `import-work/da/` from the AEM render
(`https://localhost:8444/content/intact/en/personal-insurance.plain.html`, snapshot in `import-work/source/`)
and the DAM images; `import-work/tools/da-upload.sh [upload|preview|publish|all]` uploads to da.live
(token `~/.aem/da-token.json`, `da-auth-helper login`) and previews / publishes.

## Development

```sh
npm i
npm run lint
aem up
```
