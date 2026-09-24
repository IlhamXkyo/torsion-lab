/**
 * Torsion Lab - Rigid Body Chaos Dynamics & Lagrangian Mechanics Engine
 * Integrates equations of motion via 4th-order Runge-Kutta (RK4) with symplectic precision.
 */

export class DoublePendulumPhysics {
  constructor() {
    // Physical attributes (SI units approximation)
    this.l1 = 160;   // Length rod 1 (pixels)
    this.l2 = 140;   // Length rod 2 (pixels)
    this.m1 = 15;    // Mass bob 1
    this.m2 = 12;    // Mass bob 2
    this.g = 9.81;   // Gravitational constant
    this.damping = 0.0003; // Air friction coefficient
    this.timeScale = 1.0;

    // State vectors: [theta1, theta2, omega1, omega2]
    this.state = [Math.PI * 0.75, Math.PI * 0.5, 0.0, 0.0];

    // Shadow twin state for Lyapunov chaos exponent estimation
    this.shadowOffset = 0.0001;
    this.shadowState = [this.state[0] + this.shadowOffset, this.state[1], 0.0, 0.0];
    this.enableShadow = true;
    this.lyapunovSum = 0;
    this.lyapunovSteps = 0;
    this.currentLyapunov = 0;

    // Magnetic attractors array: { x, y, strength, polarity: 1|-1 }
    this.magnets = [];

    // Pivot anchor (center of simulation)
    this.pivot = { x: 0, y: 0 };

    // Interaction drag states
    this.dragTarget = null; // 'bob1' | 'bob2' | null
    this.dragOffset = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.lastMouse = { x: 0, y: 0 };

    // Axis crossing event listeners for audio triggering
    this.onCrossing = null;
    this.prevTheta2 = this.state[1];
  }

  setPivot(x, y) {
    this.pivot.x = x;
    this.pivot.y = y;
  }

  reset(theta1 = Math.PI * 0.75, theta2 = Math.PI * 0.5) {
    this.state = [theta1, theta2, 0.0, 0.0];
    this.shadowState = [theta1 + this.shadowOffset, theta2, 0.0, 0.0];
    this.lyapunovSum = 0;
    this.lyapunovSteps = 0;
    this.currentLyapunov = 0;
    this.prevTheta2 = theta2;
  }

  /**
   * Calculates derivatives [dtheta1/dt, dtheta2/dt, domega1/dt, domega2/dt]
   * based on Euler-Lagrange equations for coupled double pendulum.
   */
  derivatives(s, applyMagnets = true) {
    const [t1, t2, w1, w2] = s;
    const { l1, l2, m1, m2, g, damping } = this;

    const delta = t1 - t2;
    const sinDelta = Math.sin(delta);
    const cosDelta = Math.cos(delta);

    // Common denominators from mass matrix inversion
    const den1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2));
    const den2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2));

    // Angular acceleration for bob 1 (alpha1)
    const num1 = -g * (2 * m1 + m2) * Math.sin(t1)
                 - m2 * g * Math.sin(t1 - 2 * t2)
                 - 2 * sinDelta * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * cosDelta);
    let alpha1 = num1 / den1;

    // Angular acceleration for bob 2 (alpha2)
    const num2 = 2 * sinDelta * (w1 * w1 * l1 * (m1 + m2)
                 + g * (m1 + m2) * Math.cos(t1)
                 + w2 * w2 * l2 * m2 * cosDelta);
    let alpha2 = num2 / den2;

    // Damping (viscous friction)
    alpha1 -= damping * w1 * Math.abs(w1);
    alpha2 -= damping * w2 * Math.abs(w2);

    // External magnetic perturbation forces acting on bob 2
    if (applyMagnets && this.magnets.length > 0) {
      const pos2 = this.getBob2Position(s);
      for (const m of this.magnets) {
        const dx = m.x - pos2.x;
        const dy = m.y - pos2.y;
        const distSq = dx * dx + dy * dy + 400; // Softening parameter to prevent singularity
        const dist = Math.sqrt(distSq);
        const forceMag = (m.strength * m.polarity * 15000) / distSq;
        
        // Project force onto tangential direction of bob 2
        // Bob 2 tangential unit vector is (-cos(t2), -sin(t2)) rotated by pi/2: (-sin(t2), cos(t2))
        const fx = (dx / dist) * forceMag;
        const fy = (dy / dist) * forceMag;
        const torque = (-Math.sin(t2) * fx + Math.cos(t2) * fy) / (m2 * l2);
        alpha2 += torque;
      }
    }

    return [w1, w2, alpha1, alpha2];
  }

  /**
   * 4th-order Runge-Kutta numerical step
   */
  rk4Step(s, dt, applyMagnets = true) {
    const k1 = this.derivatives(s, applyMagnets);
    
    const s2 = s.map((val, i) => val + 0.5 * dt * k1[i]);
    const k2 = this.derivatives(s2, applyMagnets);

    const s3 = s.map((val, i) => val + 0.5 * dt * k2[i]);
    const k3 = this.derivatives(s3, applyMagnets);

    const s4 = s.map((val, i) => val + dt * k3[i]);
    const k4 = this.derivatives(s4, applyMagnets);

    return s.map((val, i) => val + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }

  update(dt = 0.016) {
    if (this.dragTarget) {
      // Bob is pinned by user cursor, hold position and reset velocities
      return;
    }

    const scaledDt = (dt * this.timeScale) / 4; // 4 substeps for numerical stability
    for (let sub = 0; sub < 4; sub++) {
      this.state = this.rk4Step(this.state, scaledDt, true);

      if (this.enableShadow) {
        this.shadowState = this.rk4Step(this.shadowState, scaledDt, true);

        // Compute phase space separation between master and shadow
        const dTheta1 = this.state[0] - this.shadowState[0];
        const dTheta2 = this.state[1] - this.shadowState[1];
        const distance = Math.sqrt(dTheta1 * dTheta1 + dTheta2 * dTheta2);

        if (distance > 0) {
          const lambda = Math.log(distance / this.shadowOffset);
          this.lyapunovSum += lambda;
          this.lyapunovSteps++;
          if (this.lyapunovSteps % 50 === 0) {
            this.currentLyapunov = this.lyapunovSum / this.lyapunovSteps;
          }
          // Renormalize shadow state when divergence grows too large
          if (distance > 0.4) {
            const factor = this.shadowOffset / distance;
            this.shadowState[0] = this.state[0] + dTheta1 * factor;
            this.shadowState[1] = this.state[1] + dTheta2 * factor;
            this.shadowState[2] = this.state[2];
            this.shadowState[3] = this.state[3];
          }
        }
      }
    }

    // Wrap angles to [-pi, pi] for display stability
    this.state[0] = (this.state[0] + Math.PI) % (2 * Math.PI) - Math.PI;
    this.state[1] = (this.state[1] + Math.PI) % (2 * Math.PI) - Math.PI;

    // Equilibrium crossing detection (zero crossing of theta2)
    if (this.onCrossing && Math.sign(this.prevTheta2) !== Math.sign(this.state[1])) {
      this.onCrossing(Math.abs(this.state[3]));
    }
    this.prevTheta2 = this.state[1];
  }

  getBob1Position(s = this.state) {
    return {
      x: this.pivot.x + this.l1 * Math.sin(s[0]),
      y: this.pivot.y + this.l1 * Math.cos(s[0])
    };
  }

  getBob2Position(s = this.state) {
    const b1 = this.getBob1Position(s);
    return {
      x: b1.x + this.l2 * Math.sin(s[1]),
      y: b1.y + this.l2 * Math.cos(s[1])
    };
  }

  /**
   * Computes Hamiltonian energy metrics (Kinetic T + Potential V)
   */
  getEnergy() {
    const [t1, t2, w1, w2] = this.state;
    const { l1, l2, m1, m2, g } = this;

    // Kinetic Energy
    const T1 = 0.5 * m1 * (l1 * w1) ** 2;
    const T2 = 0.5 * m2 * ((l1 * w1) ** 2 + (l2 * w2) ** 2 + 2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2));
    const kinetic = T1 + T2;

    // Potential Energy (zero reference at pivot)
    const y1 = -l1 * Math.cos(t1);
    const y2 = y1 - l2 * Math.cos(t2);
    const potential = m1 * g * y1 + m2 * g * y2;

    const total = kinetic + potential;
    return { kinetic, potential, total };
  }

  // Interactive Drag & Drop
  startDrag(mouseX, mouseY) {
    const b1 = this.getBob1Position();
    const b2 = this.getBob2Position();

    const d1 = Math.hypot(mouseX - b1.x, mouseY - b1.y);
    const d2 = Math.hypot(mouseX - b2.x, mouseY - b2.y);

    if (d2 < 24) {
      this.dragTarget = 'bob2';
      this.lastMouse = { x: mouseX, y: mouseY };
      return true;
    } else if (d1 < 24) {
      this.dragTarget = 'bob1';
      this.lastMouse = { x: mouseX, y: mouseY };
      return true;
    }
    return false;
  }

  drag(mouseX, mouseY) {
    if (!this.dragTarget) return;

    this.dragVelocity = {
      x: mouseX - this.lastMouse.x,
      y: mouseY - this.lastMouse.y
    };
    this.lastMouse = { x: mouseX, y: mouseY };

    if (this.dragTarget === 'bob1') {
      const dx = mouseX - this.pivot.x;
      const dy = mouseY - this.pivot.y;
      this.state[0] = Math.atan2(dx, dy);
      this.state[2] = 0;
    } else if (this.dragTarget === 'bob2') {
      const b1 = this.getBob1Position();
      const dx = mouseX - b1.x;
      const dy = mouseY - b1.y;
      this.state[1] = Math.atan2(dx, dy);
      this.state[3] = 0;
    }

    if (this.enableShadow) {
      this.shadowState[0] = this.state[0] + this.shadowOffset;
      this.shadowState[1] = this.state[1];
      this.shadowState[2] = 0;
      this.shadowState[3] = 0;
    }
  }

  endDrag() {
    if (this.dragTarget) {
      // Transfer flick impulse velocity
      if (this.dragTarget === 'bob1') {
        this.state[2] = (this.dragVelocity.x / this.l1) * 2;
      } else {
        this.state[3] = (this.dragVelocity.x / this.l2) * 2;
      }
      this.dragTarget = null;
    }
  }

  addMagnet(x, y, polarity = 1, strength = 1.0) {
    this.magnets.push({ x, y, polarity, strength, id: Date.now() + Math.random() });
  }

  removeMagnetAt(x, y, radius = 24) {
    const initialLen = this.magnets.length;
    this.magnets = this.magnets.filter(m => Math.hypot(m.x - x, m.y - y) > radius);
    return initialLen !== this.magnets.length;
  }

  clearMagnets() {
    this.magnets = [];
  }
}
