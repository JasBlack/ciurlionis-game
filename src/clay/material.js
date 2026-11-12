// What makes it clay rather than plastic. Nothing here is a picture: the fingerprints, the lumps a hand leaves,
// the colours worked into the body and the glow under blacklight are all worked out at each point of the surface
// from where that point was when the beast was made, so they stay put as it moves.
import * as THREE from 'three';

export const clay = {
  uBoil: { value: 0 }, // counts exposures: the surface is handled between each
  uBoilAmp: { value: 1 },
  uPrints: { value: 1 },
  uGlow: { value: 0 }, // 0 studio light, 1 blacklight
  uSeed: { value: 0 },
  uHue: { value: 0 },
  uLimb: { value: 0 },
};

const COMMON = /* glsl */ `
uniform float uBoil, uBoilAmp, uPrints, uGlow, uSeed, uHue, uLimb, uLump;

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 hash23(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yxz + 33.33); return fract((q.xxy + q.yzz) * q.zyx); }
float hash31(vec3 q) { q = fract(q * .1031); q += dot(q, q.zyx + 31.32); return fract((q.x + q.y) * q.z); }
vec3 hash33(vec3 q) { q = fract(q * vec3(.1031, .1030, .0973)); q += dot(q, q.yxz + 33.33); return fract((q.xxy + q.yxx) * q.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// the unevenness a hand leaves, and the part of it that changes each time the piece is touched again
float clayLump(vec3 p) {
  vec3 jig = hash33(vec3(uBoil, 1.7, 9.2)) * 6.0;
  float a = vnoise(p * 4.6 + uSeed) - .5;
  float b = vnoise(p * 12.0 + 31.7) - .5;
  float c = vnoise(p * 8.5 + jig + 77.) - .5;
  float dent = smoothstep(.58, .86, vnoise(p * 3.3 + 50. + uSeed)); // where a thumb pushed
  return (a * .04 + b * .012 - dent * .017 + c * .0075 * uBoilAmp) * uLump;
}
`;

const VERTEX_PARS = /* glsl */ `
attribute float aPiece;
attribute float aOpen;
varying vec3 vRest;
varying vec3 vRestN;
varying float vPiece;
varying float vOpen;
`;

const VERTEX_MAIN = /* glsl */ `
vRest = position; vRestN = normal; vPiece = aPiece; vOpen = aOpen;
transformed += normal * clayLump(position);
`;

const FRAGMENT_PARS = /* glsl */ `
varying vec3 vRest;
varying vec3 vRestN;
varying float vPiece;
varying float vOpen;

float fbm(vec3 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }

// distance (in cells) to the nearest of a scatter of points, right for anything nearer than half a cell
float nearest(vec3 p, out vec3 id) {
  vec3 g = floor(p - .5), f = p - g;
  float best = 9.;
  for (int k = 0; k <= 1; k++) for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++) {
    vec3 o = vec3(float(i), float(j), float(k));
    vec3 d = o + hash33(g + o) - f;
    float dd = dot(d, d);
    if (dd < best) { best = dd; id = g + o; }
  }
  return sqrt(best);
}

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 hueTurn(vec3 c, float a) {
  const vec3 k = vec3(.57735);
  float ca = cos(a), sa = sin(a);
  return max(c * ca + cross(k, c) * sa + k * dot(k, c) * (1. - ca), 0.);
}
vec3 neon(float i) {
  i = mod(floor(i + uSeed * 3.0), 6.);
  vec3 c = i < .5 ? vec3(.07, .22, 1.) : i < 1.5 ? vec3(1., .10, .10) : i < 2.5 ? vec3(.46, .17, 1.) : i < 3.5 ? vec3(1., .16, .60) : i < 4.5 ? vec3(.03, .70, 1.) : vec3(.12, .08, .72);
  return hueTurn(lin(c), uHue);
}
vec3 fringe(float i) {
  i = mod(floor(i + uSeed * 5.0), 4.);
  vec3 c = i < .5 ? vec3(1., .86, .06) : i < 1.5 ? vec3(1., .47, .04) : i < 2.5 ? vec3(.08, .93, .62) : vec3(1., .92, .25);
  return hueTurn(lin(c), uHue * .5);
}

// ---- the body's clay: bands of colour like marbled paper, each seam with a scalloped fringe, an inked line,
// stippling that thins away from it, a few islands and dashes
float strataField(vec3 p) {
  float wx = fbm(p * 1.1 + uSeed) - .5, wy = fbm(p * 1.1 + uSeed + 31.4) - .5;
  return p.y * 4.2 + wx * 4.6 + .5 * sin(p.x * 2.1 + wy * 6.) + uSeed * 9.;
}
vec3 strata(vec3 p, vec3 n, float px) {
  float s = strataField(p);
  vec3 t1 = normalize(cross(n, abs(n.y) < .9 ? vec3(0., 1., 0.) : vec3(1., 0., 0.))), t2 = cross(n, t1);
  const float E = .014;
  float rate = max(length(vec2(strataField(p + t1 * E) - s, strataField(p + t2 * E) - s)) / E, 1.2);
  float wz = fbm(p * 2.3 + uSeed + 71.9) - .5;
  float aa = px * 1.1;
  float seam = floor(s + .5);
  float d = abs(s - seam) / rate; // distance to the nearest seam, in the beast's own units
  float fill = floor(s);
  float along = p.x * 52. + p.z * 37. + wz * 60.;
  float half_ = .024 + .022 * hash11(seam + 3.) + .012 * abs(sin(along));
  vec3 ink = hueTurn(vec3(.012, .008, .11), uHue);
  vec3 cFill = neon(fill + 11.);
  vec3 col = cFill;

  // stipple, thick by the seam and gone a little way off
  vec3 id;
  float dot_ = nearest(p * 44., id);
  float thin = 1. - smoothstep(0., .13 + .1 * hash11(fill), d - half_);
  float size = (.14 + .3 * hash31(id)) * thin;
  vec3 cDot = hash11(fill + 7.) < .5 ? mix(cFill, ink, .82) : mix(cFill, vec3(1.), .55);
  col = mix(col, cDot, (1. - smoothstep(size - aa * 44., size + aa * 44., dot_)) * smoothstep(.02, .1, thin));

  // short pale dashes scattered in the open colour
  vec3 id2;
  float dash = nearest(p * vec3(13., 40., 40.) + wz * 6., id2);
  col = mix(col, mix(cFill, vec3(1.), .8), (1. - smoothstep(.1, .16, dash)) * step(.84, hash31(id2 + 2.)) * (1. - thin));

  // islands of another clay, ringed
  float isl = fbm(p * 2.3 + uSeed + 5.) - .645;
  vec3 cIsl = neon(fill + 2.);
  col = mix(col, cIsl, smoothstep(-.004, .004, isl));
  col = mix(col, mix(cIsl, vec3(1.), .7), smoothstep(.045, .055, isl));
  col = mix(col, ink, (1. - smoothstep(.006, .012, abs(isl))) * .9);

  // the fringe on the seam and its inked edge
  vec3 cFr = fringe(seam);
  float inF = 1. - smoothstep(half_ - aa, half_ + aa, d);
  vec3 idf;
  float fd = nearest(p * 30. + 9., idf);
  vec3 fr = mix(cFr, ink, (1. - smoothstep(.12, .2, fd)) * step(.45, hash31(idf)));
  col = mix(col, fr, inF);
  col = mix(col, ink, 1. - smoothstep(.0045 - aa * .5, .0045 + aa, abs(d - half_)));
  return col;
}

// ---- night-sky clay: near black, clouded with teal, green and violet, pricked with stars
vec3 nightSky(vec3 p, out vec3 glow) {
  float n1 = fbm(p * 1.7 + uSeed + 3.), n2 = fbm(p * 2.9 + 40. + uSeed);
  vec3 c = mix(vec3(.010, .013, .045), vec3(.008, .085, .095), smoothstep(.35, .75, n1));
  c = mix(c, vec3(.015, .19, .075), smoothstep(.52, .8, n2) * .8);
  c = mix(c, vec3(.13, .04, .24), smoothstep(.55, .85, fbm(p * 2.2 + 90.)) * .6);
  vec3 id;
  float d = nearest(p * 24., id);
  float rs = hash31(id + 7.);
  float star = (1. - smoothstep(.02, .05 + .2 * rs * rs, d)) * step(.5, hash31(id));
  vec3 sc = rs < .6 ? vec3(1., .97, .88) : rs < .8 ? vec3(1., .16, .12) : vec3(.15, 1., .4);
  c = mix(c, sc, star);
  glow = sc * star * 1.8 + c * 1.1;
  return c;
}

// ---- marbled clay: several pastels folded together and not mixed through
vec3 marbled(vec3 p) {
  vec3 w = vec3(fbm(p * 1.5 + uSeed), fbm(p * 1.5 + 9.1 + uSeed), fbm(p * 1.5 + 23.7 + uSeed)) - .5;
  vec3 q = p + w * 1.1;
  float t = fbm(q * 2.4) * 3.2 + q.y * .7;
  vec3 c = .5 + .5 * cos(6.2832 * (t * .7 + vec3(0., .33, .67)) + uHue * 6.2832);
  c = mix(c, vec3(.78, .74, .9), .62); // pastels: the colours were worked into a lot of white
  float vein = smoothstep(.43, .5, abs(fract(t * 2.) - .5));
  return mix(c, c * vec3(.45, .38, .7), vein * .5);
}

// ---- white clay, never quite clean
vec3 whiteClay(vec3 p, float piece) {
  vec3 c = vec3(.80, .795, .78) * (.95 + .08 * hash11(piece * 17.3));
  c = mix(c, vec3(.74, .76, .82), .3 * vnoise(p * 2.7 + 5.));
  float smear = smoothstep(.6, .85, fbm(p * 6. + 11. + piece));
  c = mix(c, neon(floor(hash11(piece * 3.1) * 6.)), smear * .07);
  vec3 id;
  float sp = nearest(p * 90., id);
  c = mix(c, neon(floor(hash31(id) * 6.)) * .6, (1. - smoothstep(.05, .12, sp)) * step(.9, hash31(id + 4.)) * .5);
  return c;
}

struct ClayLook { vec3 albedo; vec3 glow; float rough; float pearl; vec3 under; };

ClayLook clayLook(float px) {
  ClayLook L;
#ifdef CLAY_WHITE
  L.albedo = whiteClay(vRest, vPiece);
  L.rough = .74;
  L.pearl = 0.;
  L.under = vec3(1., .78, .66);
  // under blacklight white fluoresces a cold blue, and beads of light sit in it here and there
  vec3 id;
  float d = nearest(vRest * 7. + 3.3 + uSeed, id);
  float on = step(.6, hash31(id + 1.7));
  vec3 bc = neon(floor(hash31(id + 9.) * 6.));
  L.glow = L.albedo * vec3(.07, .06, .26) + on * (bc * (1. - smoothstep(.05, .19, d)) * 1.6 + vec3(1.) * (1. - smoothstep(0., .08, d)) * 2.2);
#else
  vec3 body = strata(vRest, normalize(vRestN), px);
  float limb = uLimb < .5 ? 0. : smoothstep(.42, .58, vPiece + (fbm(vRest * 3.1 + uSeed) - .5) * .5);
  L.albedo = body; L.glow = body * .85; L.rough = .5; L.pearl = 0.; L.under = body * 1.4 + .1;
  if (limb > 0.) {
    vec3 g = vec3(0.), other;
    float rough = .6, pearl = 0.;
    if (uLimb > 1.5) { other = marbled(vRest); g = other * vec3(.10, .08, .22); rough = .38; pearl = 1.; }
    else other = nightSky(vRest, g);
    L.albedo = mix(body, other, limb); L.glow = mix(L.glow, g, limb); L.rough = mix(L.rough, rough, limb); L.pearl = pearl * limb;
    L.under = mix(L.under, other + .08, limb);
  }
#endif
  return L;
}

// ---- fingerprints: one sheet of them laid on a plane. xy the slope of the ridges, z how far down in a groove, w how much print
const float PRINT_CELLS = 5.6;   // fingertips to a unit
const float PRINT_RIDGES = 13.;  // ridges across one
vec4 printSheet(vec2 uv, float sheet) {
  vec2 q = uv * PRINT_CELLS;
  vec2 g = floor(q), f = fract(q);
  float top = -1., all = 0.;
  vec4 res = vec4(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 cell = g + o + sheet * 37.;
    vec3 r = hash23(cell);
    // a third of them are pressed afresh every so many exposures
    float again = r.z < .34 ? floor((uBoil * uBoilAmp + r.x * 8.) / 8.) : 0.;
    vec3 r2 = hash23(cell + 19.19 + again * 3.7);
    vec2 c = o + .5 + (r2.xy - .5) * .9;
    float ang = r2.z * 6.2832;
    vec2 e = vec2(cos(ang), sin(ang));
    vec2 d = f - c;
    vec2 dl = vec2(dot(d, e), dot(d, vec2(-e.y, e.x)));
    float foot = 1. - length(dl * vec2(1.7, 1.25));
    float had = r.x > .42 ? smoothstep(0., .4, foot) * (.5 + .5 * r2.x) : 0.;
    all += had;
    if (had > 0. && r.y > top) {
      top = r.y;
      vec2 dv = dl - vec2((r.x - .5) * 1.4, -.7 - r.y * 1.3); // the ridges arc round a point below the fingertip
      float rad = length(dv);
      float ph = rad * PRINT_RIDGES * 6.2832;
      float edge = had;
      vec2 gl = (.5 * sin(ph) * PRINT_RIDGES * 6.2832 * edge / rad) * dv;
      res.xyz = vec3((e * gl.x + vec2(-e.y, e.x) * gl.y) * PRINT_CELLS, (.5 + .5 * cos(ph)) * edge);
    }
  }
  res.w = min(all, 1.2);
  return res;
}

// the surface as light meets it: lumps, pressed prints and a fine grain, tilting the normal
vec3 clayNormal(vec3 N, float px, out float groove) {
  vec3 P = -vViewPosition;
  vec3 sx = dFdx(P), sy = dFdy(P);
  vec3 rx = dFdx(vRest), ry = dFdy(vRest);

  vec3 n = normalize(vRestN);
  vec3 w = pow(abs(n), vec3(5.));
  w = max(w / (w.x + w.y + w.z) - .07, 0.); // a sheet fades out before it is dropped, so nothing jumps
  w /= w.x + w.y + w.z;
  vec3 p = vRest + vPiece * 1.37;
  vec3 slope = vec3(0.);
  groove = 0.;
  float much = 0.;
  if (w.x > 0.) { vec4 s = printSheet(p.yz, 1.); slope += w.x * vec3(0., s.xy); groove += w.x * s.z; much += w.x * s.w; }
  if (w.y > 0.) { vec4 s = printSheet(p.zx, 2.); slope += w.y * vec3(s.y, 0., s.x); groove += w.y * s.z; much += w.y * s.w; }
  if (w.z > 0.) { vec4 s = printSheet(p.xy, 3.); slope += w.z * vec3(s.xy, 0.); groove += w.z * s.z; much += w.z * s.w; }
  // ridges finer than the screen can show are let go rather than left to shimmer
  float fine = px * PRINT_CELLS * PRINT_RIDGES;
  float keep = (1. - smoothstep(.2, .5, fine)) * uPrints;
  slope *= PRINT_HEIGHT * keep;
  groove *= keep;

  // where a fingertip pressed, a shallow dish; everywhere, the lumps the points were moved by
  float h = clayLump(vRest) - much * .0035 * uPrints;
  h += (vnoise(vRest * 150.) - .5) * .0007 * (1. - smoothstep(.15, .45, px * 150.));
  vec2 dH = vec2(dFdx(h), dFdy(h)) + vec2(dot(slope, rx), dot(slope, ry));

  vec3 r1 = cross(sy, N), r2 = cross(N, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * N - grad);
}
`;

function claySurface(material, { white, lump, prints }) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, clay, { uLump: { value: lump } });
    const defs = `${white ? '#define CLAY_WHITE\n' : ''}#define PRINT_HEIGHT ${prints.toFixed(5)}\n`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${defs}${COMMON}\n${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        float clayPx = max(length(fwidth(vRest)) * .7, 1e-5);
        ClayLook look = clayLook(clayPx);
        diffuseColor.rgb = look.albedo;`)
      .replace('#include <roughnessmap_fragment>', /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = look.rough;`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        float clayGroove;
        normal = clayNormal(normal, clayPx, clayGroove);
        diffuseColor.rgb *= 1. - .22 * clayGroove;
        roughnessFactor = min(1., roughnessFactor + .12 * clayGroove);`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += look.glow * uGlow * mix(.55, 1., vOpen);`)
      .replace('#include <lights_physical_fragment>', /* glsl */ `#include <lights_physical_fragment>
        #ifdef USE_IRIDESCENCE
          material.iridescence *= look.pearl;
        #endif`)
      .replace('#include <lights_fragment_end>', /* glsl */ `#include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
        {
          // clay lets a little light through: the edge of the shadow is soft and takes the clay's own colour
          float ndl = dot(normal, directionalLights[0].direction);
          float wrap = clamp((ndl + .6) / 1.6, 0., 1.);
          float extra = max(0., wrap * wrap - max(ndl, 0.)) * 1.5;
          reflectedLight.directDiffuse += extra * directionalLights[0].color * material.diffuseColor * look.under * RECIPROCAL_PI;
        }
        #endif`)
      .replace('#include <aomap_fragment>', /* glsl */ `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= vOpen;
        reflectedLight.indirectSpecular *= vOpen;
        reflectedLight.directDiffuse *= mix(1., vOpen, .5);
        reflectedLight.directSpecular *= mix(1., vOpen, .7);
        #ifdef USE_SHEEN
          sheenSpecularIndirect *= vOpen;
        #endif`);
  };
  material.customProgramCacheKey = () => `clay-${white ? 'white' : 'body'}`;
  return material;
}

export function whiteClay() {
  return claySurface(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.74, metalness: 0, sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.9, 0.9, 1.0), specularIntensity: 0.5,
  }), { white: true, lump: 0.5, prints: 0.00095 });
}

export function bodyClay() {
  return claySurface(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.5, metalness: 0, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 1, 1), specularIntensity: 0.6,
    iridescence: 0.55, iridescenceIOR: 1.3, iridescenceThicknessRange: [240, 420],
  }), { white: false, lump: 1.25, prints: 0.00085 });
}

// The table: black card that takes a soft pool of light and loses itself in the dark.
export function tableCard() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.9, metalness: 0, envMapIntensity: 0.25 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCard;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCard = (modelMatrix * vec4(position, 1.)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCard;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb *= 1. - smoothstep(2.2, 8.5, length(vCard));');
  };
  return m;
}
