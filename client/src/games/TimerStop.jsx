import { useEffect, useRef, useState } from 'react';
import { Shell, Choice, ErrorNote, ScoreSubmit } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const VARIANTS = [
  { value: 'stopTheClock', label: 'Stop the Clock' },
  { value: 'perfectTen', label: 'Perfect Ten' },
  { value: 'greenLight', label: 'Green Light' },
];

const seconds = (ms) => (ms / 1000).toFixed(2);

export default function TimerStop() {
  const game = useGame('timerstop');
  const [mode, setMode] = useState('single');
  const [variant, setVariant] = useState('stopTheClock');
  const [rounds, setRounds] = useState(3);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(0);
  const frame = useRef(0);
  const view = game.view;

  // Timing is measured in the browser with performance.now(); the server owns the config
  // and scores whatever we report.
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  async function begin() {
    cancelAnimationFrame(frame.current);
    setRunning(false);
    setElapsed(0);
    await game.start({ mode, variant, rounds });
  }

  function startRound() {
    if (!view || view.over || running) return;
    setElapsed(0);
    setRunning(true);
    sfx.click();
    startedAt.current = performance.now();
    const tick = () => {
      setElapsed(performance.now() - startedAt.current);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  async function stopRound() {
    if (!running) return;
    cancelAnimationFrame(frame.current);
    const ms = performance.now() - startedAt.current;
    setElapsed(ms);
    setRunning(false);
    const res = await game.move({ player: view.turn, elapsedMs: ms });
    if (!res) return;
    const list = res.view.results[view.turn];
    const latest = list[list.length - 1];
    if (latest.bust) sfx.lose();
    else if (latest.points >= 900) sfx.win();
    else sfx.good();
  }

  const config = view?.config ?? {};
  const isGreen = view?.variant === 'greenLight' && running && elapsed >= config.greenAtMs;

  function clockText() {
    if (!view) return '0.00';
    if (view.variant === 'perfectTen' && running) return '??.??';
    return seconds(elapsed);
  }

  function instruction() {
    if (!view) return '';
    if (view.over) {
      if (view.mode === 'single') return `Done - ${view.totals.p1} points.`;
      if (view.winner === 'tie') return "It's a tie!";
      return `Player ${view.winner === 'p1' ? '1' : '2'} wins!`;
    }
    const who = view.mode === 'multi' ? `Player ${view.turn === 'p1' ? '1' : '2'}: ` : '';
    if (view.variant === 'stopTheClock') return `${who}stop the clock at ${seconds(config.targetMs)}s`;
    if (view.variant === 'perfectTen') return `${who}stop at exactly 10.00s - the clock is hidden`;
    return `${who}wait for green, then stop as fast as you can`;
  }

  return (
    <Shell
      title="Timer Stop"
      subtitle={view ? VARIANTS.find((v) => v.value === view.variant)?.label : 'reactions and nerve'}
      onRestart={view ? begin : null}
      scoreboard={
        view ? (
          <>
            <span data-testid="total-p1">{view.mode === 'single' ? 'You' : 'P1'}: {view.totals.p1}</span>
            {view.mode === 'multi' ? <span data-testid="total-p2">P2: {view.totals.p2}</span> : null}
            <span>round {Math.min(view.results[view.turn].length + 1, view.rounds)}/{view.rounds}</span>
          </>
        ) : null
      }
    >
      {!view ? (
        <section className="panel">
          <h2>New run</h2>
          <p className="hint">Points are 1000 minus your error in milliseconds. Closer is better.</p>
          <Choice
            label="Mode"
            testid="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: '1 player' },
              { value: 'multi', label: '2 players, take turns' },
            ]}
          />
          <Choice label="Variation" testid="variant" value={variant} onChange={setVariant} options={VARIANTS} />
          <Choice
            label="Rounds each"
            testid="rounds"
            value={rounds}
            onChange={setRounds}
            options={[
              { value: 1, label: '1' },
              { value: 3, label: '3' },
              { value: 5, label: '5' },
            ]}
          />
          <button type="button" className="btn primary" data-testid="start-game" onClick={begin} disabled={game.busy}>
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className="status" data-testid="status">{instruction()}</p>

          {view.variant === 'greenLight' ? (
            <div className={`light ${isGreen ? 'go' : ''}`} data-testid="light" data-green={isGreen ? 'yes' : 'no'} />
          ) : (
            <p className="clock" data-testid="clock">{clockText()}</p>
          )}

          {!view.over ? (
            <div className="row center" style={{ justifyContent: 'center' }}>
              {!running ? (
                <button type="button" className="btn primary" data-testid="start-timer" onClick={startRound} disabled={game.busy}>
                  Start round
                </button>
              ) : (
                <button type="button" className="btn danger" data-testid="stop-timer" onClick={stopRound}>
                  Stop!
                </button>
              )}
            </div>
          ) : (
            <div className="center">
              {view.mode === 'single' ? (
                <ScoreSubmit game="timerstop" gameId={game.gameId} unitLabel={`${view.totals.p1} points`} />
              ) : null}
              <button type="button" className="btn primary" data-testid="play-again" onClick={begin} style={{ marginTop: 14 }}>
                Play again
              </button>
            </div>
          )}

          {view.results.p1.length || view.results.p2.length ? (
            <div className="tbl-wrap" style={{ marginTop: 22 }}>
              <table data-testid="results">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th className="mono">Stopped</th>
                    <th className="mono">Error</th>
                    <th className="mono">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {view.players.flatMap((player) =>
                    view.results[player].map((row, i) => (
                      <tr key={`${player}-${i}`} data-testid={`result-${player}-${i}`}>
                        <td className="mono">{i + 1}</td>
                        <td>{view.mode === 'single' ? 'You' : player === 'p1' ? 'P1' : 'P2'}</td>
                        <td className="mono">{seconds(row.elapsedMs)}s</td>
                        <td className="mono">{row.bust ? 'too early' : `${Math.round(row.errorMs)}ms`}</td>
                        <td className="mono">{row.points}</td>
                      </tr>
                    )),
                  )}
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
