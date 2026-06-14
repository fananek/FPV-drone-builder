# System Architecture & Tech Stack

## 1. Tech Stack Selection

To ensure local testability, minimal DevOps overhead, and rapid AI code generation, the following unified stack is specified:

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend & Backend** | Next.js 15+ (App Router), TypeScript | Server Components handle calculation logic and DB queries securely; Client Components provide a reactive, dashboard-like UI. |
| **Styling & UI** | Tailwind CSS + shadcn/ui + Lucide React icons | Rapid, consistent, accessible component development. |
| **Theme** | Dark/Light mode via `next-themes`, defaulting to `prefers-color-scheme` | Modern, futuristic, clean aesthetic. |
| **Data Visualisation** | Recharts | Thrust curves, component comparisons, radial gauge charts. |
| **Database** | SQLite via **Drizzle ORM** | Portable file-based DB; production can migrate via Litestream or to a Vercel-compatible Postgres adapter with minimal ORM change. |
| **Authentication** | Auth.js v5 (formerly NextAuth.js) | Supports Credentials + OAuth 2.0 providers with built-in CSRF protection. |
| **AI Integration** | Vercel AI SDK | Unified streaming interface supporting multiple LLM providers (OpenAI, Anthropic, Google Gemini). |

> **Note on ORM choice:** Drizzle is preferred over Prisma for SQLite edge-compatibility and zero-runtime schema generation. If the team prefers Prisma, the schema design below maps 1-to-1 to Prisma models.

---

## 2. Authentication & Authorization

### 2.1 Supported Authentication Providers

| Provider | Type | Notes |
|----------|------|-------|
| Email/Password | Credentials | Passwords hashed with bcrypt (min cost factor 12). |
| Google | OAuth 2.0 | |
| Apple | OAuth 2.0 | Requires Apple Developer account. |
| GitHub | OAuth 2.0 | |
| Anonymous Session | JWT (LocalStorage fallback) | Session created on first visit; migrated to user account on registration. |

### 2.2 RBAC — Role-Based Access Control Matrix

| Permission | Anonymous | Registered User | Moderator | Metadata Admin | System Admin | API Client |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Read Parts Metadata | ✅ R | ✅ R | ✅ R | ✅ RWD | ✅ Full | ✅ R |
| Read Public Builds | ✅ R | ✅ R | ✅ R | ✅ R | ✅ Full | ✅ R |
| Clone Public Builds | ✅ (anon session) | ✅ | ✅ | ✅ | ✅ Full | — |
| Rate/Review Builds | — | ✅ | ✅ | ✅ | ✅ Full | — |
| Manage Own Builds | ✅ (anon session) | ✅ RWD | ✅ RWD | ✅ RWD | ✅ Full | — |
| Manage All Builds | — | — | ✅ RWD | — | ✅ Full | — |
| Bulk Import Parts (CSV) | — | — | — | ✅ | ✅ Full | ✅ (scoped write) |
| Upload Thrust Test Data | — | — | — | ✅ | ✅ Full | ✅ (scoped write) |
| Audit / System Logs | — | — | — | — | ✅ Full | — |

**Legend:** R = Read, W = Write/Create, D = Delete, RWD = Read + Write + Delete, Full = unrestricted.

**API Client** is a dedicated machine-to-machine (M2M) service token role enabling automated ingestion of thrust test data from external test stands (e.g., RCBenchmark exports, OpenVPP telemetry). API Client tokens are scoped and managed by a System Admin.

**Role Precedence:** A user can hold multiple Roles. Permissions are cumulative, meaning that if a user has multiple roles, they have the union of permissions of all roles. For example, a user with both Registered User and Metadata Admin roles has all permissions of both roles. 

---

## 3. Database Schema

### 3.1 Entity Relationship Overview

```
[User] 1 ──────────── 0..* [Build] 1 ──────── 0..* [BuildComponent] *────1 [Part]
  │                      │                                                    │
  │ 1                    │ 1                                                  │ 1
[UserRole]         [BuildWarning]                                   [ThrustTestData]
                                                                    (motorId, propellerId FK)

[Build] 0..* ─────────── 0..* [BuildRating]  (userId FK, buildId FK)
[Build] 0..1 ─────────── 0..1 [Build]        clonedFromBuildId (self-referential FK)
```

### 3.2 Core Table Definitions

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `passwordHash` | VARCHAR(255) | NULLABLE (null for OAuth-only accounts) |
| `role` | ENUM | NOT NULL, DEFAULT `registered_user` |
| `createdAt` | DATETIME | NOT NULL |
| `updatedAt` | DATETIME | NOT NULL |

#### `oauth_accounts`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id, ON DELETE CASCADE |
| `provider` | VARCHAR(50) | NOT NULL (e.g., `google`, `apple`, `github`) |
| `providerAccountId` | VARCHAR(255) | NOT NULL |
| | | UNIQUE(`provider`, `providerAccountId`) |

#### `builds`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `userId` | UUID | FK → users.id, ON DELETE CASCADE; NULLABLE for anon sessions |
| `anonymousSessionId` | VARCHAR(255) | NULLABLE |
| `name` | VARCHAR(100) | NOT NULL |
| `description` | TEXT | NULLABLE |
| `isPublic` | BOOLEAN | NOT NULL, DEFAULT false |
| `tags` | JSON | NULLABLE (array of strings) |
| `customPayloadWeightGrams` | FLOAT | NOT NULL, DEFAULT 0.0 |
| `clonedFromBuildId` | UUID | NULLABLE, FK → builds.id |
| `averageRating` | FLOAT | NULLABLE, denormalised |
| `ratingCount` | INT | NOT NULL, DEFAULT 0 |
| `version` | INT | NOT NULL, DEFAULT 1 (optimistic locking) |
| `createdAt` | DATETIME | NOT NULL |
| `updatedAt` | DATETIME | NOT NULL |
| | | UNIQUE(`userId`, `name`) |

#### `build_components`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `buildId` | UUID | FK → builds.id, ON DELETE CASCADE |
| `partId` | UUID | FK → parts.id |
| `quantity` | INT | NOT NULL, DEFAULT 1 |
| `customNotes` | TEXT | NULLABLE |

#### `parts`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | VARCHAR(255) | NOT NULL |
| `manufacturer` | VARCHAR(100) | NOT NULL |
| `model` | VARCHAR(100) | NOT NULL |
| `weightGrams` | FLOAT | NOT NULL |
| `mainCategory` | ENUM | NOT NULL — see §DATA_MODELS §1.2 |
| `subCategory` | ENUM | NOT NULL — see §DATA_MODELS §1.2 |
| `attributes` | JSONB | NOT NULL |
| `isComposite` | BOOLEAN | NOT NULL, DEFAULT false |
| `integratedPartIds` | JSON | NULLABLE (array of UUIDs) |
| `isArchived` | BOOLEAN | NOT NULL, DEFAULT false |
| `createdAt` | DATETIME | NOT NULL |
| `updatedAt` | DATETIME | NOT NULL |

#### `thrust_test_data`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `motorId` | UUID | FK → parts.id |
| `propellerId` | UUID | FK → parts.id |
| `batteryCellCount` | INT | NOT NULL |
| `batteryChemistry` | VARCHAR(20) | NOT NULL (e.g., `LiPo`, `LiHv`, `LiIon`) |
| `testPoints` | JSONB | NOT NULL — see §DATA_MODELS §4 |
| `isEmpirical` | BOOLEAN | NOT NULL, DEFAULT true |
| `sourceLabel` | VARCHAR(255) | NULLABLE (e.g., `RCBenchmark export 2025-01-15`) |
| `createdAt` | DATETIME | NOT NULL |
| | | UNIQUE(`motorId`, `propellerId`, `batteryCellCount`, `batteryChemistry`) |

#### `build_warnings` (materialised snapshot per save)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `buildId` | UUID | FK → builds.id, ON DELETE CASCADE |
| `warningCode` | VARCHAR(10) | NOT NULL (e.g., `W-07`) |
| `severity` | ENUM | NOT NULL (`error`, `warning`, `info`) |
| `message` | TEXT | NOT NULL |
| `createdAt` | DATETIME | NOT NULL |

#### `build_ratings`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `buildId` | UUID | FK → builds.id, ON DELETE CASCADE |
| `userId` | UUID | FK → users.id, ON DELETE CASCADE |
| `stars` | INT | NOT NULL, CHECK (1 ≤ stars ≤ 5) |
| `review` | VARCHAR(500) | NULLABLE |
| `createdAt` | DATETIME | NOT NULL |
| `updatedAt` | DATETIME | NOT NULL |
| | | UNIQUE(`buildId`, `userId`) |

---

## 4. API Design

All APIs reside under `/api/v1/*`. All responses are strict JSON. All mutating endpoints require a valid session or API Client token.

### 4.1 Convention

* **Pagination:** All list endpoints support `?page=1&limit=20` query params. Response envelope:
  ```json
  { "data": [...], "pagination": { "page": 1, "limit": 20, "total": 432 } }
  ```
* **Errors:** All errors return `{ "error": { "code": "ENUM_CODE", "message": "Human-readable description" } }` with the appropriate HTTP status code.

### 4.2 Parts Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/parts` | Public | Paginated parts list. Query params: `category`, `subCategory`, `search`, `page`, `limit`. Excludes archived parts by default (`?includeArchived=true` for admins). |
| `GET` | `/api/v1/parts/{id}` | Public | Single part detail including full `attributes` JSONB. |
| `POST` | `/api/v1/parts` | Metadata Admin | Create a new part. |
| `PATCH` | `/api/v1/parts/{id}` | Metadata Admin | Update part fields (partial update). |
| `DELETE` | `/api/v1/parts/{id}` | Metadata Admin | Soft-delete (sets `isArchived = true`). |
| `POST` | `/api/v1/parts/bulk-import` | Metadata Admin | CSV bulk import with field mapping payload. |

### 4.3 Thrust Test Data Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/thrust-tests` | Public | List test datasets. Query params: `motorId`, `propellerId`, `cellCount`. |
| `POST` | `/api/v1/thrust-tests` | Metadata Admin / API Client | Upload a new thrust test dataset. |
| `DELETE` | `/api/v1/thrust-tests/{id}` | Metadata Admin | Delete a thrust test dataset. |

### 4.4 Builds Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/builds` | Registered User | List the authenticated user's builds (including anon-session builds). |
| `GET` | `/api/v1/builds/public` | Public | Paginated public builds gallery. Query params: `category`, `weightClass`, `frameSize`, `sort`, `page`, `limit`. |
| `GET` | `/api/v1/builds/{id}` | Owner / Public (if `isPublic`) | Single build detail with components expanded. |
| `POST` | `/api/v1/builds` | Any (anon session or user) | Create a new build. |
| `PATCH` | `/api/v1/builds/{id}` | Owner | Partial update (components, name, description, visibility). Includes `version` for optimistic locking. |
| `DELETE` | `/api/v1/builds/{id}` | Owner / Moderator | Delete build. |
| `POST` | `/api/v1/builds/{id}/clone` | Any | Clone a public build to the requester's workspace. |
| `POST` | `/api/v1/builds/{id}/rate` | Registered User | Create or update the user's rating for a build. |

### 4.5 Calculation Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/calculate/metrics` | Public (stateless) | Accepts an array of `{ partId, quantity }` objects + `customPayloadWeightGrams`. Returns AUW, TWR, tip speed (Mach), ESC thermal margin %, and flight time estimates. Also returns any validation warnings. |

### 4.6 AI Advisor Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/ai/wizard-step` | Any | Accepts the wizard state (intent, size, selected components) and returns filtered next-step part recommendations with reasoning. |
| `POST` | `/api/v1/ai/advisor-chat` | Any | Streaming endpoint. Accepts the full build state + user message. Returns a streamed LLM response. Rate limited: 60 req/user/min. |