import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { reset } from '../src/sessions.js';
import { resetBoard } from '../src/leaderboard.js';

const app = createApp({ serveClient: false });

beforeEach(async () => {
  reset();
  await resetBoard();
});

describe('api basics', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('lists all six games with their modes', async () => {
    const res = await request(app).get('/api/games').expect(200);
    expect(res.body.games).toHaveLength(6);
    const imposter = res.body.games.find((g) => g.name === 'imposter');
    expect(imposter.modes).toEqual(['multi']); // multiplayer only
  });

  it('404s an unknown game and an unknown endpoint', async () => {
    await request(app).post('/api/games/chess').send({ mode: 'single' }).expect(404);
    await request(app).get('/api/nonsense').expect(404);
  });

  it('400s an invalid mode', async () => {
    const res = await request(app).post('/api/games/tictactoe').send({ mode: 'coop' }).expect(400);
    expect(res.body.error).toMatch(/mode/);
  });

  it('404s a session that does not exist', async () => {
    await request(app).get('/api/games/tictactoe/not-a-real-id').expect(404);
  });
});

describe('session lifecycle', () => {
  it('creates a session and fetches it back by opaque id', async () => {
    const created = await request(app)
      .post('/api/games/tictactoe')
      .send({ mode: 'single', difficulty: 'hard' })
      .expect(201);
    expect(typeof created.body.gameId).toBe('string');

    const fetched = await request(app).get(`/api/games/tictactoe/${created.body.gameId}`).expect(200);
    expect(fetched.body.view.board).toEqual(Array(9).fill(null));
  });

  it('plays the bot reply on the server in single player', async () => {
    const { body } = await request(app).post('/api/games/tictactoe').send({ mode: 'single', difficulty: 'hard' });
    const res = await request(app)
      .post(`/api/games/tictactoe/${body.gameId}/move`)
      .send({ index: 0 })
      .expect(200);

    const board = res.body.view.board;
    expect(board.filter((c) => c === 'X')).toHaveLength(1);
    expect(board.filter((c) => c === 'O')).toHaveLength(1); // the bot already answered
    expect(res.body.view.turn).toBe('X');
  });

  it('rejects an illegal move with a 400', async () => {
    const { body } = await request(app).post('/api/games/tictactoe').send({ mode: 'multi' });
    await request(app).post(`/api/games/tictactoe/${body.gameId}/move`).send({ index: 0 }).expect(200);
    await request(app).post(`/api/games/tictactoe/${body.gameId}/move`).send({ index: 0 }).expect(400);
  });
});

describe('secrets never leak through the API', () => {
  it('hides the hangman word mid-round', async () => {
    const { body } = await request(app).post('/api/games/hangman').send({ mode: 'single' });
    expect(body.view.word).toBeNull();
    expect(body.view.mask.every((c) => c === null)).toBe(true);
    expect(body.view.length).toBeGreaterThan(1);
  });

  it('hides the bulls & cows code mid-game', async () => {
    const { body } = await request(app).post('/api/games/bullscows').send({ mode: 'single' });
    const res = await request(app).post(`/api/games/bullscows/${body.gameId}/move`).send({ guess: '0123' });
    expect(res.body.view.codes).toBeNull();
  });
});

describe('deterministic seeding', () => {
  it('produces identical hangman setups for the same seed', async () => {
    await request(app).post('/api/test/seed').send({ seed: 12345 }).expect(200);
    const first = await request(app).post('/api/games/hangman').send({ mode: 'single' });
    const second = await request(app).post('/api/games/hangman').send({ mode: 'single' });
    expect(second.body.view.category).toBe(first.body.view.category);
    expect(second.body.view.length).toBe(first.body.view.length);
  });

  it('rejects a non-integer seed', async () => {
    await request(app).post('/api/test/seed').send({ seed: 'abc' }).expect(400);
  });

  it('does not mount the test routes in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prodApp = createApp({ serveClient: false });
      await request(prodApp).post('/api/test/seed').send({ seed: 1 }).expect(404);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe('imposter over the API', () => {
  it('deals one decoy among the shared words and resolves a vote', async () => {
    const created = await request(app)
      .post('/api/games/imposter')
      .send({ mode: 'multi', playerCount: 3, imposterCount: 1 })
      .expect(201);
    const id = created.body.gameId;

    const cards = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/games/imposter/${id}/move`)
        .send({ type: 'reveal', playerIndex: i })
        .expect(200);
      cards.push(res.body.extra.word);
    }
    // Two civilians share a word, one imposter holds the decoy.
    expect(new Set(cards).size).toBe(2);

    const discuss = await request(app).get(`/api/games/imposter/${id}`);
    expect(discuss.body.view.phase).toBe('discuss');

    await request(app).post(`/api/games/imposter/${id}/move`).send({ type: 'startVote' }).expect(200);
    await request(app).post(`/api/games/imposter/${id}/move`).send({ type: 'vote', voterIndex: 0, targetIndex: 1 });
    await request(app).post(`/api/games/imposter/${id}/move`).send({ type: 'vote', voterIndex: 1, targetIndex: 0 });
    const final = await request(app)
      .post(`/api/games/imposter/${id}/move`)
      .send({ type: 'vote', voterIndex: 2, targetIndex: 1 })
      .expect(200);

    expect(final.body.view.phase).toBe('result');
    expect(final.body.view.result.ejected).toBe(1);
    expect(['civilians', 'imposters']).toContain(final.body.view.result.winner);
    expect(final.body.view.imposterIndexes).toHaveLength(1);
  });

  it('refuses single-player imposter', async () => {
    await request(app).post('/api/games/imposter').send({ mode: 'single', playerCount: 3 }).expect(400);
  });
});

describe('leaderboard submission is server-scored', () => {
  it('computes the score from the finished session, not the request', async () => {
    const created = await request(app)
      .post('/api/games/timerstop')
      .send({ mode: 'single', variant: 'stopTheClock', rounds: 1 })
      .expect(201);
    const { gameId, view } = created.body;

    // A perfect stop scores 1000 points.
    const done = await request(app)
      .post(`/api/games/timerstop/${gameId}/move`)
      .send({ elapsedMs: view.config.targetMs })
      .expect(200);
    expect(done.body.view.over).toBe(true);

    const posted = await request(app)
      .post('/api/leaderboard/timerstop')
      .send({ gameId, name: 'shreyan', score: 999999 }) // the bogus score is ignored
      .expect(201);

    expect(posted.body.scores[0]).toMatchObject({ name: 'shreyan', score: 1000, unit: 'points' });
  });

  it('refuses a submission for an unfinished game', async () => {
    const { body } = await request(app)
      .post('/api/games/timerstop')
      .send({ mode: 'single', variant: 'blindStop', rounds: 3 });
    await request(app).post('/api/leaderboard/timerstop').send({ gameId: body.gameId, name: 'x' }).expect(400);
  });

  it('refuses a submission for a game with no leaderboard', async () => {
    const { body } = await request(app).post('/api/games/tictactoe').send({ mode: 'multi' });
    const res = await request(app).post('/api/leaderboard/tictactoe').send({ gameId: body.gameId, name: 'x' }).expect(400);
    expect(res.body.error).toMatch(/does not keep a leaderboard/);
  });

  it('serves an empty board for a game nobody has scored', async () => {
    const res = await request(app).get('/api/leaderboard/bullscows').expect(200);
    expect(res.body.scores).toEqual([]);
  });
});
