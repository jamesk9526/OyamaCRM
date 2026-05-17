## Microsoft 365 SMTP Email Configuration - Environment Variables & Deployment

### Overview

OyamaCRM supports two email configuration methods:

1. **Environment Variables** (`.env` file for development, deployment config for production)
2. **Database Settings** (Via Admin UI at Settings → Organization Settings)

Environment variables provide defaults that are overridden by database settings. This allows flexible deployment with secure credential management.

---

## Environment Variables Reference

### SMTP Configuration (Microsoft 365 or Custom SMTP)

```bash
# Email SMTP host/port
SMTP_HOST=smtp.office365.com              # Microsoft 365 default hostname
SMTP_PORT=587                             # Microsoft 365 recommended port (STARTTLS)
SMTP_SECURE=false                         # false for port 587 (STARTTLS), true for port 465 (implicit TLS)

# SMTP authentication credentials
SMTP_USER=no-reply@yourdomain.com         # Your Microsoft 365 mailbox email
SMTP_PASS=your-app-password               # Account password OR app-password (encrypted in DB)

# Email sender information
SMTP_FROM_EMAIL=no-reply@yourdomain.com   # Sender email address (typically matches SMTP_USER)
SMTP_FROM_NAME="Your Organization Name"   # Friendly sender name shown in email clients

# Credential encryption (REQUIRED for production)
CREDENTIAL_ENCRYPTION_KEY=<64-char-hex>   # AES-256 encryption key for password storage
```

### Email Queue Configuration

```bash
# Email campaign queue worker polling
EMAIL_QUEUE_POLL_MS=15000                 # Poll database for due campaigns every 15 seconds
EMAIL_QUEUE_BATCH_SIZE=10                 # Send up to 10 emails per batch
```

### Example .env for Microsoft 365

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=abcd1234efgh5678ijkl    # App password (generated in Microsoft 365)
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME="Hope Community Foundation"
CREDENTIAL_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
EMAIL_QUEUE_POLL_MS=15000
EMAIL_QUEUE_BATCH_SIZE=10
```

---

## Generating the Encryption Key

The `CREDENTIAL_ENCRYPTION_KEY` is required for production and must be a 64-character hexadecimal string (32 bytes in hex).

### macOS/Linux

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Windows PowerShell

```powershell
$bytes = [byte[]]::new(32)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[BitConverter]::ToString($bytes) -replace '-', ''
```

### Online Generator (Dev Only)

**⚠️ NEVER use online generators for production keys!**

For development/testing only, you can use an online hex generator, but generate your own for production using the commands above.

---

## Deployment Patterns

### Development (Docker or Local)

```bash
# .env.local (development)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-test-mailbox@yourdomain.com
SMTP_PASS=your-test-password
SMTP_FROM_EMAIL=your-test-mailbox@yourdomain.com
SMTP_FROM_NAME="Test Org"
CREDENTIAL_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

### Production (Cloud Deployment)

#### Docker Compose

```yaml
services:
  oyama-app:
    environment:
      SMTP_HOST: smtp.office365.com
      SMTP_PORT: 587
      SMTP_SECURE: "false"
      SMTP_USER: ${MS365_SMTP_USER}       # Injected from secrets
      SMTP_PASS: ${MS365_SMTP_PASS}       # Injected from secrets  
      SMTP_FROM_EMAIL: ${MS365_SMTP_FROM}
      SMTP_FROM_NAME: "Hope Community Foundation"
      CREDENTIAL_ENCRYPTION_KEY: ${ENCRYPTION_KEY}  # 64-char hex
      EMAIL_QUEUE_POLL_MS: "15000"
      EMAIL_QUEUE_BATCH_SIZE: "10"
```

#### AWS Lambda / Heroku / Cloud Foundry

Set environment variables via the cloud platform's secrets management:

1. Generate encryption key (see above)
2. Store in secure vault (AWS Secrets Manager, Heroku Config Vars, etc.)
3. Set at deployment time:
   ```bash
   # Example: Heroku
   heroku config:set SMTP_HOST=smtp.office365.com \
     SMTP_USER=no-reply@yourdomain.com \
     SMTP_PASS='<your-app-password>' \
     CREDENTIAL_ENCRYPTION_KEY='<64-char-hex>'
   ```

#### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: oyama-smtp-config
type: Opaque
stringData:
  SMTP_HOST: smtp.office365.com
  SMTP_PORT: "587"
  SMTP_SECURE: "false"
  SMTP_USER: no-reply@yourdomain.com
  SMTP_PASS: "<your-app-password>"
  CREDENTIAL_ENCRYPTION_KEY: "<64-char-hex-string>"
---
apiVersion: v1
kind: Pod
metadata:
  name: oyama-app
spec:
  containers:
  - name: app
    image: oyama:latest
    envFrom:
    - secretRef:
        name: oyama-smtp-config
```

---

## Configuration Hierarchy

OyamaCRM resolves email configuration in this order:

1. **Database Settings** (Admin UI) - Highest priority
2. **Environment Variables** - Fallback defaults
3. **Hardcoded Defaults** - Lowest priority (if no other config)

```typescript
// Example: resolveOrganizationSmtpSettings() logic
const settings = await getFromDatabase(organizationId); // Check DB first
const envDefaults = process.env.SMTP_HOST;              // Then env

return {
  smtpHost: settings?.smtpHost || envDefaults || null, // DB first, then env
  // ...
};
```

This allows:
- **Development**: Quick setup via `.env`
- **Staging/Prod**: Secure config via database (Admin UI) with encryption

---

## Security Best Practices

### 1. Encryption Key Management

✅ **DO**:
- Generate a unique encryption key for each environment
- Store in a secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate keys annually (requires re-encrypting all stored passwords)
- Use different keys for dev/staging/production

❌ **DON'T**:
- Commit encryption key to version control
- Use a default/hardcoded key in production
- Share the key across teams
- Reuse keys from other projects

### 2. Credential Storage

✅ **DO**:
- Use App Passwords (if MFA is enabled in Microsoft 365)
- Store passwords encrypted in database
- Never log or display passwords
- Rotate passwords annually

❌ **DON'T**:
- Store plaintext passwords in `.env` files (commit risk)
- Use personal staff mailbox passwords (account security risk)
- Share SMTP credentials via email or chat
- Hardcode passwords in source code

### 3. Network Security

✅ **DO**:
- Use port 587 with STARTTLS (recommended by Microsoft)
- Enforce TLS 1.2 minimum
- Use firewall rules to allow only required outbound mail ports

❌ **DON'T**:
- Use unsecured SMTP (port 25 without TLS)
- Disable TLS verification
- Open SMTP to the entire internet (allow only required hosts)

### 4. Audit & Monitoring

✅ **DO**:
- Log all SMTP test sends (audit trail)
- Monitor email delivery/bounce rates
- Set up alerts for SMTP failures
- Review email sending regularly

❌ **DON'T**:
- Send test emails to unknown recipients
- Leave logs with sensitive data unencrypted
- Ignore bounces or delivery failures

---

## Troubleshooting Configuration

### Check Current Configuration

From the application server:

```bash
# Display current SMTP configuration (masks passwords)
echo "SMTP_HOST: ${SMTP_HOST}"
echo "SMTP_PORT: ${SMTP_PORT}"
echo "SMTP_USER: ${SMTP_USER}"
echo "SMTP_PASS: [REDACTED]"
```

### Test SMTP Connection

From the application server:

```bash
# Test port connectivity
telnet smtp.office365.com 587
# Should show: Connected, then type QUIT

# Test DNS resolution
nslookup smtp.office365.com
# Should resolve to Microsoft IP
```

### View Configuration in OyamaCRM

1. Log in as Admin
2. Go to **Settings** → **Organization Settings**
3. Scroll to **Email Provider Settings**
4. Select **Microsoft 365 SMTP**
5. Review current configuration (password is masked)
6. Click **Send SMTP Test** to verify connectivity

---

## Performance Tuning

### Email Queue Worker Defaults

```bash
EMAIL_QUEUE_POLL_MS=15000    # Check for due campaigns every 15 seconds
EMAIL_QUEUE_BATCH_SIZE=10    # Send 10 emails per batch
```

### Optimization Guidelines

| Scenario | POLL_MS | BATCH_SIZE | Rationale |
|----------|---------|-----------|-----------|
| Low volume (<1000 emails/day) | 30000 | 5 | Less frequent polling, smaller batches |
| Medium volume (1000-5000/day) | 15000 | 10 | Default balanced configuration |
| High volume (5000-50000/day) | 5000 | 25 | More frequent polling, larger batches |
| Very high volume (50000+/day) | 5000 | 100 | Aggressive polling, maximum batch |

⚠️ **Note**: Batch size is limited by:
- Microsoft 365 rate limits (~150 emails/min for authenticated SMTP)
- Database transaction capacity
- Server memory

---

## Migration from Standard SMTP to Microsoft 365

If you're switching from another SMTP provider (Gmail, Mailgun, etc.):

### 1. Enable Microsoft 365 SMTP
- Set `SMTP_HOST=smtp.office365.com`
- Set `SMTP_USER=no-reply@yourdomain.com`
- Generate and set `SMTP_PASS` (use App Password if MFA enabled)

### 2. Update Database (if using DB config)
- Go to Settings → Organization Settings
- Select **Email Provider**: **Microsoft 365 SMTP**
- Fill in credentials
- Click **Send SMTP Test**

### 3. Verify Delivery
- Send test emails to ensure they're not being filtered
- Check SPF/DKIM/DMARC records for your domain
- Monitor bounce rates for 24-48 hours

### 4. Disable Old Provider
- Remove old `SMTP_*` environment variables
- Or set them to empty strings if they conflict

---

## Contact & Support

For Microsoft 365-specific issues:
- [Microsoft Support](https://support.microsoft.com/microsoft-365)
- [Exchange Online Troubleshooting](https://learn.microsoft.com/en-us/exchange/troubleshoot/)

For OyamaCRM configuration support:
- Check **Settings** → **Audit Logs** for email sending history
- Review **MICROSOFT_365_SMTP_SETUP.md** for detailed setup guide
- Contact OyamaCRM support with error messages and timestamps
