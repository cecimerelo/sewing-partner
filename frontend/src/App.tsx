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
import { calculateFabricNeeded, layoutPieces, type Piece } from './layout'

type Unit = 'cm'

type Fabric = {
  width: number
  unit: Unit
}

let nextPieceId = 1

const PX_PER_CM = 3

function App() {
  const [fabric, setFabric] = createStore<Fabric>({
    width: 0,
    unit: 'cm',
  })

  const [pieces, setPieces] = createStore<Piece[]>([])

  const [nextLabel, setNextLabel] = createSignal(1)
  const [pieceLabel, setPieceLabel] = createSignal(String(nextLabel()))
  const [pieceWidth, setPieceWidth] = createSignal(0)
  const [pieceHeight, setPieceHeight] = createSignal(0)
  const [pieceQuantity, setPieceQuantity] = createSignal(1)
  const [pieceCanRotate, setPieceCanRotate] = createSignal(true)
  const [pieceSubmitAttempted, setPieceSubmitAttempted] = createSignal(false)

  const fabricReady = () => fabric.width > 0
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
      canRotate: pieceCanRotate(),
    })
    const label = nextLabel() + 1
    setNextLabel(label)
    setPieceLabel(String(label))
    setPieceWidth(0)
    setPieceHeight(0)
    setPieceQuantity(1)
    setPieceCanRotate(true)
    setPieceSubmitAttempted(false)
  }

  const removePiece = (id: number) => {
    setPieces((prev) => prev.filter((p) => p.id !== id))
  }

  const toggleCanRotate = (id: number, canRotate: boolean) => {
    setPieces((p) => p.id === id, 'canRotate', canRotate)
  }

  const [showCalculation, setShowCalculation] = createSignal(false)

  const calculation = () => calculateFabricNeeded(fabric.width, pieces)

  let canvasRef: HTMLCanvasElement | undefined

  createEffect(() => {
    const canvas = canvasRef
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const placed = fabric.width > 0 ? layoutPieces(fabric.width, pieces) : []

    const requiredLength = placed.reduce((max, r) => Math.max(max, r.y + r.height), 0)
    const width = fabric.width * PX_PER_CM || 200
    const height = requiredLength * PX_PER_CM || 200

    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // fabric background
    ctx.fillStyle = '#f4f3ec'
    ctx.fillRect(0, 0, width, requiredLength * PX_PER_CM)
    ctx.strokeStyle = '#c9c6bd'
    ctx.strokeRect(0, 0, width, requiredLength * PX_PER_CM)

    // pieces (width position/extent -> x, length position/extent -> y)
    for (const rect of placed) {
      const drawX = rect.x * PX_PER_CM
      const drawY = rect.y * PX_PER_CM
      const drawWidth = rect.width * PX_PER_CM
      const drawHeight = rect.height * PX_PER_CM
      ctx.fillStyle = 'rgba(170, 59, 255, 0.25)'
      ctx.strokeStyle = '#aa3bff'
      ctx.fillRect(drawX, drawY, drawWidth, drawHeight)
      ctx.strokeRect(drawX, drawY, drawWidth, drawHeight)
      ctx.fillStyle = '#08060d'
      ctx.font = '12px system-ui'
      ctx.fillText(rect.label, drawX + 4, drawY + 14)
    }
  })

  return (
    <Grid container sx={{ minHeight: "100vh" }}>
      <Grid item xs={12} md={4} sx={{ p: 3, overflowY: "auto", borderRight: { xs: "none", md: "1px solid" }, borderBottom: { xs: "1px solid", md: "none" }, borderColor: "divider", boxSizing: "border-box" }}>
        <Typography variant="h5" gutterBottom>Sewing Partner</Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2 }}>
            <TextField
              label={`Fabric width (${fabric.unit})`}
              type="number"
              size="small"
              inputProps={{ min: 0 }}
              value={fabric.width}
              onChange={(_e, value) => setFabric('width', Math.max(0, Number(value)))}
              sx={{ width: 140 }}
            />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Pattern pieces</Typography>

          {!fabricReady() && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Set the fabric width before adding pieces.
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
              inputProps={{ min: 0 }}
              value={pieceWidth()}
              onChange={(_e, value) => setPieceWidth(Math.max(0, Number(value)))}
              disabled={!fabricReady()}
              sx={{ width: 110 }}
            />
            <TextField
              label={`Height (${fabric.unit})`}
              type="number"
              size="small"
              inputProps={{ min: 0 }}
              value={pieceHeight()}
              onChange={(_e, value) => setPieceHeight(Math.max(0, Number(value)))}
              disabled={!fabricReady()}
              sx={{ width: 110 }}
            />
            <TextField
              label="Qty"
              type="number"
              size="small"
              inputProps={{ min: 1 }}
              value={pieceQuantity()}
              onChange={(_e, value) => setPieceQuantity(Math.max(1, Number(value)))}
              disabled={!fabricReady()}
              sx={{ width: 80 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={pieceCanRotate()}
                  onChange={(_e, checked) => setPieceCanRotate(checked)}
                  disabled={!fabricReady()}
                />
              }
              label="Can rotate"
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
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={piece.canRotate}
                          onChange={(_e, checked) => toggleCanRotate(piece.id, checked)}
                        />
                      }
                      label="Can rotate"
                    />
                    <IconButton size="small" color="error" onClick={() => removePiece(piece.id)} aria-label="Remove piece">
                      ✕
                    </IconButton>
                  </Box>
                </Paper>
              )}
            </For>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Button
            variant="outlined"
            onClick={() => setShowCalculation(true)}
            disabled={!fabricReady() || pieces.length === 0}
          >
            Calculate
          </Button>

          {showCalculation() && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body1">
                Fabric to buy: {Math.ceil(calculation().requiredLength)} {fabric.unit}
              </Typography>
            </Alert>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={8} sx={{ p: 3, overflow: "auto", bgcolor: "grey.50", boxSizing: "border-box" }}>
        <Typography variant="subtitle1" gutterBottom>Table</Typography>
        <Box component="canvas" ref={canvasRef} sx={{ border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }} />
      </Grid>
    </Grid>
  )
}

export default App
