// ONE-TIME MIGRATION ENDPOINT — DELETE THIS FILE AFTER USE
// Visit http://localhost:3000/api/migrate/calllog once to create the CallLog table.

import { NextResponse } from 'next/server';
import pg from 'pg';

const { Client } = pg;

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();

    await client.query(`DROP TABLE IF EXISTS "CallLog"`);
    await client.query(`DROP TYPE IF EXISTS "CallStatus"`);

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

    await client.query(`CREATE INDEX IF NOT EXISTS "CallLog_candidateId_idx" ON "CallLog"("candidateId")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CallLog_userId_idx" ON "CallLog"("userId")`);

    await client.end();

    return NextResponse.json({
      ok: true,
      message: 'CallLog tabel aangemaakt. Verwijder nu src/app/api/migrate/calllog/route.ts',
    });
  } catch (err) {
    await client.end().catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
