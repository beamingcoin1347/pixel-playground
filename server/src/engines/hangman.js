// Pure Hangman logic. The word lives here and is masked on the way out; it is only ever
// included in the public view once the round has ended.

export const MAX_LIVES = 6;
export const WORD_RE = /^[a-z]{2,20}$/;

export function createState({ mode, word, category = 'custom' }) {
  if (mode !== 'single' && mode !== 'multi') throw new Error('mode must be single or multi');
  const w = String(word ?? '').toLowerCase();
  if (!WORD_RE.test(w)) throw new Error('word must be 2-20 letters (a-z only)');
  return { mode, word: w, category, guessed: [], lives: MAX_LIVES, won: false, over: false };
}

export function maskOf(word, guessed) {
  return word.split('').map((ch) => (guessed.includes(ch) ? ch : null));
}

export function applyMove(state, { letter }) {
  if (state.over) throw new Error('game is already over');
  const l = String(letter ?? '').toLowerCase();
  if (!/^[a-z]$/.test(l)) throw new Error('letter must be a single a-z character');
  if (state.guessed.includes(l)) throw new Error('letter already guessed');

  const guessed = [...state.guessed, l];
  const hit = state.word.includes(l);
  const lives = hit ? state.lives : state.lives - 1;
  const won = maskOf(state.word, guessed).every((ch) => ch !== null);

  return { ...state, guessed, lives, won, over: won || lives <= 0 };
}

export function publicView(state) {
  return {
    mode: state.mode,
    category: state.category,
    mask: maskOf(state.word, state.guessed),
    length: state.word.length,
    guessed: state.guessed,
    lives: state.lives,
    maxLives: MAX_LIVES,
    won: state.won,
    over: state.over,
    word: state.over ? state.word : null, // secret until the round ends
  };
}
