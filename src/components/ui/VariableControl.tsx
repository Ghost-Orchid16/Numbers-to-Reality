import { useId, type CSSProperties, type ReactNode } from 'react'
import { QUANTITY_COLORS, QUANTITY_TEXT } from '../../design/quantities'
import { formatNumber } from '../../sim/core/format'
import type { BooleanParamSpec, NumberParamSpec } from '../../sim/core/simulation'

function displayValue(spec: NumberParamSpec, value: number): string {
  return formatNumber(value * (spec.toDisplay ?? 1), spec.digits ?? 0)
}

interface VariableControlProps {
  spec: NumberParamSpec
  value: number
  onChange: (value: number) => void
  /** Show the one-line description under the slider. */
  showDescription?: boolean
  /** A derived reading shown beside the label, e.g. "T/W 1.51". */
  aside?: ReactNode
}

/**
 * A slider for one model variable. Built on a native range input, so it works
 * with the keyboard (arrows, Page Up/Down, Home/End) and screen readers.
 */
export function VariableControl({ spec, value, onChange, showDescription = true, aside }: VariableControlProps) {
  const id = useId()
  const descId = `${id}-desc`
  const fill = ((value - spec.min) / (spec.max - spec.min)) * 100
  const color = spec.quantity ? QUANTITY_COLORS[spec.quantity] : QUANTITY_COLORS.neutral
  const shown = displayValue(spec, value)

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="flex items-baseline gap-2 text-sm text-fg">
          {spec.label}
          {spec.symbol && (
            <span className={`font-math text-base italic ${spec.quantity ? QUANTITY_TEXT[spec.quantity] : ''}`}>
              {spec.symbol}
              {spec.symbolSub && <sub className="ml-px text-[0.7em] not-italic">{spec.symbolSub}</sub>}
            </span>
          )}
        </label>
        <span className="flex items-baseline gap-3">
          {aside && <span className="text-xs text-muted">{aside}</span>}
          <output htmlFor={id} className="tabular text-sm text-fg">
            {shown}
            <span className="ml-1 text-xs text-muted">{spec.unit}</span>
          </output>
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="range mt-1"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-valuetext={`${shown} ${spec.unit}`}
        aria-describedby={showDescription && spec.description ? descId : undefined}
        style={{ '--q': color, '--fill': `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      {spec.marks && (
        <div className="relative -mt-0.5 h-4" aria-hidden>
          {spec.marks.map((mark) => {
            const left = ((mark.value - spec.min) / (spec.max - spec.min)) * 100
            return (
              <button
                key={mark.label}
                type="button"
                tabIndex={-1}
                className="absolute -translate-x-1/2 text-2xs text-dim transition-colors hover:text-fg"
                style={{ left: `${left}%` }}
                onClick={() => onChange(mark.value)}
              >
                {mark.label}
              </button>
            )
          })}
        </div>
      )}
      {showDescription && spec.description && (
        <p id={descId} className="mt-1 text-xs leading-snug text-dim">
          {spec.description}
        </p>
      )}
    </div>
  )
}

interface ToggleControlProps {
  spec: BooleanParamSpec
  value: boolean
  onChange: (value: boolean) => void
  showDescription?: boolean
}

/** An on/off model switch. */
export function ToggleControl({ spec, value, onChange, showDescription = true }: ToggleControlProps) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span id={`${id}-label`} className="text-sm text-fg">
          {spec.label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-labelledby={`${id}-label`}
          aria-describedby={showDescription && spec.description ? descId : undefined}
          onClick={() => onChange(!value)}
          className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${value ? 'border-transparent bg-q-neutral/90' : 'border-line-strong bg-transparent'}`}
        >
          <span
            className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ${value ? 'left-[1.1rem] bg-void' : 'left-0.5 bg-muted'}`}
          />
          <span className="sr-only">{value ? 'On' : 'Off'}</span>
        </button>
      </div>
      {showDescription && spec.description && (
        <p id={descId} className="mt-1 text-xs leading-snug text-dim">
          {spec.description}
        </p>
      )}
    </div>
  )
}
