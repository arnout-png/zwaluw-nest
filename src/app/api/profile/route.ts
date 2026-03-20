import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('EmployeeProfile')
    .select(
      `id, userId, dateOfBirth, address, city, postalCode, phonePersonal,
       emergencyName, emergencyPhone, startDate, department,
       leaveBalanceDays, leaveUsedDays, createdAt, updatedAt`
    )
    .eq('userId', session.userId)
    .single();

  if (error) {
    console.error('GET /api/profile error:', error.message);
    return NextResponse.json({ error: 'Kan profiel niet ophalen.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
  }

  const body = await request.json();

  // Fields employees can update themselves
  const allowedProfileFields: Record<string, unknown> = {};
  const profileKeys = [
    'address', 'city', 'postalCode', 'phonePersonal',
    'emergencyName', 'emergencyPhone', 'dateOfBirth',
  ];
  for (const key of profileKeys) {
    if (key in body && body[key] !== undefined) {
      allowedProfileFields[key] = body[key] || null;
    }
  }

  if (Object.keys(allowedProfileFields).length === 0 && !body.name && !body.currentPassword) {
    return NextResponse.json({ error: 'Geen velden om bij te werken.' }, { status: 400 });
  }

  // Update EmployeeProfile fields
  if (Object.keys(allowedProfileFields).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from('EmployeeProfile')
      .update(allowedProfileFields)
      .eq('userId', session.userId);

    if (profileError) {
      console.error('PATCH /api/profile profile error:', profileError.message);
      return NextResponse.json({ error: 'Kan profiel niet bijwerken.' }, { status: 500 });
    }
  }

  // Update display name on User table
  if (body.name && typeof body.name === 'string' && body.name.trim()) {
    const { error: nameError } = await supabaseAdmin
      .from('User')
      .update({ name: body.name.trim() })
      .eq('id', session.userId);

    if (nameError) {
      console.error('PATCH /api/profile name error:', nameError.message);
      return NextResponse.json({ error: 'Kan naam niet bijwerken.' }, { status: 500 });
    }
  }

  // Password change
  if (body.currentPassword && body.newPassword) {
    const bcrypt = await import('bcryptjs');

    // Verify current password
    const { data: userRow } = await supabaseAdmin
      .from('User')
      .select('passwordHash')
      .eq('id', session.userId)
      .single();

    if (!userRow?.passwordHash) {
      return NextResponse.json({ error: 'Kan wachtwoord niet verifiëren.' }, { status: 400 });
    }

    const valid = await bcrypt.compare(body.currentPassword, userRow.passwordHash as string);
    if (!valid) {
      return NextResponse.json({ error: 'Huidig wachtwoord is onjuist.' }, { status: 400 });
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens zijn.' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(body.newPassword, 12);
    const { error: pwError } = await supabaseAdmin
      .from('User')
      .update({ passwordHash: newHash })
      .eq('id', session.userId);

    if (pwError) {
      console.error('PATCH /api/profile password error:', pwError.message);
      return NextResponse.json({ error: 'Kan wachtwoord niet bijwerken.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
