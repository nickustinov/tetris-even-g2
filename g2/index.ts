import { createBlocksActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'blocks',
  name: 'Blocks',
  pageTitle: 'Blocks',
  autoConnect: true,
  initialStatus: 'Blocks ready',
  createActions: createBlocksActions,
}

export default app
