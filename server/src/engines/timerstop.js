// Pure Timer Stop (reaction) logic. Per the spec, the *timing* is measured client-side with
// performance.now(); this module owns the config, the scoring, and the validation of whatever
// the client reports. Points are "higher is better" so multiplayer can simply compare totals.
//
// Two variations measure genuinely different things, and say so in the result they return:
//   stopTheClock / blindStop -> errorMs   (how far off the target you stopped)
//   greenLight               -> reactionMs (how fast you answered the light)
// Collapsing both into one "error" field is what made the Green Light table read wrong.

export const VARIANTS = ['stopTheClock', 'blindStop', 'greenLight'];
export const MAX_ELAPSED_MS = 120000;

/** What each variation measures - the client uses this to label its columns honestly. */
export const MEASURES = {
  stopTheClock: 'errorMs',
  blindStop: 'errorMs',
  greenLight: 'reactionMs',
};

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

/**
 * Pure scoring for one attempt. The shape differs by variation on purpose:
 * green light returns reactionMs (time AFTER the light), the others return errorMs
 * (distance from the target, in either direction).
 */
export function scoreAttempt(variant, config, elapsedMs) {
  if (variant === 'greenLight') {
    if (elapsedMs < config.greenAtMs) {
      // Jumped the light. There is no reaction time to report - there was nothing to react to.
      return { bust: true, reactionMs: null, points: 0 };
    }
    const reactionMs = elapsedMs - config.greenAtMs;
    return { bust: false, reactionMs, points: Math.max(0, Math.round(1000 - reactionMs)) };
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

/** Best single attempt for a player - null until they have taken one that wasn't a bust. */
export function bestOf(state, player) {
  const scored = state.results[player].filter((r) => !r.bust);
  if (!scored.length) return null;
  const measure = MEASURES[state.variant];
  return scored.reduce((best, r) => (r[measure] < best[measure] ? r : best));
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

  const turn = state.mode === 'single' ? 'p1' : player === 'p1' ? 'p2' : 'p1';
  return { ...next, turn };
}

export function publicView(state) {
  return {
    mode: state.mode,
    variant: state.variant,
    // What this variation measures, so the client can label its own columns correctly.
    measures: MEASURES[state.variant],
    // The client needs the config to render the clock / light, and the spec puts timing on the
    // client, so there is nothing secret here to withhold.
    config: state.config,
    rounds: state.rounds,
    players: state.players,
    turn: state.turn,
    results: state.results,
    totals: totalsOf(state),
    best: { p1: bestOf(state, 'p1'), p2: bestOf(state, 'p2') },
    over: state.over,
    winner: state.winner,
  };
}
