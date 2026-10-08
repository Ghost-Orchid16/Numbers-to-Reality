import { useEffect, useState, type RefObject } from 'react'

/**
 * True while the element is within `margin` of the viewport. Used to mount
 * expensive content shortly before it scrolls into view.
 *
 * Hysteresis: content mounts when it comes within `enterMargin` and only
 * unmounts once it is beyond `exitMargin`, so scrolling back and forth near
 * the boundary never thrashes WebGL contexts.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  { enterMargin = '100%', exitMargin = '300%' }: { enterMargin?: string; exitMargin?: string } = {},
): boolean {
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const enter = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true)
      },
      { rootMargin: `${enterMargin} 0px ${enterMargin} 0px` },
    )
    const exit = new IntersectionObserver(
      (entries) => {
        if (entries.every((e) => !e.isIntersecting)) setNear(false)
      },
      { rootMargin: `${exitMargin} 0px ${exitMargin} 0px` },
    )
    enter.observe(el)
    exit.observe(el)
    return () => {
      enter.disconnect()
      exit.disconnect()
    }
  }, [ref, enterMargin, exitMargin])

  return near
}

/** True while any part of the element is on screen. */
export function useInViewport(ref: RefObject<Element | null>, rootMargin = '0px'): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])

  return visible
}
