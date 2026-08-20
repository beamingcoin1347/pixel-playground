import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { GAME_META, GAME_ORDER } from './games/meta.js';
import { sfx } from './sound.js';

function LeaderboardPanel() {
  const [boards, setBoards] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.leaderboard('bullscows'), api.leaderboard('timerstop')])
      .then(([bc, ts]) => {
        if (alive) setBoards({ bullscows: bc.scores, timerstop: ts.scores });
      })
      .catch(() => {
        if (alive) setBoards({ bullscows: [], timerstop: [] });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!boards) return null;
  const empty = !boards.bullscows.length && !boards.timerstop.length;

  return (
    <section className="panel" data-testid="leaderboards" style={{ marginTop: 26 }}>
      <h2>Leaderboards</h2>
      <p className="hint">Bulls &amp; Cows counts guesses (fewer is better). Timer Stop counts points.</p>
      {empty ? (
        <p className="muted" data-testid="leaderboard-empty">No scores yet - go set one.</p>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Player</th>
                <th className="mono">Score</th>
              </tr>
            </thead>
            <tbody>
              {['bullscows', 'timerstop'].flatMap((game) =>
                boards[game].map((entry, i) => (
                  <tr key={`${game}-${i}`}>
                    <td>{GAME_META[game].title}</td>
                    <td>{entry.name}</td>
                    <td className="mono">
                      {entry.score} {entry.unit}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Lobby() {
  const [catalogue, setCatalogue] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .catalogue()
      .then((res) => alive && setCatalogue(res.games))
      .catch(() => alive && setCatalogue([]));
    return () => {
      alive = false;
    };
  }, []);

  const modesFor = (name) => catalogue?.find((g) => g.name === name)?.modes ?? ['single', 'multi'];

  return (
    <div className="shell">
      <header className="masthead">
        <h1>Pixel Playground</h1>
        <p>Six minigames. Play the bots solo, or pass the device around.</p>
      </header>

      <div className="game-grid" data-testid="game-grid">
        {GAME_ORDER.map((name) => {
          const meta = GAME_META[name];
          const modes = modesFor(name);
          return (
            <Link
              key={name}
              to={`/game/${name}`}
              className="game-card"
              data-testid={`game-link-${name}`}
              onClick={() => sfx.click()}
            >
              <span className="emoji" aria-hidden="true">{meta.emoji}</span>
              <h3>{meta.title}</h3>
              <p>{meta.blurb}</p>
              <div className="tags">
                {modes.includes('single') ? <span className="tag">1P vs bots</span> : null}
                {modes.includes('multi') ? <span className="tag">same screen</span> : null}
              </div>
            </Link>
          );
        })}
      </div>

      <LeaderboardPanel />
    </div>
  );
}
