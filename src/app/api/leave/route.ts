import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Helper: get employeeProfileId for the current user
async function getEmployeeProfileId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', userId)
    .single();
  return data?.id ?? null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const isAdminOrPlanner = session.role === 'ADMIN' || session.role === 'PLANNER';

  let query = supabaseAdmin
    .from('LeaveRequest')
    .select(
      `id, employeeProfileId, type, status, startDate, endDate,
       totalDays, reason, approvedById, respondedAt, createdAt,
       employeeProfile:EmployeeProfile!LeaveRequest_employeeProfileId_fkey (
         userId,
         user:User!EmployeeProfile_userId_fkey (id, name, email, role)
       ),
       approvedBy:User!LeaveRequest_approvedById_fkey (id, name)`
    )
    .order('createdAt', { ascending: false });

  if (!isAdminOrPlanner) {
    // Filter by current user's employeeProfile
    const employeeProfileId = await getEmployeeProfileId(session.userId);
    if (!employeeProfileId) {
      return NextResponse.json({ data: [] });
    }
    query = query.eq('employeeProfileId', employeeProfileId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('GET /api/leave error:', error.message);
    return NextResponse.json({ error: 'Kan verlofaanvragen niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const body = await request.json();
  const { type, startDate, endDate, days, reason } = body;

  if (!type || !startDate || !endDate || !days) {
    return NextResponse.json(
      { error: 'Type, startdatum, einddatum en aantal dagen zijn verplicht.' },
      { status: 400 }
    );
  }

  const employeeProfileId = await getEmployeeProfileId(session.userId);
  if (!employeeProfileId) {
    return NextResponse.json(
      { error: 'Geen medewerkersprofiel gevonden. Neem contact op met de beheerder.' },
      { status: 404 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('LeaveRequest')
    .insert({
      employeeProfileId,
      type,
      startDate,
      endDate,
      totalDays: Number(days),
      status: type === 'SICK' ? 'APPROVED' : 'PENDING',
      reason: reason || null,
    })
    .select()
    .single();

  if (error) {
    console.error('POST /api/leave error:', error.message);
    return NextResponse.json({ error: 'Kan verlofaanvraag niet aanmaken.' }, { status: 500 });
  }

  // If sick leave, auto-create SickTracker entry
  if (type === 'SICK') {
    await supabaseAdmin.from('SickTracker').insert({
      employeeProfileId,
      sicknessStartDate: startDate,
      week6ProblemAnalysis: false,
      week8ActionPlan: false,
      week42UwvNotification: false,
    });
  }

  return NextResponse.json({ data }, { status: 201 });
}
