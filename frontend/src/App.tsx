import { createSignal, createEffect, For } from 'solid-js'
import { createStore } from 'solid-js/store'
import Grid from '@suid/material/Grid'
import Box from '@suid/material/Box'
import Stack from '@suid/material/Stack'
import Paper from '@suid/material/Paper'
import Typography from '@suid/material/Typography'
import TextField from '@suid/material/TextField'
import Button from '@suid/material/Button'
import Checkbox from '@suid/material/Checkbox'
import FormControlLabel from '@suid/material/FormControlLabel'
import IconButton from '@suid/material/IconButton'
import Divider from '@suid/material/Divider'
import Alert from '@suid/material/Alert'
import { layoutPieces, type Piece } from './layout'

type Unit = 'cm'

type Fabric = {
  width: number
  length: number
  unit: Unit
  folded: boolean
}

let nextPieceId = 1

const MIN_DISPLAY_WIDTH = 280
const MAX_DISPLAY_WIDTH = 600

function App() {
  const [fabric, setFabric] = createStore<Fabric>({
    width: 0,
    length: 0,
    unit: 'cm',
    folded: false,
  })

  const [pieces, setPieces] = createStore<Piece[]>([])

  const [nextLabel, setNextLabel] = createSignal(1)
  const [pieceLabel, setPieceLabel] = createSignal(String(nextLabel()))
  const [pieceWidth, setPieceWidth] = createSignal(0)
  const [pieceHeight, setPieceHeight] = createSignal(0)
  const [pieceQuantity, setPieceQuantity] = createSignal(1)
  const [pieceSubmitAttempted, setPieceSubmitAttempted] = createSignal(false)

  const fabricReady = () => fabric.width > 0 && fabric.length > 0
  const pieceLabelError = () => pieceSubmitAttempted() && !pieceLabel().trim()

  const addPiece = () => {
    if (!fabricReady()) return
    setPieceSubmitAttempted(true)
    if (!pieceLabel().trim() || pieceWidth() <= 0 || pieceHeight() <= 0) return
    setPieces(pieces.length, {
      id: nextPieceId++,
      label: pieceLabel().trim(),
      width: pieceWidth(),
      height: pieceHeight(),
      quantity: pieceQuantity(),
    })
    const label = nextLabel() + 1
    setNextLabel(label)
    setPieceLabel(String(label))
    setPieceWidth(0)
    setPieceHeight(0)
    setPieceQuantity(1)
    setPieceSubmitAttempted(false)
  }

  const removePiece = (id: number) => {
    setPieces((prev) => prev.filter((p) => p.id !== id))
  }

  let canvasRef: HTMLCanvasElement | undefined
  let canvasContainerRef: HTMLDivElement | undefined

  const [displayWidth, setDisplayWidth] = createSignal(MAX_DISPLAY_WIDTH)

  createEffect(() => {
    const container = canvasContainerRef
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      setDisplayWidth(Math.max(MIN_DISPLAY_WIDTH, Math.min(MAX_DISPLAY_WIDTH, width)))
    })
    observer.observe(container)
  })

  createEffect(() => {
    const canvas = canvasRef
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = displayWidth()
    const usableWidth = fabric.folded ? fabric.width / 2 : fabric.width
    const scale = usableWidth > 0 ? width / usableWidth : 0
    const placed = usableWidth > 0 ? layoutPieces(usableWidth, pieces) : []

    const requiredHeight = placed.reduce((max, r) => Math.max(max, r.y + r.height), 0)
    const displayHeight = Math.max(fabric.length, requiredHeight) * scale || 200

    canvas.width = width
    canvas.height = displayHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // fabric background
    ctx.fillStyle = '#f4f3ec'
    ctx.fillRect(0, 0, width, fabric.length * scale)
    ctx.strokeStyle = '#c9c6bd'
    ctx.strokeRect(0, 0, width, fabric.length * scale)

    // pieces
    for (const rect of placed) {
      ctx.fillStyle = 'rgba(170, 59, 255, 0.25)'
      ctx.strokeStyle = '#aa3bff'
      ctx.fillRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale)
      ctx.strokeRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale)
      ctx.fillStyle = '#08060d'
      ctx.font = '12px system-ui'
      ctx.fillText(rect.label, rect.x * scale + 4, rect.y * scale + 14)
    }
  })

  return (
    <Grid container sx={{ minHeight: "100vh" }}>
      <Grid item xs={12} md={4} sx={{ p: 3, overflowY: "auto", borderRight: { xs: "none", md: "1px solid" }, borderBottom: { xs: "1px solid", md: "none" }, borderColor: "divider", boxSizing: "border-box" }}>
        <Typography variant="h5" gutterBottom>Sewing Partner</Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>Fabric</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2 }}>
            <TextField
              label={`Width (${fabric.unit})`}
              type="number"
              size="small"
              value={fabric.width}
              onChange={(_e, value) => setFabric('width', Number(value))}
              sx={{ width: 120 }}
            />
            <TextField
              label={`Length (${fabric.unit})`}
              type="number"
              size="small"
              value={fabric.length}
              onChange={(_e, value) => setFabric('length', Number(value))}
              sx={{ width: 120 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={fabric.folded}
                  onChange={(_e, checked) => setFabric('folded', checked)}
                />
              }
              label="Folded"
            />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Pattern pieces</Typography>

          {!fabricReady() && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Set the fabric width and length before adding pieces.
            </Alert>
          )}

          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2, mb: 1 }}>
            <TextField
              label="Label"
              required
              size="small"
              value={pieceLabel()}
              onChange={(_e, value) => setPieceLabel(value)}
              disabled={!fabricReady()}
              error={pieceLabelError()}
              sx={{ width: 110 }}
            />
            <TextField
              label={`Width (${fabric.unit})`}
              type="number"
              size="small"
              value={pieceWidth()}
              onChange={(_e, value) => setPieceWidth(Number(value))}
              disabled={!fabricReady()}
              sx={{ width: 110 }}
            />
            <TextField
              label={`Height (${fabric.unit})`}
              type="number"
              size="small"
              value={pieceHeight()}
              onChange={(_e, value) => setPieceHeight(Number(value))}
              disabled={!fabricReady()}
              sx={{ width: 110 }}
            />
            <TextField
              label="Qty"
              type="number"
              size="small"
              inputProps={{ min: 1 }}
              value={pieceQuantity()}
              onChange={(_e, value) => setPieceQuantity(Number(value))}
              disabled={!fabricReady()}
              sx={{ width: 80 }}
            />
            <Button variant="contained" onClick={addPiece} disabled={!fabricReady()}>
              Add piece
            </Button>
          </Box>

          <Box sx={{ minHeight: "20px", mb: 1 }}>
            {pieceLabelError() && (
              <Typography variant="caption" color="error">
                Label is required.
              </Typography>
            )}
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1}>
            <For each={pieces}>
              {(piece) => (
                <Paper variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body2">
                    {piece.label} — {piece.width}×{piece.height} ({fabric.unit}) × {piece.quantity}
                  </Typography>
                  <IconButton size="small" color="error" onClick={() => removePiece(piece.id)} aria-label="Remove piece">
                    ✕
                  </IconButton>
                </Paper>
              )}
            </For>
          </Stack>
        </Paper>
      </Grid>

      <Grid item xs={12} md={8} ref={canvasContainerRef} sx={{ p: 3, overflowY: "auto", bgcolor: "grey.50", boxSizing: "border-box" }}>
        <Typography variant="subtitle1" gutterBottom>Table</Typography>
        <Box component="canvas" ref={canvasRef} sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper", maxWidth: "100%" }} />
      </Grid>
    </Grid>
  )
}

export default App
