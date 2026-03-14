export type PlayerType = 'player' | 'opponent';

export interface BattleState {
  status: 'LOBBY' | 'BATTLE' | 'RESULTS';
  currentTurn: PlayerType;
  turnDuration: number;
  timeLeft: number;
  round: number;
  totalRounds: number;
  playerScore: number;
  opponentScore: number;
  playerHype: number;
  opponentHype: number;
  momentum: number;
  winner: PlayerType | null;
  lastFeedback: string;
}

export interface LyricLine {
  id: string;
  text: string;
  isAiGenerated: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  side: 'left' | 'right' | 'system';
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview'
}
