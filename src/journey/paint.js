// The palette of the journey, shared by everything painted in it. Čiurlionis worked in tempera and pastel on
// card: pale, chalky harmonies, blue and violet in every shade, colour rather than light doing the work. Each
// painting the way passes through (a zone) has four mixes of its own; the striped hills have eight.
// Needs COMMON before it.

// per zone, four kinds: [light, half-tone, shade]
const ZONES = [
  // 0 the shore: gold, olive, orange, sage
  [[0.95, 0.80, 0.40], [0.80, 0.62, 0.28], [0.30, 0.36, 0.44]], [[0.66, 0.72, 0.36], [0.46, 0.56, 0.30], [0.16, 0.30, 0.36]],
  [[0.94, 0.60, 0.30], [0.80, 0.44, 0.24], [0.36, 0.24, 0.36]], [[0.70, 0.78, 0.60], [0.50, 0.62, 0.50], [0.20, 0.32, 0.42]],
  // 1 the hills (their bands are HILLS below; these are only the underpainting's)
  [[0.95, 0.78, 0.40], [0.84, 0.64, 0.30], [0.40, 0.36, 0.40]], [[0.62, 0.72, 0.52], [0.44, 0.58, 0.44], [0.16, 0.30, 0.38]],
  [[0.95, 0.58, 0.28], [0.84, 0.44, 0.22], [0.42, 0.24, 0.34]], [[0.72, 0.68, 0.86], [0.56, 0.52, 0.76], [0.24, 0.22, 0.50]],
  // 2 the willow meadow: yellow green, grass, ochre, rust
  [[0.76, 0.84, 0.40], [0.58, 0.70, 0.30], [0.20, 0.36, 0.30]], [[0.52, 0.72, 0.34], [0.38, 0.58, 0.28], [0.12, 0.30, 0.28]],
  [[0.86, 0.72, 0.38], [0.70, 0.56, 0.28], [0.30, 0.28, 0.30]], [[0.66, 0.44, 0.24], [0.52, 0.34, 0.20], [0.24, 0.18, 0.24]],
  // 3 the round wood: warm ground, green, blue green, sandstone
  [[0.90, 0.76, 0.46], [0.76, 0.60, 0.36], [0.34, 0.30, 0.40]], [[0.50, 0.64, 0.38], [0.34, 0.50, 0.32], [0.12, 0.26, 0.30]],
  [[0.36, 0.54, 0.50], [0.24, 0.42, 0.42], [0.08, 0.20, 0.32]], [[0.95, 0.78, 0.58], [0.84, 0.64, 0.47], [0.50, 0.38, 0.45]],
  // 4 the sunset hills: deep blue, teal, violet, the gold of the slope that faces the sun
  [[0.16, 0.34, 0.62], [0.09, 0.20, 0.48], [0.04, 0.08, 0.30]], [[0.30, 0.54, 0.46], [0.14, 0.36, 0.40], [0.05, 0.14, 0.30]],
  [[0.30, 0.26, 0.62], [0.18, 0.14, 0.48], [0.08, 0.06, 0.28]], [[0.78, 0.74, 0.28], [0.44, 0.54, 0.30], [0.08, 0.18, 0.32]],
  // 5 the night garden: green, yellow green, red earth, cream sand
  [[0.44, 0.68, 0.40], [0.28, 0.52, 0.34], [0.08, 0.24, 0.30]], [[0.76, 0.80, 0.36], [0.56, 0.64, 0.28], [0.18, 0.30, 0.28]],
  [[0.78, 0.40, 0.26], [0.62, 0.28, 0.20], [0.28, 0.12, 0.22]], [[0.95, 0.89, 0.73], [0.87, 0.79, 0.63], [0.52, 0.48, 0.56]],
  // 6 the pond's bank: sand, green, dark green, ochre
  [[0.90, 0.82, 0.60], [0.78, 0.68, 0.48], [0.38, 0.34, 0.40]], [[0.44, 0.64, 0.30], [0.30, 0.50, 0.26], [0.10, 0.26, 0.24]],
  [[0.24, 0.44, 0.28], [0.14, 0.32, 0.24], [0.05, 0.16, 0.20]], [[0.86, 0.70, 0.34], [0.70, 0.54, 0.26], [0.30, 0.26, 0.28]],
  // 7 the mountain: purple, grey lilac, brown violet, pale cream
  [[0.60, 0.52, 0.66], [0.42, 0.35, 0.50], [0.20, 0.16, 0.30]], [[0.72, 0.66, 0.72], [0.52, 0.46, 0.56], [0.26, 0.22, 0.34]],
  [[0.56, 0.44, 0.46], [0.40, 0.30, 0.36], [0.18, 0.13, 0.22]], [[0.84, 0.76, 0.72], [0.62, 0.54, 0.56], [0.30, 0.26, 0.36]],
  // 8 the summit: orange red, peach, red, and the dark of its cracks
  [[0.95, 0.60, 0.44], [0.86, 0.46, 0.34], [0.52, 0.26, 0.28]], [[0.97, 0.72, 0.56], [0.88, 0.58, 0.44], [0.54, 0.32, 0.34]],
  [[0.88, 0.44, 0.32], [0.74, 0.34, 0.26], [0.42, 0.18, 0.24]], [[0.42, 0.20, 0.22], [0.34, 0.16, 0.20], [0.20, 0.10, 0.16]],
];
// the bands of the striped hills: orange, ochre, sage, cobalt, lavender, rust, cream, teal
const HILLS = [
  [[0.95, 0.58, 0.28], [0.84, 0.44, 0.22], [0.42, 0.24, 0.34]], [[0.95, 0.78, 0.40], [0.84, 0.64, 0.30], [0.40, 0.36, 0.40]],
  [[0.62, 0.72, 0.52], [0.44, 0.58, 0.44], [0.16, 0.30, 0.38]], [[0.40, 0.54, 0.80], [0.26, 0.40, 0.70], [0.10, 0.18, 0.46]],
  [[0.72, 0.68, 0.86], [0.56, 0.52, 0.76], [0.24, 0.22, 0.50]], [[0.86, 0.40, 0.26], [0.72, 0.30, 0.22], [0.34, 0.16, 0.28]],
  [[0.95, 0.84, 0.72], [0.84, 0.70, 0.60], [0.42, 0.36, 0.46]], [[0.36, 0.62, 0.62], [0.24, 0.48, 0.52], [0.08, 0.24, 0.38]],
];

const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;
/** A GLSL array of colours: column k (0 light, 1 half-tone, 2 shade) of a list of palettes. */
export const glArr = (name, list, k) => `const vec3 ${name}[${list.length}] = vec3[${list.length}](${list.map((p) => v3(p[k])).join(', ')});`;

export const JOURNEY = /* glsl */ `
uniform float uSea;        // how high the sea stands
uniform vec4 uBird;        // the great bird's shadow: where (x, z), its heading, how dark
uniform vec3 uSkyHigh; uniform vec3 uSkyLow; uniform vec3 uSkyA; uniform vec3 uSkyB;
uniform vec3 uSunsetDir;   // where the red sun stands on the horizon
uniform vec4 uAir;         // x: the sunset's glow and rays, y: night (stars, moon), z: fair-weather cloud, w: storm
uniform vec3 uWaterDeep;
uniform float uMirror;     // how much of the sky the water gives back
uniform vec3 uTint;        // the hour's colour on things that travel through it (him)
${glArr('Z_L', ZONES, 0)}
${glArr('Z_M', ZONES, 1)}
${glArr('Z_S', ZONES, 2)}
${glArr('H_L', HILLS, 0)}
${glArr('H_M', HILLS, 1)}
${glArr('H_S', HILLS, 2)}

// The sky: pale at the horizon, deeper above, with level streaks of two tints lying across it as he painted them.
vec3 skyColour(vec3 v) {
  float up = clamp(v.y, 0.0, 1.0);
  vec3 c = mix(uSkyLow, uSkyHigh, pow(up, 0.6));
  float az = atan(v.x, -v.z);
  float n = texture(tNoise, vec2(az * 0.33, v.y * 2.3 + 0.1)).r;
  float n2 = texture(tNoise, vec2(az * 0.8 + 0.3, v.y * 5.5)).g;
  c = mix(c, uSkyA, smoothstep(0.45, 0.72, n) * 0.8 * (1.0 - up * 0.7));
  c = mix(c, uSkyB, smoothstep(0.5, 0.78, n2) * 0.6 * (1.0 - up * 0.5));
  float s = max(dot(v, uSunsetDir), 0.0);
  c = mix(c, vec3(1.0, 0.74, 0.16), uAir.x * pow(s, 2.6) * 0.85);
  c = mix(c, vec3(1.0, 0.52, 0.1), uAir.x * pow(s, 9.0) * 0.6);
  return mix(c, uHaze, smoothstep(0.0, -0.1, v.y));
}

// The great bird's shadow as it lies on the ground: body, swept wings, the fan of the tail.
float birdShade(vec2 xz) {
  if (uBird.w <= 0.0) return 0.0;
  vec2 p = xz - uBird.xy;
  if (dot(p, p) > 400.0) return 0.0;
  float sa = sin(uBird.z), ca = cos(uBird.z);
  float along = p.x * sa + p.y * ca, across = abs(p.x * ca - p.y * sa);
  float body = step(length(vec2(across / 1.5, along / 5.5)), 1.0);
  float chord = mix(3.0, 0.6, clamp(across / 12.0, 0.0, 1.0));
  float wing = step(across, 12.0) * step(abs(along - (0.8 - 0.24 * across)), chord);
  float tail = step(-9.5, along) * step(along, -4.0) * step(across, 0.7 + (-4.0 - along) * 0.6);
  return uBird.w * max(body, max(wing, tail));
}
// How lit a spot is, for paint3: the still world's shade, the turn of the ground from the sun, the bird overhead.
float lightOn(vec3 P, vec3 Nn) {
  // (colour does the work here, not light: only ground well turned from the sun, or in cast shade, goes dark)
  float l = mix(0.3, 1.0, woodSunAt(P + Nn * 0.5 + vec3(0.0, 0.25, 0.0))) * clamp(dot(Nn, uSunDir) * 0.9 + 0.62, 0.0, 1.0);
  return l * (1.0 - 0.92 * birdShade(P.xz));
}

// Which painting a spot of ground belongs to. Between two, each stroke takes one or the other.
int zoneAt(vec4 m, float jit) {
  if (m.a + (jit - 0.5) * 0.1 > 0.75) return 8;
  if (m.a + (jit - 0.5) * 0.25 > 0.25) return 7;
  return int(clamp(floor(m.g * 8.0 + 0.5 + (jit - 0.5) * 0.9), 0.0, 6.0));
}
vec3 zc(int z, int k, float lit, float r) { int i = z * 4 + k; return paint3(Z_L[i], Z_M[i], Z_S[i], lit, r); }
vec3 hc(int k, float lit, float r) { return paint3(H_L[k], H_M[k], H_S[k], lit, r); }

struct Paint { vec3 c1; vec3 c2; vec3 dir; float len; int zone; float jit; };
// A stroke of the ground at P: its two colours, the way it runs and how long it is for its width.
Paint groundPaint(vec3 P, vec3 Nn, vec4 m, float lit, vec4 r, vec4 q) {
  Paint g;
  vec2 xz = P.xz;
  int zone = zoneAt(m, r.w);
  g.zone = zone;
  vec3 contour = normalize(cross(Nn, vec3(0.0, 1.0, 0.0)) + vec3(1e-3, 0.0, 0.0));
  vec3 down = cross(contour, Nn);
  float patch_ = texture(tNoise, xz / 17.0).r * 1.9 + texture(tNoise, xz / 4.3).g * 0.5;
  int kind = int(4.0 * fract(patch_ + (q.z - 0.5) * 0.3));
  int other = int(4.0 * fract(patch_ + 0.27 + (q.w - 0.5) * 0.5));
  float a = (texture(tNoise, xz / 9.3).a * 1.2 + q.y * 0.5) * TAU;
  g.dir = vec3(cos(a), 0.0, sin(a));
  g.len = 1.0;
  g.jit = 0.3;
  vec3 toEye = cameraPosition - P;
  float eyeDist = length(toEye);
  if (zone == 1) {
    // bands that follow the lie of the land, each one colour, every stroke in a band leaning the same way
    vec2 gF = -Nn.xz / max(Nn.y, 0.2) * 0.11 + vec2(0.034, 0.021);
    float F = (P.y * 0.11 + dot(xz, vec2(0.034, 0.021)) + 1.5 * texture(tNoise, xz / 190.0).r + 0.35 * texture(tNoise, xz / 47.0).g) * 8.5;
    float id = floor(F + (q.x - 0.5) * 0.14);
    float id2 = id;
    int k = int(mod(id * 3.0 + floor(fract(sin(id * 12.9898) * 43758.5453) * 2.0), 8.0));
    g.c1 = hc(k, lit, q.y);
    g.c2 = hc(k, lit + 0.2, q.w) * 1.1;
    vec2 across = normalize(gF + 1e-4);
    vec2 d2 = normalize(across + vec2(-across.y, across.x) * 0.45);
    g.dir = vec3(d2.x, 0.0, d2.y);
    g.len = 1.15;
    g.jit = 0.2;
    // far off the bands are lost and each hill is one quiet field of colour
    if (q.z < smoothstep(90.0, 210.0, eyeDist)) {
      float hid = floor(texture(tNoise, xz / 330.0).r * 6.0 + texture(tNoise, xz / 110.0).g * 2.0);
      g.c1 = mix(hc(int(mod(hid * 3.0, 8.0)), lit, q.y), vec3(0.64, 0.68, 0.52), 0.32);
      g.c2 = g.c1 * 1.04;
    }
  } else if (zone == 2) {
    // long grass combed one way by the wind
    if (kind == 3 && q.x > 0.4) kind = 1;
    g.c1 = zc(2, kind, lit, q.y);
    g.c2 = zc(2, other, lit, q.w);
    float wa = (texture(tNoise, xz / 61.0).a - 0.5) * 1.3 + (q.y - 0.5) * 0.35;
    g.dir = vec3(uWind.x * cos(wa) - uWind.y * sin(wa), 0.0, uWind.x * sin(wa) + uWind.y * cos(wa));
    g.len = 1.7;
  } else if (zone == 3) {
    if (m.b + (q.x - 0.5) * 0.3 > 0.5) {
      g.c1 = zc(3, 3, lit, q.y);
      g.c2 = zc(3, 3, lit + 0.15, q.w) * 1.05;
      g.dir = normalize(contour + (q.xyz - 0.5) * 0.4);
      g.len = 1.5;
    } else {
      g.c1 = zc(3, int(3.0 * fract(patch_ + (q.z - 0.5) * 0.3)), lit, q.y);
      g.c2 = zc(3, int(3.0 * fract(patch_ + 0.3)), lit, q.w);
    }
  } else if (zone == 4) {
    // the sunset's hills are smooth: one deep blue, turning green and then gold only where a slope faces the sun
    float rim = smoothstep(0.02, 0.5, dot(Nn, uSunsetDir));
    vec3 base = mix(vec3(0.07, 0.17, 0.45), vec3(0.1, 0.24, 0.52), texture(tNoise, xz / 90.0).r);
    base = mix(base, vec3(0.16, 0.42, 0.44), smoothstep(0.0, 0.5, rim));
    base = mix(base, vec3(0.62, 0.66, 0.3), smoothstep(0.55, 1.0, rim));
    base *= mix(0.62, 1.0, smoothstep(0.2, 0.6, lit));
    g.c1 = base;
    g.c2 = base * 1.08;
    g.dir = normalize(contour + (q.xyz - 0.5) * 0.2);
    g.len = 2.0;
    g.jit = 0.07;
  } else if (zone == 5) {
    // the garden is drawn on the bare card: cream ground, a little green and red earth worked into it
    float w = fract(patch_ * 0.6 + (q.z - 0.5) * 0.25);
    kind = w < 0.56 ? 3 : w < 0.78 ? 1 : w < 0.92 ? 0 : 2;
    g.c1 = zc(5, kind, lit, q.y);
    g.c2 = zc(5, 3, lit, q.w);
    g.jit = 0.16;
  } else if (zone == 7) {
    g.c1 = zc(7, kind, lit, q.y);
    g.c2 = zc(7, other, lit + 0.1, q.w);
    g.dir = normalize(mix(down, contour, step(0.7, q.x)) + (q.xyz - 0.5) * 0.4);
    g.len = 1.6;
  } else if (zone == 8) {
    float crack = min(abs(texture(tNoise, xz / 11.0).a - 0.5), abs(texture(tNoise, xz / 5.3 + 0.3).b - 0.5));
    g.c1 = zc(8, int(3.0 * fract(patch_ * 0.5 + (q.z - 0.5) * 0.2)), lit, q.y);
    g.c2 = zc(8, int(3.0 * fract(patch_ * 0.5 + 0.4)), lit, q.w);
    if (crack < 0.014) { g.c1 = zc(8, 3, lit, q.y); g.c2 = g.c1; }
  } else {
    g.c1 = zc(zone, kind, lit, q.y);
    g.c2 = zc(zone, other, lit, q.w);
    if (zone == 0) { g.dir = normalize(contour + vec3(0.5, 0.0, 0.3) + (q.xyz - 0.5) * 0.5); g.len = 1.25; }
  }
  // the line a hill draws against what lies behind it: where the ground turns away from the eye, a dark blue
  vec3 Vn = toEye / eyeDist;
  if (zone <= 4 && eyeDist > 14.0 && dot(Nn.xz, -Vn.xz) > 0.05 && dot(Nn, Vn) < 0.1 + 0.05 * q.x) {
    g.c1 = zone == 4 ? vec3(0.03, 0.08, 0.3) : vec3(0.1, 0.22, 0.42);
    g.c2 = g.c1 * 1.25;
  }
  // the way itself is worn pale (violet, in the sunset)
  if (zone <= 6 && r.z < m.r * 0.7) {
    g.c1 = zone == 4 ? paint3(vec3(0.56, 0.46, 0.74), vec3(0.4, 0.3, 0.6), vec3(0.2, 0.14, 0.4), lit, q.y)
      : paint3(vec3(0.95, 0.86, 0.66), vec3(0.8, 0.68, 0.5), vec3(0.42, 0.36, 0.46), lit, q.y);
  }
  return g;
}
`;

/** The uniforms JOURNEY reads, added to the block's shared ones. */
export function journeyUniforms(THREE) {
  return {
    uSea: { value: 0 },
    uBird: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSkyHigh: { value: new THREE.Color(0.62, 0.78, 0.86) },
    uSkyLow: { value: new THREE.Color(0.98, 0.86, 0.62) },
    uSkyA: { value: new THREE.Color(0.93, 0.74, 0.76) },
    uSkyB: { value: new THREE.Color(0.75, 0.72, 0.86) },
    uSunsetDir: { value: new THREE.Vector3(-0.42, 0.035, -0.9).normalize() },
    uAir: { value: new THREE.Vector4(0, 0, 0, 0) },
    uWaterDeep: { value: new THREE.Color(0.2, 0.3, 0.5) },
    uMirror: { value: 1 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
}
