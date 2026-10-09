import type { ReactNode } from 'react'

interface DataPanelProps {
  /** Accessible name of the panel, e.g. "Live telemetry". */
  label: string
  /** Short status in the header, shown after a green "live" dot. */
  status?: ReactNode
  /** The headline reading at the right of the header, e.g. mission time. */
  headline?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Instrument panel for a simulation's live readings: a header with status and
 * one headline value, then groups of `LiveMetric` rows.
 */
export function DataPanel({ label, status, headline, children, className }: DataPanelProps) {
  return (
    <section aria-label={label} className={`w-full ${className ?? ''}`}>
      {(status || headline) && (
        <header className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <p className="flex items-center gap-2 text-xs text-muted">
            <span aria-hidden className="size-1.5 rounded-full bg-ok" />
            {status}
          </p>
          {headline}
        </header>
      )}
      {children}
    </section>
  )
}

/** A group of readings inside a `DataPanel`, optionally with a caption and a divider above. */
export function DataGroup({ caption, divided, children }: { caption?: ReactNode; divided?: boolean; children: ReactNode }) {
  return (
    <div className={divided ? 'mt-3 border-t border-line pt-2' : 'mt-2'}>
      {caption && <div className="text-2xs text-muted">{caption}</div>}
      <dl>{children}</dl>
    </div>
  )
}

/** A one-line strip of readings for small screens. */
export function DataStrip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <dl aria-label={label} className={`grid auto-cols-fr grid-flow-col gap-x-3 rounded-lg border border-line bg-void/80 px-3 py-2 ${className ?? ''}`}>
      {children}
    </dl>
  )
}

export function DataCell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className="tabular text-sm text-fg">{children}</dd>
    </div>
  )
}
