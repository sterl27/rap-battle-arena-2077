import React, { useState, useEffect } from 'react';
import { getRhymeSuggestions } from '../services/geminiService';

interface LyricsEditorProps {
  currentLine: string;
  setCurrentLine: (val: string | ((prev: string) => string)) => void;
  onSendLine: (text: string) => void;
  disabled: boolean;
  onAIRequest: (text: string) => void;
}

const LyricsEditor: React.FC<LyricsEditorProps> = ({ currentLine, setCurrentLine, onSendLine, disabled, onAIRequest }) => {
  const [rhymes, setRhymes] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentLine.trim()) {
        onSendLine(currentLine);
        setCurrentLine('');
        setRhymes([]);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentLine(e.target.value);
    setIsTyping(true);
  };

  // Debounce rhyme suggestions - reduced to 500ms for snappier feel
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = currentLine.trim();
      if (trimmed.length > 2) {
        const words = trimmed.split(' ');
        const lastWord = words[words.length - 1];
        if (lastWord.length > 2) {
          getRhymeSuggestions(lastWord).then(setRhymes);
        }
      }
      setIsTyping(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentLine]);

  return (
    <div className={`relative flex flex-col h-full bg-cyber-dark/80 backdrop-blur border border-cyber-cyan/30 rounded-lg overflow-hidden transition-opacity duration-300 ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      
      {/* AI Header */}
      <div className="flex justify-between items-center p-2 bg-black/50 border-b border-cyber-cyan/20">
        <span className="text-cyber-cyan font-mono text-xs tracking-widest uppercase">
          Lyrics Module // v2.0
        </span>
        <button 
            onClick={() => onAIRequest(currentLine)}
            className="text-xs bg-cyber-pink/20 hover:bg-cyber-pink/40 text-cyber-pink px-2 py-1 rounded transition border border-cyber-pink/50 font-mono"
        >
            AI GENERATE
        </button>
      </div>

      {/* Editor Area */}
      <textarea
        value={currentLine}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "WAITING FOR TURN..." : "Spit your bars here... (Press Enter)"}
        className="flex-1 bg-transparent p-4 text-white font-mono text-lg resize-none focus:outline-none placeholder-gray-600"
        spellCheck="false"
      />

      {/* Rhyme Bar */}
      <div className="h-10 bg-black/80 flex items-center px-4 space-x-2 overflow-x-auto border-t border-cyber-cyan/20">
        <span className="text-gray-500 text-xs uppercase font-mono whitespace-nowrap">Suggested Rhymes:</span>
        {rhymes.length > 0 ? (
          rhymes.map((rhyme, idx) => (
            <span key={idx} className="text-cyber-cyan text-sm font-bold animate-pulse cursor-pointer hover:underline" onClick={() => setCurrentLine(prev => prev + " " + rhyme)}>
              {rhyme}
            </span>
          ))
        ) : (
          <span className="text-gray-700 text-xs italic">...type to analyze...</span>
        )}
      </div>
      
      {/* Decorative Corner */}
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-cyan"></div>
    </div>
  );
};

export default LyricsEditor;