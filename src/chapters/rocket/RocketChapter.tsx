import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NarrativeBlock } from '../../components/scroll/NarrativeBlock'
import { ScrollStage, type ScrollStep } from '../../components/scroll/ScrollStage'
import { SimulationCanvas } from '../../components/three/SimulationCanvas'
import { ChapterTitle } from '../../components/ui/ChapterTitle'
import { useIsDesktop, usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { useInViewport, useNearViewport } from '../../hooks/useViewport'
import { RocketSimulation } from '../../sim/rocket/RocketSimulation'
import { LabelRegistry } from '../../components/three/labelRegistry'
import { RocketScene, type RocketSceneControls } from '../../scenes/rocket/RocketScene'
import { VectorLabels } from '../../scenes/rocket/VectorLabels'
import { CHAPTERS } from '../../app/chapters'
import { CountdownBeat, DragBeat, LiftoffBeat, MassBeat, OrbitBeat, TurnBeat } from './Beats'
import { FlightProfile } from './FlightProfile'
import { LabControls } from './Lab'
import { LAB_SHOTS, type LabView } from './labShots'
import { ModelNotes } from './ModelNotes'
import { Telemetry } from './Telemetry'
import { BEATS, beatAt, type BeatId } from './timeline'

const META = CHAPTERS.find((c) => c.id === 'rocket')!

export default function RocketChapter() {
  const sim = useMemo(() => new RocketSimulation(), [])
  useEffect(() => () => sim.dispose(), [sim])
  const labels = useMemo(() => new LabelRegistry(), [])

  const reducedMotion = usePrefersReducedMotion()
  const isDesktop = useIsDesktop()
  const [labView, setLabView] = useState<LabView>('close')
  const [beat, setBeat] = useState<BeatId>('intro')

  const controls = useRef<RocketSceneControls>({ progress: 0, labShot: LAB_SHOTS.close, framingX: 0, framingY: 0, reducedMotion })
  useLayoutEffect(() => {
    const c = controls.current
    c.labShot = LAB_SHOTS[labView]
    c.reducedMotion = reducedMotion
    // Keep the subject clear of the narrative: right of the text column on
    // desktop, above the text panel on small screens.
    c.framingX = isDesktop ? 0.08 : 0
    c.framingY = isDesktop ? 0 : 0.17
  }, [labView, reducedMotion, isDesktop])

  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const near = useNearViewport(sectionRef)
  const visible = useInViewport(stageRef)

  const onProgress = useCallback((p: number) => {
    controls.current.progress = p
    const id = BEATS[beatAt(p).index].id
    setBeat((prev) => (prev === id ? prev : id))
  }, [])

  const steps: ScrollStep[] = useMemo(() => {
    const content: Record<BeatId, ReactNode> = {
      intro: (
        <ChapterTitle id="rocket-title" number={META.number} title={META.title} concept={META.concept} active={beat === 'intro'}>
          <p className="mt-4 text-sm text-muted">Scroll to fly it. Every number on screen comes from the equations beside it.</p>
        </ChapterTitle>
      ),
      countdown: <CountdownBeat sim={sim} active={beat === 'countdown'} />,
      liftoff: <LiftoffBeat sim={sim} active={beat === 'liftoff'} />,
      drag: <DragBeat sim={sim} active={beat === 'drag'} />,
      turn: <TurnBeat sim={sim} active={beat === 'turn'} />,
      mass: <MassBeat sim={sim} active={beat === 'mass'} />,
      orbit: <OrbitBeat sim={sim} active={beat === 'orbit'} />,
      lab: (
        <NarrativeBlock kicker="Flight lab" title="Now design your own launch." wide active={beat === 'lab'}>
          <p>Every control below changes an input to the same equations. The whole flight is re-solved the moment you let go.</p>
          <LabControls sim={sim} view={labView} onView={setLabView} />
        </NarrativeBlock>
      ),
    }
    return BEATS.map((b) => ({ id: b.id, weight: b.weight, content: content[b.id] }))
  }, [sim, labView, beat])

  const inLab = beat === 'lab'

  const stage = (
    <>
      <div className="absolute inset-0">
        {near && (
          <SimulationCanvas
            active={visible}
            label="Simulation of the rocket launch: the rocket, its exhaust, force arrows, the computed trajectory and the predicted orbit around the Earth."
            className="h-full w-full"
            logarithmicDepth
            fov={35}
            near={0.5}
            far={1e10}
          >
            <RocketScene sim={sim} controls={controls} labels={labels} />
          </SimulationCanvas>
        )}
        <VectorLabels sim={sim} labels={labels} />
      </div>
      {/* Legibility scrims behind the narrative: left column on desktop, bottom on mobile. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[50%] bg-gradient-to-r from-void/90 via-void/55 to-transparent lg:block" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-void/85 to-transparent lg:hidden" />

      {/* Instrument column. */}
      <aside className="absolute right-4 top-16 hidden w-[17.5rem] space-y-5 rounded-lg border border-line bg-void/80 p-4 lg:block xl:right-6 xl:w-[19rem]">
        <Telemetry sim={sim} />
        <FlightProfile sim={sim} seekable={inLab} />
      </aside>
      <div className="absolute left-3 right-3 top-14 lg:hidden">
        <Telemetry sim={sim} compact />
      </div>
    </>
  )

  return (
    <section ref={sectionRef} id="rocket" data-chapter="rocket" aria-labelledby="rocket-title" className="relative">
      <ScrollStage stage={stage} steps={steps} onProgress={onProgress} stageRef={stageRef} />
      <ModelNotes />
    </section>
  )
}
