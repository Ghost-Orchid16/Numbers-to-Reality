import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register once, before any component uses them.
gsap.registerPlugin(ScrollTrigger, useGSAP)

// Mobile browsers resize the viewport as the address bar shows and hides;
// recalculating every trigger on those resizes causes visible jumps.
ScrollTrigger.config({ ignoreMobileResize: true })

export { gsap, ScrollTrigger, useGSAP }
