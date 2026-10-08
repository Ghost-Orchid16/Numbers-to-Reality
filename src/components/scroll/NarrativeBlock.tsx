import type { ReactNode } from 'react'

interface NarrativeBlockProps {
  /** Short context line: when or where in the story this is. */
  kicker: ReactNode
  title: string
  children: ReactNode
  /** Level 3: how the real system is more complicated. */
  realWorld?: ReactNode
  /** Wider block for control-heavy steps. */
  wide?: boolean
  /** The block currently being read; others recede so one story beat leads. */
  active?: boolean
}

/**
 * One step of a scroll narrative. Sticks in place while its stretch of scroll
 * scrubs the simulation, then gives way to the next. Pointer events are
 * re-enabled here so inline controls work over the stage.
 */
export function NarrativeBlock({ kicker, title, children, realWorld, wide, active = true }: NarrativeBlockProps) {
  return (
    // Mobile: pinned to the bottom of the screen over a solid backing.
    // Desktop: pinned near the top of the left column, over the stage's scrim.
    <article className="page-x pointer-events-none sticky bottom-3 lg:top-[13svh] lg:bottom-auto">
      <div
        className={`pointer-events-auto w-full rounded-lg border border-line bg-void/90 p-4 transition-opacity duration-500 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 ${wide ? 'lg:max-w-[27rem]' : 'lg:max-w-[25rem]'} ${active ? 'opacity-100' : 'opacity-25'}`}
      >
        <p className="tabular text-xs text-muted">{kicker}</p>
        <h3 className="semi-wide mt-1.5 text-[1.35rem] font-[560] leading-[1.15] text-fg sm:text-[1.55rem]">{title}</h3>
        <div className="narrative-body mt-3 space-y-3.5 text-[0.95rem] leading-relaxed text-fg/85">{children}</div>
        {realWorld && (
          <details className="group mt-4 border-t border-line pt-2.5 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-muted transition-colors hover:text-fg">
              <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 transition-transform group-open:rotate-90">
                <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              In the real world
            </summary>
            <div className="mt-2 leading-relaxed text-muted">{realWorld}</div>
          </details>
        )}
      </div>
    </article>
  )
}
