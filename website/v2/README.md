# OyamaCRM v2 product website

A standalone, four-page HTML/CSS/JavaScript website. No installation, framework, external font, or build step is required.

## Pages

- `index.html`: product overview, workflows, modules, interactive previews, mobile story, and FAQs.
- `docs.html`: daily work, spreadsheet shortcuts, command dock, fiscal context, local development, module references, and troubleshooting.
- `hosting.html`: separate static and application hosting instructions, including configuration, builds, selected PM2 services, routing, and verification.
- `screenshots.html`: nine application screenshots with desktop/mobile filters, full-size dialogs, and PNG downloads.

`styles.css` provides the brand foundations. `content.css` provides product stories, gallery, and documentation layouts. `script.js` shares navigation, previews, and filtering. Keep shared header/footer markup in sync when editing navigation.

## Preview

From the repository root:

```powershell
python -m http.server 8082 --bind 127.0.0.1 --directory website/v2
```

Open `http://localhost:8082`. Relative links also support subdirectory hosting. No SPA rewrite is needed.

## Publish

Publish the contents of `website/v2/` to a static document root. Include all four HTML pages, `styles.css`, `content.css`, `script.js`, and the complete `assets/` folder. Choose static/no framework, no build command, and `index.html` as the entry document. Configure your host's domain and HTTPS settings, then verify direct page URLs and downloads. Never publish the repository root or populated environment files.

This website does not run the CRM. See `hosting.html` for the separate web/API/MySQL guide. The guide is grounded in repository configuration; a fresh production deployment was not performed.

## Verify and capture

With the preview server running and Playwright Chromium installed:

```powershell
pnpm test:e2e:website
```

Set `WEBSITE_QA_URL` for another preview URL. The suite checks all four pages at 320/390/768/1440 pixels, navigation, previews, gallery filters, local links/anchors, downloads, and browser/request failures. Captures and `checks.json` are saved under `docs/status/audit-artifacts/2026-11-01-v2-website/`.

## Screenshot provenance

The nine app images come from `docs/status/audit-artifacts/2026-11-01-v2-workspace/`, captured after the mountain logo update and Steward chathead removal. They contain synthetic demonstration records. Source captures are not retouched. Update the copies and provenance when the interface changes.

GitHub links point to `jamesk9526/OyamaCRM`, main branch. Access follows repository permissions; publishing the site does not change permissions or license terms.
