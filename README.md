# OyamaCRM — Public Application Goals & Product Overview

OyamaCRM is a nonprofit-first CRM platform focused on donor stewardship, fundraising operations, and (planned) compassion/client-care workflows. The product is designed to give nonprofit teams one calm, professional workspace for managing constituents, donations, campaigns, tasks, communications, and operational reporting.

---

## 1) Application Goal

The core goal of OyamaCRM is to help organizations run a complete stewardship loop:

1. Add and organize constituents
2. Record and track donations
3. Trigger follow-up tasks and communication
4. Track campaign performance and retention
5. Use role-based settings and operational dashboards to improve decisions

This aligns the product with real nonprofit day-to-day work, not generic sales CRM patterns.

---

## 2) Product Vision

OyamaCRM is being built as:

- **Modular**: each feature area has its own route and components
- **Professional**: Bloomerang-inspired clean UI with white/gray surfaces and green action accents
- **Expandable**: settings/workspace foundation supports future compassion/client-care modules
- **Operationally practical**: donor, campaign, task, and communication workflows live in one app shell

---

## 3) Current UI Screenshots

> Provided product snapshots (current state):

### Dashboard
![OyamaCRM dashboard screenshot](https://github.com/user-attachments/assets/2fbaaf4c-05ae-42a1-b0ef-ee8dd0d9761b)

### Donations / Operations View
![OyamaCRM donations screenshot](https://github.com/user-attachments/assets/a0a4174f-3e01-4173-967c-c7950b0a99c9)

### Campaigns / Management View
![OyamaCRM campaigns screenshot](https://github.com/user-attachments/assets/2de54f35-cefc-4c1c-b469-6d5c482daffe)

---

## 4) What Is Working Now

- App shell with top navigation + sidebar
- Dashboard widgets (revenue progress, retention, tasks, key metrics)
- Constituents list/detail/edit flows
- Donations list and record-entry flows
- Campaign list/cards and creation flow
- Task management table and completion actions
- Communications and automations modules (foundational)
- Settings foundation with dedicated settings workspace navigation
- Setup detection and onboarding flow (`/setup`) with backend completion enforcement
- Settings → System and Settings → System Status & Feature Readiness pages

---

## 5) What Is In Foundation / In Progress

Based on current planning packets:

- Settings sections are scaffolded; deeper tabs need full data APIs and forms
- Users, roles/scopes, and workspace permission matrix need full implementation
- API response envelope standardization should be completed across server routes
- Route-level workspace + permission enforcement should be completed for all sensitive routes
- Expanded audit logging and retention tooling needs to be finished
- Communications tooling still needs media uploads, merge fields, timeline logging, and provider-backed tracking

---

## 6) Build Phases (High-Level)

1. **Foundation & Auth**
2. **Constituents & Timeline**
3. **Donations, Funds, Campaigns**
4. **Receipts, Tasks, Communications**
5. **Dashboard & Reports**
6. **Groups, Segments, Automation**
7. **Events & Gala**
8. **Security, Integrations, Ops**
9. **Compassion Workspace**

Additional recommended insertion:

- **Phase 00 — Setup, Onboarding, Settings, Workspace Bootstrap**

---

## 7) Local Development

```bash
# install deps
npm install --force

# web app
npm run dev

# web + API
npm run dev:all
```

Open: `http://localhost:3000`

Copy `.env.example` to `.env` and provide a working `DATABASE_URL` before running smoke tests or any Prisma-backed API flows.

### Version & System Status

- API health: `GET /api/health`
- System runtime page: `/settings/system`
- Feature readiness center: `/settings/system-status`

---

## 8) Architecture Snapshot

```text
app/
  components/
    layout/      # App shell pieces (TopBar, Sidebar, AppShell)
    ui/          # Reusable UI primitives
    dashboard/   # Dashboard widgets
    settings/    # Settings navigation + placeholders
  setup/         # First-run onboarding UI foundation
  settings/      # Settings workspace + tab routes
```

---

## 9) Design Direction

- White workspace background
- Light gray card surfaces
- Green-600 (`#16a34a`) as primary action/accent color
- Minimal iconography, no emoji-heavy UI
- Dense but readable data tables and management cards

---

## 10) Next Product Milestones

1. Complete users + roles/scopes management pages
2. Enforce workspace-aware RBAC across backend routes
3. Complete audit logging surface and audit views
4. Expand settings tabs from placeholders into full operational panels
5. Add media uploads, merge fields, and communication history to the email/communications suite
