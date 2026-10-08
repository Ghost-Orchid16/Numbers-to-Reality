import { Color } from 'three'
import { getLandMaskTexture } from './landMask'

/**
 * GLSL shared by the globe and anything that colours the planet surface:
 * land/ocean from the mask, a 15° graticule and day/night from the sun.
 * `geoNormal` is a unit vector in the geo frame (see geo.ts).
 */
export const PLANET_SURFACE_GLSL = /* glsl */ `
  uniform sampler2D uLand;
  uniform vec3 uOcean;
  uniform vec3 uLandColor;
  uniform vec3 uGraticule;
  uniform float uGraticuleStrength;

  vec3 planetSurface(vec3 geoNormal) {
    float lat = asin(clamp(geoNormal.y, -1.0, 1.0));
    float lon = atan(-geoNormal.z, geoNormal.x);
    vec2 uv = vec2(lon / 6.28318530718 + 0.5, lat / 3.14159265359 + 0.5);
    float land = texture2D(uLand, uv).r;
    vec3 base = mix(uOcean, uLandColor, land);

    // Graticule every 15°. The pixel footprint comes from the normal's
    // derivative, which (unlike longitude) has no seam at ±180°.
    float degPerPixel = length(fwidth(geoNormal)) * 57.2957795;
    vec2 deg = vec2(degrees(lon), degrees(lat)) / 15.0;
    vec2 dist = abs(fract(deg - 0.5) - 0.5) * 15.0 / max(degPerPixel, 1e-4);
    float line = 1.0 - smoothstep(0.2, 1.0, min(dist.x, dist.y));
    return mix(base, uGraticule, line * uGraticuleStrength);
  }
`

/** Surface colours in sRGB; three converts them to linear for the shaders. */
export const PLANET_COLORS = {
  ocean: new Color('#071628'),
  land: new Color('#26332f'),
  graticule: new Color('#2d4566'),
}

export function createPlanetSurfaceUniforms() {
  return {
    uLand: { value: getLandMaskTexture() },
    uOcean: { value: PLANET_COLORS.ocean },
    uLandColor: { value: PLANET_COLORS.land },
    uGraticule: { value: PLANET_COLORS.graticule },
    uGraticuleStrength: { value: 0.09 },
  }
}

