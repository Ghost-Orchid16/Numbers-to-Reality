import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap'

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
  const rootRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const exitFadeRef = useRef<HTMLDivElement>(null)
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
      // As the stage un-pins and scrolls away, fade its bottom edge into the page.
      const exitFade = gsap.fromTo(
        exitFadeRef.current,
        { opacity: 0 },
        { opacity: 1, ease: 'none', scrollTrigger: { trigger: rootRef.current, start: 'bottom bottom', end: 'bottom 60%', scrub: true } },
      )
      return () => {
        trigger.kill()
        exitFade.scrollTrigger?.kill()
        exitFade.kill()
      }
    },
    { scope: rootRef },
  )

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <div ref={stageRef} className="sticky top-0 h-[100svh] overflow-hidden">
        {stage}
        <div ref={exitFadeRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-void to-transparent opacity-0" />
      </div>
      {/* Blends the stage's top edge into the page as it scrolls in; it scrolls away before the stage pins. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[35svh] bg-gradient-to-b from-void to-transparent" />
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
