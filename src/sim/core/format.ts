/**
 * Formatting for live scientific quantities.
 *
 * Rules: SI units, a precision that matches what the model can honestly
 * claim, a true minus sign (U+2212), and unit prefixes that keep numbers
 * between roughly 1 and 1,000 so the eye can compare them at a glance.
 */
export interface Formatted {
  value: string
  unit: string
}

export const MINUS = '−'
const DASH = '—'

const formatters = new Map<number, Intl.NumberFormat>()

function numberFormat(digits: number): Intl.NumberFormat {
  let nf = formatters.get(digits)
  if (!nf) {
    nf = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    formatters.set(digits, nf)
  }
  return nf
}

/** Fixed-precision number with thousands separators and a typographic minus. */
export function formatNumber(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return DASH
  // Avoid "−0" after rounding.
  const rounded = Number(x.toFixed(digits))
  const text = numberFormat(digits).format(Math.abs(rounded))
  return rounded < 0 ? MINUS + text : text
}

function join(f: Formatted): string {
  return f.unit ? `${f.value} ${f.unit}` : f.value
}

export function toText(f: Formatted): string {
  return join(f)
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
}

export function toSuperscript(text: string): string {
  return [...text].map((c) => SUPERSCRIPT[c] ?? c).join('')
}

/** Scientific notation with Unicode superscripts, e.g. 3.40×10⁻³. */
export function formatScientific(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return DASH
  if (x === 0) return '0'
  const exponent = Math.floor(Math.log10(Math.abs(x)))
  const mantissa = x / 10 ** exponent
  const m = formatNumber(mantissa, digits)
  return exponent === 0 ? m : `${m}×10${toSuperscript(String(exponent))}`
}

export function formatDistance(meters: number): Formatted {
  const abs = Math.abs(meters)
  if (!Number.isFinite(meters)) return { value: DASH, unit: '' }
  if (abs < 1000) return { value: formatNumber(meters, 0), unit: 'm' }
  if (abs < 100_000) return { value: formatNumber(meters / 1000, 1), unit: 'km' }
  return { value: formatNumber(meters / 1000, 0), unit: 'km' }
}

export function formatSpeed(mps: number): Formatted {
  if (!Number.isFinite(mps)) return { value: DASH, unit: '' }
  if (Math.abs(mps) < 1000) return { value: formatNumber(mps, 0), unit: 'm/s' }
  return { value: formatNumber(mps / 1000, 2), unit: 'km/s' }
}

export function formatAcceleration(mps2: number): Formatted {
  if (!Number.isFinite(mps2)) return { value: DASH, unit: '' }
  return { value: formatNumber(mps2, Math.abs(mps2) >= 100 ? 0 : 1), unit: 'm/s²' }
}

export function formatForce(newtons: number): Formatted {
  const abs = Math.abs(newtons)
  if (!Number.isFinite(newtons)) return { value: DASH, unit: '' }
  if (abs >= 1e6) return { value: formatNumber(newtons / 1e6, 2), unit: 'MN' }
  if (abs >= 1e3) return { value: formatNumber(newtons / 1e3, 0), unit: 'kN' }
  return { value: formatNumber(newtons, 0), unit: 'N' }
}

export function formatMass(kg: number): Formatted {
  if (!Number.isFinite(kg)) return { value: DASH, unit: '' }
  if (Math.abs(kg) >= 1000) return { value: formatNumber(kg / 1000, 1), unit: 't' }
  return { value: formatNumber(kg, 0), unit: 'kg' }
}

export function formatPressure(pascals: number): Formatted {
  if (!Number.isFinite(pascals)) return { value: DASH, unit: '' }
  if (Math.abs(pascals) >= 1000) return { value: formatNumber(pascals / 1000, 1), unit: 'kPa' }
  return { value: formatNumber(pascals, 0), unit: 'Pa' }
}

export function formatDensity(kgPerM3: number): Formatted {
  if (!Number.isFinite(kgPerM3)) return { value: DASH, unit: '' }
  if (kgPerM3 >= 0.1) return { value: formatNumber(kgPerM3, 3), unit: 'kg/m³' }
  return { value: formatScientific(kgPerM3, 2), unit: 'kg/m³' }
}

export function formatAngle(degrees: number, digits = 1): Formatted {
  return { value: formatNumber(degrees, digits), unit: '°' }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Launch-style mission clock: T−00:10, T+01:12, T+1:32:05. */
export function formatMissionTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return `T+${DASH}`
  const sign = seconds < 0 ? MINUS : '+'
  // A countdown shows the whole seconds remaining; elapsed time shows whole seconds elapsed.
  const whole = seconds < 0 ? Math.ceil(-seconds) : Math.floor(seconds)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  return h > 0 ? `T${sign}${h}:${pad2(m)}:${pad2(s)}` : `T${sign}${pad2(m)}:${pad2(s)}`
}

/** Human-scale duration: "47 s", "3 min 47 s", "1 h 28 min". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return DASH
  const total = Math.round(Math.abs(seconds))
  if (total < 60) return `${total} s`
  if (total < 3600) {
    const m = Math.floor(total / 60)
    const s = total % 60
    return s === 0 ? `${m} min` : `${m} min ${s} s`
  }
  const h = Math.floor(total / 3600)
  const m = Math.round((total % 3600) / 60)
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
