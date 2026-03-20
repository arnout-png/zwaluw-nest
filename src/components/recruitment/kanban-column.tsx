import type { Candidate, CandidateStatus } from '@/types';
import { CandidateCard } from './candidate-card';

interface KanbanColumnProps {
  title: string;
  status: CandidateStatus | CandidateStatus[];
  candidates: Candidate[];
  color: string;
  onMove: (id: string, newStatus: CandidateStatus) => void;
}

export function KanbanColumn({ title, candidates, color, onMove }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[220px] max-w-[280px] flex-1">
      {/* Column header */}
      <div className={`flex items-center justify-between rounded-t-lg px-3 py-2 ${color}`}>
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">
          {candidates.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 rounded-b-lg border border-t-0 border-[#363848] bg-[#252732] p-2 space-y-2 min-h-[200px]">
        {candidates.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-[#9ca3af]">
            Geen kandidaten
          </div>
        ) : (
          candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}
