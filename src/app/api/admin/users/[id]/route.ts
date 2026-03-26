import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, role, isActive, phonePersonal } = body as {
    name?: string;
    role?: string;
    isActive?: boolean;
    phonePersonal?: string;
  };

  // Update User fields
  const userUpdate: Record<string, unknown> = {};
  if (name !== undefined) userUpdate.name = name.trim();
  if (role !== undefined) userUpdate.role = role;
  if (isActive !== undefined) userUpdate.isActive = isActive;

  if (Object.keys(userUpdate).length > 0) {
    const { error } = await supabaseAdmin
      .from('User')
      .update({ ...userUpdate, updatedAt: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('PATCH user error:', error.message);
      return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 });
    }
  }

  // Update EmployeeProfile.phonePersonal if provided
  if (phonePersonal !== undefined) {
    // First check if profile exists
    const { data: profile } = await supabaseAdmin
      .from('EmployeeProfile')
      .select('id')
      .eq('userId', id)
      .maybeSingle();

    if (profile) {
      const { error } = await supabaseAdmin
        .from('EmployeeProfile')
        .update({ phonePersonal: phonePersonal.trim() || null, updatedAt: new Date().toISOString() })
        .eq('userId', id);
      if (error) {
        console.error('PATCH employeeProfile error:', error.message);
      }
    } else {
      // Create a minimal profile if none exists
      await supabaseAdmin
        .from('EmployeeProfile')
        .insert({ userId: id, phonePersonal: phonePersonal.trim() || null });
    }
  }

  const { data: updated } = await supabaseAdmin
    .from('User')
    .select('id, email, name, role, isActive, createdAt, updatedAt')
    .eq('id', id)
    .single();

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (session.userId === id) {
    return NextResponse.json({ error: 'Je kunt je eigen account niet verwijderen.' }, { status: 400 });
  }

  // Delete EmployeeProfile first (FK dependency)
  await supabaseAdmin.from('EmployeeProfile').delete().eq('userId', id);

  const { error } = await supabaseAdmin.from('User').delete().eq('id', id);
  if (error) {
    console.error('DELETE user error:', error.message);
    // FK constraint = user still has linked records (candidates, notes, etc.)
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Gebruiker heeft nog gekoppelde gegevens. Zet de gebruiker op Inactief in plaats van verwijderen.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
