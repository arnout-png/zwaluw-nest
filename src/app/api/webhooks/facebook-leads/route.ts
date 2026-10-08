import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { appendLeadToSheet } from '@/lib/google-sheets';
import { sendNewCandidateEmail, isEmailConfigured } from '@/lib/email';
import { GRAPH_API_VERSION } from '@/lib/meta-capi';
import {
  autoAssignCandidate,
  matchJobForCampaign,
  systemNoteAuthorId,
  type MatchableJob,
} from '@/lib/recruitment';
import { externalBaseUrl } from '@/lib/site-url';

/**
 * Facebook Lead Ads Webhook — /api/webhooks/facebook-leads
 *
 * GET:  verificatie-handshake bij het registreren van de webhook in de Meta-app.
 * POST: Meta meldt een nieuwe lead (alleen het lead-id); wij halen de
 *       formuliervelden op via de Graph API en maken een Candidate aan.
 *
 * Benodigde env vars (Vercel → Production):
 *   FACEBOOK_WEBHOOK_VERIFY_TOKEN  — zelfgekozen string, ook invullen in de Meta-app
 *   FACEBOOK_APP_SECRET            — App secret; verifieert X-Hub-Signature-256
 *   FACEBOOK_PAGE_ACCESS_TOKEN     — Page token met leads_retrieval; zonder dit
 *                                    kunnen we de formuliervelden niet ophalen
 *   FACEBOOK_LEAD_FORM_MAP         — optioneel: JSON {"<form_id>": "<vacature-slug>"}.
 *                                    Zonder match op form-id koppelen we op de
 *                                    formuliernaam (zie matchJobForCampaign).
 *
 * Idempotent: Meta herhaalt webhooks bij time-outs. Een lead-id dat al bestaat
 * (Candidate.leadCampaignId = "l:<leadgen_id>", hetzelfde formaat als de
 * Google Sheets-sync) of een bestaand e-mailadres maakt geen tweede kandidaat.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expected = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

function validSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8');
  const received = Buffer.from(header.slice('sha256='.length), 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function formMap(): Record<string, string> {
  try {
    const parsed = JSON.parse(process.env.FACEBOOK_LEAD_FORM_MAP ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    console.error('[fb-leads] FACEBOOK_LEAD_FORM_MAP is geen geldige JSON');
    return {};
  }
}

async function graphGet<T>(path: string, fields: string): Promise<T | null> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error('[fb-leads] Graph API', path, res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error('[fb-leads] Graph API mislukt:', path, err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret) {
    console.error('[fb-leads] FACEBOOK_APP_SECRET ontbreekt — webhook geweigerd');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }
  if (!validSignature(rawBody, request.headers.get('x-hub-signature-256'), secret)) {
    console.error('[fb-leads] ongeldige handtekening');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: FacebookWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    console.error('[fb-leads] FACEBOOK_PAGE_ACCESS_TOKEN ontbreekt — leads kunnen niet worden opgehaald');
  }

  const { data: jobRows } = await supabaseAdmin
    .from('JobOpening')
    .select('id, slug, title, roleType')
    .eq('isActive', true);
  const jobs = (jobRows ?? []) as MatchableJob[];
  const forms = formMap();
  const formNameCache = new Map<string, string>();

  const processed: string[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const leadId = change.value?.leadgen_id;
      if (!leadId) continue;

      try {
        const name = await processLead(leadId, change.value ?? {}, jobs, forms, formNameCache);
        if (name) processed.push(name);
      } catch (err) {
        // Nooit 500 teruggeven: dan blijft Meta dezelfde batch eindeloos herhalen.
        console.error('[fb-leads] lead verwerken mislukt:', leadId, err);
      }
    }
  }

  return NextResponse.json({ ok: true, processed: processed.length });
}

async function processLead(
  leadId: string,
  value: NonNullable<FacebookWebhookChange['value']>,
  jobs: MatchableJob[],
  forms: Record<string, string>,
  formNameCache: Map<string, string>
): Promise<string | null> {
  const leadKey = `l:${leadId}`;

  // Al binnen (webhook-herhaling of via de Sheets-sync)?
  const { data: known } = await supabaseAdmin
    .from('Candidate')
    .select('id')
    .in('leadCampaignId', [leadKey, `l:${leadKey}`])
    .limit(1);
  if (known && known.length > 0) return null;

  const leadData = await graphGet<FacebookLeadData>(leadId, 'field_data,ad_id,form_id,campaign_name,ad_name,created_time');
  if (!leadData) {
    console.error('[fb-leads] lead niet op te halen, overgeslagen:', leadId);
    return null;
  }

  const fields = extractFields(leadData.field_data ?? []);
  const fullName = fields['full_name'] ?? fields['volledige_naam'] ?? fields['naam'] ?? '';
  const firstName = fields['voornaam'] ?? fields['first_name'] ?? fullName.split(' ')[0] ?? '';
  const lastName =
    fields['achternaam'] ?? fields['last_name'] ?? fullName.split(' ').slice(1).join(' ') ?? '';
  const email = (fields['e-mailadres'] ?? fields['email'] ?? '').trim().toLowerCase();
  const phone = fields['telefoonnummer'] ?? fields['phone_number'] ?? fields['phone'] ?? '';
  const postalCode = fields['postcode'] ?? fields['zip_code'] ?? fields['post_code'] ?? '';
  const city = fields['woonplaats'] ?? fields['city'] ?? '';
  const currentJob = fields['huidige_functie'] ?? fields['huidige_baan'] ?? '';
  const salaryStr = fields['salarisverwachting'] ?? '';

  if (!email && !firstName && !phone) {
    console.warn('[fb-leads] lead zonder bruikbare velden, overgeslagen:', leadId);
    return null;
  }

  // Bestaat dit e-mailadres al? Dan geen dubbele kandidaat, wel een notitie.
  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from('Candidate')
      .select('id')
      .ilike('email', email.replace(/[\\%_]/g, (m) => `\\${m}`))
      .limit(1);
    if (byEmail && byEmail.length > 0) {
      const author = await systemNoteAuthorId();
      if (author) {
        await supabaseAdmin.from('CandidateNote').insert({
          candidateId: byEmail[0].id,
          authorId: author,
          content: `**Nieuwe Facebook-lead ontvangen** (lead ${leadId}) voor een bestaande kandidaat — geen nieuwe kaart aangemaakt.`,
        });
      }
      return null;
    }
  }

  // Vacature bepalen: expliciete form-mapping, anders formulier-/campagnenaam.
  const formId = leadData.form_id ?? value.form_id ?? null;
  let job: MatchableJob | null = null;
  if (formId && forms[formId]) job = jobs.find((j) => j.slug === forms[formId]) ?? null;
  if (!job && formId) {
    let formName = formNameCache.get(formId);
    if (formName === undefined) {
      formName = (await graphGet<{ name?: string }>(formId, 'name'))?.name ?? '';
      formNameCache.set(formId, formName);
    }
    job = matchJobForCampaign(`${formName} ${leadData.campaign_name ?? ''} ${leadData.ad_name ?? ''}`, jobs);
  }

  const candidateName = `${firstName} ${lastName}`.trim() || fullName.trim() || 'Onbekend';
  const now = new Date();
  const consentExpiry = new Date(now);
  consentExpiry.setFullYear(consentExpiry.getFullYear() + 1);

  const { data: candidate, error: insertError } = await supabaseAdmin
    .from('Candidate')
    .insert({
      name: candidateName,
      email: email || `lead-${leadId}@facebook-lead.local`,
      phone: phone || null,
      postalCode: postalCode || null,
      city: city || null,
      location: city || postalCode || null,
      currentJob: currentJob || null,
      status: 'NEW_LEAD',
      leadSource: 'FACEBOOK',
      leadCampaignId: leadKey,
      jobOpeningId: job?.id ?? null,
      salaryExpectation: salaryStr || null,
      consentGiven: true,
      consentDate: now.toISOString(),
      consentExpiresAt: consentExpiry.toISOString(),
      stageUpdatedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !candidate) {
    console.error('[fb-leads] kandidaat aanmaken mislukt:', insertError?.message);
    return null;
  }

  const author = await systemNoteAuthorId();
  if (author) {
    const lines = [
      '**Facebook Lead Ads**',
      leadData.campaign_name ? `**Campagne:** ${leadData.campaign_name}` : null,
      leadData.ad_name ? `**Advertentie:** ${leadData.ad_name}` : null,
      job ? `**Gekoppeld aan vacature:** ${job.title}` : '**Vacature:** niet automatisch te koppelen — kies handmatig.',
    ].filter(Boolean);
    await supabaseAdmin.from('CandidateNote').insert({
      candidateId: candidate.id,
      authorId: author,
      content: lines.join('\n'),
    });
  }

  const assignee = job ? await autoAssignCandidate(candidate.id, candidateName, job.id) : null;

  // Beheerders altijd een in-app melding (de toegewezen recruiter kreeg er al een).
  const { data: admins } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('role', 'ADMIN')
    .eq('isActive', true);
  const notifRows = ((admins ?? []) as { id: string }[])
    .filter((a) => a.id !== assignee)
    .map((a) => ({
      userId: a.id,
      type: 'NEW_CANDIDATE',
      title: `Nieuwe kandidaat via Facebook: ${candidateName}`,
      message: `${candidateName} heeft een Facebook-leadformulier ingevuld${job ? ` voor "${job.title}"` : ''}.`,
      isRead: false,
      linkUrl: `/dashboard/werving/${candidate.id}`,
    }));
  if (notifRows.length > 0) {
    const { error } = await supabaseAdmin.from('Notification').insert(notifRows);
    if (error) console.error('[fb-leads] meldingen mislukt:', error.message);
  }

  // Google Sheets-log (best effort)
  try {
    const sheetId = process.env.GOOGLE_SHEETS_IDS?.split(',')[0] ?? process.env.GOOGLE_SHEETS_ID ?? '';
    if (sheetId) {
      await appendLeadToSheet(sheetId, {
        date: now.toLocaleDateString('nl-NL'),
        name: candidateName,
        email: email || '',
        phone: phone || '',
        campaign: leadData.campaign_name ?? leadData.ad_id ?? '',
        status: 'NEW_LEAD',
        zwaluwId: candidate.id,
      });
    }
  } catch (err) {
    console.error('[fb-leads] Google Sheets append mislukt (niet fataal):', err);
  }

  // Mail aan beheerder + toegewezen recruiter
  if (isEmailConfigured()) {
    const to = new Set<string>();
    if (process.env.ADMIN_EMAIL) to.add(process.env.ADMIN_EMAIL.trim().toLowerCase());
    if (assignee) {
      const { data: owner } = await supabaseAdmin.from('User').select('email').eq('id', assignee).maybeSingle();
      const ownerEmail = (owner as { email?: string } | null)?.email;
      if (ownerEmail) to.add(ownerEmail.trim().toLowerCase());
    }
    for (const recipient of to) {
      try {
        await sendNewCandidateEmail({
          to: recipient,
          candidateName,
          email: email || '(geen e-mailadres)',
          phone: phone || undefined,
          jobTitle: job?.title,
          source: 'Facebook Lead Ads',
          campaignId: leadData.campaign_name ?? undefined,
          portalUrl: `${externalBaseUrl()}/dashboard/werving/${candidate.id}`,
        });
      } catch (err) {
        console.error('[fb-leads] mail mislukt (niet fataal):', err);
      }
    }
  }

  return candidateName;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FacebookFieldData {
  name: string;
  values: string[];
}

interface FacebookLeadData {
  id: string;
  field_data: FacebookFieldData[];
  ad_id?: string;
  form_id?: string;
  campaign_name?: string;
  ad_name?: string;
  created_time?: string;
}

interface FacebookWebhookChange {
  field: string;
  value?: {
    leadgen_id?: string;
    ad_id?: string;
    page_id?: string;
    form_id?: string;
    created_time?: number;
  };
}

interface FacebookWebhookEntry {
  id: string;
  time: number;
  changes?: FacebookWebhookChange[];
}

interface FacebookWebhookPayload {
  object: string;
  entry?: FacebookWebhookEntry[];
}

function extractFields(fieldData: FacebookFieldData[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fieldData) {
    result[field.name.toLowerCase().replace(/\s+/g, '_')] = (field.values[0] ?? '').trim();
  }
  return result;
}
