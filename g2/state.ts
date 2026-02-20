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
  grounded: boolean   // piece touched down, locks on next tick if still stuck
}

const HS_KEY = 'tetris:highscore'

function loadHighScore(): number {
  const v = localStorage.getItem(HS_KEY)
  return v ? parseInt(v, 10) || 0 : 0
}

export function saveHighScore(score: number): void {
  if (score > game.highScore) {
    game.highScore = score
    localStorage.setItem(HS_KEY, String(score))
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
  game.grounded = false
}

export const game: GameState = {
  board: emptyBoard(),
  piece: null,
  nextType: 'T',
  bag: [],
  score: 0,
  highScore: loadHighScore(),
  lines: 0,
  level: 1,
  running: false,
  over: false,
  grounded: false,
}

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
