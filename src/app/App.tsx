import { lazy, Suspense } from 'react'
import { BEATS } from '../chapters/rocket/timeline'
import { ChapterBoundary } from './ChapterBoundary'
import { ChapterNav } from './ChapterNav'
import { Hero } from './hero/Hero'
import { SiteFooter } from './SiteFooter'

// Each chapter (and three.js with it) loads as its own chunk, after the hero.
const RocketChapter = lazy(() => import('../chapters/rocket/RocketChapter'))

/** Holds the chapter's scroll length while its code loads, so nothing jumps. */
function ChapterPlaceholder({ id, weights }: { id: string; weights: number }) {
  return (
    <section id={id} data-chapter={id} aria-busy="true" className="relative" style={{ height: `${weights * 100}svh` }}>
      <p className="page-x sticky top-[45svh] text-sm text-muted">Preparing the simulation…</p>
    </section>
  )
}

export function App() {
  const rocketWeight = BEATS.reduce((sum, b) => sum + b.weight, 0)
  return (
    <>
      <ChapterNav />
      <main>
        <Hero />
        <ChapterBoundary id="rocket" title="Rocket launch">
          <Suspense fallback={<ChapterPlaceholder id="rocket" weights={rocketWeight} />}>
            <RocketChapter />
          </Suspense>
        </ChapterBoundary>
      </main>
      <SiteFooter />
    </>
  )
}
