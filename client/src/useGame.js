import { useCallback, useState } from 'react';
import { api } from './api.js';

/**
 * Session hook shared by all six games. Holds the opaque gameId and the latest server view;
 * every rule decision happens on the server, so there is no local game state here.
 */
export function useGame(game) {
  const [gameId, setGameId] = useState(null);
  const [view, setView] = useState(null);
  const [extra, setExtra] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(
    async (body) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.create(game, body);
        setGameId(res.gameId);
        setView(res.view);
        setExtra(null);
        return res;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [game],
  );

  const move = useCallback(
    async (body) => {
      if (!gameId) return null;
      setBusy(true);
      setError(null);
      try {
        const res = await api.move(game, gameId, body);
        setView(res.view);
        setExtra(res.extra ?? null);
        return res;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [game, gameId],
  );

  const quit = useCallback(() => {
    setGameId(null);
    setView(null);
    setExtra(null);
    setError(null);
  }, []);

  return { gameId, view, extra, error, busy, start, move, quit, setError };
}
