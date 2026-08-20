import { Router } from 'express';
import { getGame } from '../controllers.js';
import { getSession } from '../sessions.js';
import { allScores, topScores, addScore } from '../leaderboard.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ scores: await allScores() });
  } catch (err) {
    next(err);
  }
});

leaderboardRouter.get('/:game', async (req, res, next) => {
  try {
    res.json({ game: req.params.game, scores: await topScores(req.params.game) });
  } catch (err) {
    next(err);
  }
});

// The client submits a NAME, never a score. The score is recomputed from the finished
// session server-side, so a forged number can't reach the board.
leaderboardRouter.post('/:game', async (req, res, next) => {
  const game = getGame(req.params.game);
  if (!game) return res.status(404).json({ error: `unknown game '${req.params.game}'` });
  if (typeof game.finalScore !== 'function') {
    return res.status(400).json({ error: `${req.params.game} does not keep a leaderboard` });
  }

  const { gameId, name } = req.body ?? {};
  const session = getSession(req.params.game, gameId);
  if (!session) return res.status(404).json({ error: 'no such game session' });

  const result = game.finalScore(session.state);
  if (!result) return res.status(400).json({ error: 'this game has no qualifying score yet' });

  const cleanName = String(name ?? '').trim().slice(0, 16) || 'anon';

  try {
    const scores = await addScore(req.params.game, { name: cleanName, ...result });
    res.status(201).json({ game: req.params.game, scores });
  } catch (err) {
    next(err);
  }
});
