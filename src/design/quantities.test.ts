import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { QUANTITY_COLORS, QUANTITY_TEXT_COLORS } from './quantities'

const css = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf8')

function token(name: string): string | null {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  return match ? match[1].toLowerCase() : null
}

describe('quantity colours', () => {
  it('mark tones match the CSS tokens', () => {
    for (const [kind, hex] of Object.entries(QUANTITY_COLORS)) expect(token(`color-q-${kind}-mark`), kind).toBe(hex)
  })

  it('text tones match the CSS tokens', () => {
    for (const [kind, hex] of Object.entries(QUANTITY_TEXT_COLORS)) expect(token(`color-q-${kind}`), kind).toBe(hex)
  })
})
