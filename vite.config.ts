import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle the heavy 3D dependencies at startup so the dev server never
  // re-optimises them in the middle of a lazy chapter load.
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', 'gsap', 'gsap/ScrollTrigger', '@gsap/react', 'topojson-client'],
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        // The 3D stack is shared by every chapter: give it its own chunk so it
        // is downloaded once and cached, while each chapter's code stays small.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|@react-three)[\\/]/, priority: 2 },
            { name: 'geo', test: /node_modules[\\/](world-atlas|topojson-client)[\\/]/, priority: 1 },
          ],
        },
      },
    },
    // three.js alone is ~700 kB minified (~180 kB gzipped); it loads lazily after the hero.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
