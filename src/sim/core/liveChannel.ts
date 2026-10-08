/**
 * A channel for high-frequency simulation output (telemetry that changes every
 * frame). Subscribers receive the same mutable snapshot object and write
 * straight into the DOM, so per-frame values never trigger React renders.
 */
export class LiveChannel<T extends object> {
  readonly value: T
  private readonly listeners = new Set<(value: T) => void>()

  constructor(initial: T) {
    this.value = initial
  }

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener)
    listener(this.value)
    return () => {
      this.listeners.delete(listener)
    }
  }

  publish(): void {
    for (const listener of this.listeners) listener(this.value)
  }
}
