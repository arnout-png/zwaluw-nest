import { NextRequest, NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  sendNewCandidateEmail,
  sendApplicationReceivedEmail,
  isEmailConfigured,
} from '@/lib/email';
import { getAutomationConfig } from '@/lib/email-automations';
import { autoAssignCandidate, systemNoteAuthorId } from '@/lib/recruitment';
import { sendApplicationCapiEvent } from '@/lib/meta-capi';
import { isPrivateCvRef } from '@/lib/cv-storage';
import { classifyLeadSource, describeAttribution, sanitizeAttribution } from '@/lib/lead-source';
import { externalBaseUrl, publicUrl } from '@/lib/site-url';

/**
 * POST /api/apply/[slug] — publiek sollicitatieformulier op /vacature/[slug].
 *
 * Volgorde: valideren → kandidaat aanmaken/bijwerken → toewijzen aan de
 * recruiter van de rol (RoleAssignment) → notitie + in-app meldingen. Mails
 * (beheerder, recruiter, sollicitant) en de Meta Conversions API lopen ná het
 * antwoord via after(): een trage of falende externe dienst mag een
 * sollicitatie nooit laten mislukken of de sollicitant laten wachten.
 */

const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: 'Nieuw',
  CONTACTED: 'Gecontacteerd',
  PRE_SCREENING: 'Pre-screening',
  SCREENING_DONE: 'Screening klaar',
  INTERVIEW: 'Sollicitatiegesprek',
  RESERVE_BANK: 'Reserve Bank',
  HIRED: 'Aangenomen',
  REJECTED: 'Afgewezen',
  WITHDRAWN: 'Teruggetrokken',
};

/** Kandidaten in deze fases lopen nog: een nieuwe sollicitatie zet ze niet terug naar "Nieuw". */
const IN_PROGRESS = ['NEW_LEAD', 'CONTACTED', 'PRE_SCREENING', 'SCREENING_DONE', 'INTERVIEW'];

// Geen `*`: PostgREST leest dat in ilike als wildcard (zie de lookup hieronder).
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"*]+@[^\s@<>()[\]\\,;:"*]+\.[a-z]{2,}$/i;

/** Dubbel-klik / opnieuw verzenden binnen dit venster = dezelfde sollicitatie. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

/** Escape voor PostgREST ilike: % en _ zijn wildcards. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Een lege of ongeldige body (bots, een native form-post) mag geen
  // onafgevangen SyntaxError geven — dat werd een 500.
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object') throw new Error('geen object');
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 });
  }

  // ── Spam: honeypot + "te snel ingevuld". Stil "gelukt" teruggeven, zodat een
  // bot geen signaal krijgt om zich aan te passen.
  if (text(body.website, 200)) {
    console.warn('[apply] honeypot ingevuld — genegeerd', slug);
    return NextResponse.json({ ok: true });
  }
  if (typeof body.elapsedMs === 'number' && body.elapsedMs >= 0 && body.elapsedMs < 1500) {
    console.warn('[apply] formulier binnen', body.elapsedMs, 'ms verzonden — genegeerd', slug);
    return NextResponse.json({ ok: true });
  }

  // ── Validatie
  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 120);
  const email = text(body.email, 200)?.toLowerCase() ?? null;
  const phone = text(body.phone, 40);
  const phoneDigits = (phone ?? '').replace(/\D/g, '');
  const street = text(body.street, 200);
  const postalCode = text(body.postalCode, 20)?.toUpperCase() ?? null;
  const city = text(body.city, 120);
  const motivation = text(body.motivation, 5000);
  const rawCvRef = text(body.cvRef, 200);
  const cvRef = isPrivateCvRef(rawCvRef) ? rawCvRef : null;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Vul je voor- en achternaam in.' }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Vul een geldig e-mailadres in.' }, { status: 400 });
  }
  if (!phone || phoneDigits.length < 9 || phoneDigits.length > 15) {
    return NextResponse.json(
      { error: 'Vul een geldig telefoonnummer in, bijvoorbeeld 06 12345678.' },
      { status: 400 }
    );
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { error: 'Geef toestemming voor het verwerken van je gegevens om te kunnen solliciteren.' },
      { status: 400 }
    );
  }

  // ── Vacature
  const { data: job, error: jobError } = await supabaseAdmin
    .from('JobOpening')
    .select('id, title, slug')
    .eq('slug', slug)
    .eq('isActive', true)
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json(
      { error: 'Deze vacature is niet (meer) beschikbaar. Bekijk onze andere vacatures.' },
      { status: 404 }
    );
  }

  const attribution = sanitizeAttribution(body.attribution);
  // fbclid kan ook los in de URL van deze pagina staan (oudere clients).
  if (!attribution.fbclid) {
    const looseFbclid = text(body.fbclid, 300);
    if (looseFbclid) attribution.fbclid = looseFbclid;
  }
  const source = classifyLeadSource(attribution);

  const name = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
  const nowIso = new Date().toISOString();
  const consentExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // ── Bestaande kandidaat op e-mailadres (hoofdletterongevoelig). Niet
  // maybeSingle(): bij historische dubbelen gaf dat een fout en maakten we er
  // nog een dubbele bij.
  const { data: existingRows, error: lookupError } = await supabaseAdmin
    .from('Candidate')
    .select('id, status, deletedAt, jobOpeningId, assignedToId, leadSource, updatedAt')
    .ilike('email', escapeLike(email))
    .order('createdAt', { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error('[apply] lookup mislukt:', lookupError.message);
    return NextResponse.json(
      { error: 'Er ging iets mis bij het opslaan. Probeer het over een minuut opnieuw.' },
      { status: 500 }
    );
  }

  const existing = (existingRows?.[0] ?? null) as {
    id: string;
    status: string;
    deletedAt: string | null;
    jobOpeningId: string | null;
    assignedToId: string | null;
    leadSource: string | null;
    updatedAt: string;
  } | null;

  // Dubbel verzonden (dubbele tik, terug-knop): niets opnieuw doen.
  if (
    existing &&
    !existing.deletedAt &&
    existing.jobOpeningId === job.id &&
    existing.status === 'NEW_LEAD' &&
    Date.now() - new Date(existing.updatedAt).getTime() < DUPLICATE_WINDOW_MS
  ) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  type Mode = 'new' | 'reopened' | 'in_progress' | 'hired';
  let mode: Mode;
  let candidateId: string;
  let previousStatus: string | null = null;
  let assignedToId: string | null = existing?.assignedToId ?? null;

  const contactFields = Object.fromEntries(
    Object.entries({ phone, street, postalCode, city, cvUrl: cvRef }).filter(([, v]) => !!v)
  ) as Record<string, string>;

  if (!existing) {
    mode = 'new';
    const { data: created, error: insertError } = await supabaseAdmin
      .from('Candidate')
      .insert({
        name,
        email,
        phone,
        street,
        postalCode,
        city,
        cvUrl: cvRef,
        status: 'NEW_LEAD',
        leadSource: source.leadSource,
        leadCampaignId: source.leadCampaignId,
        jobOpeningId: job.id,
        consentGiven: true,
        consentDate: nowIso,
        consentExpiresAt,
        stageUpdatedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .select('id')
      .single();

    if (insertError || !created) {
      console.error('[apply] insert mislukt:', insertError?.message);
      return NextResponse.json(
        { error: 'Je sollicitatie kon niet worden opgeslagen. Probeer het over een minuut opnieuw.' },
        { status: 500 }
      );
    }
    candidateId = created.id as string;
  } else {
    candidateId = existing.id;
    previousStatus = existing.status;
    const inTrash = !!existing.deletedAt;

    if (!inTrash && existing.status === 'HIRED') {
      mode = 'hired';
    } else if (!inTrash && IN_PROGRESS.includes(existing.status)) {
      mode = 'in_progress';
    } else {
      // Afgewezen, teruggetrokken, reservebank of in de prullenbak: opnieuw
      // bovenaan de pipeline, voor deze vacature.
      mode = 'reopened';
    }

    const update: Record<string, unknown> = {
      name,
      ...contactFields,
      consentGiven: true,
      consentDate: nowIso,
      consentExpiresAt,
      updatedAt: nowIso,
    };

    if (mode === 'reopened') {
      Object.assign(update, {
        status: 'NEW_LEAD',
        stageUpdatedAt: nowIso,
        deletedAt: null,
        jobOpeningId: job.id,
        leadSource: source.leadSource,
        leadCampaignId: source.leadCampaignId,
        rejectionReason: null,
        rejectionEmailSent: false,
      });
    } else if (mode === 'in_progress') {
      // Loopt al: status en vacature laten staan; alleen invullen wat ontbrak.
      if (!existing.jobOpeningId) update.jobOpeningId = job.id;
      if (!existing.leadSource) {
        update.leadSource = source.leadSource;
        update.leadCampaignId = source.leadCampaignId;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('Candidate')
      .update(update)
      .eq('id', existing.id);

    if (updateError) {
      console.error('[apply] update mislukt:', updateError.message);
      return NextResponse.json(
        { error: 'Je sollicitatie kon niet worden opgeslagen. Probeer het over een minuut opnieuw.' },
        { status: 500 }
      );
    }
  }

  // ── Toewijzen aan de recruiter van deze rol (Vincent voor binnendienst/callcenter).
  // Een lopende kandidaat houdt zijn huidige eigenaar.
  let notifiedByAssign = false;
  if (mode === 'new' || mode === 'reopened' || !assignedToId) {
    const assignee = await autoAssignCandidate(candidateId, name, job.id, {
      notificationTitle:
        mode === 'reopened' ? `Sollicitatie opnieuw: ${name}` : `Nieuwe sollicitant: ${name}`,
      notificationMessage:
        mode === 'reopened'
          ? `${name} heeft opnieuw gesolliciteerd op "${job.title}" en is aan jou toegewezen.`
          : `${name} heeft gesolliciteerd op "${job.title}" en is aan jou toegewezen.`,
    });
    if (assignee) {
      assignedToId = assignee;
      notifiedByAssign = true;
    }
  }

  // ── Notitie op de kandidaatkaart
  const noteBlocks: string[] = [];
  if (mode === 'reopened' && previousStatus) {
    noteBlocks.push(
      `**Heropend na nieuwe sollicitatie op "${job.title}"** — stond op "${STATUS_LABELS[previousStatus] ?? previousStatus}"${existing?.deletedAt ? ' (in de prullenbak)' : ''}, teruggezet naar Nieuw.`
    );
  } else if (mode === 'in_progress' && previousStatus) {
    noteBlocks.push(
      `**Nieuwe sollicitatie ontvangen op "${job.title}"** — kandidaat liep al (fase "${STATUS_LABELS[previousStatus] ?? previousStatus}"); status ongewijzigd.`
    );
  } else if (mode === 'hired') {
    noteBlocks.push(`**Let op:** deze (aangenomen) kandidaat solliciteerde opnieuw, op "${job.title}".`);
  } else {
    noteBlocks.push(`**Sollicitatie via de vacaturepagina:** ${job.title}`);
  }
  const attributionLine = describeAttribution(attribution, source);
  if (attributionLine) noteBlocks.push(attributionLine);
  if (cvRef) noteBlocks.push('**CV:** geüpload — open via "CV bekijken" bovenaan de kandidaatkaart.');
  if (motivation) noteBlocks.push(`**Motivatie:**\n\n${motivation}`);

  const noteAuthor = await systemNoteAuthorId();
  if (noteAuthor) {
    const { error: noteError } = await supabaseAdmin.from('CandidateNote').insert({
      candidateId,
      content: noteBlocks.join('\n\n'),
      authorId: noteAuthor,
      createdAt: nowIso,
    });
    if (noteError) console.error('[apply] notitie opslaan mislukt:', noteError.message);
  }

  // ── In-app meldingen: beheerders altijd, de eigenaar als autoAssign dat nog niet deed.
  const { data: admins } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true);

  const recipients = new Set<string>(((admins ?? []) as { id: string }[]).map((a) => a.id));
  if (assignedToId && !notifiedByAssign) recipients.add(assignedToId);
  if (assignedToId && notifiedByAssign) recipients.delete(assignedToId);

  const title =
    mode === 'new' ? `Nieuwe sollicitant: ${name}`
      : mode === 'reopened' ? `Sollicitatie opnieuw: ${name}`
        : `Nieuwe sollicitatie van lopende kandidaat: ${name}`;
  const message =
    mode === 'in_progress' || mode === 'hired'
      ? `${name} solliciteerde (opnieuw) op "${job.title}"; status is ongewijzigd (${STATUS_LABELS[previousStatus ?? ''] ?? previousStatus}).`
      : `${name} heeft gesolliciteerd op "${job.title}".`;

  if (recipients.size > 0) {
    const { error: notifError } = await supabaseAdmin.from('Notification').insert(
      [...recipients].map((userId) => ({
        userId,
        type: 'NEW_CANDIDATE',
        title,
        message,
        isRead: false,
        linkUrl: `/dashboard/werving/${candidateId}`,
      }))
    );
    if (notifError) console.error('[apply] meldingen mislukt:', notifError.message);
  }

  // ── Na het antwoord: mails en Meta. Fouten worden gelogd, nooit gegooid.
  const portalUrl = `${externalBaseUrl()}/dashboard/werving/${candidateId}`;
  const sourceLabel =
    source.leadSource === 'FACEBOOK' ? 'Facebook/Instagram'
      : source.leadSource === 'WEBSITE' ? 'de vacaturepagina'
        : source.leadSource.charAt(0) + source.leadSource.slice(1).toLowerCase();

  let confirmationQueued = false;
  if (isEmailConfigured()) {
    const auto = await getAutomationConfig('application_received');
    confirmationQueued = auto.enabled;
  }

  const eventId = text(body.eventId, 100);
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const clientUserAgent = request.headers.get('user-agent');
  const statusLabel = STATUS_LABELS[previousStatus ?? ''] ?? previousStatus;

  after(async () => {
    if (isEmailConfigured()) {
      // 1. Beheerder (ADMIN_EMAIL) + toegewezen recruiter
      const internalTo = new Set<string>();
      if (process.env.ADMIN_EMAIL) internalTo.add(process.env.ADMIN_EMAIL.trim().toLowerCase());
      if (assignedToId) {
        const { data: owner } = await supabaseAdmin
          .from('User')
          .select('email, isActive')
          .eq('id', assignedToId)
          .maybeSingle();
        const o = owner as { email?: string; isActive?: boolean } | null;
        if (o?.email && o.isActive !== false) internalTo.add(o.email.trim().toLowerCase());
      }
      for (const to of internalTo) {
        try {
          await sendNewCandidateEmail({
            to,
            candidateName: name,
            email,
            phone,
            jobTitle: job.title,
            source: sourceLabel,
            campaignId: source.leadCampaignId ?? undefined,
            intro:
              mode === 'new' ? `${name} heeft gesolliciteerd op "${job.title}" via ${sourceLabel}.`
                : mode === 'reopened' ? `${name} heeft opnieuw gesolliciteerd op "${job.title}" en staat weer op Nieuw.`
                  : `${name} liep al in de werving (fase "${statusLabel}") en solliciteerde nu op "${job.title}". Status is ongewijzigd.`,
            portalUrl,
          });
        } catch (err) {
          console.error('[apply] interne mail mislukt:', to, err);
        }
      }

      // 2. Ontvangstbevestiging aan de sollicitant
      try {
        await sendApplicationReceivedEmail({ to: email, firstName, jobTitle: job.title });
      } catch (err) {
        console.error('[apply] bevestigingsmail mislukt:', err);
      }
    }

    // 3. Meta Conversions API — server-side tegenhanger van het browserevent.
    if (eventId) {
      await sendApplicationCapiEvent({
        eventId,
        name,
        email,
        phone,
        city,
        postalCode,
        sourceUrl: text(body.sourceUrl, 500) ?? publicUrl(`/vacature/${slug}`),
        clientIp,
        clientUserAgent,
        fbp: text(body.fbp, 200),
        fbc: text(body.fbc, 400),
        fbclid: attribution.fbclid ?? null,
        fbclidCapturedAt: attribution.capturedAt ?? null,
        jobTitle: job.title,
      });
    }
  });

  return NextResponse.json({ ok: true, confirmationEmail: confirmationQueued });
}
