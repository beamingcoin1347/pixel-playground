// One controller per game. Controllers are the only place where randomness meets the pure
// engines: they build the secret config with the session rng, then hand plain state to the
// engine. Each exposes create / move / view, and optionally finalScore for the leaderboard.

import * as ttt from './engines/tictactoe.js';
import * as rps from './engines/rps.js';
import * as hangman from './engines/hangman.js';
import * as bullscows from './engines/bullscows.js';
import * as timerstop from './engines/timerstop.js';
import * as imposter from './engines/imposter.js';

import { chooseMove as tttChooseMove } from './ai/tictactoeBot.js';
import { chooseThrow as rpsChooseThrow } from './ai/rpsBot.js';

import { CATEGORIES, CATEGORY_NAMES } from './data/words.js';
import { IMPOSTER_PAIRS } from './data/imposterPairs.js';
import { rngInt, rngPick, rngShuffle } from './rng.js';

function requireMode(body, allowed) {
  const mode = body?.mode;
  if (!allowed.includes(mode)) throw new Error(`mode must be one of ${allowed.join(', ')}`);
  return mode;
}

export const GAMES = {
  tictactoe: {
    title: 'Tic-Tac-Toe',
    modes: ['single', 'multi'],
    create(body, _rng) {
      const mode = requireMode(body, ['single', 'multi']);
      return ttt.createState({ mode, difficulty: body.difficulty ?? 'medium' });
    },
    move(state, body, rng) {
      if (state.mode === 'single') {
        // The human is always X; the server plays the bot's reply immediately.
        let next = ttt.applyMove(state, { index: body.index, player: 'X' });
        if (!next.winner && !next.draw) {
          const botIndex = tttChooseMove(next, rng);
          if (botIndex !== null && botIndex !== undefined) {
            next = ttt.applyMove(next, { index: botIndex, player: 'O' });
          }
        }
        return { state: next };
      }
      // Pass-and-play: whoever's turn it is moves on the shared board.
      return { state: ttt.applyMove(state, { index: body.index }) };
    },
    view: ttt.publicView,
  },

  rps: {
    title: 'Rock-Paper-Scissors',
    modes: ['single', 'multi'],
    create(body, _rng) {
      const mode = requireMode(body, ['single', 'multi']);
      return rps.createState({ mode, target: body.target ?? 3 });
    },
    move(state, body, rng) {
      if (state.mode === 'single') {
        // Decide the bot's throw from history BEFORE this round resolves, so it never
        // peeks at what the player just picked.
        const botChoice = rpsChooseThrow(state, rng);
        let next = rps.applyMove(state, { player: 'p1', choice: body.choice });
        next = rps.applyMove(next, { player: 'p2', choice: botChoice });
        return { state: next };
      }
      return { state: rps.applyMove(state, { player: body.player, choice: body.choice }) };
    },
    view: rps.publicView,
  },

  hangman: {
    title: 'Hangman',
    modes: ['single', 'multi'],
    create(body, rng) {
      const mode = requireMode(body, ['single', 'multi']);
      if (mode === 'multi') {
        // Player 1 types the secret word; the engine validates 2-20 letters.
        return hangman.createState({ mode, word: body.word, category: 'custom' });
      }
      const category = CATEGORY_NAMES.includes(body.category) ? body.category : rngPick(rng, CATEGORY_NAMES);
      return hangman.createState({ mode, word: rngPick(rng, CATEGORIES[category]), category });
    },
    move(state, body, _rng) {
      return { state: hangman.applyMove(state, { letter: body.letter }) };
    },
    view: hangman.publicView,
  },

  bullscows: {
    title: 'Bulls & Cows',
    modes: ['single', 'multi'],
    create(body, rng) {
      const mode = requireMode(body, ['single', 'multi']);
      if (mode === 'multi') {
        return bullscows.createState({
          mode,
          codes: { p1: body.secrets?.p1, p2: body.secrets?.p2 },
        });
      }
      // Repeats allowed - the scorer is multiset-correct, so it matters that we generate them.
      let code = '';
      for (let i = 0; i < bullscows.CODE_LENGTH; i++) code += String(rngInt(rng, 10));
      return bullscows.createState({ mode, codes: { p1: null, p2: code } });
    },
    move(state, body, _rng) {
      return { state: bullscows.applyMove(state, { player: body.player ?? 'p1', guess: body.guess }) };
    },
    view: bullscows.publicView,
    finalScore(state) {
      if (state.mode !== 'single' || !state.over || state.winner !== 'p1') return null;
      return { score: state.guesses.p1.length, unit: 'guesses' };
    },
  },

  timerstop: {
    title: 'Timer Stop',
    modes: ['single', 'multi'],
    create(body, rng) {
      const mode = requireMode(body, ['single', 'multi']);
      const variant = timerstop.VARIANTS.includes(body.variant) ? body.variant : 'stopTheClock';
      let config;
      // Every target is randomised per session and snapped to 100ms so it reads cleanly.
      if (variant === 'greenLight') config = { greenAtMs: (10 + rngInt(rng, 31)) * 100 };     // 1.0-4.0s
      else if (variant === 'blindStop') config = { targetMs: (40 + rngInt(rng, 81)) * 100 };  // 4.0-12.0s
      else config = { targetMs: (30 + rngInt(rng, 61)) * 100 };                               // 3.0-9.0s
      return timerstop.createState({ mode, variant, config, rounds: body.rounds ?? 3 });
    },
    move(state, body, _rng) {
      return {
        state: timerstop.applyMove(state, {
          player: body.player ?? state.turn,
          elapsedMs: body.elapsedMs,
        }),
      };
    },
    view: timerstop.publicView,
    finalScore(state) {
      if (!state.over) return null;
      const totals = timerstop.totalsOf(state);
      return { score: Math.max(totals.p1, totals.p2), unit: 'points' };
    },
  },

  imposter: {
    title: 'Guess the Imposter',
    modes: ['multi'],
    create(body, rng) {
      requireMode(body, ['multi']); // multiplayer only, by design
      const playerCount = body.playerCount;
      if (!Number.isInteger(playerCount)) throw new Error('playerCount is required');
      const imposterCount = body.imposterCount ?? 1;
      const names =
        Array.isArray(body.names) && body.names.length === playerCount
          ? body.names.map((n, i) => String(n || `Player ${i + 1}`).slice(0, 24))
          : Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`);

      const pair = rngPick(rng, IMPOSTER_PAIRS);
      const seats = rngShuffle(rng, Array.from({ length: playerCount }, (_, i) => i));
      const imposterIndexes = seats.slice(0, imposterCount).sort((a, b) => a - b);

      return imposter.createState({
        playerCount,
        imposterCount,
        names,
        word: pair.word,
        decoy: pair.decoy,
        imposterIndexes,
      });
    },
    move(state, body, _rng) {
      const next = imposter.applyMove(state, body);
      // A reveal hands back exactly one card, once, and never says who the imposter is.
      if (body.type === 'reveal') {
        return { state: next, extra: { playerIndex: body.playerIndex, word: imposter.wordFor(state, body.playerIndex) } };
      }
      return { state: next };
    },
    view: imposter.publicView,
  },
};

export const GAME_NAMES = Object.keys(GAMES);

export function getGame(name) {
  return Object.prototype.hasOwnProperty.call(GAMES, name) ? GAMES[name] : null;
}
