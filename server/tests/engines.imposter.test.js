import { describe, it, expect } from 'vitest';
import { createState, applyMove, publicView, wordFor, maxImpostersFor } from '../src/engines/imposter.js';

const make = (playerCount, imposterIndexes, imposterCount = imposterIndexes.length) =>
  createState({
    playerCount,
    imposterCount,
    names: Array.from({ length: playerCount }, (_, i) => `P${i + 1}`),
    word: 'beach',
    decoy: 'desert',
    imposterIndexes,
  });

const revealAll = (state) => {
  for (let i = 0; i < state.playerCount; i++) state = applyMove(state, { type: 'reveal', playerIndex: i });
  return state;
};

const castVotes = (state, votes) => {
  for (const [voterIndex, targetIndex] of votes) state = applyMove(state, { type: 'vote', voterIndex, targetIndex });
  return state;
};

describe('imposter setup', () => {
  it('keeps civilians in the majority', () => {
    expect(maxImpostersFor(3)).toBe(1);
    expect(maxImpostersFor(6)).toBe(2);
    expect(maxImpostersFor(10)).toBe(4);
  });

  it('validates the player count and imposter count', () => {
    expect(() => make(2, [0])).toThrow(/playerCount/);
    expect(() => make(11, [0])).toThrow(/playerCount/);
    expect(() => createState({ playerCount: 3, imposterCount: 2, names: ['a', 'b', 'c'], word: 'x', decoy: 'y', imposterIndexes: [0, 1] })).toThrow(/imposterCount/);
  });

  it('gives the decoy to imposters and the real word to everyone else', () => {
    const state = make(3, [1]);
    expect(wordFor(state, 0)).toBe('beach');
    expect(wordFor(state, 1)).toBe('desert');
    expect(wordFor(state, 2)).toBe('beach');
  });
});

describe('imposter phases', () => {
  it('moves from reveal to discuss once every card is seen', () => {
    let state = make(3, [1]);
    state = applyMove(state, { type: 'reveal', playerIndex: 0 });
    expect(state.phase).toBe('reveal');
    state = applyMove(state, { type: 'reveal', playerIndex: 1 });
    state = applyMove(state, { type: 'reveal', playerIndex: 2 });
    expect(state.phase).toBe('discuss');
  });

  it('refuses to reveal the same card twice', () => {
    const state = applyMove(make(3, [1]), { type: 'reveal', playerIndex: 0 });
    expect(() => applyMove(state, { type: 'reveal', playerIndex: 0 })).toThrow(/already revealed/);
  });

  it('will not start a vote before the discussion', () => {
    expect(() => applyMove(make(3, [1]), { type: 'startVote' })).toThrow(/discuss phase/);
  });

  it('rejects a self-vote and a double vote', () => {
    let state = applyMove(revealAll(make(3, [1])), { type: 'startVote' });
    expect(() => applyMove(state, { type: 'vote', voterIndex: 0, targetIndex: 0 })).toThrow(/vote for yourself/);
    state = applyMove(state, { type: 'vote', voterIndex: 0, targetIndex: 1 });
    expect(() => applyMove(state, { type: 'vote', voterIndex: 0, targetIndex: 2 })).toThrow(/already voted/);
  });

  it('hides roles and words until the result', () => {
    const state = applyMove(revealAll(make(3, [1])), { type: 'startVote' });
    const view = publicView(state);
    expect(view.imposterIndexes).toBeNull();
    expect(view.word).toBeNull();
    expect(JSON.stringify(view)).not.toContain('desert');
  });
});

describe('imposter outcomes', () => {
  it('civilians win on a clean vote that lands on an imposter', () => {
    let state = applyMove(revealAll(make(3, [1])), { type: 'startVote' });
    state = castVotes(state, [[0, 1], [1, 0], [2, 1]]);
    expect(state.phase).toBe('result');
    expect(state.result.ejected).toBe(1);
    expect(state.result.caught).toBe(true);
    expect(state.result.winner).toBe('civilians');
  });

  it('imposters escape a tied vote', () => {
    let state = applyMove(revealAll(make(4, [3])), { type: 'startVote' });
    state = castVotes(state, [[0, 1], [1, 0], [2, 3], [3, 2]]);
    expect(state.result.tie).toBe(true);
    expect(state.result.ejected).toBeNull();
    expect(state.result.winner).toBe('imposters');
  });

  it('imposters win when the vote ejects a civilian', () => {
    let state = applyMove(revealAll(make(3, [2])), { type: 'startVote' });
    state = castVotes(state, [[0, 1], [1, 0], [2, 1]]);
    expect(state.result.ejected).toBe(1);
    expect(state.result.caught).toBe(false);
    expect(state.result.winner).toBe('imposters');
  });

  it('reveals everything once the result is in', () => {
    let state = applyMove(revealAll(make(3, [1])), { type: 'startVote' });
    state = castVotes(state, [[0, 1], [1, 0], [2, 1]]);
    const view = publicView(state);
    expect(view.word).toBe('beach');
    expect(view.decoy).toBe('desert');
    expect(view.imposterIndexes).toEqual([1]);
    expect(view.over).toBe(true);
  });

  it('rejects an unknown move type', () => {
    expect(() => applyMove(make(3, [1]), { type: 'dance' })).toThrow(/unknown move type/);
  });
});
