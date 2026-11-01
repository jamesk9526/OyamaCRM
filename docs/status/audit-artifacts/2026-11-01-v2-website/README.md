# V2 website visual evidence

Captured locally with `node tests/e2e/v2-website.e2e.mjs`. Embedded app images use synthetic records from the workspace audit.

| Page | Desktop | Mobile |
| --- | --- | --- |
| Homepage | [Preview](index-desktop.png) | [Preview](index-mobile.png) |
| Documentation | [Preview](docs-desktop.png) | [Preview](docs-mobile.png) |
| Hosting | [Preview](hosting-desktop.png) | [Preview](hosting-mobile.png) |
| Screenshot library | [Preview](screenshots-desktop.png) | [Preview](screenshots-mobile.png) |

`website-desktop.png` and `website-mobile.png` preserve the original suite capture names. `checks.json` records verification and link count. Four pages passed at 320/390/768/1440 pixels, with working gallery filters, previews, navigation, local links/anchors, downloads, and zero browser/request errors. Desktop captures are 1440 pixels wide; mobile captures are 390 pixels wide.

Hosting instructions were reviewed against repository scripts and configuration. No production deployment or fresh-server provisioning was tested.
