import { describe, expect, it } from 'vitest'
import { calculateFabricNeeded, layoutPieces, reconcileInstances, type Instance, type Piece } from './layout'

function piece(overrides: Partial<Piece>): Piece {
  const base = { id: 1, label: 'p', width: 10, height: 10, quantity: 1, canRotate: false }
  return { ...base, ...overrides, canRotate: overrides.canRotate ?? base.canRotate }
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
      { x: 0, y: 0, width: 40, height: 20, label: 'b' },
      { x: 0, y: 20, width: 40, height: 10, label: 'a' },
    ])
  })

  it('sorts pieces tallest-first so shorter pieces can share a row instead of starting a new one', () => {
    const result = layoutPieces(100, [
      piece({ id: 1, label: 'short', width: 40, height: 10 }),
      piece({ id: 2, label: 'tall', width: 40, height: 30 }),
    ])
    expect(result).toEqual([
      { x: 0, y: 0, width: 40, height: 30, label: 'tall' },
      { x: 40, y: 0, width: 40, height: 10, label: 'short' },
    ])
  })

  it('reuses leftover width in an earlier row instead of always starting a new one', () => {
    const result = layoutPieces(50, [
      piece({ id: 1, label: 'A', width: 40, height: 30 }),
      piece({ id: 2, label: 'B', width: 45, height: 20 }),
      piece({ id: 3, label: 'C', width: 10, height: 5 }),
    ])
    // C doesn't fit row B's leftover width (45+10=55 > 50), but fits row A's
    // leftover (40+10=50) — reusing it keeps the total length at 50 (30+20)
    // instead of opening a third row and growing to 55 (30+20+5).
    expect(result).toEqual([
      { x: 0, y: 0, width: 40, height: 30, label: 'A' },
      { x: 0, y: 30, width: 45, height: 20, label: 'B' },
      { x: 40, y: 0, width: 10, height: 5, label: 'C' },
    ])
  })

  it('rotates a piece that would not otherwise fit the usable width', () => {
    const result = layoutPieces(50, [piece({ width: 60, height: 20, canRotate: true })])
    expect(result).toEqual([{ x: 0, y: 0, width: 20, height: 60, label: 'p' }])
  })

  it('does not rotate a piece that is not flagged as rotatable, even if rotating would fit better', () => {
    const result = layoutPieces(50, [piece({ width: 60, height: 20, canRotate: false })])
    expect(result).toEqual([{ x: 0, y: 0, width: 60, height: 20, label: 'p' }])
  })

  it('rotates a piece to minimize the added shelf height when opening a new row', () => {
    const result = layoutPieces(100, [
      piece({ id: 1, label: 'A', width: 90, height: 30 }),
      piece({ id: 2, label: 'C', width: 15, height: 25, canRotate: true }),
      piece({ id: 3, label: 'B', width: 80, height: 20 }),
    ])
    // C (15x25) doesn't fit A's leftover width either way, so it opens a new
    // row. Rotated (25x15) adds only 15 to the total length instead of 25.
    expect(result).toEqual([
      { x: 0, y: 0, width: 90, height: 30, label: 'A' },
      { x: 0, y: 30, width: 25, height: 15, label: 'C' },
      { x: 0, y: 45, width: 80, height: 20, label: 'B' },
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

describe('calculateFabricNeeded', () => {
  it('reports zero waste when pieces exactly fill the fabric', () => {
    const result = calculateFabricNeeded(100, [piece({ width: 100, height: 50 })])
    expect(result.requiredLength).toBe(50)
    expect(result.wastePercent).toBeCloseTo(0)
  })

  it('reports waste when pieces do not fill the required length', () => {
    // Two 40x10 pieces side by side need 40 usable width, 10 length, but wrap at 60 -> one row
    const result = calculateFabricNeeded(60, [
      piece({ id: 1, width: 40, height: 10 }),
      piece({ id: 2, width: 40, height: 20 }),
    ])
    // requiredLength = 30 (10 + 20), fabric area = 60*30 = 1800, piece area = 400+800=1200
    expect(result.requiredLength).toBe(30)
    expect(result.wastePercent).toBeCloseTo(((1800 - 1200) / 1800) * 100)
  })

  it('returns zero for no pieces', () => {
    expect(calculateFabricNeeded(100, [])).toEqual({ requiredLength: 0, wastePercent: 0 })
  })
})

describe('reconcileInstances', () => {
  it('creates one instance per unit of quantity, seeded from the auto layout', () => {
    const { instances, nextId } = reconcileInstances(
      [piece({ id: 1, label: 'a', width: 10, height: 20, quantity: 2 })],
      [],
      100,
      1,
    )
    expect(instances).toHaveLength(2)
    expect(instances.every((i) => i.pieceId === 1 && i.width === 10 && i.height === 20)).toBe(true)
    expect(nextId).toBe(3)
  })

  it('preserves an existing instance (including manual position/rotation) when quantity is unchanged', () => {
    const existing: Instance[] = [
      { instanceId: 5, pieceId: 1, label: 'a', width: 10, height: 20, x: 999, y: 888, rotationDeg: 45 },
    ]
    const { instances } = reconcileInstances(
      [piece({ id: 1, label: 'a', width: 10, height: 20, quantity: 1 })],
      existing,
      100,
      10,
    )
    expect(instances).toEqual(existing)
  })

  it('adds a new instance when quantity increases, keeping the existing one untouched', () => {
    const existing: Instance[] = [
      { instanceId: 5, pieceId: 1, label: 'a', width: 10, height: 20, x: 999, y: 888, rotationDeg: 45 },
    ]
    const { instances } = reconcileInstances(
      [piece({ id: 1, label: 'a', width: 10, height: 20, quantity: 2 })],
      existing,
      100,
      10,
    )
    expect(instances).toHaveLength(2)
    expect(instances[0]).toEqual(existing[0])
    expect(instances[1].instanceId).toBe(10)
  })

  it('drops excess instances when quantity decreases', () => {
    const existing: Instance[] = [
      { instanceId: 1, pieceId: 1, label: 'a', width: 10, height: 20, x: 0, y: 0, rotationDeg: 0 },
      { instanceId: 2, pieceId: 1, label: 'a', width: 10, height: 20, x: 5, y: 5, rotationDeg: 0 },
    ]
    const { instances } = reconcileInstances(
      [piece({ id: 1, label: 'a', width: 10, height: 20, quantity: 1 })],
      existing,
      100,
      10,
    )
    expect(instances).toEqual([existing[0]])
  })

  it('drops all instances for a piece that no longer exists', () => {
    const existing: Instance[] = [
      { instanceId: 1, pieceId: 99, label: 'gone', width: 10, height: 20, x: 0, y: 0, rotationDeg: 0 },
    ]
    const { instances } = reconcileInstances([], existing, 100, 10)
    expect(instances).toEqual([])
  })
})
