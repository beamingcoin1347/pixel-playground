import { describe, it, expect } from 'vitest';
import { createState, applyMove, publicView, score, CODE_LENGTH } from '../src/engines/bullscows.js';

describe('bulls & cows scoring', () => {
  it('scores an exact match as all bulls', () => {
    expect(score('1234', '1234')).toEqual({ bulls: 4, cows: 0 });
  });

  it('scores a full permutation as all cows', () => {
    expect(score('1234', '4321')).toEqual({ bulls: 0, cows: 4 });
  });

  it('handles repeated digits in the secret without double counting', () => {
    // secret 1123 vs guess 1231: one bull (position 0), three cows.
    expect(score('1123', '1231')).toEqual({ bulls: 1, cows: 3 });
  });

  it('does not award cows for surplus repeats in the guess', () => {
    // secret 1111 vs guess 1123: two bulls, and the 2/3 match nothing.
    expect(score('1111', '1123')).toEqual({ bulls: 2, cows: 0 });
  });

  it('scores a total miss as zero', () => {
    expect(score('1111', '2222')).toEqual({ bulls: 0, cows: 0 });
  });

  it('rejects malformed codes', () => {
    expect(() => score('123', '1234')).toThrow(/4 digits/);
    expect(() => score('12a4', '1234')).toThrow(/4 digits/);
  });
});

describe('bulls & cows engine', () => {
  const single = () => createState({ mode: 'single', codes: { p1: null, p2: '4271' } });

  it('records a guess with its score', () => {
    const state = applyMove(single(), { player: 'p1', guess: '1234' });
    expect(state.guesses.p1).toHaveLength(1);
    expect(state.guesses.p1[0].guess).toBe('1234');
    expect(state.over).toBe(false);
  });

  it('ends the game when the code is cracked', () => {
    const state = applyMove(single(), { player: 'p1', guess: '4271' });
    expect(state.guesses.p1[0].bulls).toBe(CODE_LENGTH);
    expect(state.winner).toBe('p1');
    expect(state.over).toBe(true);
  });

  it('keeps the code hidden until the game ends', () => {
    const mid = applyMove(single(), { player: 'p1', guess: '1234' });
    expect(publicView(mid).codes).toBeNull();
    expect(JSON.stringify(publicView(mid))).not.toContain('4271');
    const done = applyMove(single(), { player: 'p1', guess: '4271' });
    expect(publicView(done).codes.p2).toBe('4271');
  });

  it('rejects a malformed guess', () => {
    expect(() => applyMove(single(), { player: 'p1', guess: '12' })).toThrow(/exactly 4 digits/);
  });

  it('will not let p2 guess in single player', () => {
    expect(() => applyMove(single(), { player: 'p2', guess: '1234' })).toThrow(/only p1/);
  });

  it('alternates turns in multiplayer and each cracks the other code', () => {
    let state = createState({ mode: 'multi', codes: { p1: '1111', p2: '2222' } });
    expect(state.turn).toBe('p1');
    state = applyMove(state, { player: 'p1', guess: '2222' }); // p1 cracks p2's code
    expect(state.winner).toBe('p1');
    expect(state.over).toBe(true);

    let other = createState({ mode: 'multi', codes: { p1: '1111', p2: '2222' } });
    other = applyMove(other, { player: 'p1', guess: '0000' });
    expect(other.turn).toBe('p2');
    expect(() => applyMove(other, { player: 'p1', guess: '0000' })).toThrow(/p2's turn/);
  });

  it('requires both secrets in multiplayer', () => {
    expect(() => createState({ mode: 'multi', codes: { p1: '1111', p2: null } })).toThrow(/both players/);
  });
});
