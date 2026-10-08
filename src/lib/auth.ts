import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";

const DEV_FALLBACK_SECRET = "zwaluw-dev-secret-change-in-production";

/**
 * Sleutelmateriaal voor de sessie-JWT. In productie zonder JWT_SECRET weigeren
 * we elke sessie, in plaats van stilletjes de publiek bekende fallback-sleutel
 * te gebruiken (daarmee kon iedereen een ADMIN-token maken).
 */
function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    console.error("[auth] JWT_SECRET ontbreekt — alle sessies worden geweigerd.");
    return null;
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

const COOKIE_NAME = "zwaluw-session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error("JWT_SECRET ontbreekt");

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h") // Work day session
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return token;
}

/**
 * Leest en verifieert de sessiecookie én controleert de gebruiker in de database.
 *
 * De JWT blijft 8 uur geldig. Zonder databasecontrole hield een gedeactiveerde
 * of verwijderde gebruiker tot 8 uur toegang, en gold een rolwijziging
 * (bijv. ADMIN → MANAGER) pas na opnieuw inloggen. Rol, naam en actief-status
 * komen daarom altijd vers uit de database.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const secret = getJwtSecret();
  if (!secret) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload: SessionPayload;
  try {
    const verified = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    payload = verified.payload as unknown as SessionPayload;
  } catch {
    return null;
  }
  if (!payload?.userId) return null;

  const { data: user, error } = await supabaseAdmin
    .from("User")
    .select("id, email, name, role, isActive")
    .eq("id", payload.userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] Sessiecontrole mislukt:", error.message);
    return null;
  }
  if (!user || !user.isActive) return null;

  return {
    userId: user.id as string,
    email: user.email as string,
    name: user.name as string,
    role: user.role as string,
  };
});

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Ondertekende, kortlevende OAuth-state. Voorheen was de state bij Google
 * gewoon de userId; daarmee kon iemand zijn eigen Google-agenda aan het
 * profiel van een collega koppelen (en zo afspraken met kandidaatgegevens
 * ontvangen).
 */
export async function signOAuthState(userId: string, purpose: string): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error("JWT_SECRET ontbreekt");
  return new SignJWT({ uid: userId, p: purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verifyOAuthState(state: string, purpose: string): Promise<string | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(state, secret, { algorithms: ["HS256"] });
    if (payload.p !== purpose || typeof payload.uid !== "string") return null;
    return payload.uid;
  } catch {
    return null;
  }
}
