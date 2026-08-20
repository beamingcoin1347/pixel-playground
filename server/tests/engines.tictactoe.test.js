import { describe, it, expect } from 'vitest';
import { createState, applyMove, winnerOf, publicView } from '../src/engines/tictactoe.js';
import { chooseMove } from '../src/ai/tictactoeBot.js';

const zeroRng = () => 0;

describe('tic-tac-toe engine', () => {
  it('starts with an empty board and X to move', () => {
    const state = createState({ mode: 'single', difficulty: 'hard' });
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.turn).toBe('X');
    expect(publicView(state).over).toBe(false);
  });

  it('places a mark and passes the turn', () => {
    const state = applyMove(createState({ mode: 'multi' }), { index: 4 });
    expect(state.board[4]).toBe('X');
    expect(state.turn).toBe('O');
  });

  it('rejects a move onto an occupied cell', () => {
    const state = applyMove(createState({ mode: 'multi' }), { index: 0 });
    expect(() => applyMove(state, { index: 0 })).toThrow(/already taken/);
  });

  it('rejects a move by the player who is not to move', () => {
    const state = createState({ mode: 'multi' });
    expect(() => applyMove(state, { index: 0, player: 'O' })).toThrow(/turn/);
  });

  it('detects a winning line and reports it', () => {
    // X: 0,1,2   O: 3,4
    let state = createState({ mode: 'multi' });
    for (const index of [0, 3, 1, 4, 2]) state = applyMove(state, { index });
    expect(state.winner).toBe('X');
    expect(state.line).toEqual([0, 1, 2]);
    expect(publicView(state).over).toBe(true);
  });

  it('detects a draw on a full board', () => {
    let state = createState({ mode: 'multi' });
    for (const index of [0, 1, 2, 4, 3, 5, 7, 6, 8]) state = applyMove(state, { index });
    expect(state.winner).toBeNull();
    expect(state.draw).toBe(true);
  });

  it('refuses further moves once the game is over', () => {
    let state = createState({ mode: 'multi' });
    for (const index of [0, 3, 1, 4, 2]) state = applyMove(state, { index });
    expect(() => applyMove(state, { index: 5 })).toThrow(/already over/);
  });

  it('winnerOf finds diagonals', () => {
    expect(winnerOf(['O', null, null, null, 'O', null, null, null, 'O']).winner).toBe('O');
  });
});

describe('tic-tac-toe bots', () => {
  const base = { mode: 'single', winner: null, line: null, draw: false };

  it('medium takes an immediate win over a block', () => {
    const state = { ...base, difficulty: 'medium', turn: 'X', board: ['X', 'X', null, 'O', 'O', null, null, null, null] };
    expect(chooseMove(state, zeroRng)).toBe(2);
  });

  it('medium blocks when it cannot win', () => {
    const state = { ...base, difficulty: 'medium', turn: 'X', board: ['O', 'O', null, null, null, null, null, null, null] };
    expect(chooseMove(state, zeroRng)).toBe(2);
  });

  it('medium takes the centre when there is no threat', () => {
    const state = { ...base, difficulty: 'medium', turn: 'O', board: ['X', null, null, null, null, null, null, null, null] };
    expect(chooseMove(state, zeroRng)).toBe(4);
  });

  it('easy returns a legal empty cell', () => {
    const state = { ...base, difficulty: 'easy', turn: 'O', board: ['X', 'X', null, null, 'O', null, null, null, null] };
    const move = chooseMove(state, () => 0.99);
    expect(state.board[move]).toBeNull();
  });

  it('hard is unbeatable: minimax against minimax always draws', () => {
    let state = createState({ mode: 'single', difficulty: 'hard' });
    while (!state.winner && !state.draw) {
      const index = chooseMove(state, zeroRng);
      state = applyMove(state, { index });
    }
    expect(state.winner).toBeNull();
    expect(state.draw).toBe(true);
  });

  it('hard blocks a losing threat rather than playing elsewhere', () => {
    // O must play 2 or lose immediately.
    const state = { ...base, difficulty: 'hard', turn: 'O', board: ['X', 'X', null, null, 'O', null, null, null, null] };
    expect(chooseMove(state, zeroRng)).toBe(2);
  });
});
