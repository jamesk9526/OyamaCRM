# Oyama CRM — UI, Communications, Reliability, and Authentication Improvements

## 1. Simplify Email-to-Letter and Letter-to-Email Conversion

Create a unified communication system that allows staff to move between email and printed letters without rebuilding the content manually.

### Email to Printable Letter

Add a clearly visible **Print as Letter** button to every email view.

When selected, Oyama should:

* Convert the email body into a clean, professional letter layout.
* Remove email-only interface elements, quoted reply chains, tracking details, and unnecessary headers.
* Add the organization’s letterhead, logo, address, phone number, and other configured contact information.
* Include the recipient’s name and mailing address when available in the CRM.
* Include the date, greeting, message body, closing, and sender information.
* Allow the user to preview the letter before printing.
* Allow the user to edit the converted letter without changing the original email.
* Support direct printing and PDF download.
* Save the printed letter to the constituent’s communication history.

### Letter to Email

Add an **Email This Letter** button to every letter or document view.

When selected, Oyama should:

* Convert the letter into responsive HTML email.
* Remove postal-only formatting, such as address blocks and page headers, when appropriate.
* Preserve headings, paragraphs, lists, links, signatures, and basic formatting.
* Apply the organization’s approved email template.
* Automatically fill the recipient’s email address when available.
* Let the user choose an email subject.
* Allow the user to preview and edit the email before sending.
* Preserve the original letter as an attachment when desired.
* Save the resulting email in the constituent’s communication history.

### Shared Communication Composer

Longer term, letters and emails should use the same underlying content editor.

The user should be able to choose an output format:

* Email
* Printed letter
* PDF
* Internal note
* Email with PDF attachment

This would reduce duplicate editors and make communication templates reusable across the CRM.

---

## 2. CRM-Wide UI Reliability and Interaction Audit

Perform a complete reliability pass across the Oyama interface, focusing on every interactive element inside pages, panels, cards, tables, drawers, and modal windows.

### Elements to Audit

Review and test:

* Buttons
* Links
* Dropdown menus
* Select boxes
* Checkboxes
* Radio buttons
* Date pickers
* Search fields
* Filters
* Pagination controls
* Tabs
* Tooltips
* Popovers
* Context menus
* Modal windows
* Side drawers
* Confirmation dialogs
* File upload controls
* Rich-text editors
* Form validation
* Toast notifications
* Loading indicators
* Empty states
* Error states

### Modal and Frame Reliability

Every modal, drawer, embedded panel, iframe, and nested interface must:

* Keep buttons visible and clickable.
* Prevent content from overflowing outside the container.
* Scroll internally when content is taller than the viewport.
* Remain usable at browser zoom levels from 80% through 200%.
* Work on desktop, tablet, and mobile screen sizes.
* Keep dropdown menus above the modal instead of hiding them behind it.
* Trap keyboard focus while open.
* Close with the Escape key when safe.
* Return focus to the element that opened it.
* Prevent background scrolling.
* Display clear loading, success, and error states.
* Prevent accidental duplicate submissions.
* Warn users before closing when unsaved changes exist.

### Button Reliability Standards

Every actionable button must:

* Have a clear label or accessible name.
* Show hover, focus, pressed, disabled, loading, success, and error states.
* Remain disabled while an irreversible action is processing.
* Be protected against double-click duplication.
* Display confirmation before destructive actions.
* Provide visible feedback after the action completes.
* Never silently fail.

### Form Reliability Standards

Every form must:

* Preserve entered data after a recoverable error.
* Validate required fields before submission.
* Display errors next to the relevant field.
* Provide a clear summary when multiple fields contain errors.
* Prevent duplicate records caused by repeated submission.
* Autosave long forms where appropriate.
* Warn the user before navigating away with unsaved changes.
* Support keyboard-only navigation.
* Work with browser autofill and password managers.

### Recommended Development Safeguards

Create shared reusable components instead of maintaining separate versions of buttons, modals, forms, alerts, and dropdowns throughout the CRM.

Add automated testing for critical workflows, including:

* Creating and editing a donor
* Recording a donation
* Sending an email
* Printing a letter
* Generating a receipt
* Resetting a password
* Registering a passkey
* Importing records
* Exporting reports
* Opening and submitting modal forms
* Preventing duplicate donations and communications

---

## 3. Complete Password Reset System

Every user who signs in with a password must be able to securely reset it.

### Password Reset Workflow

The login page should include a **Forgot Password?** link.

The reset process should:

1. Ask for the user’s email address.
2. Display the same neutral response whether or not the account exists.
3. Send a single-use password-reset link.
4. Expire the link after a configurable period, such as 30–60 minutes.
5. Invalidate the token immediately after use.
6. Require a strong replacement password.
7. Sign the user out of other sessions when appropriate.
8. Send a security notification confirming that the password was changed.
9. Record the event in the security audit log.

### Administrator-Assisted Recovery

Authorized administrators should be able to:

* Send a password-reset email.
* Require a password change at the user’s next login.
* Revoke active sessions.
* Temporarily lock or unlock an account.
* View recovery activity without seeing the user’s password.
* Never manually assign or retrieve an existing password.

Passwords must always be stored using a modern password-hashing algorithm such as Argon2id or bcrypt. Plain-text passwords, reversible encryption, and emailed temporary passwords should not be used.

---

## 4. Passkeys, Biometrics, and Multi-Factor Authentication

Implement WebAuthn passkeys as the preferred passwordless authentication method.

A passkey lets the device verify the user through:

* Windows Hello
* Fingerprint recognition
* Face recognition
* Device PIN
* Apple Touch ID
* Apple Face ID
* iCloud Keychain
* Android credential managers
* Compatible password managers
* FIDO2 hardware security keys

Oyama should not directly collect, receive, or store fingerprint or facial data. The user’s operating system or credential provider performs the biometric check and returns a cryptographic authentication result to Oyama.

Passkeys should be implemented using WebAuthn, the browser standard for public-key credentials. Windows Hello and Apple passkey systems can then store or sync the credential through the user’s chosen device ecosystem.

### Passkey Enrollment

Inside Account Security, users should be able to:

* Add a passkey.
* Name the passkey, such as “Office PC,” “iPhone,” or “Security Key.”
* View when it was created.
* View when it was last used.
* Remove a passkey.
* Register multiple passkeys.
* Add a backup passkey on another device.
* Use a hardware security key when supported.

### Passkey Login

The login screen should offer:

* Sign in with a passkey
* Sign in with email and password
* Use another method
* Recover account

Support conditional passkey autofill where available so saved passkeys can appear naturally in the browser’s sign-in interface.

### Microsoft and Apple Support

Avoid treating “Microsoft passkey” and “Apple passkey” as separate proprietary authentication systems.

Instead, implement standards-based WebAuthn passkeys that can be stored and used through:

* Windows Hello and compatible Windows credential providers
* Apple iCloud Keychain and Authentication Services
* Third-party passkey managers
* FIDO2 security keys

Windows supports passkeys through Windows Hello and compatible FIDO2 authenticators, while Apple supports passkeys through its Authentication Services and Keychain systems.

Separate **Sign in with Microsoft** or **Sign in with Apple** account federation can be added later, but that is different from storing an Oyama passkey on a Microsoft or Apple device.

---

## 5. Email-Based Multi-Factor Authentication

Add email verification codes as an optional fallback authentication method, not as the strongest primary MFA method.

The system should:

* Generate a short-lived, single-use code.
* Expire the code after approximately 5–10 minutes.
* Rate-limit code requests and verification attempts.
* Invalidate earlier codes when a new code is requested.
* Never reveal whether an account exists.
* Record successful and failed attempts.
* Notify the user of suspicious login attempts.
* Avoid placing the complete verification code in application logs.

Recommended authentication priority:

1. Passkey
2. Hardware security key
3. Authenticator application using TOTP
4. Email verification code
5. Password-only login, where permitted

For administrators and users with access to financial, donor, or sensitive client information, require MFA rather than leaving it optional.

---

## 6. Account Recovery and MFA Recovery

MFA must not permanently lock legitimate users out of Oyama.

Provide:

* One-time recovery codes
* Multiple registered passkeys
* Backup email verification
* Administrator-assisted identity recovery
* Session revocation
* Lost-device recovery
* A secure process for replacing an unavailable authenticator
* Notifications whenever an authentication method is added or removed

Recovery codes should:

* Be shown only once.
* Be downloadable or printable.
* Be stored as hashes rather than plain text.
* Become invalid after use.
* Be regeneratable, invalidating the previous set.

Removing the final secure authentication method should require recent reauthentication and an additional confirmation step.

---

## 7. Session and Device Management

Add an **Active Sessions and Devices** page where users can view:

* Device or browser name
* Approximate location
* IP address
* First login
* Last activity
* Current session
* Authentication method used

Users should be able to:

* Sign out of one device.
* Sign out of every other device.
* Revoke a lost device.
* Mark a device as trusted when organizational policy permits.
* Receive an alert for a login from a new device.

Administrators should be able to revoke sessions for compromised, terminated, or suspended accounts.

---

## 8. Role and Permission Improvements

Review permissions so access is based on job responsibilities rather than broad administrator status.

Possible permissions include:

* View donors
* Edit donors
* View sensitive notes
* Record donations
* Edit completed donations
* Issue refunds
* Send email
* Print letters
* Manage templates
* Export donor data
* Import records
* View financial reports
* Manage users
* Reset user access
* Manage MFA policy
* View security logs
* Change organization settings

High-risk actions should require recent authentication or step-up verification.

Examples include:

* Exporting the donor database
* Changing banking or payment settings
* Disabling MFA
* Deleting financial records
* Changing another administrator’s permissions
* Viewing especially sensitive records

---

## 9. Communication Template Manager

Create a central template library for:

* Donation acknowledgments
* Receipts
* Thank-you letters
* Pledge reminders
* Event invitations
* Newsletter emails
* Volunteer communication
* Year-end statements
* Failed-payment notices
* Internal follow-up tasks

Templates should support merge fields such as:

* Donor name
* Household name
* Mailing address
* Donation amount
* Donation date
* Fund or campaign
* Receipt number
* Staff member
* Organization information
* Unsubscribe or preference link

Add preview modes for:

* Desktop email
* Mobile email
* Printed letter
* PDF

Templates should be versioned so changes do not alter previously sent communications.

---

## 10. Unified Communication Timeline

Each constituent record should display a single chronological timeline containing:

* Emails sent and received
* Printed letters
* Generated PDFs
* Phone-call notes
* Text messages, when supported
* Donation receipts
* Tasks and reminders
* Staff notes
* Delivery failures
* Email opens and clicks, when tracking is enabled
* Returned mail
* Communication preference changes

Users should be able to filter the timeline by communication type, staff member, date, campaign, and delivery status.

---

## 11. Drafts, Autosave, and Recovery

All email and letter composers should autosave drafts.

Required behavior:

* Save after a short period of inactivity.
* Display the last saved time.
* Recover drafts after a browser crash or accidental navigation.
* Prevent two users from unknowingly overwriting the same draft.
* Allow users to duplicate a previous communication.
* Preserve unsent attachments.
* Keep a limited revision history for important documents.

---

## 12. Accessibility and Responsive Design Pass

Audit the CRM against WCAG accessibility principles.

Include:

* Full keyboard navigation
* Visible keyboard focus
* Screen-reader labels
* Sufficient contrast
* Logical heading structure
* Accessible tables
* Properly labeled form errors
* Minimum touch-target sizing
* Text scaling without broken layouts
* Reduced-motion support
* No information communicated by color alone

Every major workflow should remain functional on:

* Desktop
* Laptop
* Tablet
* Mobile
* Electron desktop build
* Supported modern browsers

---

## 13. Audit Logging and Security History

Record security-sensitive actions in an immutable audit log.

Log:

* Login success and failure
* Password resets
* Passkey registration and removal
* MFA changes
* Permission changes
* User creation, suspension, and deletion
* Record exports
* Financial-record changes
* Donation deletion or reversal
* Bulk email activity
* Template changes
* Session revocation
* Sensitive settings changes

Each record should include:

* User
* Action
* Date and time
* Affected record
* IP address
* Device or browser
* Before-and-after values when appropriate

Sensitive values, passwords, tokens, recovery codes, and full authentication secrets must never appear in logs.

---

## 14. Additional Recommended Improvements

### Global Command and Search Bar

Add a universal command bar that lets users quickly:

* Find donors
* Find gifts
* Open recent records
* Create a donation
* Compose an email
* Create a letter
* Add a task
* Run common reports
* Navigate to settings

### Notification Center

Create a central location for:

* Failed emails
* Returned mail
* Failed recurring donations
* Duplicate-record warnings
* Import errors
* Assigned tasks
* Security alerts
* Records requiring review

### Duplicate Prevention

Add real-time duplicate checking when creating or importing constituents.

Check:

* Email address
* Phone number
* Mailing address
* Similar names
* Household relationships
* Existing payment-customer identifiers

Allow users to review likely matches before creating a new record.

### Background Job Reliability

Long-running operations should use a reliable job queue.

Examples include:

* Bulk email
* PDF generation
* Imports
* Exports
* Year-end statements
* Address standardization
* Duplicate scanning

Each job should show:

* Queued
* Processing
* Completed
* Completed with warnings
* Failed
* Retry available

### System Health Page

Add an administrator health dashboard showing:

* Database status
* Email delivery status
* Queue status
* Scheduled-task status
* Storage availability
* Backup status
* Failed jobs
* Application version
* Pending updates
* Recent application errors

Do not expose secrets, credentials, or unnecessary server details.

---

# Suggested Implementation Priority

## Phase 1 — Reliability and Recovery

* Complete the CRM-wide UI reliability audit.
* Standardize buttons, modals, forms, and notifications.
* Implement password reset.
* Add session revocation.
* Improve error handling and duplicate-submission protection.
* Add autosaving to communication editors.

## Phase 2 — Communication Conversion

* Add Print as Letter.
* Add Email This Letter.
* Build print and HTML email previews.
* Save all converted communications to the constituent timeline.
* Create shared letter and email templates.

## Phase 3 — Secure Authentication

* Add WebAuthn passkeys.
* Support Windows Hello, Apple passkeys, security keys, and compatible credential managers.
* Add TOTP authenticator support.
* Add email-code fallback.
* Add recovery codes and device management.
* Require MFA for privileged roles.

## Phase 4 — Auditing and Administration

* Add comprehensive security audit logs.
* Add granular role permissions.
* Add step-up authentication for high-risk actions.
* Build the system health dashboard.
* Add administrator account-recovery tools.

## Phase 5 — Workflow Enhancements

* Build the unified communication composer.
* Add the global command bar.
* Improve duplicate detection.
* Add the notification center.
* Add reliable background job processing.
* Expand automated browser and integration testing.

# Definition of Done

A feature should not be considered complete until it:

* Works on desktop, mobile, and the Electron build.
* Supports keyboard navigation.
* Includes loading, empty, success, and failure states.
* Prevents duplicate submissions.
* Produces a useful audit record where appropriate.
* Enforces permissions on the server, not only in the interface.
* Includes automated tests for its primary workflow.
* Handles expired sessions and network failures safely.
* Preserves user-entered information after recoverable errors.
* Has clear administrator and user-facing documentation.
