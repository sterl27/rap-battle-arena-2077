import React from 'react';
import { BattleState, PlayerType } from '../types';
import { Mic, MicOff, User, Cpu } from 'lucide-react';

interface BattleHUDProps {
  state: BattleState;
  onToggleMic: () => void;
  isMicActive: boolean;
  onEndTurn: () => void;
}

const BattleHUD: React.FC<BattleHUDProps> = ({ state, onToggleMic, isMicActive, onEndTurn }) => {
  const isPlayerTurn = state.currentTurn === 'player';
  
  // Calculate progress bar for timer
  const progress = (state.timeLeft / state.turnDuration) * 100;
  const barColor = isPlayerTurn ? 'bg-cyber-cyan' : 'bg-cyber-pink';

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      
      {/* Top Bar: Scores */}
      <div className="flex justify-between items-start pointer-events-auto">
        {/* Player Score */}
        <div className="flex flex-col items-start w-1/3">
          <div className="flex items-center space-x-2 mb-1">
             <div className="p-2 bg-cyber-cyan/20 rounded border border-cyber-cyan shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                <User className="w-6 h-6 text-cyber-cyan" />
             </div>
             <div>
                <h2 className="text-xl font-display font-bold text-white leading-none">YOU</h2>
                <span className="text-xs font-mono text-cyber-cyan tracking-widest">MC HUMAN</span>
             </div>
          </div>
          <div className="text-5xl font-mono text-white drop-shadow-[0_0_15px_rgba(0,243,255,0.8)]">
            {state.playerScore.toString().padStart(3, '0')}
          </div>
          {/* Hype Meter */}
          <div className="w-full max-w-[200px] mt-2">
             <div className="flex justify-between text-[10px] font-mono text-cyber-cyan uppercase mb-1">
                <span>Hype</span>
                <span>{state.playerHype}%</span>
             </div>
             <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-cyber-cyan/30">
                <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-cyber-cyan transition-all duration-500"
                    style={{ width: `${state.playerHype}%` }}
                ></div>
             </div>
          </div>
        </div>

        {/* Timer Center & Momentum */}
        <div className="flex flex-col items-center w-1/3">
            <div className="bg-black/80 backdrop-blur border border-cyber-yellow/40 px-6 py-2 rounded-lg mb-2 shadow-[0_0_20px_rgba(252,238,10,0.2)]">
                <span className="font-mono text-cyber-yellow text-xl tracking-tighter">ROUND {state.round} / {state.totalRounds}</span>
            </div>
            
            <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="absolute w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="54" stroke="#111" strokeWidth="10" fill="none" />
                    <circle 
                        cx="64" cy="64" r="54" 
                        stroke={isPlayerTurn ? '#00f3ff' : '#ff00ff'} 
                        strokeWidth="10" 
                        fill="none" 
                        strokeDasharray="339.12"
                        strokeDashoffset={339.12 - (339.12 * progress) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear"
                    />
                </svg>
                <div className="flex flex-col items-center">
                    <span className="text-5xl font-mono font-bold text-white drop-shadow-lg">{state.timeLeft}</span>
                    <span className="text-[10px] font-mono text-gray-500 mt-1 uppercase">Seconds Left</span>
                </div>
            </div>

            {/* MOMENTUM BAR */}
            <div className="mt-6 w-full max-w-[300px]">
                <div className="text-center text-[10px] font-mono text-white/50 uppercase mb-1 tracking-[0.2em]">Momentum</div>
                <div className="h-4 bg-black/60 rounded border border-white/10 relative overflow-hidden">
                    {/* Center marker */}
                    <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/20 z-10"></div>
                    {/* Momentum fill */}
                    <div 
                        className={`absolute top-0 h-full transition-all duration-700 ${state.momentum >= 0 ? 'bg-cyber-cyan left-1/2' : 'bg-cyber-pink right-1/2'}`}
                        style={{ 
                            width: `${Math.abs(state.momentum)}%`,
                            boxShadow: state.momentum >= 0 ? '0 0 15px #00f3ff' : '0 0 15px #ff00ff'
                        }}
                    ></div>
                </div>
                <div className="flex justify-between mt-1 text-[8px] font-mono">
                    <span className="text-cyber-pink">DEFENSE</span>
                    <span className="text-cyber-cyan">OFFENSE</span>
                </div>
            </div>
        </div>

        {/* Opponent Score */}
        <div className="flex flex-col items-end w-1/3">
          <div className="flex items-center space-x-2 mb-1">
             <div>
                <h2 className="text-xl font-display font-bold text-white leading-none text-right uppercase">Cyber-Shogun</h2>
                <span className="text-xs font-mono text-cyber-pink tracking-widest block text-right">AI CORE_V3</span>
             </div>
             <div className="p-2 bg-cyber-pink/20 rounded border border-cyber-pink shadow-[0_0_10px_rgba(255,0,255,0.3)]">
                <Cpu className="w-6 h-6 text-cyber-pink" />
             </div>
          </div>
          <div className="text-5xl font-mono text-white drop-shadow-[0_0_15px_rgba(255,0,255,0.8)]">
            {state.opponentScore.toString().padStart(3, '0')}
          </div>
           {/* Hype Meter */}
           <div className="w-full max-w-[200px] mt-2">
             <div className="flex justify-between text-[10px] font-mono text-cyber-pink uppercase mb-1">
                <span>{state.opponentHype}%</span>
                <span>Hype</span>
             </div>
             <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-cyber-pink/30 flex justify-end">
                <div 
                    className="h-full bg-gradient-to-l from-red-600 to-cyber-pink transition-all duration-500"
                    style={{ width: `${state.opponentHype}%` }}
                ></div>
             </div>
          </div>
        </div>
      </div>

      {/* AI Commentary / Feedback Overlays */}
      <div className="flex-1 flex items-center justify-center">
        {state.lastFeedback && (
          <div className="bg-black/80 backdrop-blur-md border border-cyber-cyan/50 p-4 rounded-lg animate-in fade-in slide-in-from-bottom-5 duration-500">
             <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse"></div>
                <div className="text-cyber-cyan font-mono text-xs uppercase tracking-[0.2em] mb-1">Neural Analysis</div>
             </div>
             <p className="text-white font-display text-lg italic tracking-tight">
               "{state.lastFeedback}"
             </p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex justify-center items-end space-x-6 pointer-events-auto pb-10">
        <button 
            onClick={onToggleMic}
            className={`p-4 rounded-full border-2 transition-all duration-300 ${isMicActive ? 'border-red-500 bg-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'border-gray-600 bg-black/40 text-gray-400 hover:border-white hover:text-white'}`}
        >
            {isMicActive ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
        </button>
        
        <div className="flex flex-col items-center space-y-2">
            <button 
                onClick={onEndTurn}
                disabled={!isPlayerTurn}
                className={`px-12 py-3 font-display font-bold text-xl skew-x-[-10deg] uppercase transition-all
                    ${isPlayerTurn 
                        ? 'bg-cyber-cyan text-black hover:bg-white hover:shadow-[0_0_30px_#00f3ff]' 
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}
                `}
            >
                {isPlayerTurn ? 'END TURN [SPACE]' : 'OPPONENT TURN'}
            </button>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                Press Space to pass mic
            </span>
        </div>
      </div>
    </div>
  );
};

export default BattleHUD;