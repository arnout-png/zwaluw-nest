interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger';
}

export function StatCard({ title, value, subtitle, icon, variant = 'default' }: StatCardProps) {
  const accentColor =
    variant === 'danger'
      ? 'text-red-400'
      : variant === 'warning'
      ? 'text-[#f7a247]'
      : 'text-[#68b0a6]';

  const bgColor =
    variant === 'danger'
      ? 'bg-red-500/10'
      : variant === 'warning'
      ? 'bg-[#f7a247]/10'
      : 'bg-[#68b0a6]/10';

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 flex items-start gap-4">
      <div className={`rounded-lg p-2.5 ${bgColor}`}>
        <span className={accentColor}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#9ca3af] truncate">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${accentColor}`}>{value}</p>
        {subtitle && <p className="text-xs text-[#9ca3af] mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
