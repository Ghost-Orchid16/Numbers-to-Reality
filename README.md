# Numbers → Reality

**Where mathematics becomes reality.**

An interactive, scroll-driven science museum. Each chapter puts a real simulation in the browser and shows the mathematics running it: the equations on screen use the same numbers the 3D scene is drawing, and the controls change the inputs to those equations.

| Chapter | Concept | Status |
| --- | --- | --- |
| 00 Intro | Newton's cannonball: one equation, from a thrown ball to an orbit | Live |
| 01 Rocket launch | How mathematics turns thrust into motion and eventually orbital velocity | Live |
| 02 GPS · 03 F1 aerodynamics · 04 AI · 05 CT scanning · 06 Skyscraper · 07 Robotic arm · 08 Particle accelerator | | Planned |

Only live chapters appear in the navigation.

## Running it

Requires Node 22 (or 20.19+).

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck, lint, unit tests, production build
npm run test:e2e   # Playwright on desktop and mobile; builds and serves on :4173
```

The end-to-end tests run Chromium with SwiftShader, so they work without a GPU.

## Stack

React 19, TypeScript (strict), Vite, three.js with React Three Fiber, GSAP ScrollTrigger, Tailwind CSS 4. Vitest and Playwright for tests, oxlint for linting.

## How it fits together

```
src/
  sim/          The models: plain TypeScript, no React or three.js, unit-tested
    core/       Store, LiveChannel, RK4, Kepler solvers, number formatting, the Simulation contract
    rocket/     Atmosphere, vehicle, flight solver, orbital elements, outcome diagnosis
  scenes/       three.js scenes that draw a simulation (rocket/)
  chapters/     Narrative, controls and instruments for each chapter (rocket/)
  components/   Reusable pieces, listed below
  design/       Quantity colours: one colour per physical quantity, everywhere
  hooks/  lib/  app/ (shell: hero, navigation, chapter registry)
e2e/            Playwright tests
```

**Data flow.** A chapter owns one `Simulation` instance:

- `sim.params` is a `Store` of inputs. Controls write to it; React subscribes with `useStore`.
- `sim.live` is a `LiveChannel` of per-frame outputs. `LiveText`, `LiveMetric` and the `Live` equation term write straight to DOM nodes, and the scene reads `sim.live.value` inside `useFrame`. Nothing re-renders React per frame.

The rocket solves the whole flight (about 2 ms) whenever an input changes. Scroll position maps to mission time and each frame evaluates the stored trajectory at that time, so scrubbing backwards is exact and every view of the flight agrees.

**Scroll.** `ScrollStage` pins a full-screen stage with CSS `position: sticky` while the narrative steps scroll over it in normal document flow, so the text stays selectable and reachable by keyboard and screen readers. ScrollTrigger only measures progress. `chapters/rocket/timeline.ts` maps progress to story beats, camera shots and mission time.

**Performance.** Each chapter is its own lazily loaded chunk, and three.js is a separate chunk. A chapter's canvas mounts only near the viewport and stops rendering off screen. Pixel ratio adapts to the frame rate. Paths update their GPU buffers in place, and the exhaust smoke is a deterministic function of mission time, so scrubbing never accumulates state. GPU resources are disposed on unmount.

**Accessibility.** The narrative and the equations are real text. Sliders are native range inputs with visible labels, values and units. The flight lab's verdict is a polite live region. The flight profile can be scrubbed by keyboard. Colour never carries meaning alone: every arrow and line also has a symbol or a label. With reduced motion, the hero stays still and the camera cuts between shots instead of flying.

## Scientific approach

Every chapter works on three levels: intuition (the narrative), mathematics (equations with today's numbers substituted live), and engineering reality ("In the real world" notes, plus a closing section listing exactly what the model simplifies).

**The rocket model.** A point mass in two dimensions over a spherical, non-rotating Earth. Inverse-square gravity. Air density from a piecewise-exponential fit to the U.S. Standard Atmosphere 1976 (Vallado, table 8-4), with drag ½ρv²C<sub>D</sub>A. Constant exhaust velocity (3.4 km/s, I<sub>sp</sub> ≈ 347 s), throttled to hold 4 g. The flight is a vertical rise, a pitch-over and a gravity turn, then closed-loop guidance to a 200 km orbit, integrated with RK4 in 0.2 s steps while powered. The vehicle is a deliberately simple single stage (18 t dry, 400 t propellant, 6.2 MN) that reaches roughly a 197 × 203 km orbit with 7.6 t to spare. Real orbital launchers use two or three stages, and the page says so.

## Reusable components

| Piece | Where | What it does |
| --- | --- | --- |
| `Simulation`, `Store`, `LiveChannel` | `sim/core` | The contract every chapter's model implements, and its two data paths |
| `RK4`, Kepler solvers, `format*` | `sim/core` | Integrator, orbit timing, SI formatting with honest precision |
| `EquationBlock`, `Eq`, `V`, `Frac`, `Sqrt`, `Live`, … | `components/math` | Typeset equations whose terms can follow live values |
| `ScrollStage`, `NarrativeBlock` | `components/scroll` | Pinned stage with narrative steps; edge fades in and out |
| `SimulationCanvas` | `components/three` | Canvas with visibility-based rendering, adaptive resolution and a WebGL fallback |
| `ForceVector`, `TimelinePath`, `DynamicPath` | `components/three` | Force arrows; trajectories dimmed ahead of the playhead or inside a radius |
| `Annotation`, `AnnotationLayer`, `LabelRegistry` | `components/three` | DOM labels pinned to 3D points without per-frame React work |
| `EarthGlobe` and `earth/*` | `components/three` | Globe with land mask, graticule, day and night, atmosphere rim |
| `LiveMetric`, `LiveText`, `DataPanel`, `DataStrip` | `components/ui` | Instrument panels |
| `VariableControl`, `ToggleControl` | `components/ui` | Labelled sliders and switches bound to a parameter spec |
| `SimulationLegend`, `Term`, `ChapterTitle` | `components/ui` | Legend for scene encodings, inline definitions, chapter headers |
| `QUANTITY_COLORS` | `design/quantities` | Colour-blind-validated colours per quantity, synced with the CSS tokens |

## Adding a chapter

1. **Model** in `src/sim/<name>/`, implementing `Simulation<P, M>`. Keep it free of React and three.js, and test it against known values.
2. **Scene** in `src/scenes/<name>/`: R3F components that read `sim.live.value` in `useFrame` and dispose what they create.
3. **Chapter** in `src/chapters/<name>/`, default-exported: `ScrollStage` with `NarrativeBlock` steps, `EquationBlock`, `VariableControl` and `DataPanel`, and a `SimulationCanvas` mounted with `useNearViewport` and activated with `useInViewport`.
4. **Register** it: set `status: 'live'` in `src/app/chapters.ts` and add a `lazy()` import with a placeholder in `src/app/App.tsx`.
5. **Test** it end to end in `e2e/`.

## Tests

- **Unit (Vitest):** the Tsiolkovsky equation and analytic vertical ascent, Newton's second law against finite differences of the trajectory, energy and angular momentum conserved in orbit, atmosphere reference values and continuity, orbital elements and conic drawing, outcomes across gravity and guidance settings, scroll-timeline mapping, and colour-token sync.
- **End to end (Playwright, 1440 × 900 and Pixel 7):** no console errors, the scene mounts, scrolling drives mission time, thrust below weight keeps the rocket on the pad, the flight lab launches and its verdict changes with the physics, no horizontal overflow, and reduced motion.

## Known limitations

- The rocket model's simplifications are listed on the page: one stage, two dimensions, no Earth rotation (which gives real launches a free 0.4 km/s eastward), constant drag coefficient.
- @react-three/fiber triggers a "THREE.Clock: This module has been deprecated" console warning from inside the library. It is harmless.
- Rendering has been checked with software WebGL; performance on real GPUs and phones has not been profiled yet.

## Credits

Land outlines from [Natural Earth](https://www.naturalearthdata.com/) via world-atlas (public domain). Fonts: Archivo and STIX Two (SIL Open Font License). Atmosphere: U.S. Standard Atmosphere 1976, as tabulated in D. A. Vallado, *Fundamentals of Astrodynamics and Applications*, table 8-4.
