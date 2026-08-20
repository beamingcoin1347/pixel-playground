import { useState } from 'react';
import { Shell, Choice, ErrorNote } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const THROWS = [
  { value: 'rock', label: 'Rock', emoji: '✊' },
  { value: 'paper', label: 'Paper', emoji: '✋' },
  { value: 'scissors', label: 'Scissors', emoji: '✌️' },
];

const emojiOf = (name) => THROWS.find((t) => t.value === name)?.emoji ?? '';

export default function Rps() {
  const game = useGame('rps');
  const [mode, setMode] = useState('single');
  const [target, setTarget] = useState(3);
  const view = game.view;

  async function begin() {
    await game.start({ mode, target });
  }

  // In multiplayer the server tells us who has already locked a throw in; the throw itself
  // is never sent to the browser, which is what makes pass-and-play safe.
  const seat = view?.pendingPlayer === 'p1' ? 'p2' : 'p1';

  async function throwHand(choice) {
    if (!view || view.over || game.busy) return;
    const res = await game.move(view.mode === 'single' ? { choice } : { player: seat, choice });
    if (!res) return;
    const next = res.view;
    if (next.over) {
      if (next.mode === 'single') next.winner === 'p1' ? sfx.win() : sfx.lose();
      else sfx.win();
      return;
    }
    const last = next.rounds[next.rounds.length - 1];
    if (!last || next.rounds.length === view.rounds.length) {
      sfx.click(); // first pick of a pass-and-play round
    } else if (last.winner === null) {
      sfx.bad();
    } else if (next.mode === 'single') {
      last.winner === 'p1' ? sfx.good() : sfx.bad();
    } else {
      sfx.good();
    }
  }

  const last = view?.rounds[view.rounds.length - 1];

  function prompt() {
    if (!view) return '';
    if (view.over) {
      if (view.mode === 'single') return view.winner === 'p1' ? 'You win the match!' : 'The bot wins the match.';
      return `Player ${view.winner === 'p1' ? '1' : '2'} wins the match!`;
    }
    if (view.mode === 'single') return 'Pick your throw';
    return seat === 'p1' ? 'Player 1: pick (Player 2, look away)' : 'Player 2: pick (Player 1, look away)';
  }

  return (
    <Shell
      title="Rock-Paper-Scissors"
      subtitle={view ? `first to ${view.target}` : 'first to N wins the match'}
      onRestart={view ? begin : null}
      scoreboard={
        view ? (
          <>
            <span data-testid="score-p1">{view.mode === 'single' ? 'You' : 'P1'}: {view.scores.p1}</span>
            <span data-testid="score-p2">{view.mode === 'single' ? 'Bot' : 'P2'}: {view.scores.p2}</span>
            <span>rounds: {view.rounds.length}</span>
          </>
        ) : null
      }
    >
      {!view ? (
        <section className="panel">
          <h2>New match</h2>
          <p className="hint">The bot throws randomly for three rounds, then counters your most frequent pick.</p>
          <Choice
            label="Mode"
            testid="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: '1 player vs bot' },
              { value: 'multi', label: '2 players, pass and play' },
            ]}
          />
          <Choice
            label="Match length"
            testid="target"
            value={target}
            onChange={setTarget}
            options={[
              { value: 1, label: 'First to 1' },
              { value: 3, label: 'First to 3' },
              { value: 5, label: 'First to 5' },
            ]}
          />
          <button type="button" className="btn primary" data-testid="start-game" onClick={begin} disabled={game.busy}>
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className="status" data-testid="status">{prompt()}</p>

          {!view.over ? (
            <div className="rps-throws" data-testid="throws">
              {THROWS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className="rps-throw"
                  data-testid={`throw-${t.value}`}
                  disabled={game.busy}
                  onClick={() => throwHand(t.value)}
                >
                  <span aria-hidden="true">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="center">
              <button type="button" className="btn primary" data-testid="play-again" onClick={begin}>
                Play again
              </button>
            </div>
          )}

          {last ? (
            <p className="center" data-testid="last-round" style={{ marginTop: 20, fontSize: 18 }}>
              {emojiOf(last.p1)} vs {emojiOf(last.p2)} &mdash;{' '}
              {last.winner === null ? 'tie' : `${last.winner === 'p1' ? (view.mode === 'single' ? 'you' : 'P1') : view.mode === 'single' ? 'bot' : 'P2'} took it`}
            </p>
          ) : null}

          {view.rounds.length ? (
            <div className="tbl-wrap" style={{ marginTop: 16 }}>
              <table data-testid="rounds">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{view.mode === 'single' ? 'You' : 'P1'}</th>
                    <th>{view.mode === 'single' ? 'Bot' : 'P2'}</th>
                    <th>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rounds.map((round, i) => (
                    <tr key={i}>
                      <td className="mono">{i + 1}</td>
                      <td>{emojiOf(round.p1)} {round.p1}</td>
                      <td>{emojiOf(round.p2)} {round.p2}</td>
                      <td>{round.winner === null ? 'tie' : round.winner === 'p1' ? 'P1' : 'P2'}</td>
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
