/**
 * Land/ocean mask of the Earth, rasterised at runtime from Natural Earth's
 * 1:110m land polygons (public domain, via the world-atlas package). The mask
 * is equirectangular: x = longitude, y = latitude.
 */
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import land from 'world-atlas/land-110m.json'
import { CanvasTexture, LinearFilter, type Texture } from 'three'

let cached: CanvasTexture | null = null

/** Draws land in white on black, longitude −180…180 left to right, latitude 90…−90 top to bottom. */
export function drawLandMask(width: number): HTMLCanvasElement {
  const height = width / 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const topology = land as unknown as Topology<{ land: GeometryCollection }>
  const geo = feature(topology, topology.objects.land)
  const x = (lon: number) => ((lon + 180) / 360) * width
  const y = (lat: number) => ((90 - lat) / 180) * height

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  for (const f of geo.features) {
    const g = f.geometry
    const polygons = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : []
    for (const polygon of polygons) {
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(x(lon), y(lat)) : ctx.lineTo(x(lon), y(lat))))
        ctx.closePath()
      }
    }
  }
  ctx.fill('evenodd')
  return canvas
}

/** Shared land-mask texture (created on first use). */
export function getLandMaskTexture(): Texture {
  if (!cached) {
    cached = new CanvasTexture(drawLandMask(2048))
    // No mipmaps: the longitude wrap would otherwise pick the smallest mip and draw a seam.
    cached.generateMipmaps = false
    cached.minFilter = LinearFilter
    cached.magFilter = LinearFilter
  }
  return cached
}
