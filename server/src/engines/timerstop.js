// Pure Timer Stop (reaction) logic. Per the spec, the *timing* is measured client-side with
// performance.now(); this module owns the config, the scoring, and the validation of whatever
// the client reports. Points are "higher is better" so multiplayer can simply compare totals.

export const VARIANTS = ['stopTheClock', 'perfectTen', 'greenLight'];
export const MAX_ELAPSED_MS = 120000;

export function createState({ mode, variant, config, rounds = 3 }) {
  if (mode !== 'single' && mode !== 'multi') throw new Error('mode must be single or multi');
  if (!VARIANTS.includes(variant)) throw new Error(`variant must be one of ${VARIANTS.join(', ')}`);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) throw new Error('rounds must be 1-10');

  if (variant === 'greenLight') {
    if (!Number.isFinite(config?.greenAtMs)) throw new Error('greenLight needs config.greenAtMs');
  } else if (!Number.isFinite(config?.targetMs)) {
    throw new Error(`${variant} needs config.targetMs`);
  }

  return {
    mode,
    variant,
    config,
    rounds,
    players: mode === 'single' ? ['p1'] : ['p1', 'p2'],
    turn: 'p1',
    results: { p1: [], p2: [] },
    over: false,
    winner: null,
  };
}

/** Pure scoring for one attempt. Exported so the unit tests can hit it directly. */
export function scoreAttempt(variant, config, elapsedMs) {
  if (variant === 'greenLight') {
    if (elapsedMs < config.greenAtMs) {
      return { bust: true, errorMs: null, points: 0 }; // tapped before the light went green
    }
    const reactionMs = elapsedMs - config.greenAtMs;
    return { bust: false, errorMs: reactionMs, points: Math.max(0, Math.round(1000 - reactionMs)) };
  }
  const errorMs = Math.abs(elapsedMs - config.targetMs);
  return { bust: false, errorMs, points: Math.max(0, Math.round(1000 - errorMs)) };
}

export function totalsOf(state) {
  return {
    p1: state.results.p1.reduce((sum, r) => sum + r.points, 0),
    p2: state.results.p2.reduce((sum, r) => sum + r.points, 0),
  };
}

export function applyMove(state, { player, elapsedMs }) {
  if (state.over) throw new Error('game is already over');
  if (!state.players.includes(player)) throw new Error(`player must be one of ${state.players.join(', ')}`);
  if (state.turn !== player) throw new Error(`it is ${state.turn}'s turn`);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_ELAPSED_MS) {
    throw new Error(`elapsedMs must be a number between 0 and ${MAX_ELAPSED_MS}`);
  }

  const attempt = scoreAttempt(state.variant, state.config, elapsedMs);
  const results = {
    ...state.results,
    [player]: [...state.results[player], { elapsedMs, ...attempt }],
  };

  const next = { ...state, results };
  const complete = next.players.every((p) => results[p].length >= state.rounds);

  if (complete) {
    const totals = totalsOf(next);
    let winner = 'p1';
    if (state.mode === 'multi') {
      winner = totals.p1 === totals.p2 ? 'tie' : totals.p1 > totals.p2 ? 'p1' : 'p2';
    }
    return { ...next, over: true, winner, turn: player };
  }

  // Multiplayer alternates turns; single player keeps going.
  const turn = state.mode === 'single' ? 'p1' : player === 'p1' ? 'p2' : 'p1';
  return { ...next, turn };
}

export function publicView(state) {
  return {
    mode: state.mode,
    variant: state.variant,
    // The client needs the config to render the clock / light, and the spec puts timing on the
    // client, so there is nothing secret here to withhold.
    config: state.config,
    rounds: state.rounds,
    players: state.players,
    turn: state.turn,
    results: state.results,
    totals: totalsOf(state),
    over: state.over,
    winner: state.winner,
  };
}
