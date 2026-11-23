// Animated story backdrops for the opening and the ending.
// Drawn procedurally at a fixed 320x180 resolution so they stay pixel-art crisp when scaled.

export type CinematicScene = "opening" | "ending";

export const CINEMATIC_W = 320;
export const CINEMATIC_H = 180;

type RGB = [number, number, number];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const css = (c: RGB, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
/** Cheap deterministic pseudo-random in [0, 1). */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function sky(ctx: CanvasRenderingContext2D, top: RGB, bottom: RGB) {
  for (let y = 0; y < CINEMATIC_H; y++) {
    ctx.fillStyle = css(mix(top, bottom, y / (CINEMATIC_H - 1)));
    ctx.fillRect(0, y, CINEMATIC_W, 1);
  }
}

function ridge(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  amp: number,
  freq: number,
  phase: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let x = 0; x < CINEMATIC_W; x++) {
    const y = Math.round(
      baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 1.3) * amp * 0.4,
    );
    ctx.fillRect(x, y, 1, CINEMATIC_H - y);
  }
}

function starfield(ctx: CanvasRenderingContext2D, t: number, count: number, maxY: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd(i * 3.1) * CINEMATIC_W);
    const y = Math.floor(rnd(i * 7.7) * maxY);
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
    ctx.fillStyle = `rgba(214,226,255,${alpha * tw})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function glowOrb(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, strength: number) {
  for (let r = radius; r >= 2; r -= 2) {
    ctx.fillStyle = `rgba(82,229,178,${strength * (1 - r / (radius + 2)) * 0.22})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(214,255,240,${Math.min(1, strength)})`;
  ctx.fillRect(cx - 1, cy - 1, 3, 3);
}

/** A small silhouette of Rio: head, green scarf, body, legs, and his sword. */
function rioSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  walk: boolean,
  color: string,
) {
  const bob = walk ? Math.round(Math.abs(Math.sin(t * 6)) * -1) : Math.round(Math.sin(t * 2) * 0.5);
  const yy = y + bob;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, yy, 4, 4);
  ctx.fillRect(x, yy + 4, 6, 5);
  ctx.fillRect(x + 1, yy + 9, 2, 3);
  ctx.fillRect(x + 3, yy + 9 - (walk && Math.sin(t * 6) > 0 ? 1 : 0), 2, 3);
  ctx.fillStyle = "#52e5b2";
  ctx.fillRect(x + 1, yy + 2, 4, 1);
  ctx.fillStyle = "#cfe9ff";
  ctx.fillRect(x + 7, yy + 1, 1, 9);
}

function drawOpening(ctx: CanvasRenderingContext2D, t: number, p: number) {
  const dawn = clamp01((p - 0.8) / 0.2);
  sky(ctx, [4, 6, 16], mix([22, 28, 58], [150, 96, 120], dawn));
  starfield(ctx, t, 80, 96, 0.95);

  // Shooting star every few seconds, as if the sky is trying to tell Rio something.
  const cycle = t % 9;
  if (cycle < 1.2) {
    for (let i = 0; i < 14; i++) {
      const k = cycle - i * 0.03;
      if (k < 0) continue;
      ctx.fillStyle = `rgba(220,255,240,${(1 - i / 14) * 0.9})`;
      ctx.fillRect(Math.round(30 + k * 200 - i * 2), Math.round(14 + k * 36 - i), 1, 1);
    }
  }

  // The green light that remains of the star shards, breathing as the story goes on.
  const orbStrength = (0.55 + 0.3 * Math.sin(t * 1.6)) * (0.4 + 0.6 * clamp01(p * 2));
  glowOrb(ctx, 150, 52, 22, orbStrength);

  // Creeping shadow: dark mist that drifts across the sky.
  for (let i = 0; i < 6; i++) {
    const x = CINEMATIC_W + 60 - ((t * 7 + i * 70) % (CINEMATIC_W + 140));
    const y = 40 + rnd(i + 2) * 50;
    ctx.fillStyle = `rgba(12,4,24,${0.35 + 0.2 * dawn})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 34 + rnd(i) * 16, 14 + rnd(i + 5) * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ridge(ctx, 124, 10, 0.02, 0.5, "#141d37");
  ridge(ctx, 146, 6, 0.035, 2.1, "#0b1224");

  // Temple on the far hill; its gate glows only faintly while the shadow holds.
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(238, 98, 62, 52);
  ctx.beginPath();
  ctx.moveTo(232, 98);
  ctx.lineTo(269, 80);
  ctx.lineTo(306, 98);
  ctx.fill();
  ctx.fillStyle = `rgba(82,229,178,${0.12 + 0.25 * orbStrength})`;
  ctx.fillRect(264, 118, 12, 32);

  // Sea shimmer at the bottom.
  for (let y = 162; y < CINEMATIC_H; y++) {
    const wave = Math.sin(t * 1.4 + y * 0.6) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(30,50,90,${0.5 + wave * 0.25})`;
    ctx.fillRect(0, y, CINEMATIC_W, 1);
  }

  // Rio stands alone on the shore, looking up at the light.
  rioSilhouette(ctx, 52, 132, t, false, "#05070f");
}

function drawEnding(ctx: CanvasRenderingContext2D, t: number, p: number) {
  const warm = clamp01(p);
  sky(ctx, mix([28, 38, 78], [116, 170, 226], warm), mix([40, 40, 72], [255, 214, 152], warm));

  // Sun rising behind the hills.
  const sunR = 14 + warm * 16;
  for (let r = sunR + 14; r >= 4; r -= 3) {
    ctx.fillStyle = `rgba(255,236,176,${0.04 + warm * 0.05})`;
    ctx.beginPath();
    ctx.arc(110, 112, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Light column from the star: the Emerald Light returns to the sky.
  const beam = (0.08 + warm * 0.2) * (0.85 + 0.15 * Math.sin(t * 2.2));
  ctx.fillStyle = `rgba(160,255,220,${beam})`;
  ctx.fillRect(152, 0, 16, CINEMATIC_H);
  ctx.fillStyle = `rgba(230,255,246,${beam * 0.6})`;
  ctx.fillRect(157, 0, 6, CINEMATIC_H);

  // Motes of light drifting down over the islands.
  for (let i = 0; i < 60; i++) {
    const speed = 8 + rnd(i * 1.3) * 14;
    const y = (rnd(i * 2.9) * CINEMATIC_H + t * speed) % CINEMATIC_H;
    const x = rnd(i * 4.7) * CINEMATIC_W + Math.sin(t * 0.8 + i) * 5;
    const gold = rnd(i * 9.1) > 0.5;
    ctx.fillStyle = gold ? `rgba(255,224,130,${0.35 + warm * 0.5})` : `rgba(160,255,220,${0.3 + warm * 0.5})`;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // A few birds crossing the sky.
  for (let i = 0; i < 3; i++) {
    const x = ((t * 14 + i * 110) % (CINEMATIC_W + 40)) - 20;
    const y = 36 + i * 9 + Math.sin(t + i) * 2;
    ctx.fillStyle = "rgba(40,40,70,0.75)";
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 1, 1);
    ctx.fillRect(Math.round(x + 1), Math.round(y - 1), 1, 1);
  }

  ridge(ctx, 118, 9, 0.02, 0.5, "#4b7a66");
  ridge(ctx, 142, 6, 0.04, 2.1, "#2d5a48");

  // Village rooftops on the left, lit by the dawn.
  ctx.fillStyle = "#1e4236";
  for (const hx of [18, 40, 62]) {
    ctx.fillRect(hx, 140, 14, 14);
    ctx.beginPath();
    ctx.moveTo(hx - 2, 140);
    ctx.lineTo(hx + 7, 130);
    ctx.lineTo(hx + 16, 140);
    ctx.fill();
  }

  // Father's grave with the sword planted before it. The light falls on it.
  const gx = 236;
  ctx.fillStyle = `rgba(255,240,190,${0.1 + warm * 0.12})`;
  ctx.beginPath();
  ctx.arc(gx + 4, 142, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9d2dd";
  ctx.fillRect(gx, 128, 9, 14);
  ctx.beginPath();
  ctx.arc(gx + 4.5, 128, 4.5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#e6f7ff";
  ctx.fillRect(gx + 12, 122, 1, 22);
  ctx.fillRect(gx + 10, 128, 5, 1);
  // A small wooden doll left at the stone.
  ctx.fillStyle = "#b07a4a";
  ctx.fillRect(gx - 4, 139, 3, 3);

  // Flowers that bloomed again around the grave.
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#f7e06b" : "#f27ea8";
    ctx.fillRect(gx - 14 + i * 4, 149 + (i % 3), 1, 1);
  }

  // Rio: standing by the grave in the new light.
  rioSilhouette(ctx, 214, 130, t, false, "#0b1224");
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 170, CINEMATIC_W, 10);
}

/** Draws one frame of the story backdrop. `progress` runs from 0 (start) to 1 (end). */
export function drawCinematic(
  ctx: CanvasRenderingContext2D,
  scene: CinematicScene,
  t: number,
  progress: number,
) {
  ctx.imageSmoothingEnabled = false;
  const p = clamp01(progress);
  if (scene === "opening") drawOpening(ctx, t, p);
  else drawEnding(ctx, t, p);
}
