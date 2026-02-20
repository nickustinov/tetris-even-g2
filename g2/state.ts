import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
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

export async function fetchBestScore(): Promise<number> {
  appendEventLog('Score: fetching best score')
  try {
    const res = await fetch('/api/best-score')
    appendEventLog(`Score: GET status=${res.status}`)
    const data = await res.json()
    appendEventLog(`Score: GET response=${JSON.stringify(data)}`)
    const score: number = data.score ?? 0
    if (score > game.highScore) {
      game.highScore = score
    }
    return game.highScore
  } catch (err) {
    appendEventLog(`Score: GET failed: ${err}`)
    throw err
  }
}

export async function submitScore(score: number): Promise<void> {
  appendEventLog(`Score: submitting score=${score}`)
  try {
    const res = await fetch('/api/best-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    })
    appendEventLog(`Score: POST status=${res.status}`)
    const data = await res.json()
    appendEventLog(`Score: POST response=${JSON.stringify(data)}`)
    game.highScore = data.score ?? score
  } catch (err) {
    appendEventLog(`Score: POST failed: ${err}`)
    throw err
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
  highScore: 0,
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
