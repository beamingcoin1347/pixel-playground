import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { isMuted, setMuted, onMuteChange, sfx } from '../sound.js';

/** Consistent shell for every game: back link, title, restart, mute, optional scoreboard. */
export function Shell({ game, title, subtitle, onRestart, scoreboard, children }) {
  const [muted, setLocalMuted] = useState(isMuted);
  useEffect(() => onMuteChange(setLocalMuted), []);

  return (
    <div className="shell" data-game={game}>
      <header className="shell-bar">
        <Link className="btn ghost" to="/" data-testid="back-to-lobby" onClick={() => sfx.click()}>
          &larr; Lobby
        </Link>
        <div className="shell-title">
          <h1 data-testid="game-title">{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="shell-actions">
          {onRestart ? (
            <button type="button" className="btn ghost" data-testid="restart" onClick={onRestart}>
              Restart
            </button>
          ) : null}
          <button
            type="button"
            className="btn ghost"
            data-testid="mute-toggle"
            aria-pressed={muted}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            onClick={() => {
              setMuted(!muted);
              if (muted) sfx.click();
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>
      {scoreboard ? <div className="scoreboard" data-testid="scoreboard">{scoreboard}</div> : null}
      <main className="shell-body">{children}</main>
    </div>
  );
}

/** Button-group field. `testid` gets the option value appended: mode-single, mode-multi, ... */
export function Choice({ label, value, options, onChange, testid, disabled }) {
  return (
    <div className="field">
      <span className="field-label" id={`${testid}-label`}>{label}</span>
      <div className="choices" role="group" aria-labelledby={`${testid}-label`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={'chip' + (value === option.value ? ' on' : '')}
            data-testid={`${testid}-${option.value}`}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => {
              sfx.click();
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="error" role="alert" data-testid="error">
      {error}
    </p>
  );
}

/** Name entry + submit for the two games that keep a leaderboard. */
export function ScoreSubmit({ game, gameId, unitLabel, onDone }) {
  const [name, setName] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  if (state === 'done') {
    return <p className="center muted" data-testid="score-saved">Score saved to the leaderboard.</p>;
  }

  async function submit(event) {
    event.preventDefault();
    setState('busy');
    setError(null);
    try {
      await api.submitScore(game, { gameId, name });
      setState('done');
      sfx.good();
      onDone?.();
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  }

  return (
    <form className="row center" onSubmit={submit} style={{ justifyContent: 'center', marginTop: 14 }}>
      <label className="field-label" htmlFor="score-name" style={{ marginBottom: 0 }}>
        {unitLabel} - save it
      </label>
      <input
        id="score-name"
        type="text"
        maxLength={16}
        placeholder="your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="score-name"
      />
      <button type="submit" className="btn primary" data-testid="score-submit" disabled={state === 'busy'}>
        Save
      </button>
      <ErrorNote error={error} />
    </form>
  );
}
