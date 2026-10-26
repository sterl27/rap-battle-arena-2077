/**
 * musaixLocal.ts — client for Sterl's local MUSAIX voice relay (voice_relay.py, 127.0.0.1:8765).
 *
 * Text:  POST /api/gpu/llm {prompt, system?, temp?} -> {ok, job_id, data: Job}
 *        GET  /api/gpu/jobs/<id>                   -> {ok, job_id, result, data: Job}
 *        Job.status: queued | running | done | error | timeout | cancelled ; Job.result = {text}
 *        POST /api/gpu/cancel {job_id}
 *        (GPU jobs run ONE at a time, FIFO. A stems job in front of us = long wait -> we time out & fall back.)
 * Live:  POST /api/dash/transport {action: play|stop|continue|panic}
 *        POST /api/dash/tempo     {op: set, value} | {op: up|down, step}   (refused when tempo LOCK is on)
 *        POST /api/dash/beat_push {preset, bars, key, scale, bpm, density, seed, slot, fire,
 *                                  drums_track|bass_track|chords_track | new_tracks, confirm_replace, parts}
 *        dash responses: {ok, result, data, needs_confirm?, offline?, safeguard?, osc_count, ms}
 * Health: GET /api/health -> {ok, relay_version}
 *
 * Every call is best-effort: callers get `null` when the relay is down/slow so they can fall back to Gemini.
 */

export interface RelayResp<T = any> {
  ok: boolean;
  result?: string;
  data?: T;
  job_id?: string;
  needs_confirm?: boolean;
  offline?: boolean;   // relay is up but Ableton/MusaixPROOSC is not answering
  safeguard?: boolean;
}

export interface GpuJob {
  job_id: string;
  kind: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'timeout' | 'cancelled';
  result: any;
  error: string | null;
  elapsed_s: number;
  queued_s: number;
}

const env = (import.meta as any).env ?? {};
/** '' or '/musaix' when using the Vite dev proxy (no relay change); 'http://127.0.0.1:8765' for direct CORS. */
export const RELAY_URL: string = (env.VITE_MUSAIX_RELAY_URL ?? 'http://127.0.0.1:8765').replace(/\/$/, '');
export const LOCAL_ENABLED: boolean = env.VITE_MUSAIX_LOCAL !== 'off';
const LLM_TIMEOUT_MS = Number(env.VITE_MUSAIX_LLM_TIMEOUT_MS ?? 20000);
const HEALTH_TTL_MS = 15000;

// ------------------------------------------------------------------ transport
async function http<T = any>(path: string, body?: unknown, timeoutMs = 4000): Promise<RelayResp<T> | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(RELAY_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, // relay requires JSON CT
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
      keepalive: body !== undefined && JSON.stringify(body).length < 60000, // lets stop() survive tab close
    });
    if (res.status === 403) {
      console.warn('[musaix] relay refused origin (403). Use the Vite proxy or add this origin to the relay allowlist.');
      markDown();
      return null;
    }
    return (await res.json()) as RelayResp<T>;
  } catch {
    markDown();       // connection refused / CORS failure / abort: treat relay as offline
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ------------------------------------------------------------------ health (cached)
let healthy: boolean | null = null;
let checkedAt = 0;
function markDown() { healthy = false; checkedAt = Date.now(); }

export async function relayAvailable(force = false): Promise<boolean> {
  if (!LOCAL_ENABLED) return false;
  if (!force && healthy !== null && Date.now() - checkedAt < HEALTH_TTL_MS) return healthy;
  const r = await http('/api/health', undefined, 1200);
  healthy = !!r?.ok;
  checkedAt = Date.now();
  return healthy;
}

// ------------------------------------------------------------------ local LLM (Ollama via relay)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Run one prompt on the local GPU LLM. Resolves to text, or null (caller falls back to cloud). */
export async function localLLM(prompt: string, opts: { system?: string; temp?: number; timeoutMs?: number } = {}): Promise<string | null> {
  if (!(await relayAvailable())) return null;
  const start = await http<GpuJob>('/api/gpu/llm', { prompt, system: opts.system, temp: opts.temp ?? 0.9 });
  if (!start?.ok || !start.job_id) return null;
  const id = start.job_id;
  const deadline = Date.now() + (opts.timeoutMs ?? LLM_TIMEOUT_MS);
  let delay = 400;
  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(1500, delay * 1.5);
    const r = await http<GpuJob>(`/api/gpu/jobs/${encodeURIComponent(id)}`);
    const job = r?.data;
    if (!job) return null;
    if (job.status === 'done') return cleanText(job.result?.text ?? '');
    if (job.status === 'error' || job.status === 'timeout' || job.status === 'cancelled') return null;
  }
  void http('/api/gpu/cancel', { job_id: id }); // don't leave a stale job blocking the GPU queue
  return null;
}

/** qwen3 may emit <think> blocks; strip them plus fences/quotes. */
function cleanText(s: string): string | null {
  const out = s.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```[a-z]*|```/gi, '').trim();
  return out || null;
}

const BATTLE_SYSTEM =
  'You are a battle rapper inside the video game "Rap Battle Arena 2077" (cyberpunk Neo-Tokyo). ' +
  'Write sharp, rhythmic bars with multisyllabic and internal rhymes. Keep it PG-13: no slurs, ' +
  'no real-person attacks. Reply with only the lyric lines: no preamble, no numbering, no markdown.';

export const local = {
  /** Cyber-Shogun's 4-bar rebuttal to the player's last bars. */
  opponentRebuttal: (playerBars: string) =>
    localLLM(
      `You are the "Cyber-Shogun", a ruthless AI battle rapper. The human just spit:\n"${playerBars}"\n` +
      'Write a 4-line rebuttal that flips their words back on them. Arrogant, technical, futuristic. 4 lines only.',
      { system: BATTLE_SYSTEM, temp: 0.95 }),

  /** Ghost-writer: 4 bars for the player. */
  bars: (topic: string, previous: string[], style = 'aggressive technical') =>
    localLLM(
      `Topic: ${topic}\nStyle: ${style}\nPrevious bars:\n${previous.join('\n') || '(none)'}\n` +
      'Write 4 bars that answer the previous bars or open the verse. 4 lines only.',
      { system: BATTLE_SYSTEM, temp: 0.9 }),

  /** One-line taunt for the HUD / crowd chat (short timeout: it is flavour, not gameplay). */
  taunt: (target: string) =>
    localLLM(`One short trash-talk line (max 12 words) aimed at ${target}. One line only.`,
      { system: BATTLE_SYSTEM, temp: 1.0, timeoutMs: 8000 }),

  rhymes: async (word: string): Promise<string[] | null> => {
    const t = await localLLM(`List 5 slant rhymes or multis for "${word}" for a rap battle. Comma-separated, nothing else.`,
      { system: BATTLE_SYSTEM, temp: 0.7, timeoutMs: 8000 });
    return t ? t.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0, 5) : null;
  },

  score: async (bars: string, context: string): Promise<{ score: number; feedback: string } | null> => {
    const t = await localLLM(
      `Score this battle-rap line 0-100 on rhyme scheme, punchline and flow.\nLine: "${bars}"\nContext: "${context}"\n` +
      'Return ONLY JSON: {"score": number, "feedback": "max 5 words"}',
      { system: 'You are a strict battle-rap judge. Output only JSON.', temp: 0.2, timeoutMs: 12000 });
    if (!t) return null;
    try {
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      const score = Math.max(0, Math.min(100, Math.round(Number(j.score))));
      return Number.isFinite(score) ? { score, feedback: String(j.feedback ?? '').slice(0, 40) } : null;
    } catch { return null; }
  },
};

// ------------------------------------------------------------------ Ableton Live (MusaixPROOSC via relay)
export interface BeatOptions {
  preset?: string;            // presets.json id: trap-trance | dark-synth-rock | industrial-dark | dream-trance | creeping-progressive
  bpm?: number;
  bars?: number;              // <= 64
  key?: string;
  scale?: string;
  density?: number;           // 0..1 (map from game momentum)
  seed?: number;
  slot?: number;
  drums_track?: number;       // MIDI track indexes from the relay snapshot ...
  bass_track?: number;
  chords_track?: number;
  new_tracks?: boolean;       // ... or let the relay create new MIDI tracks
  parts?: string[];
  confirm_replace?: boolean;  // only after the user OKs overwriting an occupied slot
}

export type LiveResult = { ok: boolean; message: string; needsConfirm?: boolean; abletonOffline?: boolean } | null;

function live(r: RelayResp | null): LiveResult {
  if (!r) return null; // relay itself unreachable
  return { ok: r.ok, message: r.result ?? '', needsConfirm: r.needs_confirm, abletonOffline: r.offline };
}

export const ableton = {
  /** Generate a beat with beatgen and push it into Live clips (fire=true launches them). */
  async startBeat(o: BeatOptions = {}): Promise<LiveResult> {
    if (!(await relayAvailable())) return null;
    const pushed = live(await http('/api/dash/beat_push', {
      preset: 'trap-trance', bars: 8, key: 'A', scale: 'minor', slot: 0, fire: true, set_tempo: true, ...o,
    }, 15000));
    if (!pushed?.ok) return pushed;                        // needs_confirm / offline / error -> caller decides
    return live(await http('/api/dash/transport', { action: 'play' }));
  },
  stop: async () => live(await http('/api/dash/transport', { action: 'stop' })),
  play: async () => live(await http('/api/dash/transport', { action: 'play' })),
  setTempo: async (bpm: number) => live(await http('/api/dash/tempo', { op: 'set', value: Math.round(bpm * 100) / 100 })),
  nudgeTempo: async (step: number) => live(await http('/api/dash/tempo', { op: step >= 0 ? 'up' : 'down', step: Math.abs(step) })),
  ping: async () => live(await http('/api/ping_ableton', {})),
};
