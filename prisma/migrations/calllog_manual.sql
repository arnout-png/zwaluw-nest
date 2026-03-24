-- Run this in the Supabase SQL Editor: https://app.supabase.com/project/oygbjxzpwnuyxgycofil/sql/new
-- Creates the CallLog table for the bel opvolging feature

-- 1. Create CallStatus enum
DO $$ BEGIN
  CREATE TYPE "CallStatus" AS ENUM ('GEEN_GEHOOR', 'VOICEMAIL', 'BEREIKT', 'TERUGBELLEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create CallLog table
CREATE TABLE IF NOT EXISTS "CallLog" (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "status"      "CallStatus" NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "CallLog_candidateId_idx" ON "CallLog"("candidateId");
CREATE INDEX IF NOT EXISTS "CallLog_userId_idx"      ON "CallLog"("userId");
