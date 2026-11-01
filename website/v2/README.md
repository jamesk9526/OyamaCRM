# OyamaCRM v2 website

A standalone static product website built with HTML, CSS and JavaScript. No package installation or build step is required. GitHub links point to `jamesk9526/OyamaCRM` and its main branch.

Open `index.html` directly, or serve this folder locally:

```powershell
python -m http.server 8082 --directory website/v2
```

Then visit `http://localhost:8082`. Publish the contents of this folder with any static hosting service. Deployment has not been performed.

## Contents

- `index.html`: semantic product page and GitHub links
- `styles.css`: responsive layout, focus states and reduced-motion support
- `script.js`: screenshot switching, native screenshot dialog and mobile navigation
- `assets/`: the v2 logo and actual app screenshots using synthetic demonstration records

The screenshots are copied from `docs/status/audit-artifacts/2026-11-01-v2-workspace/` after capturing the new mountain logo and removing the floating Steward chathead. Replace these copies when the app UI changes. Repository access follows GitHub permissions; the site does not change repository visibility.
