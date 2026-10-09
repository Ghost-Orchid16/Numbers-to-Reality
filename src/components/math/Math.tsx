/**
 * Small typesetting primitives for live equations.
 *
 * Variables are italic serif (the convention of printed mathematics) and take
 * the colour of the quantity they stand for, so `T` in an equation matches the
 * thrust arrow in the scene. `Live` slots a simulation value straight into an
 * equation without React re-renders.
 */
import type { ReactNode } from 'react'
import { QUANTITY_TEXT } from '../../design/quantities'
import type { LiveChannel } from '../../sim/core/liveChannel'
import type { QuantityKind } from '../../sim/core/simulation'
import { LiveText } from '../ui/LiveText'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Inline mathematics run. */
export function Eq({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('math inline-flex flex-wrap items-center gap-y-1 font-math leading-none', className)}>{children}</span>
}

interface VarProps {
  children: ReactNode
  q?: QuantityKind
  /** Upright descriptive subscript, e.g. "net" or "e". */
  sub?: ReactNode
  sup?: ReactNode
  /** Draw an arrow over the symbol to mark a vector. */
  vec?: boolean
  className?: string
}

/** A variable: italic, coloured by quantity. */
export function V({ children, q, sub, sup, vec, className }: VarProps) {
  return (
    <span className={cx('relative inline-flex items-baseline whitespace-nowrap italic', q && QUANTITY_TEXT[q], className)}>
      <span className={cx(vec && 'relative')}>
        {vec && (
          <svg aria-hidden className="absolute -top-[0.42em] left-[0.05em] h-[0.4em] w-[0.85em] overflow-visible" viewBox="0 0 20 8">
            <path d="M1 4 H17 M13 1 L18 4 L13 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {children}
      </span>
      {sub !== undefined && <span className="ml-[0.04em] translate-y-[0.3em] text-[0.68em] not-italic">{sub}</span>}
      {sup !== undefined && <span className="ml-[0.04em] -translate-y-[0.55em] text-[0.68em] not-italic">{sup}</span>}
    </span>
  )
}

/** Upright number or constant. */
export function N({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('tabular not-italic', className)}>{children}</span>
}

/** Operator with mathematical spacing. Relations (=, ≈, <) get a little more room. */
export function Op({ children, rel }: { children: ReactNode; rel?: boolean }) {
  return <span className={cx('not-italic text-muted', rel ? 'mx-[0.32em]' : 'mx-[0.2em]')}>{children}</span>
}

/** Upright function name: ln, sin, exp. */
export function Fn({ children }: { children: ReactNode }) {
  return <span className="mr-[0.12em] not-italic">{children}</span>
}

/** Superscript attached to the preceding term. */
export function Sup({ children }: { children: ReactNode }) {
  return <span className="ml-[0.04em] inline-block -translate-y-[0.55em] text-[0.68em]">{children}</span>
}

/** Stacked fraction centred on the maths axis. */
export function Frac({ num, den, className }: { num: ReactNode; den: ReactNode; className?: string }) {
  return (
    <span className={cx('mx-[0.12em] inline-flex flex-col items-center align-middle', className)}>
      <span className="inline-flex items-center px-[0.15em] pb-[0.14em]">{num}</span>
      <span aria-hidden className="h-px w-full bg-current opacity-70" />
      <span className="inline-flex items-center px-[0.15em] pt-[0.18em]">{den}</span>
    </span>
  )
}

/** Square root with a radical that stretches to its contents. */
export function Sqrt({ children }: { children: ReactNode }) {
  return (
    <span className="mx-[0.08em] inline-flex items-stretch">
      <svg aria-hidden className="w-[0.62em] shrink-0 overflow-visible" viewBox="0 0 10 20" preserveAspectRatio="none">
        <path d="M0.5 12 L3 10.5 L6 19.5 L9.6 0.6 L10 0.6" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="inline-flex items-center border-t border-current px-[0.12em] pt-[0.12em]">{children}</span>
    </span>
  )
}

/** Parentheses; `tall` stretches them around a fraction. */
export function Paren({ children, tall }: { children: ReactNode; tall?: boolean }) {
  const paren = cx('not-italic text-muted', tall && 'inline-block scale-y-[1.9] origin-center')
  return (
    <span className="inline-flex items-center">
      <span className={paren}>(</span>
      {children}
      <span className={paren}>)</span>
    </span>
  )
}

interface LiveProps<T extends object> {
  channel: LiveChannel<T>
  format: (value: T) => string
  q?: QuantityKind
  className?: string
}

/** A live simulation value set inside an equation. */
export function Live<T extends object>({ channel, format, q, className }: LiveProps<T>) {
  return <LiveText channel={channel} format={format} className={cx('tabular not-italic', q && QUANTITY_TEXT[q], className)} />
}

/** Upright unit following a value. */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-[0.18em] font-sans text-[0.72em] not-italic text-muted">{children}</span>
}
