# Phase 1: Architecture & Environment Setup

## Deployment Topology
The application utilizes **ToolJet (Self-Hosted)** as the frontend/workflow layer and **PostgreSQL (managed via AWS)** as the primary transactional database.

### Connection Architecture
- ToolJet connects to PostgreSQL via an encrypted TLS/SSL connection.
- A dedicated, restricted database user (`tooljet_admin`) is provisioned with exact Table-level permissions to enforce the principle of least privilege.
- A dedicated, restricted database user (`editor`) is provisioned with exact Table-level permissions to enforce the principle of least privilege.

### Query Architecture
- PostgreSQL queries use a strict schema process using variables to reduce server traffic and manage isolated information request.
- All queries use a matrix of the following key variables to determine access and filtering of information in key Postgres queries

| variables     | Schema Property | Type  |
| ------------- |:-------------:| -----:|
| var_selected_gcn|GCN|Num|
| var_selected_SMID|SMID|Num|
| var_selected_lcn|LCN|text |
| var_selected_country| Country|text|
| globals.currentUser.email|Current User|text|
| globals.currentUser.groups|Current User Group|text|
| var_user_country_of_service|Country of Service|text|

## Environment Readiness Checklist
* **PostgreSQL Database URL:** Compiled with safe pooling configuration (e.g., PgBouncer enabled if traffic spikes are expected).
* **ToolJet Environment Variables:** Configured (`TOOLJET_HOST`, `SECRET_ENCRYPTION_KEY`, `LOCKBOX_MASTER_KEY`).
* **Network Firewall Rules:** Set up to allow ToolJet IP white-listing on the Postgres port (`5432`).
