import { useState, type ReactNode } from 'react'
import { useLiveEffect } from '../../hooks/useLiveEffect'
import { useStore } from '../../hooks/useStore'
import { formatDistance, formatMissionTime, formatNumber, formatSpeed, toText } from '../../sim/core/format'
import type { Verdict } from '../../sim/rocket/diagnose'
import type { Flight } from '../../sim/rocket/flight'
import { ROCKET_PARAM_SPECS } from '../../sim/rocket/params'
import { TIME_SCALES, type RocketSimulation } from '../../sim/rocket/RocketSimulation'
import type { LabView } from './labShots'
import { ParamControl } from './Beats'

const VERDICT_STYLE: Record<Verdict, { color: string; icon: ReactNode }> = {
  success: {
    color: 'text-ok',
    icon: <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  warning: {
    color: 'text-warn',
    icon: (
      <>
        <path d="M8 2 L14.5 13.5 H1.5 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.5 V9.5 M8 11.4 V11.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  failure: {
    color: 'text-fail',
    icon: <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  },
}

/** The verdict on the current flight, with its physical reason. Announced politely to screen readers. */
export function OutcomeStatus({ sim }: { sim: RocketSimulation }) {
  const diagnosis = useStore(sim.flightInfo, (f) => f.diagnosis)
  const style = VERDICT_STYLE[diagnosis.verdict]
  return (
    <div role="status" aria-live="polite" className="flex gap-3 rounded-md border border-line bg-white/[0.025] p-3">
      <svg aria-hidden viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 ${style.color}`}>
        {style.icon}
      </svg>
      <div>
        <p className="text-sm text-fg">{diagnosis.title}</p>
        <p className="mt-1 text-xs leading-snug text-muted">{diagnosis.detail}</p>
      </div>
    </div>
  )
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-xs transition-colors ${o.value === value ? 'bg-fg text-void' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const alt = (m: number) => toText(formatDistance(m))

/** Key moments of the flight: the table-view companion to the flight-profile chart. */
export function FlightEventsTable({ flight }: { flight: Flight }) {
  const e = flight.events
  const rows: Array<[string, number, string, string]> = []
  if (e.liftoff !== null) rows.push(['Liftoff', e.liftoff, '0 m', '0 m/s'])
  if (e.mach1) rows.push(['Speed of sound', e.mach1.t, alt(e.mach1.altitude), 'Mach 1'])
  if (e.maxQ) rows.push(['Max-Q', e.maxQ.t, alt(e.maxQ.altitude), `${formatNumber(e.maxQ.q / 1000, 1)} kPa`])
  if (e.guidance) rows.push(['Guidance takes over', e.guidance.t, alt(e.guidance.altitude), ''])
  if (e.throttle) rows.push(['Throttle back to 4 g', e.throttle.t, '', ''])
  if (e.karman) rows.push(['Crosses 100 km', e.karman.t, '100 km', ''])
  if (e.meco) rows.push(['Engine cutoff', e.meco.t, alt(e.meco.altitude), toText(formatSpeed(e.meco.speed))])
  if (e.apoapsis) rows.push(['Highest point', e.apoapsis.t, alt(e.apoapsis.altitude), ''])
  if (e.impact) rows.push(['Impact', e.impact.t, '0 m', toText(formatSpeed(e.impact.speed))])
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">Key events of the simulated flight</caption>
      <thead className="text-2xs text-muted">
        <tr>
          <th scope="col" className="py-1 font-normal">Event</th>
          <th scope="col" className="py-1 text-right font-normal">Time</th>
          <th scope="col" className="py-1 text-right font-normal">Altitude</th>
          <th scope="col" className="py-1 text-right font-normal">Value</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.map(([name, t, a, v]) => (
          <tr key={name} className="border-t border-line">
            <th scope="row" className="py-1 font-normal text-fg/90">{name}</th>
            <td className="py-1 text-right text-muted">{formatMissionTime(t)}</td>
            <td className="py-1 text-right text-muted">{a}</td>
            <td className="py-1 text-right text-muted">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface LabProps {
  sim: RocketSimulation
  view: LabView
  onView: (view: LabView) => void
}

export function LabControls({ sim, view, onView }: LabProps) {
  const playback = useStore(sim.playback)
  const flight = useStore(sim.flightInfo, (f) => f.flight)
  const playing = playback.driver === 'clock' && playback.playing
  // Where the mission clock sits, tracked coarsely so the button label stays right.
  const [position, setPosition] = useState<'start' | 'middle' | 'end'>('middle')
  useLiveEffect(sim.live, (s) => {
    const next = s.t <= sim.startTime + 0.5 ? 'start' : s.t >= sim.endTime - 1 ? 'end' : 'middle'
    setPosition((prev) => (prev === next ? prev : next))
  })

  return (
    <div className="space-y-4">
      <OutcomeStatus sim={sim} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (playing) sim.pause()
            else {
              if (sim.time >= sim.endTime - 1) sim.setPlayhead(sim.startTime)
              sim.play()
            }
          }}
          className="inline-flex items-center gap-2 rounded-md bg-fg px-3.5 py-1.5 text-sm text-void transition-opacity hover:opacity-90"
        >
          <svg aria-hidden viewBox="0 0 12 12" className="size-3">
            {playing ? <path d="M3 2 V10 M9 2 V10" stroke="currentColor" strokeWidth="2.2" /> : <path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" />}
          </svg>
          {playing ? 'Pause' : position === 'middle' ? 'Resume' : 'Launch'}
        </button>
        <button
          type="button"
          onClick={() => {
            sim.pause()
            sim.setPlayhead(sim.startTime)
          }}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-fg transition-colors hover:border-line-strong"
        >
          Back to T−10
        </button>
        <button type="button" onClick={() => sim.reset()} className="rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:text-fg">
          Reset values
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          Speed
          <Segmented label="Time warp" value={playback.timeScale} options={TIME_SCALES.map((s) => ({ value: s, label: `${s}×` }))} onChange={(v) => sim.setTimeScale(v)} />
        </span>
        <span className="flex items-center gap-2">
          View
          <Segmented<LabView>
            label="Camera"
            value={view}
            options={[
              { value: 'close', label: 'Close' },
              { value: 'wide', label: 'Wide' },
              { value: 'orbit', label: 'Orbit' },
            ]}
            onChange={onView}
          />
        </span>
      </div>
      <div className="space-y-3">
        {ROCKET_PARAM_SPECS.map((spec) => (
          <ParamControl key={spec.key} sim={sim} name={spec.key} compact />
        ))}
      </div>
      <details className="border-t border-line pt-3">
        <summary className="cursor-pointer text-sm text-muted hover:text-fg">Flight data table</summary>
        <div className="mt-2">
          <FlightEventsTable flight={flight} />
        </div>
      </details>
    </div>
  )
}
