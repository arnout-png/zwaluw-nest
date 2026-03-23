function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#363848] ${className ?? ''}`} />;
}

export default function WervingLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="flex gap-4 overflow-x-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-64 rounded-xl border border-[#363848] bg-[#252732] p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="rounded-lg bg-[#1e2028] p-3 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
