# Phase 3: Security & Role-Based Access Control (RBAC)

## User Authentication
- ** SSO Integration configured in ToolJet via **OAuth2 / User Profile Creation /**.
- Manual import from existing user group (AD) > user_profiles table with managed profile QA by designated managers

## ToolJet Group to Postgres Row-Level Security Matrix
To prevent multi-tenant data leaks, ToolJet queries append the active user's `global.user.email` for general user access, separate user group for editor and local admin.

| ToolJet User Group | View Access | Edit Access | Postgres Constraints Applied |
| :--- | :--- | :--- | :--- |
| **Super Admin** | All Tables | All Tables | None |
| **Editor** | Tenant Workspace | Tenant Configuration | `WHERE tenant_id = current_tenant(Editor)` |
| **End User** | Tenant Workspace | Role Based on Global/Region/Country of Service/Scope | `WHERE tenant_id = current_tenant(user_profiles)` |

## User Profile Access
| Access Level | Reach | 
| :--- | :--- | 
| **Global** | All non-restricted accounts, countries, and entities |
| **Regional** | All non-restricted scopes within the user's assigned region of service |
| **Country** | All non-restricted scopes within the user's assigned country of service |
| **Scoped** | Account Specific Only what has been explicitly granted to the user |

## Data Model
The basis for access is dependent on the user_profile table to manage access at control points within the application. A view from the account selection module allows all users to navigate the full/searchable available accounts that load key variables (GCN/SMID/LCN) that are used to parse the user_profile matrix to allow access. 

### User Profile Schema
```postgres
public.user_access_profile (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_email varchar NOT NULL,
	gcn text DEFAULT '{}'::text NULL,
	smid text DEFAULT '{}'::text NULL,
	lcn text DEFAULT '{}'::text NULL,
	region_access bool DEFAULT false NULL,
	region text DEFAULT '{}'::text NULL,
	global_access bool DEFAULT false NULL,
	created_at timestamptz DEFAULT now() NULL,
	created_by varchar NULL,
	updated_at timestamptz DEFAULT now() NULL,
	updated_by varchar NULL,
	country_of_service text DEFAULT '{}'::text NULL,
	registered bool DEFAULT false NULL,
	country_access bool DEFAULT false NULL,
	CONSTRAINT user_access_profile_pk PRIMARY KEY (id),
	CONSTRAINT user_access_profile_unique UNIQUE (user_email)
);
```
### Global Customer Number (GCN)
Approver is nested at the highest entity level for self managed activity/request

### SMID

