# Oyama CRM

A modern, modular nonprofit donor management and fundraising platform built with Next.js 16, inspired by Bloomerang and NeonCRM.

## Overview

Oyama CRM helps nonprofits manage constituents (donors, volunteers, members), track donations, run fundraising campaigns, and measure impact. Built with a focus on modularity, maintainability, and nonprofit-specific workflows.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Package Manager**: pnpm
- **Process Manager**: PM2 (cluster mode)
- **Runtime**: Node.js

## Getting Started

### Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Or use PM2 cluster mode
pnpm pm2:start
pnpm pm2:logs
pnpm pm2:status
```

## Project Structure

```
app/
├── components/
│   ├── layout/           # AppShell, TopBar, Sidebar
│   ├── ui/               # Reusable primitives (Card, CircularProgress)
│   └── dashboard/        # Dashboard-specific widgets
├── page.tsx              # Home/Dashboard page
└── layout.tsx            # Root layout with AppShell
```

## Key Features (Planned)

### Core Modules
- **Constituents** - Donor/volunteer profiles, households, engagement tracking
- **Donations** - One-time/recurring gifts, pledges, in-kind donations, receipts
- **Campaigns** - Fundraising goals, progress tracking, multi-channel outreach
- **Tasks** - Stewardship workflows, follow-ups, assignments
- **Reports** - Revenue analytics, donor retention, giving trends
- **Communications** - Email campaigns, templates, segmentation
- **Events** - Registration, ticketing, check-in
- **Volunteers** - Opportunity posting, hour logging

### Current Implementation
✅ Modular app shell (TopBar + Sidebar + main content)  
✅ Dashboard with sample widgets:
  - Revenue Progress (circular chart, goal tracking)
  - Donor Retention metrics
  - Tasks panel (due soon/later)
  - Totals by Level (weekly summary)  
✅ White + green-600 theme (Bloomerang-inspired)  
✅ Nonprofit-specific navigation (Constituents, Donations, Campaigns, etc.)

## Architecture Guidelines

See [AGENTS.md](AGENTS.md) for detailed conventions on:
- Modular component architecture
- Nonprofit CRM domain concepts
- Server/Client Component boundaries
- Theme and design patterns
- Data modeling for nonprofit workflows

## Scripts

```bash
pnpm dev           # Development server
pnpm build         # Production build
pnpm start         # Production server
pnpm lint          # Run ESLint
pnpm pm2:start     # Start PM2 cluster
pnpm pm2:stop      # Stop PM2
pnpm pm2:reload    # Zero-downtime reload
pnpm pm2:logs      # View PM2 logs
```

## License

Private - Internal Use Only
