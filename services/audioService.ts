export class AudioController {
  audioContext: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  dataArray: Uint8Array | null = null;
  source: MediaStreamAudioSourceNode | null = null;

  beatInterval: number | null = null;
  isPlaying: boolean = false;
  momentum: number = 0;
  masterGain: GainNode | null = null;

  beatEnabled: boolean = true;  // false when Ableton Live (via MUSAIX relay) is playing the beat

  setMomentum(val: number) {
    this.momentum = val;
  }

  setBeatEnabled(on: boolean) {
    this.beatEnabled = on;
    if (!on && this.beatInterval) { clearTimeout(this.beatInterval); this.beatInterval = null; this.isPlaying = false; }
  }

  async initialize() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8;
      
      const limiter = this.audioContext.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-10, this.audioContext.currentTime);
      limiter.knee.setValueAtTime(40, this.audioContext.currentTime);
      limiter.ratio.setValueAtTime(12, this.audioContext.currentTime);
      limiter.attack.setValueAtTime(0, this.audioContext.currentTime);
      limiter.release.setValueAtTime(0.25, this.audioContext.currentTime);
      
      this.masterGain.connect(limiter);
      limiter.connect(this.audioContext.destination);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      if (this.beatEnabled) this.startBeat(); // mic analyser still drives the 3D visuals either way
    } catch (e) {
      console.error("Audio initialization failed", e);
    }
  }

  // Simple procedural beat generator
  private startBeat() {
    if (!this.audioContext || this.isPlaying) return;
    this.isPlaying = true;
    
    let step = 0;
    const bpm = 92;
    const stepTime = 60 / bpm / 4; // 16th note

    const playStep = () => {
        if (!this.audioContext) return;
        const time = this.audioContext.currentTime + 0.1;

        // Intensity increases with momentum (0 to 100)
        const intensity = Math.max(0.2, (this.momentum + 100) / 200);

        // Kick on 1 and 9, and some ghost kicks if high momentum
        if (step % 8 === 0 || (step % 16 === 10 && intensity > 0.5)) {
            this.playKick(time, intensity);
        }
        // Snare on 5 and 13
        if (step % 8 === 4) {
            this.playSnare(time, intensity);
        }
        // Hi-hat on every 8th, and 16ths if high momentum
        if (step % 2 === 0 || (step % 1 === 0 && intensity > 0.7)) {
            this.playHiHat(time, intensity);
        }
        // Bass synth loop - gets gritier with momentum
        if (step % 16 === 0 || step % 16 === 3 || step % 16 === 7 || (step % 16 === 11 && intensity > 0.6)) {
            this.playBass(time, step % 32 < 16 ? 55 : 48.99, intensity); // A1 or G1
        }

        step = (step + 1) % 32;
        this.beatInterval = window.setTimeout(playStep, stepTime * 1000);
    };

    playStep();
  }

  private playKick(time: number, intensity: number) {
    if (!this.audioContext || !this.masterGain) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4);
    gain.gain.setValueAtTime(intensity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
    
    osc.start(time);
    osc.stop(time + 0.4);
  }

  private playSnare(time: number, intensity: number) {
    if (!this.audioContext || !this.masterGain) return;
    const noise = this.audioContext.createBufferSource();
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    noise.buffer = buffer;
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1500;
    
    const noiseGain = this.audioContext.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    noiseGain.gain.setValueAtTime(0.2 * intensity, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    noise.start(time);
    noise.stop(time + 0.2);
  }

  private playHiHat(time: number, intensity: number) {
     if (!this.audioContext || !this.masterGain) return;
     const osc = this.audioContext.createOscillator();
     const gain = this.audioContext.createGain();
     osc.type = 'square';
     osc.connect(gain);
     gain.connect(this.masterGain);
     osc.frequency.setValueAtTime(10000, time);
     gain.gain.setValueAtTime(0.05 * intensity, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
     osc.start(time);
     osc.stop(time + 0.05);
  }

  private playBass(time: number, freq: number, intensity: number) {
    if (!this.audioContext || !this.masterGain) return;
    const osc = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc2.type = 'square';
    osc2.detune.value = 12; // Slighly off for richness
    
    osc.connect(gain);
    osc2.connect(gain);
    
    const distortion = this.audioContext.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(400 * intensity);
    distortion.oversample = '4x';
    
    gain.connect(distortion);
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200 + (intensity * 2000), time);
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.3);
    
    distortion.connect(filter);
    filter.connect(this.masterGain);

    osc.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
    
    osc.start(time);
    osc2.start(time);
    osc.stop(time + 0.4);
    osc2.stop(time + 0.4);
  }

  playCheer() {
    if (!this.audioContext || !this.masterGain) return;
    const time = this.audioContext.currentTime;
    
    // Create a "crowd" roar using noise + filter sweep
    const noise = this.audioContext.createBufferSource();
    const bufferSize = this.audioContext.sampleRate * 2.5; // 2.5 seconds
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    noise.buffer = buffer;
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, time);
    filter.frequency.exponentialRampToValueAtTime(3000, time + 0.5);
    filter.frequency.exponentialRampToValueAtTime(200, time + 2.5);
    
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 2.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start(time);
    noise.stop(time + 2.5);
  }

  private makeDistortionCurve(amount: number) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0 ; i < n_samples; ++i ) {
      const x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + amount ) * x * 20 * deg / ( Math.PI + amount * Math.abs(x) );
    }
    return curve;
  }

  getAudioData(): Uint8Array {
    return this.getFrequencyData();
  }

  getFrequencyData(): Uint8Array {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray as any);
      return this.dataArray;
    }
    return new Uint8Array(0);
  }

  getAverageFrequency(): number {
    const data = this.getFrequencyData();
    if (data.length === 0) return 0;
    const sum = data.reduce((a, b) => a + b, 0);
    return sum / data.length;
  }

  dispose() {
    if (this.beatInterval) clearTimeout(this.beatInterval);
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.audioContext?.close();
    this.audioContext = null;
    this.isPlaying = false;
  }
}

export const audioController = new AudioController();