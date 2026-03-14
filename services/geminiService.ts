import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateLyrics = async (
  topic: string, 
  previousLines: string[], 
  style: string = "cyberpunk aggressive"
): Promise<string> => {
  if (!apiKey) return "API Key missing. Simulate lyrics...";

  const context = previousLines.join("\n");
  const prompt = `
    You are a world-class battle rapper in a futuristic cyberpunk arena.
    Topic: ${topic}
    Style: ${style}
    Context (previous bars):
    ${context}

    Generate 4 bars (lines) of rap lyrics that respond to the context or start the verse. 
    Keep it rhythmic, use multis, and be punchy. 
    Return ONLY the lyrics, no explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH,
      contents: prompt,
    });
    return response.text || "Microphone check... system glitch...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "System offline... lyrics database corrupted.";
  }
};

export const getRhymeSuggestions = async (word: string): Promise<string[]> => {
  if (!apiKey) return ["glitch", "switch", "pitch", "rich"];

  const prompt = `List 5 creative slant rhymes or multis for the word "${word}" suitable for a rap battle. Return a simple comma-separated list.`;
  
  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH,
      contents: prompt,
    });
    const text = response.text || "";
    return text.split(',').map(s => s.trim()).slice(0, 5);
  } catch (error) {
    return ["error", "terror", "server", "observer"];
  }
};

export const generateOpponentResponse = async (playerLyrics: string): Promise<string> => {
   if (!apiKey) return "I see you trying, but your bars are weak,\nMy code is supreme, yours is obsolete.\nI'm the future, you're the past,\nThis battle is over, you came in last.";

   const prompt = `
     You are the "Cyber-Shogun", a ruthless AI rap battle bot.
     The human player just spit these bars:
     "${playerLyrics}"

     Write a 4-line rebuttal. Destroy them. Be arrogant, technical, and futuristic.
     Return ONLY the lyrics.
   `;

   try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH,
      contents: prompt,
    });
    return response.text || "Processing insult... data corrupted.";
   } catch (error) {
     return "Connection unstable... I win by default.";
   }
};

export const scoreRapBar = async (lyrics: string, context: string): Promise<{ score: number, feedback: string }> => {
  if (!apiKey) {
    return { score: Math.floor(Math.random() * 40) + 60, feedback: "Neural link offline... manual scoring engaged." };
  }

  const prompt = `
    Analyze this battle rap line: "${lyrics}"
    Context: "${context}"
    
    Score it from 0-100 based on:
    1. Rhyme Scheme (Multis, internal rhymes)
    2. Punchline Strength (Impact, cleverness)
    3. Flow (Rhythm, syllable count)
    
    Return ONLY a JSON object: {"score": number, "feedback": "very short comment (max 5 words)"}
  `;

  try {
    const response = await ai.models.generateContent({
      model: GeminiModel.FLASH,
      contents: prompt,
    });
    const text = response.text || '{"score": 50, "feedback": "System glitch"}';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    return { score: 50, feedback: "Check mic 1-2..." };
  }
};