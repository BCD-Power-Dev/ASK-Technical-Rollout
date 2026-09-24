# Phase 2: PostgreSQL Schema Control & Migration Strategy

## Schema Version Control
All database schema mutations (DDL changes) are handled outside of ToolJet using a migration framework (e.g., **dbmate**, **Flyway**, or **Prisma Migrations**). 

### Migration Execution Workflow
1. **Local Development:** Schema modifications are tested against a local Dockerized Postgres instance.
2. **Staging / Testing:** Migrations run automatically via a GitHub Actions CI/CD pipeline on push to the `staging` branch.
3. **Production Rollout:** Migrations run sequentially *before* the ToolJet frontend updates are released.

```sql
-- Example Schema Migration (001_init_saas_schema.sql)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
