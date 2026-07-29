import { supabaseAdmin } from './supabase';

export interface AutomationDefinition {
  key: string;
  name: string;
  description: string;
  trigger: string;
  recipient: 'Medewerker' | 'Beheerder' | 'Kandidaat' | 'Klant' | 'Recruiter';
  category: 'HR' | 'Werving' | 'Cron' | 'Klant' | 'SMS';
  defaultSubject: string;
  hasCustomIntro: boolean;
  defaultIntro?: string;
}

export const EMAIL_AUTOMATION_CATALOG: AutomationDefinition[] = [
  // ── Werving ────────────────────────────────────────────────────────────────
  {
    key: 'prescreening_invite',
    name: 'Pre-screening uitnodiging',
    description: 'Stuur de pre-screening link naar een kandidaat.',
    trigger: 'Wanneer een kandidaat naar PRE_SCREENING status gaat',
    recipient: 'Kandidaat',
    category: 'Werving',
    defaultSubject: 'Uitnodiging pre-screening — Veilig Douchen',
    hasCustomIntro: true,
    defaultIntro: 'Bedankt voor je interesse in een functie bij Veilig Douchen. We nodigen je uit om de pre-screening in te vullen. Dit duurt ongeveer 5 minuten.',
  },
  {
    key: 'interview_invite',
    name: 'Uitnodiging sollicitatiegesprek',
    description: 'Bevestig uitnodiging naar kandidaat bij doorstroom naar INTERVIEW.',
    trigger: 'Wanneer een kandidaat naar INTERVIEW status gaat',
    recipient: 'Kandidaat',
    category: 'Werving',
    defaultSubject: 'Uitnodiging gesprek — Veilig Douchen',
    hasCustomIntro: true,
    defaultIntro: 'Goed nieuws! Na het beoordelen van jouw profiel nodigen we je uit voor een gesprek bij Veilig Douchen. We zijn erg benieuwd naar jouw achtergrond en motivatie.',
  },
  {
    key: 'rejection',
    name: 'Afwijzing sollicitatie',
    description: 'Afwijzingsmail naar kandidaat bij REJECTED status.',
    trigger: 'Wanneer een kandidaat wordt afgewezen',
    recipient: 'Kandidaat',
    category: 'Werving',
    defaultSubject: 'Terugkoppeling sollicitatie — Veilig Douchen',
    hasCustomIntro: true,
    defaultIntro: 'Bedankt voor je interesse in een functie bij Veilig Douchen en de tijd die je hebt gestoken in je sollicitatie.\n\nNa zorgvuldige overweging hebben we besloten om je sollicitatie niet verder in behandeling te nemen. Dit is een moeilijke beslissing, want we hebben veel enthousiaste kandidaten ontvangen.\n\nWe wensen je veel succes bij je zoektocht naar een passende functie.',
  },
  {
    key: 'appointment_candidate',
    name: 'Afspraak bevestiging (kandidaat)',
    description: 'Bevestig datum en tijd van het gesprek aan de kandidaat.',
    trigger: 'Wanneer een afspraak wordt ingepland',
    recipient: 'Kandidaat',
    category: 'Werving',
    defaultSubject: 'Afspraak bevestigd — {datum} om {tijd} uur',
    hasCustomIntro: false,
  },
  {
    key: 'appointment_internal',
    name: 'Afspraak melding (intern)',
    description: 'Interne melding bij het inplannen van een sollicitatiegesprek.',
    trigger: 'Wanneer een afspraak wordt ingepland',
    recipient: 'Recruiter',
    category: 'Werving',
    defaultSubject: 'Afspraak ingepland: {kandidaat} — {datum} {tijd}',
    hasCustomIntro: false,
  },
  {
    key: 'new_candidate',
    name: 'Nieuwe kandidaat melding',
    description: 'Melding aan beheerder bij binnenkomst via Facebook Lead Ads.',
    trigger: 'Facebook Lead Ads webhook',
    recipient: 'Beheerder',
    category: 'Werving',
    defaultSubject: 'Nieuwe kandidaat: {naam} ({bron})',
    hasCustomIntro: false,
  },
  {
    key: 'phone_correct',
    name: 'Telefoonnummer correctie',
    description: 'Verzoek aan kandidaat om foutief telefoonnummer te corrigeren.',
    trigger: 'Wanneer een recruiter "Foutief nummer" logt',
    recipient: 'Kandidaat',
    category: 'Werving',
    defaultSubject: 'Klopt je telefoonnummer? — Veilig Douchen',
    hasCustomIntro: true,
    defaultIntro: 'We probeerden je te bellen, maar het telefoonnummer dat we hebben lijkt niet te kloppen. Wil je je correcte nummer aan ons doorgeven?',
  },
  // ── HR ─────────────────────────────────────────────────────────────────────
  {
    key: 'leave_approved',
    name: 'Verlof goedgekeurd',
    description: 'Bevestiging aan medewerker dat verlofaanvraag goedgekeurd is.',
    trigger: 'Wanneer een verlofaanvraag wordt goedgekeurd',
    recipient: 'Medewerker',
    category: 'HR',
    defaultSubject: 'Verlof goedgekeurd — {dagen} dag(en) {type}',
    hasCustomIntro: false,
  },
  {
    key: 'leave_rejected',
    name: 'Verlofaanvraag afgewezen',
    description: 'Bericht aan medewerker dat verlofaanvraag niet is goedgekeurd.',
    trigger: 'Wanneer een verlofaanvraag wordt afgewezen',
    recipient: 'Medewerker',
    category: 'HR',
    defaultSubject: 'Verlofaanvraag afgewezen — {type}',
    hasCustomIntro: false,
  },
  // ── Cron ───────────────────────────────────────────────────────────────────
  {
    key: 'contract_expiry',
    name: 'Contract verloopt binnenkort',
    description: 'Waarschuwing aan beheerder bij contracten die binnen 30 of 14 dagen verlopen.',
    trigger: 'Dagelijkse cron controle',
    recipient: 'Beheerder',
    category: 'Cron',
    defaultSubject: '[URGENT] Contract {naam} verloopt over {dagen} dagen',
    hasCustomIntro: false,
  },
  {
    key: 'poortwachter',
    name: 'Poortwachter actie vereist',
    description: 'Herinnering bij poortwachter mijlpalen: week 6, 8, 13, 42 en 52.',
    trigger: 'Dagelijkse cron controle',
    recipient: 'Beheerder',
    category: 'Cron',
    defaultSubject: '[Poortwachter] Week {week} actie vereist — {naam}',
    hasCustomIntro: false,
  },
  // ── SMS ────────────────────────────────────────────────────────────────────
  {
    key: 'sms_screening_invite',
    name: 'SMS Pre-screening uitnodiging',
    description: 'SMS met pre-screening link naar kandidaat.',
    trigger: 'Bij het versturen van een pre-screening uitnodiging',
    recipient: 'Kandidaat',
    category: 'SMS',
    defaultSubject: '(SMS — geen onderwerp)',
    hasCustomIntro: true,
    defaultIntro: 'Hoi {naam}, bedankt voor je interesse bij Zwaluw Comfortsanitair! Vul je pre-screening in (5 min): {url}',
  },
  {
    key: 'sms_appointment_confirm',
    name: 'SMS Afspraakbevestiging',
    description: 'SMS bevestiging van gespreksdatum en locatie.',
    trigger: 'Bij het inplannen van een afspraak',
    recipient: 'Kandidaat',
    category: 'SMS',
    defaultSubject: '(SMS — geen onderwerp)',
    hasCustomIntro: true,
    defaultIntro: 'Hoi {naam}! Je sollicitatiegesprek bij Zwaluw Comfortsanitair is bevestigd op {datum} om {tijd} uur op {locatie}. Tot dan! — Team Zwaluw',
  },
  // ── Klant ──────────────────────────────────────────────────────────────────
  {
    key: 'review_request',
    name: 'Review verzoek (klant)',
    description: 'Vraag klant om een review achter te laten na de installatie.',
    trigger: 'Handmatig via klantbeheer',
    recipient: 'Klant',
    category: 'Klant',
    defaultSubject: 'Hoe was uw ervaring met Veilig Douchen?',
    hasCustomIntro: true,
    defaultIntro: 'Bedankt voor uw keuze voor Veilig Douchen! We hopen dat u tevreden bent met uw nieuwe doucheaanpassing. We stellen het zeer op prijs als u een review achterlaat.',
  },
];

export interface AutomationConfig {
  key: string;
  enabled: boolean;
  customSubject: string | null;
  customIntro: string | null;
  updatedAt: string | null;
}

export async function getAutomationConfig(key: string): Promise<AutomationConfig> {
  const { data } = await supabaseAdmin
    .from('EmailAutomationConfig')
    .select('key, enabled, customSubject, customIntro, updatedAt')
    .eq('key', key)
    .single();

  return {
    key,
    enabled: data?.enabled ?? true,
    customSubject: data?.customSubject ?? null,
    customIntro: data?.customIntro ?? null,
    updatedAt: data?.updatedAt ?? null,
  };
}

export async function getAllAutomationConfigs(): Promise<AutomationConfig[]> {
  const { data } = await supabaseAdmin
    .from('EmailAutomationConfig')
    .select('key, enabled, customSubject, customIntro, updatedAt');

  const dbMap = new Map<string, AutomationConfig>();
  for (const row of data ?? []) dbMap.set(row.key, row);

  return EMAIL_AUTOMATION_CATALOG.map((def) => ({
    key: def.key,
    enabled: dbMap.get(def.key)?.enabled ?? true,
    customSubject: dbMap.get(def.key)?.customSubject ?? null,
    customIntro: dbMap.get(def.key)?.customIntro ?? null,
    updatedAt: dbMap.get(def.key)?.updatedAt ?? null,
  }));
}

export async function upsertAutomationConfig(
  key: string,
  patch: Partial<Pick<AutomationConfig, 'enabled' | 'customSubject' | 'customIntro'>>
): Promise<void> {
  await supabaseAdmin
    .from('EmailAutomationConfig')
    .upsert({ key, ...patch, updatedAt: new Date().toISOString() }, { onConflict: 'key' });
}
