import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Helper: get employeeProfileId for a userId
async function getEPId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('userId', userId)
    .single();
  return data?.id ?? null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const employeeProfileId = searchParams.get('employeeProfileId');

  let query = supabaseAdmin
    .from('Appointment')
    .select(
      `id, employeeProfileId, customerId, title, description, date,
       startTime, endTime, location, status, saleValue, createdAt, updatedAt,
       customer:Customer (id, name, phone, address, city),
       employeeProfile:EmployeeProfile!Appointment_employeeProfileId_fkey (
         id, userId,
         user:User!EmployeeProfile_userId_fkey (id, name, role)
       )`
    )
    .order('startTime');

  // MONTEUR and ADVISEUR can only see own appointments
  if (session.role === 'MONTEUR' || session.role === 'ADVISEUR') {
    const epId = await getEPId(session.userId);
    if (epId) query = query.eq('employeeProfileId', epId);
    else return NextResponse.json({ data: [] });
  } else if (employeeProfileId) {
    query = query.eq('employeeProfileId', employeeProfileId);
  }

  if (date) {
    query = query
      .gte('startTime', `${date}T00:00:00`)
      .lte('startTime', `${date}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('GET /api/appointments error:', error.message);
    return NextResponse.json({ error: 'Kan afspraken niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN' && session.role !== 'PLANNER') {
    return NextResponse.json(
      { error: 'Alleen beheerders en planners kunnen afspraken aanmaken.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    employeeProfileId,
    customerId,
    title,
    description,
    date,
    startTime,
    endTime,
    location,
    // Legacy fields from agenda form — map them
    type,       // → title
    scheduledAt, // → date + startTime
    duration,    // → compute endTime
    address,    // → location
    notes,      // → description
  } = body;

  // Normalise: accept either new or legacy field names
  const resolvedTitle = title || type || 'Afspraak';
  const resolvedDescription = description || notes || null;
  const resolvedLocation = location || address || null;

  let resolvedDate = date;
  let resolvedStart = startTime;
  let resolvedEnd = endTime;

  if (!resolvedDate && scheduledAt) {
    resolvedDate = scheduledAt.split('T')[0];
    resolvedStart = scheduledAt;
    const durationMin = Number(duration) || 60;
    const endMs = new Date(scheduledAt).getTime() + durationMin * 60 * 1000;
    resolvedEnd = new Date(endMs).toISOString();
  }

  if (!employeeProfileId || !resolvedTitle || !resolvedDate) {
    return NextResponse.json(
      { error: 'Medewerker, titel en datum zijn verplicht.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('Appointment')
    .insert({
      employeeProfileId,
      customerId: customerId || null,
      title: resolvedTitle,
      description: resolvedDescription,
      date: resolvedDate,
      startTime: resolvedStart,
      endTime: resolvedEnd,
      location: resolvedLocation,
      status: 'SCHEDULED',
      createdById: session.userId,
    })
    .select(
      `id, employeeProfileId, customerId, title, description, date,
       startTime, endTime, location, status, createdAt, updatedAt,
       customer:Customer (id, name, phone, address, city),
       employeeProfile:EmployeeProfile!Appointment_employeeProfileId_fkey (
         id, userId,
         user:User!EmployeeProfile_userId_fkey (id, name, role)
       )`
    )
    .single();

  if (error) {
    console.error('POST /api/appointments error:', error.message);
    return NextResponse.json({ error: 'Kan afspraak niet aanmaken.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
