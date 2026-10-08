import type { ReactNode } from 'react'

interface ChapterTitleProps {
  id: string
  number: string
  title: string
  concept: string
  children?: ReactNode
  active?: boolean
}

/** The opening of a chapter: number, title and the one idea it explains. */
export function ChapterTitle({ id, number, title, concept, children, active = true }: ChapterTitleProps) {
  return (
    <header className="page-x pointer-events-none sticky bottom-6 lg:top-[22svh] lg:bottom-auto">
      <div className={`pointer-events-auto max-w-[36rem] transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-25'}`}>
        <h2 id={id} className="wide text-[clamp(2rem,6.4vw,4.6rem)] font-[580] leading-[0.95] text-fg">
          <span className="tabular block text-[0.42em] font-[480] text-muted">{number}</span>
          <span className="mt-2 block uppercase">{title}</span>
        </h2>
        <p className="mt-5 max-w-[30rem] text-[1.08rem] leading-relaxed text-fg/85">{concept}</p>
        {children}
      </div>
    </header>
  )
}
