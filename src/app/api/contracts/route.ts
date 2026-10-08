import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { amsterdamDateString, isIsoDate } from '@/lib/dates';
import { computeChain, isPermanentContract, nextChainPosition, probationWarnings, type ContractLike } from '@/lib/contracts';
import { logAudit, getIp } from '@/lib/audit';

const CONTRACT_COLUMNS = `id, employeeProfileId, contractType, startDate, endDate,
       probationEndDate, contractSequence, hoursPerWeek, salaryGross,
       status, createdAt, updatedAt`;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Alleen beheerders kunnen contracten aanmaken.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    employeeProfileId,
    contractType,
    startDate,
    endDate,
    hoursPerWeek,
    salaryGross,
    probationEndDate,
  } = body;

  if (!employeeProfileId || !contractType || !startDate) {
    return NextResponse.json(
      { error: 'Medewerker, contracttype en startdatum zijn verplicht.' },
      { status: 400 }
    );
  }
  if (!isIsoDate(startDate) || (endDate && !isIsoDate(endDate)) || (probationEndDate && !isIsoDate(probationEndDate))) {
    return NextResponse.json({ error: 'Ongeldige datum (gebruik JJJJ-MM-DD).' }, { status: 400 });
  }
  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: 'De einddatum ligt vóór de startdatum.' }, { status: 400 });
  }
  const hours = hoursPerWeek === undefined || hoursPerWeek === '' ? null : Number(hoursPerWeek);
  const salary = salaryGross === undefined || salaryGross === '' ? null : Number(salaryGross);
  if ((hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 60)) ||
      (salary !== null && (!Number.isFinite(salary) || salary < 0))) {
    return NextResponse.json({ error: 'Ongeldige uren of salaris.' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('EmployeeProfile')
    .select('id')
    .eq('id', employeeProfileId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: 'Medewerkersprofiel niet gevonden.' }, { status: 404 });
  }

  // Ketenpositie op de server bepalen (art. 7:668a BW) in plaats van het getal
  // uit het formulier over te nemen.
  const { data: existingRows } = await supabaseAdmin
    .from('Contract')
    .select('id, startDate, endDate, contractType, status')
    .eq('employeeProfileId', employeeProfileId);
  const existing = (existingRows ?? []) as ContractLike[];

  const newContract: ContractLike = { startDate, endDate: endDate || null, contractType };
  const permanent = isPermanentContract(newContract);
  const contractSequence = permanent ? 1 : nextChainPosition(existing, startDate);

  const warnings: string[] = [];
  if (!permanent) {
    const chain = computeChain([...existing, newContract]);
    if (chain.message && chain.level !== 'ok') warnings.push(chain.message);
  }
  warnings.push(
    ...probationWarnings({ startDate, endDate: endDate || null, probationEndDate: probationEndDate || null, chainPosition: contractSequence })
  );

  // Determine contract status (Amsterdamse kalenderdatum)
  const today = amsterdamDateString();
  const status = startDate > today ? 'PENDING' : !endDate || endDate >= today ? 'ACTIVE' : 'EXPIRED';

  const { data, error } = await supabaseAdmin
    .from('Contract')
    .insert({
      employeeProfileId,
      contractType,
      startDate,
      endDate: endDate || null,
      hoursPerWeek: hours,
      salaryGross: salary,
      probationEndDate: probationEndDate || null,
      contractSequence,
      status,
    })
    .select(CONTRACT_COLUMNS)
    .single();

  if (error) {
    console.error('POST /api/contracts error:', error.message);
    return NextResponse.json({ error: 'Kan contract niet aanmaken.' }, { status: 500 });
  }

  await logAudit({
    userId: session.userId,
    action: 'CREATE',
    entity: 'Contract',
    entityId: (data as { id: string }).id,
    details: { employeeProfileId, contractType, startDate, endDate: endDate || null, contractSequence, warnings },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ data, warnings }, { status: 201 });
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
    .select(CONTRACT_COLUMNS)
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
