import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getLinkedInLeads, parseLeadToCandidate } from '@/lib/linkedin';

/**
 * POST /api/integrations/linkedin/import
 *
 * Manual pull: fetches lead form responses from the LinkedIn API
 * and creates Candidate records for any new email addresses.
 *
 * Body (optional): { campaignId?: string; since?: number } (since = epoch ms)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Retrieve the stored access token
  const { data: tokenRow } = await supabaseAdmin
    .from('AppSetting')
    .select('value')
    .eq('key', 'LINKEDIN_ACCESS_TOKEN')
    .maybeSingle();

  const accessToken = tokenRow?.value ?? process.env.LINKEDIN_ACCESS_TOKEN;

  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'LinkedIn is not connected. Connect via Instellingen first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: { campaignId?: string; since?: number } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // ignore — body is optional
  }

  let leads;
  try {
    leads = await getLinkedInLeads(accessToken, body.campaignId, body.since);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `LinkedIn API fout: ${String(err)}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const lead of leads) {
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

  return new Response(
    JSON.stringify({ ok: true, fetched: leads.length, created, skipped, errors }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
