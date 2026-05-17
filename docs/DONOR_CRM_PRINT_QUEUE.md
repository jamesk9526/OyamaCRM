# DonorCRM Print And Mail Queue Guide

## Queue Routes

- Canonical queue workspace: `/letters-printables/queues`
- Print queue tab: `/letters-printables/queues?view=print`
- Mail queue tab: `/letters-printables/queues?view=mail`
- Production queue tab: `/letters-printables/queues?view=production`
- Legacy compatibility redirects: `/letters-printables/print-queue`, `/letters-printables/mail-queue`, `/letters-printables/generated`

## API Endpoints

- `GET /api/letters/generated/queue/print`
- `GET /api/letters/generated/queue/mail`
- `POST /api/letters/generated/queue/print/actions`
- `POST /api/letters/generated/queue/mail/actions`

## Print Queue Actions

- `APPROVE`
- `QUEUE_FOR_PRINT`
- `MARK_PRINTED`
- `MOVE_TO_MAIL_QUEUE`
- `CANCEL`
- `ARCHIVE`

## Mail Queue Actions

- `QUEUE_FOR_MAIL`
- `MARK_MAILED`
- `MARK_RETURNED`
- `ADDRESS_ISSUE`
- `REPRINT`
- `ARCHIVE`

## Permissions

- `letters.manage_print_queue`
- `letters.manage_mail_queue`

## Operational Notes

- Bulk actions write audit entries and constituent timeline notes.
- Queue metadata is stored in generated letter `metadataJson.queue`.
- Address completeness is checked before queueing for mail.
- Returned mail actions support `returnReason` capture.

## Known Limits

Status: Partially Working

- PDF export lane is still partial and should use browser print/PDF fallback.
- Settings route currently provides guidance; queue policy persistence APIs are not implemented.
