import { toBlocks } from '@/lib/vacature-format';

/**
 * Toont een vrije vacaturetekst als alinea's, tussenkoppen en opsommingen.
 * Geen HTML uit de database: alles gaat als tekst de DOM in.
 */
export function FormattedText({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  const blocks = toBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-4 text-[#3f4947] leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <h3 key={i} className="pt-2 text-lg font-bold text-[#1b1c1c]">
              {block.text}
            </h3>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#196961]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
