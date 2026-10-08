import { useEffect, useLayoutEffect, useRef } from 'react'
import type { LiveChannel } from '../sim/core/liveChannel'

/**
 * Runs `effect` with every published value of a live channel, outside React
 * rendering. The latest `effect` is always used without re-subscribing.
 */
export function useLiveEffect<T extends object>(channel: LiveChannel<T>, effect: (value: T) => void): void {
  const effectRef = useRef(effect)
  useLayoutEffect(() => {
    effectRef.current = effect
  })
  useEffect(() => channel.subscribe((value) => effectRef.current(value)), [channel])
}
