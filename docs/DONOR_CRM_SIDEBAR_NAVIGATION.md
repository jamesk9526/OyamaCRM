# DonorCRM Sidebar Navigation

Last updated: 2026-05-12

This document is the donor-specific view of the shared CRM sidebar architecture.

Shared architecture reference: [docs/CRM_SIDEBAR_NAVIGATION.md](docs/CRM_SIDEBAR_NAVIGATION.md)

## Donor Information Architecture

- Fundraising
- Engagement Workspace
- Communication Tools
- Insights
- People
- System

## Donor Group Targets

- Fundraising: dashboard and core fundraising records
- Engagement Workspace: staff actions and stewardship execution
- Communication Tools: letters, live interactions, and outreach tooling
- Insights: reports and signal review surfaces
- People: volunteer relationship workspace
- System: setup, data quality, fields, settings, and help

## Canonical Config Source

- [app/components/layout/sidebar-configs.tsx](app/components/layout/sidebar-configs.tsx)

Donor-specific group builder:

- `buildDonorSidebarGroups`

## Change Rules

- Keep route href values stable unless a migration plan exists.
- Keep system/admin items in the System group unless formally moved.
- Keep badges sparse and meaningful.
- Update this file and the shared sidebar doc whenever donor IA changes.
