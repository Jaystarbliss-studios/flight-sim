export interface SimulationClockOptions {
  stepSeconds?: number;
  maxFrameSeconds?: number;
  maxStepsPerFrame?: number;
}

/**
 * Keeps simulation time independent from render FPS.
 * The accumulator prevents a slow frame from producing an unstable physics step.
 */
export class SimulationClock {
  private readonly stepSeconds: number;
  private readonly maxFrameSeconds: number;
  private readonly maxStepsPerFrame: number;
  private accumulator = 0;

  constructor(options: SimulationClockOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? 1 / 60;
    this.maxFrameSeconds = options.maxFrameSeconds ?? 0.1;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 8;
  }

  public reset() {
    this.accumulator = 0;
  }

  /**
   * Feed real elapsed time and execute a fixed number of simulation steps.
   * Returns the interpolation alpha for optional render interpolation.
   */
  public advance(realDeltaSeconds: number, step: (dt: number) => void): number {
    const safeDelta = Math.max(0, Math.min(realDeltaSeconds, this.maxFrameSeconds));
    this.accumulator += safeDelta;

    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      step(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps += 1;
    }

    // Drop an extreme backlog rather than allowing a spiral of death.
    if (steps >= this.maxStepsPerFrame && this.accumulator > this.stepSeconds * 2) {
      this.accumulator = this.stepSeconds;
    }

    return this.accumulator / this.stepSeconds;
  }
}
