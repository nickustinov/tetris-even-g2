import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, FIELD_COLS, FIELD_ROWS } from './layout'
import { PIECE_CELLS } from './pieces'
import { game, bridge } from './state'

// ---------------------------------------------------------------------------
// Unicode characters
// ---------------------------------------------------------------------------

const EMPTY = '　'   // ideographic space (fullwidth)
const FILLED = '▦'  // filled cell / active piece

// ---------------------------------------------------------------------------
// Layout split: bordered playfield on the left, info / confirm list on the right
// ---------------------------------------------------------------------------

// 10 fullwidth cells render at exactly 200px (measured via @evenrealities/pretext);
// add padding + border on each side so the playfield content sits flush with the frame.
const FIELD_W = 219
const RIGHT_X = FIELD_W + 8
const RIGHT_W = DISPLAY_WIDTH - RIGHT_X

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
    appendEventLog(`Blocks: failed to load ${name}`)
    return null
  }
}

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
// Bridge write serialization
// ---------------------------------------------------------------------------
// Concurrent SDK calls crash the BLE link to real glasses (the simulator is
// forgiving). Every public render entry point must go through this chain so
// that rebuildPageContainer / textContainerUpgrade calls execute strictly
// in order, never overlapping.

let bridgeChain: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = bridgeChain.then(fn, fn)
  bridgeChain = next.catch(() => {})
  return next
}

// ---------------------------------------------------------------------------
// Page layouts
// ---------------------------------------------------------------------------

let startupRendered = false
let pageSetUp = false

type PageMode = 'splash' | 'game' | 'gameover' | 'confirm'
let currentPage: PageMode = 'splash'

function splashText(): string {
  return `Best: ${game.highScore} · Tap to start · Swipe to move`
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

// Container IDs for the game page:
//  1 = full-screen event capture
//  2 = bordered playfield (left)
//  3 = info panel (right)
function gamePageConfig(): object {
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
        containerID: 2,
        containerName: 'field',
        content: renderPlayfield(),
        xPosition: 0,
        yPosition: 0,
        width: FIELD_W,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 8,
        borderWidth: 1,
        borderColor: 10,
        borderRadius: 4,
      }),
      new TextContainerProperty({
        containerID: 3,
        containerName: 'info',
        content: renderInfoPanel(),
        xPosition: RIGHT_X,
        yPosition: 0,
        width: RIGHT_W,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 14,
      }),
    ],
  }
}

async function setupGamePage(): Promise<void> {
  if (!bridge) return
  await bridge.rebuildPageContainer(new RebuildPageContainer(gamePageConfig()))
  pageSetUp = true
  currentPage = 'game'
}

// ---------------------------------------------------------------------------
// Info panel helpers
// ---------------------------------------------------------------------------

function infoLabel(label: string, value?: string): string {
  if (value !== undefined) return label + ' ' + value
  return label
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

  const lines: string[] = []
  for (let r = 0; r < pieceH; r++) {
    let line = ''
    for (let c = 0; c <= maxC - minC; c++) {
      line += cellSet.has(`${r},${c}`) ? FILLED : EMPTY
    }
    lines.push(line)
  }
  return lines
}

function renderInfoPanel(): string {
  const preview = renderNextPreview()
  const lines: string[] = []
  lines.push(infoLabel('NEXT'))
  lines.push('')
  lines.push(preview[0] ?? '')
  lines.push(preview[1] ?? '')
  lines.push('')
  lines.push(infoLabel('SCORE', String(game.score)))
  lines.push(infoLabel('BEST', String(game.highScore)))
  lines.push(infoLabel('LINES', String(game.lines)))
  lines.push(infoLabel('LEVEL', String(game.level)))
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Playfield rendering
// ---------------------------------------------------------------------------

function renderPlayfield(): string {
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
  let text = ''
  for (let r = 0; r < FIELD_ROWS; r++) {
    for (let c = 0; c < FIELD_COLS; c++) {
      if (activeCells.has(`${r},${c}`)) text += FILLED
      else if (game.board[r][c]) text += FILLED
      else text += EMPTY
    }
    if (r < FIELD_ROWS - 1) text += '\n'
  }
  return text
}

function gameOverText(): string {
  return `Score: ${game.score} · Best: ${game.highScore} · Tap to play again`
}

// ---------------------------------------------------------------------------
// Confirm page: bordered playfield on the left, list of options on the right
// ---------------------------------------------------------------------------

export function showExitConfirm(): Promise<void> {
  return enqueue(async () => {
    if (!bridge) return
    const options = ['Continue playing', 'Exit']
    const listH = options.length * 46
    const listY = Math.floor((DISPLAY_HEIGHT - listH) / 2)

    await bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            containerID: 1,
            containerName: 'field',
            content: renderPlayfield(),
            xPosition: 0,
            yPosition: 0,
            width: FIELD_W,
            height: DISPLAY_HEIGHT,
            isEventCapture: 0,
            paddingLength: 8,
            borderWidth: 1,
            borderColor: 10,
            borderRadius: 4,
          }),
        ],
        listObject: [
          new ListContainerProperty({
            containerID: 2,
            containerName: 'confirm-opts',
            xPosition: RIGHT_X,
            yPosition: listY,
            width: RIGHT_W,
            height: listH,
            borderWidth: 0,
            borderColor: 0,
            borderRadius: 0,
            paddingLength: 4,
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: options.length,
              itemWidth: RIGHT_W - 10,
              isItemSelectBorderEn: 1,
              itemName: options,
            }),
          }),
        ],
      }),
    )
    pageSetUp = true
    currentPage = 'confirm'
  })
}

// ---------------------------------------------------------------------------
// Frame push
// ---------------------------------------------------------------------------

export function pushFrame(): Promise<void> {
  return enqueue(async () => {
    if (!bridge || !pageSetUp) return
    // Re-check inside the queued action: state may have changed while waiting.
    if (game.confirmingExit) return

    // Transition into the game page (from splash, gameover, or confirm-cancel).
    if (currentPage !== 'game' && game.running) {
      await setupGamePage()
      return
    }

    if (currentPage === 'game' && game.over) {
      await setupGameOverPage()
      return
    }

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

    // Game page: update playfield and info panel separately.
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 2,
        containerName: 'field',
        contentOffset: 0,
        contentLength: 2000,
        content: renderPlayfield(),
      }),
    )
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 3,
        containerName: 'info',
        contentOffset: 0,
        contentLength: 2000,
        content: renderInfoPanel(),
      }),
    )
  })
}

export function showSplash(): Promise<void> {
  return enqueue(() => setupSplashPage())
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDisplay(): Promise<void> {
  await loadImages()
  await enqueue(() => setupSplashPage())
  appendEventLog('Blocks: display initialized')
}
