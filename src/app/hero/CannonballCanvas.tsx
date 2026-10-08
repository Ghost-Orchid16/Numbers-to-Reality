import { useEffect, useRef } from 'react'
import { anomalyAtTime, makeShot, positionAt, timeToAnomaly, type Shot } from './cannonball'
import { LAUNCH_RADIUS, layoutDiagram, toScreen, type DiagramLayout } from './diagram'

/** Launch speeds as multiples of circular speed at the mountain top. */
const SPEEDS = [0.62, 0.84, 1, 1.15, 1.46]
/** Real seconds for one circular orbit. */
const CIRCULAR_PERIOD_SECONDS = 7
/** Delay between successive shots (s). */
const STAGGER = 1.1

interface CannonballCanvasProps {
  reducedMotion: boolean
  className?: string
  onLayout?: (layout: DiagramLayout) => void
}

export function CannonballCanvas({ reducedMotion, className, onLayout }: CannonballCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onLayoutRef = useRef(onLayout)
  useEffect(() => {
    onLayoutRef.current = onLayout
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const phi0 = Math.PI / 2 // launch from the top of the planet
    const rMax = 40
    const shots: Shot[] = SPEEDS.map((k) => makeShot(k, LAUNCH_RADIUS, rMax))
    // Normalised time → seconds: one circular orbit takes CIRCULAR_PERIOD_SECONDS.
    const circularPeriod = 2 * Math.PI * LAUNCH_RADIUS ** 1.5
    const timeScale = circularPeriod / CIRCULAR_PERIOD_SECONDS
    const drawDuration = shots.map((s) => (s.kind === 'falls' || s.kind === 'escape' ? timeToAnomaly(s, s.nuEnd) : (2 * Math.PI) / s.n))

    let layout = layoutDiagram(1, 1)
    let dpr = 1
    let fontsReady = false
    document.fonts?.ready.then(() => {
      fontsReady = true
    })

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      layout = layoutDiagram(rect.width, rect.height)
      onLayoutRef.current?.(layout)
    }

    const pathColor = 'rgba(207, 224, 247, 0.5)'
    const strongPath = 'rgba(207, 224, 247, 0.85)'
    const velocity = '#8fcbfe'

    const drawGrid = () => {
      const { cx, cy, radius } = layout
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(160, 180, 210, 0.07)'
      for (const r of [1.5, 2, 2.5, 3, 3.5]) {
        ctx.beginPath()
        ctx.arc(cx, cy, r * radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.beginPath()
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.moveTo(cx + Math.cos(a) * radius * 1.12, cy + Math.sin(a) * radius * 1.12)
        ctx.lineTo(cx + Math.cos(a) * radius * 3.6, cy + Math.sin(a) * radius * 3.6)
      }
      ctx.stroke()
    }

    const drawPlanet = () => {
      const { cx, cy, radius } = layout
      ctx.fillStyle = '#0a1120'
      ctx.strokeStyle = 'rgba(155, 184, 232, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // The mountain Newton imagined, exaggerated as in his drawing.
      const [mx, my] = toScreen(layout, 0, LAUNCH_RADIUS)
      const [bx1, by1] = toScreen(layout, -0.09, 0.996)
      const [bx2, by2] = toScreen(layout, 0.09, 0.996)
      ctx.beginPath()
      ctx.moveTo(bx1, by1)
      ctx.lineTo(mx, my)
      ctx.lineTo(bx2, by2)
      ctx.fillStyle = '#0a1120'
      ctx.fill()
      ctx.stroke()
    }

    const drawShot = (shot: Shot, nuTo: number, highlight: boolean) => {
      const steps = 220
      ctx.beginPath()
      for (let i = 0; i <= steps; i++) {
        const nu = shot.nuStart + ((nuTo - shot.nuStart) * i) / steps
        const [x, y] = positionAt(shot, nu, phi0)
        const [sx, sy] = toScreen(layout, x, y)
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.strokeStyle = highlight ? strongPath : pathColor
      ctx.lineWidth = highlight ? 1.5 : 1.15
      ctx.setLineDash(shot.kind === 'escape' ? [5, 5] : [])
      ctx.stroke()
      ctx.setLineDash([])
    }

    const drawDot = (x: number, y: number) => {
      const [sx, sy] = toScreen(layout, x, y)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx, sy, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawLabel = (text: string, x: number, y: number, align: CanvasTextAlign) => {
      if (!fontsReady) return
      const [sx, sy] = toScreen(layout, x, y)
      ctx.font = '500 12px "Archivo Variable", system-ui, sans-serif'
      ctx.fillStyle = velocity
      ctx.textBaseline = 'middle'
      // Keep labels inside the canvas: flip alignment if the text would overflow.
      const w = ctx.measureText(text).width
      let a = align
      if (a === 'left' && sx + w > layout.width - 8) a = 'right'
      if (a === 'right' && sx - w < 8) a = 'left'
      ctx.textAlign = a
      ctx.fillText(text, a === 'left' ? Math.max(8, sx) : Math.min(layout.width - 8, sx), sy)
    }

    const labelFor = (shot: Shot) => {
      const v = `${shot.speedKms.toFixed(1)} km/s`
      if (shot.kind === 'circular') return `${v} — orbit`
      if (shot.kind === 'escape') return `${v} — escape`
      return v
    }

    /** Draws everything at `elapsed` seconds since the start of the sequence. */
    const render = (elapsed: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, layout.width, layout.height)
      drawGrid()

      shots.forEach((shot, i) => {
        const t = Math.max(0, elapsed - i * STAGGER) * timeScale
        if (t <= 0) return
        const highlight = shot.kind === 'circular'
        const finished = t >= drawDuration[i]
        let nuNow: number
        if (shot.kind === 'falls' || shot.kind === 'escape') {
          nuNow = finished ? shot.nuEnd : anomalyAtTime(shot, t)
          drawShot(shot, nuNow, highlight)
        } else {
          drawShot(shot, finished ? shot.nuStart + 2 * Math.PI : anomalyAtTime(shot, t), highlight)
          nuNow = anomalyAtTime(shot, t)
        }
        const [x, y] = positionAt(shot, nuNow, phi0)
        if (!(shot.kind === 'escape' && finished)) drawDot(x, y)

        // Label each path once the ball has passed the point it is attached to.
        let labelNu: number
        let align: CanvasTextAlign = 'left'
        let offset = 0.12
        if (shot.kind === 'falls') {
          labelNu = shot.nuEnd
          align = 'left'
        } else if (shot.kind === 'circular') {
          labelNu = shot.nuStart + Math.PI * 1.22
          align = 'right'
          offset = 0.14
        } else if (shot.kind === 'elliptic') {
          labelNu = Math.PI
          align = 'left'
        } else {
          labelNu = shot.nuEnd * 0.55
          align = 'left'
        }
        if (t >= timeToAnomaly(shot, labelNu)) {
          const [lx, ly] = positionAt(shot, labelNu, phi0)
          const r = Math.hypot(lx, ly)
          drawLabel(labelFor(shot), lx * (1 + offset / r), ly * (1 + offset / r), align)
        }
      })

      drawPlanet()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    if (reducedMotion) {
      // A complete, still diagram: every curve drawn, no motion.
      const draw = () => render(1e4)
      draw()
      document.fonts?.ready.then(draw)
      const ro2 = new ResizeObserver(draw)
      ro2.observe(canvas)
      return () => {
        ro.disconnect()
        ro2.disconnect()
      }
    }

    let raf = 0
    let visible = true
    let elapsed = 0
    let last = performance.now()
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting)
      if (visible) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(canvas)

    function frame(now: number) {
      if (!visible) return
      elapsed += Math.min(0.1, (now - last) / 1000)
      last = now
      render(elapsed)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
    }
  }, [reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="Newton's cannonball: balls fired horizontally from a mountain. Below 7.8 kilometres per second they fall back to the ground; at 7.8 they orbit; faster gives an ellipse; at 11 and above they escape."
    />
  )
}
