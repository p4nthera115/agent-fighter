import Phaser from 'phaser';

/**
 * The glass geometry.
 *
 * A real tube is a section of a sphere pressed into a rectangle, so its
 * corners bow outwards while the middle of each edge stays put. That is the
 * whole of the distortion here: `x' = x(1 + cx*y^2)`, `y' = y(1 + cy*x^2)`,
 * in coordinates running -1..1 from the centre of the screen.
 *
 * Leaving the edge midpoints alone is deliberate. The HUD lives along the top
 * edge, and a bulge that moved the middle of it would push the timer and the
 * health bars off the picture; only the corners, which hold nothing, bend.
 *
 * The constants are the fraction of half a screen that a corner is pulled by.
 * Both work out at about five art pixels, so the curve reads as the same
 * amount of glass in each direction rather than the same amount of maths.
 */
const CURVE_X = 0.021;
const CURVE_Y = 0.037;

const FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uCurve;
uniform vec2 uTexel;
uniform float uSharp;

varying vec2 outTexCoord;

/**
 * Samples the frame between texels without softening the artwork.
 *
 * The bend is a fraction of an art pixel, so reading the nearest texel would
 * step the edge of the picture a whole pixel at a time and the curve would
 * read as a staircase. This blends towards the neighbour instead, but only
 * across the width of one *screen* pixel: everywhere the two grids line up,
 * which is the whole middle of the picture, it lands exactly on a texel and
 * the art stays as sharp as the nearest-neighbour upscale around it.
 */
vec4 sampleFrame (vec2 uv)
{
  vec2 grid = uv / uTexel - 0.5;
  vec2 corner = floor(grid);
  vec2 f = clamp((grid - corner - 0.5) * uSharp + 0.5, 0.0, 1.0);
  vec2 base = (corner + 0.5) * uTexel;

  vec4 tl = texture2D(uMainSampler, base);
  vec4 tr = texture2D(uMainSampler, base + vec2(uTexel.x, 0.0));
  vec4 bl = texture2D(uMainSampler, base + vec2(0.0, uTexel.y));
  vec4 br = texture2D(uMainSampler, base + uTexel);

  return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
}

void main ()
{
  vec2 centred = outTexCoord * 2.0 - 1.0;
  vec2 bowed = centred * (1.0 + uCurve * centred.yx * centred.yx);
  vec2 uv = bowed * 0.5 + 0.5;

  // Past the rim there is no picture, only the inside of the tube. The edge
  // is faded over one screen pixel so the rim curves rather than steps.
  vec2 rim = min(uv, 1.0 - uv) / uTexel * uSharp;
  float lit = clamp(min(rim.x, rim.y), 0.0, 1.0);

  gl_FragColor = vec4(sampleFrame(clamp(uv, vec2(0.0), vec2(1.0))).rgb * lit, 1.0);
}
`;

/** Key the pipeline is registered under in the game config. */
export const TUBE_WARP = 'TubeWarp';

export class TubeWarpPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: TUBE_WARP, fragShader: FRAG });
  }

  override onPreRender(): void {
    this.set2f('uCurve', CURVE_X, CURVE_Y);
    this.set2f('uTexel', 1 / this.renderer.width, 1 / this.renderer.height);
    // How many screen pixels one art pixel covers, which is how wide the
    // blend between two art pixels is allowed to be.
    this.set1f('uSharp', Math.max(1, this.game.scale.zoom));
  }
}

/**
 * Bends one camera's output, or puts it back flat.
 *
 * Canvas has no pipelines, so there the picture simply stays flat: the same
 * degradation the rest of the CRT layers make, since those are CSS over the
 * top of the canvas rather than anything the renderer knows about.
 */
export function warpCamera(camera: Phaser.Cameras.Scene2D.Camera, on: boolean): void {
  if (camera.scene.game.renderer.type !== Phaser.WEBGL) return;
  camera.resetPostPipeline();
  if (on) camera.setPostPipeline(TUBE_WARP);
}
