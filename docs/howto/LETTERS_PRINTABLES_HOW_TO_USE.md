# How To Use Letters & Printables

Date: July 13, 2026

## Primary Journey

1. Open the canonical OyamaLetters workspace at `/oyama-letters`.
2. Select a template.
3. Compose the letter.
4. Run Preview with a test constituent or gift.
5. Save Draft or Publish.

## Compose

Use the center page as the writing surface. The floating command bar provides common writing actions. Type `/` to open slash commands, or type `{{` to search merge variables.

## Insert Blocks

Use the left insert panel for content blocks:

- Heading
- Text
- List
- Quote
- Image
- Table
- Divider
- Variable
- Header
- Footer
- Signature
- Social Links
- Callout
- Donation Summary
- Receipt Block
- Organization Info
- Campaign Info
- Event Info

After inserting an image, click it in the canvas and open `Block Settings`. Use `Selected Image Size` to choose a preset width or adjust the width slider. PNG, JPG, and WEBP files up to 5 MB are uploaded to Letters media storage and render in generated PDFs.

## Signature Blocks

Open Branding Signatures and choose `New` or an existing signature. The signature visual builder opens in a modal with:

- Draw and Upload modes.
- A live rendered preview.
- Closing phrase, signer details, and typed fallback.
- Default and Active controls.

Use PNG, JPG, or WEBP for uploaded signatures. Selecting a signature in a letter template attaches it as an optional end-of-letter block.

## Send A Letter To Selected Donation Donors

1. Open Donations.
2. Select multiple donation rows, or choose `Select Visible Monthly Donors`.
3. Choose `Create Letters for Selected Donors`.
4. OyamaLetters opens with a temporary list of the unique selected donors.
5. Choose a template, review recipients and donation context, then generate.

The temporary list lasts for the current browser tab session and does not create a permanent CRM segment or send anything automatically.

## Create An OyamaEmail Draft From A Generated Letter

1. Generate a letter for a recipient who has an email address.
2. In the final Generated Letters table, choose `Create Email Draft`.
3. OyamaLetters creates a linked draft and opens it in the canonical OyamaEmail campaign workspace.
4. Review the recipient, rendered content, communication preferences, and send readiness in OyamaEmail before taking any send action.
5. Use `Return to Source Letter` in OyamaEmail when you need to reopen the originating template, recipient, and generated-letter context.

This handoff never sends automatically. Choosing the action again opens the already-linked campaign instead of creating another draft. The generated letter remains available in its print and mail workflow, and the source link survives later campaign edits.

## Format Text

Use the right Format tab for font family, font size, bold, italic, underline, strikethrough, inline code, color, alignment, and spacing.

## Page Setup

Use the right Page tab for paper size, margins, header preset, footer preset, signature preset, and branding source.

## Settings

Use the right Settings tab for subject, category, status, internal notes, and Test Preview context.

## Preview And Publish

`Preview` opens a print-focused preview modal. `Publish` requires confirmation before opening production generation workflows. More Options contains secondary actions such as Export PDF, Print Test, Archive Template, and Version History. Recipient-specific email handoff happens after generation so merge fields and recipient context are preserved.
