@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

ZwaluwNest is the internal HR & Operations portal for **Zwaluw Comfortsanitair** staff. It manages the full employee lifecycle: recruitment → screening → hiring → HR dossiers → scheduling → leave management.

## Commands

```bash
npm run dev          # Dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run db:migrate   # Run Prisma migrations (creates migration files)
npm run db:push      # Push schema without migration (dev only)
npm run db:seed      # Seed database (prisma/seed.ts)
npm run db:studio    # Open Prisma Studio UI
npm run db:generate  # Regenerate Prisma client after schema changes
```

## Critical: Non-Standard Library Versions

This project uses bleeding-edge versions with **breaking changes** from training data:

- **Next.js 16.2.0** — `middleware.ts` → `proxy.ts`, async request APIs (`await cookies()`, `await headers()`, `await params`, `await searchParams`), Cache Components. Read `node_modules/next/dist/docs/` before writing Next.js code.
- **Prisma 7** — Updated client API and adapter pattern via `@prisma/adapter-pg`
- **Tailwind v4** — Config-free, new import syntax (`@import "tailwindcss"`), different utility names
- **NextAuth v5 beta** — `auth()` replaces `getServerSession()`, new config shape in `src/lib/auth.ts`

## Architecture

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── candidates/         # Candidate CRUD + status transitions
│   │   ├── employees/          # Employee management
│   │   ├── appointments/       # Calendar + scheduling
│   │   ├── screening/          # Screening form submission
│   │   ├── contracts/          # Contract management
│   │   ├── leave/              # Leave requests
│   │   ├── dossier/            # HR dossier entries
│   │   ├── webhooks/           # Incoming webhooks (Meta Ads → new candidates)
│   │   ├── cron/               # Scheduled tasks
│   │   └── auth/               # NextAuth endpoints
│   ├── dashboard/              # Protected staff portal
│   │   ├── werving/            # Recruitment (kanban pipeline)
│   │   ├── personeel/          # Employee roster + dossiers
│   │   ├── agenda/             # Master scheduling view
│   │   ├── mijn-verlof/        # My leave (per-user)
│   │   ├── mijn-werk/          # My jobs (Monteur mobile)
│   │   ├── rapportage/         # Reports
│   │   ├── verzuim/            # Illness/absenteeism tracking
│   │   └── instellingen/       # Settings
│   ├── apply/                  # Public job application form
│   ├── screening/              # Public candidate screening questionnaire
│   └── login/                  # Auth page
├── components/                 # Shared React components
├── contexts/                   # React context providers
├── lib/
│   ├── auth.ts                 # NextAuth v5 config
│   ├── prisma.ts               # Prisma client singleton
│   ├── supabase.ts             # Supabase client (storage/realtime)
│   ├── data.ts                 # Shared data fetching helpers
│   ├── email.ts                # Resend transactional email
│   ├── google-calendar.ts      # Google Calendar API
│   ├── google-sheets.ts        # Google Sheets export
│   ├── linkedin.ts             # LinkedIn job posting
│   └── nmbrs.ts                # Nmbrs payroll integration
└── types/                      # TypeScript type definitions
```

## RBAC

Seven roles gate access at the route/API level:

| Role | Access |
|------|--------|
| `ADMIN` | Full access (directie) |
| `PLANNER` | Master agenda + verzuim, no HR dossiers |
| `ADVISEUR` | Own agenda, conversion metrics, leave requests |
| `MONTEUR` | Mobile job view, assigned work/vehicle/tools |
| `CALLCENTER` | Call center workflows |
| `BACKOFFICE` | Back office operations |
| `WAREHOUSE` | Warehouse operations |

Role is stored on `User.role` in the database. Check session in Server Components with `auth()` from `src/lib/auth.ts`.

## Recruitment Pipeline (Module 1)

Candidate status flow:
```
NEW_LEAD (webhook from Meta Ads)
  → PRE_SCREENING (screening form sent)
  → SCREENING_DONE (form completed)
  → INTERVIEW
  → RESERVE_BANK (vetted, awaiting opening)
  → HIRED (→ creates EmployeeProfile)
  → REJECTED | WITHDRAWN
```

## Database

Prisma 7 + PostgreSQL. Schema: `prisma/schema.prisma`.

Key models: `User`, `Candidate`, `CandidateNote`, `ScreeningAnswer`, `JobOpening`, `EmployeeProfile`, `DossierEntry`, `AuditLog`, `Notification`.

The `AuditLog` model tracks all mutations for AVG/GDPR compliance.

## Compliance Notes

- **AVG/GDPR**: Candidate data deletion on `WITHDRAWN` status; audit trail on all mutations
- **Ketenbepaling**: Contract chain tracking (Dutch labor law)
- **Wet verbetering poortwachter**: Verzuim (illness) case management with required milestones
- **Proeftijd**: Probation period tracking on `EmployeeProfile`
