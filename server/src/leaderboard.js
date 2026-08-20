// JSON-file leaderboard. Deliberately not SQLite - no native modules to rebuild per platform.
// Writes are serialised through a promise chain so concurrent submissions can't interleave.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_URL = new URL('../data/leaderboard.json', import.meta.url);
const FILE = fileURLToPath(FILE_URL);
const DIR = dirname(FILE);

const MAX_ENTRIES = 10;

// Lower is better for guess counts, higher is better for points.
export const ORDER = { bullscows: 'asc', timerstop: 'desc' };

let writeQueue = Promise.resolve();

async function load() {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT' || err instanceof SyntaxError) return {};
    throw err;
  }
}

async function save(board) {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(board, null, 2) + '\n', 'utf8');
}

function sortEntries(game, entries) {
  const dir = ORDER[game] ?? 'desc';
  return entries
    .slice()
    .sort((a, b) => (dir === 'asc' ? a.score - b.score : b.score - a.score))
    .slice(0, MAX_ENTRIES);
}

export async function topScores(game) {
  const board = await load();
  return sortEntries(game, board[game] ?? []);
}

export async function allScores() {
  const board = await load();
  const out = {};
  for (const game of Object.keys(board)) out[game] = sortEntries(game, board[game]);
  return out;
}

export async function addScore(game, { name, score, unit }) {
  const task = writeQueue.then(async () => {
    const board = await load();
    const entries = board[game] ?? [];
    entries.push({ name, score, unit, at: new Date().toISOString() });
    board[game] = sortEntries(game, entries);
    await save(board);
    return board[game];
  });
  // Keep the chain alive even if one write fails.
  writeQueue = task.catch(() => {});
  return task;
}

export async function resetBoard() {
  const task = writeQueue.then(() => save({}));
  writeQueue = task.catch(() => {});
  return task;
}
