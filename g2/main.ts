import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppActions, SetStatus } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, startGame } from './app'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Even bridge not detected within ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

export function createTetrisActions(setStatus: SetStatus): AppActions {
  let connected = false

  return {
    async connect() {
      setStatus('Tetris: connecting to Even bridge...')
      appendEventLog('Tetris: connect requested')

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('Tetris: connected. Tap to start!')
        appendEventLog('Tetris: connected to bridge')
      } catch (err) {
        console.error('[tetris] connect failed', err)
        setStatus('Tetris: bridge not found.')
        appendEventLog('Tetris: connection failed')
      }
    },

    async action() {
      if (!connected) {
        setStatus('Tetris: not connected')
        return
      }
      startGame()
      setStatus('Tetris: new game!')
    },
  }
}
