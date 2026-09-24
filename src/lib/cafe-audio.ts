export const CAFE_SOUNDS = [
  { id: "rain", label: "Дождь" },
  { id: "kitchen", label: "Кухня" },
  { id: "talk", label: "Разговоры" },
  { id: "fire", label: "Камин" },
  { id: "coffee", label: "Кофеварка" },
] as const;

export type CafeSoundId = (typeof CAFE_SOUNDS)[number]["id"];

export type CafeSoundMix = Record<CafeSoundId, { on: boolean; volume: number }>;

export type CafeSettings = {
  focusMin: number;
  shortMin: number;
  longMin: number;
  autoStart: boolean;
  sounds: CafeSoundMix;
};

export const DEFAULT_CAFE: CafeSettings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  autoStart: true,
  sounds: {
    rain: { on: false, volume: 0.55 },
    kitchen: { on: false, volume: 0.4 },
    talk: { on: false, volume: 0.35 },
    fire: { on: false, volume: 0.5 },
    coffee: { on: false, volume: 0.45 },
  },
};

type Layer = { gain: GainNode; stop: () => void };

function noiseBuffer(ctx: AudioContext, seconds: number, color: "white" | "brown") {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (color === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function makeFilter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  return filter;
}

export class CafeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers = new Map<CafeSoundId, Layer>();
  private white: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;

  private context() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.white = noiseBuffer(ctx, 2, "white");
    this.brown = noiseBuffer(ctx, 2, "brown");
    return ctx;
  }

  async resume() {
    const ctx = this.context();
    if (ctx.state === "suspended") await ctx.resume();
  }

  apply(mix: CafeSoundMix) {
    const ctx = this.context();
    (Object.keys(mix) as CafeSoundId[]).forEach((id) => {
      const setting = mix[id];
      let layer = this.layers.get(id);
      if (setting.on && !layer) {
        layer = this.start(id);
        this.layers.set(id, layer);
      }
      if (!setting.on && layer) {
        layer.stop();
        this.layers.delete(id);
        return;
      }
      if (layer) {
        layer.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, setting.volume)), ctx.currentTime, 0.05);
      }
    });
  }

  chime() {
    const ctx = this.context();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.14;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  dispose() {
    this.layers.forEach((layer) => layer.stop());
    this.layers.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private start(id: CafeSoundId): Layer {
    const ctx = this.context();
    const master = this.master;
    if (!master || !this.white || !this.brown) throw new Error("audio");
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    const timers: number[] = [];
    const sources: AudioScheduledSourceNode[] = [];

    const loop = (buffer: AudioBuffer, target: AudioNode) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(target);
      source.start();
      sources.push(source);
      return source;
    };

    const burst = (
      at: number,
      freq: number,
      dur: number,
      level: number,
      type: OscillatorType = "triangle",
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g);
      g.connect(gain);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    };

    if (id === "rain") {
      const filter = makeFilter(ctx, "bandpass", 1400, 0.6);
      const bed = ctx.createGain();
      bed.gain.value = 0.22;
      filter.connect(bed);
      bed.connect(gain);
      loop(this.white, filter);
      const tick = () => {
        const at = ctx.currentTime + 0.02;
        burst(at, 1800 + Math.random() * 2200, 0.05, 0.08 + Math.random() * 0.12, "square");
        timers.push(window.setTimeout(tick, 70 + Math.random() * 180));
      };
      tick();
    }

    if (id === "kitchen") {
      const filter = makeFilter(ctx, "lowpass", 420, 0.6);
      const bed = ctx.createGain();
      bed.gain.value = 0.08;
      filter.connect(bed);
      bed.connect(gain);
      loop(this.brown, filter);
      const tick = () => {
        const at = ctx.currentTime + 0.02;
        burst(at, 900 + Math.random() * 1800, 0.07, 0.16, "square");
        if (Math.random() > 0.45) burst(at + 0.09, 1400 + Math.random() * 800, 0.04, 0.08, "square");
        timers.push(window.setTimeout(tick, 900 + Math.random() * 2200));
      };
      tick();
    }

    if (id === "talk") {
      const low = makeFilter(ctx, "bandpass", 420, 0.8);
      const high = makeFilter(ctx, "bandpass", 1100, 0.7);
      const lowGain = ctx.createGain();
      const highGain = ctx.createGain();
      lowGain.gain.value = 0.2;
      highGain.gain.value = 0.12;
      low.connect(lowGain);
      high.connect(highGain);
      lowGain.connect(gain);
      highGain.connect(gain);
      loop(this.white, low);
      loop(this.white, high);
      const lfo = (param: AudioParam, rate: number, depth: number) => {
        const osc = ctx.createOscillator();
        const depthGain = ctx.createGain();
        osc.frequency.value = rate;
        depthGain.gain.value = depth;
        osc.connect(depthGain);
        depthGain.connect(param);
        osc.start();
        sources.push(osc);
      };
      lfo(lowGain.gain, 2.4, 0.12);
      lfo(highGain.gain, 3.7, 0.08);
    }

    if (id === "fire") {
      const filter = makeFilter(ctx, "lowpass", 280, 0.5);
      const bed = ctx.createGain();
      bed.gain.value = 0.35;
      filter.connect(bed);
      bed.connect(gain);
      loop(this.brown, filter);
      const tick = () => {
        const at = ctx.currentTime + 0.01;
        burst(at, 180 + Math.random() * 900, 0.04 + Math.random() * 0.05, 0.12 + Math.random() * 0.2, "square");
        timers.push(window.setTimeout(tick, 120 + Math.random() * 380));
      };
      tick();
    }

    if (id === "coffee") {
      const filter = makeFilter(ctx, "highpass", 1600, 0.4);
      const bed = ctx.createGain();
      bed.gain.value = 0.16;
      filter.connect(bed);
      bed.connect(gain);
      loop(this.white, filter);
      const tick = () => {
        const at = ctx.currentTime + 0.02;
        burst(at, 90 + Math.random() * 40, 0.18, 0.2, "sine");
        burst(at + 0.05, 220, 0.08, 0.06, "triangle");
        timers.push(window.setTimeout(tick, 650 + Math.random() * 500));
      };
      tick();
    }

    return {
      gain,
      stop: () => {
        timers.forEach((id) => window.clearTimeout(id));
        const when = ctx.currentTime + 0.05;
        sources.forEach((source) => {
          try {
            source.stop(when);
          } catch {
            /* already stopped */
          }
        });
        gain.disconnect();
      },
    };
  }
}
