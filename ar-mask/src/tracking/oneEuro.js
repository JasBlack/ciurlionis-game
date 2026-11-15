// One Euro filter over a small vector: steady when the head is still, quick when it moves.
// (Casiez, Roussel, Vogel 2012.) The speed that opens the filter is the length of the whole vector's
// derivative, so all components share one cutoff and the vector is not bent while it is smoothed.

const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);

export class OneEuro {
  constructor(size, { minCutoff = 1, beta = 0, dCutoff = 1 } = {}) {
    this.size = size;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new Float64Array(size);
    this.dx = new Float64Array(size);
    this.primed = false;
  }

  /** Forget the past and continue from `value` with no smoothing across the jump. */
  reset(value) {
    if (value) {
      for (let i = 0; i < this.size; i++) this.x[i] = value[i];
      this.dx.fill(0);
      this.primed = true;
    } else {
      this.primed = false;
    }
  }

  /** @returns the filter's own state array (do not keep it across calls). */
  filter(value, dt) {
    if (!this.primed) { this.reset(value); return this.x; }
    const ad = alpha(this.dCutoff, dt);
    let speed2 = 0;
    for (let i = 0; i < this.size; i++) {
      const d = (value[i] - this.x[i]) / dt;
      this.dx[i] += (d - this.dx[i]) * ad;
      speed2 += this.dx[i] * this.dx[i];
    }
    const a = alpha(this.minCutoff + this.beta * Math.sqrt(speed2), dt);
    for (let i = 0; i < this.size; i++) this.x[i] += (value[i] - this.x[i]) * a;
    return this.x;
  }
}
