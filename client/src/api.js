// Thin fetch wrapper. The client holds nothing but an opaque gameId - every rule and every
// secret lives on the server.

const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body is fine */
  }
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

export const api = {
  catalogue: () => req('/games'),
  create: (game, body) => req(`/games/${game}`, { method: 'POST', body: JSON.stringify(body) }),
  fetch: (game, id) => req(`/games/${game}/${id}`),
  move: (game, id, body) => req(`/games/${game}/${id}/move`, { method: 'POST', body: JSON.stringify(body) }),
  leaderboard: (game) => req(`/leaderboard/${game}`),
  submitScore: (game, body) => req(`/leaderboard/${game}`, { method: 'POST', body: JSON.stringify(body) }),
};
