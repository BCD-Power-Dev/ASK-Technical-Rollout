# Phase 1: Architecture & Environment Setup

## Deployment Topology
The application utilizes **ToolJet (Self-Hosted/Cloud)** as the frontend/workflow layer and **PostgreSQL (managed via AWS RDS or Supabase)** as the primary transactional database.

### Connection Architecture
- ToolJet connects to PostgreSQL via an encrypted TLS/SSL connection.
- A dedicated, restricted database user (`tooljet_runner`) is provisioned with exact Table-level permissions to enforce the principle of least privilege.

## Environment Readiness Checklist
* **PostgreSQL Database URL:** Compiled with safe pooling configuration (e.g., PgBouncer enabled if traffic spikes are expected).
* **ToolJet Environment Variables:** Configured (`TOOLJET_HOST`, `SECRET_ENCRYPTION_KEY`, `LOCKBOX_MASTER_KEY`).
* **Network Firewall Rules:** Set up to allow ToolJet IP white-listing on the Postgres port (`5432`).
