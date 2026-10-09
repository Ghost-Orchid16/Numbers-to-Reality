import { useRef, type CSSProperties } from 'react'
import { useLiveEffect } from '../../hooks/useLiveEffect'
import type { LiveChannel } from '../../sim/core/liveChannel'

interface LiveTextProps<T extends object> {
  channel: LiveChannel<T>
  format: (value: T) => string
  className?: string
  style?: CSSProperties
}

/**
 * Text that follows a live simulation value. Writes straight to the DOM node,
 * and only when the formatted string actually changes.
 */
export function LiveText<T extends object>({ channel, format, className, style }: LiveTextProps<T>) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef<string | null>(null)

  useLiveEffect(channel, (value) => {
    const text = format(value)
    if (text !== last.current && ref.current) {
      ref.current.textContent = text
      last.current = text
    }
  })

  return <span ref={ref} className={className} style={style} />
}
