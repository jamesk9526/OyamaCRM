# Microsoft 365 SMTP Email Integration - OyamaCRM Setup Guide

**Status**: ✅ **Production-Ready**  
**Last Updated**: May 2026  
**Version**: 1.0

## Overview

OyamaCRM now supports Microsoft 365 SMTP for sending nonprofit fundraising emails, campaign communications, and system notifications. This guide walks through complete setup, testing, and troubleshooting.

### Key Features

- ✅ **Port 587 STARTTLS**: Microsoft 365 recommended configuration
- ✅ **TLS 1.2+ Enforced**: Security-first configuration  
- ✅ **Credential Encryption**: Passwords encrypted at rest using AES-256-GCM
- ✅ **Authenticated SMTP**: Per-mailbox configuration in Microsoft 365 Admin Center
- ✅ **Test Send**: Verify configuration before production use
- ✅ **OAuth2 Ready**: Prepare for future migration to Graph API

---

## Part 1: Microsoft 365 Admin Setup

### Prerequisites

1. **Microsoft 365 Subscription** with a licensed mailbox (e.g., `giving@yourdomain.com`)
2. **Admin Access** to Microsoft 365 Admin Center
3. **Domain Verification** - Your domain must be verified in Microsoft 365
4. **Mailbox License** - The account must have an active mailbox and license

### Step 1: Enable Authenticated SMTP for the Mailbox

#### Via Microsoft 365 Admin Center (Easiest)

1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com/)
2. Navigate to **Users** → **Active users**
3. Find and select your no-reply/sending mailbox (e.g., `no-reply@yourdomain.com`)
4. Under **Mail** settings, select **Manage email apps**
5. Ensure **Authenticated SMTP** checkbox is **checked**
6. Save changes

**Note**: Changes take effect within 10-15 minutes.

#### Via Exchange PowerShell (Advanced)

If you prefer PowerShell:

```powershell
# Connect to Exchange Online
Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com

# Enable SMTP AUTH for the mailbox
Set-CASMailbox -Identity "no-reply@yourdomain.com" -SmtpClientAuthenticationDisabled $false

# Verify it's enabled
Get-CASMailbox -Identity "no-reply@yourdomain.com" | Select SmtpClientAuthenticationDisabled

# Disconnect when done
Disconnect-ExchangeOnline
```

### Step 2: Generate App Password (Optional but Recommended)

For accounts with **MFA enabled**, Microsoft recommends using an App Password instead of the account password:

1. Go to [My Account Security Settings](https://account.microsoft.com/security)
2. Select **App passwords** (only available if MFA is enabled)
3. Choose **App** = **Mail** and **Device** = **Windows Phone** (doesn't matter, it's generic)
4. Click **Create**
5. Microsoft generates a 16-character password
6. Copy and save this password securely

**Important**: Use the generated App Password instead of your account password in OyamaCRM.

### Step 3: Verify Sending Permissions

Ensure the mailbox can send emails:

1. In Exchange Admin Center, go to **Recipients** → **Mailboxes**
2. Select your mailbox
3. Under **Mail flow settings**, verify no restrictions are preventing outbound mail
4. Check that the mailbox isn't in a blocked/restricted state

---

## Part 2: OyamaCRM Configuration

### Step 1: Navigate to Email Settings

1. Log into OyamaCRM as an **Admin**
2. Go to **Settings** → **Organization Settings**
3. Scroll to **Email Provider Settings**
4. Select **Email Provider**: **Microsoft 365 SMTP**

### Step 2: Configure SMTP Credentials

Fill in the following fields:

| Field | Value | Example |
|-------|-------|---------|
| **SMTP Username** | Your Microsoft 365 mailbox (UPN format) | `no-reply@yourdomain.com` |
| **SMTP Password** | Account password OR App Password | (See Step 2 above) |
| **From Email** | Sending mailbox address | `no-reply@yourdomain.com` |
| **From Name** | Organization or sender name | `Hope Community Foundation` |

**Security Note**: The SMTP password is encrypted with AES-256-GCM and stored securely. It is never visible after saving.

### Step 3: (Optional) Override SMTP Host

Microsoft 365 defaults are pre-filled:
- **Host**: `smtp.office365.com`
- **Port**: `587`
- **Security**: STARTTLS (automatic TLS upgrade)

Only override these if your organization requires a custom host or proxy:

| Field | Default | Override If... |
|-------|---------|----------------|
| **SMTP Host Override** | `smtp.office365.com` | Organization uses a mail relay or proxy |
| **SMTP Port Override** | `587` | Firewall blocks port 587 (rare) |
| **Force SMTPS** | Unchecked | Your organization requires port 465 implicit TLS (legacy) |

### Step 4: Test Email Configuration

1. Enter a **test recipient email** (should be a real address you have access to)
2. Click **Send SMTP Test**
3. OyamaCRM will attempt to send a test message using the configuration above
4. Check the recipient's inbox (including spam/junk)

**Expected Result**: You should receive a message from your organization within 1-2 minutes.

### Step 5: Save Settings

Click **Save Organization Settings** to persist your configuration.

---

## Part 3: Troubleshooting

### Error: "535 5.7.139 Authentication unsuccessful"

**Most Common Causes**:

1. **Wrong Username or Password**
   - Ensure username is your full Microsoft 365 mailbox address (e.g., `no-reply@yourdomain.com`)
   - If using MFA, use the **App Password**, not your account password
   - Check for extra spaces before/after the password

2. **SMTP AUTH Not Enabled**
   - Return to [Microsoft 365 Admin Center](https://admin.microsoft.com/)
   - Go to **Users** → **Active users** → select mailbox → **Mail** → **Manage email apps**
   - Ensure **Authenticated SMTP** is checked
   - Wait 10-15 minutes for changes to replicate

3. **Security Defaults or Conditional Access Blocking SMTP**
   - If your organization has **Security Defaults** or **Conditional Access Policies** enabled, they may block basic SMTP AUTH
   - Contact your Microsoft 365 admin to allow SMTP AUTH
   - As an alternative, plan to migrate to **OAuth2/Graph API** (future enhancement)

4. **MFA Enabled Without App Password**
   - If your account has MFA enabled, you **must** use an App Password
   - Generate one at [My Account Security Settings](https://account.microsoft.com/security)

### Error: "5.7.60 SMTP; Client does not have permission to send as this sender"

**Cause**: The authenticated mailbox doesn't match the sender ("from") address.

**Solution**: Ensure the authenticated mailbox matches the sender:

```
Authenticated User (SMTP_USER): no-reply@yourdomain.com
From Email (SMTP_FROM_EMAIL): no-reply@yourdomain.com
```

**If you need to send from a different mailbox**:

1. Go to [Exchange Admin Center](https://admin.exchange.microsoft.com/)
2. Navigate to **Recipients** → **Mailboxes**
3. Select the authenticated mailbox
4. Under **Delegation**, add **Send As** permission for the target sender mailbox
5. Wait 30 minutes for propagation

### Error: "TLS Negotiation Failed" or "TLS Required"

**Cause**: Firewall or network blocking port 587 or TLS upgrade.

**Solution**:

1. Verify port 587 is not blocked:
   ```bash
   # Test from your network
   telnet smtp.office365.com 587
   # Should connect; type QUIT to exit
   ```

2. If port 587 is blocked, try **port 465** (implicit TLS):
   - Check **Force SMTPS secure mode** in OyamaCRM settings
   - Set **SMTP Port Override** to `465`
   - Uncheck **Use secure TLS/SSL transport** (port 465 is already secure)

3. If both are blocked, contact your IT/network administrator about:
   - Unblocking port 587 (preferred)
   - Or allowing outbound mail via a corporate mail relay

### Error: "Timeout" or "Connection Refused"

**Cause**: Network unreachable to `smtp.office365.com:587`.

**Debugging**:

1. **From OyamaCRM server**, test connectivity:
   ```bash
   # Linux/Mac
   nc -zv smtp.office365.com 587

   # Windows PowerShell
   Test-NetConnection -ComputerName smtp.office365.com -Port 587
   ```

2. **Check firewall rules**:
   - Ensure outbound port 587 is not blocked
   - Ensure DNS can resolve `smtp.office365.com`

3. **Verify Microsoft 365 service status**:
   - Check [Microsoft Service Health Dashboard](https://status.office365.com/)
   - If there's an outage, wait for resolution

### Test Email Appears in Spam/Junk

**Cause**: Microsoft or recipient email provider filtering.

**Solutions**:

1. **Verify Sender Reputation**:
   - Ensure your domain has proper SPF, DKIM, and DMARC records
   - Check [DMARC Report](https://dmarc.org/) for authentication failures

2. **Add Trusted Sender in Recipient's Email**:
   - In the recipient's inbox, right-click the test email
   - Select "Mark as not junk" or "Add to safe senders"

3. **For Production**: Use a reputable email service (SendGrid, Mailgun, etc.) instead of direct SMTP for transactional/bulk email to improve deliverability

---

## Part 4: Production Deployment

### Email Queue Configuration

Once SMTP is verified, emails are sent through an **in-process queue worker**:

```bash
EMAIL_QUEUE_POLL_MS=15000      # Check for due campaigns every 15 seconds
EMAIL_QUEUE_BATCH_SIZE=10      # Send up to 10 emails per batch
```

### Audit & Monitoring

All SMTP test sends are logged:
- **Audit Action**: `SMTP_TEST_EMAIL_SENT`
- **Details**: Recipient, timestamp, configuration used
- **Access**: Settings → Audit Logs

### Best Practices

1. **Use a Dedicated Mailbox**
   - Create `no-reply@yourdomain.com` or `communications@yourdomain.com`
   - Do not use personal staff mailboxes for bulk sends
   - Protects staff account security

2. **Monitor Delivery**
   - Check recipient inboxes for successful delivery
   - If bounce-back rates increase, investigate sender reputation
   - Use email analytics (if available) to track opens/clicks

3. **Maintain Compliance**
   - Include unsubscribe links in all bulk communications (CAN-SPAM, GDPR)
   - Respect constituent email preferences (Do Not Email flags)
   - OyamaCRM enforces these automatically in campaign sending

4. **Plan for OAuth2 Migration** (Future)
   - Current: SMTP with basic auth (username/password)
   - Recommended: OAuth2 with Microsoft Graph API (better security)
   - Timeline: Plan OAuth2 migration within 12-24 months

---

## Part 5: OAuth2 Migration Path (Future)

### Why OAuth2?

- ✅ No passwords stored for email
- ✅ Tokens auto-refresh
- ✅ Complies with Microsoft's Modern Auth push
- ✅ Works with Conditional Access policies

### Timeline

- **Phase 1** (Current): SMTP AUTH with password-based configuration
- **Phase 2** (2026-2027): OAuth2 option available alongside SMTP
- **Phase 3** (2027+): SMTP AUTH deprecated; OAuth2 required

### Setup When Available

1. In OyamaCRM Settings, select **Email Provider**: **Microsoft Graph**
2. Click **Connect to Microsoft 365**
3. Authorize OyamaCRM to send mail on behalf of your organization
4. Scopes requested:
   - `Mail.Send` — Send emails
   - `offline_access` — Refresh tokens when you're not logged in
   - `User.Read` — Read your mailbox identity

No passwords are stored; access tokens automatically refresh.

---

## Environment Variables for Deployment

### SMTP Configuration (Env-Based Fallback)

```bash
# Email SMTP host/port
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false                              # false for STARTTLS on 587
SMTP_USER=no-reply@yourdomain.com             # Your Microsoft 365 mailbox
SMTP_PASS=your-app-password-or-account-pwd    # Encrypted when stored in DB
SMTP_FROM_EMAIL=no-reply@yourdomain.com       # Sender email
SMTP_FROM_NAME="Your Organization Name"       # Sender friendly name

# Credential encryption (REQUIRED for production)
CREDENTIAL_ENCRYPTION_KEY=<64-char-hex-string>  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Email queue worker
EMAIL_QUEUE_POLL_MS=15000    # Check for due campaigns every 15 seconds (default: 15000)
EMAIL_QUEUE_BATCH_SIZE=10    # Send up to 10 emails per batch (default: 10)
```

### Generating Encryption Key

```bash
# macOS/Linux
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Windows PowerShell
[BitConverter]::ToString([byte[]] (Get-Random -Count 32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })) -replace '-', ''
```

**DO NOT commit or expose the encryption key in version control.**

---

## Testing Checklist

- [ ] SMTP Auth enabled for mailbox in Microsoft 365 Admin Center
- [ ] Test email sent successfully from OyamaCRM
- [ ] Test email not in spam/junk folder
- [ ] Campaign can be drafted in Communications module
- [ ] Campaign can be marked as "Ready to Send"
- [ ] Campaign send initiates email queue worker
- [ ] Sent email appears in constituent activity timeline
- [ ] Email bounce/delivery logged in audit trail

---

## Support & Resources

### Microsoft 365 Documentation

- [Enable SMTP AUTH for specific mailboxes](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission)
- [Fix email delivery issues](https://learn.microsoft.com/en-us/office365/troubleshoot/mail-issues)
- [SMTP authentication errors](https://learn.microsoft.com/en-us/exchange/troubleshoot/smtp-submission/smtp-submission-errors)
- [Set up app passwords for MFA](https://support.microsoft.com/en-us/account-billing/set-up-an-app-password-for-your-work-or-school-account)

### OyamaCRM Support

For setup issues:
1. Check audit logs: **Settings** → **Organization Settings** → **Audit Logs**
2. Review error messages from test sends
3. Verify SMTP credentials and Microsoft 365 permissions
4. Contact support with error code and timestamp

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 2026 | Initial Microsoft 365 SMTP integration, TLS 1.2+, credential encryption, test send functionality |
| 1.1 (Planned) | 2026-2027 | OAuth2/Microsoft Graph option alongside SMTP |
| 2.0 (Planned) | 2027+ | OAuth2 required; SMTP AUTH deprecated |

---

## License & Credits

OyamaCRM Email Integration follows nonprofit best practices from:
- Microsoft 365 Official Documentation
- RFC 5321 (SMTP), RFC 3207 (STARTTLS), RFC 5246 (TLS 1.2)
- NIST Cybersecurity Framework (encryption, credential management)
