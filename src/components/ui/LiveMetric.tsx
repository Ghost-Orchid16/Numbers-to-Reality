import { useRef, type ReactNode } from 'react'
import { QUANTITY_BG } from '../../design/quantities'
import type { Formatted } from '../../sim/core/format'
import type { LiveChannel } from '../../sim/core/liveChannel'
import type { QuantityKind } from '../../sim/core/simulation'
import { useLiveEffect } from '../../hooks/useLiveEffect'

interface LiveMetricProps<T extends object> {
  label: ReactNode
  channel: LiveChannel<T>
  format: (value: T) => Formatted
  quantity?: QuantityKind
  /** Optional secondary reading after the value, e.g. "Mach 1.3". */
  detail?: (value: T) => string
  /** Visually emphasise (larger value). */
  primary?: boolean
}

/**
 * One telemetry reading. Value, unit and detail are written directly to the
 * DOM each frame; React renders the row once.
 */
export function LiveMetric<T extends object>({ label, channel, format, quantity, detail, primary }: LiveMetricProps<T>) {
  const valueRef = useRef<HTMLSpanElement>(null)
  const unitRef = useRef<HTMLSpanElement>(null)
  const detailRef = useRef<HTMLSpanElement>(null)
  const last = useRef({ value: '', unit: '', detail: '' })

  useLiveEffect(channel, (v) => {
    const f = format(v)
    if (f.value !== last.current.value && valueRef.current) {
      valueRef.current.textContent = f.value
      last.current.value = f.value
    }
    if (f.unit !== last.current.unit && unitRef.current) {
      unitRef.current.textContent = f.unit
      last.current.unit = f.unit
    }
    if (detail && detailRef.current) {
      const d = detail(v)
      if (d !== last.current.detail) {
        detailRef.current.textContent = d
        last.current.detail = d
      }
    }
  })

  return (
    <div className="flex items-baseline justify-between gap-3 py-[0.3rem]">
      <dt className="flex items-center gap-2 text-xs text-muted">
        {quantity && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${QUANTITY_BG[quantity]}`} />}
        {label}
      </dt>
      <dd className="tabular flex items-baseline gap-1 text-right">
        {detail && <span ref={detailRef} className="mr-1.5 text-2xs text-dim" />}
        <span ref={valueRef} className={primary ? 'text-lg leading-none text-fg' : 'text-sm text-fg'} />
        <span ref={unitRef} className="w-[2.6em] text-left text-xs text-muted" />
      </dd>
    </div>
  )
}
