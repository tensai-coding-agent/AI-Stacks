# @ai-stacks/database

Database layer with Drizzle ORM for AI-Stacks multi-tenant architecture.

## Features

- **Multi-tenant schema** with row-level security
- **Drizzle ORM** with TypeScript-first approach
- **Automatic migrations** with drizzle-kit
- **Connection pooling** for production workloads
- **Type-safe queries** with full TypeScript support

## Schema Overview

### Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `tenants` | Multi-tenant isolation | UUID primary key, status tracking, API quotas |
| `users` | Tenant-scoped users | Role-based access (admin/member/viewer), soft deletes |
| `api_keys` | Programmatic access | Key hashing, scopes, expiration |
| `documents` | Document metadata | Storage abstraction, processing status, indexes |
| `jobs` | Async job queue | Priority queue, progress tracking, dead letter support |

### Indexes

Optimized indexes for:
- Tenant-scoped queries (all tables)
- Status-based filtering (documents, jobs)
- Email lookups with soft-delete handling (users)
- Queue processing (jobs by status + queue + scheduled time)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Environment Variables

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aistacks"
```

### 3. Run Migrations

```bash
# Generate migration files from schema
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Or use push for development (no migration files)
pnpm db:push
```

### 4. Seed Development Data

```bash
pnpm db:seed
```

## Usage

### Database Connection

```typescript
import { createConnection, initializeDatabase, getDatabase } from '@ai-stacks/database';

const client = createConnection({ url: process.env.DATABASE_URL! });
const db = initializeDatabase(client);

// Use throughout your app
const database = getDatabase();
```

### Query Examples

```typescript
import { eq, and, desc } from 'drizzle-orm';
import { tenants, users, documents } from '@ai-stacks/database';

// Get tenant with users
const tenantWithUsers = await db.query.tenants.findFirst({
  where: eq(tenants.slug, 'demo-corp'),
  with: {
    users: true,
  },
});

// List tenant documents with pagination
const docs = await db
  .select()
  .from(documents)
  .where(
    and(
      eq(documents.tenantId, tenantId),
      eq(documents.status, 'completed')
    )
  )
  .orderBy(desc(documents.createdAt))
  .limit(20);

// Insert new document
const [newDoc] = await db
  .insert(documents)
  .values({
    tenantId,
    userId,
    filename: 'report.pdf',
    originalName: 'Q4 Report.pdf',
    mimeType: 'application/pdf',
    size: 1024000,
    storageProvider: 's3',
    storageKey: 'path/to/file.pdf',
  })
  .returning();
```

### Schema References

All tables have foreign key relationships set up:

```typescript
// Query with relations
db.query.documents.findMany({
  where: eq(documents.tenantId, tenantId),
  with: {
    tenant: true,
    user: true,
  },
});
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate migration files from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Push schema changes directly (dev only) |
| `pnpm db:studio` | Open Drizzle Studio GUI |
| `pnpm db:seed` | Seed development data |
| `pnpm build` | Compile TypeScript |
| `pnpm typecheck` | Run type checking |

## Multi-Tenancy

This database uses a **shared database, shared schema** approach:

- Every table has a `tenant_id` column
- All queries should filter by `tenant_id`
- Foreign keys cascade on tenant deletion
- Soft deletes via `deleted_at` timestamp (tenants, users, api_keys, documents)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |

## License

MIT

Co-Authored-By: Paperclip <noreply@paperclip.ing>
