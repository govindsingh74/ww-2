import { useEffect, useState } from 'react';
import { Clock, Play, Pause, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { GameState } from '../lib/types';

export function GameTickStatus() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState(0);

  useEffect(() => {
    supabase
      .from('game_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setGameState(data as GameState | null));

    const channel = supabase
      .channel('game_state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, (payload) => {
        setGameState(payload.new as GameState);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!gameState) return;

    const interval = setInterval(() => {
      const last = new Date(gameState.last_tick_at).getTime();
      const next = last + gameState.tick_interval_seconds * 1000;
      const remaining = Math.max(0, next - Date.now());
      setTimeUntilNext(Math.ceil(remaining / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  if (!gameState) return null;

  const progress = gameState.tick_interval_seconds > 0
    ? Math.min(100, ((gameState.tick_interval_seconds - timeUntilNext) / gameState.tick_interval_seconds) * 100)
    : 0;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <span className="text-white font-semibold text-sm">Game Engine</span>
        </div>
        <div className="flex items-center gap-1.5">
          {gameState.is_running ? (
            <Play size={12} className="text-green-400" />
          ) : (
            <Pause size={12} className="text-red-400" />
          )}
          <span className={`text-xs ${gameState.is_running ? 'text-green-400' : 'text-red-400'}`}>
            {gameState.is_running ? 'Running' : 'Paused'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-800 rounded-lg p-2.5">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Current Tick</div>
          <div className="text-white font-bold text-lg">{gameState.current_tick}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2.5">
          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Next Tick</div>
          <div className="text-white font-bold text-lg flex items-center gap-1">
            <Clock size={14} className="text-gray-500" />
            {timeUntilNext}s
          </div>
        </div>
      </div>

      {/* Tick progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
