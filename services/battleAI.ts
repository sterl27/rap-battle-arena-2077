/**
 * battleAI.ts — one import for App.tsx. Local GPU (MUSAIX relay -> Ollama qwen3.5:9b) first,
 * existing Gemini service as the fallback. Same signatures as geminiService.ts.
 */
import * as gemini from './geminiService';
import { local, relayAvailable } from './musaixLocal';

export type AISource = 'local' | 'gemini';
let lastSource: AISource = 'gemini';
export const getLastSource = () => lastSource;   // show "LOCAL GPU" / "GEMINI" badge in BattleHUD

async function firstOf<T>(localCall: () => Promise<T | null>, cloudCall: () => Promise<T>): Promise<T> {
  const v = await localCall().catch(() => null);
  if (v !== null && v !== undefined && !(typeof v === 'string' && !v.trim())) {
    lastSource = 'local';
    return v;
  }
  lastSource = 'gemini';
  return cloudCall();
}

export const generateLyrics = (topic: string, previousLines: string[], style = 'cyberpunk aggressive') =>
  firstOf(() => local.bars(topic, previousLines, style), () => gemini.generateLyrics(topic, previousLines, style));

export const generateOpponentResponse = (playerLyrics: string) =>
  firstOf(() => local.opponentRebuttal(playerLyrics), () => gemini.generateOpponentResponse(playerLyrics));

export const getRhymeSuggestions = (word: string) =>
  firstOf(() => local.rhymes(word), () => gemini.getRhymeSuggestions(word));

export const scoreRapBar = (lyrics: string, context: string) =>
  firstOf(() => local.score(lyrics, context), () => gemini.scoreRapBar(lyrics, context));

export const generateTaunt = (target: string) =>
  firstOf(() => local.taunt(target), async () => 'Your firmware is outdated, step aside.');

export { relayAvailable };
