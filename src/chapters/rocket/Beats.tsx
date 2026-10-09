import type { ReactNode } from 'react'
import { EquationBlock } from '../../components/math/EquationBlock'
import { Eq, Fn, Frac, Live, N, Op, Paren, Sqrt, Unit, V } from '../../components/math/Math'
import { NarrativeBlock } from '../../components/scroll/NarrativeBlock'
import { Term } from '../../components/ui/Term'
import { ToggleControl, VariableControl } from '../../components/ui/VariableControl'
import { useStore } from '../../hooks/useStore'
import { formatDuration, formatMissionTime, formatNumber, formatScientific } from '../../sim/core/format'
import type { BooleanParamSpec, NumberParamSpec } from '../../sim/core/simulation'
import type { FlightState } from '../../sim/rocket/evaluate'
import { circularSpeed } from '../../sim/rocket/orbit'
import { ROCKET_PARAM_SPECS, type RocketParams } from '../../sim/rocket/params'
import type { RocketSimulation } from '../../sim/rocket/RocketSimulation'
import { PLANET_RADIUS, referenceArea, VEHICLE } from '../../sim/rocket/vehicle'
import { fmt } from './liveFormat'

const spec = (key: keyof RocketParams) => ROCKET_PARAM_SPECS.find((s) => s.key === key)!

const MAX_Q_DEFINITION = 'Maximum dynamic pressure: the moment in the climb when the oncoming air presses hardest on the rocket, q = ½ρv². Speed is still rising but the air is already thinning.'

/** An inline control for one model variable, bound to the simulation. */
export function ParamControl({ sim, name, aside, compact }: { sim: RocketSimulation; name: keyof RocketParams; aside?: ReactNode; compact?: boolean }) {
  const value = useStore(sim.params, (p) => p[name])
  const s = spec(name)
  if (s.kind === 'boolean') {
    return <ToggleControl spec={s as BooleanParamSpec} value={value as boolean} onChange={(v) => sim.setParam(name, v as never)} showDescription={!compact} />
  }
  return <VariableControl spec={s as NumberParamSpec} value={value as number} onChange={(v) => sim.setParam(name, v as never)} aside={aside} showDescription={!compact} />
}

function TryIt({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-white/[0.025] p-3">
      <p className="mb-2 text-2xs text-muted">Change a variable</p>
      {children}
    </div>
  )
}

function Watch({ children }: { children: ReactNode }) {
  return <p className="detail text-sm leading-snug text-muted">{children}</p>
}

/** Thrust-to-weight on the pad, shown next to the thrust slider. */
function ThrustToWeight({ sim }: { sim: RocketSimulation }) {
  const tw = useStore(sim.flightInfo, (f) => f.flight.summary.thrustToWeight)
  return (
    <span className={tw < 1 ? 'text-fail' : ''}>
      T/W {formatNumber(tw, 2)}
    </span>
  )
}

interface BeatProps {
  sim: RocketSimulation
  active?: boolean
}

export function CountdownBeat({ sim, active }: BeatProps) {
  const ch = sim.live
  return (
    <NarrativeBlock
      active={active}
      kicker="Countdown"
      title="Nothing moves until a force wins."
      realWorld="Real rockets also stay clamped to the pad for a few seconds after ignition, until computers confirm every engine is healthy."
    >
      <p className="detail">Fuelled and waiting, the rocket’s weight pulls it down. The pad pushes back with exactly the same force, so the net force — and the acceleration — is zero.</p>
      <EquationBlock
        label="Forces on the pad"
        substitution={
          <Eq>
            <V q="neutral">N</V>
            <Op rel>=</Op>
            <V q="mass">m</V>
            <V q="gravity">g</V>
            <Op rel>=</Op>
            <Live channel={ch} format={fmt.mass} q="mass" />
            <Op>×</Op>
            <Live channel={ch} format={fmt.gravity} q="gravity" />
            <Op rel>=</Op>
            <Live channel={ch} format={fmt.pad} />
          </Eq>
        }
      >
        <Eq>
          <V sub="net">F</V>
          <Op rel>=</Op>
          <V q="neutral">N</V>
          <Op>−</Op>
          <V q="mass">m</V>
          <V q="gravity">g</V>
          <Op rel>=</Op>
          <N>0</N>
        </Eq>
      </EquationBlock>
      <Watch>The violet arrow is the weight; the grey arrow is the pad pushing back. Same length, opposite directions.</Watch>
    </NarrativeBlock>
  )
}

/** a = (T − mg − D)/m evaluated from the live state, along the flight direction. */
const formulaAccel = (s: FlightState) => {
  if (s.onPad && s.thrust < s.weight) return '0.0 m/s² (held by the pad)'
  const a = (s.thrust - s.weight - s.drag) / s.mass
  return `${formatNumber(a, 1)} m/s²`
}

export function LiftoffBeat({ sim, active }: BeatProps) {
  const ch = sim.live
  return (
    <NarrativeBlock
      active={active}
      kicker="Ignition and liftoff"
      title="Thrust has to beat weight."
      realWorld="Liftoff thrust-to-weight ratios of real launchers sit around 1.2–1.5. More thrust wastes less time fighting gravity, but costs heavier engines and harsher loads."
    >
      <p className="detail">The engines push up with thrust T. Only what is left after cancelling the weight accelerates the rocket — Newton’s second law.</p>
      <EquationBlock
        label="Newton’s second law, along the flight path"
        substitution={
          <Eq>
            <V q="acceleration">a</V>
            <Op rel>=</Op>
            <Frac
              num={
                <>
                  <Live channel={ch} format={fmt.thrust} q="force" />
                  <Op>−</Op>
                  <Live channel={ch} format={fmt.weight} q="gravity" />
                  <Op>−</Op>
                  <Live channel={ch} format={fmt.drag} q="drag" />
                </>
              }
              den={<Live channel={ch} format={fmt.mass} q="mass" />}
            />
            <Op rel>=</Op>
            <Live channel={ch} format={formulaAccel} q="acceleration" />
          </Eq>
        }
      >
        <Eq>
          <V q="acceleration">a</V>
          <Op rel>=</Op>
          <Frac
            num={
              <>
                <V q="force">T</V>
                <Op>−</Op>
                <V q="mass">m</V>
                <V q="gravity">g</V>
                <Op>−</Op>
                <V q="drag">D</V>
              </>
            }
            den={<V q="mass">m</V>}
          />
        </Eq>
      </EquationBlock>
      <TryIt>
        <ParamControl sim={sim} name="thrust" aside={<ThrustToWeight sim={sim} />} />
      </TryIt>
      <Watch>Drop the thrust below the weight and the rocket waits on the pad, burning propellant until it is light enough to rise.</Watch>
    </NarrativeBlock>
  )
}

function DragNumbers({ sim }: BeatProps) {
  const maxQ = useStore(sim.flightInfo, (f) => f.flight.events.maxQ)
  const thrust = useStore(sim.params, (p) => p.thrust)
  if (!maxQ) return <Watch>With the atmosphere switched off there is no drag at all — and no Max-Q.</Watch>
  const dragAtMaxQ = maxQ.q * VEHICLE.dragCoefficient * referenceArea(VEHICLE)
  return (
    <Watch>
      This flight’s Max-Q: {formatNumber(maxQ.q / 1000, 1)} kPa at {formatNumber(maxQ.altitude / 1000, 1)} km, {formatMissionTime(maxQ.t)}. Even then drag is only{' '}
      {formatNumber((dragAtMaxQ / thrust) * 100, 1)}% of thrust — the rose arrow is short — but it sets the structural load.
    </Watch>
  )
}

const density = (s: FlightState) => (s.density > 0 ? `${formatScientific(s.density, 2)} kg/m³` : '0 (no air)')

export function DragBeat({ sim, active }: BeatProps) {
  const ch = sim.live
  const area = referenceArea(VEHICLE)
  return (
    <NarrativeBlock
      active={active}
      kicker="Through the atmosphere"
      title={
        <>
          The air pushes back hardest at <Term definition={MAX_Q_DEFINITION}>Max-Q</Term>.
        </>
      }
      realWorld="A real drag coefficient changes sharply near the speed of sound, and rockets throttle down through Max-Q to keep the structure within its limits."
    >
      <p className="detail">
        Drag grows with the square of speed, but the air thins as the rocket climbs. Their product, the dynamic pressure <i className="font-math">q</i>, peaks about a minute in:
        Max-Q.
      </p>
      <EquationBlock
        label="Aerodynamic drag"
        substitution={
          <Eq>
            <V q="drag">D</V>
            <Op rel>=</Op>
            <N>½</N>
            <Op>×</Op>
            <Live channel={ch} format={density} />
            <Op>×</Op>
            <Paren>
              <Live channel={ch} format={fmt.speed} q="velocity" />
            </Paren>
            <N>²</N>
            <Op>×</Op>
            <N>{VEHICLE.dragCoefficient.toFixed(2)}</N>
            <Op>×</Op>
            <N>
              {formatNumber(area, 1)}
              <Unit>m²</Unit>
            </N>
            <Op rel>=</Op>
            <Live channel={ch} format={fmt.drag} q="drag" />
          </Eq>
        }
        caption={
          <>
            Air density falls off exponentially with height, <span className="font-math italic">ρ = ρ₀e</span>
            <sup className="font-math italic">−(h−h₀)/H</sup>: here <Live channel={ch} format={density} className="text-fg" /> at{' '}
            <Live channel={ch} format={fmt.altitude} className="text-fg" />. <span className="font-math italic">C</span>
            <sub>D</sub> is the drag coefficient, <span className="font-math italic">A</span> the 3.7 m body’s cross-section.
          </>
        }
      >
        <Eq>
          <V q="drag">D</V>
          <Op rel>=</Op>
          <N>½</N>
          <V>ρ</V>
          <V q="velocity">v</V>
          <N>²</N>
          <V sub="D">C</V>
          <V>A</V>
        </Eq>
      </EquationBlock>
      <TryIt>
        <ParamControl sim={sim} name="drag" />
      </TryIt>
      <DragNumbers sim={sim} />
    </NarrativeBlock>
  )
}

export function TurnBeat({ sim, active }: BeatProps) {
  const ch = sim.live
  const mu = useStore(sim.flightInfo, (f) => f.flight.summary.mu)
  const vCirc = circularSpeed(mu, PLANET_RADIUS + VEHICLE.targetAltitude)
  return (
    <NarrativeBlock
      active={active}
      kicker="Gravity turn and guidance"
      title="Orbit is about going sideways, fast."
      realWorld="Real guidance (Powered Explicit Guidance on the Space Shuttle, for example) also targets the orbital plane and timing, re-solving its steering about once a second."
    >
      <p className="detail">
        After a small tilt, gravity bends the path over. Above the thick air the flight computer takes over: every 0.2 s it solves for the steering that ends the burn with zero
        vertical speed at {formatNumber(VEHICLE.targetAltitude / 1000, 0)} km.
      </p>
      <EquationBlock
        label="Speed needed for a circular orbit"
        substitution={
          <Eq>
            <V q="velocity" sub="h">v</V>
            <Op rel>=</Op>
            <Live channel={ch} format={fmt.horizontal} q="velocity" />
            <span className="ml-2 font-sans text-xs text-muted not-italic">of {formatNumber(vCirc / 1000, 2)} km/s needed sideways</span>
          </Eq>
        }
      >
        <Eq>
          <V q="velocity" sub="circ">v</V>
          <Op rel>=</Op>
          <Sqrt>
            <Frac num={<><V>G</V><V>M</V></>} den={<V q="position">r</V>} />
          </Sqrt>
          <Op rel>=</Op>
          <N>
            {formatNumber(vCirc / 1000, 2)}
            <Unit>km/s</Unit>
          </N>
        </Eq>
      </EquationBlock>
      <EquationBlock
        label="What the guidance computer solves"
        caption={
          <>
            Over the burn time left, <i className="font-math">τ</i>, choose the vertical acceleration that brings the vertical speed <i className="font-math">v</i>
            <sub>r</sub> to zero exactly at the target height <i className="font-math">h</i>
            <sub>T</sub> — worked out from <i className="font-math">s = ut + ½at²</i>.
          </>
        }
      >
        <Eq>
          <V q="acceleration" sub="r">a</V>
          <Op rel>=</Op>
          <Frac num={<><N>6</N><Paren><V sub="T">h</V><Op>−</Op><V q="position">h</V></Paren></>} den={<><V>τ</V><N>²</N></>} />
          <Op>−</Op>
          <Frac num={<><N>4</N><V q="velocity" sub="r">v</V></>} den={<V>τ</V>} />
        </Eq>
      </EquationBlock>
      <TryIt>
        <ParamControl sim={sim} name="pitchKick" />
      </TryIt>
      <Watch>The blue curve is the orbit the rocket would follow if the engines stopped now. For now it plunges through the planet — the dashed part is underground.</Watch>
    </NarrativeBlock>
  )
}

function RocketEquation({ sim }: BeatProps) {
  const summary = useStore(sim.flightInfo, (f) => f.flight.summary)
  const dry = useStore(sim.params, (p) => p.dryMass)
  const ve = VEHICLE.exhaustVelocity
  return (
    <EquationBlock
      label="The rocket equation"
      substitution={
        <Eq>
          <V q="velocity">Δv</V>
          <Op rel>=</Op>
          <N>
            {formatNumber(ve / 1000, 2)}
            <Unit>km/s</Unit>
          </N>
          <Op>×</Op>
          <Fn>ln</Fn>
          <Paren tall>
            <Frac num={<N>{formatNumber(summary.initialMass / 1000, 0)} t</N>} den={<N>{formatNumber(dry / 1000, 0)} t</N>} />
          </Paren>
          <Op rel>=</Op>
          <N>
            {formatNumber(summary.idealDeltaV / 1000, 2)}
            <Unit>km/s</Unit>
          </N>
        </Eq>
      }
      caption="The best possible speed change, before gravity and drag take their share. The logarithm is why extra propellant buys less and less."
    >
      <Eq>
        <V q="velocity">Δv</V>
        <Op rel>=</Op>
        <V sub="e">v</V>
        <Fn>ln</Fn>
        <Paren tall>
          <Frac num={<V q="mass" sub="0">m</V>} den={<V q="mass" sub="f">m</V>} />
        </Paren>
      </Eq>
    </EquationBlock>
  )
}

export function MassBeat({ sim, active }: BeatProps) {
  const ch = sim.live
  return (
    <NarrativeBlock
      active={active}
      kicker="Getting lighter"
      title="Same engines, less mass, more acceleration."
      realWorld="Real orbital rockets drop empty stages so they stop carrying dead weight. A single-stage rocket like this one is near the edge of what can be built."
    >
      <p className="detail">
        The engines throw away propellant every second, so the same thrust pushes less and less mass. Acceleration climbs until the computer throttles back to hold 4 g.
      </p>
      <EquationBlock
        label="Mass flow and acceleration"
        substitution={
          <span className="flex flex-col gap-1.5">
            <Eq>
              <V q="mass">ṁ</V>
              <Op rel>=</Op>
              <Live channel={ch} format={fmt.thrust} q="force" />
              <Op>/</Op>
              <N>
                {formatNumber(VEHICLE.exhaustVelocity / 1000, 2)}
                <Unit>km/s</Unit>
              </N>
              <Op rel>=</Op>
              <Live channel={ch} format={(s) => (s.thrust > 0 ? `${formatNumber(s.thrust / VEHICLE.exhaustVelocity / 1000, 2)} t/s` : '0 t/s')} q="mass" />
            </Eq>
            <Eq>
              <V q="force">T</V>
              <Op>/</Op>
              <V q="mass">m</V>
              <Op rel>=</Op>
              <Live channel={ch} format={fmt.thrust} q="force" />
              <Op>/</Op>
              <Live channel={ch} format={fmt.mass} q="mass" />
              <Op rel>=</Op>
              <Live channel={ch} format={(s) => (s.thrust > 0 ? `${formatNumber(s.thrust / s.mass / 9.80665, 2)} g` : '0 g')} q="acceleration" />
            </Eq>
          </span>
        }
      >
        <Eq>
          <V q="mass">ṁ</V>
          <Op rel>=</Op>
          <Frac num={<V q="force">T</V>} den={<V sub="e">v</V>} />
          <span className="mx-4" />
          <V q="acceleration">a</V>
          <Op rel>≈</Op>
          <Frac num={<V q="force">T</V>} den={<V q="mass">m</V>} />
        </Eq>
      </EquationBlock>
      <RocketEquation sim={sim} />
      <TryIt>
        <ParamControl sim={sim} name="dryMass" />
      </TryIt>
    </NarrativeBlock>
  )
}

function OrbitNumbers({ sim }: BeatProps) {
  const info = useStore(sim.flightInfo, (f) => f)
  const { outcome } = info.flight
  if (outcome.kind !== 'orbit' || !outcome.elements) {
    return <p className="text-sm text-warn">{info.diagnosis.detail}</p>
  }
  return (
    <Watch>
      This orbit: perigee {formatNumber(outcome.periapsisAltitude / 1000, 0)} km, apogee {formatNumber(outcome.apoapsisAltitude / 1000, 0)} km, one lap every{' '}
      {formatDuration(outcome.elements.period)}.
    </Watch>
  )
}

export function OrbitBeat({ sim, active }: BeatProps) {
  const ch = sim.live
  return (
    <NarrativeBlock
      active={active}
      kicker="Engine cutoff"
      title="Engines off. Still falling — but missing the planet."
      realWorld="Real low orbits slowly decay in the thin upper atmosphere, and the Earth’s bulge and the Moon’s pull keep reshaping them. Satellites carry thrusters to correct."
    >
      <p className="detail">Only gravity acts now. The rocket moves sideways so fast that the ground curves away as quickly as it falls. That is an orbit — Newton’s cannonball, made real.</p>
      <EquationBlock
        label="Specific orbital energy"
        substitution={
          <Eq>
            <V>ε</V>
            <Op rel>=</Op>
            <Live channel={ch} format={(s) => `${formatNumber(s.orbit.energy / 1e6, 1)} MJ/kg`} />
            <span className="ml-2 font-sans text-xs text-muted not-italic">
              <Live channel={ch} format={(s) => (s.orbit.energy < 0 ? 'negative: bound to the planet' : 'positive: escaping')} />
            </span>
          </Eq>
        }
      >
        <Eq>
          <V>ε</V>
          <Op rel>=</Op>
          <Frac num={<><V q="velocity">v</V><N>²</N></>} den={<N>2</N>} />
          <Op>−</Op>
          <Frac num={<><V>G</V><V>M</V></>} den={<V q="position">r</V>} />
        </Eq>
      </EquationBlock>
      <OrbitNumbers sim={sim} />
    </NarrativeBlock>
  )
}
