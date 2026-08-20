import { useState } from 'react';
import { Shell, Choice, ErrorNote } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const CATEGORIES = ['random', 'animals', 'food', 'space', 'computing', 'sports'];

export default function Hangman() {
  const game = useGame('hangman');
  const [mode, setMode] = useState('single');
  const [category, setCategory] = useState('random');
  const [secret, setSecret] = useState('');
  const view = game.view;

  async function begin() {
    if (mode === 'multi') {
      const res = await game.start({ mode, word: secret });
      if (res) setSecret('');
      return;
    }
    await game.start(category === 'random' ? { mode } : { mode, category });
  }

  async function guess(letter) {
    if (!view || view.over || game.busy) return;
    const res = await game.move({ letter });
    if (!res) return;
    const next = res.view;
    if (next.over) {
      next.won ? sfx.win() : sfx.lose();
    } else if (next.lives < view.lives) {
      sfx.bad();
    } else {
      sfx.good();
    }
  }

  function status() {
    if (!view) return '';
    if (view.over) return view.won ? 'You got it!' : `Out of lives - the word was "${view.word}".`;
    return `${view.lives} ${view.lives === 1 ? 'life' : 'lives'} left`;
  }

  return (
    <Shell
      title="Hangman"
      subtitle={view ? (view.mode === 'single' ? `category: ${view.category}` : 'a word from Player 1') : 'six lives, one word'}
      onRestart={view ? () => game.quit() : null}
      scoreboard={
        view ? (
          <>
            <span data-testid="lives">lives: {view.lives}/{view.maxLives}</span>
            <span>letters: {view.length}</span>
          </>
        ) : null
      }
    >
      {!view ? (
        <section className="panel">
          <h2>New word</h2>
          <p className="hint">In two-player mode, Player 1 types a secret word and Player 2 guesses it.</p>
          <Choice
            label="Mode"
            testid="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: '1 player (server picks)' },
              { value: 'multi', label: '2 players (you pick)' },
            ]}
          />
          {mode === 'single' ? (
            <Choice
              label="Category"
              testid="category"
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          ) : (
            <div className="field">
              <label className="field-label" htmlFor="secret-word">
                Player 1&apos;s secret word (2-20 letters, hidden as you type)
              </label>
              <input
                id="secret-word"
                type="password"
                autoComplete="off"
                value={secret}
                maxLength={20}
                placeholder="secret word"
                data-testid="secret-word"
                onChange={(e) => setSecret(e.target.value.replace(/[^a-zA-Z]/g, ''))}
              />
            </div>
          )}
          <button
            type="button"
            className="btn primary"
            data-testid="start-game"
            onClick={begin}
            disabled={game.busy || (mode === 'multi' && secret.length < 2)}
          >
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className={`status ${view.over ? (view.won ? 'win' : 'lose') : ''}`} data-testid="status">
            {status()}
          </p>

          <div className="word-mask" data-testid="mask" aria-label="the word so far">
            {view.mask.map((ch, i) => (
              <b key={i}>{ch ?? ''}</b>
            ))}
          </div>

          <div className="keyboard" data-testid="keyboard">
            {LETTERS.map((letter) => {
              const used = view.guessed.includes(letter);
              const hit = used && view.mask.includes(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  className={`key ${used ? (hit ? 'hit' : 'miss') : ''}`}
                  data-testid={`key-${letter}`}
                  disabled={used || view.over || game.busy}
                  onClick={() => guess(letter)}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {view.over ? (
            <div className="center" style={{ marginTop: 22 }}>
              <p data-testid="revealed-word">The word was <strong>{view.word}</strong>.</p>
              <button type="button" className="btn primary" data-testid="play-again" onClick={() => game.quit()}>
                New word
              </button>
            </div>
          ) : null}

          <ErrorNote error={game.error} />
        </section>
      )}
    </Shell>
  );
}
