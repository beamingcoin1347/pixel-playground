// In-memory session store. The client only ever holds an opaque gameId; the authoritative
// state (secrets included) lives here and is never serialised to the browser except through
// each engine's publicView().

import { randomBytes, randomUUID } from 'node:crypto';
import { createRng } from './rng.js';

const sessions = new Map();
const TTL_MS = 1000 * 60 * 60 * 4; // stale sessions are swept after four hours

// When a seed is forced (via the test-only endpoint) every new session uses it, which makes
// secrets and bot moves reproducible for the e2e suite.
let forcedSeed = null;

export function setSeed(seed) {
  forcedSeed = seed === null || seed === undefined ? null : seed >>> 0;
  return forcedSeed;
}

export function currentSeed() {
  return forcedSeed;
}

function nextSeed() {
  if (forcedSeed !== null) return forcedSeed;
  return randomBytes(4).readUInt32BE(0);
}

export function createSession(game, build) {
  sweep();
  const seed = nextSeed();
  const rng = createRng(seed);
  const state = build(rng);
  const id = randomUUID();
  const session = { id, game, state, rng, seed, createdAt: Date.now(), updatedAt: Date.now() };
  sessions.set(id, session);
  return session;
}

export function getSession(game, id) {
  const session = sessions.get(id);
  if (!session || session.game !== game) return null;
  return session;
}

export function updateSession(session, state) {
  session.state = state;
  session.updatedAt = Date.now();
  return session;
}

export function sweep(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > TTL_MS) sessions.delete(id);
  }
  return sessions.size;
}

export function reset() {
  sessions.clear();
  forcedSeed = null;
}

export function size() {
  return sessions.size;
}
