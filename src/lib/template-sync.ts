import { supabaseAdmin } from './supabase';

/**
 * Werkt de vragen van een screeningscript of de punten van een interview-
 * checklist bij zónder alle bestaande rijen weg te gooien.
 *
 * Voorheen werden bij elke opslag alle vragen verwijderd en opnieuw
 * aangemaakt. Elke vraag kreeg dan een nieuw id, waardoor de antwoorden die
 * kandidaten al hadden gegeven (ScreeningAnswer.questionId) en afgevinkte
 * checklistpunten nergens meer aan hingen — ook als er niets aan de vraag was
 * veranderd. (In productie hangen 14 van de 44 screeningantwoorden al los.)
 *
 * Nu: een vraag met dezelfde tekst houdt zijn id; een gewijzigde tekst op
 * dezelfde positie wordt als bewerking gezien; alleen echt verwijderde vragen
 * verdwijnen.
 */
export async function syncOrderedRows(opts: {
  table: 'ScreeningQuestion' | 'InterviewChecklistItem';
  parentColumn: 'scriptId' | 'checklistId';
  parentId: string;
  textColumn: 'question' | 'label';
  rows: Record<string, unknown>[];
}): Promise<{ error?: string }> {
  const { table, parentColumn, parentId, textColumn, rows } = opts;

  const { data: existingData, error: loadError } = await supabaseAdmin
    .from(table)
    .select(`id, ${textColumn}, order`)
    .eq(parentColumn, parentId)
    .order('order', { ascending: true });
  if (loadError) return { error: loadError.message };

  const existing = (existingData ?? []) as unknown as Record<string, unknown>[];
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const used = new Set<string>();
  const assigned: (string | null)[] = rows.map(() => null);

  // 1. Zelfde tekst → zelfde id
  rows.forEach((row, i) => {
    const match = existing.find((e) => !used.has(e.id as string) && norm(e[textColumn]) === norm(row[textColumn]));
    if (match) {
      assigned[i] = match.id as string;
      used.add(match.id as string);
    }
  });
  // 2. Andere tekst op dezelfde positie → bewerking van die vraag
  rows.forEach((_row, i) => {
    if (assigned[i]) return;
    const atPosition = existing[i];
    if (atPosition && !used.has(atPosition.id as string)) {
      assigned[i] = atPosition.id as string;
      used.add(atPosition.id as string);
    }
  });

  for (let i = 0; i < rows.length; i++) {
    const values = { ...rows[i], order: i + 1 };
    const id = assigned[i];
    const { error } = id
      ? await supabaseAdmin.from(table).update(values).eq('id', id)
      : await supabaseAdmin.from(table).insert({ ...values, [parentColumn]: parentId });
    if (error) return { error: error.message };
  }

  const removed = existing.map((e) => e.id as string).filter((id) => !used.has(id));
  if (removed.length > 0) {
    const { error } = await supabaseAdmin.from(table).delete().in('id', removed);
    if (error) return { error: error.message };
  }

  return {};
}
