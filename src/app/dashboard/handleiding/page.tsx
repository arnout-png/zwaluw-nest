import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { FeedbackForm } from './feedback-form';

const ROLE_LABELS: Record<string, string> = {
  MONTEUR: 'Installatiemonteur',
  ADVISEUR: 'Sales adviseur',
  BINNENDIENST_TECHNISCH: 'Technische binnendienst',
  BINNENDIENST_CALLCENTER: 'Callcenter medewerker',
  WAREHOUSE: 'Magazijnmedewerker',
  BACKOFFICE: 'Backoffice medewerker',
};

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-purple-500/20 text-purple-300',
  'bg-orange-500/20 text-orange-300',
  'bg-pink-500/20 text-pink-300',
  'bg-teal-500/20 text-teal-300',
];

const pipeline = [
  {
    label: 'Nieuw lead',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    dot: 'bg-blue-400',
    description: 'Lead binnengekomen via Meta-advertentie of handmatige toevoeging. Nog geen contact geweest.',
  },
  {
    label: 'Pre-screening',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dot: 'bg-purple-400',
    description: 'Contact gehad, prescreeningsgesprek gestart. Kandidaat beantwoordt kwalificatievragen.',
  },
  {
    label: 'Screening klaar',
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    dot: 'bg-yellow-400',
    description: 'Prescreening ingevuld en positief beoordeeld. Klaar om een afspraak in te plannen.',
  },
  {
    label: 'Gesprek',
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    dot: 'bg-orange-400',
    description: 'Sollicitatiegesprek ingepland of al gevoerd. Uitkomst nog vast te leggen.',
  },
  {
    label: 'Reservebank',
    color: 'bg-teal-500/10 text-[#68b0a6] border-teal-500/20',
    dot: 'bg-[#68b0a6]',
    description: 'Positief gesprek, maar (nog) geen plek beschikbaar. Kandidaat bewaren voor de toekomst.',
  },
  {
    label: 'Aangenomen',
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
    dot: 'bg-green-400',
    description: 'Kandidaat aangenomen en omgezet naar medewerker in het systeem.',
  },
  {
    label: 'Afgewezen',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    dot: 'bg-red-400',
    description: 'Kandidaat niet geschikt of heeft zelf afgehaakt. Optioneel: automatische afwijzingsmail.',
  },
];

const steps = [
  {
    title: 'Melding ontvangen',
    body: 'Je ontvangt een e-mailmelding zodra er een nieuwe kandidaat aan jou is toegewezen. Open ZwaluwNest en ga naar Werving.',
  },
  {
    title: 'Kandidaat bekijken',
    body: 'Klik op de kandidaatkaart om het profiel te openen. Hier vind je contactgegevens, de campagne waaruit de lead afkomstig is en eventuele notities van collega\'s.',
  },
  {
    title: 'Bellen & loggen',
    body: 'Bel de kandidaat en leg het resultaat direct vast: "Geen gehoor", "Voicemail" of "Contact". Geen losse aantekeningen meer — alles staat in het systeem.',
  },
  {
    title: 'Prescreening starten',
    body: 'Bij contact klik je op "Prescreening starten". Er verschijnen kwalificatievragen die je samen met de kandidaat doorloopt. Pas daarna plan je een afspraak in.',
  },
  {
    title: 'Afspraak inplannen',
    body: 'Klik op "Afspraak plannen" en kies datum, tijd en locatie. Kandidaat en recruiter ontvangen automatisch een bevestigingsmail.',
  },
  {
    title: 'Gesprek voeren',
    body: 'ZwaluwNest is volledig mobiel responsive — neem je telefoon mee het gesprek in. De sollicitatievragen staan in de app. Na afloop leg je de uitkomst vast.',
  },
  {
    title: 'Uitkomst vastleggen',
    body: 'Zet de kandidaat op Aangenomen, Reservebank of Afgewezen. Bij afwijzing stuurt het systeem automatisch een nette mail — dit is per automation in/uit te zetten via Instellingen.',
  },
];

const tips = [
  {
    icon: '📱',
    title: 'Mobiel responsive',
    body: 'ZwaluwNest werkt volledig op je telefoon. Kandidaatgegevens en gespreksvragen altijd bij de hand.',
  },
  {
    icon: '🗑️',
    title: 'Prullenbak',
    body: 'Spam of dubbele leads? Verwijder ze naar de prullenbak via de kandidaatpagina. Ze zijn te herstellen via het prullenbak-icoon in Werving.',
  },
  {
    icon: '📊',
    title: 'Tabelweergave',
    body: 'Schakel rechtsboven in Werving over naar tabelweergave voor een compact overzicht met filters en sortering.',
  },
  {
    icon: '✉️',
    title: 'E-mail automations',
    body: 'Ga naar Instellingen → E-mail automations om te zien welke mails automatisch worden verstuurd. Je kunt ze per stuk aan/uit zetten en de tekst aanpassen.',
  },
  {
    icon: '🔔',
    title: 'Automatische meldingen',
    body: 'Bij nieuwe kandidaten, ingeplande afspraken en contractwaarschuwingen ontvang je automatisch een e-mail.',
  },
  {
    icon: '📋',
    title: 'Prescreening aanpassen',
    body: 'De prescreeningvragen zijn instelbaar via Scripts & Checklists. Pas ze aan per vacaturetype.',
  },
];

const vacatureSteps = [
  {
    title: 'Ga naar Werving → Vacatures',
    body: 'In het zijmenu vind je onder Werving de pagina Vacatures. Hier staan alle actieve en inactieve vacatures die gekoppeld zijn aan het publieke sollicitatieformulier.',
  },
  {
    title: 'Nieuwe vacature aanmaken',
    body: 'Klik op "+ Nieuwe vacature". Vul de titel, beschrijving en eventuele eisen in. De slug (URL-naam) wordt automatisch gegenereerd — dit wordt de unieke link van de vacaturepagina.',
  },
  {
    title: 'Inhoud invullen',
    body: 'Je kunt per vacature invullen: functieomschrijving, eisen, locatie, uren per week, salarisrange en het functietype (bijv. Installatiemonteur, Sales adviseur). Het functietype bepaalt aan wie kandidaten worden toegewezen.',
  },
  {
    title: 'Publiceren en delen',
    body: 'Zet de vacature op Actief en kopieer de publieke link via de knop op de vacaturekaart. Deze link (veiligdouchen.nl/vacature/...) kun je delen via Meta-advertenties, e-mail of WhatsApp.',
  },
  {
    title: 'Kandidaten komen automatisch binnen',
    body: 'Zodra iemand via de publieke pagina solliciteert, verschijnt de kandidaat direct in de werving pijplijn als "Nieuw lead" — toegewezen aan de juiste persoon op basis van het functietype. Wil je actief kandidaten werven via Meta-advertenties? Neem dan even contact op met marketing zodat de campagne gekoppeld wordt aan de juiste vacature.',
  },
  {
    title: 'Vacature deactiveren',
    body: 'Klik op "Deactiveren" om de publieke pagina offline te halen. Bestaande kandidaten blijven zichtbaar in de pijplijn. Je kunt de vacature later weer activeren.',
  },
];

const comingSoon = [
  'SMS-herinneringen voor kandidaten vóór een afspraak',
  'Softphone integratie — direct bellen vanuit het scherm',
  'Koppeling agenda — directe beschikbaarheidscheck bij plannen',
  'Bulk-acties in tabelweergave (statussen bijwerken, mailen)',
  'Rapportages — instroom, conversie en doorlooptijden per vacature',
];

export default async function HandleidingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch role assignments dynamically
  const { data: assignments } = await supabaseAdmin
    .from('RoleAssignment')
    .select('roleType, userId, user:User!RoleAssignment_userId_fkey(id, name, jobTitle)');

  // Group by user
  type UserEntry = { name: string; jobTitle?: string | null; roles: string[]; index: number };
  const userMap = new Map<string, UserEntry>();
  let colorIdx = 0;
  for (const a of assignments ?? []) {
    const user = (Array.isArray(a.user) ? a.user[0] : a.user) as { id: string; name: string; jobTitle?: string | null } | null;
    if (!user) continue;
    if (!userMap.has(a.userId)) {
      userMap.set(a.userId, { name: user.name, jobTitle: user.jobTitle ?? null, roles: [], index: colorIdx++ });
    }
    const entry = userMap.get(a.userId)!;
    const label = ROLE_LABELS[a.roleType] ?? a.roleType;
    if (!entry.roles.includes(label)) entry.roles.push(label);
  }
  const assignedUsers = [...userMap.values()];

  function initials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-10 fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Handleiding ZwaluwNest</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Alles wat je moet weten om effectief te werken met het wervingsportaal.
        </p>
      </div>

      {/* 1 — Pijplijn */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">1</span>
          De wervingspijplijn
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {pipeline.map((step, i) => (
            <div key={step.label} className="flex items-start gap-3 rounded-xl border border-[#363848] bg-[#252732] p-4">
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <span className="text-xs font-mono text-[#9ca3af] w-4">{i + 1}</span>
                <div className={`h-2 w-2 rounded-full ${step.dot}`} />
              </div>
              <div className="min-w-0">
                <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium mb-1 ${step.color}`}>
                  {step.label}
                </span>
                <p className="text-xs text-[#9ca3af] leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#9ca3af] pl-1">
          Kandidaten bewegen door de pijplijn via het statusmenu op de kandidaatpagina. Spam of ongeldige leads kun je naar de prullenbak sturen.
        </p>
      </section>

      {/* 2 — Rolverdeling (dynamisch) */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">2</span>
          Wie behandelt welke kandidaten?
        </h2>

        {assignedUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#363848] bg-[#252732] px-5 py-8 text-center">
            <p className="text-sm text-[#9ca3af]">Nog geen roltoewijzingen ingesteld.</p>
            <p className="text-xs text-[#6b7280] mt-1">
              Ga naar <span className="text-white">Instellingen → Roltoewijzing</span> om in te stellen wie welke vacatures behandelt.
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 ${assignedUsers.length === 1 ? '' : assignedUsers.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {assignedUsers.map((u) => (
              <div key={u.name} className="rounded-xl border border-[#363848] bg-[#252732] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_COLORS[u.index % AVATAR_COLORS.length]}`}>
                    {initials(u.name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{u.name}</div>
                    {u.jobTitle && <div className="text-xs text-[#9ca3af]">{u.jobTitle}</div>}
                  </div>
                </div>
                <div className="space-y-1">
                  {u.roles.map((r) => (
                    <div key={r} className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
                      <div className="h-1 w-1 rounded-full bg-[#68b0a6]" />
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[#9ca3af] pl-1">
          De toewijzing is automatisch op basis van de vacature. Aanpassen?{' '}
          <span className="text-white">Instellingen → Roltoewijzing</span>.
        </p>
      </section>

      {/* 3 — Stap-voor-stap */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">3</span>
          Stap-voor-stap werkwijze
        </h2>
        <div className="rounded-xl border border-[#363848] bg-[#252732] divide-y divide-[#363848]">
          {steps.map((s, i) => (
            <div key={s.title} className="flex items-start gap-4 px-5 py-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold mt-0.5">
                {i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
                <p className="text-xs text-[#9ca3af] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — Vacatures */}
      <section>
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">4</span>
          Vacatures plaatsen
        </h2>
        <p className="text-xs text-[#9ca3af] mb-4 pl-8">
          Via Werving → Vacatures maak je openstaande functies aan met een eigen publieke sollicitatiepagina.
          Kandidaten die via die pagina solliciteren komen direct in de pijplijn.
        </p>
        <div className="rounded-xl border border-[#363848] bg-[#252732] divide-y divide-[#363848]">
          {vacatureSteps.map((s, i) => (
            <div key={s.title} className="flex items-start gap-4 px-5 py-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold mt-0.5">
                {i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
                <p className="text-xs text-[#9ca3af] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 ml-8 rounded-lg border border-[#68b0a6]/20 bg-[#68b0a6]/5 px-4 py-3">
          <p className="text-xs text-[#68b0a6]">
            <span className="font-semibold">Tip:</span> Het functietype op de vacature bepaalt automatisch wie de lead ontvangt.
            Koppel dit goed zodat Niels de monteurs krijgt en Vincent de adviseurs.
          </p>
        </div>
      </section>

      {/* 5 — Tips */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">5</span>
          Handige tips
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <div key={tip.title} className="flex items-start gap-3 rounded-xl border border-[#363848] bg-[#252732] p-4">
              <span className="text-xl shrink-0">{tip.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{tip.title}</div>
                <p className="text-xs text-[#9ca3af] leading-relaxed">{tip.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6 — Binnenkort */}
      <section>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f7a247]/10 text-[#f7a247] text-xs">🚀</span>
          Binnenkort beschikbaar
        </h2>
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
          <div className="space-y-2.5">
            {comingSoon.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-[#9ca3af]">
                <span className="inline-flex items-center rounded-full border border-[#f7a247]/30 bg-[#f7a247]/10 px-2 py-0.5 text-[10px] font-medium text-[#f7a247] shrink-0">
                  binnenkort
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Feedback */}
      <section>
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs">💬</span>
          Bug melden of iets wensen?
        </h2>
        <p className="text-xs text-[#9ca3af] mb-4">
          Heb je een probleem gevonden of een idee voor een verbetering? Laat het weten — we nemen het mee in de volgende update.
        </p>
        <FeedbackForm />
      </section>

      {/* Footer */}
      <p className="text-xs text-[#9ca3af] text-center pb-4">
        Vragen? Neem contact op met <span className="text-white">Arnout van der Berg</span>.
      </p>

    </div>
  );
}
