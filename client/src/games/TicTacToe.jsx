import { useState } from 'react';
import { Shell, Choice, ErrorNote } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

export default function TicTacToe() {
  const game = useGame('tictactoe');
  const [mode, setMode] = useState('single');
  const [difficulty, setDifficulty] = useState('medium');
  const view = game.view;

  async function begin() {
    await game.start({ mode, difficulty });
  }

  async function play(index) {
    if (!view || view.over || game.busy) return;
    const res = await game.move({ index });
    if (!res) return;
    const next = res.view;
    if (!next.over) {
      sfx.place();
    } else if (next.draw) {
      sfx.bad();
    } else if (next.mode === 'single' && next.winner === 'O') {
      sfx.lose();
    } else {
      sfx.win();
    }
  }

  function status() {
    if (!view) return '';
    if (view.winner) {
      if (view.mode === 'single') return view.winner === 'X' ? 'You win!' : 'The bot wins.';
      return `Player ${view.winner} wins!`;
    }
    if (view.draw) return "It's a draw.";
    if (view.mode === 'single') return view.turn === 'X' ? 'Your turn (X)' : 'Bot thinking...';
    return `Player ${view.turn}'s turn`;
  }

  const statusClass =
    view?.winner && view.mode === 'single' ? (view.winner === 'X' ? 'win' : 'lose') : '';

  return (
    <Shell
      game="tictactoe"
      title="Tic-Tac-Toe"
      subtitle={view ? (view.mode === 'single' ? `vs bot (${view.difficulty})` : 'pass and play') : 'Three in a row'}
      onRestart={view ? begin : null}
      scoreboard={view ? <span>{view.mode === 'single' ? `difficulty: ${view.difficulty}` : '2 players'}</span> : null}
    >
      {!view ? (
        <section className="panel">
          <h2>New game</h2>
          <p className="hint">Single player puts you as X against a server-side bot.</p>
          <Choice
            label="Mode"
            testid="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: '1 player vs bot' },
              { value: 'multi', label: '2 players, one board' },
            ]}
          />
          {mode === 'single' ? (
            <Choice
              label="Bot difficulty"
              testid="difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard (unbeatable)' },
              ]}
            />
          ) : null}
          <button type="button" className="btn primary" data-testid="start-game" onClick={begin} disabled={game.busy}>
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className={`status ${statusClass}`} data-testid="status">{status()}</p>
          <div className="ttt-board" data-testid="board">
            {view.board.map((cell, index) => {
              const winning = view.line?.includes(index);
              const mark = cell ? cell.toLowerCase() : '';
              return (
                <button
                  key={index}
                  type="button"
                  className={`ttt-cell ${mark} ${winning ? 'win' : ''}`}
                  data-testid={`cell-${index}`}
                  aria-label={`cell ${index + 1}${cell ? `, ${cell}` : ', empty'}`}
                  disabled={Boolean(cell) || view.over || game.busy}
                  onClick={() => play(index)}
                >
                  {cell ?? ''}
                </button>
              );
            })}
          </div>
          {view.over ? (
            <div className="center" style={{ marginTop: 22 }}>
              <button type="button" className="btn primary" data-testid="play-again" onClick={begin}>
                Play again
              </button>
            </div>
          ) : null}
          <ErrorNote error={game.error} />
        </section>
      )}
    </Shell>
  );
}
