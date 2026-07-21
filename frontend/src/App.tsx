import { createSignal, createEffect, onMount, untrack, For } from 'solid-js'
import { createStore } from 'solid-js/store'
import Konva from 'konva'
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
import { calculateFabricNeeded, reconcileInstances, type Instance, type Piece } from './layout'

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

  // Instances are individually draggable/rotatable copies of each piece
  // (one per unit of quantity). Reconciled from `pieces` whenever the
  // piece definitions or fabric width change — but reading `instances`
  // itself must stay untracked here, or every drag/rotate update (which
  // writes to `instances`) would re-trigger this same reconciliation.
  const [instances, setInstances] = createStore<Instance[]>([])
  const [nextInstanceId, setNextInstanceId] = createSignal(1)

  createEffect(() => {
    const width = fabric.width
    const currentPieces = pieces.map((p) => ({ ...p }))
    const { instances: reconciled, nextId } = reconcileInstances(
      currentPieces,
      untrack(() => instances),
      width,
      untrack(() => nextInstanceId()),
    )
    setInstances(reconciled)
    setNextInstanceId(nextId)
  })

  let stageContainerRef: HTMLDivElement | undefined
  let stage: Konva.Stage | undefined
  let layer: Konva.Layer | undefined

  onMount(() => {
    if (!stageContainerRef) return
    stage = new Konva.Stage({ container: stageContainerRef, width: 200, height: 200 })
    layer = new Konva.Layer()
    stage.add(layer)
  })

  createEffect(() => {
    if (!stage || !layer) return

    const width = fabric.width * PX_PER_CM || 200
    const maxY = instances.reduce((max, i) => Math.max(max, i.y + i.height), 0)
    const height = Math.max(400, maxY * PX_PER_CM + 100)
    stage.width(width)
    stage.height(height)

    layer.find('.piece').forEach((node) => node.destroy())

    // Rotations are locked to 0/90/180/270, so every piece stays axis-aligned —
    // overlap checks can use simple AABB intersection instead of polygon math.
    // Populated as groups are created below; dragBoundFunc closures read it
    // lazily, so it's fully populated by the time any drag actually happens.
    const groupInfos: { instanceId: number; group: Konva.Group; footprintWidth: number; footprintHeight: number }[] = []

    for (const inst of instances) {
      const rectWidth = inst.width * PX_PER_CM
      const rectHeight = inst.height * PX_PER_CM

      const group = new Konva.Group({
        x: inst.x * PX_PER_CM,
        y: inst.y * PX_PER_CM,
        rotation: inst.rotationDeg,
        offsetX: rectWidth / 2,
        offsetY: rectHeight / 2,
        draggable: true,
        name: 'piece',
      })

      // Rotation swaps which side faces which axis, so the drag bounds
      // must use the footprint (post-rotation) dimensions, not the raw
      // rect width/height, to keep the piece fully on the fabric.
      const isSideways = Math.abs(inst.rotationDeg % 180) === 90
      const footprintWidth = isSideways ? rectHeight : rectWidth
      const footprintHeight = isSideways ? rectWidth : rectHeight
      groupInfos.push({ instanceId: inst.instanceId, group, footprintWidth, footprintHeight })

      let lastValidPos = { x: inst.x * PX_PER_CM, y: inst.y * PX_PER_CM }
      group.dragBoundFunc((pos) => {
        const stageWidth = stage!.width()
        const stageHeight = stage!.height()
        const minX = footprintWidth / 2
        const maxX = Math.max(minX, stageWidth - footprintWidth / 2)
        const minY = footprintHeight / 2
        const maxY = Math.max(minY, stageHeight - footprintHeight / 2)
        const x = Math.min(Math.max(pos.x, minX), maxX)
        const y = Math.min(Math.max(pos.y, minY), maxY)

        const left = x - footprintWidth / 2
        const right = x + footprintWidth / 2
        const top = y - footprintHeight / 2
        const bottom = y + footprintHeight / 2

        const overlapsAnother = groupInfos.some((other) => {
          if (other.instanceId === inst.instanceId) return false
          const otherLeft = other.group.x() - other.footprintWidth / 2
          const otherRight = other.group.x() + other.footprintWidth / 2
          const otherTop = other.group.y() - other.footprintHeight / 2
          const otherBottom = other.group.y() + other.footprintHeight / 2
          return left < otherRight && right > otherLeft && top < otherBottom && bottom > otherTop
        })

        if (overlapsAnother) return lastValidPos
        lastValidPos = { x, y }
        return lastValidPos
      })

      group.add(
        new Konva.Rect({
          width: rectWidth,
          height: rectHeight,
          fill: 'rgba(170, 59, 255, 0.25)',
          stroke: '#aa3bff',
          strokeWidth: 1,
        }),
      )
      group.add(new Konva.Text({ text: inst.label, fontSize: 12, fill: '#08060d', padding: 4 }))

      group.on('dragend', () => {
        setInstances(
          (i) => i.instanceId === inst.instanceId,
          { x: group.x() / PX_PER_CM, y: group.y() / PX_PER_CM },
        )
      })

      const piece = pieces.find((p) => p.id === inst.pieceId)
      if (piece?.canRotate) {
        // Rotate button sits at the piece's center and always shows —
        // clicking it steps rotation by 90°. It's a child of the draggable
        // group, so a plain click on it would otherwise also start a drag;
        // cancelling the group's dragstart when it originates on the
        // button keeps the click a click.
        const handleCenterX = rectWidth / 2
        const handleCenterY = rectHeight / 2

        const handle = new Konva.Circle({
          x: handleCenterX,
          y: handleCenterY,
          radius: 11,
          fill: 'rgba(255, 255, 255, 0.85)',
          stroke: '#aa3bff',
          strokeWidth: 1.5,
        })
        // MUI's Refresh icon path (24x24 viewBox), scaled down and centered
        // on the button — matches @mui/icons-material/Refresh, which is a
        // React component and can't be rendered onto a Konva canvas directly.
        const handleIcon = new Konva.Path({
          x: handleCenterX,
          y: handleCenterY,
          data: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
          fill: '#aa3bff',
          scale: { x: 0.65, y: 0.65 },
          offsetX: 12,
          offsetY: 12,
          listening: false,
        })
        group.add(handle)
        group.add(handleIcon)

        group.on('dragstart', (e) => {
          if (e.target === handle) group.stopDrag()
        })
        handle.on('mouseenter', () => {
          stage!.container().style.cursor = 'pointer'
        })
        handle.on('mouseleave', () => {
          stage!.container().style.cursor = 'default'
        })
        handle.on('click tap', () => {
          const rotationDeg = (group.rotation() + 90) % 360
          group.rotation(rotationDeg)
          setInstances((i) => i.instanceId === inst.instanceId, 'rotationDeg', rotationDeg)
        })
      }

      layer.add(group)
    }

    layer.batchDraw()
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
            <Button variant="contained" onClick={addPiece} disabled={!fabricReady() || pieceWidth() <= 0 || pieceHeight() <= 0}>
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
        <Box ref={stageContainerRef} sx={{ display: "inline-block", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }} />
      </Grid>
    </Grid>
  )
}

export default App
