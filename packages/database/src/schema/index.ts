import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended', 'inactive']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'member', 'viewer']);
export const documentStatusEnum = pgEnum('document_status', ['pending', 'processing', 'completed', 'failed']);
export const jobStatusEnum = pgEnum('job_status', ['queued', 'running', 'completed', 'failed', 'cancelled']);
export const jobTypeEnum = pgEnum('job_type', ['document_processing', 'ai_analysis', 'summarization', 'extraction']);

/**
 * Tenants table - Multi-tenant isolation
 * Every other table references this for row-level security
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: tenantStatusEnum('status').notNull().default('active'),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  settings: jsonb('settings').default({}),
  apiQuota: integer('api_quota').notNull().default(1000),
  apiUsage: integer('api_usage').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  slugIdx: index('tenants_slug_idx').on(table.slug),
  statusIdx: index('tenants_status_idx').on(table.status),
}));

/**
 * Users table - Tenant-scoped users
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: userRoleEnum('role').notNull().default('member'),
  isActive: boolean('is_active').notNull().default(true),
  authProvider: varchar('auth_provider', { length: 50 }),
  authId: text('auth_id'),
  metadata: jsonb('metadata').default({}),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdIdx: index('users_tenant_id_idx').on(table.tenantId),
  emailIdx: index('users_email_idx').on(table.email),
  tenantEmailUnique: index('users_tenant_email_unique').on(table.tenantId, table.email).where((sql) => sql`deleted_at IS NULL`),
  authIdx: index('users_auth_idx').on(table.authProvider, table.authId),
}));

/**
 * API Keys table - For programmatic access
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  scopes: jsonb('scopes').default([]),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdIdx: index('api_keys_tenant_id_idx').on(table.tenantId),
  keyHashIdx: index('api_keys_hash_idx').on(table.keyHash),
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
}));

/**
 * Documents table - Stores document metadata
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // File metadata
  filename: varchar('filename', { length: 500 }).notNull(),
  originalName: varchar('original_name', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  fileHash: varchar('file_hash', { length: 64 }),
  
  // Storage
  storageProvider: varchar('storage_provider', { length: 50 }).notNull().default('local'),
  storageKey: text('storage_key').notNull(),
  storageBucket: varchar('storage_bucket', { length: 255 }),
  
  // Processing
  status: documentStatusEnum('status').notNull().default('pending'),
  pageCount: integer('page_count'),
  wordCount: integer('word_count'),
  language: varchar('language', { length: 10 }),
  
  // Content (extracted text, cached)
  extractedText: text('extracted_text'),
  extractedAt: timestamp('extracted_at', { withTimezone: true }),
  
  // Metadata
  metadata: jsonb('metadata').default({}),
  tags: jsonb('tags').default([]),
  
  // Processing result
  processingError: text('processing_error'),
  processingDuration: integer('processing_duration'), // milliseconds
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  tenantIdIdx: index('documents_tenant_id_idx').on(table.tenantId),
  userIdIdx: index('documents_user_id_idx').on(table.userId),
  statusIdx: index('documents_status_idx').on(table.status),
  tenantStatusIdx: index('documents_tenant_status_idx').on(table.tenantId, table.status),
  createdAtIdx: index('documents_created_at_idx').on(table.createdAt),
  fileHashIdx: index('documents_file_hash_idx').on(table.fileHash),
}));

/**
 * Jobs table - Async job processing
 */
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Job details
  type: jobTypeEnum('type').notNull(),
  status: jobStatusEnum('status').notNull().default('queued'),
  priority: integer('priority').notNull().default(5), // 1-10, higher = more priority
  
  // Payload and result
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),
  error: text('error'),
  
  // Progress tracking
  progress: integer('progress').notNull().default(0), // 0-100
  progressMessage: varchar('progress_message', { length: 500 }),
  
  // Queue management
  queueName: varchar('queue_name', { length: 100 }).notNull().default('default'),
  workerId: varchar('worker_id', { length: 100 }),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  
  // Related entity
  entityType: varchar('entity_type', { length: 50 }), // 'document', 'api_request', etc.
  entityId: uuid('entity_id'),
  
  // Scheduling
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  
  // Timeout and retention
  timeoutSeconds: integer('timeout_seconds').notNull().default(300),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('jobs_tenant_id_idx').on(table.tenantId),
  statusIdx: index('jobs_status_idx').on(table.status),
  typeIdx: index('jobs_type_idx').on(table.type),
  queueIdx: index('jobs_queue_idx').on(table.queueName, table.status),
  scheduledIdx: index('jobs_scheduled_idx').on(table.scheduledAt),
  entityIdx: index('jobs_entity_idx').on(table.entityType, table.entityId),
  tenantStatusCreatedIdx: index('jobs_tenant_status_created_idx').on(table.tenantId, table.status, table.createdAt),
}));

// Types for TypeScript
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
