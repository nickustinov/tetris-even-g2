import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { FIELD_COLS, FIELD_ROWS } from './layout'
import type { PieceType } from './pieces'
import { PIECE_TYPES } from './pieces'

export type ActivePiece = {
  type: PieceType
  rotation: number // 0–3
  row: number      // top-left of bounding box on the board
  col: number      // top-left of bounding box on the board
}

export type GameState = {
  board: number[][]   // FIELD_ROWS × FIELD_COLS, 0 = empty, 1 = filled
  piece: ActivePiece | null
  nextType: PieceType
  bag: PieceType[]
  score: number
  highScore: number
  lines: number
  level: number
  running: boolean
  over: boolean
  quit: boolean
  grounded: boolean   // piece touched down, locks on next tick if still stuck
  confirmingExit: boolean  // exit confirmation dialog is showing
}

const HIGH_SCORE_KEY = 'blocks_high_score'

export async function loadHighScore(): Promise<void> {
  if (!bridge) return
  const value = await bridge.getLocalStorage(HIGH_SCORE_KEY)
  if (value) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) game.highScore = parsed
  }
}

export function updateHighScore(): void {
  if (game.score > game.highScore) {
    game.highScore = game.score
    if (bridge) {
      void bridge.setLocalStorage(HIGH_SCORE_KEY, String(game.highScore))
    }
  }
}

function emptyBoard(): number[][] {
  return Array.from({ length: FIELD_ROWS }, () => Array(FIELD_COLS).fill(0) as number[])
}

function shuffleBag(): PieceType[] {
  const bag = [...PIECE_TYPES]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export function drawFromBag(): PieceType {
  if (game.bag.length === 0) {
    game.bag = shuffleBag()
  }
  return game.bag.pop()!
}

export function resetGame(): void {
  game.board = emptyBoard()
  game.bag = shuffleBag()
  game.nextType = game.bag.pop()!
  game.piece = null
  game.score = 0
  game.lines = 0
  game.level = 1
  game.running = true
  game.over = false
  game.quit = false
  game.grounded = false
  game.confirmingExit = false
}

export const game: GameState = {
  board: emptyBoard(),
  piece: null,
  nextType: 'T',
  bag: [],
  score: 0,
  highScore: 0,
  lines: 0,
  level: 1,
  running: false,
  over: false,
  quit: false,
  grounded: false,
  confirmingExit: false,
}

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
