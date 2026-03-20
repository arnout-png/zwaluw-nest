/**
 * ZwaluwNest — Demo Seed Script
 * Uses Supabase admin client (bypasses RLS), same as the app does at runtime.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TODAY = new Date("2026-03-20T12:00:00.000Z");
const ago = (n: number) => new Date(TODAY.getTime() - n * 86400000).toISOString();
const from = (n: number) => new Date(TODAY.getTime() + n * 86400000).toISOString();
const on = (isoDate: string, h: number, m = 0) => {
  const d = new Date(isoDate);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
};

async function upsertUser(data: {
  email: string; passwordHash: string; name: string; role: string;
}) {
  const { data: row, error } = await supabase
    .from("User")
    .upsert({ ...data, isActive: true }, { onConflict: "email", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw new Error(`User upsert (${data.email}): ${error.message}`);
  return row!.id as string;
}

async function upsertProfile(userId: string, data: Record<string, unknown>) {
  const { data: row, error } = await supabase
    .from("EmployeeProfile")
    .upsert({ userId, ...data }, { onConflict: "userId", ignoreDuplicates: true })
    .select("id")
    .single();
  if (error) {
    // Might already exist — fetch it
    const { data: existing } = await supabase.from("EmployeeProfile").select("id").eq("userId", userId).single();
    if (existing) return existing.id as string;
    throw new Error(`Profile upsert (${userId}): ${error.message}`);
  }
  return row!.id as string;
}

async function ins(table: string, rows: Record<string, unknown>[]) {
  const { error } = await supabase.from(table).insert(rows).select("id");
  if (error && !error.message.includes("duplicate") && !error.message.includes("unique")) {
    throw new Error(`Insert ${table}: ${error.message}`);
  }
}

async function main() {
  console.log("🌱 Seeding ZwaluwNest demo data...\n");

  // ─── PASSWORDS ───────────────────────────────────────────────────────────────
  const [adminHash, plannerHash, adviseurHash, monteurHash, demoHash] =
    await Promise.all([
      bcrypt.hash("Admin2024!", 12), bcrypt.hash("Planner2024!", 12),
      bcrypt.hash("Adviseur2024!", 12), bcrypt.hash("Monteur2024!", 12),
      bcrypt.hash("Demo2024!", 12),
    ]);

  // ─── USERS ──────────────────────────────────────────────────────────────────
  console.log("👤 Creating users...");
  const [uArnout, uNiels, uJan, uPieter, uSophie, uMark, uLisa, uTom, uEmma, uRobert] =
    await Promise.all([
      upsertUser({ email: "admin@veiligdouchen.nl",    passwordHash: adminHash,   name: "Arnout van der Berg", role: "ADMIN"      }),
      upsertUser({ email: "niels@veiligdouchen.nl",    passwordHash: plannerHash, name: "Niels Vermeer",       role: "PLANNER"    }),
      upsertUser({ email: "adviseur@veiligdouchen.nl", passwordHash: adviseurHash,name: "Jan de Vries",        role: "ADVISEUR"   }),
      upsertUser({ email: "monteur@veiligdouchen.nl",  passwordHash: monteurHash, name: "Pieter Bakker",       role: "MONTEUR"    }),
      upsertUser({ email: "sophie@veiligdouchen.nl",   passwordHash: demoHash,    name: "Sophie van den Berg", role: "ADVISEUR"   }),
      upsertUser({ email: "mark@veiligdouchen.nl",     passwordHash: demoHash,    name: "Mark Hendriksen",     role: "MONTEUR"    }),
      upsertUser({ email: "lisa@veiligdouchen.nl",     passwordHash: demoHash,    name: "Lisa Jansen",         role: "CALLCENTER" }),
      upsertUser({ email: "tom@veiligdouchen.nl",      passwordHash: demoHash,    name: "Tom van Dijk",        role: "BACKOFFICE" }),
      upsertUser({ email: "emma@veiligdouchen.nl",     passwordHash: demoHash,    name: "Emma de Wit",         role: "WAREHOUSE"  }),
      upsertUser({ email: "robert@veiligdouchen.nl",   passwordHash: demoHash,    name: "Robert Smit",         role: "MONTEUR"    }),
    ]);
  console.log("  ✓ 10 users");

  // ─── EMPLOYEE PROFILES ──────────────────────────────────────────────────────
  console.log("📋 Creating employee profiles...");
  const [pA, pN, pJ, pPi, pS, pM, pL, pT, pE, pR] = await Promise.all([
    upsertProfile(uArnout,  { department: "Directie",      startDate: "2018-04-01", leaveBalanceDays: 28, leaveUsedDays: 4,  phonePersonal: "06-12345678", address: "Hoofdstraat 12",      city: "Rotterdam",             postalCode: "3011 AA" }),
    upsertProfile(uNiels,   { department: "Planning",      startDate: "2022-03-15", leaveBalanceDays: 25, leaveUsedDays: 8,  phonePersonal: "06-23456789", address: "Plantsoenweg 5",      city: "Rotterdam",             postalCode: "3021 BK" }),
    upsertProfile(uJan,     { department: "Sales",         startDate: "2023-06-01", leaveBalanceDays: 25, leaveUsedDays: 12, phonePersonal: "06-34567890", address: "Koningslaan 88",      city: "Den Haag",              postalCode: "2512 HN" }),
    upsertProfile(uPieter,  { department: "Montage",       startDate: "2023-09-01", leaveBalanceDays: 25, leaveUsedDays: 3,  phonePersonal: "06-45678901", address: "Ambachtsweg 3",       city: "Delft",                 postalCode: "2628 AB" }),
    upsertProfile(uSophie,  { department: "Sales",         startDate: "2024-01-15", leaveBalanceDays: 25, leaveUsedDays: 5,  phonePersonal: "06-56789012", address: "Bloemenweg 22",       city: "Zoetermeer",            postalCode: "2701 CD" }),
    upsertProfile(uMark,    { department: "Montage",       startDate: "2021-07-01", leaveBalanceDays: 28, leaveUsedDays: 14, phonePersonal: "06-67890123", address: "Industrieweg 7",      city: "Dordrecht",             postalCode: "3316 GH" }),
    upsertProfile(uLisa,    { department: "Klantenservice",startDate: "2024-03-01", leaveBalanceDays: 25, leaveUsedDays: 0,  phonePersonal: "06-78901234", address: "Stationsplein 14",    city: "Schiedam",              postalCode: "3111 DG" }),
    upsertProfile(uTom,     { department: "Backoffice",    startDate: "2022-11-01", leaveBalanceDays: 25, leaveUsedDays: 10, phonePersonal: "06-89012345", address: "Rijksweg 101",        city: "Capelle aan den IJssel",postalCode: "2907 LN" }),
    upsertProfile(uEmma,    { department: "Magazijn",      startDate: "2023-04-10", leaveBalanceDays: 25, leaveUsedDays: 7,  phonePersonal: "06-90123456", address: "Havenkade 55",        city: "Vlaardingen",           postalCode: "3131 AG" }),
    upsertProfile(uRobert,  { department: "Montage",       startDate: "2020-05-01", leaveBalanceDays: 28, leaveUsedDays: 0,  phonePersonal: "06-01234567", address: "Molenstraat 9",       city: "Spijkenisse",           postalCode: "3201 BG" }),
  ]);
  console.log("  ✓ 10 profiles");

  // ─── CONTRACTS ──────────────────────────────────────────────────────────────
  console.log("📄 Creating contracts...");
  const contracts = [
    { id: "c-arnout-1", employeeProfileId: pA,  contractType: "Onbepaalde tijd", contractSequence: 1, startDate: "2018-04-01",                         hoursPerWeek: 40, salaryGross: 5200, status: "ACTIVE"   },
    { id: "c-niels-1",  employeeProfileId: pN,  contractType: "Bepaalde tijd",   contractSequence: 1, startDate: "2022-03-15", endDate: "2023-03-14",   hoursPerWeek: 40, salaryGross: 2900, status: "EXPIRED"  },
    { id: "c-niels-2",  employeeProfileId: pN,  contractType: "Bepaalde tijd",   contractSequence: 2, startDate: "2023-03-15", endDate: "2024-03-14",   hoursPerWeek: 40, salaryGross: 3100, status: "EXPIRED"  },
    { id: "c-niels-3",  employeeProfileId: pN,  contractType: "Onbepaalde tijd", contractSequence: 3, startDate: "2024-03-15",                          hoursPerWeek: 40, salaryGross: 3400, status: "ACTIVE"   },
    { id: "c-jan-1",    employeeProfileId: pJ,  contractType: "Bepaalde tijd",   contractSequence: 1, startDate: "2023-06-01", endDate: "2024-05-31", probationEndDate: "2023-07-31", hoursPerWeek: 40, salaryGross: 2600, status: "EXPIRED" },
    { id: "c-jan-2",    employeeProfileId: pJ,  contractType: "Bepaalde tijd",   contractSequence: 2, startDate: "2024-06-01", endDate: from(25).slice(0,10), hoursPerWeek: 40, salaryGross: 2800, status: "ACTIVE" },
    { id: "c-sophie-1", employeeProfileId: pS,  contractType: "Bepaalde tijd",   contractSequence: 1, startDate: "2024-01-15", endDate: from(44).slice(0,10), probationEndDate: "2024-03-14", hoursPerWeek: 32, salaryGross: 2400, status: "ACTIVE" },
    { id: "c-pieter-1", employeeProfileId: pPi, contractType: "Bepaalde tijd",   contractSequence: 1, startDate: "2023-09-01", endDate: "2024-08-31", probationEndDate: "2023-10-31", hoursPerWeek: 40, salaryGross: 2500, status: "EXPIRED" },
    { id: "c-pieter-2", employeeProfileId: pPi, contractType: "Onbepaalde tijd", contractSequence: 2, startDate: "2024-09-01",                          hoursPerWeek: 40, salaryGross: 2750, status: "ACTIVE"   },
    { id: "c-mark-1",   employeeProfileId: pM,  contractType: "Onbepaalde tijd", contractSequence: 1, startDate: "2021-07-01",                          hoursPerWeek: 40, salaryGross: 3200, status: "ACTIVE"   },
    { id: "c-lisa-1",   employeeProfileId: pL,  contractType: "Bepaalde tijd",   contractSequence: 1, startDate: "2024-03-01", endDate: from(15).slice(0,10), probationEndDate: "2024-04-30", hoursPerWeek: 24, salaryGross: 1800, status: "ACTIVE" },
    { id: "c-tom-1",    employeeProfileId: pT,  contractType: "Onbepaalde tijd", contractSequence: 1, startDate: "2022-11-01",                          hoursPerWeek: 40, salaryGross: 2900, status: "ACTIVE"   },
    { id: "c-emma-1",   employeeProfileId: pE,  contractType: "Bepaalde tijd",   contractSequence: 1, startDate: "2023-04-10", endDate: "2024-04-09",   hoursPerWeek: 32, salaryGross: 2100, status: "EXPIRED"  },
    { id: "c-emma-2",   employeeProfileId: pE,  contractType: "Bepaalde tijd",   contractSequence: 2, startDate: "2024-04-10", endDate: from(75).slice(0,10), hoursPerWeek: 32, salaryGross: 2250, status: "ACTIVE" },
    { id: "c-robert-1", employeeProfileId: pR,  contractType: "Onbepaalde tijd", contractSequence: 1, startDate: "2020-05-01",                          hoursPerWeek: 40, salaryGross: 3000, status: "ACTIVE"   },
  ];
  for (const c of contracts) {
    await supabase.from("Contract").upsert(c, { onConflict: "id", ignoreDuplicates: true });
  }
  console.log("  ✓ 15 contracts");

  // ─── LEAVE REQUESTS ──────────────────────────────────────────────────────────
  console.log("🏖️  Creating leave requests...");
  const leaveRows = [
    { id: "lr-niels-1",   employeeProfileId: pN,  type: "VACATION", status: "APPROVED", startDate: from(21).slice(0,10), endDate: from(25).slice(0,10),   totalDays: 5, reason: "Zomervakantie Spanje",          approvedById: uArnout, respondedAt: ago(2)  },
    { id: "lr-mark-1",    employeeProfileId: pM,  type: "VACATION", status: "APPROVED", startDate: ago(14).slice(0,10),  endDate: ago(10).slice(0,10),     totalDays: 5, reason: "Vakantie",                      approvedById: uArnout, respondedAt: ago(20) },
    { id: "lr-pieter-1",  employeeProfileId: pPi, type: "VACATION", status: "APPROVED", startDate: ago(60).slice(0,10),  endDate: ago(56).slice(0,10),     totalDays: 5, reason: "Wintersport",                   approvedById: uArnout, respondedAt: ago(70) },
    { id: "lr-jan-1",     employeeProfileId: pJ,  type: "VACATION", status: "PENDING",  startDate: from(35).slice(0,10), endDate: from(42).slice(0,10),    totalDays: 6, reason: "Meivakantie met gezin"                                                      },
    { id: "lr-sophie-1",  employeeProfileId: pS,  type: "VACATION", status: "PENDING",  startDate: from(14).slice(0,10), endDate: from(18).slice(0,10),    totalDays: 5, reason: "Familiebezoek België"                                                        },
    { id: "lr-tom-1",     employeeProfileId: pT,  type: "SPECIAL",  status: "APPROVED", startDate: ago(5).slice(0,10),   endDate: ago(5).slice(0,10),      totalDays: 1, reason: "Huwelijksverjaardag 25 jaar",    approvedById: uArnout, respondedAt: ago(10) },
    { id: "lr-emma-1",    employeeProfileId: pE,  type: "VACATION", status: "REJECTED", startDate: from(7).slice(0,10),  endDate: from(9).slice(0,10),     totalDays: 3, reason: "Kortje weg", notes: "Niet mogelijk vanwege drukte in magazijn.", approvedById: uArnout, respondedAt: ago(1) },
    { id: "lr-lisa-s1",   employeeProfileId: pL,  type: "SICK",     status: "APPROVED", startDate: ago(43).slice(0,10),                                                  reason: "Griep / uitgevallen",            approvedById: uArnout, respondedAt: ago(43) },
    { id: "lr-robert-s1", employeeProfileId: pR,  type: "SICK",     status: "APPROVED", startDate: ago(185).slice(0,10),                                                 reason: "Rugklachten",                    approvedById: uArnout, respondedAt: ago(185)},
  ];
  for (const r of leaveRows) {
    await supabase.from("LeaveRequest").upsert(r, { onConflict: "id", ignoreDuplicates: true });
  }
  console.log("  ✓ 9 leave requests");

  // ─── SICK TRACKERS ───────────────────────────────────────────────────────────
  console.log("🏥 Creating sick trackers...");
  await supabase.from("SickTracker").upsert([
    { id: "st-lisa-1",   employeeProfileId: pL, sicknessStartDate: ago(43).slice(0,10),  week6ProblemAnalysis: false, week8ActionPlan: false,  week42UwvNotification: false, notes: "Griepvirus. Huisarts dag 5. Week 6 probleemanalyse OVERDUE." },
    { id: "st-robert-1", employeeProfileId: pR, sicknessStartDate: ago(185).slice(0,10), week6ProblemAnalysis: true,  week6CompletedAt: ago(143), week8ActionPlan: true, week8CompletedAt: ago(129), week42UwvNotification: false, notes: "Hernia L4/L5. Fysiotherapie gestart week 10. Re-integratieplan opgesteld." },
  ], { onConflict: "id", ignoreDuplicates: true });
  console.log("  ✓ 2 sick trackers");

  // ─── DOSSIER ENTRIES ─────────────────────────────────────────────────────────
  console.log("📁 Creating dossier entries...");
  await supabase.from("DossierEntry").upsert([
    { id: "de-jan-1",    employeeProfileId: pJ,  date: ago(90).slice(0,10), type: "COMPLIMENT",  title: "Uitstekende verkoopcijfers Q4 2025",          description: "Jan heeft in Q4 2025 de hoogste conversieratio van het salesteam behaald (68%). Bijzondere inzet bij het binnenhalen van twee grote klanten in de Randstad.", attachments: [], loggedById: uArnout },
    { id: "de-jan-2",    employeeProfileId: pJ,  date: ago(15).slice(0,10), type: "WARNING",     title: "Te laat op klantafspraken",                   description: "Drie keer te laat op geplande klantafspraken in februari 2026. Besproken op 05-03-2026. Jan heeft toegezegd hier beter op te letten.", attachments: [], loggedById: uArnout },
    { id: "de-mark-1",   employeeProfileId: pM,  date: ago(30).slice(0,10), type: "PERFORMANCE", title: "Jaarlijks functioneringsgesprek 2025",         description: "Mark functioneert uitstekend. Technische vaardigheden: 5/5. Samenwerking: 4/5. Klantgerichtheid: 5/5. Aandachtspunt: administratie werkbonnen.", attachments: [], loggedById: uArnout },
    { id: "de-pieter-1", employeeProfileId: pPi, date: ago(8).slice(0,10),  type: "INCIDENT",    title: "Klacht schade bij installatie — Fam. de Groot", description: "Klant de Groot, Rotterdam — schade aan tegels bij plaatsing douchestoel. Pieter heeft excuses aangeboden. Schade vergoed via verzekering (€180).", attachments: [], loggedById: uArnout },
    { id: "de-sophie-1", employeeProfileId: pS,  date: ago(45).slice(0,10), type: "COMPLIMENT",  title: "Goed ingewerkt — toont initiatief",            description: "Sophie heeft in korte tijd het klantenbestand uitgebouwd. Zelf een lead generation actie opgezet via sociale media, met 12 nieuwe afspraken als resultaat.", attachments: [], loggedById: uArnout },
    { id: "de-lisa-1",   employeeProfileId: pL,  date: ago(43).slice(0,10), type: "NOTE",        title: "Ziekmelding — poortwachtertraject gestart",    description: "Lisa heeft zich ziekgemeld per 06-02-2026. Bedrijfsarts ingeschakeld. Week 6 probleemanalyse deadline: 20-03-2026.", attachments: [], loggedById: uArnout },
  ], { onConflict: "id", ignoreDuplicates: true });
  console.log("  ✓ 6 dossier entries");

  // ─── CANDIDATES ──────────────────────────────────────────────────────────────
  console.log("🎯 Creating candidates...");
  const candRows = [
    { id: "cand-1", status: "NEW_LEAD",       name: "Kevin Wolters",      email: "k.wolters@gmail.com",      phone: "06-11223344", age: 28, location: "Rotterdam",         currentJob: "Loodgieter",              salaryExpectation: "€2.400 – €2.800", leadSource: "Facebook Ads", leadCampaignId: "fb_spring_2026", consentGiven: true, consentDate: ago(1), consentExpiresAt: from(27) },
    { id: "cand-2", status: "NEW_LEAD",       name: "Daan Hoekstra",      email: "d.hoekstra@hotmail.com",   phone: "06-22334455", age: 34, location: "Delft",            currentJob: "Elektricien",             salaryExpectation: "€2.600 – €3.000", leadSource: "Facebook Ads", leadCampaignId: "fb_spring_2026", consentGiven: true, consentDate: ago(2), consentExpiresAt: from(26) },
    { id: "cand-3", status: "PRE_SCREENING",  name: "Sander Mulder",      email: "s.mulder@gmail.com",       phone: "06-33445566", age: 31, location: "Zoetermeer",       currentJob: "Timmerman",               salaryExpectation: "€2.500",           leadSource: "Indeed",        consentGiven: true, consentDate: ago(7), consentExpiresAt: from(21) },
    { id: "cand-4", status: "SCREENING_DONE", name: "Joris van der Laan", email: "joris.vdlaan@gmail.com",   phone: "06-44556677", age: 26, location: "Den Haag",         currentJob: "Werkzoekend",   livingSituation: "Samenwonend", partnerEmployment: "Ja, fulltime", reasonForLeaving: "Wil werken in de installatiebranche", salaryExpectation: "€2.200 – €2.500", leadSource: "Facebook Ads", consentGiven: true, consentDate: ago(10), consentExpiresAt: from(18) },
    { id: "cand-5", status: "INTERVIEW",      name: "Remon Visser",       email: "remon.visser@gmail.com",   phone: "06-55667788", age: 29, location: "Rotterdam",         currentJob: "Servicemonteur CV", livingSituation: "Samenwonend", partnerEmployment: "Ja, parttime", reasonForLeaving: "Meer doorgroeimogelijkheden", salaryExpectation: "€2.600 – €2.900", leadSource: "Facebook Ads", leadCampaignId: "fb_feb_2026", consentGiven: true, consentDate: ago(18), consentExpiresAt: from(10) },
    { id: "cand-6", status: "RESERVE_BANK",   name: "Fabian de Groot",    email: "f.degroot@outlook.com",    phone: "06-66778899", age: 33, location: "Schiedam",          currentJob: "Monteur badkamers", livingSituation: "Getrouwd", partnerEmployment: "Ja, fulltime", reasonForLeaving: "Vast dienstverband gewenst", salaryExpectation: "€2.700 – €3.100", leadSource: "Referral", consentGiven: true, consentDate: ago(30), consentExpiresAt: from(0) },
    { id: "cand-7", status: "REJECTED",       name: "Lars Bos",           email: "l.bos@gmail.com",          phone: "06-77889900", age: 22, location: "Capelle a/d IJssel",currentJob: "Student MBO", salaryExpectation: "€2.000", leadSource: "Facebook Ads", consentGiven: true, consentDate: ago(25), consentExpiresAt: from(3) },
  ];
  for (const c of candRows) {
    await supabase.from("Candidate").upsert(c, { onConflict: "id", ignoreDuplicates: true });
  }

  await supabase.from("InterviewScore").upsert([
    { id: "is-remon-1", candidateId: "cand-5", technicalSkills: 4, communication: 4, cultureFit: 5, reliability: 4, motivation: 5, overallImpression: 4, notes: "Sterke kandidaat. CV-installatie ervaring. Rijbewijs B. Beschikbaar per 1 april.", recommendation: "HIRE", interviewerId: uArnout, interviewDate: ago(3) },
  ], { onConflict: "id", ignoreDuplicates: true });

  await supabase.from("CandidateNote").upsert([
    { id: "cn-remon-1",  candidateId: "cand-5", content: "Telefonisch contact. Enthousiast. Rijbewijs B aanwezig. Beschikbaar per 1 april.", authorId: uNiels  },
    { id: "cn-joris-1",  candidateId: "cand-4", content: "Prescreening ontvangen. Motivatie goed. Geen directe installatieervaring maar leergierig.", authorId: uNiels  },
    { id: "cn-fabian-1", candidateId: "cand-6", content: "Goede kandidaat maar geen vacature. In reservebank gezet. Maandelijks contact onderhouden.", authorId: uArnout },
    { id: "cn-lars-1",   candidateId: "cand-7", content: "Te weinig werkervaring. Aangeraden MBO-4 af te ronden en opnieuw te solliciteren.", authorId: uArnout },
  ], { onConflict: "id", ignoreDuplicates: true });
  console.log("  ✓ 7 candidates + scores + notes");

  // ─── CUSTOMERS ──────────────────────────────────────────────────────────────
  console.log("🏠 Creating customers...");
  const custRows = [
    { id: "cu-1",  name: "Fam. de Boer",     email: "deboer@gmail.com",        phone: "010-4567890", address: "Kastanjeplein 14",        city: "Rotterdam",              postalCode: "3022 BH", notes: "Douche-aanpassing t.b.v. rollator" },
    { id: "cu-2",  name: "Fam. Janssen",     email: "c.janssen@outlook.com",   phone: "010-5678901", address: "Merelstraat 7",           city: "Rotterdam",              postalCode: "3031 GK" },
    { id: "cu-3",  name: "Dhr. van Rijn",    email: "r.vanrijn@gmail.com",     phone: "015-6789012", address: "Vondelkade 33",           city: "Delft",                  postalCode: "2624 AA", notes: "Woont alleen, mantelzorger aanwezig" },
    { id: "cu-4",  name: "Fam. Vermeulen",   email: "vermeulen.fam@gmail.com", phone: "070-7890123", address: "Laan van Meerdervoort 88", city: "Den Haag",               postalCode: "2517 AK" },
    { id: "cu-5",  name: "Mevr. Pietersen",  email: "a.pietersen@hotmail.com", phone: "010-8901234", address: "Carnisseweg 12",          city: "Rotterdam",              postalCode: "3083 JH", notes: "Rolstoelgebruiker — extra handgrepen gewenst" },
    { id: "cu-6",  name: "Dhr. van Leeuwen", email: "r.vanleeuwen@gmail.com",  phone: "015-9012345", address: "Brasserskade 4",          city: "Delft",                  postalCode: "2497 NX" },
    { id: "cu-7",  name: "Fam. Brouwer",     email: "brouwer.fam@gmail.com",   phone: "010-0123456", address: "Rubroekplein 3",          city: "Rotterdam",              postalCode: "3071 EL", notes: "Zorgverzekeraar CZ — declaratie loopt" },
    { id: "cu-8",  name: "Mevr. Schouten",   email: "m.schouten@gmail.com",    phone: "079-2345678", address: "Kerklaan 19",             city: "Zoetermeer",             postalCode: "2712 HK" },
    { id: "cu-9",  name: "Dhr. Hendriks",    email: "w.hendriks@outlook.com",  phone: "078-3456789", address: "Merwedestraat 66",        city: "Dordrecht",              postalCode: "3312 CB" },
    { id: "cu-10", name: "Fam. van Atten",   email: "vanat@gmail.com",         phone: "010-4567891", address: "Schiedamsedijk 44",       city: "Schiedam",               postalCode: "3111 LK", notes: "Spoedmontage gevraagd" },
  ];
  for (const c of custRows) {
    await supabase.from("Customer").upsert(c, { onConflict: "id", ignoreDuplicates: true });
  }
  console.log("  ✓ 10 customers");

  // ─── APPOINTMENTS ────────────────────────────────────────────────────────────
  console.log("📅 Creating appointments...");
  const custAddr = (id: string) => { const c = custRows.find(r => r.id === id); return c ? `${c.address}, ${c.city}` : ""; };

  const apptDefs = [
    // Past completed (adviseurs)
    { employeeProfileId: pJ,  customerId: "cu-1",  title: "Intake — Doucheaanpassing",    description: "Klant geïnteresseerd in beugels + stoel", date: ago(7).slice(0,10), startH: 9,  endH: 11, status: "COMPLETED", saleValue: 1850 },
    { employeeProfileId: pJ,  customerId: "cu-3",  title: "Intake — Beugels badkamer",    date: ago(5).slice(0,10), startH: 13, endH: 15, status: "COMPLETED", saleValue: 920  },
    { employeeProfileId: pJ,  customerId: "cu-7",  title: "Intake — Complete verbouwing", description: "Klant vindt prijs te hoog", date: ago(3).slice(0,10), startH: 10, endH: 12, status: "COMPLETED" },
    { employeeProfileId: pJ,  customerId: "cu-2",  title: "Intake — Douche aanpassen",    date: ago(1).slice(0,10), startH: 14, endH: 16, status: "COMPLETED", saleValue: 2100 },
    { employeeProfileId: pS,  customerId: "cu-5",  title: "Intake — Rolstoeltoegang",     description: "Uitgebreid pakket gewenst", date: ago(6).slice(0,10), startH: 9, endH: 11, status: "COMPLETED", saleValue: 3200 },
    { employeeProfileId: pS,  customerId: "cu-8",  title: "Intake — Antislip vloer",      date: ago(4).slice(0,10), startH: 11, endH: 13, status: "COMPLETED", saleValue: 650  },
    { employeeProfileId: pS,  customerId: "cu-9",  title: "Intake — Douchecabine",        description: "Klant gaat nog oriënteren", date: ago(2).slice(0,10), startH: 14, endH: 16, status: "COMPLETED" },
    // Past montage
    { employeeProfileId: pPi, customerId: "cu-1",  title: "Montage douchestoel + beugels",description: "Klant tevreden, netjes opgeleverd", date: ago(4).slice(0,10), startH: 8, endH: 12, status: "COMPLETED" },
    { employeeProfileId: pPi, customerId: "cu-3",  title: "Plaatsing wandbeugels",         date: ago(2).slice(0,10), startH: 9, endH: 11, status: "COMPLETED" },
    { employeeProfileId: pM,  customerId: "cu-5",  title: "Complete badkamer aanpassing",  description: "Beugels + drempelverwijdering + antislip", date: ago(3).slice(0,10), startH: 8, endH: 16, status: "COMPLETED" },
    { employeeProfileId: pM,  customerId: "cu-8",  title: "Plaatsing antislipvloer",       date: ago(1).slice(0,10), startH: 9, endH: 11, status: "COMPLETED" },
    // Upcoming
    { employeeProfileId: pJ,  customerId: "cu-4",  title: "Intake — Badkamer aanpassing",  date: from(1).slice(0,10), startH: 10, endH: 12, status: "SCHEDULED" },
    { employeeProfileId: pJ,  customerId: "cu-10", title: "Intake — Spoedaanvraag",        description: "Klant gevallen thuis — spoed", date: from(2).slice(0,10), startH: 13, endH: 15, status: "SCHEDULED" },
    { employeeProfileId: pS,  customerId: "cu-6",  title: "Intake — Douche rolstoel",      date: from(1).slice(0,10), startH: 14, endH: 16, status: "SCHEDULED" },
    { employeeProfileId: pS,  customerId: "cu-2",  title: "Follow-up gesprek",             date: from(3).slice(0,10), startH: 9,  endH: 11, status: "SCHEDULED" },
    { employeeProfileId: pPi, customerId: "cu-2",  title: "Montage beugelpakket",          date: from(2).slice(0,10), startH: 8,  endH: 12, status: "SCHEDULED" },
    { employeeProfileId: pPi, customerId: "cu-7",  title: "Montage douchestoel + beugels", date: from(4).slice(0,10), startH: 9,  endH: 14, status: "SCHEDULED" },
    { employeeProfileId: pM,  customerId: "cu-4",  title: "Volledige badkamerverbouwing",  date: from(3).slice(0,10), startH: 8,  endH: 16, status: "SCHEDULED" },
    { employeeProfileId: pM,  customerId: "cu-9",  title: "Plaatsing beugels + antislip",  date: from(5).slice(0,10), startH: 9,  endH: 12, status: "SCHEDULED" },
  ];
  for (const a of apptDefs) {
    const { employeeProfileId, customerId, title, description, date, startH, endH, status, saleValue } = a;
    await supabase.from("Appointment").insert({
      employeeProfileId, customerId, title,
      description: description ?? null,
      date,
      startTime: on(date + "T00:00:00Z", startH),
      endTime:   on(date + "T00:00:00Z", endH),
      location: custAddr(customerId),
      status,
      saleValue: saleValue ?? null,
      toolsList: [],
      createdById: uNiels,
    });
  }
  console.log("  ✓ 19 appointments");

  // ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
  console.log("🔔 Creating notifications...");
  const notifRows = [
    { userId: uArnout, type: "CONTRACT_EXPIRING", title: "Contract verloopt — Lisa Jansen",       message: "Het contract van Lisa Jansen verloopt over 15 dagen (4 april 2026). Actie vereist.",       linkUrl: "/dashboard/personeel",  isRead: false },
    { userId: uArnout, type: "CONTRACT_EXPIRING", title: "Contract verloopt — Jan de Vries",       message: "Het contract van Jan de Vries verloopt over 25 dagen (14 april 2026).",                    linkUrl: "/dashboard/personeel",  isRead: false },
    { userId: uArnout, type: "LEAVE_REQUEST",     title: "Verlofaanvraag — Jan de Vries",          message: "Jan de Vries vraagt 6 vakantiedagen aan (24 apr – 1 mei 2026).",                           linkUrl: "/dashboard/verzuim",    isRead: false },
    { userId: uArnout, type: "LEAVE_REQUEST",     title: "Verlofaanvraag — Sophie van den Berg",   message: "Sophie van den Berg vraagt 5 vakantiedagen aan (3–7 april 2026).",                         linkUrl: "/dashboard/verzuim",    isRead: false },
    { userId: uArnout, type: "SICK_REPORT",       title: "Poortwachter week 6 — Lisa Jansen",      message: "Lisa Jansen is 6+ weken ziek. Week 6 probleemanalyse is nog niet afgerond. Actie vereist!", linkUrl: "/dashboard/verzuim",   isRead: false },
    { userId: uArnout, type: "NEW_CANDIDATE",     title: "Nieuwe kandidaat — Kevin Wolters",        message: "Kevin Wolters aangemeld via Facebook Ads. Bekijk het profiel.",                            linkUrl: "/dashboard/werving",    isRead: true  },
    { userId: uNiels,  type: "CONTRACT_EXPIRING", title: "Contract verloopt — Lisa Jansen",        message: "Het contract van Lisa Jansen verloopt over 15 dagen.",                                      linkUrl: "/dashboard/rapportage", isRead: false },
    { userId: uNiels,  type: "NEW_CANDIDATE",     title: "Nieuwe kandidaat — Daan Hoekstra",        message: "Daan Hoekstra aangemeld via Facebook Ads. Bel voor prescreening.",                         linkUrl: "/dashboard/werving",    isRead: false },
    { userId: uSophie, type: "LEAVE_REQUEST",     title: "Verlofaanvraag ingediend",               message: "Je verlofaanvraag voor 3–7 april 2026 is ingediend.",                                       linkUrl: "/dashboard/mijn-verlof",isRead: false },
    { userId: uEmma,   type: "LEAVE_REJECTED",    title: "Verlofaanvraag afgewezen",               message: "Je verlofaanvraag voor 27–29 maart 2026 is afgewezen. Niet mogelijk vanwege drukte.",       linkUrl: "/dashboard/mijn-verlof",isRead: false },
    { userId: uJan,    type: "LEAVE_REQUEST",     title: "Verlofaanvraag ingediend",               message: "Je verlofaanvraag voor 24 apr – 1 mei 2026 is ontvangen en wordt beoordeeld.",              linkUrl: "/dashboard/mijn-verlof",isRead: true  },
  ];
  await supabase.from("Notification").insert(notifRows);
  console.log("  ✓ 11 notifications");

  // ─── DONE ────────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed completed!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DEMO ACCOUNTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  admin@veiligdouchen.nl     / Admin2024!    (Admin)");
  console.log("  niels@veiligdouchen.nl     / Planner2024!  (Planner)");
  console.log("  adviseur@veiligdouchen.nl  / Adviseur2024! (Adviseur)");
  console.log("  monteur@veiligdouchen.nl   / Monteur2024!  (Monteur)");
  console.log("  sophie@veiligdouchen.nl    / Demo2024!     (Adviseur)");
  console.log("  mark@veiligdouchen.nl      / Demo2024!     (Monteur)");
  console.log("  lisa@veiligdouchen.nl      / Demo2024!     (Callcenter — ziek)");
  console.log("  tom@veiligdouchen.nl       / Demo2024!     (Backoffice)");
  console.log("  emma@veiligdouchen.nl      / Demo2024!     (Warehouse)");
  console.log("  robert@veiligdouchen.nl    / Demo2024!     (Monteur — langdurig ziek)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
