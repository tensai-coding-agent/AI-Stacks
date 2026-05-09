import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  tenants, 
  users, 
  apiKeys, 
  documents, 
  jobs,
  NewTenant,
  NewUser,
  NewApiKey,
  NewDocument,
  NewJob
} from './schema/index.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aistacks';

async function seed() {
  console.log('🌱 Starting database seed...\n');

  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    // Create demo tenant
    const [demoTenant] = await db.insert(tenants).values({
      name: 'Demo Corp',
      slug: 'demo-corp',
      status: 'active',
      plan: 'enterprise',
      settings: {
        features: { summarization: true, extraction: true, analysis: true },
        maxDocuments: 10000,
        maxUsers: 50,
      },
      apiQuota: 100000,
      apiUsage: 0,
    } as NewTenant).returning();

    console.log('✅ Created tenant:', demoTenant.name, `(${demoTenant.id})`);

    // Create demo users
    const [adminUser, memberUser] = await db.insert(users).values([
      {
        tenantId: demoTenant.id,
        email: 'admin@demo-corp.com',
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        authProvider: 'email',
      },
      {
        tenantId: demoTenant.id,
        email: 'member@demo-corp.com',
        name: 'Team Member',
        role: 'member',
        isActive: true,
        authProvider: 'email',
      },
    ] as NewUser[]).returning();

    console.log('✅ Created users:', adminUser.name, '&', memberUser.name);

    // Create API key
    const [apiKey] = await db.insert(apiKeys).values({
      tenantId: demoTenant.id,
      userId: adminUser.id,
      name: 'Production API Key',
      keyHash: 'hashed_key_would_go_here',
      keyPrefix: 'ak_prod_',
      scopes: ['documents:read', 'documents:write', 'ai:summarize', 'ai:extract'],
      isActive: true,
    } as NewApiKey).returning();

    console.log('✅ Created API key:', apiKey.name, `(${apiKey.keyPrefix}...)`);

    // Create sample documents
    const sampleDocs = await db.insert(documents).values([
      {
        tenantId: demoTenant.id,
        userId: adminUser.id,
        filename: 'contract-v1.pdf',
        originalName: 'Service Contract 2024.pdf',
        mimeType: 'application/pdf',
        size: 245760,
        fileHash: 'sha256_hash_here',
        storageProvider: 's3',
        storageKey: 'tenants/demo-corp/documents/contract-v1.pdf',
        storageBucket: 'ai-stacks-documents',
        status: 'completed',
        pageCount: 12,
        wordCount: 3500,
        language: 'en',
        metadata: {
          source: 'upload',
          category: 'contracts',
        },
        tags: ['contract', 'legal', '2024'],
      },
      {
        tenantId: demoTenant.id,
        userId: memberUser.id,
        filename: 'report-q1.docx',
        originalName: 'Q1 Financial Report.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 125829,
        fileHash: 'sha256_hash_here_2',
        storageProvider: 's3',
        storageKey: 'tenants/demo-corp/documents/report-q1.docx',
        storageBucket: 'ai-stacks-documents',
        status: 'completed',
        pageCount: 8,
        wordCount: 2400,
        language: 'en',
        metadata: {
          source: 'upload',
          quarter: 'Q1',
          year: 2024,
        },
        tags: ['financial', 'quarterly', 'report'],
      },
      {
        tenantId: demoTenant.id,
        userId: adminUser.id,
        filename: 'pending-doc.pdf',
        originalName: 'Analysis Pending.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        fileHash: 'sha256_hash_here_3',
        storageProvider: 's3',
        storageKey: 'tenants/demo-corp/documents/pending-doc.pdf',
        storageBucket: 'ai-stacks-documents',
        status: 'pending',
        metadata: {},
        tags: [],
      },
    ] as NewDocument[]).returning();

    console.log('✅ Created', sampleDocs.length, 'sample documents');

    // Create sample jobs
    const sampleJobs = await db.insert(jobs).values([
      {
        tenantId: demoTenant.id,
        userId: adminUser.id,
        type: 'document_processing',
        status: 'completed',
        priority: 5,
        queueName: 'documents',
        payload: {
          documentId: sampleDocs[0].id,
          action: 'extract_text',
        },
        result: {
          extractedText: 'Sample extracted text would be here...',
          processingTime: 2300,
        },
        progress: 100,
        entityType: 'document',
        entityId: sampleDocs[0].id,
        attempts: 1,
        maxAttempts: 3,
      },
      {
        tenantId: demoTenant.id,
        userId: adminUser.id,
        type: 'summarization',
        status: 'queued',
        priority: 7,
        queueName: 'ai-processing',
        payload: {
          documentId: sampleDocs[0].id,
          strategy: 'abstractive',
          length: 'medium',
        },
        progress: 0,
        entityType: 'document',
        entityId: sampleDocs[0].id,
        attempts: 0,
        maxAttempts: 3,
      },
    ] as NewJob[]).returning();

    console.log('✅ Created', sampleJobs.length, 'sample jobs');

    console.log('\n🎉 Database seed completed successfully!');
    console.log('\nDemo credentials:');
    console.log('  Tenant:', demoTenant.slug);
    console.log('  Admin:', adminUser.email);
    console.log('  Member:', memberUser.email);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
