-- VOORSTEL — NOG NIET UITGEVOERD. Draaien in de Supabase SQL Editor:
-- https://app.supabase.com/project/oygbjxzpwnuyxgycofil/sql/new
--
-- Waarom: de productiedatabase heeft (behalve RoleAssignment → User) géén
-- enkele foreign key, terwijl schema.prisma ze wel declareert. Gevolgen:
--   1. PostgREST-embeds (EmployeeProfile!EmployeeProfile_userId_fkey e.d.)
--      faalden; de code is inmiddels omgeschreven naar losse queries.
--   2. Een gebruiker verwijderen "lukte" altijd en liet contracten, verlof,
--      dossier, afspraken en notities als wezen achter. Stand 08-10-2026:
--      14/15 contracten, 9/9 verlofaanvragen, 6/6 dossierregels, 2/2
--      ziekmeldingen, 95/113 afspraken, 20 meldingen, 13 belregistraties,
--      2 notities en 14/44 screeningantwoorden verwijzen naar niets.
--
-- De constraints hieronder zijn NOT VALID: ze gelden voor nieuwe en gewijzigde
-- rijen, maar de bestaande wezen blokkeren het aanmaken niet. Ruim de wezen
-- eerst op (of bewust niet) en valideer daarna met
--   ALTER TABLE "<tabel>" VALIDATE CONSTRAINT "<naam>";
--
-- HR-tabellen krijgen RESTRICT (bewaarplicht): een medewerker met contracten,
-- verlof of dossier kan dan niet meer per ongeluk worden verwijderd.

BEGIN;

-- ── Overzicht van wezen (alleen lezen; draai dit eerst) ─────────────────────
-- SELECT 'Contract' t, count(*) FROM "Contract" c WHERE NOT EXISTS (SELECT 1 FROM "EmployeeProfile" e WHERE e.id = c."employeeProfileId")
-- UNION ALL SELECT 'LeaveRequest', count(*) FROM "LeaveRequest" c WHERE NOT EXISTS (SELECT 1 FROM "EmployeeProfile" e WHERE e.id = c."employeeProfileId")
-- UNION ALL SELECT 'DossierEntry', count(*) FROM "DossierEntry" c WHERE NOT EXISTS (SELECT 1 FROM "EmployeeProfile" e WHERE e.id = c."employeeProfileId")
-- UNION ALL SELECT 'SickTracker', count(*) FROM "SickTracker" c WHERE NOT EXISTS (SELECT 1 FROM "EmployeeProfile" e WHERE e.id = c."employeeProfileId")
-- UNION ALL SELECT 'Appointment', count(*) FROM "Appointment" c WHERE NOT EXISTS (SELECT 1 FROM "EmployeeProfile" e WHERE e.id = c."employeeProfileId")
-- UNION ALL SELECT 'Notification', count(*) FROM "Notification" c WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId")
-- UNION ALL SELECT 'CallLog', count(*) FROM "CallLog" c WHERE NOT EXISTS (SELECT 1 FROM "Candidate" k WHERE k.id = c."candidateId")
-- UNION ALL SELECT 'CandidateNote', count(*) FROM "CandidateNote" c WHERE NOT EXISTS (SELECT 1 FROM "Candidate" k WHERE k.id = c."candidateId")
-- UNION ALL SELECT 'ScreeningAnswer', count(*) FROM "ScreeningAnswer" c WHERE NOT EXISTS (SELECT 1 FROM "ScreeningQuestion" q WHERE q.id = c."questionId");

-- ── Medewerkers ─────────────────────────────────────────────────────────────
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "DossierEntry" ADD CONSTRAINT "DossierEntry_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "DossierEntry" ADD CONSTRAINT "DossierEntry_loggedById_fkey"
  FOREIGN KEY ("loggedById") REFERENCES "User"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "SickTracker" ADD CONSTRAINT "SickTracker_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_employeeProfileId_fkey"
  FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE RESTRICT NOT VALID;

-- ── Meldingen en audit ──────────────────────────────────────────────────────
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE SET NULL NOT VALID;

-- ── Werving ─────────────────────────────────────────────────────────────────
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobOpeningId_fkey"
  FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE "CandidateNoteMention" ADD CONSTRAINT "CandidateNoteMention_noteId_fkey"
  FOREIGN KEY ("noteId") REFERENCES "CandidateNote"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "CandidateNoteMention" ADD CONSTRAINT "CandidateNoteMention_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "InterviewScore" ADD CONSTRAINT "InterviewScore_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "ScreeningQuestion" ADD CONSTRAINT "ScreeningQuestion_scriptId_fkey"
  FOREIGN KEY ("scriptId") REFERENCES "ScreeningScript"(id) ON DELETE CASCADE NOT VALID;
-- Bewust GEEN cascade van vraag naar antwoord: een verwijderde vraag mag geen
-- gegeven antwoorden meenemen (zie src/lib/template-sync.ts).
ALTER TABLE "ScreeningAnswer" ADD CONSTRAINT "ScreeningAnswer_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "InterviewChecklistItem" ADD CONSTRAINT "InterviewChecklistItem_checklistId_fkey"
  FOREIGN KEY ("checklistId") REFERENCES "InterviewChecklist"(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE "InterviewChecklistResult" ADD CONSTRAINT "InterviewChecklistResult_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"(id) ON DELETE CASCADE NOT VALID;

COMMIT;

-- PostgREST de nieuwe relaties laten zien:
-- NOTIFY pgrst, 'reload schema';
