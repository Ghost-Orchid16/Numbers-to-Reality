import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

interface TermProps {
  /** The term as it appears in the text. */
  children: ReactNode
  /** A plain-language definition, one or two sentences. */
  definition: ReactNode
}

const VIEWPORT_MARGIN = 12

/**
 * A technical term whose definition is one hover, focus or tap away. The
 * definition is also the button's accessible description, so screen readers
 * announce it without opening anything. It stays open while hovered, and
 * Escape or a tap elsewhere closes it (WCAG 1.4.13).
 */
export function Term({ children, definition }: TermProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Shift the card sideways so it never leaves the viewport.
  useLayoutEffect(() => {
    const el = tipRef.current
    if (!open || !el) return
    el.style.translate = '0px'
    const rect = el.getBoundingClientRect()
    let dx = 0
    if (rect.right > window.innerWidth - VIEWPORT_MARGIN) dx = window.innerWidth - VIEWPORT_MARGIN - rect.right
    if (rect.left + dx < VIEWPORT_MARGIN) dx = VIEWPORT_MARGIN - rect.left
    el.style.translate = `${dx}px`
  }, [open])

  // Hover opens it for mouse users only; on touch the tap (click) does.
  const hover = (next: boolean) => (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') setOpen(next)
  }

  return (
    <span ref={wrapRef} className="relative inline-block" onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="cursor-help underline decoration-current/40 decoration-dotted decoration-1 underline-offset-[0.18em] hover:decoration-current"
      >
        {children}
      </button>
      {/* Padding, not margin, bridges the gap so the pointer can move onto the card. */}
      <span ref={tipRef} id={id} role="tooltip" className={`absolute left-0 top-full z-30 pt-1.5 ${open ? 'block' : 'hidden'}`}>
        <span className="block w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-line-strong bg-ink px-3 py-2 text-left font-sans text-xs font-normal leading-snug tracking-normal [font-stretch:100%] [font-variation-settings:normal] text-fg/90 shadow-lg shadow-black/40">
          {definition}
        </span>
      </span>
    </span>
  )
}
