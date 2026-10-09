import { describe, expect, it } from 'vitest'
import { legendFor } from './legend'

const ids = (beat: Parameters<typeof legendFor>[0]) => legendFor(beat).map((item) => item.id)

describe('legendFor', () => {
  it('shows nothing before any line is drawn', () => {
    expect(ids('intro')).toEqual([])
  })

  it('shows only the path ahead before liftoff', () => {
    expect(ids('countdown')).toEqual(['ahead'])
  })

  it('adds the predicted orbit once it is on screen', () => {
    expect(ids('liftoff')).toEqual(['flown', 'ahead'])
    expect(ids('turn')).toEqual(['flown', 'ahead', 'orbit'])
    expect(ids('lab')).toEqual(['flown', 'ahead', 'orbit'])
  })
})
