// One-time migration: recreate CallLog with TEXT status (fixes PostgREST enum issue)
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected.');

  await client.query(`DROP TABLE IF EXISTS "CallLog"`);
  console.log('Dropped CallLog (if existed).');

  await client.query(`DROP TYPE IF EXISTS "CallStatus"`);
  console.log('Dropped CallStatus enum (if existed).');

  await client.query(`
    CREATE TABLE "CallLog" (
      "id"          TEXT NOT NULL,
      "candidateId" TEXT NOT NULL,
      "userId"      TEXT NOT NULL,
      "status"      TEXT NOT NULL,
      "notes"       TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
    )
  `);
  console.log('Created CallLog table.');

  await client.query(`CREATE INDEX IF NOT EXISTS "CallLog_candidateId_idx" ON "CallLog"("candidateId")`);
  await client.query(`CREATE INDEX IF NOT EXISTS "CallLog_userId_idx" ON "CallLog"("userId")`);
  console.log('Created indexes.');

  await client.end();
  console.log('Done!');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
