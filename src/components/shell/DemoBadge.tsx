import { Radio } from 'lucide-react'

export function DemoBadge() {
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-line bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-bold tracking-[0.04em] text-ink-soft lg:inline-flex"
      title="All prices, positions and AI output in this build are simulated."
    >
      <Radio size={11} className="text-brand-300" />
      <span className="uppercase">Demo</span>
      <span className="hidden text-ink-muted xl:inline">· Simulated</span>
    </span>
  )
}
