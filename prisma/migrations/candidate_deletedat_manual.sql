-- Run this in the Supabase SQL Editor: https://app.supabase.com/project/oygbjxzpwnuyxgycofil/sql/new
-- Adds the missing Candidate.deletedAt column (soft delete / prullenbak).
--
-- Waarom: schema.prisma declareert `deletedAt` en de portal heeft een volledige
-- prullenbak-UI, maar de kolom is nooit in de database aangemaakt. Daardoor
-- faalden het verwijderen, het herstellen en de prullenbak-weergave stilzwijgend.
-- Additief en nullable: bestaande rijen krijgen NULL en blijven dus zichtbaar.

ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Versnelt de filters `.is('deletedAt', null)` in de kandidatenlijsten.
CREATE INDEX IF NOT EXISTS "Candidate_deletedAt_idx" ON "Candidate"("deletedAt");
