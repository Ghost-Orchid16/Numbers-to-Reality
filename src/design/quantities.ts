import type { QuantityKind } from '../sim/core/simulation'

/**
 * Quantity colours, mirrored from the `--color-q-*` tokens in
 * src/styles/index.css (quantities.test.ts keeps them in sync).
 *
 * MARK tones draw arrows, lines and swatches; they were validated together for
 * colour-vision deficiency and normal vision. TEXT tones are lighter steps of
 * the same hues for symbols and labels, where the letter itself is a second
 * way to tell quantities apart.
 */
export const QUANTITY_COLORS: Record<QuantityKind, string> = {
  force: '#d37e01',
  gravity: '#735acc',
  drag: '#c13c3b',
  velocity: '#119cf3',
  acceleration: '#08a28f',
  mass: '#f4e7cf',
  position: '#cfe0f7',
  neutral: '#c9d3e1',
}

export const QUANTITY_TEXT_COLORS: Record<QuantityKind, string> = {
  force: '#fab36d',
  gravity: '#c3bafe',
  drag: '#ffaba3',
  velocity: '#8fcbfe',
  acceleration: '#5addc7',
  mass: '#f4e7cf',
  position: '#cfe0f7',
  neutral: '#c9d3e1',
}

/** Tailwind text classes (static strings so Tailwind can see them). */
export const QUANTITY_TEXT: Record<QuantityKind, string> = {
  force: 'text-q-force',
  gravity: 'text-q-gravity',
  drag: 'text-q-drag',
  velocity: 'text-q-velocity',
  acceleration: 'text-q-acceleration',
  mass: 'text-q-mass',
  position: 'text-q-position',
  neutral: 'text-q-neutral',
}

/** Tailwind background classes for swatches (mark tones). */
export const QUANTITY_BG: Record<QuantityKind, string> = {
  force: 'bg-q-force-mark',
  gravity: 'bg-q-gravity-mark',
  drag: 'bg-q-drag-mark',
  velocity: 'bg-q-velocity-mark',
  acceleration: 'bg-q-acceleration-mark',
  mass: 'bg-q-mass-mark',
  position: 'bg-q-position-mark',
  neutral: 'bg-q-neutral-mark',
}

/** Neutral scene colours shared by every chapter. */
export const SCENE_COLORS = {
  void: '#03050a',
  line: '#a0b4d2',
  path: '#cfe0f7',
}
