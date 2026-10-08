import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { signedCvUrl } from '@/lib/cv-storage';
import { logAudit, getIp } from '@/lib/audit';

/**
 * GET /api/candidates/[id]/cv — opent het cv van een kandidaat.
 *
 * Alleen ADMIN en MANAGER. Maakt per klik een signed URL van 2 minuten en
 * stuurt de browser erheen; het cv heeft dus nooit een vaste openbare link.
 * Elke inzage komt in de AuditLog (AVG: wie heeft welk cv bekeken).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  if (!['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { id } = await params;
  const { data: candidate } = await supabaseAdmin
    .from('Candidate')
    .select('id, cvUrl')
    .eq('id', id)
    .maybeSingle();

  if (!candidate) return NextResponse.json({ error: 'Kandidaat niet gevonden.' }, { status: 404 });

  const url = await signedCvUrl(candidate.cvUrl as string | null);
  if (!url) {
    return NextResponse.json(
      { error: 'Er is geen (bereikbaar) cv opgeslagen voor deze kandidaat.' },
      { status: 404 }
    );
  }

  logAudit({
    userId: session.userId,
    action: 'CV_VIEW',
    entity: 'Candidate',
    entityId: id,
    ipAddress: getIp(request),
  });

  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
