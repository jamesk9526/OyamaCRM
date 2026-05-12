<div align="center">

<img src="https://img.shields.io/badge/OyamaCRM-v0.3.0-16a34a?style=for-the-badge&logoColor=white" alt="OyamaCRM v0.3.0" height="40">

# OyamaCRM

### A real, powerful, open-source CRM built for nonprofits — free forever.

**DonorCRM** · **OyamaCompassion** · **OyamaEvents** · **OyamaWatchdog** · **OyamaWebMaster**

<br>

[![Version](https://img.shields.io/badge/version-0.3.0-16a34a?style=flat-square)](package.json)
[![License: Free Forever](https://img.shields.io/badge/License-Free%20Forever%20(Self--Hosted)-16a34a?style=flat-square)](#-license)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Express API](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Prisma ORM](https://img.shields.io/badge/Prisma-MySQL-2D3748?style=flat-square&logo=prisma)](https://prisma.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)

</div>

---

## Why OyamaCRM Exists

Commercial nonprofit CRM platforms often charge **$10,000 – $30,000+ per year** in licensing fees — before you add email integrations, donor portals, event ticketing, or case management. That pricing model locks out small and mid-size nonprofits who need these tools the most.

**OyamaCRM is built on a simple belief:** every nonprofit, regardless of budget, deserves professional-grade donor management, case management, event coordination, and communications tooling — without a five-figure annual bill.

This is a full-stack, self-hosted, open-source platform. If you run it on your own server, **it costs you nothing. Ever.**

---

## What's Inside

OyamaCRM is **one platform with five integrated modules**, each purpose-built for a specific function of a modern nonprofit:

| Module | Purpose | Status |
|--------|---------|--------|
| **DonorCRM** | Donor stewardship, fundraising, campaigns, giving history | ✅ Active |
| **OyamaCompassion** | Client case management, care plans, appointments | ✅ Active |
| **OyamaEvents** | Gala & event management, ticketing, check-in | ✅ Active |
| **OyamaWatchdog** | Security monitoring, audit logs, incident workflow | ✅ Active |
| **OyamaWebMaster** | Visual website builder, CMS, publishing | 🔨 In Development |

---

## 📸 Screenshots

### Authentication
![Login](README_SCREENSHOTS/01-login.png)

### DonorCRM Module

#### Dashboard — Fundraising & Stewardship Overview
![DonorCRM Dashboard](README_SCREENSHOTS/02-donor-dashboard.png)

#### Constituents — Donor Management & Profiles
![Constituents](README_SCREENSHOTS/03-constituents.png)

#### Donations — Gift Entry, Ledger & Receipt Generation
![Donations](README_SCREENSHOTS/04-donations.png)

#### Campaigns — Fundraising Campaigns & Goal Tracking
![Campaigns](README_SCREENSHOTS/05-campaigns.png)

#### Grants — Grant Pipeline & Funder Management
![Grants](README_SCREENSHOTS/06-grants.png)

#### Tasks — Stewardship Workflow & Due Dates
![Tasks](README_SCREENSHOTS/07-tasks.png)

#### Meetings — Donor Engagement & Meeting Tracking
![Meetings](README_SCREENSHOTS/08-meetings.png)

#### Communications — Email Campaigns & Outreach
![Communications](README_SCREENSHOTS/09-communications.png)

#### Steward Signals — Intelligent Donor Alerts
![Steward Signals](README_SCREENSHOTS/10-steward-signals.png)

#### Volunteers — Volunteer Management & Engagement
![Volunteers](README_SCREENSHOTS/11-volunteers.png)

#### Reports — Analytics, Dashboards & Exports
![Reports](README_SCREENSHOTS/12-reports.png)

### Data Tools
#### CSV Import Wizard — Bulk Donor & Donation Import
![Data Import](README_SCREENSHOTS/13-data-import.png)

### OyamaEvents Module — Gala & Event Management
![Events](README_SCREENSHOTS/14-events.png)

### OyamaCompassion Module — Client Care Management
![Compassion Dashboard](README_SCREENSHOTS/15-compassion-dashboard.png)

#### Client Profiles & Care Records
![Compassion Clients](README_SCREENSHOTS/16-compassion-clients.png)

### OyamaWatchdog Module — Security & Compliance
![Watchdog Security Feed](README_SCREENSHOTS/17-watchdog.png)

### OyamaWebMaster Module — Visual Website Builder
![WebMaster Dashboard](README_SCREENSHOTS/18-webmaster.png)

### Administration
![Settings & User Management](README_SCREENSHOTS/19-settings.png)

---

## 🟢 DonorCRM — Fundraising & Donor Stewardship

> A calm, professional workspace for managing constituents, donations, campaigns, tasks, and retention — built specifically for nonprofits, not adapted from a generic sales CRM.

<details>
<summary><strong>Full Feature List</strong></summary>

### Dashboard
- Revenue progress ring with YTD goal tracking
- Donor retention rate widget with trend indicator
- Tasks due today / overdue summary
- Total giving by donor level (Major, Mid, General, Lapsed) as bar chart
- Recent donations live feed
- Steward signals — donors who may need attention soon
- Real-time refresh, filterable date ranges

### Constituents
- Full donor profiles: name, address, phone, email, employer, household
- Giving history with date, amount, fund, campaign, and payment method
- Engagement timeline (donations, notes, communications, tasks)
- Household relationships (link spouses, family members)
- Donor status tracking: Active, Lapsed, Major Donor, Prospect
- Segment tags, custom fields, communication preferences
- Inline notes with staff attribution

### Donations
- One-time and recurring gift entry
- Pledge management with scheduled installments
- Batch entry for high-volume gift processing
- Payment methods: check, credit card, ACH, stock, in-kind, planned gift
- Fund allocation with split-gift support
- Receipt generation (PDF-ready)
- Soft credits and tribute/memorial gifts
- Automatic lapse/reactivation classification

### Campaigns
- Goal tracking with progress bars and thermometer views
- Multi-channel campaigns (email, mail, phone, event)
- Peer-to-peer fundraising support
- Matching gift tracking
- Campaign performance reports: response rate, average gift, ROI
- Segmented asks by giving level

### Communications
- HTML email builder with reusable templates
- Segmented audience targeting
- Campaign scheduling and send queue
- Delivery event tracking: sent, opened, clicked, bounced, unsubscribed
- Automation rules: thank-you sequences, pledge reminders, lapse recovery
- Full send log per campaign per constituent

### Tasks
- Stewardship task assignment with due dates and priority
- Task types: call, email, meeting, note, cultivation, proposal
- Templates for common workflows (e.g., major gift cultivation steps)
- Overdue alerts and digest views
- Staff assignment and reassignment
- Dashboard widget for daily task focus

### Reports
- Year-over-year giving comparison
- Donor retention rate by cohort
- Giving trends over custom date ranges
- Campaign performance summary
- Fund allocation breakdown
- Exportable to CSV

### Data Tools
- CSV import wizard with visual field mapping
- Duplicate detection before import (name + email matching)
- Dry-run mode: see what will be created/updated before committing
- Merge workflow for confirmed duplicates
- Import history log

</details>

---

## 🔵 OyamaCompassion — Client Care & Case Management

> A dedicated workspace for social service teams — fully separated from donor data with its own permissions, sidebar, and blue-themed UI.

<details>
<summary><strong>Full Feature List</strong></summary>

### Dashboard
- Caseload summary: open cases, new intakes, appointments today
- Staff capacity indicators
- Follow-up alerts and overdue action items
- Case activity feed

### Clients
- Confidential client profiles: demographics, contact info, household members
- Service history and program enrollment
- Intake and eligibility screening records
- Crisis flags and special needs notations
- **Strict data boundary** — never visible in DonorCRM

### Cases
- Case types: crisis support, ongoing services, follow-up
- Status lifecycle: intake → active → closed → archived
- Staff assignment and multi-worker support
- Case notes with timestamps and staff attribution
- Service referrals to partner organizations

### Assessments
- Standardized intake assessments
- Custom field support for organization-specific screening
- Assessment history per client

### Care Plans
- Goal-based care planning
- Action items with responsible parties and due dates
- Progress tracking and milestone notes

### Appointments
- Shared source-of-truth scheduling across staff workspace and public booking widget
- Calendar workspace with Day, Week, Month, and Agenda views
- List workspace with search, sorting, filters, and quick status actions
- Drag-and-drop and resize rescheduling with conflict checks
- Appointment notes, outcomes, and follow-up flags

### Activities & Follow-Ups
- Activity log per case (call, visit, referral, service delivery)
- Follow-up task scheduling
- Recurring check-in reminders

### Reports
- Active caseload summary
- Service delivery statistics
- Outcome tracking and program effectiveness metrics

</details>

---

## 🟡 OyamaEvents — Gala & Event Management

> Professional event management for fundraising galas, community events, volunteer days, and donor cultivation experiences.

<details>
<summary><strong>Full Feature List</strong></summary>

| Area | What's Included |
|------|----------------|
| **Event Command Center** | Dashboard for all events: upcoming, in-progress, past |
| **Event Setup** | Name, date, venue, capacity, ticket tiers, sponsorship levels |
| **Guest Registry** | Registration management, dietary needs, seating preferences |
| **Ticketing** | Ticket types, pricing, comp tickets, revenue tracking |
| **Sponsorships** | Sponsor packages, payment tracking, recognition tiers |
| **Check-In** | Day-of digital check-in with badge printing support |
| **Gala Tables** | Table assignment tool with drag-and-drop seating |
| **Volunteers** | Volunteer registration, role assignment, shift scheduling |
| **Auction** | Auction item catalog, bidding records, winner management |
| **Reports** | Revenue vs. goal, attendance rate, ticket breakdown |

</details>

---

## 🔴 OyamaWatchdog — Security & Compliance

> Always-on security monitoring, audit logging, and incident response tooling — built into the platform so you never have to wonder what happened.

<details>
<summary><strong>Full Feature List</strong></summary>

### Security Feed
- Real-time security event stream: logins, permission changes, data exports, failed auth attempts
- Severity levels: Info, Warning, Critical
- Merge of internal audit events and external watchdog events

### Incident Workflow
- **Acknowledge** — Assign ownership to an incident
- **Escalate** — Mark as high-priority for leadership review
- **Resolve** — Close incident with resolution notes
- Full state history per incident

### Encrypted Vault
- Secure storage for sensitive credentials and configuration values
- AES-256 encryption at rest
- Role-gated access (`vault:read`, `vault:write`, `vault:delete`)
- Audit log of every vault access

### Permission Management
- Per-user Watchdog permission overrides in Settings > User Management
- Granular scopes: `watchdog:view_dashboard`, `watchdog:view_logs`, `watchdog:vault:read/write/delete`, `watchdog:incident:acknowledge/escalate/resolve`
- Permission changes are themselves audited

### Audit Logs
- Immutable audit trail for all data mutations
- User, timestamp, action, affected record
- Exportable for compliance reporting

</details>

---

## 🌐 OyamaWebMaster — Visual Website Builder *(In Development)*

> A modular visual website builder built directly into your CRM — so your donation forms, event pages, and public-facing content all connect to live CRM data.

<details>
<summary><strong>Current State & Roadmap</strong></summary>

### Available Now (Phase 1–3)
- Site management dashboard: create and manage multiple websites
- Visual builder shell with section palette, canvas, inspector, and status bar
- 9 built-in section types: Header, Hero, Split Image+Text, Text Block, Card Grid, CTA, FAQ, Contact, Footer
- Device preview modes (desktop, tablet, mobile)
- Undo/redo, save/load page content to database
- Persistent sites and pages backed by MySQL
- Module sidebar: Dashboard, Builder, Templates, CMS, Assets, Forms, Site Settings

### Roadmap (Phase 4–8)
- Full section block editing (text, images, buttons, embeds)
- Template library (full-site and page-level)
- Brand kit (colors, fonts, logo)
- CMS Collections (blog posts, team members, custom content types)
- Form builder with CRM field mapping
- Asset library
- Static ZIP export (HTML/CSS/JS/assets)
- Publishing targets: SFTP, Git-based deploy
- Preflight engine: broken links, missing alt text, missing SEO fields
- Native donation form integration with DonorCRM

</details>

---

## 🏗️ Architecture

```
OyamaCRM/
├── app/                          # Next.js 16 (App Router) frontend
│   ├── page.tsx                  # DonorCRM dashboard
│   ├── constituents/             # Donor/constituent management
│   ├── donations/                # Gift entry & ledger
│   ├── campaigns/                # Fundraising campaigns
│   ├── communications/           # Email campaigns & outreach
│   ├── tasks/                    # Stewardship task management
│   ├── reports/                  # Analytics & reports
│   ├── events/                   # OyamaEvents module
│   ├── compassion/               # OyamaCompassion (blue workspace)
│   ├── watchdog/                 # OyamaWatchdog security module
│   ├── webmaster/                # OyamaWebMaster builder module
│   ├── data-tools/               # CSV import wizard
│   ├── settings/                 # Admin settings & user management
│   ├── setup/                    # First-run onboarding wizard
│   ├── components/               # All shared & module UI components
│   │   ├── layout/               # AppShell, Sidebars, TopBar
│   │   ├── dashboard/            # DonorCRM widgets
│   │   ├── watchdog/             # Watchdog feed & dashboard
│   │   ├── webmaster/            # WebMaster builder UI
│   │   ├── settings/             # Settings panels
│   │   └── ui/                   # Primitive components
│   ├── modules/                  # Canonical domain schemas & registries
│   │   └── webmaster/            # Schema, section registry, module status
│   └── lib/                      # Shared utilities (auth, fetcher, hooks)
│
├── server/src/                   # Express 5 API (TypeScript)
│   ├── index.ts                  # App bootstrap, CORS, route mounting
│   └── routes/                   # REST endpoints
│       ├── auth.ts               # Login, refresh, logout
│       ├── constituents.ts       # Donor CRUD
│       ├── donations.ts          # Gift entry, pledges
│       ├── campaigns.ts          # Campaign management
│       ├── email-campaigns.ts    # Email campaign delivery
│       ├── notifications.ts      # In-app notifications
│       ├── reports.ts            # Analytics queries
│       ├── search.ts             # Global search
│       ├── watchdog.ts           # Security API
│       └── webmaster.ts          # WebMaster sites/pages API
│   └── services/
│       ├── watchdog-store.ts     # Encrypted vault & incident state
│       └── webmaster-store.ts    # SQL-backed site/page persistence
│
├── prisma/                       # Database layer
│   ├── schema.prisma             # Full MySQL schema
│   ├── seed.ts                   # Demo data seeder (small/medium/large)
│   └── migrations/               # Migration history
│
└── tests/
    ├── smoke/                    # API smoke tests
    └── unit/                     # Unit tests
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| **Backend** | Express 5, TypeScript, tsx watch |
| **Database** | MySQL via Prisma ORM |
| **Auth** | JWT access tokens + HttpOnly refresh cookie |
| **Drag & Drop** | @dnd-kit/core, @dnd-kit/sortable |
| **Testing** | Vitest, smoke tests |
| **Process Management** | PM2 (production) |
| **Package Manager** | pnpm |

### Security Architecture

- JWT short-lived access tokens (15 min) + rotating refresh cookies (7 days)
- bcrypt password hashing (12 rounds)
- Express rate limiting on all endpoints
- CORS restricted to configured frontend origins
- Role-based access control: `admin`, `staff`, `readonly`
- Per-user permission overrides for fine-grained access
- AES-256 encrypted credential vault (Watchdog)
- Immutable audit log for all data mutations

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8+ (or PlanetScale, Railway, etc.)
- pnpm (`npm install -g pnpm`)

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/OyamaCRM.git
cd OyamaCRM
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL="mysql://user:password@localhost:3306/oyamacrm"
JWT_SECRET="your-long-random-secret"
REFRESH_SECRET="another-long-random-secret"
API_PORT=4000
FRONTEND_ORIGIN=http://localhost:3001

# Optional
WATCHDOG_DATABASE_URL="mysql://user:password@localhost:3306/oyama_watchdog"
SENDGRID_API_KEY=
```

### 3. Initialize Database

```bash
pnpm db:migrate        # Apply existing migrations (safe for production)
pnpm db:seed:small     # Seed with demo data
```

### 4. Start Development

```bash
pnpm dev:all           # Starts API (port 4000) + Web (port 3001)
```

Open **http://localhost:3001** — first run launches the setup wizard.

**Dev credentials after seeding:**

| Email | Password | Role |
|-------|---------|------|
| `admin@hopefoundation.org` | `admin123!` | Admin |
| `james@hopefoundation.org` | `staff123!` | Staff |

---

## 🔧 Useful Commands

```bash
# Development
pnpm dev:all              # Start everything
pnpm dev:api              # API only (port 4000)
pnpm dev:web              # Web only (port 3001)

# Database
pnpm db:migrate           # Apply existing migrations (safe for production)
pnpm db:migrate:dev       # Create/apply a new migration during local development
pnpm db:push              # Push schema without migration files
pnpm db:seed:small        # ~50 donors
pnpm db:seed:medium       # ~200 donors
pnpm db:seed:large        # ~500 donors
pnpm db:verify:demo       # Verify seed integrity
pnpm db:reset:demo        # Full reset + re-seed
pnpm db:studio            # Open Prisma Studio

# Testing
pnpm test                 # All tests
pnpm test:smoke           # API smoke tests only
pnpm test:coverage        # Coverage report

# Production (PM2)
pnpm db:verify:linux-casing
pnpm db:migrate
pnpm build && pnpm build:server
pnpm pm2:start
pnpm pm2:status
pnpm pm2:logs

# Screenshots
node scripts/take-screenshots.mjs   # Regenerate README screenshots
```

### Ubuntu VPS Production Runbook

Use this flow on Ubuntu so Prisma migrations and Linux table-name rules do not break production deploys.

1. Pull latest code and install dependencies

    pnpm install --frozen-lockfile

2. Verify migration SQL is Linux-safe

    pnpm db:verify:linux-casing

3. If Prisma reports a failed migration (P3018), mark it rolled back once, then retry deploy

    pnpm prisma migrate resolve --rolled-back 20260509051734_expand_events_data_model

4. Apply migrations in production mode (never use migrate dev on VPS)

    pnpm db:migrate

5. Build and restart processes

    pnpm build
    pnpm build:server
    pnpm pm2:restart
    pnpm pm2:status

If you still see Table 'oyamacrm.activity' doesn't exist, your VPS checkout is stale.
Confirm this exact line is present in [prisma/migrations/20260509051734_expand_events_data_model/migration.sql](prisma/migrations/20260509051734_expand_events_data_model/migration.sql#L2):

ALTER TABLE `Activity` ADD COLUMN `eventId` VARCHAR(191) NULL;

### Percona 8 (Ubuntu) Database Preflight

OyamaCRM is compatible with Percona Server 8.0.x (MySQL protocol), including your current version 8.0.36.

Before running migrations on Ubuntu, verify these database settings and privileges:

1. Confirm server variables

    SHOW VARIABLES LIKE 'version';
    SHOW VARIABLES LIKE 'lower_case_table_names';
    SHOW VARIABLES LIKE 'character_set_server';
    SHOW VARIABLES LIKE 'collation_server';

2. Required expectations

    - lower_case_table_names should be 0 on Linux (case-sensitive table names).
    - character_set_server should be utf8mb4.
    - collation_server should be utf8mb4_0900_ai_ci or another utf8mb4 collation.

3. Confirm app user grants

    SHOW GRANTS FOR 'oyamacrm'@'localhost';

    Minimum recommended grants on the app database:

    GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON oyamacrm.* TO 'oyamacrm'@'localhost';
    FLUSH PRIVILEGES;

4. Use production migration mode only

    - Use pnpm db:migrate (prisma migrate deploy).
    - Do not use prisma migrate dev on VPS, because it needs shadow-database create permissions.

5. If a migration fails with P3018

    pnpm prisma migrate resolve --rolled-back <failed_migration_name>
    pnpm db:migrate

---

## 🗺️ Roadmap

### ✅ Completed
- App shell, auth, JWT refresh flow, onboarding wizard
- DonorCRM: constituents, donations, campaigns, communications, tasks, reports, data tools
- OyamaCompassion: dashboard, clients, cases, client profile workspace, and production appointment scheduling hub
- OyamaEvents: command center, guests, check-in, ticketing, gala tables
- OyamaWatchdog: security feed, audit logs, encrypted vault, incident workflow, permission management
- OyamaWebMaster Phase 1–3: real dashboard, visual builder, section registry, persistent storage
- Settings: user management, role assignment, permission overrides, system status

### 🔨 In Progress
- OyamaWebMaster Phase 4: section block editing, template library
- OyamaWebMaster Phase 5: brand kit, CMS collections, forms
- Full RBAC enforcement across all routes
- Email provider integration (SendGrid / Mailgun)

### 📋 Planned
- OyamaWebMaster Phase 6–8: asset library, static ZIP export, publishing
- AI-assisted donor insights (StewardAI — self-hosted LLM support)
- Mobile-responsive layouts
- Public donation forms / giving pages
- QuickBooks Online sync
- Multi-organization support

---

## 💚 Support This Project

### Nonprofits Deserve Better. Help Us Build It.

There are over **1.8 million registered nonprofits** in the United States alone. The vast majority are small organizations — food pantries, pregnancy care centers, community clinics, shelters, youth programs — doing critical work with tiny budgets. Many are stuck using spreadsheets, or paying five-figure annual fees to platforms that weren't built for them.

**OyamaCRM is the answer.**

A full-featured, professional CRM covering donor management, case management, events, security monitoring, and a visual website builder — **all in one platform, at zero license cost** for self-hosted organizations.

But building and maintaining this takes real time and real effort. If OyamaCRM saves your organization money, empowers your team to do more, or gives you tools you can actually afford — **please consider giving back.**

---

### 💰 Donate

Every dollar directly funds development time, infrastructure costs, and keeping this project alive and growing.

> **☕ Ko-fi** — coming soon  
> **❤️ GitHub Sponsors** — coming soon  
> **💳 PayPal** — coming soon

*(Donation links will be published once accounts are finalized. Watch this README for updates.)*

---

### 🛠️ Contribute Code

If you're a developer, this project needs you.

**High-impact areas right now:**
- OyamaWebMaster Phase 4: section block editing, template library
- RBAC enforcement improvements
- Email provider integrations (SendGrid, Mailgun, Postmark)
- Mobile-responsive layout passes
- Compassion CRM remaining care-domain workflows (care plans, assessments, medical/referrals)
- Test coverage improvements

**How to contribute:**
1. Fork the repository
2. `git checkout -b feature/your-feature-name`
3. Make your changes — keep PRs focused
4. Write or update tests where applicable
5. Open a pull request with a clear description

Read [AGENTS.md](AGENTS.md) for codebase conventions and architecture notes.

---

### 📣 Spread the Word

- ⭐ **Star this repo on GitHub**
- Share with nonprofit technology groups, board members, and volunteer developers
- Recommend it to organizations paying too much for donor software
- Write about your experience using or contributing to it

---

### 🐛 Report Issues

Found a bug? [Open an issue on GitHub](https://github.com/YOUR_USERNAME/OyamaCRM/issues) with steps to reproduce. Clear bug reports are a genuine contribution to the project.

---

> *Every nonprofit deserves the tools to do their best work. OyamaCRM is our contribution to that mission. We hope you'll join us.*

---

## 📋 License

OyamaCRM is **free forever** for self-hosted use:

| Use Case | Free? |
|---------|-------|
| Self-hosted nonprofit use | ✅ **Free forever** |
| Development, testing, evaluation | ✅ **Free forever** |
| Self-hosted with local AI/LLM features | ✅ **Free forever** |
| Commercial SaaS redistribution | ❌ Contact us |

The promise: if you run OyamaCRM on your own server, you will never pay a license fee. Ever.

---

<div align="center">

**Built for nonprofits, by people who care about the mission. 💚**

*If this project helps your organization, please consider [supporting it](#-support-this-project).*

</div>
