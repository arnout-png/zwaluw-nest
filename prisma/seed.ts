/**
 * ZwaluwNest — Seed Script
 * Uses Supabase admin client (bypasses RLS), same as the app does at runtime.
 * Only seeds real users, job openings, screening scripts, and interview checklists.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function upsertUser(data: {
  email: string; passwordHash: string; name: string; role: string; jobTitle?: string;
  permissions?: string;
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
    const { data: existing } = await supabase.from("EmployeeProfile").select("id").eq("userId", userId).single();
    if (existing) return existing.id as string;
    throw new Error(`Profile upsert (${userId}): ${error.message}`);
  }
  return row!.id as string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} ontbreekt — zet hem in .env voor je seedt.`);
  return value;
}

async function main() {
  console.log("Seeding ZwaluwNest...\n");

  // ─── PASSWORDS ───────────────────────────────────────────────────────────────
  // Nooit hardcoderen: deze repo is publiek. Zet ze in .env (die is gitignored).
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const managerPassword = requireEnv("SEED_MANAGER_PASSWORD");

  const [adminHash, managerHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(managerPassword, 12),
  ]);

  const managerPerms = JSON.stringify({
    extraNav: [],
    canManageLeave: false,
    canViewAllCandidates: true,
    canEditCandidates: true,
    canViewSalaries: false,
    canViewDossiers: false,
  });

  // ─── USERS ──────────────────────────────────────────────────────────────────
  console.log("Creating users...");
  const [uArnout] = await Promise.all([
    upsertUser({ email: "arnout@veiligdouchen.nl", passwordHash: adminHash, name: "Arnout van der Berg", role: "ADMIN", jobTitle: "Directeur" }),
    upsertUser({ email: "nvdgroep@veiligdouchen.nl", passwordHash: managerHash, name: "Niels van de Groep", role: "MANAGER", jobTitle: "Manager Monteurs", permissions: managerPerms }),
    upsertUser({ email: "vmachiels@veiligdouchen.nl", passwordHash: managerHash, name: "Vincent Machiels", role: "MANAGER", jobTitle: "Manager Sales", permissions: managerPerms }),
    upsertUser({ email: "claudia@veiligdouchen.nl", passwordHash: managerHash, name: "Claudia Duivenvoorden", role: "MANAGER", jobTitle: "Backoffice Manager", permissions: managerPerms }),
  ]);
  console.log("  4 users");

  // ─── JOB OPENINGS ─────────────────────────────────────────────────────────────
  console.log("Creating job openings...");
  const jobOpenings = [
    {
      id: "jo-monteur", slug: "installatiemonteur", title: "Installatiemonteur",
      description: "Als installatiemonteur bij Zwaluw Comfortsanitair plaats jij badkamer- en doucheaanpassingen bij senioren thuis. Je werkt zelfstandig, rijdt in een bedrijfsbus en hebt dagelijks contact met klanten.",
      requirements: "MBO-niveau in technische richting, rijbewijs B, klantgericht, zelfstandig, fysiek in orde",
      location: "Regio Rotterdam / Den Haag", hoursPerWeek: "40", salaryRange: "€2.400 – €3.000", roleType: "MONTEUR", isActive: true, createdById: uArnout,
    },
    {
      id: "jo-adviseur", slug: "sales-adviseur", title: "Sales Adviseur Buitendienst",
      description: "Als sales adviseur bezoek jij senioren thuis voor een vrijblijvend adviesgesprek. Je inventariseert de wensen en maakt een passend aanbod. Geen koude acquisitie — alle afspraken worden centraal ingepland.",
      requirements: "Commerciële ervaring, rijbewijs B, communicatief sterk, empathisch, resultaatgericht",
      location: "Regio Rotterdam / Den Haag / Delft", hoursPerWeek: "40", salaryRange: "€2.600 – €3.200 + provisie", roleType: "ADVISEUR", isActive: true, createdById: uArnout,
    },
    {
      id: "jo-binnendienst-technisch", slug: "technische-binnendienst", title: "Technische Binnendienst Medewerker",
      description: "Jij bent de schakel tussen monteurs in het veld en de planning. Je verwerkt werkbonnen, beheert de monteurscommunicatie en signaleert knelpunten proactief.",
      requirements: "Technische achtergrond of affiniteit, ervaring met werkbonbeheer of ERP, gestructureerd, goed in prioriteren",
      location: "Rotterdam", hoursPerWeek: "40", salaryRange: "€2.400 – €2.900", roleType: "BINNENDIENST_TECHNISCH", isActive: true, createdById: uArnout,
    },
    {
      id: "jo-callcenter", slug: "callcenter-medewerker", title: "Callcenter Medewerker",
      description: "Als callcenter medewerker ben jij het eerste aanspreekpunt voor onze klanten. Je plant afspraken in, beantwoordt vragen en lost klachten op — altijd vriendelijk en oplossingsgedreven.",
      requirements: "Ervaring in klantcontact of callcenter, CRM-kennis is een pré, stressbestendig, goede communicatie",
      location: "Rotterdam", hoursPerWeek: "24", salaryRange: "€1.800 – €2.200", roleType: "BINNENDIENST_CALLCENTER", isActive: true, createdById: uArnout,
    },
    {
      id: "jo-warehouse", slug: "magazijnmedewerker", title: "Magazijnmedewerker",
      description: "Jij zorgt dat alle monteurs elke dag met de juiste materialen op pad gaan. Je beheert de voorraad, verwerkt inkomende leveringen en bereidt de dagelijkse materiaalsets voor.",
      requirements: "Logistieke ervaring, bij voorkeur heftruckcertificaat, nauwkeurig, fysiek belastbaar, teamspeler",
      location: "Rotterdam", hoursPerWeek: "40", salaryRange: "€2.100 – €2.600", roleType: "WAREHOUSE", isActive: true, createdById: uArnout,
    },
    {
      id: "jo-backoffice", slug: "backoffice-medewerker", title: "Backoffice Medewerker",
      description: "Als backoffice medewerker verwerk jij offertes, facturen en garantieclaims. Je werkt nauw samen met planning en sales en zorgt dat de administratie altijd op orde is.",
      requirements: "MBO+ administratieve opleiding, ervaring met financiële administratie, Excel, zelfstandig, nauwkeurig",
      location: "Rotterdam", hoursPerWeek: "32", salaryRange: "€2.200 – €2.700", roleType: "BACKOFFICE", isActive: true, createdById: uArnout,
    },
  ];
  for (const jo of jobOpenings) {
    await supabase.from("JobOpening").upsert(jo, { onConflict: "id", ignoreDuplicates: true });
  }
  console.log("  6 job openings");

  // ─── SCREENING SCRIPTS ────────────────────────────────────────────────────────
  console.log("Creating screening scripts...");
  const scriptDefs: Array<{
    id: string; name: string; description: string; roleType: string; createdById: string;
    questions: Array<{ question: string; placeholder: string; required: boolean }>;
  }> = [
    {
      id: "ss-monteur", name: "Pre-screening Installatiemonteur", description: "Standaard prescreening voor monteur-sollicitanten", roleType: "MONTEUR", createdById: uArnout,
      questions: [
        { question: "Wat is uw hoogst afgeronde opleiding en in welke richting?", placeholder: "Bijv. MBO Installatietechniek niveau 3", required: true },
        { question: "Hoeveel jaar werkervaring heeft u in de installatie- of bouwbranche?", placeholder: "Bijv. 4 jaar als loodgieter bij een installatiebedrijf", required: true },
        { question: "Heeft u ervaring met het plaatsen van sanitaire voorzieningen (douche, bad, beugels)?", placeholder: "Bijv. ja, 2 jaar ervaring bij een badkamerbedrijf", required: true },
        { question: "Beschikt u over een geldig rijbewijs B en heeft u dagelijks toegang tot eigen vervoer?", placeholder: "Ja / Nee", required: true },
        { question: "Heeft u ervaring met werken bij mensen thuis, bij voorkeur senioren?", placeholder: "Bijv. ja, bij thuiszorginstelling of particuliere klanten", required: false },
        { question: "Wat is uw salarisverwachting per maand (bruto, fulltime)?", placeholder: "Bijv. €2.500 – €2.800", required: true },
        { question: "Wanneer zou u beschikbaar zijn om te starten?", placeholder: "Bijv. per 1 april 2026 of na opzegtermijn van 1 maand", required: true },
      ],
    },
    {
      id: "ss-adviseur", name: "Pre-screening Sales Adviseur", description: "Prescreening voor sales buitendienst sollicitanten", roleType: "ADVISEUR", createdById: uArnout,
      questions: [
        { question: "Wat voor commerciële werkervaring heeft u en in welke branche?", placeholder: "Bijv. 3 jaar als accountmanager bij een energiebedrijf", required: true },
        { question: "Aan welke doelgroep heeft u eerder producten of diensten verkocht?", placeholder: "Bijv. particulieren, zakelijk, senioren", required: true },
        { question: "Hoe gaat u om met een bezwaar als een klant zegt 'ik moet er nog even over nadenken'?", placeholder: "Beschrijf uw aanpak kort", required: true },
        { question: "Heeft u ervaring met het voeren van gesprekken bij senioren thuis?", placeholder: "Bijv. ja, via zorgverzekeraar of thuiszorgorganisatie", required: false },
        { question: "Beschikt u over rijbewijs B en bent u bereid in de regio Rotterdam/Den Haag te rijden?", placeholder: "Ja / Nee + eventuele voorkeurregio", required: true },
        { question: "Wat verwacht u te verdienen (basissalaris + verwachte provisie)?", placeholder: "Bijv. €2.800 basis + €500–€1.000 provisie", required: true },
        { question: "Per wanneer bent u beschikbaar?", placeholder: "Bijv. direct beschikbaar of per 15 april", required: true },
      ],
    },
    {
      id: "ss-binnendienst-technisch", name: "Pre-screening Technische Binnendienst", description: "Prescreening voor technisch binnendienst medewerkers", roleType: "BINNENDIENST_TECHNISCH", createdById: uArnout,
      questions: [
        { question: "Heeft u een technische opleiding of achtergrond? Zo ja, welke?", placeholder: "Bijv. MBO Werktuigbouwkunde of ervaring in de installatiebranche", required: true },
        { question: "Heeft u ervaring met het verwerken en administreren van werkbonnen?", placeholder: "Bijv. ja, via een servicebedrijf of montageorganisatie", required: true },
        { question: "Met welke ERP- of planningssystemen heeft u gewerkt?", placeholder: "Bijv. Exact, AFAS, Simplicate, of eigen planningstools", required: false },
        { question: "Hoe prioriteert u taken als er tegelijk meerdere monteurs bellen met urgente meldingen?", placeholder: "Beschrijf uw werkwijze of geef een voorbeeld", required: true },
        { question: "Heeft u ervaring met het telefonisch ondersteunen van vakmensen in het veld?", placeholder: "Bijv. ja, als werkvoorbereider of calculator", required: false },
        { question: "Wat is uw salarisverwachting per maand (bruto, fulltime)?", placeholder: "Bijv. €2.500 – €2.800", required: true },
      ],
    },
    {
      id: "ss-callcenter", name: "Pre-screening Callcenter Medewerker", description: "Prescreening voor callcenter en klantcontact sollicitanten", roleType: "BINNENDIENST_CALLCENTER", createdById: uArnout,
      questions: [
        { question: "Heeft u eerder in een callcenter of soortgelijke klantcontactrol gewerkt?", placeholder: "Bijv. 2 jaar bij een zorgverzekeraar of gemeentelijk KCC", required: true },
        { question: "Hoe pakt u een gesprek aan met een boze klant die een klacht heeft over de service?", placeholder: "Beschrijf uw aanpak stap voor stap", required: true },
        { question: "Hoeveel gesprekken per dag hanteerde u gemiddeld in uw vorige rol?", placeholder: "Bijv. 40–60 inbound gesprekken per dag", required: false },
        { question: "Heeft u ervaring met het werken in een CRM- of planningssysteem?", placeholder: "Bijv. Salesforce, HubSpot, eigen planning-tool", required: false },
        { question: "Hoeveel uur per week bent u beschikbaar en op welke dagen?", placeholder: "Bijv. 24 uur, maandag t/m donderdag", required: true },
        { question: "Wat is uw salarisverwachting per maand (bruto)?", placeholder: "Bijv. €1.800 – €2.000 bij 24 uur", required: true },
      ],
    },
    {
      id: "ss-warehouse", name: "Pre-screening Magazijnmedewerker", description: "Prescreening voor magazijn en logistiek sollicitanten", roleType: "WAREHOUSE", createdById: uArnout,
      questions: [
        { question: "Heeft u eerder in een magazijn of logistieke omgeving gewerkt?", placeholder: "Bijv. orderpicken, inboeken leveringen, voorraadbeheer bij een groothandel", required: true },
        { question: "Beschikt u over een geldig heftruckcertificaat?", placeholder: "Ja / Nee / In aanvraag", required: true },
        { question: "Hoe gaat u te werk bij het opsporen van een voorraadverschil?", placeholder: "Beschrijf uw aanpak of geef een voorbeeld", required: false },
        { question: "Bent u fysiek belastbaar en comfortabel met tillen tot 25 kg?", placeholder: "Ja / Nee, licht toelichting", required: true },
        { question: "Wat is uw salarisverwachting per maand (bruto, fulltime)?", placeholder: "Bijv. €2.100 – €2.400", required: true },
      ],
    },
    {
      id: "ss-backoffice", name: "Pre-screening Backoffice Medewerker", description: "Prescreening voor backoffice en administratieve sollicitanten", roleType: "BACKOFFICE", createdById: uArnout,
      questions: [
        { question: "Wat is uw hoogst afgeronde opleiding en in welke richting?", placeholder: "Bijv. MBO Bedrijfsadministratie niveau 4 of HBO Accountancy", required: true },
        { question: "Heeft u ervaring met het verwerken van facturen, offertes of garantieclaims?", placeholder: "Bijv. ja, 3 jaar bij een bouwbedrijf als administratief medewerker", required: true },
        { question: "Hoe organiseert u uw werkdag als u meerdere deadlines tegelijk heeft?", placeholder: "Beschrijf uw aanpak of gebruik van tools", required: true },
        { question: "Hoe beoordeelt u uw eigen Excel-vaardigheden op een schaal van 1–5?", placeholder: "Bijv. 4/5 — draaitabellen, VLOOKUP, conditionele opmaak", required: true },
        { question: "Kunt u zelfstandig werken zonder voortdurende aansturing?", placeholder: "Ja / Nee + kort voorbeeld", required: true },
        { question: "Wat is uw salarisverwachting per maand (bruto)?", placeholder: "Bijv. €2.200 – €2.500 bij 32 uur", required: true },
      ],
    },
  ];

  for (const s of scriptDefs) {
    const { error } = await supabase.from("ScreeningScript").upsert(
      { id: s.id, name: s.name, description: s.description, roleType: s.roleType, isActive: true, createdById: s.createdById },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (error && !error.message.includes("duplicate")) {
      console.error(`  Script ${s.id}: ${error.message}`); continue;
    }
    const { count } = await supabase.from("ScreeningQuestion").select("id", { count: "exact", head: true }).eq("scriptId", s.id);
    if (!count) {
      await supabase.from("ScreeningQuestion").insert(s.questions.map((q, i) => ({
        scriptId: s.id, question: q.question, placeholder: q.placeholder || null, required: q.required, order: i + 1,
      })));
    }
  }
  console.log("  6 screening scripts");

  // ─── INTERVIEW CHECKLISTS ─────────────────────────────────────────────────────
  console.log("Creating interview checklists...");
  const checklistDefs: Array<{
    id: string; name: string; description: string; roleType: string; createdById: string;
    items: Array<{ label: string; description?: string }>;
  }> = [
    {
      id: "ic-monteur", name: "Interview Checklist Installatiemonteur", description: "Standaard interviewchecklist voor monteur-sollicitanten", roleType: "MONTEUR", createdById: uArnout,
      items: [
        { label: "Welkom & bedrijfspresentatie", description: "Zwaluw Comfortsanitair introduceren: missie, doelgroep senioren, werkgebied" },
        { label: "Diploma en certificaten controleren", description: "MBO-diploma in technische richting inzien of kopiëren" },
        { label: "Werkervaring installatiewerk doorlopen", description: "Concreet navragen: welke projecten, zelfstandig of in team?" },
        { label: "Rijbewijs B inzien", description: "Geldig rijbewijs voor de bedrijfsbus is vereist" },
        { label: "Casus: klant in paniek over beschadiging", description: "Hoe reageert kandidaat? Test klantgerichtheid en kalmte" },
        { label: "Beschikbaarheid en opzegtermijn bevestigen" },
        { label: "Arbeidsvoorwaarden toelichten", description: "Salaris, reiskosten, gereedschapsvergoeding, collectieve verzekering" },
        { label: "Referentie opvragen", description: "Minimaal één werkgever als referentie" },
        { label: "Vervolgprocedure uitleggen", description: "Termijn terugkoppeling, eventueel tweede gesprek of proefdag" },
      ],
    },
    {
      id: "ic-adviseur", name: "Interview Checklist Sales Adviseur", description: "Interviewchecklist voor sales buitendienst sollicitanten", roleType: "ADVISEUR", createdById: uArnout,
      items: [
        { label: "Welkom & verkoopstrategie uitleggen", description: "Lead-gedreven model: geen koude acquisitie, ingeplande afspraken" },
        { label: "Commercieel track record doorlopen", description: "Concrete cijfers: conversiepercentage, gemiddelde orderwaarde" },
        { label: "Rollenspel: intake-gesprek bij senior thuis", description: "Kandidaat speelt adviseur, interviewer speelt sceptische senior" },
        { label: "Empathie voor senioren beoordelen" },
        { label: "Bezwaarafhandeling doorlopen", description: "Stel bezwaar voor: 'Ik wil het eerst met mijn kinderen bespreken'" },
        { label: "Rijbewijs B + reisbereidheid bevestigen" },
        { label: "Provisiestructuur en verdienmodel uitleggen" },
        { label: "Referentie opvragen", description: "Bij voorkeur een vorige salesmanager als referentie" },
      ],
    },
    {
      id: "ic-binnendienst-technisch", name: "Interview Checklist Technische Binnendienst", description: "Interviewchecklist voor technisch binnendienst medewerkers", roleType: "BINNENDIENST_TECHNISCH", createdById: uArnout,
      items: [
        { label: "Welkom & takenoverzicht presenteren" },
        { label: "Technische kennis beoordelen", description: "Kent kandidaat basisbegrippen installatietechniek?" },
        { label: "ERP- en systemenervaring navragen" },
        { label: "Stress-scenario: 3 monteurs bellen tegelijk" },
        { label: "Nauwkeurigheid en foutpreventie bespreken" },
        { label: "Beschikbaarheid en werkuren bevestigen" },
        { label: "Arbeidsvoorwaarden toelichten" },
      ],
    },
    {
      id: "ic-callcenter", name: "Interview Checklist Callcenter Medewerker", description: "Interviewchecklist voor callcenter en klantcontact sollicitanten", roleType: "BINNENDIENST_CALLCENTER", createdById: uArnout,
      items: [
        { label: "Welkom & rol uitleggen" },
        { label: "Klantenservice-ervaring beoordelen" },
        { label: "Telefonische presentatie beoordelen", description: "Kandidaat belt als 'Zwaluw medewerker' — beoordeel stem, intonatie, helderheid" },
        { label: "Klachtenscenario doorlopen" },
        { label: "Planningssoftware en CRM navragen" },
        { label: "Uren en roostersysteem bespreken" },
        { label: "Taalvaardigheid Nederlands beoordelen" },
        { label: "Arbeidsvoorwaarden toelichten" },
        { label: "Referentie opvragen" },
      ],
    },
    {
      id: "ic-warehouse", name: "Interview Checklist Magazijnmedewerker", description: "Interviewchecklist voor magazijn en logistiek sollicitanten", roleType: "WAREHOUSE", createdById: uArnout,
      items: [
        { label: "Welkom & rondleiding magazijn" },
        { label: "Logistieke werkervaring doorlopen" },
        { label: "Heftruckcertificaat controleren" },
        { label: "Fysieke belastbaarheid bespreken" },
        { label: "Nauwkeurigheid voorraadbeheer testen" },
        { label: "Veiligheidsbewustzijn beoordelen" },
        { label: "Werktijden en vroege diensten bevestigen" },
        { label: "Salaris en CAO toelichten" },
        { label: "Vervolgprocedure uitleggen" },
      ],
    },
    {
      id: "ic-backoffice", name: "Interview Checklist Backoffice Medewerker", description: "Interviewchecklist voor backoffice en administratieve sollicitanten", roleType: "BACKOFFICE", createdById: uArnout,
      items: [
        { label: "Welkom & procesuitleg", description: "Offertes → werkbonnen → facturen → garantieclaims flow" },
        { label: "Opleiding en achtergrond doorlopen" },
        { label: "Financiële administratie-ervaring navragen" },
        { label: "Excel live-check uitvoeren" },
        { label: "Zelforganisatie en planning bevragen" },
        { label: "Garantieclaim-scenario doorlopen" },
        { label: "Communicatie met andere afdelingen beoordelen" },
        { label: "Beschikbaarheid en werkdagen bevestigen" },
        { label: "Salaris en arbeidsvoorwaarden toelichten" },
      ],
    },
  ];

  for (const cl of checklistDefs) {
    const { error } = await supabase.from("InterviewChecklist").upsert(
      { id: cl.id, name: cl.name, description: cl.description, roleType: cl.roleType, isActive: true, createdById: cl.createdById },
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (error && !error.message.includes("duplicate")) {
      console.error(`  Checklist ${cl.id}: ${error.message}`); continue;
    }
    const { count } = await supabase.from("InterviewChecklistItem").select("id", { count: "exact", head: true }).eq("checklistId", cl.id);
    if (!count) {
      await supabase.from("InterviewChecklistItem").insert(cl.items.map((item, i) => ({
        checklistId: cl.id, label: item.label, description: item.description ?? null, order: i + 1,
      })));
    }
  }
  console.log("  6 interview checklists");

  // ─── DONE ────────────────────────────────────────────────────────────────────
  console.log("\nSeed completed!\n");
  console.log("  ACCOUNTS");
  console.log("  arnout@veiligdouchen.nl     (ADMIN)    — SEED_ADMIN_PASSWORD");
  console.log("  nvdgroep@veiligdouchen.nl   (MANAGER)  — SEED_MANAGER_PASSWORD");
  console.log("  vmachiels@veiligdouchen.nl  (MANAGER)  — SEED_MANAGER_PASSWORD");
  console.log("  claudia@veiligdouchen.nl    (MANAGER)  — SEED_MANAGER_PASSWORD");
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
