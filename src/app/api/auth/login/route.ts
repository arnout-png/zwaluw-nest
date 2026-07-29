import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mailadres en wachtwoord zijn verplicht." },
        { status: 400 }
      );
    }

    // Fetch user via Supabase client (HTTPS — IPv4 compatible)
    const { data: users, error } = await supabaseAdmin
      .from("User")
      .select("id, email, name, role, passwordHash, isActive")
      .eq("email", email.toLowerCase().trim())
      .limit(1);

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json(
        { error: "Er is een fout opgetreden. Probeer het opnieuw." },
        { status: 500 }
      );
    }

    const user = users?.[0];

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Ongeldige inloggegevens." },
        { status: 401 }
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Ongeldige inloggegevens." },
        { status: 401 }
      );
    }

    // Create session cookie
    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Audit log
    logAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ipAddress: getIp(request) });

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Er is een fout opgetreden. Probeer het opnieuw." },
      { status: 500 }
    );
  }
}
