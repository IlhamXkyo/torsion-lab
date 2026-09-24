/**
 * Torsion Lab - Procedural Web Audio Engine
 * Generates dynamic physical acoustic feedback, harmonic axis chimes, and drone resonance.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = true;
    this.droneGain = null;
    this.droneOsc = null;
    this.filter = null;
    this.isInitialized = false;

    // Harmonic scale frequencies (Pentatonic Minor for pleasing mechanical resonance)
    this.scale = [110, 130.81, 146.83, 164.81, 196.00, 220, 261.63, 293.66, 329.63, 392.00, 440, 523.25];
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Ambient dynamic drone
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.setValueAtTime(280, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = "sawtooth";
      this.droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 bass

      this.droneOsc.connect(this.filter);
      this.filter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
      this.droneOsc.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio initialization deferred until user interaction.", e);
    }
  }

  resume() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.resume();
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.35;
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.05);
    }
    return !this.isMuted;
  }

  /**
   * Modulates the continuous drone based on total kinetic energy and velocity
   */
  updateDrone(kineticEnergy, angularVelocity) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const clampedEnergy = Math.min(Math.max(kineticEnergy, 0), 2000);
    const filterFreq = 120 + Math.sqrt(clampedEnergy) * 35;
    const oscPitch = 55 + Math.min(Math.abs(angularVelocity) * 4, 80);

    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    this.droneOsc.frequency.setTargetAtTime(oscPitch, now, 0.08);
  }

  /**
   * Triggers a glassy resonant chime when pendulum passes vertical axis
   */
  playCrossingChime(velocity, panX = 0) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;

    const speed = Math.abs(velocity);
    if (speed < 0.2) return;

    const now = this.ctx.currentTime;

    // Pick note from pentatonic scale based on speed
    const noteIndex = Math.min(Math.floor(speed * 2.5), this.scale.length - 1);
    const freq = this.scale[noteIndex];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Stereo Panner
    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      const clampedPan = Math.max(-0.9, Math.min(0.9, panX));
      panner.pan.setValueAtTime(clampedPan, now);
    }

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    // Dynamic amplitude decay
    const amp = Math.min(0.25, 0.05 + speed * 0.03);
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    if (panner) {
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      osc.connect(gain);
      gain.connect(this.masterGain);
    }

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Click sound for UI tactile interaction
   */
  playUiClick(pitch = 1200) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }
}
