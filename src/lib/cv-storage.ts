/**
 * Opslag van cv's (persoonsgegevens) — alleen server-side.
 *
 * Nieuwe cv's gaan naar de PRIVÉ-bucket `cvs`. In Candidate.cvUrl staat dan
 * geen URL maar een referentie `cvs/<jaar>/<maand>/<uuid>.<ext>` (bucket +
 * pad, zoals Supabase' `fullPath`). Medewerkers openen een cv via
 * /api/candidates/[id]/cv, dat na een rolcheck een kortlevende signed URL
 * maakt. Zo is een cv nooit via een vaste openbare link bereikbaar.
 *
 * Oude waarden (vóór okt 2026) zijn publieke URL's in de bucket `site-images`;
 * die blijven werken via dezelfde route.
 *
 * Eenmalige setup (NIET door de app uitgevoerd):
 *   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 *   values ('cvs', 'cvs', false, 10485760, array[
 *     'application/pdf', 'application/msword',
 *     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 *     'image/jpeg', 'image/png', 'image/webp']);
 */
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const CV_BUCKET = 'cvs';
export const CV_MAX_BYTES = 10 * 1024 * 1024;

/** Toegestane extensies met hun content-type. */
export const CV_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const REF_RE = /^cvs\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(pdf|doc|docx|jpg|jpeg|png|webp)$/;

/** True als `ref` een door ons uitgegeven privé-cv-referentie is. */
export function isPrivateCvRef(ref: string | null | undefined): boolean {
  return !!ref && REF_RE.test(ref);
}

/** Maakt een nieuw objectpad + eenmalige upload-URL in de privé-bucket. */
export async function createCvUpload(ext: string): Promise<
  { ok: true; ref: string; path: string; signedUrl: string; token: string } | { ok: false; error: string }
> {
  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(CV_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[cv] signed upload URL mislukt:', error?.message);
    return { ok: false, error: error?.message ?? 'unknown' };
  }
  return { ok: true, ref: `${CV_BUCKET}/${path}`, path, signedUrl: data.signedUrl, token: data.token };
}

/**
 * Bepaalt bucket + pad van een opgeslagen cv-waarde. Accepteert:
 *   - `cvs/2026/10/<uuid>.pdf` (nieuw, privé)
 *   - `https://<project>.supabase.co/storage/v1/object/public/site-images/cvs/<uuid>.pdf` (oud)
 * Alles anders (externe URL's, lege strings) → null: daar sturen we
 * medewerkers niet blind naartoe.
 */
export function resolveCvObject(cvUrl: string | null | undefined): { bucket: string; path: string } | null {
  const v = (cvUrl ?? '').trim();
  if (!v) return null;
  if (isPrivateCvRef(v)) return { bucket: CV_BUCKET, path: v.slice(CV_BUCKET.length + 1) };

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!base) return null;
  const prefix = `${base}/storage/v1/object/public/`;
  if (!v.startsWith(prefix)) return null;
  const rest = decodeURIComponent(v.slice(prefix.length).split('?')[0]);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const path = rest.slice(slash + 1);
  if (!path || path.includes('..')) return null;
  return { bucket, path };
}

/** Kortlevende download-URL (standaard 2 minuten) voor een opgeslagen cv. */
export async function signedCvUrl(cvUrl: string | null | undefined, expiresInSeconds = 120): Promise<string | null> {
  const obj = resolveCvObject(cvUrl);
  if (!obj) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(obj.bucket)
    .createSignedUrl(obj.path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    console.error('[cv] signed URL mislukt:', obj.bucket, error?.message);
    return null;
  }
  return data.signedUrl;
}
