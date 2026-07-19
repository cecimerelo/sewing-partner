export type Piece = {
  id: number
  label: string
  width: number
  height: number
  quantity: number
  canRotate: boolean
}

export type PlacedRect = {
  x: number
  y: number
  width: number
  height: number
  label: string
}

type Item = { width: number; height: number; label: string; canRotate: boolean }
type Shelf = { y: number; height: number; usedWidth: number }
type Orientation = { width: number; height: number }

function orientations(item: Item): Orientation[] {
  if (!item.canRotate || item.width === item.height) return [{ width: item.width, height: item.height }]
  return [
    { width: item.width, height: item.height },
    { width: item.height, height: item.width },
  ]
}

// First-Fit Decreasing Height: pieces are sorted tallest-first, then each
// piece is placed on the first existing shelf (row) with enough leftover
// width — only opening a new shelf below the others when none fit. This
// reuses gaps in earlier, shorter rows instead of always growing
// downward, keeping the total fabric length needed as short as possible.
// Pieces flagged as rotatable are tried in both orientations: preferring
// whichever fits an existing shelf, or — when a new shelf is required —
// whichever orientation adds the least extra length.
export function layoutPieces(usableWidth: number, pieces: Piece[]): PlacedRect[] {
  const items: Item[] = []
  for (const piece of pieces) {
    for (let i = 0; i < piece.quantity; i++) {
      items.push({ width: piece.width, height: piece.height, label: piece.label, canRotate: piece.canRotate })
    }
  }
  items.sort((a, b) => b.height - a.height)

  const placed: PlacedRect[] = []
  const shelves: Shelf[] = []

  for (const item of items) {
    const candidates = orientations(item)

    let placedInShelf = false
    for (const shelf of shelves) {
      const fit = candidates.find((c) => c.height <= shelf.height && shelf.usedWidth + c.width <= usableWidth)
      if (fit) {
        placed.push({ x: shelf.usedWidth, y: shelf.y, width: fit.width, height: fit.height, label: item.label })
        shelf.usedWidth += fit.width
        placedInShelf = true
        break
      }
    }
    if (placedInShelf) continue

    const fittingWidth = candidates.filter((c) => c.width <= usableWidth)
    const chosen = fittingWidth.length
      ? fittingWidth.reduce((min, c) => (c.height < min.height ? c : min))
      : candidates[0]

    const y = shelves.reduce((sum, s) => sum + s.height, 0)
    const shelf: Shelf = { y, height: chosen.height, usedWidth: chosen.width }
    shelves.push(shelf)
    placed.push({ x: 0, y, width: chosen.width, height: chosen.height, label: item.label })
  }

  return placed
}

export type FabricNeeded = {
  requiredLength: number
  wastePercent: number
}

// Given the fabric width (and whether it's folded, halving the usable
// width) and the pieces to cut, returns the fabric length you'd need to
// buy to fit everything, plus the resulting waste percentage.
export function calculateFabricNeeded(usableWidth: number, pieces: Piece[]): FabricNeeded {
  const placed = layoutPieces(usableWidth, pieces)
  const requiredLength = placed.reduce((max, r) => Math.max(max, r.y + r.height), 0)

  const pieceArea = pieces.reduce((sum, p) => sum + p.width * p.height * p.quantity, 0)
  const fabricArea = usableWidth * requiredLength
  const wastePercent = fabricArea > 0 ? Math.max(0, (1 - pieceArea / fabricArea) * 100) : 0

  return { requiredLength, wastePercent }
}
