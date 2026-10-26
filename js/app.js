import { DoublePendulumPhysics } from "./physics.js";
import { AudioEngine } from "./audio.js";

class TorsionApp {
  constructor() {
    this.physics = new DoublePendulumPhysics();
    this.audio = new AudioEngine();

    // DOM Elements
    this.simCanvas = document.getElementById("simulation-canvas");
    this.simCtx = this.simCanvas.getContext("2d");
    this.phaseCanvas = document.getElementById("phase-canvas");
    this.phaseCtx = this.phaseCanvas.getContext("2d");

    // Trajectory buffers
    this.trail = [];
    this.shadowTrail = [];
    this.maxTrailLength = 1200;
    this.glowIntensity = 15;

    // Simulation run state
    this.isPaused = false;
    this.lastTime = performance.now();
    this.fpsCounter = 0;
    this.fpsTimer = performance.now();
    this.currentFps = 60;

    // Phase portrait plot buffer
    this.phaseHistory = [];
    this.maxPhasePoints = 500;

    // UI state
    this.theme = "crt";
    this.showPhasePortrait = true;
    this.showEnergyBar = true;
    this.isMagnetMode = false; // Magnet placement tool mode

    this.init();
  }

  init() {
    this.resizeCanvases();
    window.addEventListener("resize", () => this.resizeCanvases());

    this.setupEventListeners();
    this.setupAudioHook();
    this.loadPreset("butterfly");

    // Begin main animation loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    const simRect = this.simCanvas.getBoundingClientRect();
    this.simCanvas.width = simRect.width * dpr;
    this.simCanvas.height = simRect.height * dpr;
    this.simCtx.scale(dpr, dpr);

    const phaseRect = this.phaseCanvas.getBoundingClientRect();
    this.phaseCanvas.width = phaseRect.width * dpr;
    this.phaseCanvas.height = phaseRect.height * dpr;
    this.phaseCtx.scale(dpr, dpr);

    // Center pivot in main simulation
    this.physics.setPivot(simRect.width / 2, simRect.height * 0.38);
  }

  setupAudioHook() {
    this.physics.onCrossing = (vel) => {
      const b2 = this.physics.getBob2Position();
      const simRect = this.simCanvas.getBoundingClientRect();
      const pan = ((b2.x - simRect.width / 2) / (simRect.width / 2));
      this.audio.playCrossingChime(vel, pan);
    };
  }

  setupEventListeners() {
    // Canvas pointer interactions
    this.simCanvas.addEventListener("mousedown", (e) => this.handlePointerDown(e));
    window.addEventListener("mousemove", (e) => this.handlePointerMove(e));
    window.addEventListener("mouseup", () => this.handlePointerUp());

    // Touch support
    this.simCanvas.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      this.handlePointerDown({
        clientX: t.clientX,
        clientY: t.clientY,
        button: 0,
        preventDefault: () => e.preventDefault()
      });
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.handlePointerMove({ clientX: t.clientX, clientY: t.clientY });
      }
    });

    window.addEventListener("touchend", () => this.handlePointerUp());

    // Context menu (right click to place/remove magnets)
    this.simCanvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const rect = this.simCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.toggleMagnetAt(x, y);
    });

    // Top Bar Buttons
    document.getElementById("btn-play-pause").addEventListener("click", () => this.togglePause());
    document.getElementById("btn-reset").addEventListener("click", () => this.resetSimulation());
    document.getElementById("btn-clear-trail").addEventListener("click", () => this.clearTrail());
    document.getElementById("btn-audio").addEventListener("click", () => this.toggleAudio());
    document.getElementById("btn-toggle-drawer").addEventListener("click", () => this.toggleDrawer());

    const btnMagnet = document.getElementById("btn-magnet-mode");
    if (btnMagnet) {
      btnMagnet.addEventListener("click", () => this.toggleMagnetMode());
    }

    // Presets
    document.querySelectorAll(".btn-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-preset").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.loadPreset(btn.dataset.preset);
        this.audio.playUiClick(1400);
      });
    });

    // Sliders
    this.bindSlider("slider-length1", "val-length1", (v) => { this.physics.l1 = parseFloat(v); });
    this.bindSlider("slider-length2", "val-length2", (v) => { this.physics.l2 = parseFloat(v); });
    this.bindSlider("slider-mass1", "val-mass1", (v) => { this.physics.m1 = parseFloat(v); });
    this.bindSlider("slider-mass2", "val-mass2", (v) => { this.physics.m2 = parseFloat(v); });
    this.bindSlider("slider-gravity", "val-gravity", (v) => { this.physics.g = parseFloat(v); });
    this.bindSlider("slider-damping", "val-damping", (v) => { this.physics.damping = parseFloat(v); });
    this.bindSlider("slider-timescale", "val-timescale", (v) => { this.physics.timeScale = parseFloat(v); });
    this.bindSlider("slider-trail", "val-trail", (v) => { this.maxTrailLength = parseInt(v, 10); });

    // Toggles
    this.bindToggle("toggle-shadow", (val) => { this.physics.enableShadow = val; });
    this.bindToggle("toggle-phase", (val) => {
      this.showPhasePortrait = val;
      const el = document.getElementById("hud-phase-portrait");
      if (el) el.style.display = val ? "flex" : "none";
    });
    this.bindToggle("toggle-energy", (val) => {
      this.showEnergyBar = val;
      const el = document.getElementById("hud-energy-bar");
      if (el) el.style.display = val ? "flex" : "none";
    });

    // Theme selector
    document.querySelectorAll(".theme-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".theme-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this.setTheme(chip.dataset.theme);
        this.audio.playUiClick(1600);
      });
    });

    // Exports
    document.getElementById("btn-export-png").addEventListener("click", () => this.exportPng());
    document.getElementById("btn-export-svg").addEventListener("click", () => this.exportSvg());

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === "r" || e.key === "R") {
        this.resetSimulation();
      } else if (e.key === "t" || e.key === "T") {
        this.clearTrail();
      } else if (e.key === "m" || e.key === "M") {
        this.toggleAudio();
      } else if (e.key === "c" || e.key === "C") {
        this.toggleMagnetMode();
      } else if (e.key === "s" || e.key === "S") {
        const toggle = document.getElementById("toggle-shadow");
        if (toggle) {
          toggle.checked = !toggle.checked;
          this.physics.enableShadow = toggle.checked;
          this.showToast(`Shadow Twin: ${toggle.checked ? "ON" : "OFF"}`);
        }
      } else if (e.key >= "1" && e.key <= "5") {
        const presets = ["butterfly", "loop", "magnets", "harmonic", "zerog"];
        const chosen = presets[parseInt(e.key, 10) - 1];
        if (chosen) {
          document.querySelectorAll(".btn-preset").forEach(b => {
            b.classList.toggle("active", b.dataset.preset === chosen);
          });
          this.loadPreset(chosen);
        }
      }
    });
  }

  bindSlider(sliderId, readoutId, callback) {
    const slider = document.getElementById(sliderId);
    const readout = document.getElementById(readoutId);
    if (!slider || !readout) return;

    slider.addEventListener("input", () => {
      readout.textContent = slider.value;
      callback(slider.value);
    });
  }

  bindToggle(toggleId, callback) {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    toggle.addEventListener("change", () => callback(toggle.checked));
  }

  toggleMagnetMode() {
    this.isMagnetMode = !this.isMagnetMode;
    const btn = document.getElementById("btn-magnet-mode");
    if (btn) btn.classList.toggle("active", this.isMagnetMode);
    this.simCanvas.style.cursor = this.isMagnetMode ? "copy" : "crosshair";
    this.showToast(this.isMagnetMode ? "Magnet Tool: ON (Click to place/remove)" : "Magnet Tool: OFF");
    this.audio.playUiClick(this.isMagnetMode ? 1500 : 900);
  }

  toggleMagnetAt(x, y) {
    if (!this.physics.removeMagnetAt(x, y)) {
      this.physics.addMagnet(x, y, 1, 1.0);
      this.showToast("Magnetic Coil Added (+)");
    } else {
      this.showToast("Magnetic Coil Removed");
    }
    this.audio.playUiClick(1500);
  }

  handlePointerDown(e) {
    this.audio.resume();
    const rect = this.simCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isMagnetMode) {
      this.toggleMagnetAt(x, y);
      return;
    }

    if (e.button === 0) {
      const hit = this.physics.startDrag(x, y);
      if (hit) {
        this.audio.playUiClick(900);
      }
    }
  }

  handlePointerMove(e) {
    if (this.isMagnetMode) return;
    const rect = this.simCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.physics.drag(x, y);
  }

  handlePointerUp() {
    this.physics.endDrag();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById("btn-play-pause");
    btn.innerHTML = this.isPaused
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    this.audio.playUiClick(this.isPaused ? 800 : 1200);
    this.showToast(this.isPaused ? "Paused" : "Running");
  }

  resetSimulation() {
    this.physics.reset();
    this.clearTrail();
    this.audio.playUiClick(700);
    this.showToast("Simulation Reset");
  }

  clearTrail() {
    this.trail = [];
    this.shadowTrail = [];
    this.phaseHistory = [];
    this.audio.playUiClick(1100);
    this.showToast("Trajectory Trails Cleared");
  }

  toggleAudio() {
    const active = this.audio.toggleMute();
    const btn = document.getElementById("btn-audio");
    btn.classList.toggle("active", active);
    btn.innerHTML = active
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/></svg>`;
    this.showToast(active ? "Audio Synthesizer: ON" : "Audio Synthesizer: MUTED");
  }

  toggleDrawer() {
    const drawer = document.getElementById("control-drawer");
    drawer.classList.toggle("hidden");
    const btn = document.getElementById("btn-toggle-drawer");
    btn.classList.toggle("active", !drawer.classList.contains("hidden"));
    this.audio.playUiClick(1000);
  }

  setTheme(name) {
    this.theme = name;
    document.body.setAttribute("data-theme", name);
    this.showToast(`Theme: ${name.toUpperCase()}`);
  }

  loadPreset(name) {
    this.physics.clearMagnets();

    switch (name) {
      case "butterfly":
        this.physics.l1 = 160;
        this.physics.l2 = 140;
        this.physics.m1 = 15;
        this.physics.m2 = 12;
        this.physics.g = 9.81;
        this.physics.damping = 0.0002;
        this.physics.enableShadow = true;
        this.physics.reset(Math.PI * 0.72, Math.PI * 0.72);
        break;

      case "loop":
        this.physics.l1 = 150;
        this.physics.l2 = 150;
        this.physics.m1 = 20;
        this.physics.m2 = 10;
        this.physics.g = 9.81;
        this.physics.damping = 0.0001;
        this.physics.reset(Math.PI * 0.98, Math.PI * 0.98);
        break;

      case "magnets":
        this.physics.l1 = 150;
        this.physics.l2 = 130;
        this.physics.m1 = 14;
        this.physics.m2 = 10;
        this.physics.g = 8.0;
        this.physics.damping = 0.0004;
        this.physics.reset(Math.PI * 0.6, 0.2);

        const simRect = this.simCanvas.getBoundingClientRect();
        const cx = simRect.width / 2;
        const cy = simRect.height * 0.65;
        this.physics.addMagnet(cx - 120, cy + 30, 1, 1.2);
        this.physics.addMagnet(cx, cy + 70, -1, 1.5);
        this.physics.addMagnet(cx + 120, cy + 30, 1, 1.2);
        break;

      case "harmonic":
        this.physics.l1 = 170;
        this.physics.l2 = 170;
        this.physics.m1 = 25;
        this.physics.m2 = 5;
        this.physics.g = 9.81;
        this.physics.damping = 0.0005;
        this.physics.enableShadow = false;
        this.physics.reset(0.25, 0.0);
        break;

      case "zerog":
        this.physics.l1 = 150;
        this.physics.l2 = 130;
        this.physics.m1 = 15;
        this.physics.m2 = 15;
        this.physics.g = 0.0;
        this.physics.damping = 0.00005;
        this.physics.reset(Math.PI * 0.5, Math.PI * 0.5);
        this.physics.state[2] = 2.5;
        this.physics.state[3] = -1.8;
        break;
    }

    this.clearTrail();
    this.syncSlidersToPhysics();
  }

  syncSlidersToPhysics() {
    this.updateSliderUI("slider-length1", "val-length1", this.physics.l1);
    this.updateSliderUI("slider-length2", "val-length2", this.physics.l2);
    this.updateSliderUI("slider-mass1", "val-mass1", this.physics.m1);
    this.updateSliderUI("slider-mass2", "val-mass2", this.physics.m2);
    this.updateSliderUI("slider-gravity", "val-gravity", this.physics.g);
    this.updateSliderUI("slider-damping", "val-damping", this.physics.damping);
  }

  updateSliderUI(sliderId, readoutId, val) {
    const slider = document.getElementById(sliderId);
    const readout = document.getElementById(readoutId);
    if (slider) slider.value = val;
    if (readout) readout.textContent = val;
  }

  showToast(text) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("visible");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove("visible");
    }, 2200);
  }

  // MAIN RUNTIME TICK
  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    // FPS calculation
    this.fpsCounter++;
    if (currentTime - this.fpsTimer >= 500) {
      this.currentFps = Math.round((this.fpsCounter * 1000) / (currentTime - this.fpsTimer));
      this.fpsCounter = 0;
      this.fpsTimer = currentTime;
      const elFps = document.getElementById("telemetry-fps");
      if (elFps) elFps.textContent = `${this.currentFps} FPS`;
    }

    if (!this.isPaused) {
      this.physics.update(dt);

      // Record trajectory coordinates
      const b2 = this.physics.getBob2Position();
      this.trail.push({ x: b2.x, y: b2.y, vel: Math.abs(this.physics.state[3]) });
      if (this.trail.length > this.maxTrailLength) this.trail.shift();

      if (this.physics.enableShadow) {
        const sb2 = this.physics.getBob2Position(this.physics.shadowState);
        this.shadowTrail.push({ x: sb2.x, y: sb2.y });
        if (this.shadowTrail.length > this.maxTrailLength) this.shadowTrail.shift();
      }

      // Record phase portrait coordinates [theta2, omega2]
      this.phaseHistory.push({
        x: this.physics.state[1],
        y: this.physics.state[3]
      });
      if (this.phaseHistory.length > this.maxPhasePoints) this.phaseHistory.shift();

      // Audio synthesizer drone modulation
      const energy = this.physics.getEnergy();
      this.audio.updateDrone(energy.kinetic, this.physics.state[3]);

      // Telemetry readouts update
      this.updateTelemetryHUD(energy);
    }

    // Render pass
    this.renderSimulation();
    if (this.showPhasePortrait) {
      this.renderPhasePortrait();
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  updateTelemetryHUD(energy) {
    const elEnergy = document.getElementById("telemetry-energy");
    if (elEnergy) {
      elEnergy.textContent = `${Math.round(energy.total)} J`;
    }

    const elLyapunov = document.getElementById("telemetry-lyapunov");
    if (elLyapunov) {
      const val = this.physics.currentLyapunov;
      elLyapunov.textContent = `${val >= 0 ? "+" : ""}${val.toFixed(2)} λ/s`;
      elLyapunov.style.color = val > 0.5 ? "var(--accent-warn)" : "var(--accent-primary)";
    }

    // Energy HUD progress bar
    if (this.showEnergyBar) {
      const kinBar = document.getElementById("bar-fill-kinetic");
      const potBar = document.getElementById("bar-fill-potential");
      const kinVal = document.getElementById("energy-val-kinetic");
      const potVal = document.getElementById("energy-val-potential");

      const k = Math.max(0, energy.kinetic);
      const p = Math.max(0, energy.potential);
      const totalVis = Math.max(k + p, 100);

      const kPct = Math.min(100, (k / totalVis) * 100);
      const pPct = Math.min(100, (p / totalVis) * 100);

      if (kinBar) kinBar.style.width = `${kPct}%`;
      if (potBar) potBar.style.width = `${pPct}%`;
      if (kinVal) kinVal.textContent = `${Math.round(k)} J`;
      if (potVal) potVal.textContent = `${Math.round(p)} J`;
    }
  }

  renderSimulation() {
    const ctx = this.simCtx;
    const rect = this.simCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Clear background
    ctx.clearRect(0, 0, w, h);

    // Draw background grid
    this.renderEngineeringGrid(ctx, w, h);

    // Draw magnetic coils
    this.renderMagnets(ctx);

    // Draw shadow twin trajectory (coral / muted pink)
    if (this.physics.enableShadow && this.shadowTrail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 68, 102, 0.45)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < this.shadowTrail.length; i++) {
        const pt = this.shadowTrail[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // Draw primary vector phosphor trail
    if (this.trail.length > 1) {
      const style = getComputedStyle(document.body);
      const accentColor = style.getPropertyValue("--accent-primary").trim() || "#00ff88";

      ctx.save();
      ctx.shadowBlur = this.glowIntensity;
      ctx.shadowColor = accentColor;
      ctx.lineWidth = 2.0;

      for (let i = 1; i < this.trail.length; i++) {
        const p1 = this.trail[i - 1];
        const p2 = this.trail[i];
        const alpha = (i / this.trail.length);

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${this.hexToRgb(accentColor)}, ${alpha * 0.9})`;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw shadow pendulum arms (if enabled)
    if (this.physics.enableShadow) {
      const sb1 = this.physics.getBob1Position(this.physics.shadowState);
      const sb2 = this.physics.getBob2Position(this.physics.shadowState);

      ctx.save();
      ctx.strokeStyle = "rgba(255, 68, 102, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.physics.pivot.x, this.physics.pivot.y);
      ctx.lineTo(sb1.x, sb1.y);
      ctx.lineTo(sb2.x, sb2.y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 68, 102, 0.6)";
      ctx.beginPath();
      ctx.arc(sb2.x, sb2.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw primary pendulum rods and bobs
    const b1 = this.physics.getBob1Position();
    const b2 = this.physics.getBob2Position();
    const style = getComputedStyle(document.body);
    const accentPrimary = style.getPropertyValue("--accent-primary").trim() || "#00ff88";
    const accentSecondary = style.getPropertyValue("--accent-secondary").trim() || "#00e1ff";

    // Pivot mount
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.shadowColor = accentPrimary;
    ctx.beginPath();
    ctx.arc(this.physics.pivot.x, this.physics.pivot.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Rod 1
    ctx.strokeStyle = "#4d5566";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.physics.pivot.x, this.physics.pivot.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.stroke();

    // Rod 2
    ctx.strokeStyle = "#8b95a5";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();

    // Bob 1
    ctx.fillStyle = accentSecondary;
    ctx.shadowBlur = 10;
    ctx.shadowColor = accentSecondary;
    ctx.beginPath();
    const r1 = Math.max(6, Math.sqrt(this.physics.m1) * 2.2);
    ctx.arc(b1.x, b1.y, r1, 0, Math.PI * 2);
    ctx.fill();

    // Bob 2 (Interactive emitter)
    ctx.fillStyle = accentPrimary;
    ctx.shadowBlur = 14;
    ctx.shadowColor = accentPrimary;
    ctx.beginPath();
    const r2 = Math.max(7, Math.sqrt(this.physics.m2) * 2.4);
    ctx.arc(b2.x, b2.y, r2, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b2.x, b2.y, r2 * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderEngineeringGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 1;

    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Pivot crosshairs
    const px = this.physics.pivot.x;
    const py = this.physics.pivot.y;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px - 30, py);
    ctx.lineTo(px + 30, py);
    ctx.moveTo(px, py - 30);
    ctx.lineTo(px, py + 30);
    ctx.stroke();
    ctx.restore();
  }

  renderMagnets(ctx) {
    for (const m of this.physics.magnets) {
      ctx.save();
      const isAttract = m.polarity > 0;
      const col = isAttract ? "var(--accent-primary)" : "var(--accent-danger)";
      ctx.strokeStyle = col;
      ctx.fillStyle = isAttract ? "rgba(0, 255, 136, 0.12)" : "rgba(255, 51, 102, 0.12)";
      ctx.lineWidth = 1.5;

      // Outer ripple
      ctx.beginPath();
      ctx.arc(m.x, m.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Core coil
      ctx.beginPath();
      ctx.arc(m.x, m.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // Sign symbol
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isAttract ? "+" : "-", m.x, m.y);
      ctx.restore();
    }
  }

  /**
   * Discontinuity-free Phase Portrait Renderer.
   * Breaks line strokes when angle passes the +/- pi boundary to prevent artificial cross-screen slashing.
   */
  renderPhasePortrait() {
    const ctx = this.phaseCtx;
    const rect = this.phaseCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Center axes
    const cx = w / 2;
    const cy = h / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Plot trajectory points: Theta2 (angle) vs Omega2 (angular velocity)
    if (this.phaseHistory.length > 2) {
      const style = getComputedStyle(document.body);
      const accent = style.getPropertyValue("--accent-secondary").trim() || "#00e1ff";

      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.2;

      const scaleX = (w * 0.42) / Math.PI;
      const scaleY = (h * 0.42) / 12;

      let isNewSegment = true;
      ctx.beginPath();

      for (let i = 0; i < this.phaseHistory.length; i++) {
        const pt = this.phaseHistory[i];
        const px = cx + pt.x * scaleX;
        const py = cy - pt.y * scaleY;

        if (i > 0) {
          const prev = this.phaseHistory[i - 1];
          // Detect phase angle boundary wrap
          if (Math.abs(pt.x - prev.x) > Math.PI) {
            ctx.stroke();
            ctx.beginPath();
            isNewSegment = true;
          }
        }

        if (isNewSegment) {
          ctx.moveTo(px, py);
          isNewSegment = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // Head pointer
      const last = this.phaseHistory[this.phaseHistory.length - 1];
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx + last.x * scaleX, cy - last.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  hexToRgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    const num = parseInt(hex, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  // EXPORT ENGINE
  exportPng() {
    this.audio.playUiClick(1500);
    const link = document.createElement("a");
    link.download = `torsion-chaos-${Date.now()}.png`;
    link.href = this.simCanvas.toDataURL("image/png");
    link.click();
    this.showToast("Snapshot Exported (PNG)");
  }

  exportSvg() {
    this.audio.playUiClick(1500);
    if (this.trail.length < 2) {
      this.showToast("Trail too short to export SVG");
      return;
    }

    const rect = this.simCanvas.getBoundingClientRect();
    const style = getComputedStyle(document.body);
    const accentPrimary = style.getPropertyValue("--accent-primary").trim() || "#00ff88";
    const accentSecondary = style.getPropertyValue("--accent-secondary").trim() || "#00e1ff";
    const bgPrimary = style.getPropertyValue("--bg-primary").trim() || "#0a0b0e";

    let pathData = `M ${this.trail[0].x.toFixed(1)} ${this.trail[0].y.toFixed(1)}`;
    for (let i = 1; i < this.trail.length; i++) {
      pathData += ` L ${this.trail[i].x.toFixed(1)} ${this.trail[i].y.toFixed(1)}`;
    }

    let shadowPathData = "";
    if (this.physics.enableShadow && this.shadowTrail.length > 1) {
      shadowPathData = `M ${this.shadowTrail[0].x.toFixed(1)} ${this.shadowTrail[0].y.toFixed(1)}`;
      for (let i = 1; i < this.shadowTrail.length; i++) {
        shadowPathData += ` L ${this.shadowTrail[i].x.toFixed(1)} ${this.shadowTrail[i].y.toFixed(1)}`;
      }
    }

    const px = this.physics.pivot.x.toFixed(1);
    const py = this.physics.pivot.y.toFixed(1);

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rect.width} ${rect.height}" width="${rect.width}" height="${rect.height}">
  <defs>
    <radialGradient id="pivotGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accentPrimary}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${accentPrimary}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Background -->
  <rect width="100%" height="100%" fill="${bgPrimary}"/>
  <!-- Pivot Crosshair -->
  <line x1="${px - 20}" y1="${py}" x2="${px + 20}" y2="${py}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="${px}" y1="${py - 20}" x2="${px}" y2="${py + 20}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3"/>
  <circle cx="${px}" cy="${py}" r="5" fill="#ffffff"/>
  <!-- Shadow Trail -->
  ${shadowPathData ? `<path d="${shadowPathData}" fill="none" stroke="rgba(255, 68, 102, 0.4)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
  <!-- Primary Chaotic Trajectory -->
  <path d="${pathData}" fill="none" stroke="${accentPrimary}" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `torsion-vector-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    this.showToast("Theme-Aware Vector Exported (SVG)");
  }
}

// Instantiate on DOM load
window.addEventListener("DOMContentLoaded", () => {
  window.app = new TorsionApp();
});
