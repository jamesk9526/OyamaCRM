# Create image reliability — 2026-11-04

The user's Brand Hub screenshot showed a saved primary-logo URL and blank image area. An anonymous, read-only request for that exact image returned **400 HTML** from `/uploads/letter-media/...`, while `/api/letters/media/...` returned **200 image/png**, 216,064 bytes, with a valid PNG signature. See [route evidence](live-route-check.json) and [user screenshot](user-reported-before.png). This establishes a failing public path; the deployment's proxy internals were not inspected.

## Changes

- Canonicalize current and legacy letter/email/branding upload URLs to anonymous API image routes, including saved absolute localhost or obsolete API origins. Next's `/uploads` compatibility rewrites now target those API routes. Organization branding has a narrow public PNG/JPEG/WebP/GIF retrieval route; private upload directories remain outside this surface.
- New Studio uploads return the API URL immediately. Existing asset records, brand revisions, channel profiles, rich design images and signatures normalize on read without a destructive backfill. Email HTML uses the same normalization for quoted/unquoted image sources, backgrounds, VML and source sets; send output resolves sources against the configured public app host. Hosted third-party URLs and cid/merge sources retain their meaning.
- Brand draft sanitization retains safe image references in custom letterhead/footer HTML. Script/event-handler removal remains active, tenant ownership checks include API aliases and HTML, and final PDF sanitization still requires frozen image bytes.
- Brand Hub and Studio asset selection now show actual thumbnails. Logo/signature previews expose loading/failure states and checkerboard backgrounds, with keyboard-operable dark backgrounds for white artwork. Missing files leave the saved URL editable with an actionable message.
- Letter proofs can freeze authorized images from the email asset library as well as branding and letter assets. Missing files fail with a replacement/regenerate message; no remote image hosts are fetched during PDF freezing.

## Verification

- 119 tests pass across ten focused unit/API suites: communication URL compatibility, branding assets, email rendering, Studio, production letter assets/branding, Studio workflow and public email/letter/brand media. New cases reproduce the original legacy-URL failures and verify save/reopen, HTML image preservation and tenant rejection.
- Web and server TypeScript checks pass. Targeted ESLint reports zero errors and two existing native-image warnings in the legacy StaffSignatureBlock. Web production build and server build pass.
- [Browser results](browser-checks.json): ten checks using the production Next build and real Express media routes through Next. Only CRM/auth data is intercepted. Visible synthetic PNG logos, a transparent white logo, a drawn-style signature and an illustration decode at nonzero dimensions in Brand Hub, Studio's asset chooser, the editable letter, the email iframe and standalone outgoing HTML without a CRM session. Expected missing-file requests return 404; every successful artwork request returns 200 with an image content type. No browser exceptions.
- Brand layouts inspected at 1500, 768 and 390 pixels, including keyboard activation/focus of the preview background control, wrapping, navigation, image proportions and absence of horizontal document overflow. Standalone email also inspected at 390 pixels.
- A two-page Chromium proof renders **after the original uploads are removed**, demonstrating frozen body, logo and signature assets. Both pages rasterized and inspected: page 1 contains three embedded images and page 2 two, with first/continuation branding and no visible image clipping. See [proof](letter-images-proof.pdf), [contact sheet](letter-images-proof-contact-sheet.png) and [raster checks](proof-raster-checks.json).

## Visual evidence and limits

[Brand Hub desktop](brand-logos-desktop.png), [missing-image state](brand-missing-image.png), [signature desktop](brand-signatures-desktop.png), [phone signature](brand-signatures-390.png), [letter/asset chooser](letter-images-desktop.png), [email workspace](email-images-desktop.png), [outgoing email](outgoing-email.png), [phone email](outgoing-email-mobile.png).

The before image is the user's live screenshot; after images use clearly labeled synthetic artwork and CRM responses. These verify task behavior and the light-blue/white/navy design guidance, not pixel equivalence with the user's organization data. Test uploads were removed and no CRM records were written. No database schema or migration changes were needed. No live email, brand publication, print job, infrastructure change or deployment occurred. Actual Outlook/Gmail inbox rendering and external-image privacy settings remain outside these browser checks. Deploy the API and web changes together, then recheck the user's logo in the authenticated live workspace. Already-sent HTML and generated PDFs were not rewritten.

The first dev-server attempts encountered a reserved Windows port and unstable hot-reload artifacts. Final browser acceptance used an available isolated port and the optimized production build; the production run passed.
