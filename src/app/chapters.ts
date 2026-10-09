/**
 * The museum's chapters, in story order. A chapter appears in the navigation
 * only once it is `live`: unbuilt chapters are never shown as placeholders.
 */
export interface ChapterMeta {
  /** DOM id of the chapter's section, used for anchors and navigation. */
  id: string
  number: string
  navLabel: string
  title: string
  concept: string
  status: 'live' | 'planned'
}

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: 'intro', number: '00', navLabel: 'Intro', title: 'Numbers → Reality', concept: 'Where mathematics becomes reality.', status: 'live' },
  {
    id: 'rocket',
    number: '01',
    navLabel: 'Rocket',
    title: 'Rocket launch',
    concept: 'How mathematics turns thrust into motion and eventually orbital velocity.',
    status: 'live',
  },
  { id: 'gps', number: '02', navLabel: 'GPS', title: 'GPS', concept: 'How geometry and timing determine your position on Earth.', status: 'planned' },
  { id: 'f1', number: '03', navLabel: 'F1', title: 'F1 aerodynamics', concept: 'How equations turn airflow into downforce and drag.', status: 'planned' },
  { id: 'ai', number: '04', navLabel: 'AI', title: 'The mathematics inside AI', concept: 'How numbers become predictions.', status: 'planned' },
  { id: 'ct', number: '05', navLabel: 'CT', title: 'Seeing inside', concept: 'How mathematics reconstructs internal structure from measurements.', status: 'planned' },
  {
    id: 'skyscraper',
    number: '06',
    navLabel: 'Skyscraper',
    title: 'Making a building stand',
    concept: 'How mathematics predicts forces and structural motion.',
    status: 'planned',
  },
  { id: 'robot', number: '07', navLabel: 'Robot arm', title: 'Teaching machines to move', concept: 'How geometry, trigonometry and matrices control robots.', status: 'planned' },
  {
    id: 'accelerator',
    number: '08',
    navLabel: 'Accelerator',
    title: 'Bending particles',
    concept: 'How electromagnetism and mathematics control charged particles.',
    status: 'planned',
  },
]

export const LIVE_CHAPTERS = CHAPTERS.filter((c) => c.status === 'live')
