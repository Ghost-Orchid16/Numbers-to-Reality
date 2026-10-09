import { useRef, useState, type CSSProperties } from 'react'
import { Eq, Frac, N, Op, Sqrt, V } from '../../components/math/Math'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { gsap, useGSAP } from '../../lib/gsap'
import { CannonballCanvas } from './CannonballCanvas'
import { LAUNCH_RADIUS, toScreen, type DiagramLayout } from './diagram'

/** The arrow in the title, drawn as a vector — the same mark the simulations use for forces. */
function TitleArrow() {
  return (
    <svg aria-hidden viewBox="0 0 120 40" className="title-arrow mx-[0.12em] inline-block h-[0.62em] w-[1.5em] -translate-y-[0.06em] overflow-visible align-middle">
      <path d="M2 20 H108" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M92 6 L114 20 L92 34" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const diagramRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [layout, setLayout] = useState<DiagramLayout | null>(null)

  // Leaving the hero: zoom the diagram into Newton's mountain top — where the
  // next chapter's launch pad sits — while the title lifts away.
  useGSAP(
    () => {
      if (reducedMotion || !layout) return
      const [ox, oy] = toScreen(layout, 0, LAUNCH_RADIUS)
      gsap.set(diagramRef.current, { transformOrigin: `${ox}px ${oy}px` })
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: 0.4 },
      })
      tl.to(diagramRef.current, { scale: 7, opacity: 0, ease: 'power2.in' }, 0)
      tl.to('.hero-copy', { yPercent: -18, opacity: 0, ease: 'none' }, 0)
    },
    { scope: sectionRef, dependencies: [reducedMotion, layout?.width, layout?.height] },
  )

  const eqStyle = (x: number, y: number): CSSProperties | undefined => {
    if (!layout) return undefined
    const [sx, sy] = toScreen(layout, x, y)
    return { left: sx, top: sy }
  }

  return (
    <section ref={sectionRef} id="intro" data-chapter="intro" aria-labelledby="hero-title" className="relative h-[100svh] min-h-[620px] overflow-hidden">
      <div ref={diagramRef} className="absolute inset-0">
        <CannonballCanvas reducedMotion={reducedMotion} onLayout={setLayout} className="absolute inset-0 h-full w-full" />
        {layout && (
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden text-muted/80 sm:block">
            <span className="absolute -translate-x-1/2 text-[0.95rem]" style={eqStyle(0, -2.95)}>
              <Eq>
                <V>r</V>
                <Op rel>=</Op>
                <Frac num={<V>p</V>} den={<><N>1</N><Op>+</Op><V>e</V><span className="mx-[0.15em] not-italic">cos</span><V>θ</V></>} />
              </Eq>
            </span>
            <span className="absolute -translate-x-full -translate-y-1/2 text-[0.95rem]" style={eqStyle(-1.7, 0)}>
              <Eq>
                <V q="velocity">v</V>
                <Op rel>=</Op>
                <Sqrt>
                  <Frac num={<><V>G</V><V>M</V></>} den={<V>r</V>} />
                </Sqrt>
              </Eq>
            </span>
          </div>
        )}
      </div>

      <div className="hero-copy page-x relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-between pb-8 pt-20 lg:pb-14 lg:pt-28">
        <div>
          <h1 id="hero-title" className="wide text-[clamp(2.6rem,9.5vw,6.5rem)] font-[580] leading-[0.92] tracking-[-0.01em] text-fg">
            <span className="block">NUMBERS</span>
            <span className="block whitespace-nowrap">
              <span className="text-q-force">
                <TitleArrow />
              </span>
              REALITY
            </span>
          </h1>
          <p className="mt-6 text-[clamp(1.1rem,2.2vw,1.45rem)] font-[420] text-fg/90">Where mathematics becomes reality.</p>
          <p className="mt-10 hidden max-w-[30rem] text-[1.0625rem] leading-relaxed text-muted lg:block">
            Every rocket launch, satellite position, racing car, intelligent machine and medical image depends on mathematics you rarely get to see.
          </p>
        </div>

        <div className="max-w-[34rem]">
          <p className="text-[1.0625rem] leading-relaxed text-muted lg:hidden">
            Every rocket launch, satellite position, racing car, intelligent machine and medical image depends on mathematics you rarely get to see.
          </p>
          <p className="mt-6 flex items-center gap-3 text-sm text-fg/80 lg:mt-0">
            <span aria-hidden className="scroll-cue relative block h-8 w-px overflow-hidden bg-line-strong" />
            Scroll to see the mathematics move.
          </p>
        </div>
      </div>

      <p className="absolute bottom-8 right-5 z-10 hidden max-w-[17rem] text-right text-xs leading-snug text-dim sm:block lg:bottom-14 lg:right-16">
        Newton’s cannonball, from the <i>Principia</i> (1687), mountain exaggerated as in his drawing. Each path is a conic, timed with Kepler’s equation.
      </p>
    </section>
  )
}
