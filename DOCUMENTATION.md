# Pixel Playground — Architecture & Reference

## 1. The shape of the thing

```
minigame-arcade/
├── scripts/            dev.mjs, start.mjs, start-e2e.mjs   (dependency-free runners)
├── server/
│   ├── src/
│   │   ├── engines/    pure game logic: state + move -> new state, no I/O
│   │   ├── ai/         bots; take (state, rng) and return a move
│   │   ├── data/       word banks and imposter word pairs
│   │   ├── routes/     games.js, leaderboard.js, test.js
│   │   ├── rng.js      seedable PRNG (mulberry32)
│   │   ├── sessions.js opaque-id session store
│   │   ├── controllers.js  binds randomness to the pure engines
│   │   ├── leaderboard.js  JSON-file store
│   │   ├── app.js      express wiring
│   │   └── index.js    listens on 4100
│   └── tests/          Vitest + Supertest (99 tests)
├── client/             React 18 + Vite + react-router, hand-written CSS
└── e2e/                Playwright (13 tests)
```

### Why Node is load-bearing, not decorative

Every rule, every bot move, and every secret lives on the server:

- **Hangman** — the word is stored server-side and sent out **masked**. `publicView` only includes
  the real word once the round is over.
- **Bulls & Cows** — the code never leaves the server until somebody cracks it.
- **Imposter** — roles and both words stay server-side. A reveal returns exactly one card, to one
  seat, and never says whether that seat is the imposter.
- **RPS** — in pass-and-play, the first player's throw is held in `state.pending` and the public
  view exposes only *who* has locked in, not *what* they picked.
- **Tic-Tac-Toe** — the bot's reply is computed on the server inside the same request.

Open DevTools and read every byte the client receives; you still cannot see a secret you shouldn't.
That property is asserted directly in `server/tests/api.test.js`.

## 2. Engines are pure

Each module in `server/src/engines/` exports:

```js
createState(options) -> state          // validates options, throws on bad input
applyMove(state, move) -> newState     // never mutates; throws on an illegal move
publicView(state) -> sanitisedView     // the ONLY thing the client ever sees
```

No file access, no clock, no `Math.random()`. That is what makes them trivially unit-testable and
what lets the same code be driven by a pinned seed in e2e.

Randomness enters in `controllers.js`, which builds the secret config with the session's rng and
then hands plain data to the engine. Bots follow the same rule — they take `(state, rng)`.

### Seeding

`rng.js` is mulberry32. Each session gets its own generator seeded from `crypto.randomBytes`, unless
a seed has been pinned via `POST /api/test/seed`, in which case every new session uses it. Pinning
the seed makes word choices, server codes, imposter assignments, and easy-bot moves reproducible —
which is how the Playwright suite stays deterministic.

## 3. Sessions

`POST /api/games/:game` creates a session and returns an **opaque `gameId`** (a UUID). The server
holds the authoritative state; the client holds nothing but that id. Sessions are in-memory and
swept after four hours of inactivity.

## 4. Per-game logic

### Tic-Tac-Toe
Eight-line win detection plus a draw check. Bots: **easy** picks a random empty cell; **medium**
plays win → block → centre → random; **hard** is full minimax with an alpha cut-off and is
provably unbeatable (`engines.tictactoe.test.js` plays it against itself and asserts a draw).
Single player: you are X, the server plays O in the same response. Multiplayer: both players
alternate on one board.

### Rock-Paper-Scissors
First to `target` rounds (1, 3 or 5). The bot throws randomly for three rounds, then counts your
history, finds your most frequent throw, and counters it; frequency ties break in `rock, paper,
scissors` order so seeded games repeat. A round resolves only when both sides have thrown, which is
what makes secret pass-and-play picks possible.

### Hangman
Six lives. Single player picks a word from one of five categories (`animals`, `food`, `space`,
`computing`, `sports`). Multiplayer takes Player 1's secret word, validated as 2–20 letters `a-z`
and entered in a password field so Player 2 cannot read it over your shoulder.

### Bulls & Cows
Four digits, **repeats allowed**. Scoring is multiset-correct: bulls are counted first, then cows
are the multiset intersection over the remaining positions only — so `1111` guessed against `1123`
scores 2 bulls and **0** cows, not 2 and 2. Single player cracks a server code and the guess count
goes to the leaderboard (fewer is better). Multiplayer is dual-secret: each player cracks the
other's, alternating turns.

### Timer Stop
Timing is measured **client-side** with `performance.now()`; the server owns the config and scores
and validates whatever the client reports. Points are `max(0, 1000 - miss)`, so higher is better
and multiplayer can just compare totals. Every target is drawn per session from the seeded rng and
snapped to 100ms, so no target can be memorised between runs.

The three variations do not all measure the same thing, and the engine says so rather than
pretending otherwise. `scoreAttempt` returns `errorMs` for the two clock games (distance from the
target, either direction) and `reactionMs` for Green Light (time *after* the light). `publicView`
publishes a `measures` field naming which one applies, and the client labels its column from that.
Collapsing both into a single "error" number is what previously made the Green Light table print
wall-clock time under an "Error" heading - a real bug, now covered by tests in both suites.

| Variation | Rule |
|---|---|
| Stop the Clock | random target, 3.00–9.00s, shown; clock and progress ring visible |
| Blind Stop | random target, 4.00–12.00s, shown; the clock reads `??.??` while running |
| Green Light | light turns green at a random 1.00–4.00s; tapping early busts for 0 |

*Trade-off worth naming:* because the spec puts timing on the client, `greenAtMs` has to be sent to
the browser so it can render the light. A determined player could read it from the network tab. The
server still validates the range and computes the score; making the timing authoritative would mean
moving the clock server-side and eating the network latency.

### Guess the Imposter
Multiplayer only, 3–10 players. Everyone shares a word except the imposter(s), who get a similar
decoy — and nobody is told which they are. Imposters are capped at `floor((n-1)/2)` so civilians
always outnumber them.

Phases: **reveal** (pass-and-play, one card at a time) → **discuss** → **vote** → **result**.

Civilians win **only** on a clean, non-tied vote that lands on an imposter. Any tie lets the
imposters escape. Self-votes are rejected.

> The reveal UI checks for a face-up card *before* it checks the phase. The final reveal flips the
> phase to `discuss`, and without that ordering the last player would never see their own word —
> a bug the e2e suite caught.

## 5. API

All responses are JSON. Errors are `{ "error": "..." }` with 400 (bad move/options), 404 (unknown
game or session) or 500.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness + current env |
| `GET` | `/api/games` | catalogue: name, title, supported modes |
| `POST` | `/api/games/:game` | start a session → `{ gameId, view }` |
| `GET` | `/api/games/:game/:gameId` | current `{ gameId, view }` |
| `POST` | `/api/games/:game/:gameId/move` | apply a move → `{ gameId, view, extra? }` |
| `GET` | `/api/leaderboard` | every board |
| `GET` | `/api/leaderboard/:game` | one board, top 10 |
| `POST` | `/api/leaderboard/:game` | submit `{ gameId, name }` |
| `POST` | `/api/test/seed` | **non-production only** — pin or clear the rng seed |
| `POST` | `/api/test/reset` | **non-production only** — drop sessions, wipe the board |

### Create bodies

```jsonc
{ "mode": "single", "difficulty": "hard" }                       // tictactoe
{ "mode": "multi",  "target": 3 }                                // rps
{ "mode": "single", "category": "space" }                        // hangman (omit for random)
{ "mode": "multi",  "word": "banana" }                           // hangman 2P
{ "mode": "multi",  "secrets": { "p1": "1234", "p2": "5678" } }   // bullscows 2P
{ "mode": "single", "variant": "greenLight", "rounds": 3 }       // timerstop
{ "mode": "multi",  "playerCount": 5, "imposterCount": 1 }       // imposter
```

### Move bodies

```jsonc
{ "index": 4 }                                     // tictactoe
{ "player": "p1", "choice": "rock" }               // rps (player omitted in 1P)
{ "letter": "e" }                                  // hangman
{ "player": "p1", "guess": "1234" }                // bullscows
{ "player": "p1", "elapsedMs": 5012.4 }            // timerstop
{ "type": "reveal", "playerIndex": 0 }             // imposter -> extra.word
{ "type": "startVote" }                            // imposter
{ "type": "vote", "voterIndex": 0, "targetIndex": 2 }
```

### Leaderboard integrity

The client submits a **name, never a score**. The server recomputes the score from the finished
session via each controller's `finalScore(state)`, so a forged number in the request body is simply
ignored — asserted in `api.test.js`.

Only Bulls & Cows (guesses, ascending) and Timer Stop (points, descending) keep boards. Top 10 per
game, stored at `server/data/leaderboard.json`.

> `server/data/` is the one directory that does **not** regenerate — deleting it wipes the
> leaderboard. `node_modules/` and `client/dist/` do regenerate.

## 6. Client

React 18 + Vite + react-router, plain hand-written CSS (no Tailwind, no animation library), and Web
Audio sound effects synthesised in `sound.js` — no audio files, no libraries. The context is created
lazily on first interaction so browsers don't block it, and mute state persists in `localStorage`.

`useGame.js` is the shared session hook behind all six games: it holds the `gameId` and the latest
server view, and exposes `start / move / quit`. There is no duplicated rule logic in the client.

### Testability hooks

- Every interactive element carries a `data-testid` (`cell-0`, `key-a`, `throw-rock`, `vote-2`,
  `start-timer`, …).
- `styles.css` collapses every transition and animation under
  `@media (prefers-reduced-motion: reduce)`, and the Playwright config sets
  `reducedMotion: 'reduce'` — so the suite never races CSS.

## 7. Serving model

`app.js` mounts static serving when `client/dist` **exists**, rather than keying off `NODE_ENV`.
That is deliberate: it lets `start-e2e.mjs` serve the real production bundle while keeping
`NODE_ENV=test` so `/api/test/*` stays available for seeding. `start.mjs` sets
`NODE_ENV=production`, which drops the test routes entirely.

## 8. Test coverage

**Server — 103 tests** across 9 files: pure-engine rules for all six games (win/draw detection,
multiset scoring, life counting, phase transitions, tie handling), all three bot difficulties
including a self-play draw proof, PRNG determinism, leaderboard ordering and capping, and 19
Supertest API tests covering session lifecycle, error codes, secret non-leakage, seed determinism,
production route-gating, and server-side scoring.

**Browser — 15 tests**: lobby, routing fallback, both Tic-Tac-Toe modes, an RPS round, both Hangman
modes, both Bulls & Cows modes, two Timer Stop variations, a full Imposter round, leaderboard
submission end-to-end, and the shell's navigation and mute toggle.

## 9. Known gaps

- **No cross-device multiplayer.** Everything is same-screen. The server already models
  authoritative sessions keyed by `gameId`, so adding WebSocket rooms keyed on that id is the
  natural next step.
- **Sessions are in-memory** — a restart drops games in progress.
- **Timer Stop timing is client-reported** (see the trade-off note in §4).
