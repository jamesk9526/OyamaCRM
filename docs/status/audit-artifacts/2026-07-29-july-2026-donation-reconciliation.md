# July 2026 Donation Reconciliation Review

Date: 2026-07-29  
Scope: The narrative discrepancy report supplied by staff. The underlying eKYROS export and current-list export were not attached to this review.

## Internal checks on the supplied report

- The itemized "current list but not in eKYROS" amounts total **$4,443.00**, while the report states **$4,383.00**. This is a $60.00 discrepancy in the report itself.
- The listed matched-record differences total **+$910.91**.
- The headline variance reconciles only when using the report's stated $4,383.00 current-only total: $4,383.00 + $910.91 = **$5,293.91**.
- The count comparison mixes unlike measures. The report identifies 44 eKYROS gifts but compares 42 eKYROS donor records to 75 current-list transactions. On a transaction basis, 44 eKYROS gifts plus 31 current-only entries equals the 75 current transactions.

## Neutral conclusion

These checks identify calculation and classification issues in the report; they do not establish that either eKYROS or Oyama contains incorrect donation data. The reported Haine amount, names that may be aliases, split gifts, date cutoffs, statuses, designations, and manual entries must be reconciled against source records before any correction is made.

The locally configured development database does not appear to be the report dataset: its July aggregate did not match the reported July total or transaction count. No individual record conclusion was drawn from that local dataset.

## Safeguards added

- Exact receipt-number and transaction-ID matches are found across the organization before import. Existing records remain unchanged unless a staff member explicitly chooses an update path.
- Multiple existing records with the same exact identifier are returned as an ambiguous review condition rather than silently selecting one.
- Same donor, amount, UTC calendar day, and status candidates are exposed as possible matches. They are intentionally not labelled duplicates and are paused by default.
- A SHA-256 fingerprint of an uploaded source file is recorded in the import audit event. Re-importing a previously committed file requires a dry run and explicit acknowledgement.

## Required evidence for a conclusive reconciliation

1. The original eKYROS July gift-level export, including transaction/receipt ID, effective date, amount, donor name/email, status, designation, and export date/time.
2. The exact current-list export used for the report, with its filters, date field, timezone/cutoff, statuses, and any manual-entry indicator.
3. A row-level reconciliation sheet that classifies every entry as exact match, split/combined match, alias match, legitimate current-only entry, eKYROS-only entry, or needs review.
4. Approval from the data owner before altering a matched amount, merging donors, or excluding a transaction.
