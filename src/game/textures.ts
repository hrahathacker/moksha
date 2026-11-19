import * as THREE from 'three';

export interface ProceduralTexturePack {
  plasterColor: THREE.CanvasTexture;
  plasterBump: THREE.CanvasTexture;
  plasterRoughness: THREE.CanvasTexture;
  stoneColor: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  stoneRoughness: THREE.CanvasTexture;
  woodColor: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  woodRoughness: THREE.CanvasTexture;
  brassColor: THREE.CanvasTexture;
  brassBump: THREE.CanvasTexture;
  brassRoughness: THREE.CanvasTexture;
  ironColor: THREE.CanvasTexture;
  ironBump: THREE.CanvasTexture;
  ironRoughness: THREE.CanvasTexture;
  torchGripColor: THREE.CanvasTexture;
  torchGripBump: THREE.CanvasTexture;
  torchGripRoughness: THREE.CanvasTexture;
  jaliColor: THREE.CanvasTexture;
  jaliAlpha: THREE.CanvasTexture;
  tapestryColor: THREE.CanvasTexture;
  grillColor: THREE.CanvasTexture;
  grillAlpha: THREE.CanvasTexture;
  sareeColor: THREE.CanvasTexture;
  sareeBump: THREE.CanvasTexture;
  ghostFaceColor: THREE.CanvasTexture;
  parchmentColor: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  softParticle: THREE.CanvasTexture;
  dispose: () => void;
}

// Deterministic pseudo-random generator for reproducible gritty textures
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cracked damp 1984 haveli lime plaster with exposed Lakhori brickwork,
 * peeling edges, deep hairline cracks, and damp specular streaks in roughnessMap.
 */
function generatePeelingPlaster(
  anisotropy: number
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(1984);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);
  const [rCanvas, rCtx] = makeCanvas(size, size);

  // Underlying damp red-brown haveli brick layer
  ctx.fillStyle = '#361f19';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#282828';
  bCtx.fillRect(0, 0, size, size);
  // Bricks are slightly damper/rougher matte (~215)
  rCtx.fillStyle = '#d4d4d4';
  rCtx.fillRect(0, 0, size, size);

  // Thin weathered Lakhori haveli bricks
  const brickH = 11;
  const brickW = 32;
  for (let row = 0; row < size / brickH + 1; row++) {
    const offset = (row % 2) * (brickW * 0.5);
    for (let col = -1; col < size / brickW + 2; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      const tone = Math.floor(38 + rand() * 34);
      ctx.fillStyle = `rgb(${tone + 26}, ${Math.floor(tone * 0.68)}, ${Math.floor(tone * 0.5)})`;
      ctx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
      const bv = 72 + Math.floor(rand() * 44);
      bCtx.fillStyle = `rgb(${bv}, ${bv}, ${bv})`;
      bCtx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
      const rv = 195 + Math.floor(rand() * 45);
      rCtx.fillStyle = `rgb(${rv}, ${rv}, ${rv})`;
      rCtx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
    }
  }

  // Aged lime plaster coat over most of the wall
  const [plasterCanvas, pCtx] = makeCanvas(size, size);
  const grad = pCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#545750');
  grad.addColorStop(0.48, '#6e685b');
  grad.addColorStop(0.84, '#47453c');
  grad.addColorStop(1, '#262d27');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, size, size);

  // Grime, mineral efflorescence, and lime mottling
  for (let i = 0; i < 280; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 3 + rand() * 20;
    const dark = rand() > 0.44;
    pCtx.fillStyle = dark
      ? `rgba(18, 25, 22, ${0.06 + rand() * 0.16})`
      : `rgba(154, 143, 122, ${0.05 + rand() * 0.11})`;
    pCtx.beginPath();
    pCtx.arc(x, y, r, 0, Math.PI * 2);
    pCtx.fill();
  }

  // Punch irregular flaking holes to expose bricks beneath
  pCtx.globalCompositeOperation = 'destination-out';
  const peelCenters: Array<[number, number, number]> = [];
  for (let i = 0; i < 9; i++) {
    peelCenters.push([rand() * size, 42 + rand() * (size - 72), 12 + rand() * 28]);
  }
  for (const [cx, cy, radius] of peelCenters) {
    pCtx.beginPath();
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const rr = radius * (0.52 + rand() * 0.68);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr * 0.82;
      if (s === 0) pCtx.moveTo(px, py);
      else pCtx.lineTo(px, py);
    }
    pCtx.closePath();
    pCtx.fillStyle = 'rgba(0,0,0,1)';
    pCtx.fill();
  }
  pCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(plasterCanvas, 0, 0);

  // Plaster bump layer (raised plaster vs recessed brick)
  bCtx.save();
  bCtx.globalAlpha = 0.88;
  bCtx.fillStyle = '#d4d4d4';
  bCtx.fillRect(0, 0, size, size);
  bCtx.globalCompositeOperation = 'destination-out';
  for (const [cx, cy, radius] of peelCenters) {
    bCtx.beginPath();
    bCtx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
    bCtx.fill();
  }
  bCtx.restore();

  // Roughness layer: dry chalky plaster is matte (#dedede), damp streaks catch beam sheen (#686868)
  rCtx.fillStyle = '#e0e0e0';
  rCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 6 + rand() * 24;
    const dampPatch = rand() > 0.65;
    rCtx.fillStyle = dampPatch
      ? `rgba(92, 92, 92, ${0.22 + rand() * 0.35})`
      : `rgba(240, 240, 240, ${0.18 + rand() * 0.25})`;
    rCtx.beginPath();
    rCtx.arc(x, y, rad, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Deep spiderweb cracks & vertical water-seepage streaks
  for (let i = 0; i < 24; i++) {
    let x = rand() * size;
    let y = rand() * size;
    const lw = 0.7 + rand() * 1.1;
    ctx.strokeStyle = 'rgba(15, 19, 18, 0.62)';
    bCtx.strokeStyle = 'rgba(14, 14, 14, 0.86)';
    rCtx.strokeStyle = 'rgba(110, 110, 110, 0.55)';
    ctx.lineWidth = lw;
    bCtx.lineWidth = lw * 1.2;
    rCtx.lineWidth = lw * 2.2;
    ctx.beginPath();
    bCtx.beginPath();
    rCtx.beginPath();
    ctx.moveTo(x, y);
    bCtx.moveTo(x, y);
    rCtx.moveTo(x, y);
    for (let s = 0; s < 7; s++) {
      x += (rand() - 0.5) * 16;
      y += rand() * 15;
      ctx.lineTo(x, y);
      bCtx.lineTo(x, y);
      rCtx.lineTo(x, y);
    }
    ctx.stroke();
    bCtx.stroke();
    rCtx.stroke();
  }

  // Lower rising dampness & mossy moisture sheen (catches warm torchlight realistically)
  const dampColor = ctx.createLinearGradient(0, size * 0.66, 0, size);
  dampColor.addColorStop(0, 'rgba(10, 20, 16, 0)');
  dampColor.addColorStop(1, 'rgba(8, 17, 14, 0.72)');
  ctx.fillStyle = dampColor;
  ctx.fillRect(0, size * 0.66, size, size * 0.34);

  const dampRough = rCtx.createLinearGradient(0, size * 0.65, 0, size);
  dampRough.addColorStop(0, 'rgba(80, 80, 80, 0)');
  dampRough.addColorStop(1, 'rgba(72, 72, 72, 0.75)');
  rCtx.fillStyle = dampRough;
  rCtx.fillRect(0, size * 0.65, size, size * 0.35);

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
    finalizeTexture(rCanvas, false, anisotropy),
  ];
}

/**
 * Mossy weathered courtyard sandstone slabs with wet puddle glints in roughnessMap.
 */
function generateStoneTiles(
  anisotropy: number
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(4211);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);
  const [rCanvas, rCtx] = makeCanvas(size, size);

  // Dark wet mossy grout
  ctx.fillStyle = '#111917';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#141414';
  bCtx.fillRect(0, 0, size, size);
  // Grout holds damp sheen
  rCtx.fillStyle = '#626262';
  rCtx.fillRect(0, 0, size, size);

  const grid = 4;
  const cell = size / grid;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const jitterX = (gy % 2) * (cell * 0.25);
      const x = (gx * cell + jitterX) % size;
      const y = gy * cell;
      const base = 44 + Math.floor(rand() * 24);
      const r = base - 5 + Math.floor(rand() * 10);
      const g = base + 2 + Math.floor(rand() * 9);
      const b = base + 5 + Math.floor(rand() * 10);
      const tileRough = 165 + Math.floor(rand() * 62);
      const tileBump = 152 + Math.floor(rand() * 52);

      const drawTile = (ox: number) => {
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(ox + 1.5, y + 1.5, cell - 3, cell - 3);
        bCtx.fillStyle = `rgb(${tileBump}, ${tileBump}, ${tileBump})`;
        bCtx.fillRect(ox + 1.5, y + 1.5, cell - 3, cell - 3);
        rCtx.fillStyle = `rgb(${tileRough}, ${tileRough}, ${tileRough})`;
        rCtx.fillRect(ox + 1.5, y + 1.5, cell - 3, cell - 3);

        // Chipped edges & mineral grit speckles
        for (let i = 0; i < 46; i++) {
          const sx = ox + 2 + rand() * (cell - 4);
          const sy = y + 2 + rand() * (cell - 4);
          const sr = 1 + rand() * 2.6;
          const dark = rand() > 0.48;
          ctx.fillStyle = dark ? 'rgba(12, 20, 18, 0.28)' : 'rgba(135, 152, 148, 0.14)';
          ctx.fillRect(sx, sy, sr, sr);
          bCtx.fillStyle = dark ? 'rgba(60, 60, 60, 0.35)' : 'rgba(235, 235, 235, 0.28)';
          bCtx.fillRect(sx, sy, sr, sr);
        }
      };

      drawTile(x);
      if (x + cell > size) drawTile(x - size);
    }
  }

  // Creeping moss blotches & wet rainwater puddles (very smooth dark roughness so flashlight glints!)
  for (let i = 0; i < 48; i++) {
    const mx = rand() * size;
    const my = rand() * size;
    const mr = 4 + rand() * 14;
    const isPuddle = i % 3 === 0;
    if (isPuddle) {
      ctx.fillStyle = `rgba(14, 24, 26, ${0.22 + rand() * 0.2})`;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 1.25, 0, Math.PI * 2);
      ctx.fill();

      rCtx.fillStyle = `rgba(54, 54, 54, ${0.55 + rand() * 0.3})`;
      rCtx.beginPath();
      rCtx.arc(mx, my, mr * 1.25, 0, Math.PI * 2);
      rCtx.fill();
    } else {
      ctx.fillStyle = `rgba(30, 50, 28, ${0.18 + rand() * 0.24})`;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      rCtx.fillStyle = `rgba(225, 225, 225, ${0.35 + rand() * 0.25})`;
      rCtx.beginPath();
      rCtx.arc(mx, my, mr, 0, Math.PI * 2);
      rCtx.fill();
    }
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
    finalizeTexture(rCanvas, false, anisotropy),
  ];
}

/**
 * Dark carved North Indian teak wood with fine grain, plank grooves, and varnished/worn roughness variation.
 */
function generateWeatheredWood(
  anisotropy: number
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(9001);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);
  const [rCanvas, rCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#281911';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#bcbcbc';
  rCtx.fillRect(0, 0, size, size);

  const planks = 6;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const px = p * pw;
    const shade = Math.floor(rand() * 16);
    ctx.fillStyle = `rgb(${37 + shade}, ${23 + Math.floor(shade * 0.7)}, ${15 + Math.floor(shade * 0.5)})`;
    ctx.fillRect(px + 0.5, 0, pw - 1, size);

    const plankR = 140 + Math.floor(rand() * 52);
    rCtx.fillStyle = `rgb(${plankR}, ${plankR}, ${plankR})`;
    rCtx.fillRect(px + 0.5, 0, pw - 1, size);

    // Fine vertical wood grain fibers + subtle satin polish streaks
    for (let i = 0; i < 62; i++) {
      const gx = px + 1 + rand() * (pw - 2);
      const dark = rand() > 0.36;
      ctx.fillStyle = dark ? 'rgba(12, 7, 4, 0.38)' : 'rgba(98, 66, 42, 0.24)';
      ctx.fillRect(gx, 0, 1 + rand() * 1.2, size);
      bCtx.fillStyle = dark ? 'rgba(34, 34, 34, 0.48)' : 'rgba(218, 218, 218, 0.38)';
      bCtx.fillRect(gx, 0, 1 + rand() * 1, size);
      rCtx.fillStyle = dark ? 'rgba(220, 220, 220, 0.35)' : 'rgba(108, 108, 108, 0.28)';
      rCtx.fillRect(gx, 0, 1 + rand() * 1.3, size);
    }

    // Subtle carved wood knot
    if (rand() > 0.35) {
      const kx = px + pw * (0.28 + rand() * 0.44);
      const ky = 28 + rand() * (size - 56);
      ctx.strokeStyle = 'rgba(16, 9, 5, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 4 + rand() * 3, 10 + rand() * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      bCtx.fillStyle = '#383838';
      bCtx.beginPath();
      bCtx.ellipse(kx, ky, 3.5, 8, 0, 0, Math.PI * 2);
      bCtx.fill();
    }

    // Dark plank divider groove
    ctx.fillStyle = '#100906';
    ctx.fillRect(px, 0, 1.8, size);
    bCtx.fillStyle = '#121212';
    bCtx.fillRect(px, 0, 2.2, size);
    rCtx.fillStyle = '#f0f0f0';
    rCtx.fillRect(px, 0, 2, size);
  }

  // Aged dust & water stain blotches
  for (let i = 0; i < 44; i++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const sr = 5 + rand() * 18;
    ctx.fillStyle = `rgba(16, 20, 18, ${0.09 + rand() * 0.15})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    rCtx.fillStyle = `rgba(232, 232, 232, ${0.15 + rand() * 0.22})`;
    rCtx.beginPath();
    rCtx.arc(sx, sy, sr, 0, Math.PI * 2);
    rCtx.fill();
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
    finalizeTexture(rCanvas, false, anisotropy),
  ];
}

/**
 * Weathered hammered Indian temple brass with tarnished hollows, verdigris hints,
 * and gleaming worn ridges in roughnessMap.
 */
function generateWeatheredBrass(
  anisotropy: number
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(5521);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);
  const [rCanvas, rCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#9a7432';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#888888';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#6c6c6c';
  rCtx.fillRect(0, 0, size, size);

  // Subtle hammered dimples & burnished warm highlights
  for (let i = 0; i < 220; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 4 + rand() * 11;
    const bright = rand() > 0.45;
    ctx.fillStyle = bright
      ? `rgba(218, 178, 86, ${0.09 + rand() * 0.15})`
      : `rgba(54, 38, 16, ${0.12 + rand() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();

    bCtx.fillStyle = bright ? 'rgba(182, 182, 182, 0.25)' : 'rgba(65, 65, 65, 0.28)';
    bCtx.beginPath();
    bCtx.arc(x, y, rad * 0.85, 0, Math.PI * 2);
    bCtx.fill();

    rCtx.fillStyle = bright ? 'rgba(62, 62, 62, 0.38)' : 'rgba(185, 185, 185, 0.34)';
    rCtx.beginPath();
    rCtx.arc(x, y, rad, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Oxidized patina & faint greenish verdigris speckles
  for (let i = 0; i < 55; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 2 + rand() * 7;
    ctx.fillStyle = `rgba(54, 78, 62, ${0.12 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    rCtx.fillStyle = 'rgba(225, 225, 225, 0.55)';
    rCtx.beginPath();
    rCtx.arc(x, y, rad, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Fine lathe/polish scratches
  for (let i = 0; i < 45; i++) {
    const y = rand() * size;
    ctx.strokeStyle = 'rgba(230, 198, 118, 0.14)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
    finalizeTexture(rCanvas, false, anisotropy),
  ];
}

/**
 * Pitted rusted wrought iron for Haveli main gate, door hinges, and barred windows.
 */
function generateRustedIron(
  anisotropy: number
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(8192);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);
  const [rCanvas, rCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#252628';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, size, size);
  // Bare dark forged iron is semi-metallic (~115); rust pockets become gritty matte (~238)
  rCtx.fillStyle = '#7c7c7c';
  rCtx.fillRect(0, 0, size, size);

  // Forged pitting & scaling
  for (let i = 0; i < 240; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 3 + rand() * 14;
    const h = 3 + rand() * 14;
    const isRust = rand() > 0.42;
    if (isRust) {
      const rTone = 86 + Math.floor(rand() * 52);
      ctx.fillStyle = `rgba(${rTone}, ${Math.floor(rTone * 0.44)}, ${Math.floor(rTone * 0.22)}, ${0.32 + rand() * 0.48})`;
      ctx.beginPath();
      ctx.arc(x, y, w * 0.55, 0, Math.PI * 2);
      ctx.fill();

      bCtx.fillStyle = `rgba(${30 + Math.floor(rand() * 45)}, ${30 + Math.floor(rand() * 45)}, ${30 + Math.floor(rand() * 45)}, 0.55)`;
      bCtx.beginPath();
      bCtx.arc(x, y, w * 0.5, 0, Math.PI * 2);
      bCtx.fill();

      rCtx.fillStyle = 'rgba(238, 238, 238, 0.72)';
      rCtx.beginPath();
      rCtx.arc(x, y, w * 0.55, 0, Math.PI * 2);
      rCtx.fill();
    } else {
      ctx.fillStyle = `rgba(68, 72, 76, ${0.15 + rand() * 0.22})`;
      ctx.fillRect(x, y, w, h * 0.5);
      rCtx.fillStyle = 'rgba(84, 84, 84, 0.45)';
      rCtx.fillRect(x, y, w, h * 0.5);
    }
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
    finalizeTexture(rCanvas, false, anisotropy),
  ];
}

/**
 * Classic 1980s Indian vintage metal Eveready-style corrugated & knurled flashlight grip.
 */
function generateTorchGrip(
  anisotropy: number
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(19842);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);
  const [rCanvas, rCtx] = makeCanvas(size, size);

  // Dark gunmetal-bronze enamel finish
  ctx.fillStyle = '#24272a';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  // Longitudinal machined ribs + diamond knurling
  const ribs = 24;
  const rw = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * rw;
    const g = ctx.createLinearGradient(x, 0, x + rw, 0);
    g.addColorStop(0, '#141618');
    g.addColorStop(0.45, '#3b4046');
    g.addColorStop(0.65, '#4b5056');
    g.addColorStop(1, '#121416');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rw, size);

    const bg = bCtx.createLinearGradient(x, 0, x + rw, 0);
    bg.addColorStop(0, '#1c1c1c');
    bg.addColorStop(0.5, '#e8e8e8');
    bg.addColorStop(1, '#1c1c1c');
    bCtx.fillStyle = bg;
    bCtx.fillRect(x, 0, rw, size);

    // Ridge tops are polished from years of gripping; valleys hold dark grime
    rCtx.fillStyle = '#c8c8c8';
    rCtx.fillRect(x, 0, rw, size);
    rCtx.fillStyle = '#525252';
    rCtx.fillRect(x + rw * 0.28, 0, rw * 0.44, size);
  }

  // Horizontal grip band grooves
  for (let y = 0; y < size; y += 16) {
    ctx.fillStyle = 'rgba(10, 10, 12, 0.42)';
    ctx.fillRect(0, y, size, 3);
    bCtx.fillStyle = 'rgba(20, 20, 20, 0.6)';
    bCtx.fillRect(0, y, size, 3);
  }

  // Subtle brass-silver wear scratches along barrel
  for (let i = 0; i < 60; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 26;
    ctx.strokeStyle = 'rgba(165, 152, 128, 0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 6, y + len);
    ctx.stroke();
    rCtx.strokeStyle = 'rgba(42, 42, 42, 0.65)';
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + (rand() - 0.5) * 6, y + len);
    rCtx.stroke();
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
    finalizeTexture(rCanvas, false, anisotropy),
  ];
}

function generateCarvedJali(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [aCanvas, aCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#4c463d';
  ctx.fillRect(0, 0, size, size);
  aCtx.fillStyle = '#ffffff';
  aCtx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#686053';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, size - 14, size - 14);

  aCtx.fillStyle = '#000000';
  const cols = 4;
  const rows = 3;
  const cw = (size - 36) / cols;
  const ch = (size - 36) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = 18 + (c + 0.5) * cw;
      const cy = 18 + (r + 0.5) * ch;
      aCtx.beginPath();
      aCtx.moveTo(cx, cy - ch * 0.34);
      aCtx.lineTo(cx + cw * 0.32, cy);
      aCtx.lineTo(cx, cy + ch * 0.34);
      aCtx.lineTo(cx - cw * 0.32, cy);
      aCtx.closePath();
      aCtx.fill();

      ctx.strokeStyle = '#2d2924';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch * 0.34);
      ctx.lineTo(cx + cw * 0.32, cy);
      ctx.lineTo(cx, cy + ch * 0.34);
      ctx.lineTo(cx - cw * 0.32, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(aCanvas, false, anisotropy),
  ];
}

function generateFadedTapestry(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const rand = mulberry32(7711);
  const [canvas, ctx] = makeCanvas(size, size);

  ctx.fillStyle = '#3e2324';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#8b6d3b';
  ctx.lineWidth = 8;
  ctx.strokeRect(9, 9, size - 18, size - 18);
  ctx.strokeStyle = '#5c3f22';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, size - 36, size - 36);

  ctx.save();
  ctx.translate(size / 2, size / 2);
  for (let ring = 0; ring < 3; ring++) {
    const petals = 12 + ring * 4;
    const rad = 26 + ring * 24;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = ring % 2 === 0 ? 'rgba(155, 114, 58, 0.35)' : 'rgba(128, 42, 42, 0.45)';
      ctx.beginPath();
      ctx.ellipse(rad, 0, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();

  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = `rgba(18, 14, 14, ${0.12 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 4 + rand() * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, true, anisotropy);
}

function generateRustedGrill(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(3141);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [aCanvas, aCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#28201e';
  ctx.fillRect(0, 0, size, size);
  aCtx.fillStyle = '#000000';
  aCtx.fillRect(0, 0, size, size);

  aCtx.fillStyle = '#ffffff';
  aCtx.fillRect(0, 0, size, 16);
  aCtx.fillRect(0, size - 16, size, 16);
  aCtx.fillRect(0, 0, 16, size);
  aCtx.fillRect(size - 16, 0, 16, size);

  for (let i = 1; i <= 5; i++) {
    const x = (i / 6) * size - 5;
    aCtx.fillRect(x, 0, 10, size);
  }
  aCtx.fillRect(0, size * 0.5 - 6, size, 12);

  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = rand() > 0.4 ? 'rgba(98, 45, 22, 0.58)' : 'rgba(24, 24, 28, 0.62)';
    ctx.fillRect(rand() * size, rand() * size, 4 + rand() * 14, 4 + rand() * 14);
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(aCanvas, false, anisotropy),
  ];
}

function generateMaroonSaree(anisotropy: number): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const size = 256;
  const rand = mulberry32(19840);
  const [cCanvas, ctx] = makeCanvas(size, size);
  const [bCanvas, bCtx] = makeCanvas(size, size);

  ctx.fillStyle = '#3b0e14';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Fine woven silk-cotton threads & draped vertical pleats
  for (let x = 0; x < size; x += 2) {
    const fold = Math.sin((x / size) * Math.PI * 20) * 18 + Math.sin((x / size) * Math.PI * 6) * 8;
    const tone = Math.max(0, Math.min(255, Math.floor(128 + fold * 2.8)));
    bCtx.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
    bCtx.fillRect(x, 0, 2, size);

    ctx.fillStyle = fold > 0 ? `rgba(122, 28, 38, ${Math.min(0.45, fold / 75)})` : `rgba(14, 3, 5, ${Math.min(0.65, -fold / 48)})`;
    ctx.fillRect(x, 0, 2, size);
  }

  // Tarnished antique gold zari border near hem
  const borderY = size - 46;
  ctx.fillStyle = '#7d622d';
  ctx.fillRect(0, borderY, size, 28);
  ctx.fillStyle = '#441218';
  ctx.fillRect(0, borderY + 4, size, 20);
  ctx.fillStyle = '#a4833e';
  for (let x = 0; x < size; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x + 6, borderY + 6);
    ctx.lineTo(x + 10.5, borderY + 14);
    ctx.lineTo(x + 6, borderY + 22);
    ctx.lineTo(x + 1.5, borderY + 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#a88944';
  ctx.fillRect(0, borderY + 29, size, 3);

  // Soot, ash & tattered moisture stains creeping up from hem
  const hemGrime = ctx.createLinearGradient(0, size * 0.72, 0, size);
  hemGrime.addColorStop(0, 'rgba(10, 7, 7, 0)');
  hemGrime.addColorStop(1, 'rgba(9, 6, 7, 0.74)');
  ctx.fillStyle = hemGrime;
  ctx.fillRect(0, size * 0.72, size, size * 0.28);

  for (let i = 0; i < 105; i++) {
    ctx.fillStyle = `rgba(12, 8, 9, ${0.14 + rand() * 0.28})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 4 + rand() * 16, 0, Math.PI * 2);
    ctx.fill();
  }

  return [
    finalizeTexture(cCanvas, true, anisotropy),
    finalizeTexture(bCanvas, false, anisotropy),
  ];
}

function generateGhostFace(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const rand = mulberry32(19849);
  const [canvas, ctx] = makeCanvas(size, size);

  // Eerie pale corpse-ash complexion shadowed around temples and jawline
  const rad = ctx.createRadialGradient(128, 120, 14, 128, 128, 132);
  rad.addColorStop(0, '#9fa8aa');
  rad.addColorStop(0.52, '#737f82');
  rad.addColorStop(0.85, '#3b4549');
  rad.addColorStop(1, '#1b2226');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);

  // Fine gaunt mottling & vein-like age shadows
  for (let i = 0; i < 55; i++) {
    ctx.fillStyle = `rgba(22, 30, 34, ${0.06 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 4 + rand() * 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunken cheekbone hollows
  ctx.fillStyle = 'rgba(12, 18, 22, 0.62)';
  ctx.beginPath();
  ctx.ellipse(80, 152, 24, 36, 0.35, 0, Math.PI * 2);
  ctx.ellipse(176, 152, 24, 36, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Deep hollow eye sockets + smudged kajal tear tracks
  const drawSocket = (ex: number, ey: number) => {
    const g = ctx.createRadialGradient(ex, ey, 3, ex, ey, 26);
    g.addColorStop(0, '#020305');
    g.addColorStop(0.58, '#0b0e12');
    g.addColorStop(1, 'rgba(18, 22, 26, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 25, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smudged dark kajal streak trailing down cheek
    const tearGrad = ctx.createLinearGradient(ex, ey + 10, ex, ey + 48);
    tearGrad.addColorStop(0, 'rgba(8, 10, 14, 0.62)');
    tearGrad.addColorStop(1, 'rgba(8, 10, 14, 0)');
    ctx.fillStyle = tearGrad;
    ctx.fillRect(ex - 4, ey + 10, 8, 38);

    // Cold pinpoint haunted reflection inside hollow socket
    ctx.fillStyle = 'rgba(215, 240, 245, 0.82)';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };
  drawSocket(95, 108);
  drawSocket(161, 108);

  // Smudged faded crimson bridal bindi
  ctx.fillStyle = 'rgba(118, 16, 22, 0.72)';
  ctx.beginPath();
  ctx.arc(128, 84, 4.8, 0, Math.PI * 2);
  ctx.fill();

  // Sharp shadowed nose bridge
  ctx.strokeStyle = 'rgba(18, 24, 28, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(124, 112);
  ctx.lineTo(121, 140);
  ctx.moveTo(132, 112);
  ctx.lineTo(135, 140);
  ctx.stroke();

  // Slightly parted gaunt cracked lips
  ctx.fillStyle = '#1b1114';
  ctx.beginPath();
  ctx.ellipse(128, 175, 23, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#050406';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(105, 175);
  ctx.quadraticCurveTo(128, 170, 151, 175);
  ctx.stroke();

  // Tangled wet hair wisps across forehead
  ctx.strokeStyle = 'rgba(6, 7, 9, 0.84)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const hx = 34 + i * 7;
    ctx.beginPath();
    ctx.moveTo(hx, 0);
    ctx.quadraticCurveTo(hx + (i % 2 === 0 ? -9 : 9), 40, hx + (i % 3 === 0 ? 6 : -6), 70 + (i % 4) * 9);
    ctx.stroke();
  }

  return finalizeTexture(canvas, true, anisotropy);
}

function generateParchment(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const rand = mulberry32(19841);
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#b9a37e';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(92, 68, 40, ${0.06 + rand() * 0.14})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 6 + rand() * 26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(42, 24, 18, 0.65)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 8; row++) {
    const y = 38 + row * 24;
    ctx.beginPath();
    ctx.moveTo(24, y);
    for (let x = 28; x < size - 28; x += 12) {
      ctx.lineTo(x, y + (rand() - 0.5) * 4);
    }
    ctx.stroke();
  }

  return finalizeTexture(canvas, true, anisotropy);
}

function generateContactShadow(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft glowing circular radial sprite for dust motes, fire embers, and golden pickup sparks.
 */
function generateSoftParticle(): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.32, 'rgba(255, 248, 232, 0.72)');
  g.addColorStop(0.7, 'rgba(255, 236, 200, 0.18)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(
  renderer: THREE.WebGLRenderer,
  isMobile = false
): ProceduralTexturePack {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const aniso = isMobile ? Math.min(2, maxAniso) : Math.min(8, maxAniso);

  const [plasterColor, plasterBump, plasterRoughness] = generatePeelingPlaster(aniso);
  const [stoneColor, stoneBump, stoneRoughness] = generateStoneTiles(aniso);
  const [woodColor, woodBump, woodRoughness] = generateWeatheredWood(aniso);
  const [brassColor, brassBump, brassRoughness] = generateWeatheredBrass(aniso);
  const [ironColor, ironBump, ironRoughness] = generateRustedIron(aniso);
  const [torchGripColor, torchGripBump, torchGripRoughness] = generateTorchGrip(aniso);
  const [jaliColor, jaliAlpha] = generateCarvedJali(aniso);
  const tapestryColor = generateFadedTapestry(aniso);
  const [grillColor, grillAlpha] = generateRustedGrill(aniso);
  const [sareeColor, sareeBump] = generateMaroonSaree(aniso);
  const ghostFaceColor = generateGhostFace(aniso);
  const parchmentColor = generateParchment(aniso);
  const contactShadow = generateContactShadow();
  const softParticle = generateSoftParticle();

  const all = [
    plasterColor,
    plasterBump,
    plasterRoughness,
    stoneColor,
    stoneBump,
    stoneRoughness,
    woodColor,
    woodBump,
    woodRoughness,
    brassColor,
    brassBump,
    brassRoughness,
    ironColor,
    ironBump,
    ironRoughness,
    torchGripColor,
    torchGripBump,
    torchGripRoughness,
    jaliColor,
    jaliAlpha,
    tapestryColor,
    grillColor,
    grillAlpha,
    sareeColor,
    sareeBump,
    ghostFaceColor,
    parchmentColor,
    contactShadow,
    softParticle,
  ];

  return {
    plasterColor,
    plasterBump,
    plasterRoughness,
    stoneColor,
    stoneBump,
    stoneRoughness,
    woodColor,
    woodBump,
    woodRoughness,
    brassColor,
    brassBump,
    brassRoughness,
    ironColor,
    ironBump,
    ironRoughness,
    torchGripColor,
    torchGripBump,
    torchGripRoughness,
    jaliColor,
    jaliAlpha,
    tapestryColor,
    grillColor,
    grillAlpha,
    sareeColor,
    sareeBump,
    ghostFaceColor,
    parchmentColor,
    contactShadow,
    softParticle,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
