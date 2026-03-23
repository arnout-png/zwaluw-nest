function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#363848] ${className ?? ''}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-3">
        <Skeleton className="h-4 w-48" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
