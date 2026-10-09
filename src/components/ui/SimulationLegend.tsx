import type { ReactNode } from 'react'
import { QUANTITY_COLORS } from '../../design/quantities'
import type { QuantityKind } from '../../sim/core/simulation'

export type LegendMark = 'line' | 'dashed' | 'arrow' | 'dot'

export interface LegendItem {
  id: string
  label: ReactNode
  /** Drawn the way the scene draws it. */
  mark: LegendMark
  /** Colour family of the quantity; or pass `color` for neutral scene marks. */
  quantity?: QuantityKind
  color?: string
  /** For dimmed encodings, such as the part of a path still ahead. */
  opacity?: number
}

function Swatch({ mark, color, opacity = 1 }: { mark: LegendMark; color: string; opacity?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 20 10" className="h-2.5 w-5 shrink-0 overflow-visible" style={{ opacity }}>
      {mark === 'dot' ? (
        <circle cx="10" cy="5" r="3" fill={color} />
      ) : (
        <>
          <line
            x1="1"
            y1="5"
            x2={mark === 'arrow' ? 14 : 19}
            y2="5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={mark === 'dashed' ? '3.5 3' : undefined}
          />
          {mark === 'arrow' && <path d="M13 1.5 L19.5 5 L13 8.5 Z" fill={color} />}
        </>
      )}
    </svg>
  )
}

/**
 * Key to a simulation's visual encodings. Labels stay in neutral ink and the
 * swatch carries the colour, so identity never rests on colour alone.
 */
export function SimulationLegend({ items, label = 'Legend', className }: { items: readonly LegendItem[]; label?: string; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul aria-label={label} className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted ${className ?? ''}`}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-1.5">
          <Swatch mark={item.mark} color={item.color ?? QUANTITY_COLORS[item.quantity ?? 'neutral']} opacity={item.opacity} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
