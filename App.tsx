import React, { useState, useEffect, useRef, useCallback } from 'react';
import CyberArena from './components/Arena';
import BattleHUD from './components/BattleHUD';
import LyricsEditor from './components/LyricsEditor';
import { BattleState, ChatMessage, PlayerType } from './types';
import { audioController } from './services/audioService';
import { generateLyrics, generateOpponentResponse, scoreRapBar, relayAvailable, getLastSource } from './services/battleAI';
import { ableton } from './services/musaixLocal';
import { Music, Zap, Radio, Play, Cpu } from 'lucide-react';

export default function App() {
  // --- State ---
  const [hasStarted, setHasStarted] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  
  const [battleState, setBattleState] = useState<BattleState>({
    status: 'LOBBY',
    currentTurn: 'player',
    turnDuration: 20,
    timeLeft: 20,
    round: 1,
    totalRounds: 3,
    playerScore: 0,
    opponentScore: 0,
    playerHype: 40,
    opponentHype: 45,
    momentum: 0,
    winner: null,
    lastFeedback: "Ready to drop? Use suggestions if you're stuck.",
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const addLog = (text: string, sender: string, side: 'left' | 'right' | 'system') => {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      sender,
      side
    };
    setChatLog(prev => [...prev, msg]);
  };

  // --- Effects ---
  
  // Audio Init on start
  const liveBeatRef = useRef(false); // true while Ableton (not the WebAudio synth) plays the beat

  const handleStart = async () => {
    // Prefer Sterl's Ableton beat when the local relay + Live answer; else the procedural WebAudio beat.
    const liveBeat = (await relayAvailable(true)) ? await ableton.startBeat({ preset: 'trap-trance', bpm: 92, bars: 8, new_tracks: false,
      drums_track: Number(import.meta.env.VITE_MUSAIX_DRUMS_TRACK ?? 0), bass_track: Number(import.meta.env.VITE_MUSAIX_BASS_TRACK ?? 1),
      parts: ['drums', 'bass'] }) : null;
    liveBeatRef.current = !!liveBeat?.ok;
    if (liveBeat && !liveBeat.ok) addLog(`ABLETON: ${liveBeat.message}`, "SYSTEM", "system"); // needs_confirm / Live offline
    audioController.setBeatEnabled(!liveBeatRef.current);
    await audioController.initialize();
    setHasStarted(true);
    setBattleState(prev => ({ ...prev, status: 'BATTLE' }));
    addLog("BATTLE INITIATED. MC HUMAN VS CYBER-SHOGUN", "SYSTEM", "system");
    addLog("Round 1 - FIGHT!", "SYSTEM", "system");
    addLog(liveBeatRef.current ? "BEAT: ABLETON LIVE (MUSAIX)" : "BEAT: ARENA SYNTH", "SYSTEM", "system");
  };

  // Stop Live's transport when the battle ends or the tab closes
  useEffect(() => {
    if (battleState.status === 'RESULTS' && liveBeatRef.current) { void ableton.stop(); liveBeatRef.current = false; }
  }, [battleState.status]);
  useEffect(() => {
    const onUnload = () => { if (liveBeatRef.current) void ableton.stop(); }; // fetch keepalive survives unload
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // Optional: each new round nudges Live's tempo up 2 BPM (relay refuses if tempo LOCK is on — harmless)
  useEffect(() => {
    if (liveBeatRef.current && battleState.round > 1) void ableton.nudgeTempo(2);
  }, [battleState.round]);

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (battleState.status === 'BATTLE' && hasStarted) {
      interval = setInterval(() => {
        setBattleState(prev => {
          if (prev.timeLeft <= 0) {
            // Time ran out, switch turn automatically
            const nextTurn = prev.currentTurn === 'player' ? 'opponent' : 'player';
            // Logic for round end handled in effect dependency check or here
            // Simplified: Just switch turn, reset time
            return {
               ...prev,
               currentTurn: nextTurn,
               timeLeft: prev.turnDuration
            };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [battleState.status, hasStarted, battleState.currentTurn]);

  // Turn Switch Handler
  const switchTurn = useCallback(() => {
    setBattleState(prev => {
       const nextTurn = prev.currentTurn === 'player' ? 'opponent' : 'player';
       let nextRound = prev.round;
       
       // If switching back to player, that completes a full round (Player -> Opponent -> Player)
       // Wait, usually Player 1, Player 2, then next round.
       // Let's say Round 1: Player (20s) -> Opponent (20s). End Round 1.
       
       if (prev.currentTurn === 'opponent') {
           nextRound = prev.round + 1;
       }

       if (nextRound > prev.totalRounds) {
           return { ...prev, status: 'RESULTS', winner: prev.playerScore > prev.opponentScore ? 'player' : 'opponent' };
       }

       return {
         ...prev,
         currentTurn: nextTurn,
         round: nextRound,
         timeLeft: prev.turnDuration
       };
    });
  }, []);

  // Opponent AI Logic
  useEffect(() => {
    if (battleState.currentTurn === 'opponent' && battleState.status === 'BATTLE') {
        const playOpponentTurn = async () => {
             // Simulate thinking time
             await new Promise(r => setTimeout(r, 2000));
             
             // Get last player lines to respond to
             const lastPlayerMsg = [...chatLog].reverse().find(m => m.side === 'left');
             const context = lastPlayerMsg ? lastPlayerMsg.text : "You're silent, I'm violent.";
             
             const response = await generateOpponentResponse(context);
             addLog(`[${getLastSource() === 'local' ? 'LOCAL GPU' : 'GEMINI'}]`, "SYSTEM", "system");
             
             // Type out effect or just dump it
             const lines = response.split('\n').filter(l => l.trim().length > 0);
             for(const line of lines) {
                 await new Promise(r => setTimeout(r, 1500));
                 addLog(line, "CYBER-SHOGUN", "right");
                 setBattleState(prev => {
                    const scoreGain = Math.floor(Math.random() * 50) + 10;
                    const hypeGain = Math.floor(Math.random() * 15) + 5;
                    return {
                        ...prev, 
                        opponentScore: prev.opponentScore + scoreGain,
                        opponentHype: Math.min(100, prev.opponentHype + hypeGain),
                        playerHype: Math.max(0, prev.playerHype - 5),
                        momentum: Math.max(-100, prev.momentum - (scoreGain / 2))
                    };
                 });
             }
             
             // End turn after lines
             await new Promise(r => setTimeout(r, 1000));
             switchTurn();
        };
        playOpponentTurn();
    }
  }, [battleState.currentTurn, battleState.status, switchTurn, chatLog]);

  // Scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog]);

  // Sync momentum with audio
  useEffect(() => {
    audioController.setMomentum(battleState.momentum);
  }, [battleState.momentum]);

  // Spacebar hotkey
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && battleState.currentTurn === 'player' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); // Prevent scroll
        switchTurn();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [battleState.currentTurn, switchTurn]);


  // --- User Actions ---
  const handleSendLine = async (text: string) => {
    addLog(text, "MC HUMAN", "left");
    
    // Get last opponent msg for context
    const lastOpponentMsg = [...chatLog].reverse().find(m => m.side === 'right');
    const context = lastOpponentMsg ? lastOpponentMsg.text : "Beginning of the battle.";

    // Get AI score and feedback
    const { score, feedback } = await scoreRapBar(text, context);
    
    // Critical Hit logic integrated with score
    const isCritical = score > 85 || (text.length > 45 && score > 70);
    
    setBattleState(prev => {
        let scoreGain = score;
        let hypeGain = Math.floor(score / 5) + 5;
        
        if (isCritical) {
            scoreGain = Math.floor(scoreGain * 1.5);
            hypeGain = Math.floor(hypeGain * 1.3);
            audioController.playCheer();
            setTimeout(() => addLog("!! CRITICAL STRIKE !!", "SYSTEM", "system"), 100);
        }

        return {
            ...prev, 
            playerScore: prev.playerScore + scoreGain,
            playerHype: Math.min(100, prev.playerHype + hypeGain),
            opponentHype: Math.max(0, prev.opponentHype - (isCritical ? 10 : 5)),
            momentum: Math.min(100, prev.momentum + (scoreGain / 2)),
            lastFeedback: feedback
        };
    });
  };

  const handleAIRequest = async (currentText: string) => {
    const lastOpponentMsg = [...chatLog].reverse().find(m => m.side === 'right');
    const context = lastOpponentMsg ? [lastOpponentMsg.text] : [];
    
    // Suggest a line
    const suggestion = await generateLyrics("Battle Rap", context, "aggressive technical");
    // Set to current editor line
    setCurrentLine(suggestion.trim());
    addLog("GHOST_WRITER LOGGED IN. BAR SYNCHRONIZED.", "SYSTEM", "system");
  };

  if (!hasStarted) {
    return (
      <div className="h-screen w-screen bg-cyber-dark flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
            <CyberArena currentTurn={battleState.currentTurn} />
        </div>
        <div className="z-10 bg-black/80 backdrop-blur-md p-12 rounded-2xl border border-cyber-cyan shadow-[0_0_50px_rgba(0,243,255,0.3)] text-center max-w-2xl">
            <h1 className="text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-pink mb-4 animate-pulse">
                RAP BATTLE ARENA
            </h1>
            <p className="text-gray-400 font-mono mb-8 text-lg">
                Connect your neural link. Spit bars. Dominate the grid.
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                <div className="flex items-center space-x-3 text-cyber-cyan">
                    <Zap className="w-6 h-6" />
                    <span className="font-mono">Real-time Audio Vis</span>
                </div>
                <div className="flex items-center space-x-3 text-cyber-pink">
                    <Radio className="w-6 h-6" />
                    <span className="font-mono">AI Opponent</span>
                </div>
                <div className="flex items-center space-x-3 text-cyber-yellow">
                    <Music className="w-6 h-6" />
                    <span className="font-mono">Beat Sync</span>
                </div>
                 <div className="flex items-center space-x-3 text-white">
                    <Cpu className="w-6 h-6" />
                    <span className="font-mono">Lyric Assist</span>
                </div>
            </div>

            <button 
                onClick={handleStart}
                className="group relative px-8 py-4 bg-cyber-cyan text-black font-bold font-display text-2xl uppercase tracking-widest hover:bg-white transition-all overflow-hidden"
            >
                <span className="relative z-10 flex items-center space-x-2">
                    <Play className="w-6 h-6" />
                    <span>Enter Arena</span>
                </span>
                <div className="absolute inset-0 bg-white transform -translate-x-full skew-x-12 group-hover:translate-x-0 transition-transform duration-300"></div>
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-cyber-dark text-white overflow-hidden relative font-sans scanlines">
      
      {/* 3D Background */}
      <CyberArena currentTurn={battleState.currentTurn} />

      {/* Main Grid Layout */}
      <div className="absolute inset-0 z-10 grid grid-cols-12 gap-4 p-4 pointer-events-none">
        
        {/* Left Panel: Chat Log / Battle History */}
        <div className="col-span-3 bg-cyber-panel backdrop-blur-sm rounded-lg border-l-2 border-cyber-cyan overflow-hidden flex flex-col pointer-events-auto h-full">
            <div className="p-3 bg-black/40 border-b border-cyber-cyan/20">
                <h3 className="font-mono text-cyber-cyan text-sm">BATTLE LOG // FREQUENCY: 44.1kHz</h3>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatLog.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.side === 'right' ? 'items-end' : msg.side === 'left' ? 'items-start' : 'items-center'}`}>
                        <span className={`text-[10px] font-mono mb-1 ${
                            msg.side === 'right' ? 'text-cyber-pink' : msg.side === 'left' ? 'text-cyber-cyan' : 'text-gray-500'
                        }`}>
                            {msg.sender}
                        </span>
                        <div className={`p-3 rounded max-w-[90%] font-mono text-sm shadow-lg ${
                            msg.side === 'right' 
                                ? 'bg-cyber-pink/10 border border-cyber-pink/30 text-white rounded-tr-none' 
                                : msg.side === 'left' 
                                    ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-white rounded-tl-none' 
                                    : 'bg-transparent text-gray-400 italic text-xs'
                        }`}>
                            {msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Center Panel: Battle View (Transparent for 3D) */}
        <div className="col-span-6 relative">
             <BattleHUD 
                state={battleState} 
                onToggleMic={() => setMicActive(!micActive)} 
                isMicActive={micActive}
                onEndTurn={switchTurn}
             />
             
             {battleState.status === 'RESULTS' && (
                 <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-md rounded-lg pointer-events-auto">
                     <div className="text-center animate-bounce">
                         <h1 className="text-6xl font-display font-bold text-white mb-4">
                             {battleState.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
                         </h1>
                         <p className="text-2xl font-mono text-cyber-cyan mb-8">
                             {battleState.playerScore} vs {battleState.opponentScore}
                         </p>
                         <button 
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-cyber-pink text-white font-mono hover:bg-white hover:text-black transition"
                         >
                             REMATCH
                         </button>
                     </div>
                 </div>
             )}
        </div>

        {/* Right Panel: Lyrics Editor & Tools */}
        <div className="col-span-3 pointer-events-auto h-full pb-20">
             <LyricsEditor 
                currentLine={currentLine}
                setCurrentLine={setCurrentLine}
                onSendLine={handleSendLine} 
                disabled={battleState.currentTurn !== 'player' || battleState.status !== 'BATTLE'}
                onAIRequest={handleAIRequest}
             />
        </div>

      </div>

      {/* Footer / Status Bar */}
      <div className="absolute bottom-0 left-0 w-full h-8 bg-black border-t border-cyber-cyan/30 flex items-center justify-between px-4 z-20">
            <div className="flex items-center space-x-4 text-xs font-mono text-gray-500">
                <span>CONN: STABLE</span>
                <span>PING: 12ms</span>
                <span>REGION: NEO-TOKYO</span>
            </div>
            <div className="text-xs font-mono text-cyber-cyan animate-pulse">
                SYSTEM ONLINE
            </div>
      </div>

    </div>
  );
}