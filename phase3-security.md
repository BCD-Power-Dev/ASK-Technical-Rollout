# Phase 3: Security & Role-Based Access Control (RBAC)

## User Authentication
- SSO Integration configured in ToolJet via **OAuth2 / Google Workspace / Okta**.
- Auto-provisioning maps organization domains to default restricted groups.

## ToolJet Group to Postgres Row-Level Security Matrix
To prevent multi-tenant data leaks, ToolJet queries append the active user's `global.user.email` or `tenant_id` context to every database execution.

| ToolJet User Group | View Access | Edit Access | Postgres Constraints Applied |
| :--- | :--- | :--- | :--- |
| **Super Admin** | All Tables | All Tables | None |
| **Tenant Administrator** | Tenant Workspace | Tenant Configuration | `WHERE tenant_id = current_tenant()` |
| **End User** | Assigned Module | Assigned Records Only | Row-Level Security (RLS) policies enforced |
