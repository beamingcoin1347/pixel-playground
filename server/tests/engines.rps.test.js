import { describe, it, expect } from 'vitest';
import { createState, applyMove, publicView, beats } from '../src/engines/rps.js';
import { chooseThrow, WARMUP_ROUNDS } from '../src/ai/rpsBot.js';

describe('rock-paper-scissors engine', () => {
  it('knows what beats what', () => {
    expect(beats('rock', 'scissors')).toBe(true);
    expect(beats('scissors', 'rock')).toBe(false);
    expect(beats('paper', 'rock')).toBe(true);
  });

  it('holds the first throw of a round without revealing it', () => {
    const state = applyMove(createState({ mode: 'multi' }), { player: 'p1', choice: 'rock' });
    expect(state.rounds).toHaveLength(0);
    const view = publicView(state);
    expect(view.pendingPlayer).toBe('p1');
    expect(JSON.stringify(view)).not.toContain('rock');
  });

  it('resolves a round and awards a point', () => {
    let state = createState({ mode: 'multi' });
    state = applyMove(state, { player: 'p1', choice: 'rock' });
    state = applyMove(state, { player: 'p2', choice: 'scissors' });
    expect(state.scores).toEqual({ p1: 1, p2: 0 });
    expect(state.rounds[0]).toEqual({ p1: 'rock', p2: 'scissors', winner: 'p1' });
    expect(state.pending).toBeNull();
  });

  it('scores a tie round to nobody', () => {
    let state = createState({ mode: 'multi' });
    state = applyMove(state, { player: 'p1', choice: 'paper' });
    state = applyMove(state, { player: 'p2', choice: 'paper' });
    expect(state.scores).toEqual({ p1: 0, p2: 0 });
    expect(state.rounds[0].winner).toBeNull();
  });

  it('ends the match when a player reaches the target', () => {
    let state = createState({ mode: 'multi', target: 2 });
    for (let i = 0; i < 2; i++) {
      state = applyMove(state, { player: 'p1', choice: 'rock' });
      state = applyMove(state, { player: 'p2', choice: 'scissors' });
    }
    expect(state.winner).toBe('p1');
    expect(publicView(state).over).toBe(true);
    expect(() => applyMove(state, { player: 'p1', choice: 'rock' })).toThrow(/already over/);
  });

  it('refuses a second throw from the same player in one round', () => {
    const state = applyMove(createState({ mode: 'multi' }), { player: 'p1', choice: 'rock' });
    expect(() => applyMove(state, { player: 'p1', choice: 'paper' })).toThrow(/already threw/);
  });

  it('rejects an invalid throw and an invalid target', () => {
    expect(() => applyMove(createState({ mode: 'multi' }), { player: 'p1', choice: 'lizard' })).toThrow(/choice/);
    expect(() => createState({ mode: 'multi', target: 99 })).toThrow(/target/);
  });
});

describe('rps bot', () => {
  it('throws randomly during the warm-up', () => {
    const state = createState({ mode: 'single' });
    expect(chooseThrow(state, () => 0)).toBe('rock');
    expect(state.history.p1.length).toBeLessThan(WARMUP_ROUNDS);
  });

  it('counters the most frequent throw once warmed up', () => {
    const state = { ...createState({ mode: 'single' }), history: { p1: ['rock', 'rock', 'rock'], p2: [] } };
    expect(chooseThrow(state, () => 0)).toBe('paper');
  });

  it('counters scissors with rock', () => {
    const state = { ...createState({ mode: 'single' }), history: { p1: ['scissors', 'scissors', 'paper'], p2: [] } };
    expect(chooseThrow(state, () => 0)).toBe('rock');
  });
});
