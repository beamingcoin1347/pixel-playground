import { useEffect, useRef, useState } from 'react';
import { Shell, Choice, ErrorNote, ScoreSubmit } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const VARIANTS = [
  { value: 'stopTheClock', label: 'Stop the Clock' },
  { value: 'blindStop', label: 'Blind Stop' },
  { value: 'greenLight', label: 'Green Light' },
];

const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;

const seconds = (ms) => (ms / 1000).toFixed(2);
const labelOf = (v) => VARIANTS.find((x) => x.value === v)?.label ?? v;

export default function TimerStop() {
  const game = useGame('timerstop');
  const [mode, setMode] = useState('single');
  const [variant, setVariant] = useState('stopTheClock');
  const [rounds, setRounds] = useState(3);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(0);
  const frame = useRef(0);
  const wentGreen = useRef(false);
  const view = game.view;

  // Timing is measured in the browser with performance.now(); the server owns the config,
  // scores the attempt, and validates whatever we report.
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
    wentGreen.current = false;
    sfx.click();
    startedAt.current = performance.now();
    const tick = () => {
      const now = performance.now() - startedAt.current;
      setElapsed(now);
      // One chirp the instant the light turns green - the audio cue players actually react to.
      if (view.variant === 'greenLight' && !wentGreen.current && now >= view.config.greenAtMs) {
        wentGreen.current = true;
        sfx.good();
      }
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
  const isGreenLight = view?.variant === 'greenLight';
  const isBlind = view?.variant === 'blindStop';
  const lightIsGreen = isGreenLight && running && elapsed >= config.greenAtMs;

  // Blind Stop deliberately gets no progress ring - a filling ring would leak the elapsed time.
  const progress = view && !isGreenLight && !isBlind ? Math.min(elapsed / config.targetMs, 1.35) : 0;
  const overshot = progress > 1;

  function instruction() {
    if (!view) return '';
    if (view.over) {
      if (view.mode === 'single') return `Run complete - ${view.totals.p1} points`;
      if (view.winner === 'tie') return "It's a tie!";
      return `Player ${view.winner === 'p1' ? '1' : '2'} wins!`;
    }
    const who = view.mode === 'multi' ? `Player ${view.turn === 'p1' ? '1' : '2'}: ` : '';
    if (view.variant === 'stopTheClock') return `${who}stop the clock on the target`;
    if (view.variant === 'blindStop') return `${who}stop on the target - with the clock hidden`;
    return `${who}wait for green, then stop as fast as you can`;
  }

  const measure = view?.measures ?? 'errorMs'; // 'errorMs' for the clock games, 'reactionMs' for green light
  const best = view?.best?.[view.turn] ?? null;
  const roundNo = view ? Math.min(view.results[view.turn].length + 1, view.rounds) : 0;

  return (
    <Shell
      game="timerstop"
      title="Timer Stop"
      subtitle={view ? labelOf(view.variant) : 'reactions and nerve'}
      onRestart={view ? begin : null}
      scoreboard={
        view ? (
          <>
            <span data-testid="total-p1">{view.mode === 'single' ? 'You' : 'P1'}: {view.totals.p1}</span>
            {view.mode === 'multi' ? <span data-testid="total-p2">P2: {view.totals.p2}</span> : null}
            <span>round {roundNo}/{view.rounds}</span>
          </>
        ) : null
      }
    >
      {!view ? (
        <section className="panel">
          <h2>New run</h2>
          <p className="hint">
            Points are 1000 minus your miss in milliseconds. Every target is drawn fresh each run,
            so you cannot learn one number and repeat it.
          </p>
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
          <p className="hint" data-testid="variant-blurb" style={{ marginTop: -8 }}>
            {variant === 'stopTheClock'
              ? 'A random target between 3.00s and 9.00s. The clock is visible - this one is about precision.'
              : variant === 'blindStop'
                ? 'A random target between 4.00s and 12.00s, and the clock is hidden. Count it in your head.'
                : 'The light turns green at a random moment between 1.00s and 4.00s. Tap early and you bust.'}
          </p>
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
          <button type="button" className="btn primary big" data-testid="start-game" onClick={begin} disabled={game.busy}>
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className="status" data-testid="status">{instruction()}</p>

          <div className="timer-stage">
            {isGreenLight ? (
              <>
                <div className="traffic">
                  <div className={`lamp red ${running && !lightIsGreen ? 'on' : ''}`} />
                  <div
                    className={`lamp green ${lightIsGreen ? 'on' : ''}`}
                    data-testid="light"
                    data-green={lightIsGreen ? 'yes' : 'no'}
                  />
                </div>
                <div className="go-word" data-testid="go-word">
                  {lightIsGreen ? 'GO!' : running ? 'wait…' : ''}
                </div>
              </>
            ) : (
              <>
                <div className="ring-wrap">
                  <svg viewBox="0 0 236 236" aria-hidden="true">
                    <circle className="ring-track" cx="118" cy="118" r={RING_R} />
                    {!isBlind ? (
                      <circle
                        className={`ring-fill ${overshot ? 'over' : ''}`}
                        cx="118"
                        cy="118"
                        r={RING_R}
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - Math.min(progress, 1))}
                      />
                    ) : null}
                  </svg>
                  <div className="ring-face">
                    <p className={`clock ${isBlind && running ? 'blind' : ''}`} data-testid="clock">
                      {isBlind && running ? '??.??' : seconds(elapsed)}
                    </p>
                    <span className="clock-sub">{running ? 'running' : 'ready'}</span>
                    {isBlind && running ? <span className="pulse-dot" /> : null}
                  </div>
                </div>
                <span className="target-badge" data-testid="target">
                  target {seconds(config.targetMs)}s
                </span>
              </>
            )}
          </div>

          {!view.over ? (
            <div className="row center" style={{ justifyContent: 'center' }}>
              {!running ? (
                <button type="button" className="btn primary big" data-testid="start-timer" onClick={startRound} disabled={game.busy}>
                  Start round {roundNo}
                </button>
              ) : (
                <button type="button" className="btn danger big" data-testid="stop-timer" onClick={stopRound}>
                  STOP
                </button>
              )}
            </div>
          ) : (
            <div className="center">
              {view.mode === 'single' ? (
                <ScoreSubmit game="timerstop" gameId={game.gameId} unitLabel={`${view.totals.p1} points`} />
              ) : null}
              <button type="button" className="btn primary big" data-testid="play-again" onClick={begin} style={{ marginTop: 14 }}>
                Play again
              </button>
            </div>
          )}

          {view.results[view.turn].length ? (
            <div className="stat-strip" data-testid="stats">
              <div className="stat">
                <b>{view.totals[view.turn]}</b>
                <span>points</span>
              </div>
              <div className={`stat ${best ? 'good' : ''}`}>
                <b data-testid="best">{best ? `${Math.round(best[measure])}ms` : '—'}</b>
                <span>{measure === 'reactionMs' ? 'best reaction' : 'closest'}</span>
              </div>
              <div className="stat">
                <b>{view.results[view.turn].length}/{view.rounds}</b>
                <span>rounds</span>
              </div>
            </div>
          ) : null}

          {view.results.p1.length || view.results.p2.length ? (
            <div className="tbl-wrap" style={{ marginTop: 18 }}>
              <table data-testid="results">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    {/* Green Light measures reaction AFTER the light. Showing wall-clock time or
                        calling that reaction an "error" is what made this table read wrong. */}
                    {measure === 'reactionMs' ? (
                      <th className="mono" data-testid="measure-head">Reaction</th>
                    ) : (
                      <>
                        <th className="mono">Stopped</th>
                        <th className="mono" data-testid="measure-head">Error</th>
                      </>
                    )}
                    <th className="mono">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {view.players.flatMap((player) =>
                    view.results[player].map((row, i) => (
                      <tr key={`${player}-${i}`} data-testid={`result-${player}-${i}`} className={row.bust ? 'bust' : ''}>
                        <td className="mono">{i + 1}</td>
                        <td>{view.mode === 'single' ? 'You' : player === 'p1' ? 'P1' : 'P2'}</td>
                        {measure === 'reactionMs' ? (
                          <td className="mono">{row.bust ? 'jumped the gun' : `${Math.round(row.reactionMs)}ms`}</td>
                        ) : (
                          <>
                            <td className="mono">{seconds(row.elapsedMs)}s</td>
                            <td className="mono">{`${Math.round(row.errorMs)}ms`}</td>
                          </>
                        )}
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
