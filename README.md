# Blocks for Even G2

> See also: [G2 development notes](https://github.com/nickustinov/even-g2-notes/blob/main/G2.md) – hardware specs, UI system, input handling and practical patterns for Even Realities G2.

Block-stacking game for [Even Realities G2](https://www.evenrealities.com/) smart glasses.

Swipe to move, tap to rotate. Best score tracked locally across games.

## Architecture

The game uses three different page layouts, switching between them via `rebuildPageContainer`:

- **Splash screen** – image container with logo + text container with instructions
- **Gameplay** – text container with unicode grid (playfield left, info panel right)
- **Game over** – image container with game over graphic + text container with score

A hidden text container with `isEventCapture: 1` and minimal content (`' '`) is present on every page. This receives scroll/tap events without the firmware's internal text scrolling consuming swipe gestures.

During gameplay, only `textContainerUpgrade` is called – no page rebuilds until the game ends.

```
tick() → pushFrame() → sleep(remaining) → repeat
```

The loop awaits each text push before scheduling the next tick. If a push is still in flight, the frame is silently dropped.

### Grid

- 10-column playfield × 10 rows (left half)
- `│` separator + info panel showing next piece, score, best, lines, level (right half)
- `□` empty cells, `▦` filled cells
- 7 standard tetrominoes (I, O, T, S, Z, J, L) with SRS-like rotation
- 7-bag randomiser, wall kicks, 1-tick lock delay
- Scoring: 100/300/500/800 per 1/2/3/4 lines (× level)
- Level increases every 5 lines, gravity speeds up from 600ms to 200ms

## Controls

| Input | Action |
|---|---|
| Swipe up | Move piece left |
| Swipe down | Move piece right |
| Tap | Rotate piece (during gameplay) |
| Tap | Start game / restart (on splash / game over) |
| Double tap | Start game / restart (on splash / game over) |

## Project structure

```
g2/
  index.ts       App module registration
  main.ts        Bridge connection and auto-connect
  app.ts         Game loop orchestrator
  state.ts       Game state (board, piece, score, bag)
  game.ts        Game logic (gravity, collision, line clearing)
  pieces.ts      Tetromino definitions and rotation states
  renderer.ts    Text/image rendering, page layouts, frame push
  events.ts      Event normalisation + input dispatch
  layout.ts      Display and grid constants
  logo.png       Splash screen logo (200×100)
```

## Setup

```bash
npm install
npm run dev
```

### Run on real glasses

Generate a QR code and scan it with the Even App:

```bash
npm run dev   # keep running
npm run qr    # generates QR code for http://<your-ip>:5173
```

### Package for distribution

```bash
npm run pack  # builds and creates blocks.ehpk
```

## Tech stack

- **G2 frontend:** TypeScript + [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- **Build:** [Vite](https://vitejs.dev/)
- **CLI:** [evenhub-cli](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
