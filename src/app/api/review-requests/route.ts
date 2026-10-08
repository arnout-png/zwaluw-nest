import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendReviewRequestEmail, isEmailConfigured } from '@/lib/email';
import { logAudit, getIp } from '@/lib/audit';

const REVIEW_URL = process.env.REVIEW_URL ?? 'https://g.page/r/veiligdouchen/review';
const ALLOWED_ROLES = ['ADMIN', 'MANAGER', 'PLANNER', 'ADVISEUR'];

/**
 * POST /api/review-requests
 * Body: { customerId }
 * Creates a ReviewRequest record and sends the review email.
 *
 * Voorheen faalde elke aanroep: de insert gebruikte een niet-bestaande kolom
 * `appointmentId` en liet het verplichte `requestedById` weg. Bovendien kwamen
 * e-mailadres en naam uit de request body, zodat iedere ingelogde gebruiker
 * mail naar willekeurige adressen kon laten versturen. Nu: alleen voor de
 * rollen die met klanten werken, en altijd naar het adres van de klantkaart.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const customerId = typeof body.customerId === 'string' ? body.customerId : '';
  if (!customerId) {
    return NextResponse.json({ error: 'customerId is verplicht.' }, { status: 400 });
  }

  const { data: customer } = await supabaseAdmin
    .from('Customer')
    .select('id, name, email')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: 'Klant niet gevonden.' }, { status: 404 });
  }
  if (!customer.email) {
    return NextResponse.json({ error: 'Deze klant heeft geen e-mailadres.' }, { status: 400 });
  }

  // Niet dezelfde klant binnen 30 dagen opnieuw benaderen.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('ReviewRequest')
    .select('id', { count: 'exact', head: true })
    .eq('customerId', customerId)
    .gte('createdAt', since);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Deze klant heeft de afgelopen 30 dagen al een beoordelingsverzoek gekregen.' },
      { status: 409 }
    );
  }

  // Create ReviewRequest record
  const { data, error } = await supabaseAdmin
    .from('ReviewRequest')
    .insert({
      customerId,
      requestedById: session.userId,
      sentAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('ReviewRequest insert error:', error);
    return NextResponse.json({ error: 'Kan verzoek niet opslaan.' }, { status: 500 });
  }

  // Send email
  if (isEmailConfigured()) {
    try {
      await sendReviewRequestEmail({
        to: customer.email as string,
        customerName: customer.name as string,
        reviewUrl: REVIEW_URL,
      });
    } catch (err) {
      console.error('Review request email failed (non-fatal):', err);
    }
  }

  await logAudit({
    userId: session.userId,
    action: 'REVIEW_REQUEST_SENT',
    entity: 'Customer',
    entityId: customerId,
    ipAddress: getIp(request),
  });

  return NextResponse.json({ data }, { status: 201 });
}

/**
 * GET /api/review-requests
 * Returns review request stats for the dashboard widget.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [totalResult, monthResult, completedResult] = await Promise.all([
    supabaseAdmin.from('ReviewRequest').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('ReviewRequest')
      .select('id', { count: 'exact', head: true })
      .gte('sentAt', firstOfMonth.toISOString()),
    supabaseAdmin
      .from('ReviewRequest')
      .select('rating')
      .not('rating', 'is', null),
  ]);

  const ratings = (completedResult.data ?? []).map((r: { rating: number | null }) => r.rating).filter(Boolean) as number[];
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return NextResponse.json({
    total: totalResult.count ?? 0,
    thisMonth: monthResult.count ?? 0,
    completed: ratings.length,
    avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
  });
}
