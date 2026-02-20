import { createTetrisActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'tetris',
  name: 'Tetris',
  pageTitle: 'Tetris',
  autoConnect: true,
  initialStatus: 'Tetris ready',
  createActions: createTetrisActions,
}

export default app
