import { Router } from 'express';
import { getGame, GAMES, GAME_NAMES } from '../controllers.js';
import { createSession, getSession, updateSession } from '../sessions.js';

export const gamesRouter = Router();

// Catalogue for the lobby.
gamesRouter.get('/', (_req, res) => {
  res.json({
    games: GAME_NAMES.map((name) => ({ name, title: GAMES[name].title, modes: GAMES[name].modes })),
  });
});

function resolveGame(req, res) {
  const game = getGame(req.params.game);
  if (!game) {
    res.status(404).json({ error: `unknown game '${req.params.game}'` });
    return null;
  }
  return game;
}

// Start a session. Returns an opaque gameId plus the sanitised view.
gamesRouter.post('/:game', (req, res) => {
  const game = resolveGame(req, res);
  if (!game) return;
  try {
    const session = createSession(req.params.game, (rng) => game.create(req.body ?? {}, rng));
    res.status(201).json({ gameId: session.id, view: game.view(session.state) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

gamesRouter.get('/:game/:gameId', (req, res) => {
  const game = resolveGame(req, res);
  if (!game) return;
  const session = getSession(req.params.game, req.params.gameId);
  if (!session) return res.status(404).json({ error: 'no such game session' });
  res.json({ gameId: session.id, view: game.view(session.state) });
});

gamesRouter.post('/:game/:gameId/move', (req, res) => {
  const game = resolveGame(req, res);
  if (!game) return;
  const session = getSession(req.params.game, req.params.gameId);
  if (!session) return res.status(404).json({ error: 'no such game session' });

  try {
    const { state, extra } = game.move(session.state, req.body ?? {}, session.rng);
    updateSession(session, state);
    const payload = { gameId: session.id, view: game.view(state) };
    if (extra) payload.extra = extra;
    res.json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
