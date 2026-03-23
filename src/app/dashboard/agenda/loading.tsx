function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#363848] ${className ?? ''}`} />;
}

export default function AgendaLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-[#363848] bg-[#252732] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#363848]">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-3 py-3 border-r border-[#363848] last:border-r-0">
              <Skeleton className="h-4 w-12 mx-auto" />
            </div>
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-7 border-b border-[#363848] last:border-b-0">
            {[0, 1, 2, 3, 4, 5, 6].map((col) => (
              <div key={col} className="h-24 p-2 border-r border-[#363848] last:border-r-0 space-y-1">
                <Skeleton className="h-3 w-6" />
                {col % 3 === 0 && <Skeleton className="h-5 w-full rounded" />}
                {col % 5 === 0 && <Skeleton className="h-5 w-4/5 rounded" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
