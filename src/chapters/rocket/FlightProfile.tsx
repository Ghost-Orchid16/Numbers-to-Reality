import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { useLiveEffect } from '../../hooks/useLiveEffect'
import { QUANTITY_COLORS } from '../../design/quantities'
import { useStore } from '../../hooks/useStore'
import { formatMissionTime, formatNumber } from '../../sim/core/format'
import { COUNTDOWN, createFlightState, evaluateFlight, type FlightState } from '../../sim/rocket/evaluate'
import type { Flight } from '../../sim/rocket/flight'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'

interface Series {
  key: 'altitude' | 'speed' | 'g'
  title: string
  unit: string
  color: string
  digits: number
  read: (s: FlightState) => number
}

const SERIES: Series[] = [
  { key: 'altitude', title: 'Altitude', unit: 'km', color: QUANTITY_COLORS.position, digits: 0, read: (s) => s.altitude / 1000 },
  { key: 'speed', title: 'Speed', unit: 'km/s', color: QUANTITY_COLORS.velocity, digits: 2, read: (s) => s.speed / 1000 },
  { key: 'g', title: 'Felt acceleration', unit: 'g', color: QUANTITY_COLORS.acceleration, digits: 1, read: (s) => s.gLoad },
]

const SAMPLES = 240
const PLOT_H = 40
const TITLE_H = 18
const GAP = 8
const AXIS_H = 20
const PANEL_H = TITLE_H + PLOT_H + GAP
/** Inner horizontal padding so end dots and edge labels are never clipped. */
const PAD_X = 6

/** Axis tick: T+0, T+1:00, T+2:00 … */
function formatTick(t: number): string {
  if (t === 0) return 'T+0'
  const m = Math.floor(t / 60)
  const s = Math.round(t % 60)
  return `T+${m}:${s < 10 ? '0' : ''}${s}`
}

/** A clean upper bound: 1, 2 or 5 × 10ⁿ above the maximum. */
function niceMax(v: number): number {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

interface Profile {
  t0: number
  t1: number
  times: Float64Array
  values: Record<Series['key'], Float64Array>
  max: Record<Series['key'], number>
  events: Array<{ t: number; label: string }>
}

function buildProfile(flight: Flight): Profile {
  const e = flight.events
  const t0 = -COUNTDOWN
  const stop = e.meco ? e.meco.t + 25 : e.impact ? e.impact.t : flight.endTime
  const t1 = Math.max(30, Math.min(stop, flight.endTime))
  const times = new Float64Array(SAMPLES)
  const values = { altitude: new Float64Array(SAMPLES), speed: new Float64Array(SAMPLES), g: new Float64Array(SAMPLES) }
  const state = createFlightState()
  const max = { altitude: 0, speed: 0, g: 0 }
  for (let i = 0; i < SAMPLES; i++) {
    const t = t0 + ((t1 - t0) * i) / (SAMPLES - 1)
    evaluateFlight(flight, t, state)
    times[i] = t
    for (const s of SERIES) {
      const v = s.read(state)
      values[s.key][i] = v
      if (v > max[s.key]) max[s.key] = v
    }
  }
  const events: Profile['events'] = []
  if (e.liftoff !== null) events.push({ t: e.liftoff, label: 'Liftoff' })
  if (e.maxQ) events.push({ t: e.maxQ.t, label: 'Max-Q' })
  if (e.meco) events.push({ t: e.meco.t, label: 'Cutoff' })
  return {
    t0,
    t1,
    times,
    values,
    max: { altitude: niceMax(max.altitude), speed: niceMax(max.speed), g: Math.max(niceMax(max.g), 1) },
    events,
  }
}

function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

interface FlightProfileProps {
  sim: RocketSimulation
  /** In the lab, clicking or dragging the chart moves the mission clock. */
  seekable: boolean
}

/**
 * Altitude, speed and felt acceleration over the powered ascent, as three
 * small multiples sharing one time axis (never two scales on one plot).
 */
export function FlightProfile({ sim, seekable }: FlightProfileProps) {
  const flight = useStore(sim.flightInfo, (f) => f.flight)
  const profile = useMemo(() => buildProfile(flight), [flight])
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const playheadRef = useRef<SVGLineElement>(null)
  const dotRefs = useRef<Array<SVGCircleElement | null>>([])
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([])
  const beyondRef = useRef<SVGTextElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const dragging = useRef(false)

  const W = Math.max(120, width)
  const height = SERIES.length * PANEL_H + AXIS_H
  const x = (t: number) => PAD_X + ((t - profile.t0) / (profile.t1 - profile.t0)) * (W - 2 * PAD_X)
  const y = (key: Series['key'], v: number) => PLOT_H - (Math.min(v, profile.max[key]) / profile.max[key]) * PLOT_H

  const paths = useMemo(() => {
    const sx = (t: number) => PAD_X + ((t - profile.t0) / (profile.t1 - profile.t0)) * (W - 2 * PAD_X)
    const sy = (key: Series['key'], v: number) => PLOT_H - (Math.min(v, profile.max[key]) / profile.max[key]) * PLOT_H
    return SERIES.map((s) => {
      let line = ''
      for (let i = 0; i < SAMPLES; i++) {
        line += `${i === 0 ? 'M' : 'L'}${sx(profile.times[i]).toFixed(1)},${sy(s.key, profile.values[s.key][i]).toFixed(1)}`
      }
      const area = `${line}L${(W - PAD_X).toFixed(1)},${PLOT_H}L${PAD_X},${PLOT_H}Z`
      return { line, area }
    })
  }, [profile, W])

  // Playhead and current values follow the live simulation, outside React.
  useLiveEffect(sim.live, (s) => {
    const beyond = s.t > profile.t1
    const t = Math.min(Math.max(s.t, profile.t0), profile.t1)
    const px = x(t)
    playheadRef.current?.setAttribute('x1', String(px))
    playheadRef.current?.setAttribute('x2', String(px))
    if (beyondRef.current) beyondRef.current.style.display = beyond ? 'block' : 'none'
    if (seekable && svgRef.current) {
      svgRef.current.setAttribute('aria-valuenow', String(Math.round(s.t)))
      svgRef.current.setAttribute('aria-valuetext', formatMissionTime(s.t))
    }
    SERIES.forEach((series, i) => {
      const v = series.read(s)
      const dot = dotRefs.current[i]
      if (dot) {
        dot.setAttribute('cx', String(px))
        dot.setAttribute('cy', String(i * PANEL_H + TITLE_H + y(series.key, v)))
      }
      const label = valueRefs.current[i]
      if (label) label.textContent = `${formatNumber(v, series.digits)} ${series.unit}`
    })
  })

  const timeAt = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - rect.left - PAD_X) / (rect.width - 2 * PAD_X)))
    return profile.t0 + f * (profile.t1 - profile.t0)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const t = timeAt(e.clientX, e.currentTarget)
    const i = Math.round(((t - profile.t0) / (profile.t1 - profile.t0)) * (SAMPLES - 1))
    setHover(i)
    if (seekable && dragging.current) seek(t)
  }

  const seek = (t: number) => {
    sim.pause()
    sim.setPlayhead(t)
  }

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!seekable) return
    const step = e.shiftKey ? 30 : 5
    if (e.key === 'ArrowRight') seek(sim.time + step)
    else if (e.key === 'ArrowLeft') seek(sim.time - step)
    else return
    e.preventDefault()
  }

  // Event labels, skipping any that would collide with the previous one.
  const eventLabels: Array<{ t: number; label: string; px: number }> = []
  for (const ev of profile.events) {
    const px = x(ev.t)
    const prev = eventLabels[eventLabels.length - 1]
    if (!prev || px - prev.px > 44) eventLabels.push({ ...ev, px })
  }

  const ticks: number[] = []
  const tickStep = profile.t1 - profile.t0 > 400 ? 120 : 60
  for (let t = 0; t <= profile.t1; t += tickStep) ticks.push(t)

  const hovered = hover !== null ? Math.min(SAMPLES - 1, Math.max(0, hover)) : null

  return (
    <figure className="w-full" aria-label="Flight profile: altitude, speed and felt acceleration during the powered ascent">
      <figcaption className="mb-2 flex items-baseline justify-between text-2xs text-muted">
        <span>Flight profile, powered ascent</span>
        {seekable && <span>Click or drag to set the time</span>}
      </figcaption>
      <div ref={containerRef} className="relative">
        {/* Panel titles and live values (text tokens, never the series colour). */}
        {SERIES.map((s, i) => (
          <div key={s.key} className="pointer-events-none absolute left-0 right-0 flex items-baseline justify-between text-2xs" style={{ top: i * PANEL_H }}>
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.title}
            </span>
            <span ref={(el) => void (valueRefs.current[i] = el)} className="tabular text-fg" />
          </div>
        ))}
        <svg
          ref={svgRef}
          width={W}
          height={height}
          className={`block touch-pan-y select-none ${seekable ? 'cursor-ew-resize' : 'cursor-crosshair'}`}
          tabIndex={seekable ? 0 : -1}
          role={seekable ? 'slider' : undefined}
          aria-label={seekable ? 'Mission time' : undefined}
          aria-valuemin={seekable ? profile.t0 : undefined}
          aria-valuemax={seekable ? profile.t1 : undefined}
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            setHover(null)
            dragging.current = false
          }}
          onPointerDown={(e) => {
            if (!seekable) return
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            seek(timeAt(e.clientX, e.currentTarget))
          }}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={onKeyDown}
        >
          {SERIES.map((s, i) => {
            const top = i * PANEL_H + TITLE_H
            return (
              <g key={s.key} transform={`translate(0 ${top})`}>
                {/* Recessive hairline grid: baseline and maximum. */}
                <line x1={0} x2={W} y1={PLOT_H + 0.5} y2={PLOT_H + 0.5} stroke="rgb(160 180 210 / 0.22)" strokeWidth={1} />
                <line x1={0} x2={W} y1={0.5} y2={0.5} stroke="rgb(160 180 210 / 0.1)" strokeWidth={1} />
                <text x={PAD_X + 2} y={9} className="fill-dim text-[9px]">
                  {formatNumber(profile.max[s.key], s.key === 'speed' ? 1 : 0)} {s.unit}
                </text>
                <path d={paths[i].area} fill={s.color} fillOpacity={0.1} />
                <path d={paths[i].line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            )
          })}

          {/* Event markers across all panels. */}
          {profile.events.map((ev) => (
            <line key={ev.label} x1={x(ev.t)} x2={x(ev.t)} y1={TITLE_H} y2={SERIES.length * PANEL_H - GAP} stroke="rgb(160 180 210 / 0.25)" strokeWidth={1} />
          ))}

          {/* Time axis. */}
          <g transform={`translate(0 ${SERIES.length * PANEL_H})`}>
            {ticks.map((t) => (
              <text key={t} x={x(t)} y={9} textAnchor={x(t) < 30 ? 'start' : x(t) > W - 30 ? 'end' : 'middle'} className="fill-dim text-[9px]">
                {formatTick(t)}
              </text>
            ))}
            {eventLabels.map((ev) => (
              <text key={ev.label} x={ev.px} y={19} textAnchor={ev.px < 30 ? 'start' : ev.px > W - 30 ? 'end' : 'middle'} className="fill-muted text-[9px]">
                {ev.label}
              </text>
            ))}
          </g>

          {/* Crosshair (hover). */}
          {hovered !== null && (
            <line x1={x(profile.times[hovered])} x2={x(profile.times[hovered])} y1={TITLE_H} y2={SERIES.length * PANEL_H - GAP} stroke="rgb(230 236 245 / 0.35)" strokeWidth={1} />
          )}

          {/* Playhead with ringed end-dots at the live values. */}
          <line ref={playheadRef} y1={TITLE_H - 4} y2={SERIES.length * PANEL_H - GAP} stroke="rgb(230 236 245 / 0.7)" strokeWidth={1} />
          {SERIES.map((s, i) => (
            <circle key={s.key} ref={(el) => void (dotRefs.current[i] = el)} r={4} fill={s.color} stroke="#03050a" strokeWidth={2} />
          ))}
          <text ref={beyondRef} x={W - PAD_X - 6} y={SERIES.length * PANEL_H - GAP - 4} textAnchor="end" className="fill-muted text-[9px]" style={{ display: 'none' }}>
            engines off, coasting →
          </text>
        </svg>

        {/* Tooltip: every series at the hovered time. Values lead, labels follow. */}
        {hovered !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-line-strong bg-ink/95 px-2.5 py-2 text-2xs shadow-lg"
            style={{ left: Math.min(Math.max(0, x(profile.times[hovered]) + 10), W - 132), top: TITLE_H }}
          >
            <p className="tabular mb-1 text-muted">{formatMissionTime(profile.times[hovered])}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="tabular text-fg">
                  {formatNumber(profile.values[s.key][hovered], s.digits)} {s.unit}
                </span>
                <span className="text-muted">{s.title.toLowerCase()}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
