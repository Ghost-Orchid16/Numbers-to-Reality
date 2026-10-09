/**
 * LineMaterial (screen-space fat lines) extended for scientific paths:
 *
 * - `timeline`: each vertex carries a time. Segments after `uPlayhead` are
 *   drawn dim and dashed, so one static buffer shows both the path already
 *   flown and the path still to come.
 * - `radial`: segments closer to the origin than `uInnerRadius` are dimmed —
 *   used to show the part of a predicted orbit that runs inside the planet.
 */
import { Color } from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

export type PathLineMode = 'timeline' | 'radial'

export interface PathLineOptions {
  color: string | Color
  /** Width in CSS pixels. */
  width: number
  mode: PathLineMode
  opacity?: number
  /** Opacity multiplier for the de-emphasised part (future / inside). */
  dimOpacity?: number
  /** Dash the de-emphasised part. */
  dashDim?: boolean
}

export class PathLineMaterial extends LineMaterial {
  readonly pathUniforms = {
    uPlayhead: { value: 0 },
    uInnerRadius: { value: 0 },
    uDimOpacity: { value: 0.3 },
    /** Dash period in world units. */
    uDashPeriod: { value: 1000 },
  }

  constructor({ color, width, mode, opacity = 1, dimOpacity = 0.3, dashDim = true }: PathLineOptions) {
    super({ color: new Color(color).getHex(), linewidth: width, worldUnits: false, transparent: true, depthWrite: false, opacity })
    this.pathUniforms.uDimOpacity.value = dimOpacity
    const timeline = mode === 'timeline'

    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.pathUniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          /* glsl */ `
          attribute float instanceTimeStart;
          attribute float instanceTimeEnd;
          attribute float instanceDistanceStart;
          attribute float instanceDistanceEnd;
          varying float vPathTime;
          varying float vPathDistance;
          varying float vPathRadius;
          void main() {
            bool isStart = position.y < 0.5;
            vPathTime = isStart ? instanceTimeStart : instanceTimeEnd;
            vPathDistance = isStart ? instanceDistanceStart : instanceDistanceEnd;
            vPathRadius = length(isStart ? instanceStart : instanceEnd);
          `,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          /* glsl */ `
          uniform float uPlayhead;
          uniform float uInnerRadius;
          uniform float uDimOpacity;
          uniform float uDashPeriod;
          varying float vPathTime;
          varying float vPathDistance;
          varying float vPathRadius;
          void main() {
          `,
        )
        .replace(
          'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
          /* glsl */ `
          bool dim = ${timeline ? 'vPathTime > uPlayhead' : 'vPathRadius < uInnerRadius'};
          if (dim) {
            ${dashDim ? 'if (fract(vPathDistance / uDashPeriod) > 0.55) discard;' : ''}
            alpha *= uDimOpacity;
          }
          gl_FragColor = vec4( diffuseColor.rgb, alpha );
          `,
        )
    }
    this.customProgramCacheKey = () => `path-line-${mode}-${dashDim}`
  }
}
