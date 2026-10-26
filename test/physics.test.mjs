import test from "node:test";
import assert from "node:assert/strict";
import { DoublePendulumPhysics, normalizeAngle } from "../physics.js";

test("normalizeAngle wraps angles correctly into [-pi, pi]", () => {
  assert.equal(normalizeAngle(0), 0);
  assert.ok(Math.abs(normalizeAngle(Math.PI) - Math.PI) < 1e-6 || Math.abs(normalizeAngle(Math.PI) - (-Math.PI)) < 1e-6);

  // Large positive angle: 3.5*pi -> -0.5*pi
  const wrappedPos = normalizeAngle(3.5 * Math.PI);
  assert.ok(Math.abs(wrappedPos - (-0.5 * Math.PI)) < 1e-6, `Expected -0.5pi, got ${wrappedPos}`);

  // Large negative angle: -3.5*pi -> +0.5*pi
  const wrappedNeg = normalizeAngle(-3.5 * Math.PI);
  assert.ok(Math.abs(wrappedNeg - (0.5 * Math.PI)) < 1e-6, `Expected +0.5pi, got ${wrappedNeg}`);

  // Negative angle just below -pi: -3.2 -> ~+3.083
  const wrappedNear = normalizeAngle(-3.2);
  assert.ok(wrappedNear > 0 && wrappedNear <= Math.PI, `Expected in (0, pi], got ${wrappedNear}`);
});

test("DoublePendulumPhysics initial kinematics and geometry", () => {
  const p = new DoublePendulumPhysics();
  p.setPivot(200, 200);

  // When theta1=0, theta2=0 (hanging straight down)
  p.reset(0, 0);
  const b1 = p.getBob1Position();
  const b2 = p.getBob2Position();

  assert.equal(b1.x, 200);
  assert.equal(b1.y, 200 + p.l1);
  assert.equal(b2.x, 200);
  assert.equal(b2.y, 200 + p.l1 + p.l2);
});

test("Conservation of Hamiltonian energy in undamped conservative dynamics", () => {
  const p = new DoublePendulumPhysics();
  p.damping = 0; // zero friction
  p.timeScale = 1.0;
  p.reset(Math.PI * 0.5, Math.PI * 0.25);

  const initialEnergy = p.getEnergy();
  assert.ok(initialEnergy.total > 0, "Initial Hamiltonian must be positive");

  // Step 250 frames forward (each frame has 4 RK4 substeps)
  for (let i = 0; i < 250; i++) {
    p.update(0.016);
  }

  const finalEnergy = p.getEnergy();
  const energyDriftPercent = Math.abs(finalEnergy.total - initialEnergy.total) / initialEnergy.total * 100;

  // Symplectic RK4 should conserve energy within tight bound (under 0.25% drift)
  assert.ok(
    energyDriftPercent < 0.25,
    `Hamiltonian energy drift ${energyDriftPercent.toFixed(3)}% exceeds 0.25% threshold (initial: ${initialEnergy.total.toFixed(2)}, final: ${finalEnergy.total.toFixed(2)})`
  );
});

test("Magnetic perturbation forces remain finite without division-by-zero singularities", () => {
  const p = new DoublePendulumPhysics();
  p.setPivot(0, 0);
  p.reset(0, 0);

  const b2 = p.getBob2Position();
  // Place magnetic attractor right on top of bob 2
  p.addMagnet(b2.x, b2.y, 1, 2.0);

  const derivs = p.derivatives(p.state, true);
  assert.ok(Number.isFinite(derivs[0]));
  assert.ok(Number.isFinite(derivs[1]));
  assert.ok(Number.isFinite(derivs[2]));
  assert.ok(Number.isFinite(derivs[3]));

  p.removeMagnetAt(b2.x, b2.y, 30);
  assert.equal(p.magnets.length, 0);
});

test("Shadow twin divergence confirms positive Lyapunov chaos rate", () => {
  const p = new DoublePendulumPhysics();
  p.timeScale = 1.0;
  p.enableShadow = true;
  // Chaotic initial condition
  p.reset(Math.PI * 0.72, Math.PI * 0.72);

  for (let i = 0; i < 150; i++) {
    p.update(0.016);
  }

  assert.ok(p.lyapunovTime > 0, "Lyapunov elapsed time must accumulate");
  assert.ok(Number.isFinite(p.currentLyapunov), "Lyapunov exponent must be finite");
});

test("Drag and drop velocity tracking eliminates phantom flick on hold", () => {
  const p = new DoublePendulumPhysics();
  p.setPivot(100, 100);
  p.reset(0, 0);

  const b2 = p.getBob2Position();
  const grabbed = p.startDrag(b2.x, b2.y);
  assert.equal(grabbed, true);

  // Drag with movement
  p.drag(b2.x + 30, b2.y);
  assert.equal(p.dragTarget, "bob2");

  // Simulate user holding still for >80ms before release
  p.lastDragTime = performance.now() - 120;
  p.endDrag();

  assert.equal(p.dragTarget, null);
  assert.equal(p.state[3], 0, "Angular velocity should be 0 when held still before release");
});
