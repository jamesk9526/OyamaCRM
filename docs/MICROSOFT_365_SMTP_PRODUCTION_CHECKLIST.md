## Microsoft 365 SMTP Production Deployment Checklist

**Status**: Ready for Production ✅

This checklist ensures that Microsoft 365 SMTP integration is properly configured and secure before deploying to production.

---

## Pre-Deployment Requirements

### Microsoft 365 Organization Setup

- [ ] Microsoft 365 subscription with Exchange Online license for mailbox
- [ ] Global Administrator access to Microsoft 365 Admin Center
- [ ] Dedicated mailbox for application (e.g., `no-reply@yourdomain.com` or `notifications@yourdomain.com`)
  - ⚠️ **DO NOT** use a staff member's personal mailbox
- [ ] Mailbox is licensed with appropriate plan (Business Standard, Business Premium, or Enterprise)

### Infrastructure & Credentials

- [ ] Encryption key generated: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Encryption key stored in secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] SMTP credentials (email + app password) obtained and stored in vault
- [ ] Verified Network: outbound SMTP (port 587) is not blocked by firewall
- [ ] DNS/hostname resolution verified: `nslookup smtp.office365.com`

---

## Microsoft 365 Configuration

### Step 1: Enable Authenticated SMTP

**Location**: Microsoft 365 Admin Center → Exchange → Settings → POP, IMAP and Authenticated Client Access

- [ ] Navigate to **Hybrid** tab in Exchange Settings
- [ ] Enable **Authenticated Client Submission** (SMTP AUTH)
- [ ] Save settings (may take 15-30 minutes to propagate)

### Step 2: Configure Mailbox Permissions

For each mailbox that will send emails:

**Location**: Microsoft 365 Admin Center → Users → Active users → Select mailbox → Mail settings

- [ ] Confirm mailbox is **Exchange licensed** (not shared mailbox)
- [ ] Confirm **SMTP AUTH enabled** in mailbox properties
  - If using PowerShell: `Set-CASMailbox -Identity no-reply@yourdomain.com -SmtpClientAuthenticationDisabled $false`

### Step 3: Generate App Password (if MFA enabled)

**Location**: Microsoft 365 Account → My Account → Security (myaccount.microsoft.com)

- [ ] Sign in as the mailbox user (not delegated admin)
- [ ] Go to **Security** → **Verify Additional Security Info**
- [ ] Click **+ Add sign-in method** or **Create app password**
- [ ] Select **Mail** and **Other (custom)**
- [ ] Copy the generated app password (use this as `SMTP_PASS`)
- [ ] Store app password in vault (never commit to source control)

---

## OyamaCRM Application Setup

### Step 4: Configure Environment Variables

**For Staging/Production Deployment**:

Set these environment variables in your deployment platform:

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@yourdomain.com                    # Your mailbox email
SMTP_PASS=<app-password-from-vault>                 # Use vault injection
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME="Your Organization Name"
CREDENTIAL_ENCRYPTION_KEY=<64-char-hex-from-vault>
EMAIL_QUEUE_POLL_MS=15000
EMAIL_QUEUE_BATCH_SIZE=10
```

### Step 5: Configure via Admin UI (Optional)

Alternatively, configure through the application:

1. Log in as admin user
2. Go to **Settings** → **Organization Settings**
3. Scroll to **Email Provider Settings**
4. Select **Email Provider**: **Microsoft 365 SMTP**
5. Fill in:
   - **Email Address**: `no-reply@yourdomain.com`
   - **SMTP Password**: App password from Microsoft 365
   - **From Name**: `"Your Organization Name"`
6. Click **Send SMTP Test** → verify receipt
7. Click **Save Settings**

---

## Pre-Production Testing

### Test 1: SMTP Connectivity

From application server:

```bash
# Verify port 587 is reachable
telnet smtp.office365.com 587

# Expected output:
# Connected to...
# 220 ...smtp.office365.com ESMTP ...
```

- [ ] Connection successful
- [ ] TLS handshake succeeds

### Test 2: Authentication Test

Use the application's built-in test:

1. Go to **Settings** → **Organization Settings** → **Email Provider**
2. Click **Send SMTP Test**
3. Enter test recipient email: `your-admin-email@yourdomain.com`
4. Click **Send Test Email**
5. Check email inbox for test message
6. Verify sender shows `no-reply@yourdomain.com` or configured **From Name**

- [ ] Test email received successfully
- [ ] Sender address is correct
- [ ] Email is not in spam folder
- [ ] No "Authentication Failure" or "TLS" errors in logs

### Test 3: Email Queue Integration

Send a test campaign:

1. Go to **Communications** → **Email Campaigns**
2. Create a test campaign:
   - Subject: "Test Campaign - [Date]"
   - Body: "This is a test email from OyamaCRM"
   - Recipients: Test donors (personal emails or internal staff)
   - Schedule: "Send Immediately"
3. Click **Queue for Sending** or **Send Now**
4. Monitor **Audit Logs** → filter for email events
5. Wait 15-30 seconds for queue worker to process

- [ ] Campaign shows **queued** or **sending** status
- [ ] Email queue worker polls and processes the campaign
- [ ] Test recipients receive emails within 1-2 minutes
- [ ] Audit log shows `EMAIL_CAMPAIGN_QUEUED` and `EMAIL_SENT` events

### Test 4: Delivery Monitoring

Monitor over 24-48 hours:

- [ ] No delivery failures or bounces reported in logs
- [ ] Email open/click tracking (if enabled) is working
- [ ] No emails ending up in spam (check recipient spam folders)
- [ ] Unsubscribe links are functional and tracked

---

## Security Configuration

### Authentication & Encryption

- [ ] `CREDENTIAL_ENCRYPTION_KEY` is unique for this environment
- [ ] Encryption key is stored in vault, not in source control (`.env` should not be committed)
- [ ] SMTP password is stored encrypted in database (not plaintext)
- [ ] User passwords are never logged or displayed in logs

### Network Security

- [ ] Outbound SMTP (port 587) is allowed by firewall
- [ ] Outbound SMTP is restricted to `smtp.office365.com` (not open to all SMTP hosts)
- [ ] TLS 1.2+ is enforced on SMTP connection
- [ ] Application enforces `requireTLS=true` for port 587

### Access Control

- [ ] Only admin users can configure SMTP settings
- [ ] Settings page requires authentication
- [ ] SMTP credentials are masked in UI (show first 3 chars only)
- [ ] Audit logs track all SMTP configuration changes

---

## Monitoring & Maintenance

### Daily Monitoring

- [ ] Check **Audit Logs** for email sending events
- [ ] Verify no email delivery errors in past 24 hours
- [ ] Monitor application logs for SMTP timeouts or connection failures
- [ ] Check mailbox quota on Microsoft 365 (ensure it's not full)

### Weekly Monitoring

- [ ] Review email delivery rates (% delivered vs. bounced)
- [ ] Check for spam complaints or unsubscribe patterns
- [ ] Verify unsubscribe/opt-out preferences are being respected
- [ ] Monitor SMTP performance (latency, retry rates)

### Monthly Maintenance

- [ ] Review SPF/DKIM/DMARC records for domain alignment
- [ ] Check mailbox forwarding rules (ensure no unwanted rules exist)
- [ ] Review and rotate encryption key (if security event occurred)
- [ ] Audit SMTP user permissions in Microsoft 365
- [ ] Generate email delivery report for organization leadership

---

## Troubleshooting Common Issues

### Issue: "535 5.7.58 Authentication Unsuccessful"

**Cause**: Incorrect email or password

**Solution**:
1. Verify SMTP_USER is correct mailbox email (e.g., `no-reply@yourdomain.com`)
2. If MFA enabled, verify using app password (not account password)
3. Verify app password is correct (copy-paste from Microsoft 365)
4. Go to **Settings** → **Organization Settings** → click **Send SMTP Test** to verify

### Issue: "5.7.60 SMTP Client Authenticated Submission Disabled"

**Cause**: Mailbox does not have SMTP AUTH enabled

**Solution**:
1. Verify in Microsoft 365 Admin Center: **Exchange** → **Settings** → **Authenticated Client Access** is enabled
2. Verify mailbox has SMTP AUTH enabled:
   - PowerShell: `Set-CASMailbox -Identity no-reply@yourdomain.com -SmtpClientAuthenticationDisabled $false`
   - Wait 15-30 minutes for change to propagate

### Issue: "Connection Refused" or "Timeout"

**Cause**: Network firewall blocking port 587, or DNS not resolving

**Solution**:
1. Verify `smtp.office365.com` resolves: `nslookup smtp.office365.com`
2. Verify port 587 is reachable: `telnet smtp.office365.com 587`
3. Check firewall rules allow outbound SMTP (port 587)
4. Check application server logs for detailed error

### Issue: "TLS Negotiation Failed" or "SSL: CERTIFICATE_VERIFY_FAILED"

**Cause**: TLS 1.2+ not enforced, or certificate validation issue

**Solution**:
1. Verify `SMTP_SECURE=false` and `SMTP_PORT=587` (STARTTLS mode)
2. Verify Nodemailer config includes `requireTLS=true` and `tls: { minVersion: "TLSv1.2" }`
3. Check server time is accurate (clock skew can cause cert validation issues)

### Issue: "Emails not received or in spam"

**Cause**: SPF/DKIM/DMARC not configured, or IP reputation issue

**Solution**:
1. Verify SPF record includes Microsoft 365 IPs:
   ```
   v=spf1 include:outlook.com ~all
   ```
2. Enable DKIM signing in Microsoft 365 Admin Center
3. Set up DMARC record:
   ```
   v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com
   ```
4. Wait 48 hours for DNS propagation
5. Check IP reputation at [Talos Intelligence](https://www.talosintelligence.com/reputation_center/) or [MXToolbox](https://mxtoolbox.com/)

---

## Post-Deployment Verification

### Week 1 Verification

- [ ] ✅ Test campaigns sending successfully
- [ ] ✅ Email delivery rate ≥95%
- [ ] ✅ No TLS or authentication errors in logs
- [ ] ✅ Bounce rate <5%
- [ ] ✅ Unsubscribe links functional

### Week 2-4 Verification

- [ ] ✅ Consistent daily email sending without errors
- [ ] ✅ No rate limiting or throttling issues
- [ ] ✅ Email open/click tracking (if enabled) accurate
- [ ] ✅ Audit logs complete and organized
- [ ] ✅ Staff training completed on email campaign tools

### Month 1+ Verification

- [ ] ✅ Overall email program metrics tracked
- [ ] ✅ Compliance with email best practices (CAN-SPAM, GDPR)
- [ ] ✅ Monitoring dashboards set up
- [ ] ✅ Disaster recovery plan documented
- [ ] ✅ Encryption key rotation scheduled

---

## Rollback Plan

If issues occur in production:

### Immediate Rollback (< 1 hour)

1. **Stop email sending**:
   - Go to **Settings** → **Organization Settings**
   - Select **Email Provider**: **None** or **Disabled**
   - Click **Save Settings**

2. **Pause queued campaigns**:
   - Go to **Communications** → **Email Campaigns**
   - Select all queued campaigns
   - Click **Pause Sending**

3. **Investigate**:
   - Check **Audit Logs** for error messages
   - Check application server logs for stack traces
   - Verify SMTP credentials are still valid in Microsoft 365

### Rollback to Previous Provider (if applicable)

If switching from another SMTP provider:

1. Keep previous provider credentials in vault
2. In case of issues, revert `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
3. Redeploy with previous provider
4. Test with small campaign batch

---

## Support & Documentation

**Documentation Files**:
- `docs/MICROSOFT_365_SMTP_SETUP.md` — Detailed setup guide
- `docs/EMAIL_ENVIRONMENT_VARIABLES.md` — Complete variable reference
- `docs/DONOR_CRM_EMAIL_SYSTEM_AUDIT.md` — Email system architecture

**Microsoft 365 Support**:
- [Exchange Online Support](https://support.microsoft.com/exchange)
- [Microsoft 365 Admin Center Health Dashboard](https://admin.microsoft.com/)

**OyamaCRM Support**:
- Check **Audit Logs** for email sending history
- Review application error logs
- Contact OyamaCRM support with:
  - Error message or code
  - Timestamp
  - Affected recipients
  - Recent configuration changes
