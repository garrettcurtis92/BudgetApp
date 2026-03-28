interface MetricCardProps {
  label: string
  value: string
  sublabel?: string
  valueColor?: string
}

export default function MetricCard({ label, value, sublabel, valueColor }: MetricCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p
        className="text-2xl font-semibold leading-tight"
        style={{
          fontFamily: 'var(--font-dm-serif), serif',
          color: valueColor ?? 'var(--color-text)',
        }}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {sublabel}
        </p>
      )}
    </div>
  )
}
