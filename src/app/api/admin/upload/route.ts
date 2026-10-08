import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'site-images';
const MAX_SIZE_MB = 10;

export async function GET() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list('vacatures', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const files = (data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      name: f.name,
      url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(`vacatures/${f.name}`).data.publicUrl,
      createdAt: f.created_at,
      size: f.metadata?.size ?? 0,
    }));

  return NextResponse.json({ files });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'Geen bestand ontvangen.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Bestand mag maximaal ${MAX_SIZE_MB}MB zijn.` }, { status: 400 });
  }

  // Extensie afleiden van het (gecontroleerde) type, niet van de bestandsnaam,
  // en de inhoud controleren op de echte bestandshandtekening.
  const EXT_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Alleen JPG, PNG, WebP en GIF zijn toegestaan.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const head = new Uint8Array(arrayBuffer.slice(0, 12));
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isGif = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
  const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  const signatureOk = { jpg: isJpeg, png: isPng, gif: isGif, webp: isWebp }[ext];
  if (!signatureOk) {
    return NextResponse.json({ error: 'Het bestand is geen geldige afbeelding.' }, { status: 400 });
  }

  const path = `vacatures/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('[upload] Storage error:', error.message);
    return NextResponse.json({ error: 'Uploaden mislukt.' }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrlData.publicUrl });
}
