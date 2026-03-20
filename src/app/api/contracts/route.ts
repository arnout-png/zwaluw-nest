import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Alleen beheerders kunnen contracten aanmaken.' }, { status: 403 });
  }

  const body = await request.json();
  const {
    employeeProfileId,
    contractType,
    startDate,
    endDate,
    hoursPerWeek,
    salaryGross,
    probationEndDate,
    contractSequence,
  } = body;

  if (!employeeProfileId || !contractType || !startDate) {
    return NextResponse.json(
      { error: 'Medewerker, contracttype en startdatum zijn verplicht.' },
      { status: 400 }
    );
  }

  // Determine contract status
  const now = new Date().toISOString().split('T')[0];
  const status = !endDate || endDate >= now ? 'ACTIVE' : 'EXPIRED';

  const { data, error } = await supabaseAdmin
    .from('Contract')
    .insert({
      employeeProfileId,
      contractType,
      startDate,
      endDate: endDate || null,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : null,
      salaryGross: salaryGross ? Number(salaryGross) : null,
      probationEndDate: probationEndDate || null,
      contractSequence: contractSequence ? Number(contractSequence) : 1,
      status,
    })
    .select(
      `id, employeeProfileId, contractType, startDate, endDate,
       probationEndDate, contractSequence, hoursPerWeek, salaryGross,
       status, createdAt, updatedAt`
    )
    .single();

  if (error) {
    console.error('POST /api/contracts error:', error.message);
    return NextResponse.json({ error: 'Kan contract niet aanmaken.' }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const employeeProfileId = searchParams.get('employeeProfileId');

  let query = supabaseAdmin
    .from('Contract')
    .select(
      `id, employeeProfileId, contractType, startDate, endDate,
       probationEndDate, contractSequence, hoursPerWeek, salaryGross,
       status, createdAt, updatedAt`
    )
    .order('startDate', { ascending: false });

  if (employeeProfileId) {
    query = query.eq('employeeProfileId', employeeProfileId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Kan contracten niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}
