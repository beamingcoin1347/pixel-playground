import { describe, it, expect } from 'vitest';
import { createRng, rngInt, rngPick, rngShuffle } from '../src/rng.js';

describe('seedable rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('stays inside [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('rngInt stays in range', () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const v = rngInt(rng, 10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('rngPick returns a member and rejects an empty list', () => {
    expect(['a', 'b', 'c']).toContain(rngPick(createRng(3), ['a', 'b', 'c']));
    expect(() => rngPick(createRng(3), [])).toThrow(/empty/);
  });

  it('rngShuffle permutes without losing or duplicating members', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7];
    const out = rngShuffle(createRng(5), input);
    expect(out).toHaveLength(input.length);
    expect(out.slice().sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // input untouched
  });
});
