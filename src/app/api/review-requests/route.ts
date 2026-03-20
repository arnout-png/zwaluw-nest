import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendReviewRequestEmail } from '@/lib/email';

const REVIEW_URL = process.env.REVIEW_URL ?? 'https://g.page/r/veiligdouchen/review';

/**
 * POST /api/review-requests
 * Body: { appointmentId, customerId, customerEmail, customerName }
 * Creates a ReviewRequest record and sends the review email.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });

  const body = await request.json();
  const { appointmentId, customerId, customerEmail, customerName } = body;

  if (!customerId || !customerEmail || !customerName) {
    return NextResponse.json(
      { error: 'customerId, customerEmail en customerName zijn verplicht.' },
      { status: 400 }
    );
  }

  // Prevent duplicate review requests for the same appointment
  if (appointmentId) {
    const { count } = await supabaseAdmin
      .from('ReviewRequest')
      .select('id', { count: 'exact', head: true })
      .eq('appointmentId', appointmentId);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Er is al een beoordelingsverzoek verstuurd voor deze afspraak.' },
        { status: 409 }
      );
    }
  }

  // Create ReviewRequest record
  const { data, error } = await supabaseAdmin
    .from('ReviewRequest')
    .insert({
      customerId,
      appointmentId: appointmentId ?? null,
      sentAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('ReviewRequest insert error:', error);
    return NextResponse.json({ error: 'Kan verzoek niet opslaan.' }, { status: 500 });
  }

  // Send email
  if (process.env.RESEND_API_KEY) {
    try {
      await sendReviewRequestEmail({
        to: customerEmail,
        customerName,
        reviewUrl: REVIEW_URL,
      });
    } catch (err) {
      console.error('Review request email failed (non-fatal):', err);
    }
  }

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
