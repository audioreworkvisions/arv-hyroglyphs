export interface AudioReactiveSnapshot {
  active: boolean;
  bass: number;
  mid: number;
  high: number;
  rms: number;
  kick: number;
  bpm: number;
  permission: 'idle' | 'active' | 'error';
  error?: string;
}

const createIdleState = (): AudioReactiveSnapshot => ({
  active: false,
  bass: 0,
  mid: 0,
  high: 0,
  rms: 0,
  kick: 0,
  bpm: 0,
  permission: 'idle',
});

const average = (values: Uint8Array, start: number, end: number): number => {
  const from = Math.max(0, start);
  const to = Math.min(values.length, end);
  if (to <= from) return 0;

  let sum = 0;
  for (let index = from; index < to; index += 1) {
    sum += values[index];
  }

  return sum / (to - from) / 255;
};

const lerp = (from: number, to: number, amount: number): number => {
  return from + (to - from) * amount;
};

export class AudioReactiveUniforms {
  private readonly state: AudioReactiveSnapshot = createIdleState();
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private values: Uint8Array | null = null;
  private previousBass = 0;
  private readonly kickTimestamps: number[] = [];
  private smoothedBpm = 0;
  private lastKickTime = 0;

  getState(): AudioReactiveSnapshot {
    return { ...this.state };
  }

  async start(): Promise<AudioReactiveSnapshot> {
    if (this.context && this.analyser) {
      await this.context.resume();
      this.state.active = true;
      this.state.permission = 'active';
      return this.getState();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: false,
      });

      this.context = new AudioContext();
      await this.context.resume();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.72;

      const source = this.context.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      this.values = new Uint8Array(this.analyser.frequencyBinCount);
      this.state.active = true;
      this.state.permission = 'active';
      delete this.state.error;
      return this.getState();
    } catch (error) {
      this.state.active = false;
      this.state.permission = 'error';
      this.state.error = error instanceof Error ? error.message : 'audio-init-failed';
      return this.getState();
    }
  }

  update(): AudioReactiveSnapshot {
    if (!this.analyser || !this.values) {
      return this.getState();
    }

    this.analyser.getByteFrequencyData(this.values);

    const bass = average(this.values, 2, 18);
    const mid = average(this.values, 18, 68);
    const high = average(this.values, 68, 160);

    let rmsAccumulator = 0;
    for (const value of this.values) {
      const normalized = value / 255;
      rmsAccumulator += normalized * normalized;
    }
    const rms = Math.sqrt(rmsAccumulator / this.values.length);

    this.state.bass = lerp(this.state.bass, bass, 0.22);
    this.state.mid = lerp(this.state.mid, mid, 0.18);
    this.state.high = lerp(this.state.high, high, 0.22);
    this.state.rms = lerp(this.state.rms, rms, 0.18);
    this.state.kick = Math.max(0, this.state.bass - this.previousBass * 0.86);
    this.previousBass = this.state.bass;

    // BPM detection via kick-onset intervals
    const nowSeconds = performance.now() / 1000;
    const minKickInterval = 60 / 220; // max 220 BPM
    if (this.state.kick > 0.18 && nowSeconds - this.lastKickTime > minKickInterval) {
      this.kickTimestamps.push(nowSeconds);
      if (this.kickTimestamps.length > 8) {
        this.kickTimestamps.shift();
      }
      this.lastKickTime = nowSeconds;
    }

    if (this.kickTimestamps.length >= 2) {
      let totalInterval = 0;
      for (let index = 1; index < this.kickTimestamps.length; index += 1) {
        totalInterval += this.kickTimestamps[index] - this.kickTimestamps[index - 1];
      }
      const avgInterval = totalInterval / (this.kickTimestamps.length - 1);
      const rawBpm = 60 / avgInterval;
      if (rawBpm >= 60 && rawBpm <= 220) {
        this.smoothedBpm += (rawBpm - this.smoothedBpm) * 0.18;
      }
    }

    // Decay BPM when audio goes silent
    if (nowSeconds - this.lastKickTime > 4 && this.smoothedBpm > 0) {
      this.smoothedBpm *= 0.992;
      if (this.smoothedBpm < 10) {
        this.smoothedBpm = 0;
        this.kickTimestamps.length = 0;
      }
    }

    this.state.bpm = Math.round(this.smoothedBpm);
    this.state.active = true;
    this.state.permission = 'active';

    return this.getState();
  }

  async dispose(): Promise<void> {
    this.values = null;
    this.analyser?.disconnect();
    this.analyser = null;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    this.state.active = false;
    if (this.state.permission === 'active') {
      this.state.permission = 'idle';
    }
  }
}
