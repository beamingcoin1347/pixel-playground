import { describe, it, expect, beforeEach } from 'vitest';
import { addScore, topScores, resetBoard } from '../src/leaderboard.js';

describe('leaderboard file store', () => {
  beforeEach(async () => {
    await resetBoard();
  });

  it('sorts bulls & cows ascending - fewer guesses is better', async () => {
    await addScore('bullscows', { name: 'ada', score: 7, unit: 'guesses' });
    await addScore('bullscows', { name: 'bob', score: 4, unit: 'guesses' });
    await addScore('bullscows', { name: 'cyd', score: 9, unit: 'guesses' });
    const scores = await topScores('bullscows');
    expect(scores.map((s) => s.name)).toEqual(['bob', 'ada', 'cyd']);
  });

  it('sorts timer stop descending - more points is better', async () => {
    await addScore('timerstop', { name: 'ada', score: 700, unit: 'points' });
    await addScore('timerstop', { name: 'bob', score: 1900, unit: 'points' });
    const scores = await topScores('timerstop');
    expect(scores.map((s) => s.name)).toEqual(['bob', 'ada']);
  });

  it('keeps only the top ten', async () => {
    for (let i = 0; i < 15; i++) {
      await addScore('bullscows', { name: `p${i}`, score: i + 1, unit: 'guesses' });
    }
    const scores = await topScores('bullscows');
    expect(scores).toHaveLength(10);
    expect(scores[0].score).toBe(1);
    expect(scores[9].score).toBe(10);
  });

  it('stamps each entry with a timestamp and returns an empty board for unknown games', async () => {
    await addScore('bullscows', { name: 'ada', score: 5, unit: 'guesses' });
    const [entry] = await topScores('bullscows');
    expect(Number.isNaN(Date.parse(entry.at))) .toBe(false);
    expect(await topScores('nosuchgame')).toEqual([]);
  });
});
