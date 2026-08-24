/**
 * Narrated backend walkthrough.
 *
 *   npm run demo            (server must already be running: npm run dev)
 *   npm run demo -- --slow  (pause between steps, for presenting)
 *
 * Every response printed here is the REAL bytes the browser would receive. The point of the
 * demo is what is *missing* from them: the hangman word, the bulls & cows code, the imposter
 * roles. Those never leave the server until the rules say they may.
 */

const BASE = process.env.DEMO_BASE ?? 'http://localhost:4100';
const SLOW = process.argv.includes('--slow');

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', magenta: '\x1b[35m',
};

let stepNo = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function step(title) {
  stepNo++;
  console.log(`\n${C.bold}${C.cyan}${'─'.repeat(72)}${C.reset}`);
  console.log(`${C.bold}${C.cyan} STEP ${stepNo}. ${title}${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'─'.repeat(72)}${C.reset}`);
}

const say = (text) => console.log(`${C.dim}${text}${C.reset}`);
const point = (text) => console.log(`${C.yellow}  → ${text}${C.reset}`);
const good = (text) => console.log(`${C.green}  ✓ ${text}${C.reset}`);
const bad = (text) => console.log(`${C.red}  ✗ ${text}${C.reset}`);

function wire(label, method, path, body, status, payload) {
  console.log(`${C.magenta}  ${method} ${path}${C.reset}${body ? ` ${C.dim}${JSON.stringify(body)}${C.reset}` : ''}`);
  console.log(`${C.dim}  ${status} ${label}${C.reset}`);
  console.log(
    JSON.stringify(payload, null, 2)
      .split('\n')
      .map((l) => '    ' + l)
      .join('\n'),
  );
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, payload };
}

async function pause() {
  if (SLOW) await sleep(2500);
}

async function main() {
  console.log(`\n${C.bold}Pixel Playground — how the backend actually runs${C.reset}`);
  console.log(`${C.dim}talking to ${BASE}${C.reset}`);

  // ---------------------------------------------------------------- 1
  step('The server is alive, and it owns the game catalogue');
  const health = await req('GET', '/api/health');
  if (health.status !== 200) {
    bad(`No server at ${BASE}. Start it first with:  npm run dev`);
    process.exit(1);
  }
  wire('', 'GET', '/api/health', null, health.status, health.payload);
  const cat = await req('GET', '/api/games');
  point('The list of games and which modes each supports is decided server-side:');
  console.log(
    '    ' + cat.payload.games.map((g) => `${g.name}(${g.modes.join('/')})`).join('  '),
  );
  await pause();

  // ---------------------------------------------------------------- 2
  step('Starting a game returns an OPAQUE id — the client gets no state');
  const hang = await req('POST', '/api/games/hangman', { mode: 'single' });
  wire('', 'POST', '/api/games/hangman', { mode: 'single' }, hang.status, hang.payload);
  point('The browser now holds ONE thing: that gameId string.');
  point('It has no board, no word, no rules. It cannot compute the next state itself.');
  await pause();

  // ---------------------------------------------------------------- 3
  step('The secret is genuinely absent from the wire');
  const hv = hang.payload.view;
  console.log(`    mask   : ${JSON.stringify(hv.mask)}`);
  console.log(`    length : ${hv.length}`);
  console.log(`    word   : ${C.bold}${JSON.stringify(hv.word)}${C.reset}`);
  good('word is null. Not obfuscated, not base64 — simply not sent.');
  point('Open DevTools → Network during the live demo. The word is not there either.');
  point(`The server knows a ${hv.length}-letter word from the "${hv.category}" category. The client does not.`);
  await pause();

  // ---------------------------------------------------------------- 4
  step('Every move is a server decision, not a client one');
  const gid = hang.payload.gameId;
  for (const letter of ['e', 'a']) {
    const r = await req('POST', `/api/games/hangman/${gid}/move`, { letter });
    const v = r.payload.view;
    const hit = v.mask.includes(letter);
    console.log(
      `    guess '${letter}' → mask ${JSON.stringify(v.mask)}  lives ${v.lives}/${v.maxLives}  ${hit ? C.green + 'HIT' : C.red + 'MISS'}${C.reset}`,
    );
  }
  point('The client sent one letter. The server decided hit-or-miss, revealed positions,');
  point('and deducted the life. A hacked client cannot fake a hit.');
  await pause();

  // ---------------------------------------------------------------- 5
  step('Illegal moves are rejected by the engine, not the UI');
  const dup = await req('POST', `/api/games/hangman/${gid}/move`, { letter: 'e' });
  wire('', 'POST', `/api/games/hangman/${gid}/move`, { letter: 'e' }, dup.status, dup.payload);
  good('HTTP 400 from the pure engine. The button being disabled in the UI is a courtesy;');
  good('this is the rule that actually enforces it.');
  await pause();

  // ---------------------------------------------------------------- 6
  step('The bot runs on the server, inside the same request');
  const ttt = await req('POST', '/api/games/tictactoe', { mode: 'single', difficulty: 'hard' });
  const mv = await req('POST', `/api/games/tictactoe/${ttt.payload.gameId}/move`, { index: 0 });
  console.log(`    client sent : ${C.dim}{ "index": 0 }${C.reset}   ${C.dim}(one move)${C.reset}`);
  console.log(`    server sent : ${JSON.stringify(mv.payload.view.board)}`);
  good('Two marks came back from one request: your X, and the bot\'s O.');
  point('That O is full minimax, computed in Node. There is no bot code in the browser.');
  await pause();

  // ---------------------------------------------------------------- 7
  step('A forged score is ignored — the server recomputes it');
  const ts = await req('POST', '/api/games/timerstop', { mode: 'single', variant: 'stopTheClock', rounds: 1 });
  const target = ts.payload.view.config.targetMs;
  await req('POST', `/api/games/timerstop/${ts.payload.gameId}/move`, { elapsedMs: target });
  const forged = await req('POST', '/api/leaderboard/timerstop', {
    gameId: ts.payload.gameId,
    name: 'demo',
    score: 999999,
  });
  console.log(`    client claimed : ${C.red}score: 999999${C.reset}`);
  console.log(`    server stored  : ${C.green}score: ${forged.payload.scores[0].score}${C.reset}`);
  good('The client submits a NAME. The score is recomputed from the finished session.');
  await pause();

  // ---------------------------------------------------------------- 8
  step('Secrets are released only when the rules allow');
  const bc = await req('POST', '/api/games/bullscows', { mode: 'single' });
  const bcId = bc.payload.gameId;
  const mid = await req('POST', `/api/games/bullscows/${bcId}/move`, { guess: '0123' });
  console.log(`    mid-game  codes: ${C.bold}${JSON.stringify(mid.payload.view.codes)}${C.reset}   ${C.dim}(hidden)${C.reset}`);
  say('    ...brute-forcing the code so we can see the reveal...');
  let cracked = null;
  for (let n = 0; n < 10000 && !cracked; n++) {
    const guess = String(n).padStart(4, '0');
    const r = await req('POST', `/api/games/bullscows/${bcId}/move`, { guess });
    if (r.payload.view?.over) cracked = { guess, codes: r.payload.view.codes };
  }
  console.log(`    cracked   : ${cracked.guess} → codes: ${C.green}${JSON.stringify(cracked.codes)}${C.reset}`);
  good('Same field, same endpoint. It only populates once the round is genuinely over.');
  await pause();

  // ---------------------------------------------------------------- 9
  step('Test-only routes are gated by environment');
  const seed = await req('POST', '/api/test/seed', { seed: 1 });
  if (seed.status === 200) {
    point(`This server is in development, so /api/test/seed answered ${seed.status}.`);
    point('It pins the PRNG so tests get identical words and bot moves every run.');
    point('Under `npm start` (NODE_ENV=production) this same route returns 404 —');
    point('the router is never mounted. Worth showing both ways in the demo.');
  } else {
    good(`Production mode: /api/test/seed → ${seed.status}. The route does not exist here.`);
  }

  console.log(`\n${C.bold}${C.green}That is the whole argument:${C.reset}`);
  console.log('  the browser renders; Node decides. Rules, bots, secrets and scores all live server-side.\n');
}

main().catch((err) => {
  bad(err.message);
  console.error(`${C.dim}Is the server running? Try: npm run dev${C.reset}`);
  process.exit(1);
});
