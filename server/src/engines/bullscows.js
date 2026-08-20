// Pure Bulls & Cows logic with multiset-correct scoring, so repeated digits are handled
// properly: a digit in the guess can only be "used up" once by the secret.

export const CODE_LENGTH = 4;
export const CODE_RE = /^[0-9]{4}$/;

/**
 * Bulls = right digit, right place. Cows = right digit, wrong place, counted as a multiset
 * intersection over the non-bull positions only.
 */
export function score(secret, guess) {
  if (!CODE_RE.test(secret) || !CODE_RE.test(guess)) throw new Error('codes must be 4 digits');
  let bulls = 0;
  const secretRest = [];
  const guessRest = [];

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) bulls++;
    else {
      secretRest.push(secret[i]);
      guessRest.push(guess[i]);
    }
  }

  const counts = new Map();
  for (const d of secretRest) counts.set(d, (counts.get(d) ?? 0) + 1);

  let cows = 0;
  for (const d of guessRest) {
    const n = counts.get(d) ?? 0;
    if (n > 0) {
      cows++;
      counts.set(d, n - 1);
    }
  }

  return { bulls, cows };
}

/**
 * codes maps each player to the code their OPPONENT must crack.
 * Single player: { p1: null, p2: <server code> } - p1 cracks the server's code.
 * Multiplayer:   { p1: <p1's secret>, p2: <p2's secret> } - each cracks the other's.
 */
export function createState({ mode, codes }) {
  if (mode !== 'single' && mode !== 'multi') throw new Error('mode must be single or multi');
  if (mode === 'single') {
    if (!CODE_RE.test(codes?.p2 ?? '')) throw new Error('single player needs a 4-digit server code');
  } else {
    if (!CODE_RE.test(codes?.p1 ?? '') || !CODE_RE.test(codes?.p2 ?? '')) {
      throw new Error('multiplayer needs a 4-digit secret from both players');
    }
  }
  return {
    mode,
    codes: { p1: codes.p1 ?? null, p2: codes.p2 },
    guesses: { p1: [], p2: [] },
    turn: 'p1',
    winner: null,
    over: false,
  };
}

function targetFor(state, player) {
  return player === 'p1' ? state.codes.p2 : state.codes.p1;
}

export function applyMove(state, { player, guess }) {
  if (state.over) throw new Error('game is already over');
  if (player !== 'p1' && player !== 'p2') throw new Error('player must be p1 or p2');
  if (state.mode === 'single' && player !== 'p1') throw new Error('single player: only p1 may guess');
  if (state.turn !== player) throw new Error(`it is ${state.turn}'s turn`);

  const g = String(guess ?? '');
  if (!CODE_RE.test(g)) throw new Error('guess must be exactly 4 digits');

  const result = score(targetFor(state, player), g);
  const guesses = { ...state.guesses, [player]: [...state.guesses[player], { guess: g, ...result }] };
  const solved = result.bulls === CODE_LENGTH;

  return {
    ...state,
    guesses,
    // Single player has no opponent to pass to; multiplayer alternates.
    turn: state.mode === 'single' ? 'p1' : player === 'p1' ? 'p2' : 'p1',
    winner: solved ? player : null,
    over: solved,
  };
}

export function publicView(state) {
  return {
    mode: state.mode,
    codeLength: CODE_LENGTH,
    guesses: state.guesses,
    attempts: { p1: state.guesses.p1.length, p2: state.guesses.p2.length },
    turn: state.turn,
    winner: state.winner,
    over: state.over,
    // Codes stay hidden until somebody cracks one.
    codes: state.over ? state.codes : null,
  };
}
