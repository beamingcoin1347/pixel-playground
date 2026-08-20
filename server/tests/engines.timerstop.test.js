import { describe, it, expect } from 'vitest';
import { createState, applyMove, publicView, scoreAttempt, totalsOf } from '../src/engines/timerstop.js';

describe('timer stop scoring', () => {
  it('scores stop-the-clock by absolute error', () => {
    expect(scoreAttempt('stopTheClock', { targetMs: 5000 }, 5200)).toEqual({ bust: false, errorMs: 200, points: 800 });
  });

  it('scores perfect-ten the same way against a 10s target', () => {
    expect(scoreAttempt('perfectTen', { targetMs: 10000 }, 9900)).toEqual({ bust: false, errorMs: 100, points: 900 });
  });

  it('busts a green-light tap made before the light', () => {
    expect(scoreAttempt('greenLight', { greenAtMs: 2000 }, 1500)).toEqual({ bust: true, errorMs: null, points: 0 });
  });

  it('scores green-light by reaction time after the light', () => {
    expect(scoreAttempt('greenLight', { greenAtMs: 2000 }, 2250)).toEqual({ bust: false, errorMs: 250, points: 750 });
  });

  it('floors points at zero for a wild miss', () => {
    expect(scoreAttempt('stopTheClock', { targetMs: 5000 }, 30000).points).toBe(0);
  });
});

describe('timer stop engine', () => {
  it('validates the reported elapsed time', () => {
    const state = createState({ mode: 'single', variant: 'stopTheClock', config: { targetMs: 5000 }, rounds: 1 });
    expect(() => applyMove(state, { player: 'p1', elapsedMs: -1 })).toThrow(/elapsedMs/);
    expect(() => applyMove(state, { player: 'p1', elapsedMs: 999999 })).toThrow(/elapsedMs/);
    expect(() => applyMove(state, { player: 'p1', elapsedMs: 'soon' })).toThrow(/elapsedMs/);
  });

  it('requires a config appropriate to the variant', () => {
    expect(() => createState({ mode: 'single', variant: 'greenLight', config: { targetMs: 1 } })).toThrow(/greenAtMs/);
    expect(() => createState({ mode: 'single', variant: 'nope', config: {} })).toThrow(/variant/);
  });

  it('finishes single player after the configured rounds', () => {
    let state = createState({ mode: 'single', variant: 'stopTheClock', config: { targetMs: 5000 }, rounds: 2 });
    state = applyMove(state, { player: 'p1', elapsedMs: 5000 });
    expect(state.over).toBe(false);
    state = applyMove(state, { player: 'p1', elapsedMs: 5100 });
    expect(state.over).toBe(true);
    expect(totalsOf(state).p1).toBe(1900);
  });

  it('alternates turns in multiplayer and the higher total wins', () => {
    let state = createState({ mode: 'multi', variant: 'stopTheClock', config: { targetMs: 5000 }, rounds: 1 });
    state = applyMove(state, { player: 'p1', elapsedMs: 5000 });
    expect(state.turn).toBe('p2');
    expect(state.over).toBe(false);
    state = applyMove(state, { player: 'p2', elapsedMs: 5500 });
    expect(state.over).toBe(true);
    expect(state.winner).toBe('p1');
    expect(publicView(state).totals).toEqual({ p1: 1000, p2: 500 });
  });

  it('calls an exact multiplayer draw a tie', () => {
    let state = createState({ mode: 'multi', variant: 'stopTheClock', config: { targetMs: 5000 }, rounds: 1 });
    state = applyMove(state, { player: 'p1', elapsedMs: 5100 });
    state = applyMove(state, { player: 'p2', elapsedMs: 4900 });
    expect(state.winner).toBe('tie');
  });

  it('refuses a move out of turn', () => {
    const state = createState({ mode: 'multi', variant: 'perfectTen', config: { targetMs: 10000 }, rounds: 1 });
    expect(() => applyMove(state, { player: 'p2', elapsedMs: 10000 })).toThrow(/p1's turn/);
  });
});
