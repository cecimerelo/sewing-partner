import { describe, expect, it } from 'vitest'
import { layoutPieces, type Piece } from './layout'

function piece(overrides: Partial<Piece>): Piece {
  return { id: 1, label: 'p', width: 10, height: 10, quantity: 1, ...overrides }
}

describe('layoutPieces', () => {
  it('places a single piece at the origin', () => {
    const result = layoutPieces(100, [piece({ width: 20, height: 15 })])
    expect(result).toEqual([{ x: 0, y: 0, width: 20, height: 15, label: 'p' }])
  })

  it('places pieces side by side while they fit the usable width', () => {
    const result = layoutPieces(100, [
      piece({ id: 1, label: 'a', width: 40, height: 10 }),
      piece({ id: 2, label: 'b', width: 40, height: 10 }),
    ])
    expect(result).toEqual([
      { x: 0, y: 0, width: 40, height: 10, label: 'a' },
      { x: 40, y: 0, width: 40, height: 10, label: 'b' },
    ])
  })

  it('wraps to a new row when a piece would overflow the usable width', () => {
    const result = layoutPieces(60, [
      piece({ id: 1, label: 'a', width: 40, height: 10 }),
      piece({ id: 2, label: 'b', width: 40, height: 20 }),
    ])
    expect(result).toEqual([
      { x: 0, y: 0, width: 40, height: 10, label: 'a' },
      { x: 0, y: 10, width: 40, height: 20, label: 'b' },
    ])
  })

  it('repeats a piece quantity times', () => {
    const result = layoutPieces(100, [piece({ width: 30, height: 10, quantity: 3 })])
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.x)).toEqual([0, 30, 60])
  })

  it('returns an empty layout for no pieces', () => {
    expect(layoutPieces(100, [])).toEqual([])
  })
})
