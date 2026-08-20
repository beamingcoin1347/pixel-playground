// Pure Rock-Paper-Scissors logic. First to `target` round wins takes the match.
// A round resolves only once both players have locked a throw in, which is what makes
// pass-and-play secret picks possible: the pending throw never enters the public view.

export const THROWS = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export function beats(a, b) {
  return BEATS[a] === b;
}

export function createState({ mode, target = 3 }) {
  if (mode !== 'single' && mode !== 'multi') throw new Error('mode must be single or multi');
  if (!Number.isInteger(target) || target < 1 || target > 10) throw new Error('target must be 1-10');
  return {
    mode,
    target,
    scores: { p1: 0, p2: 0 },
    rounds: [],
    history: { p1: [], p2: [] },
    pending: null,
    winner: null,
  };
}

export function applyMove(state, { player, choice }) {
  if (state.winner) throw new Error('match is already over');
  if (player !== 'p1' && player !== 'p2') throw new Error('player must be p1 or p2');
  if (!THROWS.includes(choice)) throw new Error(`choice must be one of ${THROWS.join(', ')}`);
  if (state.pending && state.pending.player === player) throw new Error('you already threw this round');

  // First throw of the round: hold it, reveal nothing.
  if (!state.pending) {
    return { ...state, pending: { player, choice } };
  }

  const throws = { [state.pending.player]: state.pending.choice, [player]: choice };
  let roundWinner = null;
  if (throws.p1 !== throws.p2) roundWinner = beats(throws.p1, throws.p2) ? 'p1' : 'p2';

  const scores = { ...state.scores };
  if (roundWinner) scores[roundWinner] += 1;

  return {
    ...state,
    scores,
    rounds: [...state.rounds, { p1: throws.p1, p2: throws.p2, winner: roundWinner }],
    history: { p1: [...state.history.p1, throws.p1], p2: [...state.history.p2, throws.p2] },
    pending: null,
    winner: scores.p1 >= state.target ? 'p1' : scores.p2 >= state.target ? 'p2' : null,
  };
}

export function publicView(state) {
  return {
    mode: state.mode,
    target: state.target,
    scores: state.scores,
    rounds: state.rounds,
    // Only *who* has locked in - never what they picked.
    pendingPlayer: state.pending ? state.pending.player : null,
    winner: state.winner,
    over: Boolean(state.winner),
  };
}
