// Pure Guess the Imposter logic. Multiplayer only (pass-and-play).
// Roles and words are held here and never reach the public view until the result phase.
// Civilians win ONLY on a clean, non-tied vote that lands on an imposter - a tie lets the
// imposters escape.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const PHASES = ['reveal', 'discuss', 'vote', 'result'];

export function maxImpostersFor(playerCount) {
  // Always leave the civilians in the majority.
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

export function createState({ playerCount, imposterCount = 1, names, word, decoy, imposterIndexes }) {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`playerCount must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }
  if (!Number.isInteger(imposterCount) || imposterCount < 1 || imposterCount > maxImpostersFor(playerCount)) {
    throw new Error(`imposterCount must be 1-${maxImpostersFor(playerCount)} for ${playerCount} players`);
  }
  if (!Array.isArray(names) || names.length !== playerCount) {
    throw new Error('names must have one entry per player');
  }
  if (!word || !decoy) throw new Error('word and decoy are required');
  if (!Array.isArray(imposterIndexes) || imposterIndexes.length !== imposterCount) {
    throw new Error('imposterIndexes must match imposterCount');
  }
  if (new Set(imposterIndexes).size !== imposterIndexes.length) {
    throw new Error('imposterIndexes must be unique');
  }
  if (imposterIndexes.some((i) => !Number.isInteger(i) || i < 0 || i >= playerCount)) {
    throw new Error('imposterIndexes out of range');
  }

  return {
    playerCount,
    imposterCount,
    names: names.slice(),
    word,
    decoy,
    imposterIndexes: imposterIndexes.slice(),
    phase: 'reveal',
    revealed: [],
    votes: {},
    result: null,
  };
}

/** The card a given seat sees. Imposters get the decoy and are NOT told they are the imposter. */
export function wordFor(state, playerIndex) {
  if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= state.playerCount) {
    throw new Error('playerIndex out of range');
  }
  return state.imposterIndexes.includes(playerIndex) ? state.decoy : state.word;
}

export function tally(state) {
  const counts = Array(state.playerCount).fill(0);
  for (const target of Object.values(state.votes)) counts[target] += 1;
  const max = Math.max(...counts);
  const topIndexes = counts.map((c, i) => (c === max && max > 0 ? i : null)).filter((i) => i !== null);
  return { counts, max, topIndexes };
}

function resultOf(state) {
  const { counts, topIndexes } = tally(state);
  const tie = topIndexes.length !== 1;
  const ejected = tie ? null : topIndexes[0];
  const caught = ejected !== null && state.imposterIndexes.includes(ejected);
  return {
    counts,
    tie,
    ejected,
    caught,
    winner: caught ? 'civilians' : 'imposters',
  };
}

export function applyMove(state, move) {
  const type = move?.type;

  if (type === 'reveal') {
    if (state.phase !== 'reveal') throw new Error('not in the reveal phase');
    const i = move.playerIndex;
    if (!Number.isInteger(i) || i < 0 || i >= state.playerCount) throw new Error('playerIndex out of range');
    if (state.revealed.includes(i)) throw new Error('that card was already revealed');
    const revealed = [...state.revealed, i];
    return { ...state, revealed, phase: revealed.length === state.playerCount ? 'discuss' : 'reveal' };
  }

  if (type === 'startVote') {
    if (state.phase !== 'discuss') throw new Error('not in the discuss phase');
    return { ...state, phase: 'vote' };
  }

  if (type === 'vote') {
    if (state.phase !== 'vote') throw new Error('not in the vote phase');
    const { voterIndex, targetIndex } = move;
    for (const [label, v] of [['voterIndex', voterIndex], ['targetIndex', targetIndex]]) {
      if (!Number.isInteger(v) || v < 0 || v >= state.playerCount) throw new Error(`${label} out of range`);
    }
    if (voterIndex === targetIndex) throw new Error('you cannot vote for yourself');
    if (Object.prototype.hasOwnProperty.call(state.votes, String(voterIndex))) {
      throw new Error('that player already voted');
    }
    const votes = { ...state.votes, [voterIndex]: targetIndex };
    const next = { ...state, votes };
    if (Object.keys(votes).length === state.playerCount) {
      return { ...next, phase: 'result', result: resultOf(next) };
    }
    return next;
  }

  throw new Error('unknown move type');
}

export function publicView(state) {
  const done = state.phase === 'result';
  return {
    mode: 'multi',
    playerCount: state.playerCount,
    imposterCount: state.imposterCount,
    names: state.names,
    phase: state.phase,
    revealed: state.revealed,
    votesCast: Object.keys(state.votes).length,
    voters: Object.keys(state.votes).map(Number),
    over: done,
    // Roles, words and the tally are secret right up until the result.
    word: done ? state.word : null,
    decoy: done ? state.decoy : null,
    imposterIndexes: done ? state.imposterIndexes : null,
    result: done ? state.result : null,
  };
}
