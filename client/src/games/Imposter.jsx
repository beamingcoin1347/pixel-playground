import { useState } from 'react';
import { Shell, Choice, ErrorNote } from '../components/ui.jsx';
import { useGame } from '../useGame.js';
import { sfx } from '../sound.js';

const maxImpostersFor = (playerCount) => Math.max(1, Math.floor((playerCount - 1) / 2));

export default function Imposter() {
  const game = useGame('imposter');
  const [playerCount, setPlayerCount] = useState(4);
  const [imposterCount, setImposterCount] = useState(1);
  const [card, setCard] = useState(null); // the word currently face-up on screen
  const view = game.view;

  async function begin() {
    setCard(null);
    await game.start({ mode: 'multi', playerCount, imposterCount: Math.min(imposterCount, maxImpostersFor(playerCount)) });
  }

  const nextSeat = view ? view.revealed.length : 0;
  const voterSeat = view ? view.votesCast : 0;

  async function showCard() {
    const res = await game.move({ type: 'reveal', playerIndex: nextSeat });
    if (res?.extra) {
      setCard({ index: res.extra.playerIndex, word: res.extra.word });
      sfx.click();
    }
  }

  async function startVote() {
    await game.move({ type: 'startVote' });
    sfx.click();
  }

  async function vote(targetIndex) {
    const res = await game.move({ type: 'vote', voterIndex: voterSeat, targetIndex });
    if (!res) return;
    if (res.view.phase === 'result') {
      res.view.result.winner === 'civilians' ? sfx.win() : sfx.lose();
    } else {
      sfx.click();
    }
  }

  function heading() {
    if (!view) return '';
    // A face-up card outranks the phase: the final reveal flips the phase to discuss, and that
    // player still has to see their word before passing on.
    if (card) return `${view.names[card.index]}, memorise your word`;
    if (view.phase === 'reveal') return `Pass the device to ${view.names[nextSeat]}`;
    if (view.phase === 'discuss') return 'Everyone has seen their word - talk it out';
    if (view.phase === 'vote') return `${view.names[voterSeat]}, cast your vote`;
    return view.result.winner === 'civilians' ? 'Civilians win!' : 'Imposters win!';
  }

  return (
    <Shell
      title="Guess the Imposter"
      subtitle={view ? `${view.playerCount} players, ${view.imposterCount} imposter${view.imposterCount > 1 ? 's' : ''}` : 'same-screen social deduction'}
      onRestart={view ? () => game.quit() : null}
      scoreboard={view ? <span data-testid="phase">phase: {view.phase}</span> : null}
    >
      {!view ? (
        <section className="panel">
          <h2>New round</h2>
          <p className="hint">
            Everyone shares one word except the imposter(s), who get a similar-but-different decoy. Nobody is
            told which they are. Civilians only win on a clean, non-tied vote that lands on an imposter.
          </p>
          <Choice
            label="Players"
            testid="players"
            value={playerCount}
            onChange={(n) => {
              setPlayerCount(n);
              setImposterCount((c) => Math.min(c, maxImpostersFor(n)));
            }}
            options={[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: String(n) }))}
          />
          <Choice
            label="Imposters"
            testid="imposters"
            value={imposterCount}
            onChange={setImposterCount}
            options={Array.from({ length: maxImpostersFor(playerCount) }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
          />
          <button type="button" className="btn primary" data-testid="start-game" onClick={begin} disabled={game.busy}>
            Start
          </button>
          <ErrorNote error={game.error} />
        </section>
      ) : (
        <section className="panel">
          <p className="status" data-testid="status">{heading()}</p>

          {/* The face-up card is checked before the phase - see heading() for why. */}
          {card ? (
            <div className="center">
              <div className="card-face pop" data-testid="card">
                <p className="muted">{view.names[card.index]}, your word is</p>
                <p className="word" data-testid="card-word">{card.word}</p>
              </div>
              <button type="button" className="btn primary" data-testid="hide-card" onClick={() => setCard(null)}>
                Hide &amp; pass on
              </button>
            </div>
          ) : null}

          {!card && view.phase === 'reveal' ? (
            <div className="center">
              <p className="muted" data-testid="reveal-progress">
                {view.revealed.length} of {view.playerCount} cards seen
              </p>
              <button type="button" className="btn primary" data-testid="show-card" onClick={showCard} disabled={game.busy}>
                Show {view.names[nextSeat]}&apos;s word
              </button>
            </div>
          ) : null}

          {!card && view.phase === 'discuss' ? (
            <div className="center">
              <p className="muted">
                Take turns giving a one-word clue about your word. Then vote on who sounds off.
              </p>
              <button type="button" className="btn primary" data-testid="start-vote" onClick={startVote} disabled={game.busy}>
                Start the vote
              </button>
            </div>
          ) : null}

          {!card && view.phase === 'vote' ? (
            <div className="seat-list" data-testid="vote-list">
              {view.names.map((name, index) =>
                index === voterSeat ? null : (
                  <div className="seat" key={index}>
                    <span>{name}</span>
                    <button
                      type="button"
                      className="btn ghost"
                      data-testid={`vote-${index}`}
                      onClick={() => vote(index)}
                      disabled={game.busy}
                    >
                      Vote
                    </button>
                  </div>
                ),
              )}
              <p className="muted center" data-testid="votes-cast">
                {view.votesCast} of {view.playerCount} votes cast
              </p>
            </div>
          ) : null}

          {!card && view.phase === 'result' ? (
            <div>
              <div className={`banner ${view.result.winner}`} data-testid="result-banner">
                {view.result.winner === 'civilians' ? 'Civilians win!' : 'Imposters win!'}
              </div>
              <p className="center" data-testid="result-detail">
                {view.result.tie
                  ? 'The vote tied, so the imposters walked free.'
                  : `${view.names[view.result.ejected]} was ejected - ${view.result.caught ? 'an imposter!' : 'a civilian.'}`}
              </p>
              <p className="center">
                Word: <strong data-testid="result-word">{view.word}</strong> &middot; decoy:{' '}
                <strong data-testid="result-decoy">{view.decoy}</strong>
              </p>
              <p className="center muted" data-testid="result-imposters">
                Imposter{view.imposterIndexes.length > 1 ? 's' : ''}:{' '}
                {view.imposterIndexes.map((i) => view.names[i]).join(', ')}
              </p>
              <div className="center" style={{ marginTop: 18 }}>
                <button type="button" className="btn primary" data-testid="play-again" onClick={() => game.quit()}>
                  New round
                </button>
              </div>
            </div>
          ) : null}

          <ErrorNote error={game.error} />
        </section>
      )}
    </Shell>
  );
}
