# Report studio verification

16 focused unit/API tests passed. Web/server type checks and targeted lint passed. Mock-API browser checks passed for starter selection, grouping, run, presentation, saved definition and 1440/390px viewport overflow. Real database persistence, physical print/PDF output and large-data performance remain unverified. No live writes, migration or deployment occurred.

Research informed the source-first studio and presentation layout:

- eKYROS Reporting and Analytics: https://www.ekyros.com/default.aspx?tabid=65&tabindex=8
- eKYROS Donor Module: https://www.ekyros.com/default.aspx?tabid=64&tabindex=3
- Salesforce Customize NPSP Reports: https://trailhead.salesforce.com/content/learn/modules/fundraising-reports-and-dashboards-with-nonprofit-success-pack/create-new-reports-with-npsp

Saved definitions contain settings rather than donor results. Sources run against the authenticated organization. Grouping combines matching displayed values, and record counts are source rows rather than distinct donors. Source limits and notices are retained. Year/lapse-specific options remain in the standard report library. No PPTX export, automatic report email, SQL builder or external platform integration is claimed.
