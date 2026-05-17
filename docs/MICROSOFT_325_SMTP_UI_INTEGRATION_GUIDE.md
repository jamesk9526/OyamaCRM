## Integrating Microsoft 325 SMTP UI Component

This guide explains how to wire the `Microsoft325SmtpSetup` component into the organization settings page.

---

## Current State

**Component Location**: `app/components/settings/Microsoft325SmtpSetup.tsx`  
**Current Status**: Complete and compiled, but not yet integrated into settings UI  
**Integration Point**: `app/settings/organization/page.tsx`

---

## Step 1: Examine Current Settings Page

First, let's understand the current organization settings structure:

```bash
# View the current organization settings page
cat app/settings/organization/page.tsx | head -50
```

Look for:
1. Where SMTP settings are currently displayed (if any)
2. How other settings sections are organized
3. The component structure (is it using tabs, accordion, sections?)
4. Where the update callbacks are handled

---

## Step 2: Find Existing SMTP Section (If Any)

Search for existing SMTP-related code:

```bash
grep -r "smtpHost\|smtp\|SMTP" app/settings/ --include="*.tsx" --include="*.ts"
```

This will show:
- Any existing SMTP configuration UI
- State management for SMTP settings
- Update callbacks and validation

---

## Step 3: Integration Pattern

### Option A: Replace Existing SMTP Section

If there's an existing basic SMTP section:

```tsx
// BEFORE (old simple input fields)
<div>
  <label>SMTP Host</label>
  <input value={smtpHost} onChange={...} />
</div>

// AFTER (replace with Microsoft325SmtpSetup component)
import { Microsoft325SmtpSetup } from "@/components/settings/Microsoft325SmtpSetup";

<Microsoft325SmtpSetup
  smtpHost={settings.smtpHost}
  smtpPort={settings.smtpPort}
  smtpSecure={settings.smtpSecure}
  smtpUser={settings.smtpUser}
  smtpPass={settings.smtpPass}
  smtpFromName={settings.smtpFromName}
  smtpFromEmail={settings.smtpFromEmail}
  onUpdate={handleSettingsUpdate}
  onTestSend={handleTestSend}
  testSendStatus="idle"
  testSendMessage=""
/>
```

### Option B: Add New Email Provider Section

If SMTP settings don't exist yet, add a new section:

```tsx
import { Microsoft325SmtpSetup } from "@/components/settings/Microsoft325SmtpSetup";

export default function OrganizationSettingsPage() {
  const [settings, setSettings] = useState({
    // ... other settings
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFromEmail: "",
    smtpFromName: "",
  });

  const [testSendStatus, setTestSendStatus] = useState("idle");
  const [testSendMessage, setTestSendMessage] = useState("");

  const handleSettingsUpdate = (updatedSettings) => {
    setSettings(prev => ({
      ...prev,
      ...updatedSettings,
    }));
    // Call API to save settings
    saveOrganizationSettings(updatedSettings);
  };

  const handleTestSend = async (testEmail) => {
    setTestSendStatus("loading");
    try {
      const response = await fetch("/api/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testRecipient: testEmail,
          // Include current settings so API can test them
        }),
      });
      
      if (response.ok) {
        setTestSendStatus("success");
        setTestSendMessage("Test email sent successfully!");
      } else {
        const error = await response.json();
        setTestSendStatus("error");
        setTestSendMessage(error.message || "Failed to send test email");
      }
    } catch (error) {
      setTestSendStatus("error");
      setTestSendMessage(error.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Other settings sections above */}
      
      {/* Email Provider Settings Section */}
      <div className="border-t pt-8">
        <h2 className="text-xl font-semibold mb-6">Email Provider</h2>
        
        <Microsoft325SmtpSetup
          smtpHost={settings.smtpHost}
          smtpPort={settings.smtpPort}
          smtpSecure={settings.smtpSecure}
          smtpUser={settings.smtpUser}
          smtpPass={settings.smtpPass}
          smtpFromName={settings.smtpFromName}
          smtpFromEmail={settings.smtpFromEmail}
          onUpdate={handleSettingsUpdate}
          onTestSend={handleTestSend}
          testSendStatus={testSendStatus}
          testSendMessage={testSendMessage}
        />
      </div>
    </div>
  );
}
```

---

## Step 4: API Endpoint Verification

Ensure the required API endpoint exists:

**Endpoint**: `POST /api/settings/smtp/test`

```typescript
// server/src/routes/settings.ts or appropriate location

router.post("/settings/smtp/test", async (req, res) => {
  try {
    const { testRecipient } = req.body;
    
    // Get organization from request context
    const organizationId = await resolveOrganizationId({ req });
    
    // Get current SMTP settings
    const settings = await getOrganizationSmtpSettings(organizationId);
    
    // Create transporter
    const transporter = createSmtpTransport(settings);
    
    // Send test email
    await transporter.sendMail({
      from: `${settings.smtpFromName} <${settings.smtpFromEmail}>`,
      to: testRecipient,
      subject: "OyamaCRM SMTP Test Email",
      html: `<p>This is a test email from OyamaCRM.</p>
             <p>If you received this, SMTP configuration is working correctly.</p>`,
    });
    
    // Log audit event
    await logAudit({
      action: "SMTP_TEST_SENT",
      organizationId,
      userId: req.user?.id,
      metadata: { recipient: testRecipient },
    });
    
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## Step 5: Component Props Reference

The `Microsoft325SmtpSetup` component expects these props:

```typescript
interface Microsoft325SmtpSetupProps {
  // Current settings
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpFromEmail: string;
  
  // Callbacks
  onUpdate: (settings: Partial<SmtpSettings>) => void;
  onTestSend: (recipient: string) => Promise<void>;
  
  // Test email status
  testSendStatus: "idle" | "loading" | "success" | "error";
  testSendMessage: string;
}
```

---

## Step 6: Save Settings Implementation

Add the settings save API if not already present:

```typescript
// server/src/routes/settings.ts

router.post("/settings/organization", async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromName, smtpFromEmail } = req.body;
    const organizationId = await resolveOrganizationId({ req });
    
    // Encrypt password before storing
    let encryptedPass = smtpPass;
    if (smtpPass && !smtpPass.startsWith("iv:")) {
      // Only encrypt if not already encrypted
      const { encryptCredential } = require("@/services/credential-encryption");
      encryptedPass = encryptCredential(smtpPass);
    }
    
    // Update organization settings in database
    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        smtpHost: smtpHost || null,
        smtpPort: smtpPort || null,
        smtpSecure: smtpSecure || false,
        smtpUser: smtpUser || null,
        smtpPass: encryptedPass || null,
        smtpFromName: smtpFromName || null,
        smtpFromEmail: smtpFromEmail || null,
      },
    });
    
    // Log audit event
    await logAudit({
      action: "ORGANIZATION_SMTP_UPDATED",
      organizationId,
      userId: req.user?.id,
      metadata: {
        changes: ["smtpHost", "smtpPort", "smtpUser", "smtpFromEmail"],
      },
    });
    
    res.json({ success: true, data: updatedOrg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Step 7: Testing Integration

After integrating the component:

### 1. Type Checking

```bash
pnpm typecheck
```

Should pass with no errors.

### 2. Build

```bash
pnpm build
```

Should succeed.

### 3. Run Locally

```bash
pnpm dev
```

Navigate to **Settings** → **Organization Settings** and verify:
- [ ] Component renders without errors
- [ ] All input fields display correctly
- [ ] Placeholder text is visible
- [ ] "Send SMTP Test" button works
- [ ] Test status messages display

### 4. Manual Testing

1. **Credentials Section**:
   - Enter test email: `no-reply@yourdomain.com`
   - Enter test password: (from Microsoft 365 app password)
   - Enter from name: `"Test Org"`
   - Verify all fields save correctly

2. **Advanced Section**:
   - Verify SMTP host defaults to `smtp.office365.com`
   - Verify port defaults to `587`
   - Toggle "Force SMTPS" and verify port/secure update

3. **Test Email**:
   - Enter test recipient email
   - Click "Send SMTP Test"
   - Verify test email is received
   - Check that sender address is correct

4. **Help Section**:
   - Verify troubleshooting content is readable
   - Verify links to Microsoft docs work

---

## Step 8: Styling & Layout

The component uses Tailwind CSS. If your organization settings page uses a different styling approach:

### If Using Bootstrap

You'll need to wrap the component in a CSS module or create a styled wrapper:

```tsx
<div className="ms-bootstrap-wrapper">
  <Microsoft325SmtpSetup {...props} />
</div>
```

And add CSS:

```css
.ms-bootstrap-wrapper {
  /* Convert Tailwind classes to Bootstrap */
  --tw-colors: var(--bs-colors);
}
```

### If Using CSS Modules

Modify the component to accept an optional `className` prop for section wrappers.

---

## Step 9: Accessibility Review

Before shipping, verify:

- [ ] All input fields have associated labels
- [ ] Tab order is logical (left to right, top to bottom)
- [ ] Error messages are linked to form fields
- [ ] Button text is clear and descriptive
- [ ] Status messages use aria-live for screen readers

---

## Step 10: Documentation Updates

After integrating, update:

1. **In AGENT.md / CLAUDE.md** (this repo's agent instructions):
   - Add note that Microsoft 325 SMTP component is integrated in organization settings
   - Reference `docs/MICROSOFT_325_SMTP_SETUP.md` for configuration

2. **In docs/HOW_TO_USE.md** (user-facing docs):
   - Add section: "Configuring Email Sending (Microsoft 365)"
   - Reference the UI component in settings
   - Link to `docs/MICROSOFT_325_SMTP_SETUP.md` for detailed setup

3. **In docs/status/features.md**:
   - Mark "Microsoft 365 SMTP" as "Working"
   - Note: "Full UI integration, credential encryption, production-ready"

---

## Troubleshooting Integration

### Issue: Component doesn't import

```
Cannot find module '@/components/settings/Microsoft325SmtpSetup'
```

**Solution**: Check file path spelling:
```bash
ls -la app/components/settings/ | grep -i microsoft
```

Should show: `Microsoft325SmtpSetup.tsx`

### Issue: Props type error

```
Property 'smtpPass' is not assignable to type 'string | undefined'
```

**Solution**: Ensure all props are provided or set default values:

```tsx
<Microsoft325SmtpSetup
  smtpHost={settings.smtpHost || ""}
  smtpUser={settings.smtpUser || ""}
  // etc.
/>
```

### Issue: Test send returns 404

```
POST /api/settings/smtp/test 404 Not Found
```

**Solution**: Verify API endpoint exists in `server/src/routes/settings.ts`:

```bash
grep -n "POST.*smtp.*test\|router.post.*smtp" server/src/routes/settings.ts
```

If not found, add the endpoint (see Step 4 above).

---

## Summary

Integration checklist:

1. [ ] Import component in settings page
2. [ ] Add component to JSX with all required props
3. [ ] Implement `onUpdate` callback to save settings
4. [ ] Implement `onTestSend` callback for test email
5. [ ] Verify API endpoints exist (`/api/settings/smtp/test`, `/api/settings/organization`)
6. [ ] Run type checking (`pnpm typecheck`)
7. [ ] Build (`pnpm build`)
8. [ ] Test locally (`pnpm dev`)
9. [ ] Manual testing (enter credentials, send test, verify receipt)
10. [ ] Update documentation

**Estimated time**: 30-45 minutes for a developer familiar with the codebase
