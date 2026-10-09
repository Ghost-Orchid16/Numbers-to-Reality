import { useSyncExternalStore } from 'react'
import type { Store } from '../sim/core/store'

/**
 * Subscribes a component to a store. The selector must return a primitive or
 * an existing reference (never a freshly built object), otherwise React sees
 * a new value on every check and re-renders forever.
 */
export function useStore<T extends object, U = T>(store: Store<T>, selector: (state: T) => U = (s) => s as unknown as U): U {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  )
}
