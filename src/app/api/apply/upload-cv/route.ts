import { NextRequest, NextResponse } from 'next/server';
import { CV_MAX_BYTES, CV_TYPES, createCvUpload } from '@/lib/cv-storage';

/**
 * POST /api/apply/upload-cv — publiek.
 *
 * Geeft een eenmalige upload-URL voor de PRIVÉ-bucket `cvs`; de browser zet het
 * bestand daar zelf neer. Het bestand gaat dus niet door deze functie heen:
 * Vercel kapt request-bodies boven ~4,5 MB af, terwijl het formulier 10 MB
 * belooft (foto's van een cv op een telefoon zijn al snel groter dan 4,5 MB).
 *
 * Body: { fileName: string, fileType?: string, fileSize: number }
 * Antwoord: { ref, signedUrl, token } — `ref` gaat mee met de sollicitatie.
 *
 * De bucket zelf dwingt maximaal 10 MB en de toegestane MIME-types af (zie de
 * setup-SQL in src/lib/cv-storage.ts), dus een client die hier liegt over type
 * of grootte komt alsnog niet verder.
 */
export async function POST(request: NextRequest) {
  let body: { fileName?: unknown; fileType?: unknown; fileSize?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 });
  }

  const fileName = typeof body.fileName === 'string' ? body.fileName : '';
  const fileSize = typeof body.fileSize === 'number' ? body.fileSize : NaN;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  if (!fileName || !CV_TYPES[ext]) {
    return NextResponse.json(
      { error: 'Dit bestandstype wordt niet ondersteund. Upload een PDF, Word-bestand of foto (JPG/PNG).' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: 'Het bestand lijkt leeg te zijn.' }, { status: 400 });
  }
  if (fileSize > CV_MAX_BYTES) {
    return NextResponse.json({ error: 'Je cv mag maximaal 10 MB zijn.' }, { status: 400 });
  }

  const upload = await createCvUpload(ext);
  if (!upload.ok) {
    return NextResponse.json(
      {
        error:
          'Uploaden lukt op dit moment niet. Je kunt zonder cv solliciteren; we vragen er later om.',
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ref: upload.ref,
    signedUrl: upload.signedUrl,
    token: upload.token,
    contentType: CV_TYPES[ext],
  });
}
