import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { autoAssignCandidate } from '@/lib/recruitment';
import { logAudit, getIp } from '@/lib/audit';

function splitName(name: string) {
  const parts = name.trim().split(' ');
  return {
    firstName: parts[0] ?? '',
    lastName: (parts.slice(1).join(' ') || parts[0]) ?? '',
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const trash = searchParams.get('trash') === 'true';

  // Try with deletedAt first, fallback without if column doesn't exist
  let query = supabaseAdmin
    .from('Candidate')
    .select(
      `id, status, name, email, phone, age, location, salaryExpectation,
       consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
       createdAt, updatedAt, deletedAt`
    )
    .order('createdAt', { ascending: false });

  if (trash) {
    query = query.not('deletedAt', 'is', null);
  } else {
    query = query.is('deletedAt', null);
  }

  let { data, error } = await query;

  // Fallback: deletedAt column might not exist
  if (error || (data !== null && data.length === 0)) {
    const fallback = await supabaseAdmin
      .from('Candidate')
      .select(
        `id, status, name, email, phone, age, location, salaryExpectation,
         consentGiven, consentDate, consentExpiresAt, leadSource, leadCampaignId,
         createdAt, updatedAt`
      )
      .order('createdAt', { ascending: false });
    if (!fallback.error && fallback.data && fallback.data.length > 0) {
      data = fallback.data as typeof data;
      error = null;
    }
  }

  if (error) {
    return NextResponse.json({ error: 'Kan kandidaten niet ophalen.' }, { status: 500 });
  }

  // Split name into firstName/lastName for UI
  const enriched = (data ?? []).map((c) => ({ ...c, ...splitName(c.name) }));
  return NextResponse.json({ data: enriched });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (!['ADMIN', 'MANAGER', 'PLANNER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await request.json();
  const { firstName, lastName, name: nameField, email, phone, salaryExpectation, location, jobOpeningId } = body;

  // Accept either combined name or firstName+lastName
  const fullName = nameField || `${firstName ?? ''} ${lastName ?? ''}`.trim();

  if (!fullName || !email) {
    return NextResponse.json(
      { error: 'Naam en e-mail zijn verplicht.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('Candidate')
    .insert({
      name: fullName,
      email,
      phone: phone || null,
      status: 'NEW_LEAD',
      salaryExpectation: salaryExpectation ? String(salaryExpectation) : null,
      location: location || null,
      jobOpeningId: jobOpeningId || null,
      consentGiven: true,
      consentDate: new Date().toISOString(),
      consentExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      stageUpdatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Kan kandidaat niet aanmaken.' }, { status: 500 });
  }

  // Auto-assign based on vacancy role
  if (jobOpeningId) {
    await autoAssignCandidate(data.id, fullName, jobOpeningId);
  }

  logAudit({ userId: session.userId, action: 'CREATE', entity: 'Candidate', entityId: data.id, details: { name: fullName, email, status: 'NEW_LEAD' }, ipAddress: getIp(request) });

  return NextResponse.json({ data: { ...data, ...splitName(data.name) } }, { status: 201 });
}
