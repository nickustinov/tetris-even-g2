import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { game, setBridge, resetGame, loadHighScore } from './state'
import { tick, spawnPiece, currentTickMs } from './game'
import { initDisplay, pushFrame, showSplash } from './renderer'
import { onEvenHubEvent, setStartGame } from './events'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Token shared across the gameLoop's awaits. startGame replaces it before
// spawning a new loop, so any previous loop that wakes up from sleep sees a
// stale token and exits instead of continuing to tick alongside the new one.
let activeLoopToken: object = {}

async function gameLoop(token: object): Promise<void> {
  appendEventLog('Blocks: game loop started')

  spawnPiece()
  await pushFrame()

  while (game.running && activeLoopToken === token) {
    const tickMs = currentTickMs()
    const start = Date.now()

    if (!game.confirmingExit) {
      const result = tick()

      if (result.gameOver) {
        await pushFrame()
        appendEventLog(`Blocks: game over, score=${game.score}, lines=${game.lines}`)
        break
      }
    }

    await pushFrame()

    const elapsed = Date.now() - start
    await sleep(Math.max(0, tickMs - elapsed))
  }

  // Only the active loop is allowed to drive the post-game transition.
  if (activeLoopToken !== token) return

  if (game.quit) {
    game.quit = false
    await showSplash()
    appendEventLog('Blocks: quit to menu')
  }
}

export function startGame(): void {
  if (game.running) return
  if (game.over) {
    game.over = false
    void showSplash()
    appendEventLog('Blocks: back to splash')
    return
  }
  resetGame()
  const token = {}
  activeLoopToken = token
  void pushFrame().then(() => {
    void gameLoop(token)
  })
  appendEventLog('Blocks: new game started')
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)
  await loadHighScore()
  setStartGame(startGame)

  appBridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()

  appendEventLog('Blocks: ready. Tap to start.')
}
