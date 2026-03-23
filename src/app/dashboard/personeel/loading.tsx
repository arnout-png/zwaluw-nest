function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#363848] ${className ?? ''}`} />;
}

export default function PersoneelLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <div className="rounded-xl border border-[#363848] bg-[#252732] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#363848]">
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
        <div className="divide-y divide-[#363848]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
