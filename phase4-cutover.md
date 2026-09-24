# Phase 4: Hour-by-Hour Go-Live Cutover Plan

This document governs the exact sequence of events required to transition the ToolJet + Postgres application to the live production environment.

| Time (EST) | Phase / Component | Owner | Action Item | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **08:00 AM** | Database | Data Lead | Take a final manual snapshot of the staging database. | Snapshot confirmed in AWS console. |
| **08:15 AM** | Database | Data Lead | Execute production schema migrations. | CLI returns `Migrations completed successfully`. |
| **08:30 AM** | ToolJet | DevOps | Deploy ToolJet workspace definition via JSON export/import tool or ToolJet CLI. | Dashboard UI visible on production URL. |
| **08:45 AM** | Connectivity | QA Lead | Execute Connection Tests on ToolJet PostgreSQL datasources. | ToolJet connection test button returns green "Success". |
| **09:00 AM** | Smoke Test | Product | Perform user simulation workflows (Create, Read, Update, Delete). | Audit log verifies rows are successfully written to Postgres. |
| **09:30 AM** | Governance | PM | Officially open workspace to Beta Users. | Communication sent via Slack/Email. |

## Rollback Plan (In case of critical failure)
If unexpected errors block user access for >30 minutes during cutover:
1. Teardown production ToolJet instance containers.
2. Revert PostgreSQL schema to previous snapshot state.
3. Redirect production URL to a custom static "Maintenance" holding page hosted on GitHub Pages.
