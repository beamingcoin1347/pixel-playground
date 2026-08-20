// Tic-Tac-Toe bots. easy = random, medium = win -> block -> centre, hard = full minimax
// (provably unbeatable). All randomness comes from the session rng so seeded games repeat.

import { LINES, winnerOf, isFull } from '../engines/tictactoe.js';

function available(board) {
  const out = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) out.push(i);
  return out;
}

/** The index that completes a line for `mark`, or null. */
function completing(board, mark) {
  for (const line of LINES) {
    const cells = line.map((i) => board[i]);
    if (cells.filter((c) => c === mark).length === 2 && cells.includes(null)) {
      return line[cells.indexOf(null)];
    }
  }
  return null;
}

function minimax(board, toMove, me) {
  const win = winnerOf(board);
  if (win) return { score: win.winner === me ? 1 : -1, index: null };
  if (isFull(board)) return { score: 0, index: null };

  let best = null;
  for (const i of available(board)) {
    const next = board.slice();
    next[i] = toMove;
    const { score } = minimax(next, toMove === 'X' ? 'O' : 'X', me);
    const better = best === null || (toMove === me ? score > best.score : score < best.score);
    if (better) best = { score, index: i };
    // Perfect play is already decided; stop early.
    if (toMove === me && best.score === 1) break;
    if (toMove !== me && best.score === -1) break;
  }
  return best;
}

export function chooseMove(state, rng) {
  const { board, turn: me, difficulty } = state;
  const options = available(board);
  if (!options.length) return null;

  if (difficulty === 'easy') {
    return options[Math.floor(rng() * options.length)];
  }

  if (difficulty === 'medium') {
    const opponent = me === 'X' ? 'O' : 'X';
    // `??` not `||` - index 0 is a legal move and would be swallowed by a truthiness check.
    const win = completing(board, me);
    if (win !== null) return win;
    const block = completing(board, opponent);
    if (block !== null) return block;
    if (board[4] === null) return 4;
    return options[Math.floor(rng() * options.length)];
  }

  return minimax(board, me, me).index;
}
