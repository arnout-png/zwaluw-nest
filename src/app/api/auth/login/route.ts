import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { createSession } from "@/lib/auth";
import { logAudit, getIp } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Hash van een willekeurige string, zodat een onbekend e-mailadres net zo lang
// duurt als een fout wachtwoord (anders verraadt de responstijd welke accounts bestaan).
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(crypto.randomUUID(), 12);
  return dummyHash;
}

async function recentFailedAttempts(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("AuditLog")
    .select("id", { count: "exact", head: true })
    .eq("action", "LOGIN_FAILED")
    .eq("entityId", email)
    .gte("createdAt", since);
  return count ?? 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mailadres en wachtwoord zijn verplicht." },
        { status: 400 }
      );
    }

    // Brute-force-rem: na 5 mislukte pogingen binnen 15 minuten tijdelijk blokkeren.
    if ((await recentFailedAttempts(email)) >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { error: `Te veel mislukte pogingen. Probeer het over ${LOCKOUT_MINUTES} minuten opnieuw.` },
        { status: 429 }
      );
    }

    // Fetch user via Supabase client (HTTPS — IPv4 compatible)
    const { data: users, error } = await supabaseAdmin
      .from("User")
      .select("id, email, name, role, passwordHash, isActive")
      .eq("email", email)
      .limit(1);

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json(
        { error: "Er is een fout opgetreden. Probeer het opnieuw." },
        { status: 500 }
      );
    }

    const user = users?.[0];

    // Accounts zonder wachtwoord (bijv. uit de Nmbrs-import) hebben een lege hash.
    const hash = user?.passwordHash ? (user.passwordHash as string) : await getDummyHash();
    let passwordValid = false;
    try {
      passwordValid = await bcrypt.compare(password, hash);
    } catch {
      passwordValid = false;
    }

    if (!user || !user.isActive || !user.passwordHash || !passwordValid) {
      await logAudit({
        userId: user?.id ?? null,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: email,
        ipAddress: getIp(request),
      });
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
    await logAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ipAddress: getIp(request) });

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
