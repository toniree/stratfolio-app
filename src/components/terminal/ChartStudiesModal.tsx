import { ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

export type StudyKey = 'volume' | 'sma20' | 'ema50' | 'vwap' | 'bb' | 'rsi'

export interface StudyConfig {
  smaLength: number
  emaLength: number
  bollingerLength: number
  bollingerDeviation: number
  rsiLength: number
}

export const DEFAULT_STUDY_CONFIG: StudyConfig = {
  smaLength: 20,
  emaLength: 50,
  bollingerLength: 20,
  bollingerDeviation: 2,
  rsiLength: 14,
}

interface ChartStudiesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studies: Record<StudyKey, boolean>
  onStudiesChange: (studies: Record<StudyKey, boolean>) => void
  config: StudyConfig
  onConfigChange: (config: StudyConfig) => void
}

const STUDIES: Array<{
  key: StudyKey
  name: string
  shortName: string
  color: string
  description: string
}> = [
  {
    key: 'volume',
    name: 'Volume',
    shortName: 'VOL',
    color: '#34d399',
    description: 'Confirms participation behind a move. Expanding volume can add conviction to breakouts, reversals, and event-driven option entries.',
  },
  {
    key: 'sma20',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    color: '#f5c26b',
    description: 'Smooths closing prices to expose the prevailing trend and potential dynamic support or resistance.',
  },
  {
    key: 'ema50',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    color: '#c084fc',
    description: 'Weights recent prices more heavily than an SMA, making it useful when timing shorter-duration directional trades.',
  },
  {
    key: 'vwap',
    name: 'Volume-Weighted Average Price',
    shortName: 'VWAP',
    color: '#5ba6ff',
    description: 'Shows the average traded price weighted by volume. Intraday traders use it as an execution and trend reference.',
  },
  {
    key: 'bb',
    name: 'Bollinger Bands',
    shortName: 'BB',
    color: '#7dabff',
    description: 'Wraps price in volatility-adjusted bands. Tightening can flag compression; widening can confirm expanding realized volatility.',
  },
  {
    key: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    color: '#e8a9ff',
    description: 'Measures momentum from 0–100. The 70/30 guides add context, but an extreme reading is not automatically a reversal signal.',
  },
]

export function ChartStudiesModal({
  open,
  onOpenChange,
  studies,
  onStudiesChange,
  config,
  onConfigChange,
}: ChartStudiesModalProps) {
  const toggle = (key: StudyKey) => onStudiesChange({ ...studies, [key]: !studies[key] })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="TOGGLE CHART STUDIES"
      description="Choose the technical context shown on the chart. Periods refer to chart bars, so their clock time follows the selected timeframe."
      size="wide"
      className="max-h-[min(760px,calc(100svh-2rem))]"
    >
      <div className="space-y-2">
        {STUDIES.map((study) => {
          const active = studies[study.key]
          return (
            <div
              key={study.key}
              className={cn(
                'rounded-xl border px-3.5 py-3 transition-colors',
                active ? 'border-brand-300/25 bg-brand-400/[0.07]' : 'border-line bg-white/[0.018]',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/15 text-[9px] font-extrabold tracking-[0.06em]"
                  style={{ color: study.color }}
                >
                  {study.shortName}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-bold text-ink">{study.name}</div>
                    <button
                      type="button"
                      role="switch"
                      aria-label={`Toggle ${study.name}`}
                      aria-checked={active}
                      onClick={() => toggle(study.key)}
                      className={cn(
                        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
                        active
                          ? 'border-brand-300/55 bg-brand-500/55'
                          : 'border-white/15 bg-white/[0.06]',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                          active ? 'translate-x-[17px]' : 'translate-x-[2px]',
                        )}
                      />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] leading-[1.45] text-ink-muted">{study.description}</p>
                  {study.key === 'sma20' ? (
                    <StudySelect
                      label="Period"
                      value={config.smaLength}
                      options={[10, 20, 50, 200]}
                      onChange={(smaLength) => onConfigChange({ ...config, smaLength })}
                    />
                  ) : null}
                  {study.key === 'ema50' ? (
                    <StudySelect
                      label="Period"
                      value={config.emaLength}
                      options={[9, 21, 50, 200]}
                      onChange={(emaLength) => onConfigChange({ ...config, emaLength })}
                    />
                  ) : null}
                  {study.key === 'bb' ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StudySelect
                        label="Period"
                        value={config.bollingerLength}
                        options={[10, 20, 50]}
                        onChange={(bollingerLength) => onConfigChange({ ...config, bollingerLength })}
                      />
                      <StudySelect
                        label="Std. dev."
                        value={config.bollingerDeviation}
                        options={[1.5, 2, 2.5]}
                        onChange={(bollingerDeviation) => onConfigChange({ ...config, bollingerDeviation })}
                      />
                    </div>
                  ) : null}
                  {study.key === 'rsi' ? (
                    <StudySelect
                      label="Period"
                      value={config.rsiLength}
                      options={[7, 14, 21]}
                      onChange={(rsiLength) => onConfigChange({ ...config, rsiLength })}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 px-1 text-[10px] leading-relaxed text-ink-dim">
        Studies describe the underlying price and volume—not option implied volatility—and should be used as context rather than standalone trade signals.
      </p>
    </Modal>
  )
}

function StudySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  onChange: (value: number) => void
}) {
  return (
    <label className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold text-ink-soft">
      <span>{label}</span>
      <span className="relative">
        <select
          aria-label={`${label} in chart bars`}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-7 appearance-none rounded-md border border-white/10 bg-[#111a27] py-0 pr-7 pl-2 text-[10px] font-bold text-ink outline-none transition-colors hover:border-brand-300/35 focus:border-brand-300/60"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option} {label === 'Period' ? 'bars' : '×'}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ink-muted" />
      </span>
    </label>
  )
}
