import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseLeadToCandidate, verifyLinkedInWebhookSignature } from '@/lib/linkedin';
import type { LinkedInLeadFormResponse } from '@/lib/linkedin';

/**
 * POST /api/integrations/linkedin/webhook
 *
 * Receives real-time lead events from LinkedIn Campaign Manager.
 * Configure this URL in LinkedIn Campaign Manager → Lead Gen Forms → Webhooks.
 *
 * LinkedIn signs requests with HMAC-SHA256 using LINKEDIN_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify signature if secret is configured
  const signature = req.headers.get('X-Li-Signature') ?? req.headers.get('x-li-signature');
  if (process.env.LINKEDIN_WEBHOOK_SECRET) {
    const valid = await verifyLinkedInWebhookSignature(rawBody, signature ?? '');
    if (!valid) {
      console.warn('[LinkedIn webhook] Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // LinkedIn sends an array of lead form responses under "elements"
  const elements: LinkedInLeadFormResponse[] =
    (payload as { elements?: LinkedInLeadFormResponse[] }).elements ?? [];

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const lead of elements) {
    try {
      const parsed = parseLeadToCandidate(lead);

      if (!parsed.email) {
        skipped++;
        continue;
      }

      // Skip duplicate email addresses
      const { data: existing } = await supabaseAdmin
        .from('Candidate')
        .select('id')
        .eq('email', parsed.email)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      await supabaseAdmin.from('Candidate').insert({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        email: parsed.email,
        phone: parsed.phone ?? null,
        leadSource: 'LINKEDIN',
        leadCampaignId: parsed.leadCampaignId ?? null,
        status: 'NEW_LEAD',
        consentGiven: true,
        consentDate: new Date().toISOString(),
        consentExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      created++;
    } catch (err) {
      errors.push(String(err));
    }
  }

  return new Response(JSON.stringify({ ok: true, created, skipped, errors }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/integrations/linkedin/webhook
 *
 * LinkedIn webhook verification challenge (for initial endpoint registration).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challengeCode');

  if (challenge) {
    return new Response(JSON.stringify({ challengeCode: challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
