import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { game, setBridge, resetGame } from './state'
import { tick, spawnPiece, currentTickMs } from './game'
import { initDisplay, pushFrame, showSplash } from './renderer'
import { onEvenHubEvent, setStartGame } from './events'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function gameLoop(): Promise<void> {
  appendEventLog('Tetris: game loop started')

  // Spawn the first piece
  spawnPiece()
  await pushFrame()

  while (game.running) {
    const tickMs = currentTickMs()
    const start = Date.now()

    const result = tick()

    if (result.gameOver) {
      await pushFrame()
      appendEventLog(`Tetris: game over, score=${game.score}, lines=${game.lines}`)
      break
    }

    await pushFrame()

    const elapsed = Date.now() - start
    await sleep(Math.max(0, tickMs - elapsed))
  }
}

export function startGame(): void {
  if (game.running) return
  if (game.over) {
    game.over = false
    void showSplash()
    appendEventLog('Tetris: back to splash')
    return
  }
  resetGame()
  void pushFrame().then(() => {
    void gameLoop()
  })
  appendEventLog('Tetris: new game started')
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)
  setStartGame(startGame)

  appBridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()
  appendEventLog('Tetris: ready. Tap to start.')
}
