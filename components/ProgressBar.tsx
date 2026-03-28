interface ProgressBarProps {
  pct: number
  color?: string
  height?: number
}

export default function ProgressBar({ pct, color, height = 6 }: ProgressBarProps) {
  const clampedPct = Math.min(100, Math.max(0, pct))
  const barColor = color ?? (pct >= 100 ? 'var(--color-red)' : pct >= 90 ? 'var(--color-red)' : pct >= 70 ? 'var(--color-amber)' : 'var(--color-green)')

  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, backgroundColor: 'var(--color-border)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clampedPct}%`, backgroundColor: barColor }}
      />
    </div>
  )
}
