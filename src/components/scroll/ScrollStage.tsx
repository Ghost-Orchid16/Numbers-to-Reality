import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { ScrollTrigger, useGSAP } from '../../lib/gsap'

export interface ScrollStep {
  id: string
  /** Relative scroll length; a weight of 1 is one viewport height. */
  weight: number
  content: ReactNode
}

interface ScrollStageProps {
  /** The sticky visual layer (simulation canvas and its overlays). */
  stage: ReactNode
  steps: readonly ScrollStep[]
  /** Called on every scroll update with overall progress 0–1. */
  onProgress: (progress: number) => void
  stageRef?: RefObject<HTMLDivElement | null>
  className?: string
}

/**
 * Scroll-driven narrative: a full-viewport stage stays pinned (CSS sticky)
 * while narrative steps scroll over it. Steps stay in normal document flow, so
 * they remain readable, selectable and reachable by keyboard and screen
 * readers; ScrollTrigger only measures progress.
 */
export function ScrollStage({ stage, steps, onProgress, stageRef, className }: ScrollStageProps) {
  const stepsRef = useRef<HTMLDivElement>(null)
  const onProgressRef = useRef(onProgress)
  useLayoutEffect(() => {
    onProgressRef.current = onProgress
  })

  useGSAP(
    () => {
      const trigger = ScrollTrigger.create({
        trigger: stepsRef.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => onProgressRef.current(self.progress),
        onRefresh: (self) => onProgressRef.current(self.progress),
      })
      return () => trigger.kill()
    },
    { scope: stepsRef },
  )

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={stageRef} className="sticky top-0 h-[100svh] overflow-hidden">
        {stage}
      </div>
      <div ref={stepsRef} className="pointer-events-none relative -mt-[100svh]">
        {steps.map((step) => (
          <div key={step.id} data-step={step.id} className="relative flex flex-col justify-end lg:justify-start" style={{ height: `${step.weight * 100}svh` }}>
            {step.content}
          </div>
        ))}
      </div>
    </div>
  )
}
