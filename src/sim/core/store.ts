/**
 * A minimal observable store for low-frequency state (parameters, UI modes).
 * React binds to it through `useStore` (useSyncExternalStore), so components
 * only re-render when the slice they select actually changes.
 */
export type Listener = () => void

export interface Store<T> {
  get(): T
  set(next: T | ((prev: T) => T)): void
  /** Shallow-merge a partial update into an object store. */
  patch(partial: Partial<T>): void
  subscribe(listener: Listener): () => void
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<Listener>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  return {
    get: () => state,
    set(next) {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      if (Object.is(value, state)) return
      state = value
      emit()
    },
    patch(partial) {
      let changed = false
      for (const key in partial) {
        if (!Object.is(partial[key], state[key])) {
          changed = true
          break
        }
      }
      if (!changed) return
      state = { ...state, ...partial }
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
