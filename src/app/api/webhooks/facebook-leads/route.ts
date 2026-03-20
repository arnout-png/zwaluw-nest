import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { appendLeadToSheet } from '@/lib/google-sheets';
import { sendNewCandidateEmail } from '@/lib/email';

/**
 * Facebook Lead Ads Webhook
 *
 * Step 1 — GET: Facebook sends a verification challenge when you first register
 *   the webhook in Facebook Business Manager.
 *
 * Step 2 — POST: Facebook sends lead data when a new lead form is submitted.
 *   We verify the X-Hub-Signature-256 header, create a Candidate, log to Google
 *   Sheets, and notify ADMIN users.
 *
 * Required env vars:
 *   FACEBOOK_WEBHOOK_VERIFY_TOKEN  — any string you choose, entered in FB Business Manager
 *   FACEBOOK_APP_SECRET            — from your Facebook App settings
 *   NEXT_PUBLIC_APP_URL            — base URL of your portal (e.g. https://portal.zwaluw.nl)
 */

// ─── Verification handshake (GET) ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    console.log('Facebook webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ─── Lead event (POST) ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify signature
  const signature = request.headers.get('x-hub-signature-256');
  if (!signature || !process.env.FACEBOOK_APP_SECRET) {
    return NextResponse.json({ error: 'Missing signature or app secret' }, { status: 401 });
  }

  const expectedSig =
    'sha256=' +
    createHmac('sha256', process.env.FACEBOOK_APP_SECRET)
      .update(rawBody)
      .digest('hex');

  if (signature !== expectedSig) {
    console.error('Facebook webhook signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: FacebookWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const processed: string[] = [];

  // Facebook sends an array of entries (pages), each with changes (leads)
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;

      const leadId = change.value?.leadgen_id;
      const adId = change.value?.ad_id;
      const pageId = change.value?.page_id;

      if (!leadId) continue;

      // Fetch the actual lead field data from Facebook Graph API
      let leadData: FacebookLeadData | null = null;
      if (process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v19.0/${leadId}?fields=field_data,ad_id,form_id,created_time&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
          );
          if (res.ok) {
            leadData = await res.json();
          }
        } catch (err) {
          console.error('Failed to fetch lead data from Facebook Graph API:', err);
        }
      }

      // Map lead fields to candidate fields
      const fields = extractFields(leadData?.field_data ?? []);

      const firstName = fields['voornaam'] ?? fields['first_name'] ?? fields['naam']?.split(' ')[0] ?? '';
      const lastName =
        fields['achternaam'] ?? fields['last_name'] ?? fields['naam']?.split(' ').slice(1).join(' ') ?? '';
      const email = fields['e-mailadres'] ?? fields['email'] ?? '';
      const phone = fields['telefoonnummer'] ?? fields['phone_number'] ?? fields['phone'] ?? '';
      const location = fields['postcode'] ?? fields['zip_code'] ?? '';
      const currentJob = fields['huidige_functie'] ?? fields['huidige baan'] ?? '';
      const salaryStr = fields['salarisverwachting'] ?? '';

      if (!email && !firstName) {
        console.warn('Facebook lead missing required fields, skipping:', leadId);
        continue;
      }

      const consentDate = new Date();
      const consentExpiry = new Date(consentDate);
      consentExpiry.setFullYear(consentExpiry.getFullYear() + 1);

      // Insert candidate
      const { data: candidate, error: insertError } = await supabaseAdmin
        .from('Candidate')
        .insert({
          firstName: firstName || 'Onbekend',
          lastName: lastName || '',
          email: email || `lead-${leadId}@facebook-lead.local`,
          phone: phone || null,
          status: 'NEW_LEAD',
          source: 'Facebook Ads',
          leadSource: 'Facebook Ads',
          leadCampaignId: adId ?? pageId ?? null,
          notes: currentJob ? `Huidige baan: ${currentJob}` : null,
          salaryExpectation: salaryStr ? parseFloat(salaryStr.replace(/[^0-9.]/g, '')) || null : null,
          availableFrom: null,
          consentGivenAt: consentDate.toISOString(),
          consentExpiresAt: consentExpiry.toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert Facebook lead as candidate:', insertError);
        continue;
      }

      const candidateName = `${firstName} ${lastName}`.trim();
      processed.push(candidateName);

      // Notify all ADMIN users in-app
      const { data: admins } = await supabaseAdmin
        .from('User')
        .select('id')
        .eq('role', 'ADMIN')
        .eq('isActive', true);

      const notifRows = (admins ?? []).map((a: { id: string }) => ({
        userId: a.id,
        type: 'NEW_CANDIDATE',
        title: 'Nieuwe kandidaat via Facebook Ads',
        message: `${candidateName} heeft een formulier ingevuld via de Facebook Lead Ads campagne.`,
        read: false,
        link: '/dashboard/werving',
      }));

      if (notifRows.length > 0) {
        await supabaseAdmin.from('Notification').insert(notifRows).then(({ error }) => {
          if (error) console.error('Notification insert error:', error);
        });
      }

      // Log to Google Sheets (best-effort)
      try {
        await appendLeadToSheet({
          date: new Date().toLocaleDateString('nl-NL'),
          name: candidateName,
          email: email || '',
          phone: phone || '',
          campaign: adId ?? '',
          status: 'NEW_LEAD',
          zwaluwId: candidate.id,
        });
      } catch (err) {
        console.error('Google Sheets append failed (non-fatal):', err);
      }

      // Email ADMIN
      if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
        try {
          await sendNewCandidateEmail({
            to: process.env.ADMIN_EMAIL,
            candidateName,
            email: email || '',
            phone: phone || undefined,
            source: 'Facebook Ads',
            campaignId: adId,
            portalUrl: (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/dashboard/werving',
          });
        } catch (err) {
          console.error('New candidate email failed (non-fatal):', err);
        }
      }
    }
  }

  // Always respond 200 quickly so Facebook doesn't retry
  return NextResponse.json({ ok: true, processed: processed.length, names: processed });
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
    result[field.name.toLowerCase().replace(/\s+/g, '_')] = field.values[0] ?? '';
  }
  return result;
}
