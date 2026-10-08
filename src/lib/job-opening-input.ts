import { NextResponse } from 'next/server';

/** Invoer-helpers voor /api/admin/job-openings (POST + PATCH). */

/** Slugs komen in de publieke URL (/vacature/<slug>) en in Facebook-posts. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lege strings uit het formulier opslaan als null (anders tonen pagina's lege blokken). */
export function nullable(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v : null;
}

/** Postgres unique-violation op slug → leesbare melding. */
export function slugError(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return NextResponse.json({ error: 'Deze slug is al in gebruik door een andere vacature.' }, { status: 409 });
  }
  return NextResponse.json({ error: error.message }, { status: 500 });
}
