import type { ReactNode } from 'react'

interface EquationBlockProps {
  /** What the equation is, in words: "Newton's second law". */
  label?: string
  /** The equation in symbols. */
  children: ReactNode
  /** The same equation with today's numbers substituted. */
  substitution?: ReactNode
  /** One line on what the symbols mean or why the equation matters. */
  caption?: ReactNode
  className?: string
}

/**
 * Display equation: the symbolic form, then the same relation with live
 * numbers from the simulation substituted in, then a short explanation.
 */
export function EquationBlock({ label, children, substitution, caption, className }: EquationBlockProps) {
  return (
    <figure className={`border-l border-line-strong py-1 pl-4 ${className ?? ''}`}>
      {label && <figcaption className="mb-1.5 text-xs text-muted">{label}</figcaption>}
      <div className="text-[1.3rem] text-fg sm:text-[1.4rem]">{children}</div>
      {substitution && <div className="mt-2 text-[1rem] text-fg/90 sm:text-[1.05rem]">{substitution}</div>}
      {caption && <p className="mt-2 max-w-[46ch] text-[0.8rem] leading-snug text-muted">{caption}</p>}
    </figure>
  )
}
