import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Alleen beheerders kunnen medewerkers aanmaken.' }, { status: 403 });
  }

  const body = await request.json();
  const {
    email, name, role, password, jobTitle,
    department, startDate, phone, leaveBalance,
  } = body;

  if (!email || !name || !role || !password) {
    return NextResponse.json(
      { error: 'E-mail, naam, rol en wachtwoord zijn verplicht.' },
      { status: 400 }
    );
  }

  // Check if email already in use
  const { data: existing } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Dit e-mailadres is al in gebruik.' },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: newUser, error: userError } = await supabaseAdmin
    .from('User')
    .insert({
      email: email.toLowerCase().trim(),
      name,
      jobTitle: jobTitle?.trim() || null,
      role,
      passwordHash,
      isActive: true,
    })
    .select('id, email, name, jobTitle, role, isActive, createdAt, updatedAt')
    .single();

  if (userError) {
    console.error('Create user error:', userError.message);
    return NextResponse.json({ error: 'Kan medewerker niet aanmaken.' }, { status: 500 });
  }

  // Create employee profile with real column names
  const { error: epError } = await supabaseAdmin.from('EmployeeProfile').insert({
    userId: newUser.id,
    department: department || null,
    startDate: startDate || null,
    phonePersonal: phone || null,
    leaveBalanceDays: leaveBalance ? Number(leaveBalance) : 25,
    leaveUsedDays: 0,
  });

  if (epError) {
    console.error('Create EmployeeProfile error:', epError.message);
    // User created but profile failed — still return success, profile can be added later
  }

  return NextResponse.json({ data: newUser }, { status: 201 });
}
