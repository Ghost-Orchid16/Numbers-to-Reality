import { useEffect, useState, type MouseEvent } from 'react'
import { usePrefersReducedMotion } from '../hooks/useMediaQuery'
import { LIVE_CHAPTERS } from './chapters'

/** Tracks which chapter section currently spans the reading line (45% down the viewport). */
function useCurrentChapter(): string {
  const [current, setCurrent] = useState(LIVE_CHAPTERS[0].id)
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(entry.target.getAttribute('data-chapter') ?? '')
        }
      },
      { rootMargin: '-45% 0px -54% 0px' },
    )
    const observed = new Set<Element>()
    const scan = () => {
      for (const el of document.querySelectorAll('[data-chapter]')) {
        if (!observed.has(el)) {
          observed.add(el)
          io.observe(el)
        }
      }
    }
    scan()
    // Chapters load lazily and replace their placeholders: pick up new sections.
    const mo = new MutationObserver(scan)
    mo.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: false })
    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [])
  return current
}

export function ChapterNav() {
  const current = useCurrentChapter()
  const reducedMotion = usePrefersReducedMotion()
  const [open, setOpen] = useState(false)
  const active = LIVE_CHAPTERS.find((c) => c.id === current) ?? LIVE_CHAPTERS[0]

  const go = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <>
      <a href="#rocket" className="sr-only-focusable fixed left-4 top-4 z-50 rounded bg-fg px-3 py-2 text-sm text-void">
        Skip to the first simulation
      </a>

      {/* Desktop: a quiet rail on the left edge. */}
      <nav aria-label="Chapters" className="fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 lg:block xl:left-7">
        <ol className="flex flex-col gap-3">
          {LIVE_CHAPTERS.map((chapter) => {
            const isActive = chapter.id === current
            return (
              <li key={chapter.id}>
                <a
                  href={`#${chapter.id}`}
                  onClick={go(chapter.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className="group flex items-center gap-3 py-0.5 text-xs"
                >
                  <span className={`tabular w-5 transition-colors ${isActive ? 'text-fg' : 'text-dim group-hover:text-muted'}`}>{chapter.number}</span>
                  <span aria-hidden className={`h-px transition-all duration-300 ${isActive ? 'w-5 bg-fg' : 'w-2 bg-line-strong group-hover:w-3'}`} />
                  <span
                    className={`whitespace-nowrap transition-opacity duration-200 ${isActive ? 'text-fg opacity-100' : 'text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}
                  >
                    {chapter.navLabel}
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Mobile and tablet: the current chapter, expandable to the full list. */}
      <nav aria-label="Chapters" className="fixed left-3 top-3 z-40 lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="chapter-menu"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-line bg-void/80 px-3 py-1.5 text-xs text-fg backdrop-blur-sm"
        >
          <span className="tabular text-muted">{active.number}</span>
          {active.navLabel}
          <svg aria-hidden viewBox="0 0 10 6" className={`h-1.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
        {open && (
          <ol id="chapter-menu" className="mt-2 min-w-44 rounded-lg border border-line bg-ink/95 p-1.5 backdrop-blur-sm">
            {LIVE_CHAPTERS.map((chapter) => (
              <li key={chapter.id}>
                <a
                  href={`#${chapter.id}`}
                  onClick={go(chapter.id)}
                  aria-current={chapter.id === current ? 'location' : undefined}
                  className="flex gap-3 rounded px-2.5 py-2 text-sm text-fg hover:bg-white/5"
                >
                  <span className="tabular text-muted">{chapter.number}</span>
                  {chapter.navLabel}
                </a>
              </li>
            ))}
          </ol>
        )}
      </nav>
    </>
  )
}
