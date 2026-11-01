# OyamaCRM v2 — interface evidence

Captured from the running local app with synthetic fixture records. These are application screenshots, not UI mockups. The current set uses the blue mountain-and-sun logo. Viewports are 1440×1000 desktop and 390×1000 mobile. Full-page captures reflect the app's internal scroll container; the table captures scroll that container to show working data.

| File | State |
| --- | --- |
| [Dashboard](dashboard-desktop.png) | Desktop overview with collapsed command dock |
| [Contacts](constituents-desktop.png) | Desktop contacts and top bar |
| [Command dock](command-dock-expanded.png) | All available page actions expanded |
| [Selection](spreadsheet-selection.png) | Selected cells, active address, and column letters |
| [Compact rows](spreadsheet-compact.png) | Resized column and denser rows |
| [Donations](donations-desktop.png) | Donation table with the shared enhancements |
| [Mobile dashboard](dashboard-mobile.png) | Mobile layout with collapsed dock |
| [Mobile commands](command-dock-mobile.png) | Expanded mobile ribbon |
| [Mobile contacts](constituents-mobile.png) | Responsive contacts layout |
| [Checks](checks.json) | Browser assertions and copied range |

Regenerate with `pnpm test:e2e:workspace` while the local web server is running. API fixtures do not exercise live tenant data or outbound communications. Existing module-specific mobile cards, authored documents, public pages and editing controls are preserved. Native tables can opt out with `data-spreadsheet="off"`.
