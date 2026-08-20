import { describe, it, expect } from 'vitest';
import { createState, applyMove, publicView, maskOf, MAX_LIVES } from '../src/engines/hangman.js';

const start = (word = 'penguin') => createState({ mode: 'single', word, category: 'animals' });

describe('hangman engine', () => {
  it('masks every unguessed letter', () => {
    expect(maskOf('cat', ['c'])).toEqual(['c', null, null]);
  });

  it('reveals every occurrence of a correct letter without costing a life', () => {
    const state = applyMove(start('noodles'), { letter: 'o' });
    expect(publicView(state).mask).toEqual([null, 'o', 'o', null, null, null, null]);
    expect(state.lives).toBe(MAX_LIVES);
  });

  it('costs a life for a wrong letter', () => {
    const state = applyMove(start('penguin'), { letter: 'z' });
    expect(state.lives).toBe(MAX_LIVES - 1);
    expect(state.over).toBe(false);
  });

  it('rejects a repeated guess and a non-letter', () => {
    const state = applyMove(start(), { letter: 'p' });
    expect(() => applyMove(state, { letter: 'p' })).toThrow(/already guessed/);
    expect(() => applyMove(state, { letter: '4' })).toThrow(/single a-z/);
  });

  it('wins when the whole word is revealed', () => {
    let state = start('cat');
    for (const letter of ['c', 'a', 't']) state = applyMove(state, { letter });
    expect(state.won).toBe(true);
    expect(state.over).toBe(true);
  });

  it('loses after six wrong guesses', () => {
    let state = start('cat');
    for (const letter of ['x', 'y', 'z', 'q', 'w', 'v']) state = applyMove(state, { letter });
    expect(state.lives).toBe(0);
    expect(state.over).toBe(true);
    expect(state.won).toBe(false);
  });

  it('keeps the word secret until the round ends', () => {
    const mid = applyMove(start('penguin'), { letter: 'p' });
    expect(publicView(mid).word).toBeNull();
    expect(JSON.stringify(publicView(mid))).not.toContain('penguin');

    let done = start('cat');
    for (const letter of ['c', 'a', 't']) done = applyMove(done, { letter });
    expect(publicView(done).word).toBe('cat');
  });

  it('validates a player-supplied secret word', () => {
    expect(() => createState({ mode: 'multi', word: 'a' })).toThrow(/2-20 letters/);
    expect(() => createState({ mode: 'multi', word: 'hello world' })).toThrow(/2-20 letters/);
    expect(createState({ mode: 'multi', word: 'Puzzle' }).word).toBe('puzzle');
  });

  it('refuses moves after the game is over', () => {
    let state = start('cat');
    for (const letter of ['c', 'a', 't']) state = applyMove(state, { letter });
    expect(() => applyMove(state, { letter: 'b' })).toThrow(/already over/);
  });
});
