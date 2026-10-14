/**
 * Synthesizes organic, realistic bird calls procedurally via the browser Web Audio API.
 * No external MP3 downloads required — pure mathematical acoustics.
 */

class BirdAudioSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play a procedural birdsong based on species character
   */
  public play(birdId: string) {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      if (birdId.includes("hoopoe")) {
        // Hoopoe: resonant, hollow triple coo 'oop-oop-oop' (~720Hz)
        for (let i = 0; i < 3; i++) {
          const t = now + i * 0.28;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(700, t);
          osc.frequency.exponentialRampToValueAtTime(740, t + 0.08);
          osc.frequency.exponentialRampToValueAtTime(680, t + 0.18);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.22, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(t);
          osc.stop(t + 0.2);
        }
      } else if (birdId.includes("kingfisher") || birdId.includes("buyung")) {
        // Kingfisher: sharp, rapid piercing river whistle
        for (let i = 0; i < 2; i++) {
          const t = now + i * 0.16;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(3200, t);
          osc.frequency.exponentialRampToValueAtTime(4600, t + 0.04);
          osc.frequency.exponentialRampToValueAtTime(3800, t + 0.12);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(t);
          osc.stop(t + 0.14);
        }
      } else if (birdId.includes("owl")) {
        // Owl: deep, velvety double hoot (~420Hz)
        [0, 0.45].forEach((offset, idx) => {
          const t = now + offset;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(idx === 0 ? 440 : 380, t);
          osc.frequency.linearRampToValueAtTime(360, t + 0.35);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.28, t + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(t);
          osc.stop(t + 0.38);
        });
      } else {
        // Robin / Songbird: joyful liquid musical warble with FM vibrato
        const baseFreq = 2800 + Math.random() * 400;
        const notes = [0, 4, 7, 11, 14, 12];

        notes.forEach((semitones, idx) => {
          const t = now + idx * 0.09;
          const osc = ctx.createOscillator();
          const vibrato = ctx.createOscillator();
          const vibratoGain = ctx.createGain();
          const gain = ctx.createGain();

          // FM vibrato
          vibrato.frequency.value = 18;
          vibratoGain.gain.value = 70;
          vibrato.connect(vibratoGain);
          vibratoGain.connect(osc.frequency);

          const freq = baseFreq * Math.pow(2, semitones / 12);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.linearRampToValueAtTime(freq * 1.05, t + 0.08);

          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

          osc.connect(gain);
          gain.connect(ctx.destination);

          vibrato.start(t);
          vibrato.stop(t + 0.09);
          osc.start(t);
          osc.stop(t + 0.09);
        });
      }
    } catch (err) {
      console.warn("Web Audio synthesis unavailable:", err);
    }
  }
}

export const birdAudio = new BirdAudioSynthesizer();
