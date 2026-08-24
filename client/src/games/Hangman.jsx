import { useState } from 'react';
import { Shell, Choice, ErrorNote } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const CATEGORIES = ['random', 'animals', 'food', 'space', 'computing', 'sports'];

/**
 * The gallows. Six wrong guesses build the figure one limb at a time, in this order, so the
 * drawing itself is the life counter - you can read how much trouble you are in at a glance.
 */
function Gallows({ wrong, doomed }) {
  const parts = [
    <circle key="head" className="part head" cx="132" cy="62" r="17" />,
    <line key="body" className="part" x1="132" y1="79" x2="132" y2="134" />,
    <line key="arm-l" className="part" x1="132" y1="92" x2="106" y2="116" />,
    <line key="arm-r" className="part" x1="132" y1="92" x2="158" y2="116" />,
    <line key="leg-l" className="part" x1="132" y1="134" x2="109" y2="172" />,
    <line key="leg-r" className="part" x1="132" y1="134" x2="155" y2="172" />,
  ];

  return (
    <svg
      className={`gallows ${doomed ? 'doomed' : ''}`}
      viewBox="0 0 200 210"
      role="img"
      aria-label={`Gallows with ${wrong} of 6 body parts drawn`}
      data-testid="gallows"
      data-wrong={wrong}
    >
      {/* the frame is always there; only the figure grows */}
      <line className="frame" x1="24" y1="200" x2="112" y2="200" />
      <line className="frame" x1="48" y1="200" x2="48" y2="18" />
      <line className="frame" x1="48" y1="18" x2="132" y2="18" />
      <line className="frame" x1="48" y1="42" x2="72" y2="18" />
      <line className="rope" x1="132" y1="18" x2="132" y2="45" />
      {parts.slice(0, wrong)}
    </svg>
  );
}

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
      if (next.won) sfx.win();
      else sfx.lose();
    } else if (next.lives < view.lives) {
      sfx.bad();
    } else {
      sfx.good();
    }
  }

  const wrong = view ? view.maxLives - view.lives : 0;

  function status() {
    if (!view) return '';
    if (view.over) return view.won ? 'You saved them!' : 'Out of lives.';
    if (view.lives === 1) return 'One life left - choose carefully';
    return `${view.lives} lives left`;
  }

  return (
    <Shell
      game="hangman"
      title="Hangman"
      subtitle={view ? (view.mode === 'single' ? `category: ${view.category}` : 'a word from Player 1') : 'six lives, one word'}
      onRestart={view ? () => game.quit() : null}
      scoreboard={
        view ? (
          <>
            <span data-testid="lives">lives: {view.lives}/{view.maxLives}</span>
            <span>letters: {view.length}</span>
            <span>guessed: {view.guessed.length}</span>
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
            className="btn primary big"
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

          <div className="hangman-stage">
            <Gallows wrong={wrong} doomed={view.over && !view.won} />
            <div>
              <div className="word-mask" data-testid="mask" aria-label="the word so far">
                {view.mask.map((ch, i) => (
                  <b key={i} className={ch ? 'filled' : ''}>{ch ?? ''}</b>
                ))}
              </div>
              <div className="lives-pips" aria-hidden="true">
                {Array.from({ length: view.maxLives }, (_, i) => (
                  <i key={i} className={i < wrong ? 'gone' : ''} />
                ))}
              </div>
            </div>
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
            <div className="center" style={{ marginTop: 24 }}>
              <p data-testid="revealed-word" style={{ fontSize: 18 }}>
                The word was <strong style={{ color: 'var(--neon-3)' }}>{view.word}</strong>.
              </p>
              <button type="button" className="btn primary big" data-testid="play-again" onClick={() => game.quit()}>
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
