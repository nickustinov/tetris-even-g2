import { FIELD_COLS, FIELD_ROWS, LINES_PER_LEVEL, BASE_TICK_MS, MIN_TICK_MS, TICK_SPEED_STEP } from './layout'
import { PIECE_CELLS, boxSize } from './pieces'
import type { PieceType } from './pieces'
import { game, drawFromBag, submitScore } from './state'
import type { ActivePiece } from './state'

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

function collides(row: number, col: number, type: PieceType, rotation: number): boolean {
  const cells = PIECE_CELLS[type][rotation]
  for (const [cr, cc] of cells) {
    const r = row + cr
    const c = col + cc
    if (r < 0 || r >= FIELD_ROWS || c < 0 || c >= FIELD_COLS) return true
    if (game.board[r][c]) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

function spawnCol(type: PieceType): number {
  const size = boxSize(type)
  return Math.floor((FIELD_COLS - size) / 2)
}

export function spawnPiece(): boolean {
  const type = game.nextType
  const col = spawnCol(type)
  const row = 0

  if (collides(row, col, type, 0)) {
    game.running = false
    game.over = true
    void submitScore(game.score)
    return false
  }

  game.piece = { type, rotation: 0, row, col }
  game.nextType = drawFromBag()
  game.grounded = false
  return true
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

export function moveLeft(): void {
  if (!game.piece || !game.running) return
  const p = game.piece
  if (!collides(p.row, p.col - 1, p.type, p.rotation)) {
    p.col--
    // If piece was grounded but can now fall, un-ground it
    if (game.grounded && !collides(p.row + 1, p.col, p.type, p.rotation)) {
      game.grounded = false
    }
  }
}

export function moveRight(): void {
  if (!game.piece || !game.running) return
  const p = game.piece
  if (!collides(p.row, p.col + 1, p.type, p.rotation)) {
    p.col++
    if (game.grounded && !collides(p.row + 1, p.col, p.type, p.rotation)) {
      game.grounded = false
    }
  }
}

export function rotate(): void {
  if (!game.piece || !game.running) return
  const p = game.piece
  const newRot = (p.rotation + 1) % 4

  // Try rotation with wall kicks: 0, -1, +1, -2, +2
  const kicks = [0, -1, 1, -2, 2]
  for (const dx of kicks) {
    if (!collides(p.row, p.col + dx, p.type, newRot)) {
      p.rotation = newRot
      p.col += dx
      if (game.grounded && !collides(p.row + 1, p.col, p.type, p.rotation)) {
        game.grounded = false
      }
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Lock piece into board
// ---------------------------------------------------------------------------

function lockPiece(piece: ActivePiece): void {
  const cells = PIECE_CELLS[piece.type][piece.rotation]
  for (const [cr, cc] of cells) {
    const r = piece.row + cr
    const c = piece.col + cc
    if (r >= 0 && r < FIELD_ROWS && c >= 0 && c < FIELD_COLS) {
      game.board[r][c] = 1
    }
  }
}

// ---------------------------------------------------------------------------
// Line clearing
// ---------------------------------------------------------------------------

function clearLines(): number {
  let cleared = 0
  for (let r = FIELD_ROWS - 1; r >= 0; r--) {
    if (game.board[r].every((cell) => cell === 1)) {
      game.board.splice(r, 1)
      game.board.unshift(Array(FIELD_COLS).fill(0) as number[])
      cleared++
      r++ // re-check same row index after splice
    }
  }
  return cleared
}

const LINE_SCORES = [0, 100, 300, 500, 800]

function awardScore(linesCleared: number): void {
  if (linesCleared <= 0) return
  const base = LINE_SCORES[Math.min(linesCleared, 4)]
  game.score += base * game.level
  game.lines += linesCleared
  game.level = Math.floor(game.lines / LINES_PER_LEVEL) + 1
}

// ---------------------------------------------------------------------------
// Gravity tick
// ---------------------------------------------------------------------------

export function currentTickMs(): number {
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - (game.level - 1) * TICK_SPEED_STEP)
}

export type TickResult = {
  locked: boolean
  linesCleared: number
  gameOver: boolean
}

export function tick(): TickResult {
  if (!game.piece) {
    // Spawn first piece
    const alive = spawnPiece()
    return { locked: false, linesCleared: 0, gameOver: !alive }
  }

  const p = game.piece

  // If piece was grounded last tick, lock it now
  if (game.grounded) {
    if (collides(p.row + 1, p.col, p.type, p.rotation)) {
      lockPiece(p)
      const linesCleared = clearLines()
      awardScore(linesCleared)
      game.piece = null
      game.grounded = false

      const alive = spawnPiece()
      return { locked: true, linesCleared, gameOver: !alive }
    }
    // Piece is no longer stuck (player moved it) – continue falling
    game.grounded = false
  }

  // Try to move down
  if (!collides(p.row + 1, p.col, p.type, p.rotation)) {
    p.row++
  } else {
    game.grounded = true
  }

  return { locked: false, linesCleared: 0, gameOver: false }
}
