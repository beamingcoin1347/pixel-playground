// Pure Tic-Tac-Toe logic: state + move -> new state. No I/O, no randomness.

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export function createState({ mode, difficulty = 'medium' }) {
  if (mode !== 'single' && mode !== 'multi') throw new Error('mode must be single or multi');
  if (mode === 'single' && !DIFFICULTIES.includes(difficulty)) {
    throw new Error(`difficulty must be one of ${DIFFICULTIES.join(', ')}`);
  }
  return {
    board: Array(9).fill(null),
    turn: 'X',
    winner: null,
    line: null,
    draw: false,
    mode,
    difficulty: mode === 'single' ? difficulty : null,
  };
}

export function winnerOf(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

export function isFull(board) {
  return board.every((cell) => cell !== null);
}

export function applyMove(state, { index, player }) {
  if (state.winner || state.draw) throw new Error('game is already over');
  if (!Number.isInteger(index) || index < 0 || index > 8) throw new Error('index must be 0-8');
  if (state.board[index] !== null) throw new Error('cell already taken');
  if (player && player !== state.turn) throw new Error(`it is ${state.turn}'s turn`);

  const board = state.board.slice();
  board[index] = state.turn;
  const win = winnerOf(board);

  return {
    ...state,
    board,
    turn: state.turn === 'X' ? 'O' : 'X',
    winner: win ? win.winner : null,
    line: win ? win.line : null,
    draw: !win && isFull(board),
  };
}

// Tic-Tac-Toe holds no secrets, so the public view is the whole state plus a convenience flag.
export function publicView(state) {
  return {
    board: state.board,
    turn: state.turn,
    winner: state.winner,
    line: state.line,
    draw: state.draw,
    mode: state.mode,
    difficulty: state.difficulty,
    over: Boolean(state.winner) || state.draw,
  };
}
