import { Routes, Route, Navigate } from 'react-router-dom';
import Lobby from './Lobby.jsx';
import TicTacToe from './games/TicTacToe.jsx';
import Rps from './games/Rps.jsx';
import Hangman from './games/Hangman.jsx';
import BullsCows from './games/BullsCows.jsx';
import TimerStop from './games/TimerStop.jsx';
import Imposter from './games/Imposter.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/game/tictactoe" element={<TicTacToe />} />
      <Route path="/game/rps" element={<Rps />} />
      <Route path="/game/hangman" element={<Hangman />} />
      <Route path="/game/bullscows" element={<BullsCows />} />
      <Route path="/game/timerstop" element={<TimerStop />} />
      <Route path="/game/imposter" element={<Imposter />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
