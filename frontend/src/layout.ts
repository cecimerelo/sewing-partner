export type Piece = {
  id: number
  label: string
  width: number
  height: number
  quantity: number
}

export type PlacedRect = {
  x: number
  y: number
  width: number
  height: number
  label: string
}

// Simple shelf packing: places pieces left-to-right, wrapping to a new row
// when the current row runs out of fabric width. Just a preview of fit —
// manual drag-and-drop placement comes next.
export function layoutPieces(usableWidth: number, pieces: Piece[]): PlacedRect[] {
  const placed: PlacedRect[] = []
  let cursorX = 0
  let cursorY = 0
  let rowHeight = 0

  for (const piece of pieces) {
    for (let i = 0; i < piece.quantity; i++) {
      if (cursorX + piece.width > usableWidth && cursorX > 0) {
        cursorX = 0
        cursorY += rowHeight
        rowHeight = 0
      }
      placed.push({ x: cursorX, y: cursorY, width: piece.width, height: piece.height, label: piece.label })
      cursorX += piece.width
      rowHeight = Math.max(rowHeight, piece.height)
    }
  }

  return placed
}
