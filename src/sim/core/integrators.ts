/**
 * Computes dy/dt for a state vector y at time t, writing into `out`.
 * Implementations must not allocate: they run thousands of times per solve.
 */
export type Derivative = (t: number, y: Float64Array, out: Float64Array) => void

/**
 * Classical fourth-order Runge–Kutta integrator with preallocated scratch
 * buffers. Local error is O(h⁵) per step, global error O(h⁴).
 */
export class RK4 {
  private readonly k1: Float64Array
  private readonly k2: Float64Array
  private readonly k3: Float64Array
  private readonly k4: Float64Array
  private readonly tmp: Float64Array
  readonly size: number

  constructor(size: number) {
    this.size = size
    this.k1 = new Float64Array(size)
    this.k2 = new Float64Array(size)
    this.k3 = new Float64Array(size)
    this.k4 = new Float64Array(size)
    this.tmp = new Float64Array(size)
  }

  /** Advances `y` in place from t to t + h. */
  step(f: Derivative, t: number, y: Float64Array, h: number): void {
    const { k1, k2, k3, k4, tmp, size } = this
    const half = h / 2

    f(t, y, k1)
    for (let i = 0; i < size; i++) tmp[i] = y[i] + half * k1[i]
    f(t + half, tmp, k2)
    for (let i = 0; i < size; i++) tmp[i] = y[i] + half * k2[i]
    f(t + half, tmp, k3)
    for (let i = 0; i < size; i++) tmp[i] = y[i] + h * k3[i]
    f(t + h, tmp, k4)

    const sixth = h / 6
    for (let i = 0; i < size; i++) {
      y[i] += sixth * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
    }
  }
}
