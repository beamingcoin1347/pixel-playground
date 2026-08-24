import { useState } from 'react';
import { Shell, Choice, ErrorNote, ScoreSubmit } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const onlyDigits = (value) => value.replace(/\D/g, '').slice(0, 4);

export default function BullsCows() {
  const game = useGame('bullscows');
  const [mode, setMode] = useState('single');
  const [secrets, setSecrets] = useState({ p1: '', p2: '' });
  const [guess, setGuess] = useState('');
  const view = game.view;

  async function begin() {
    const res = mode === 'multi' ? await game.start({ mode, secrets }) : await game.start({ mode });
    if (res) {
      setSecrets({ p1: '', p2: '' });
      setGuess('');
    }
  }

  async function submitGuess(event) {
    event.preventDefault();
    if (!view || view.over || game.busy || guess.length !== 4) return;
    const res = await game.move({ player: view.turn, guess });
    if (!res) return;
    setGuess('');
    const next = res.view;
    if (next.over) sfx.win();
    else {
      const list = next.guesses[view.turn];
      const latest = list[list.length - 1];
      latest.bulls > 0 ? sfx.good() : sfx.bad();
    }
  }

  function status() {
    if (!view) return '';
    if (view.over) {
      if (view.mode === 'single') return `Cracked it in ${view.attempts.p1} guesses!`;
      return `Player ${view.winner === 'p1' ? '1' : '2'} cracked the code!`;
    }
    if (view.mode === 'single') return 'Guess the four-digit code (digits can repeat)';
    return `Player ${view.turn === 'p1' ? '1' : '2'}: guess your opponent's code`;
  }

  const activeGuesses = view ? view.guesses[view.turn] : [];
  const canStartMulti = secrets.p1.length === 4 && secrets.p2.length === 4;

  return (
    <Shell
      game="bullscows"
      title="Bulls & Cows"
      subtitle={view ? (view.mode === 'single' ? 'crack the server code' : 'crack each other') : 'four digits, bulls and cows'}
      onRestart={view ? () => game.quit() : null}
      scoreboard={
        view ? (
          <>
            <span data-testid="attempts">guesses: {view.attempts[view.turn]}</span>
            {view.mode === 'multi' ? <span>turn: P{view.turn === 'p1' ? '1' : '2'}</span> : null}
          </>
        ) : null
      }
    >
      {!view ? (
        <section className="panel">
          <h2>New code</h2>
          <p className="hint">
            A bull is the right digit in the right place; a cow is the right digit in the wrong place.
          </p>
          <Choice
            label="Mode"
            testid="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: '1 player vs server code' },
              { value: 'multi', label: '2 players, dual secrets' },
            ]}
          />
          {mode === 'multi' ? (
            <div className="stack">
              <div className="field">
                <label className="field-label" htmlFor="secret-p1">Player 1 secret (4 digits, hidden)</label>
                <input
                  id="secret-p1"
                  type="password"
                  inputMode="numeric"
                  className="code"
                  autoComplete="off"
                  value={secrets.p1}
                  data-testid="secret-p1"
                  onChange={(e) => setSecrets((s) => ({ ...s, p1: onlyDigits(e.target.value) }))}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="secret-p2">Player 2 secret (4 digits, hidden)</label>
                <input
                  id="secret-p2"
                  type="password"
                  inputMode="numeric"
                  className="code"
                  autoComplete="off"
                  value={secrets.p2}
                  data-testid="secret-p2"
                  onChange={(e) => setSecrets((s) => ({ ...s, p2: onlyDigits(e.target.value) }))}
                />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="btn primary"
            data-testid="start-game"
            onClick={begin}
            disabled={game.busy || (mode === 'multi' && !canStartMulti)}
          >
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className={`status ${view.over ? 'win' : ''}`} data-testid="status">{status()}</p>

          {!view.over ? (
            <form className="row" onSubmit={submitGuess} style={{ justifyContent: 'center' }}>
              <input
                type="text"
                inputMode="numeric"
                className="code"
                aria-label="your four digit guess"
                value={guess}
                data-testid="guess-input"
                onChange={(e) => setGuess(onlyDigits(e.target.value))}
              />
              <button type="submit" className="btn primary" data-testid="guess-submit" disabled={guess.length !== 4 || game.busy}>
                Guess
              </button>
            </form>
          ) : (
            <div className="center">
              {view.codes ? (
                <p data-testid="revealed-code">
                  The code was <strong className="mono">{view.mode === 'single' ? view.codes.p2 : view.codes[view.winner === 'p1' ? 'p2' : 'p1']}</strong>.
                </p>
              ) : null}
              {view.mode === 'single' && view.winner === 'p1' ? (
                <ScoreSubmit game="bullscows" gameId={game.gameId} unitLabel={`${view.attempts.p1} guesses`} />
              ) : null}
              <button type="button" className="btn primary" data-testid="play-again" onClick={() => game.quit()} style={{ marginTop: 14 }}>
                New code
              </button>
            </div>
          )}

          {activeGuesses.length ? (
            <div className="tbl-wrap" style={{ marginTop: 20 }}>
              <table data-testid="guess-table">
                <thead>
                  <tr>
                    <th className="mono">#</th>
                    <th className="mono">Guess</th>
                    <th>Bulls</th>
                    <th>Cows</th>
                  </tr>
                </thead>
                <tbody>
                  {activeGuesses.map((row, i) => (
                    <tr key={i} data-testid={`guess-row-${i}`}>
                      <td className="mono">{i + 1}</td>
                      <td className="mono">{row.guess}</td>
                      <td data-testid={`bulls-${i}`}>{row.bulls}</td>
                      <td data-testid={`cows-${i}`}>{row.cows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <ErrorNote error={game.error} />
        </section>
      )}
    </Shell>
  );
}
