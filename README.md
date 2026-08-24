# Pixel Playground

A six-game minigame arcade. Every game has a single-player mode against server-side bots and a
same-screen "pass and play" mode. Node/Express is the authoritative engine; the React client only
renders what the server allows it to see.

| Game | 1P | 2P |
|---|---|---|
| Tic-Tac-Toe | vs bot (easy / medium / hard minimax) | shared board |
| Rock-Paper-Scissors | vs a bot that learns your favourite throw | secret pass-and-play picks |
| Hangman | server picks a word by category | Player 1 types the secret word |
| Bulls & Cows | crack the server's 4-digit code | dual secrets, first to crack wins |
| Timer Stop | three reaction variations, random targets | take turns, high score wins |
| Guess the Imposter | — | 3–10 players, multiplayer only |

## Requirements

Node 18+ (built and tested on Node 24) and npm. No native modules, no database — the leaderboard is
a JSON file.

## Run it

```bash
npm run install:all      # server + client + e2e dependencies (first time only)

npm run dev              # dev with hot reload  -> http://localhost:5173
# or
npm run build && npm start   # production-style -> http://localhost:4100
```

In dev, Vite serves the UI on **5173** and proxies `/api` to Express on **4100**. In production,
Express serves the built client itself on **4100**.

> **Ports:** 4100 (API) and 5173 (Vite dev). Port **4000 is deliberately avoided** — it belongs to
> the local LiteLLM model-router proxy.

## Test it

```bash
npm test          # 103 server tests  (Vitest unit + Supertest API)
npm run test:e2e  # 15 browser tests (Playwright; builds the client first)
npm run test:all  # both
```

First Playwright run needs a browser: `cd e2e && npx playwright install chromium`.

## Scripts

| Script | What it does |
|---|---|
| `install:all` | installs all three workspaces |
| `dev` | Express + Vite together, prefixed output |
| `build` | builds the client into `client/dist` |
| `start` | production server (`NODE_ENV=production`, no test routes) |
| `start:e2e` | serves the build with test routes still mounted |
| `test` / `test:e2e` / `test:all` | see above |

Architecture, per-game rules, and the full API reference are in
[DOCUMENTATION.md](DOCUMENTATION.md).
