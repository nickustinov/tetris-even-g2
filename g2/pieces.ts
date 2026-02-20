export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

// Each piece has 4 rotation states. Each state is an array of 4 [row, col] offsets
// relative to the piece's top-left position in its bounding box.
// I piece uses a 4x4 bounding box; all others use 3x3.

export const PIECE_CELLS: Record<PieceType, [number, number][][]> = {
  I: [
    [[1, 0], [1, 1], [1, 2], [1, 3]], // R0: horizontal
    [[0, 2], [1, 2], [2, 2], [3, 2]], // R1: vertical right
    [[2, 0], [2, 1], [2, 2], [2, 3]], // R2: horizontal lower
    [[0, 1], [1, 1], [2, 1], [3, 1]], // R3: vertical left
  ],
  O: [
    [[0, 1], [0, 2], [1, 1], [1, 2]], // all rotations identical
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
  ],
  T: [
    [[0, 1], [1, 0], [1, 1], [1, 2]], // R0: T-up
    [[0, 1], [1, 1], [1, 2], [2, 1]], // R1: T-right
    [[1, 0], [1, 1], [1, 2], [2, 1]], // R2: T-down
    [[0, 1], [1, 0], [1, 1], [2, 1]], // R3: T-left
  ],
  S: [
    [[0, 1], [0, 2], [1, 0], [1, 1]], // R0
    [[0, 1], [1, 1], [1, 2], [2, 2]], // R1
    [[1, 1], [1, 2], [2, 0], [2, 1]], // R2
    [[0, 0], [1, 0], [1, 1], [2, 1]], // R3
  ],
  Z: [
    [[0, 0], [0, 1], [1, 1], [1, 2]], // R0
    [[0, 2], [1, 1], [1, 2], [2, 1]], // R1
    [[1, 0], [1, 1], [2, 1], [2, 2]], // R2
    [[0, 1], [1, 0], [1, 1], [2, 0]], // R3
  ],
  J: [
    [[0, 0], [1, 0], [1, 1], [1, 2]], // R0
    [[0, 1], [0, 2], [1, 1], [2, 1]], // R1
    [[1, 0], [1, 1], [1, 2], [2, 2]], // R2
    [[0, 1], [1, 1], [2, 0], [2, 1]], // R3
  ],
  L: [
    [[0, 2], [1, 0], [1, 1], [1, 2]], // R0
    [[0, 1], [1, 1], [2, 1], [2, 2]], // R1
    [[1, 0], [1, 1], [1, 2], [2, 0]], // R2
    [[0, 0], [0, 1], [1, 1], [2, 1]], // R3
  ],
}

// Bounding box size per piece type
export function boxSize(type: PieceType): number {
  return type === 'I' ? 4 : 3
}
