import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, FIELD_COLS, FIELD_ROWS } from './layout'
import { PIECE_CELLS } from './pieces'
import type { PieceType } from './pieces'
import { game, bridge } from './state'

// ---------------------------------------------------------------------------
// Unicode characters
// ---------------------------------------------------------------------------

const EMPTY = '\u25A1'     // □ empty playfield cell
const FILLED = '\u25A6'    // ▦ filled cell / active piece
const SEPARATOR = '\u2502' // │ divider

// ---------------------------------------------------------------------------
// Logo image
// ---------------------------------------------------------------------------

const LOGO_W = 200
const LOGO_H = 100
const LOGO_X = Math.floor((DISPLAY_WIDTH - LOGO_W) / 2)
const LOGO_Y = 70

let logoBytes: number[] | null = null
let gameoverBytes: number[] | null = null

async function loadImage(url: string, name: string): Promise<number[] | null> {
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    return Array.from(new Uint8Array(buf))
  } catch {
    appendEventLog(`Tetris: failed to load ${name}`)
    return null
  }
}

// String literals in new URL() are required for Vite to detect and bundle these assets
const logoUrl = new URL('./logo.png', import.meta.url).href
const gameoverUrl = new URL('./gameover.png', import.meta.url).href

async function loadImages(): Promise<void> {
  if (!logoBytes) logoBytes = await loadImage(logoUrl, 'logo.png')
  if (!gameoverBytes) gameoverBytes = await loadImage(gameoverUrl, 'gameover.png')
}

async function pushImage(bytes: number[] | null): Promise<void> {
  if (!bridge || !bytes) return
  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: 2,
      containerName: 'img',
      imageData: bytes,
    }),
  )
}

// ---------------------------------------------------------------------------
// Page layouts
// ---------------------------------------------------------------------------

let startupRendered = false
let pageSetUp = false

type PageMode = 'splash' | 'game' | 'gameover'
let currentPage: PageMode = 'splash'

function splashText(): string {
  const parts: string[] = []
  if (game.highScore > 0) parts.push(`Best: ${game.highScore}`)
  parts.push('Tap to start')
  parts.push('Swipe to move')
  return parts.join(' \u00B7 ')
}

function buildImagePage(text: string, textX: number): object {
  return {
    containerTotalNum: 3,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'evt',
        content: ' ',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 1,
        paddingLength: 0,
      }),
      new TextContainerProperty({
        containerID: 3,
        containerName: 'info',
        content: text,
        xPosition: textX,
        yPosition: LOGO_Y + LOGO_H + 15,
        width: DISPLAY_WIDTH - textX,
        height: DISPLAY_HEIGHT - LOGO_Y - LOGO_H - 15,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'img',
        xPosition: LOGO_X,
        yPosition: LOGO_Y,
        width: LOGO_W,
        height: LOGO_H,
      }),
    ],
  }
}

async function setupSplashPage(): Promise<void> {
  if (!bridge) return
  const config = buildImagePage(splashText(), 130)

  if (!startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupRendered = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
  pageSetUp = true
  currentPage = 'splash'

  await pushImage(logoBytes)
}

async function setupGameOverPage(): Promise<void> {
  if (!bridge) return
  const config = buildImagePage(gameOverText(), 120)
  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  pageSetUp = true
  currentPage = 'gameover'

  await pushImage(gameoverBytes)
}

async function setupGamePage(initialContent: string): Promise<void> {
  if (!bridge) return
  const config = {
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'evt',
        content: ' ',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 1,
        paddingLength: 0,
      }),
      new TextContainerProperty({
        containerID: 2,
        containerName: 'screen',
        content: initialContent,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
  }

  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  pageSetUp = true
  currentPage = 'game'
}

// ---------------------------------------------------------------------------
// Info panel helpers
// ---------------------------------------------------------------------------

function infoLabel(label: string, value?: string): string {
  if (value !== undefined) return ' ' + label + ' ' + value
  return ' ' + label
}


function renderNextPreview(): string[] {
  const cells = PIECE_CELLS[game.nextType][0]
  const rows = cells.map(([r]) => r)
  const cols = cells.map(([, c]) => c)
  const minR = Math.min(...rows)
  const maxR = Math.max(...rows)
  const minC = Math.min(...cols)
  const maxC = Math.max(...cols)
  const pieceH = maxR - minR + 1

  const cellSet = new Set(cells.map(([r, c]) => `${r - minR},${c - minC}`))

  // Render flush left (no space centering – font is not monospace)
  const lines: string[] = []
  for (let r = 0; r < pieceH; r++) {
    let line = ' '
    for (let c = 0; c <= maxC - minC; c++) {
      line += cellSet.has(`${r},${c}`) ? FILLED : EMPTY
    }
    lines.push(line)
  }
  return lines
}

function buildInfoPanel(): string[] {
  const preview = renderNextPreview()

  const lines: string[] = []

  // Row 0: NEXT label
  lines.push(infoLabel('NEXT'))

  // Row 1: blank
  lines.push('')

  // Rows 2–3: next piece preview (max 2 rows for most pieces)
  lines.push(preview[0] ?? '')
  lines.push(preview[1] ?? '')

  // Row 4: blank
  lines.push('')

  // Row 5: score
  lines.push(infoLabel('SCORE', String(game.score)))

  // Row 6: best
  lines.push(infoLabel('BEST', String(game.highScore)))

  // Row 7: lines
  lines.push(infoLabel('LINES', String(game.lines)))

  // Row 8: level
  lines.push(infoLabel('LEVEL', String(game.level)))

  // Row 9: blank
  lines.push('')

  return lines
}

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

function renderGrid(): string {
  // Collect active piece cells
  const activeCells = new Set<string>()
  if (game.piece) {
    const cells = PIECE_CELLS[game.piece.type][game.piece.rotation]
    for (const [cr, cc] of cells) {
      const r = game.piece.row + cr
      const c = game.piece.col + cc
      if (r >= 0 && r < FIELD_ROWS && c >= 0 && c < FIELD_COLS) {
        activeCells.add(`${r},${c}`)
      }
    }
  }

  const infoLines = buildInfoPanel()
  let text = ''

  for (let r = 0; r < FIELD_ROWS; r++) {
    // Playfield
    for (let c = 0; c < FIELD_COLS; c++) {
      if (activeCells.has(`${r},${c}`)) {
        text += FILLED
      } else if (game.board[r][c]) {
        text += FILLED
      } else {
        text += EMPTY
      }
    }

    // Separator
    text += SEPARATOR

    // Info panel
    text += infoLines[r] ?? ''

    text += '\n'
  }

  return text
}

function gameOverText(): string {
  const parts = [`Score: ${game.score}`]
  if (game.highScore > 0) parts.push(`Best: ${game.highScore}`)
  parts.push('Tap to play again')
  return parts.join(' \u00B7 ')
}

// ---------------------------------------------------------------------------
// Frame push
// ---------------------------------------------------------------------------

let pushInFlight = false

export async function pushFrame(): Promise<void> {
  if (!bridge || !pageSetUp) return
  if (pushInFlight) return
  pushInFlight = true
  try {
    // Transition to game page
    if (currentPage !== 'game' && game.running) {
      const text = renderGrid()
      await setupGamePage(text)
      return
    }

    // Transition to game over page
    if (currentPage === 'game' && game.over) {
      await setupGameOverPage()
      return
    }

    // On splash/gameover page, update info text
    if (currentPage === 'splash' || currentPage === 'gameover') {
      const text = currentPage === 'splash' ? splashText() : gameOverText()
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 3,
          containerName: 'info',
          contentOffset: 0,
          contentLength: 2000,
          content: text,
        }),
      )
      return
    }

    // Game page – update grid
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 2,
        containerName: 'screen',
        contentOffset: 0,
        contentLength: 2000,
        content: renderGrid(),
      }),
    )
  } finally {
    pushInFlight = false
  }
}

export async function showSplash(): Promise<void> {
  await setupSplashPage()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDisplay(): Promise<void> {
  await loadImages()
  await setupSplashPage()
  appendEventLog('Tetris: display initialized')
}
