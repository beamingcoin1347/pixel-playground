import { test, expect } from '@playwright/test';

// Every test starts from a clean server: no sessions, empty leaderboard, pinned rng seed.
test.beforeEach(async ({ request }) => {
  await request.post('/api/test/reset');
  await request.post('/api/test/seed', { data: { seed: 20260821 } });
});

test('the lobby lists all six games', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('game-grid').locator('a')).toHaveCount(6);
  for (const name of ['tictactoe', 'rps', 'hangman', 'bullscows', 'timerstop', 'imposter']) {
    await expect(page.getByTestId(`game-link-${name}`)).toBeVisible();
  }
});

test('an unknown route falls back to the lobby', async ({ page }) => {
  await page.goto('/game/definitely-not-a-game');
  await expect(page.getByTestId('game-grid')).toBeVisible();
});

test('tic-tac-toe: the server answers with the bot move', async ({ page }) => {
  await page.goto('/game/tictactoe');
  await page.getByTestId('mode-single').click();
  await page.getByTestId('difficulty-hard').click();
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('board')).toBeVisible();
  await page.getByTestId('cell-0').click();

  await expect(page.getByTestId('cell-0')).toHaveText('X');
  // The bot's reply is computed server-side and arrives in the same response.
  const marks = await page.getByTestId('board').locator('button').allTextContents();
  expect(marks.filter((m) => m === 'X')).toHaveLength(1);
  expect(marks.filter((m) => m === 'O')).toHaveLength(1);
});

test('tic-tac-toe: pass-and-play alternates X and O on one board', async ({ page }) => {
  await page.goto('/game/tictactoe');
  await page.getByTestId('mode-multi').click();
  await page.getByTestId('start-game').click();

  await page.getByTestId('cell-0').click();
  await expect(page.getByTestId('cell-0')).toHaveText('X');
  await page.getByTestId('cell-4').click();
  await expect(page.getByTestId('cell-4')).toHaveText('O');
  await expect(page.getByTestId('status')).toContainText('Player X');
});

test('rock-paper-scissors: a round resolves against the bot', async ({ page }) => {
  await page.goto('/game/rps');
  await page.getByTestId('mode-single').click();
  await page.getByTestId('target-3').click();
  await page.getByTestId('start-game').click();

  await page.getByTestId('throw-rock').click();

  await expect(page.getByTestId('rounds')).toBeVisible();
  await expect(page.getByTestId('rounds').locator('tbody tr')).toHaveCount(1);
  await expect(page.getByTestId('last-round')).toBeVisible();
});

test('hangman: player 1 sets a word and player 2 guesses it', async ({ page }) => {
  await page.goto('/game/hangman');
  await page.getByTestId('mode-multi').click();
  await page.getByTestId('secret-word').fill('banana');
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('mask').locator('b')).toHaveCount(6);

  for (const letter of ['b', 'a', 'n']) {
    await page.getByTestId(`key-${letter}`).click();
  }

  await expect(page.getByTestId('status')).toContainText('You got it');
  await expect(page.getByTestId('revealed-word')).toContainText('banana');
});

test('hangman: a wrong guess costs a life and the word stays hidden', async ({ page }) => {
  await page.goto('/game/hangman');
  await page.getByTestId('mode-multi').click();
  await page.getByTestId('secret-word').fill('banana');
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('lives')).toContainText('6/6');
  await page.getByTestId('key-z').click();
  await expect(page.getByTestId('lives')).toContainText('5/6');
  await expect(page.getByTestId('key-z')).toBeDisabled();
  // Nothing on the page gives the word away mid-round.
  await expect(page.locator('body')).not.toContainText('banana');
});

test('bulls & cows: a guess comes back scored by the server', async ({ page }) => {
  await page.goto('/game/bullscows');
  await page.getByTestId('mode-single').click();
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('guess-submit')).toBeDisabled(); // needs four digits
  await page.getByTestId('guess-input').fill('0123');
  await page.getByTestId('guess-submit').click();

  await expect(page.getByTestId('guess-row-0')).toBeVisible();
  await expect(page.getByTestId('bulls-0')).toHaveText(/^[0-4]$/);
  await expect(page.getByTestId('cows-0')).toHaveText(/^[0-4]$/);
});

test('bulls & cows: dual secrets, and cracking one ends the game', async ({ page }) => {
  await page.goto('/game/bullscows');
  await page.getByTestId('mode-multi').click();
  await page.getByTestId('secret-p1').fill('1234');
  await page.getByTestId('secret-p2').fill('5678');
  await page.getByTestId('start-game').click();

  // p1 guesses p2's secret exactly.
  await page.getByTestId('guess-input').fill('5678');
  await page.getByTestId('guess-submit').click();

  await expect(page.getByTestId('status')).toContainText('cracked the code');
  await expect(page.getByTestId('revealed-code')).toContainText('5678');
});

test('timer stop: tapping before the green light busts the round', async ({ page }) => {
  await page.goto('/game/timerstop');
  await page.getByTestId('mode-single').click();
  await page.getByTestId('variant-greenLight').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start-game').click();

  await expect(page.getByTestId('light')).toHaveAttribute('data-green', 'no');
  await page.getByTestId('start-timer').click();
  await page.getByTestId('stop-timer').click(); // far too early - the light is still red

  await expect(page.getByTestId('result-p1-0')).toContainText('too early');
  await expect(page.getByTestId('total-p1')).toContainText('0');
});

test('timer stop: a finished run can be saved to the leaderboard', async ({ page }) => {
  await page.goto('/game/timerstop');
  await page.getByTestId('mode-single').click();
  await page.getByTestId('variant-stopTheClock').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start-game').click();

  await page.getByTestId('start-timer').click();
  await page.waitForTimeout(250);
  await page.getByTestId('stop-timer').click();

  await expect(page.getByTestId('result-p1-0')).toBeVisible();
  await page.getByTestId('score-name').fill('shreyan');
  await page.getByTestId('score-submit').click();
  await expect(page.getByTestId('score-saved')).toBeVisible();

  await page.getByTestId('back-to-lobby').click();
  await expect(page.getByTestId('leaderboards')).toContainText('shreyan');
});

test('imposter: exactly one card differs, and a clean vote resolves the round', async ({ page }) => {
  await page.goto('/game/imposter');
  await page.getByTestId('players-3').click();
  await page.getByTestId('imposters-1').click();
  await page.getByTestId('start-game').click();

  const cards = [];
  for (let seat = 0; seat < 3; seat++) {
    await page.getByTestId('show-card').click();
    cards.push((await page.getByTestId('card-word').textContent()).trim());
    await page.getByTestId('hide-card').click();
  }
  // Two civilians share a word; the imposter holds the decoy.
  expect(new Set(cards).size).toBe(2);

  await expect(page.getByTestId('phase')).toContainText('discuss');
  await page.getByTestId('start-vote').click();

  await page.getByTestId('vote-1').click(); // seat 0 votes for seat 1
  await page.getByTestId('vote-0').click(); // seat 1 votes for seat 0
  await page.getByTestId('vote-1').click(); // seat 2 votes for seat 1

  await expect(page.getByTestId('result-banner')).toBeVisible();
  await expect(page.getByTestId('result-detail')).toContainText('was ejected');
  await expect(page.getByTestId('result-word')).not.toBeEmpty();
});

test('the shell offers a way back and a working mute toggle', async ({ page }) => {
  await page.goto('/game/rps');
  const mute = page.getByTestId('mute-toggle');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('back-to-lobby').click();
  await expect(page.getByTestId('game-grid')).toBeVisible();
});
