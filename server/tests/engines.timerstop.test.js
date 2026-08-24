import { describe, it, expect } from 'vitest';
import {
  createState, applyMove, publicView, scoreAttempt, totalsOf, bestOf, MEASURES,
} from '../src/engines/timerstop.js';

describe('timer stop scoring', () => {
  it('scores stop-the-clock by absolute error, in either direction', () => {
    expect(scoreAttempt('stopTheClock', { targetMs: 5000 }, 5200)).toEqual({ bust: false, errorMs: 200, points: 800 });
    expect(scoreAttempt('stopTheClock', { targetMs: 5000 }, 4800)).toEqual({ bust: false, errorMs: 200, points: 800 });
  });

  it('scores blind-stop against whatever random target the session drew', () => {
    expect(scoreAttempt('blindStop', { targetMs: 7400 }, 7300)).toEqual({ bust: false, errorMs: 100, points: 900 });
  });

  it('reports green light as REACTION time, not error', () => {
    const attempt = scoreAttempt('greenLight', { greenAtMs: 2000 }, 2250);
    expect(attempt).toEqual({ bust: false, reactionMs: 250, points: 750 });
    // The old bug: reporting the 2250ms wall time, or calling the 250ms an "error".
    expect(attempt).not.toHaveProperty('errorMs');
  });

  it('busts a green-light tap made before the light, with no reaction to report', () => {
    expect(scoreAttempt('greenLight', { greenAtMs: 2000 }, 1500)).toEqual({ bust: true, reactionMs: null, points: 0 });
  });

  it('floors points at zero for a wild miss', () => {
    expect(scoreAttempt('stopTheClock', { targetMs: 5000 }, 30000).points).toBe(0);
    expect(scoreAttempt('greenLight', { greenAtMs: 1000 }, 30000).points).toBe(0);
  });

  it('declares what each variation measures', () => {
    expect(MEASURES).toEqual({ stopTheClock: 'errorMs', blindStop: 'errorMs', greenLight: 'reactionMs' });
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
    expect(() => createState({ mode: 'single', variant: 'blindStop', config: {} })).toThrow(/targetMs/);
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
    const state = createState({ mode: 'multi', variant: 'blindStop', config: { targetMs: 10000 }, rounds: 1 });
    expect(() => applyMove(state, { player: 'p2', elapsedMs: 10000 })).toThrow(/p1's turn/);
  });

  it('tracks the best attempt using the measure that fits the variant', () => {
    let clock = createState({ mode: 'single', variant: 'stopTheClock', config: { targetMs: 5000 }, rounds: 3 });
    clock = applyMove(clock, { player: 'p1', elapsedMs: 5400 }); // 400ms off
    clock = applyMove(clock, { player: 'p1', elapsedMs: 5050 }); // 50ms off  <- best
    clock = applyMove(clock, { player: 'p1', elapsedMs: 4700 }); // 300ms off
    expect(bestOf(clock, 'p1').errorMs).toBe(50);

    let light = createState({ mode: 'single', variant: 'greenLight', config: { greenAtMs: 1000 }, rounds: 2 });
    light = applyMove(light, { player: 'p1', elapsedMs: 500 });  // bust, ignored
    light = applyMove(light, { player: 'p1', elapsedMs: 1180 }); // 180ms reaction
    expect(bestOf(light, 'p1').reactionMs).toBe(180);
  });

  it('has no best attempt until something other than a bust is recorded', () => {
    let state = createState({ mode: 'single', variant: 'greenLight', config: { greenAtMs: 2000 }, rounds: 2 });
    expect(bestOf(state, 'p1')).toBeNull();
    state = applyMove(state, { player: 'p1', elapsedMs: 100 });
    expect(bestOf(state, 'p1')).toBeNull();
  });

  it('publishes the measure name so the client can label columns correctly', () => {
    const light = createState({ mode: 'single', variant: 'greenLight', config: { greenAtMs: 2000 }, rounds: 1 });
    expect(publicView(light).measures).toBe('reactionMs');
    const clock = createState({ mode: 'single', variant: 'stopTheClock', config: { targetMs: 5000 }, rounds: 1 });
    expect(publicView(clock).measures).toBe('errorMs');
  });
});
