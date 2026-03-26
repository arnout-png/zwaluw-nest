import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HandleidingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const pipeline = [
    {
      label: 'Nieuw lead',
      status: 'NEW_LEAD',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      dot: 'bg-blue-400',
      description: 'Lead binnengekomeen via Meta-advertentie of handmatige toevoeging. Nog geen contact geweest.',
    },
    {
      label: 'Pre-screening',
      status: 'PRE_SCREENING',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      dot: 'bg-purple-400',
      description: 'Contact gehad, prescreeningsgesprek gestart. Kandidaat beantwoordt kwalificatievragen.',
    },
    {
      label: 'Screening klaar',
      status: 'SCREENING_DONE',
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      dot: 'bg-yellow-400',
      description: 'Prescreening ingevuld en positief beoordeeld. Klaar om een afspraak in te plannen.',
    },
    {
      label: 'Gesprek',
      status: 'INTERVIEW',
      color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      dot: 'bg-orange-400',
      description: 'Sollicitatiegesprek ingepland of al gevoerd. Uitkomst nog vast te leggen.',
    },
    {
      label: 'Reservebank',
      status: 'RESERVE_BANK',
      color: 'bg-teal-500/10 text-[#68b0a6] border-teal-500/20',
      dot: 'bg-[#68b0a6]',
      description: 'Positief gesprek, maar (nog) geen plek beschikbaar. Kandidaat bewaren voor de toekomst.',
    },
    {
      label: 'Aangenomen',
      status: 'HIRED',
      color: 'bg-green-500/10 text-green-400 border-green-500/20',
      dot: 'bg-green-400',
      description: 'Kandidaat aangenomen en omgezet naar medewerker in het systeem.',
    },
    {
      label: 'Afgewezen',
      status: 'REJECTED',
      color: 'bg-red-500/10 text-red-400 border-red-500/20',
      dot: 'bg-red-400',
      description: 'Kandidaat niet geschikt of heeft zelf afgehaakt.',
    },
  ];

  const roles = [
    {
      name: 'Niels van de Groep',
      title: 'Algemeen directeur',
      initials: 'NG',
      vacatures: ['Installatiemonteur', 'Technische Binnendienst', 'Magazijnmedewerker'],
      color: 'bg-blue-500/20 text-blue-300',
    },
    {
      name: 'Vincent Machiels',
      title: 'Commercieel directeur',
      initials: 'VM',
      vacatures: ['Sales Adviseur Buitendienst', 'Callcenter Medewerker'],
      color: 'bg-purple-500/20 text-purple-300',
    },
    {
      name: 'Claudia Duivenvoorden',
      title: 'Backoffice manager',
      initials: 'CD',
      vacatures: ['Backoffice Medewerker'],
      color: 'bg-orange-500/20 text-orange-300',
    },
  ];

  const steps = [
    {
      nr: '1',
      title: 'Melding ontvangen',
      body: 'Je ontvangt een e-mailmelding zodra er een nieuwe kandidaat aan jou is toegewezen. Open ZwaluwNest en ga naar Werving.',
    },
    {
      nr: '2',
      title: 'Kandidaat bekijken',
      body: 'Klik op de kandidaatkaart om het profiel te openen. Hier vind je contactgegevens, de campagne waaruit de lead afkomstig is en eventuele eerdere notities.',
    },
    {
      nr: '3',
      title: 'Bellen & loggen',
      body: 'Bel de kandidaat. Leg het resultaat direct vast in het systeem: "Geen gehoor", "Voicemail" of "Contact". Geen losse aantekeningen meer nodig.',
    },
    {
      nr: '4',
      title: 'Prescreening starten',
      body: 'Bij contact klik je op "Prescreening starten". Er verschijnen kwalificatievragen die je samen met de kandidaat doorloopt. Pas daarna plan je een echte afspraak in.',
    },
    {
      nr: '5',
      title: 'Afspraak inplannen',
      body: 'Klik op "Afspraak plannen" en kies een datum, tijd en locatie. Je ontvangt een herinnering in het dashboard. De kandidaat wordt binnenkort ook per SMS herinnerd.',
    },
    {
      nr: '6',
      title: 'Gesprek voeren',
      body: 'Neem je telefoon mee het gesprek in — ZwaluwNest is volledig mobiel responsive. De sollicitatievragen staan in de app. Na afloop leg je de uitkomst vast.',
    },
    {
      nr: '7',
      title: 'Uitkomst bepalen',
      body: 'Zet de kandidaat op Aangenomen, Reservebank of Afgewezen. Binnenkort verstuurt het systeem automatisch een nette afwijzingsmail.',
    },
  ];

  const comingSoon = [
    'SMS-herinneringen voor kandidaten vóór een afspraak',
    'Automatische afwijzingsmail bij status "Afgewezen"',
    'Softphone integratie — bellen vanuit het scherm',
    'Koppeling met agenda voor directe beschikbaarheidscheck',
  ];

  return (
    <div className="min-h-screen bg-[#1e2028]">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Handleiding ZwaluwNest</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            Alles wat je moet weten om effectief te werken met het wervingsportaal.
          </p>
        </div>

        {/* Pijplijn */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">1</span>
            De wervingspijplijn
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pipeline.map((step, i) => (
              <div
                key={step.status}
                className="flex items-start gap-3 rounded-xl border border-[#363848] bg-[#252732] p-4"
              >
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
            Kandidaten worden gesleept of via het statusmenu door de pijplijn bewogen. In de tabelweergave kun je ook bulkacties uitvoeren.
          </p>
        </section>

        {/* Rolverdeling */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">2</span>
            Wie behandelt welke kandidaten?
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {roles.map((r) => (
              <div key={r.name} className="rounded-xl border border-[#363848] bg-[#252732] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${r.color}`}>
                    {r.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{r.name}</div>
                    <div className="text-xs text-[#9ca3af]">{r.title}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {r.vacatures.map((v) => (
                    <div key={v} className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
                      <div className="h-1 w-1 rounded-full bg-[#68b0a6]" />
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#9ca3af] pl-1">
            De toewijzing is automatisch op basis van de vacature. Wil je dit aanpassen? Ga naar <span className="text-white">Instellingen → Roltoewijzing</span>.
          </p>
        </section>

        {/* Stap-voor-stap */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">3</span>
            Stap-voor-stap werkwijze
          </h2>
          <div className="rounded-xl border border-[#363848] bg-[#252732] divide-y divide-[#363848]">
            {steps.map((s) => (
              <div key={s.nr} className="flex items-start gap-4 px-5 py-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold mt-0.5">
                  {s.nr}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#68b0a6]/10 text-[#68b0a6] text-xs font-bold">4</span>
            Handige tips
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: '📱',
                title: 'Mobiel responsive',
                body: 'ZwaluwNest werkt volledig op je telefoon. Handig om kandidaatgegevens bij de hand te hebben tijdens een gesprek.',
              },
              {
                icon: '🔍',
                title: 'Tabelweergave',
                body: 'Schakel rechtsboven in Werving over naar tabelweergave voor een compact overzicht met filters en sortering.',
              },
              {
                icon: '🔔',
                title: 'E-mailmeldingen',
                body: 'Je ontvangt automatisch een melding bij nieuwe kandidaten die aan jou zijn toegewezen.',
              },
              {
                icon: '📋',
                title: 'Prescreening vragen',
                body: 'De prescreeningvragen zijn instelbaar via Scripts & Checklists. Pas ze aan op de vacature.',
              },
            ].map((tip) => (
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

        {/* Binnenkort */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f7a247]/10 text-[#f7a247] text-xs font-bold">🚀</span>
            Binnenkort beschikbaar
          </h2>
          <div className="rounded-xl border border-[#363848] bg-[#252732] p-5">
            <div className="space-y-2">
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

        {/* Footer */}
        <p className="text-xs text-[#9ca3af] text-center pb-4">
          Vragen of suggesties? Neem contact op met{' '}
          <span className="text-white">Arnout van der Berg</span>.
        </p>

      </div>
    </div>
  );
}
