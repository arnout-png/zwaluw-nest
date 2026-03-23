function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#363848] ${className ?? ''}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-4">
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-20 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
