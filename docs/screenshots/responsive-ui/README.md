# Responsive UI Screenshots

This folder stores browser-captured responsive UI evidence for compact laptops, tablets, and mobile widths.

## Current Dated Set

- `2026-05-14/`

## Capture Command

```bash
pnpm test:e2e:responsive
```

## Required Core Screenshots

The 2026-05-14 compact-laptop pass expects these files in the dated folder:

- `dashboard-1366x768.png`
- `reports-1366x768.png`
- `communications-1280x720.png`
- `steward-signals-1366x768.png`
- `steward-paths-builder-1280x720.png`
- `webmaster-editor-1366x768.png`

## Notes

- Treat `1366x768` and `1280x720` as first-class desktop targets.
- Keep screenshots dated so layout changes remain auditable over time.
- Store machine-readable route metrics in `docs/status/responsive-ui-audit.json` alongside the markdown report.
