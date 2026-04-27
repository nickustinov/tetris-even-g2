import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { bridge, game, updateHighScore } from './state'
import { moveLeft, moveRight, rotate } from './game'
import { pushFrame, showExitConfirm } from './renderer'

let startGameFn: () => void = () => {}

export function setStartGame(fn: () => void): void {
  startGameFn = fn
}

const SCROLL_COOLDOWN_MS = 150
let lastScrollTime = 0

function scrollThrottled(): boolean {
  const now = Date.now()
  if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return true
  lastScrollTime = now
  return false
}

// ---------------------------------------------------------------------------
// Event normalisation
// ---------------------------------------------------------------------------

export function resolveEventType(event: EvenHubEvent): OsEventTypeList | undefined {
  const raw =
    event.listEvent?.eventType ??
    event.textEvent?.eventType ??
    event.sysEvent?.eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).eventType ??
    ((event.jsonData ?? {}) as Record<string, unknown>).event_type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).Event_Type ??
    ((event.jsonData ?? {}) as Record<string, unknown>).type

  if (typeof raw === 'number') {
    switch (raw) {
      case 0: return OsEventTypeList.CLICK_EVENT
      case 1: return OsEventTypeList.SCROLL_TOP_EVENT
      case 2: return OsEventTypeList.SCROLL_BOTTOM_EVENT
      case 3: return OsEventTypeList.DOUBLE_CLICK_EVENT
      default: return undefined
    }
  }

  if (typeof raw === 'string') {
    const v = raw.toUpperCase()
    if (v.includes('DOUBLE')) return OsEventTypeList.DOUBLE_CLICK_EVENT
    if (v.includes('CLICK')) return OsEventTypeList.CLICK_EVENT
    if (v.includes('SCROLL_TOP') || v.includes('UP')) return OsEventTypeList.SCROLL_TOP_EVENT
    if (v.includes('SCROLL_BOTTOM') || v.includes('DOWN')) return OsEventTypeList.SCROLL_BOTTOM_EVENT
  }

  if (event.listEvent || event.textEvent || event.sysEvent) return OsEventTypeList.CLICK_EVENT

  return undefined
}

function readListIndex(event: EvenHubEvent): number {
  const idx = event.listEvent?.currentSelectItemIndex
  if (typeof idx !== 'number' || idx < 0) return 0
  return idx
}

// ---------------------------------------------------------------------------
// Confirm-screen handlers
// ---------------------------------------------------------------------------

function cancelExit(): void {
  game.confirmingExit = false
  appendEventLog('ACTION: exit cancelled, resuming')
  void pushFrame()
}

function confirmExit(): void {
  game.confirmingExit = false
  game.running = false
  game.quit = true
  updateHighScore()
  appendEventLog('ACTION: exit confirmed')
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function onEvenHubEvent(event: EvenHubEvent): void {
  const eventType = resolveEventType(event)
  appendEventLog(`Event: type=${String(eventType)} running=${game.running} confirming=${game.confirmingExit}`)

  // While the confirm page is shown, route everything to its handler.
  if (game.confirmingExit) {
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      cancelExit()
      return
    }
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      const idx = readListIndex(event)
      if (idx === 1) confirmExit()
      else cancelExit()
    }
    return
  }

  switch (eventType) {
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      if (game.running) {
        game.confirmingExit = true
        void showExitConfirm()
      } else {
        void bridge?.shutDownPageContainer(1)
      }
      break

    case OsEventTypeList.CLICK_EVENT:
      if (game.running) {
        rotate()
      } else {
        startGameFn()
      }
      break

    case OsEventTypeList.SCROLL_TOP_EVENT:
      if (!scrollThrottled() && game.running) moveLeft()
      break

    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      if (!scrollThrottled() && game.running) moveRight()
      break

    default:
      appendEventLog(`UNHANDLED: eventType=${String(eventType)}`)
      break
  }
}
