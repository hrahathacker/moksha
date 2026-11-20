import * as THREE from 'three';
import { createMoonlightWindow, createWoodenTable } from './models';
import { ProceduralTexturePack } from './textures';
import { AABBCollider } from './haveliMap';

export const FLOOR_1_Y = 4.1;
export const BASEMENT_Y = -4.2;

export interface FirstFloorStairGateRig {
  root: THREE.Group;
  leftPivot: THREE.Group;
  rightPivot: THREE.Group;
  lockChainGroup: THREE.Group;
  interactPos: THREE.Vector3;
  closedBox: { minX: number; maxX: number; minZ: number; maxZ: number };
  isLocked: boolean;
  isOpen: boolean;
  openAmount: number; // 0 = closed, 1 = open
  rattleTimer: number;
}

export interface BasementTrapdoorRig {
  root: THREE.Group;
  doorPivot: THREE.Group;
  lockChainGroup: THREE.Group;
  interactPos: THREE.Vector3;
  lockedBox: { minX: number; maxX: number; minZ: number; maxZ: number };
  isLocked: boolean;
  isOpen: boolean;
  openAmount: number; // 0 = closed, 1 = open
  rattleTimer: number;
}

export interface MultiFloorBuildResult {
  firstFloorGate: FirstFloorStairGateRig;
  trapdoor: BasementTrapdoorRig;
  colliders: AABBCollider[];
  flickerLights: Array<{
    light: THREE.PointLight;
    baseIntensity: number;
    phase: number;
    flame?: THREE.Mesh;
  }>;
  waterMesh: THREE.Mesh;
  yantraRing: THREE.Mesh;
}

/**
 * Stairwell bounds (kept strictly inside NE & SW outer corridors so all Ground Floor
 * rooms, almirahs, diyas, notes, bells, seals, and ritual item spawns remain 100% untouched).
 */
export const STAIRS_UP_BOUNDS = {
  minX: 9.4,
  maxX: 11.8,
  zBottom: -8.4, // Ground floor entry (y = 0)
  zTop: -13.6, // 1st floor landing (y = FLOOR_1_Y)
};

export const STAIRS_DOWN_BOUNDS = {
  minX: -11.8,
  maxX: -9.4,
  zTop: 8.4, // Ground floor entry (y = 0)
  zBottom: 13.6, // Basement landing (y = BASEMENT_Y)
};

/**
 * Computes the player's walkable floor elevation Y for any (x, z, currentFeetY) across
 * Ground Floor (0m), 1st Floor (+4.1m), Underground Basement (-4.2m), and both staircases.
 */
export function getHaveliFloorElevation(
  x: number,
  z: number,
  currentFeetY: number,
  trapdoorOpen: boolean,
  firstFloorOpen = true
): number {
  // 1. NE Grand Wooden Staircase (Ground 0.0 -> 1st Floor +4.10)
  if (
    x >= STAIRS_UP_BOUNDS.minX - 0.15 &&
    x <= STAIRS_UP_BOUNDS.maxX + 0.15 &&
    z <= STAIRS_UP_BOUNDS.zBottom + 0.35 &&
    z >= STAIRS_UP_BOUNDS.zTop - 0.35 &&
    currentFeetY > -1.5
  ) {
    if (!firstFloorOpen && currentFeetY < 0.8) {
      return 0;
    }
    const t = THREE.MathUtils.clamp(
      (STAIRS_UP_BOUNDS.zBottom - z) / (STAIRS_UP_BOUNDS.zBottom - STAIRS_UP_BOUNDS.zTop),
      0,
      1
    );
    return t * FLOOR_1_Y;
  }

  // 2. SW Basement Stone Staircase (Ground 0.0 -> Basement -4.20)
  if (
    x >= STAIRS_DOWN_BOUNDS.minX - 0.15 &&
    x <= STAIRS_DOWN_BOUNDS.maxX + 0.15 &&
    z >= STAIRS_DOWN_BOUNDS.zTop - 0.35 &&
    z <= STAIRS_DOWN_BOUNDS.zBottom + 0.35 &&
    currentFeetY < 2.2
  ) {
    if (!trapdoorOpen && currentFeetY >= -0.4) {
      return 0;
    }
    const t = THREE.MathUtils.clamp(
      (z - STAIRS_DOWN_BOUNDS.zTop) / (STAIRS_DOWN_BOUNDS.zBottom - STAIRS_DOWN_BOUNDS.zTop),
      0,
      1
    );
    return t * BASEMENT_Y;
  }

  // 3. Flat floor slabs based on current elevation band
  if (currentFeetY >= 2.35) {
    return FLOOR_1_Y;
  }
  if (currentFeetY <= -1.9) {
    return BASEMENT_Y;
  }
  return 0;
}

/**
 * Floor-aware room name lookup preserving exact Ground Floor room names for Chapters 3–7.
 */
export function getMultiFloorRoomName(x: number, z: number, feetY = 0): string {
  // 1st Floor (Upar Ki Manzil)
  if (feetY >= 3.0) {
    if (
      x >= STAIRS_UP_BOUNDS.minX - 0.5 &&
      x <= STAIRS_UP_BOUNDS.maxX + 0.5 &&
      z <= -7.6 &&
      z >= -14.6
    ) {
      return 'Grand Wooden Stairs';
    }
    if (z < -7.5 && Math.abs(x) < 7.5) return 'Thakur Study / Library';
    if (x < -7.5 && Math.abs(z) < 7.5) return 'Bridal Chamber';
    if (x > 7.5 && Math.abs(z) < 7.5) return 'Guest Room';
    if (z > 7.5 && Math.abs(x) < 7.5) return 'Terrace Balcony';
    return '1st Floor Gallery';
  }

  // Underground Basement (Tahkhana)
  if (feetY <= -1.5) {
    if (
      x >= STAIRS_DOWN_BOUNDS.minX - 0.5 &&
      x <= STAIRS_DOWN_BOUNDS.maxX + 0.5 &&
      z >= 7.6 &&
      z <= 14.6
    ) {
      return 'Tahkhana Stone Stairs';
    }
    if (z < -5.5 && Math.abs(x) < 7.2) return 'Tantrik Ritual Chamber';
    if (x < -7.2 && z > -9.0 && z < 6.0) return 'Tahkhana Prison Cells';
    if (x > 6.8 && z > -5.0 && z < 5.5) return 'Subterranean Wellspring';
    return 'Underground Tahkhana';
  }

  // Mid-stairs indicator
  if (feetY > 0.65 && feetY < 3.0) {
    return 'Grand Wooden Stairs';
  }

  // Preserved Ground Floor Room Names (100% unchanged for Chapters 3–7)
  if (z < -7.5 && Math.abs(x) < 7.3) return 'Pooja Room';
  if (z > 7.5 && Math.abs(x) < 7.3) return 'Storeroom';
  if (x < -7.5 && Math.abs(z) < 7.3) return 'Master Bedroom';
  if (x > 7.5 && Math.abs(z) < 7.3) return 'Old Kitchen';
  if (Math.abs(x) <= 6.2 && Math.abs(z) <= 6.2) return 'Central Aangan';
  return 'Arched Corridor';
}

/**
 * Builds:
 * - Zone 2 Ground Floor hiding furniture upgrades (Palang beds, heavy kitchen/hall wooden tables)
 * - Zone 3 1st Floor (Grand Wooden Stairs, Thakur Study/Library, Bridal Chamber, Guest Room, Balcony)
 * - Zone 4 Underground Tahkhana (Stone Trapdoor, Stone Stairs, Pillars, Prison Cells, Wellspring, Tantrik Chamber)
 */
export function buildHaveliMultiFloorExpansion(
  root: THREE.Group,
  textures: ProceduralTexturePack,
  isLowQuality: boolean,
  sharedMats: {
    plasterMat: THREE.MeshStandardMaterial;
    stoneFloorMat: THREE.MeshStandardMaterial;
    woodMat: THREE.MeshStandardMaterial;
    ceilingMat: THREE.MeshStandardMaterial;
  }
): MultiFloorBuildResult {
  const colliders: AABBCollider[] = [];
  const flickerLights: MultiFloorBuildResult['flickerLights'] = [];

  const { plasterMat, stoneFloorMat, woodMat, ceilingMat } = sharedMats;

  const darkWoodMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: isLowQuality ? 0.02 : 0.036,
    color: 0x3b2619,
    roughness: 0.84,
    metalness: 0.08,
  });

  const dampStoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: isLowQuality ? 0.032 : 0.056,
    color: 0x5c6668,
    roughness: 0.9,
    metalness: 0.08,
  });

  const rustedIronMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.022,
    color: 0x4b3f39,
    roughness: 0.62,
    metalness: 0.78,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    color: 0xc29a48,
    roughness: 0.34,
    metalness: 0.88,
  });

  const crimsonClothMat = new THREE.MeshStandardMaterial({
    color: 0x5e151a,
    roughness: 0.92,
    metalness: 0.04,
  });

  const creamMattressMat = new THREE.MeshStandardMaterial({
    color: 0x6b5c4d,
    roughness: 0.94,
    metalness: 0.02,
  });

  const boxCache = new Map<string, THREE.BoxGeometry>();
  const getBox = (w: number, h: number, d: number) => {
    const k = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
    let g = boxCache.get(k);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      boxCache.set(k, g);
    }
    return g;
  };

  const addFloorWall = (
    floorLevel: -1 | 0 | 1,
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    yBase: number,
    mat: THREE.Material,
    solid = true
  ) => {
    const m = new THREE.Mesh(getBox(w, h, d), mat);
    m.position.set(x, yBase + h / 2, z);
    m.receiveShadow = true;
    root.add(m);
    if (solid) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        floorLevel,
        isCover: true,
      });
    }
    return m;
  };

  // Reusable composite Carved Wooden Palang (Indian Bed) with 0.62m crawl-under clearance
  const createCarvedPalang = (
    x: number,
    yBase: number,
    z: number,
    floorLevel: -1 | 0 | 1,
    withCanopy = false,
    rotY = 0
  ) => {
    const g = new THREE.Group();
    g.position.set(x, yBase, z);
    g.rotation.y = rotY;

    const frame = new THREE.Mesh(getBox(2.15, 0.14, 1.5), darkWoodMat);
    frame.position.y = 0.68;
    g.add(frame);

    const mattress = new THREE.Mesh(
      getBox(2.0, 0.16, 1.36),
      withCanopy ? crimsonClothMat : creamMattressMat
    );
    mattress.position.y = 0.82;
    g.add(mattress);

    // Carved teak headboard & bolster pillow
    const headboard = new THREE.Mesh(getBox(0.12, 1.05, 1.52), darkWoodMat);
    headboard.position.set(-1.04, 0.96, 0);
    g.add(headboard);

    const bolster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 1.12, 10),
      crimsonClothMat
    );
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(-0.78, 0.96, 0);
    g.add(bolster);

    const postH = withCanopy ? 2.35 : 1.08;
    [
      [-0.98, -0.66],
      [0.98, -0.66],
      [-0.98, 0.66],
      [0.98, 0.66],
    ].forEach(([px, pz]) => {
      const post = new THREE.Mesh(getBox(0.09, postH, 0.09), darkWoodMat);
      post.position.set(px, postH / 2, pz);
      g.add(post);
    });

    if (withCanopy) {
      // Draped crimson bridal canopy frame & valances
      const topFrame = new THREE.Mesh(getBox(2.14, 0.09, 1.48), darkWoodMat);
      topFrame.position.y = 2.34;
      g.add(topFrame);

      const drapeL = new THREE.Mesh(getBox(2.06, 0.42, 0.04), crimsonClothMat);
      drapeL.position.set(0, 2.12, 0.72);
      const drapeR = new THREE.Mesh(getBox(2.06, 0.42, 0.04), crimsonClothMat);
      drapeR.position.set(0, 2.12, -0.72);
      g.add(drapeL, drapeR);
    }

    root.add(g);

    const rotated = Math.abs(Math.sin(rotY)) > 0.7;
    const hw = rotated ? 0.78 : 1.12;
    const hd = rotated ? 1.12 : 0.78;
    colliders.push({
      minX: x - hw,
      maxX: x + hw,
      minZ: z - hd,
      maxZ: z + hd,
      crawlUnderY: 0.62,
      floorLevel,
      isCover: true,
    });
  };

  // =========================================================
  // ZONE 2: GROUND FLOOR HIDING FURNITURE UPGRADES (Y = 0)
  // =========================================================
  // Second carved Wooden Palang / Diwan in Master Bedroom (crawl-under hiding)
  createCarvedPalang(-10.8, 0, -5.2, 0, false, 0);

  // Heavy Wooden Dining / Prep Table in Old Kitchen (crawl-under hiding)
  const kitchenDiningTable = createWoodenTable(textures, 2.15, 1.05);
  kitchenDiningTable.position.set(11.4, 0, -4.6);
  root.add(kitchenDiningTable);
  colliders.push({
    minX: 11.4 - 1.12,
    maxX: 11.4 + 1.12,
    minZ: -4.6 - 0.56,
    maxZ: -4.6 + 0.56,
    crawlUnderY: 0.74,
    floorLevel: 0,
    isCover: true,
  });

  // Heavy Wooden Console Table in North Hallway / Corridor (crawl-under hiding)
  const hallTable = createWoodenTable(textures, 1.85, 0.92);
  hallTable.position.set(4.9, 0, -6.4);
  root.add(hallTable);
  colliders.push({
    minX: 4.9 - 0.96,
    maxX: 4.9 + 0.96,
    minZ: -6.4 - 0.5,
    maxZ: -6.4 + 0.5,
    crawlUnderY: 0.74,
    floorLevel: 0,
    isCover: true,
  });

  // =========================================================
  // ZONE 3: 1ST FLOOR (UPAR KI MANZIL, Y = 4.10m) + WOODEN STAIRS
  // =========================================================
  const F1 = FLOOR_1_Y;
  const F1_WALL_H = 3.7;
  const WT = 0.42;

  // --- 3A. GRAND WOODEN STAIRCASE (NE Corridor: x in [9.4..11.8], z: -8.4 -> -13.6) ---
  const stairStepCount = 16;
  const stairSpanZ = STAIRS_UP_BOUNDS.zBottom - STAIRS_UP_BOUNDS.zTop; // 5.2m
  const stairW = STAIRS_UP_BOUNDS.maxX - STAIRS_UP_BOUNDS.minX; // 2.4m
  const stairCenterX = (STAIRS_UP_BOUNDS.minX + STAIRS_UP_BOUNDS.maxX) * 0.5; // 10.6

  const stepD = stairSpanZ / stairStepCount;
  const stepH = F1 / stairStepCount;
  const stepGeo = getBox(stairW, stepH + 0.06, stepD + 0.04);

  for (let i = 0; i < stairStepCount; i++) {
    const sy = (i + 0.5) * stepH;
    const sz = STAIRS_UP_BOUNDS.zBottom - (i + 0.5) * stepD;
    const tread = new THREE.Mesh(stepGeo, woodMat);
    tread.position.set(stairCenterX, sy, sz);
    tread.receiveShadow = true;
    root.add(tread);
  }

  // Carved wooden stringers & sloped handrails on both sides of the staircase
  const stairHyp = Math.hypot(stairSpanZ, F1);
  const stairPitch = Math.atan2(F1, stairSpanZ);
  [STAIRS_UP_BOUNDS.minX + 0.08, STAIRS_UP_BOUNDS.maxX - 0.08].forEach((rx) => {
    const rail = new THREE.Mesh(getBox(0.11, 0.11, stairHyp), darkWoodMat);
    rail.position.set(rx, F1 * 0.5 + 0.92, (STAIRS_UP_BOUNDS.zBottom + STAIRS_UP_BOUNDS.zTop) * 0.5);
    rail.rotation.x = stairPitch;
    root.add(rail);

    const stringer = new THREE.Mesh(getBox(0.12, 0.34, stairHyp), darkWoodMat);
    stringer.position.set(rx, F1 * 0.5, (STAIRS_UP_BOUNDS.zBottom + STAIRS_UP_BOUNDS.zTop) * 0.5);
    stringer.rotation.x = stairPitch;
    root.add(stringer);

    for (let p = 0; p <= 4; p++) {
      const f = p / 4;
      const post = new THREE.Mesh(getBox(0.08, 0.96, 0.08), darkWoodMat);
      post.position.set(
        rx,
        f * F1 + 0.48,
        STAIRS_UP_BOUNDS.zBottom - f * stairSpanZ
      );
      root.add(post);
    }
  });

  // Subtle guiding side-wall colliders on Ground Floor so player enters stairs cleanly from south
  colliders.push({
    minX: STAIRS_UP_BOUNDS.minX - 0.14,
    maxX: STAIRS_UP_BOUNDS.minX + 0.04,
    minZ: STAIRS_UP_BOUNDS.zTop,
    maxZ: STAIRS_UP_BOUNDS.zBottom - 0.3,
    floorLevel: 0,
    isCover: true,
  });
  colliders.push({
    minX: STAIRS_UP_BOUNDS.maxX - 0.04,
    maxX: STAIRS_UP_BOUNDS.maxX + 0.14,
    minZ: STAIRS_UP_BOUNDS.zTop,
    maxZ: STAIRS_UP_BOUNDS.zBottom - 0.3,
    floorLevel: 0,
    isCover: true,
  });
  // Safety guardrail on 1st floor along sides & south edge of the stairwell opening
  colliders.push({
    minX: STAIRS_UP_BOUNDS.minX - 0.14,
    maxX: STAIRS_UP_BOUNDS.minX + 0.06,
    minZ: STAIRS_UP_BOUNDS.zTop + 0.25,
    maxZ: STAIRS_UP_BOUNDS.zBottom + 0.2,
    floorLevel: 1,
    isCover: true,
  });
  colliders.push({
    minX: STAIRS_UP_BOUNDS.maxX - 0.06,
    maxX: STAIRS_UP_BOUNDS.maxX + 0.14,
    minZ: STAIRS_UP_BOUNDS.zTop + 0.25,
    maxZ: STAIRS_UP_BOUNDS.zBottom + 0.2,
    floorLevel: 1,
    isCover: true,
  });
  colliders.push({
    minX: STAIRS_UP_BOUNDS.minX - 0.1,
    maxX: STAIRS_UP_BOUNDS.maxX + 0.1,
    minZ: STAIRS_UP_BOUNDS.zBottom - 0.1,
    maxZ: STAIRS_UP_BOUNDS.zBottom + 0.16,
    floorLevel: 1,
    isCover: true,
  });

  // Warm lantern hanging over the NE Staircase
  const stairLight = new THREE.PointLight(0xffa042, 2.2, 11, 1.7);
  stairLight.position.set(stairCenterX, F1 + 2.1, -11.0);
  stairLight.castShadow = false;
  root.add(stairLight);
  flickerLights.push({ light: stairLight, baseIntensity: 2.2, phase: 4.1 });

  // --- 3A-GATE: PHYSICAL LOCKABLE IRON GRILLE GATE AT FOOT OF 1ST FLOOR STAIRCASE ---
  const gateW = STAIRS_UP_BOUNDS.maxX - STAIRS_UP_BOUNDS.minX; // 2.4m
  const gateH = 2.68;
  const leafW = gateW * 0.5 - 0.04;
  const gateRoot = new THREE.Group();
  gateRoot.position.set(stairCenterX, 0, STAIRS_UP_BOUNDS.zBottom + 0.08);

  // Heavy arched iron side posts & top transom bar
  [-gateW * 0.5, gateW * 0.5].forEach((px) => {
    const post = new THREE.Mesh(getBox(0.14, gateH + 0.16, 0.16), rustedIronMat);
    post.position.set(px, (gateH + 0.16) * 0.5, 0);
    gateRoot.add(post);
  });
  const topBar = new THREE.Mesh(getBox(gateW + 0.2, 0.14, 0.16), rustedIronMat);
  topBar.position.set(0, gateH + 0.08, 0);
  gateRoot.add(topBar);

  const buildGrilleLeaf = (dir: 1 | -1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(dir === 1 ? -gateW * 0.5 + 0.04 : gateW * 0.5 - 0.04, 0, 0);

    // Outer leaf rails
    const topRail = new THREE.Mesh(getBox(leafW, 0.07, 0.06), rustedIronMat);
    topRail.position.set(dir * leafW * 0.5, gateH - 0.08, 0);
    const midRail = new THREE.Mesh(getBox(leafW, 0.07, 0.06), rustedIronMat);
    midRail.position.set(dir * leafW * 0.5, gateH * 0.48, 0);
    const botRail = new THREE.Mesh(getBox(leafW, 0.08, 0.06), rustedIronMat);
    botRail.position.set(dir * leafW * 0.5, 0.12, 0);
    const innerStile = new THREE.Mesh(getBox(0.07, gateH - 0.12, 0.06), rustedIronMat);
    innerStile.position.set(dir * (leafW - 0.03), gateH * 0.5, 0);
    pivot.add(topRail, midRail, botRail, innerStile);

    // 5 Vertical Iron Grille Bars + Gothic Finial Tips
    const barGeo = new THREE.CylinderGeometry(0.02, 0.02, gateH - 0.16, 6);
    const finialGeo = new THREE.ConeGeometry(0.036, 0.14, 5);
    for (let b = 0; b < 5; b++) {
      const frac = (b + 0.65) / 5.3;
      const bx = dir * frac * (leafW - 0.06);
      const bar = new THREE.Mesh(barGeo, rustedIronMat);
      bar.position.set(bx, gateH * 0.5, 0);
      const tip = new THREE.Mesh(finialGeo, rustedIronMat);
      tip.position.set(bx, gateH - 0.02, 0);
      pivot.add(bar, tip);
    }
    return pivot;
  };

  const gateLeftPivot = buildGrilleLeaf(1);
  const gateRightPivot = buildGrilleLeaf(-1);
  gateRoot.add(gateLeftPivot, gateRightPivot);

  // Heavy Wrapped Iron Chains & Brass-Iron Padlock (visible when Chapter locks 1st Floor)
  const gateChainGroup = new THREE.Group();
  gateChainGroup.position.set(0, gateH * 0.48, 0.055);
  const linkGeo = new THREE.TorusGeometry(0.045, 0.013, 5, 10);
  for (let i = -3; i <= 3; i++) {
    const link = new THREE.Mesh(linkGeo, rustedIronMat);
    link.position.set(i * 0.068, Math.abs(i) * 0.014 - 0.03, 0);
    link.rotation.y = i % 2 === 0 ? 0 : Math.PI * 0.45;
    gateChainGroup.add(link);
  }
  const gatePadlockBody = new THREE.Mesh(getBox(0.15, 0.18, 0.07), brassMat);
  gatePadlockBody.position.set(0, -0.14, 0.02);
  const gatePadlockShackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.052, 0.014, 6, 12, Math.PI),
    rustedIronMat
  );
  gatePadlockShackle.position.set(0, -0.05, 0.02);
  gateChainGroup.add(gatePadlockBody, gatePadlockShackle);
  gateRoot.add(gateChainGroup);
  root.add(gateRoot);

  const firstFloorGate: FirstFloorStairGateRig = {
    root: gateRoot,
    leftPivot: gateLeftPivot,
    rightPivot: gateRightPivot,
    lockChainGroup: gateChainGroup,
    interactPos: new THREE.Vector3(stairCenterX, 1.1, STAIRS_UP_BOUNDS.zBottom + 0.55),
    closedBox: {
      minX: STAIRS_UP_BOUNDS.minX - 0.15,
      maxX: STAIRS_UP_BOUNDS.maxX + 0.15,
      minZ: STAIRS_UP_BOUNDS.zBottom - 0.35,
      maxZ: STAIRS_UP_BOUNDS.zBottom + 0.35,
    },
    isLocked: true,
    isOpen: false,
    openAmount: 0,
    rattleTimer: 0,
  };

  // --- 3B. 1ST FLOOR OUTER WALLS, CEILING & CENTRAL AANGAN BALCONY GUARDRAILS ---
  addFloorWall(1, 0, -15, 30.4, WT, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 0, 15, 30.4, WT, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, -15, 0, WT, 30.4, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 15, 0, WT, 30.4, F1_WALL_H, F1, plasterMat);

  // 1st Floor perimeter roof slabs (leaving Central Aangan -5.2..5.2 open to the moonlit sky!)
  const addUpperRoof = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(getBox(w, 0.28, d), ceilingMat);
    m.position.set(x, F1 + F1_WALL_H + 0.12, z);
    root.add(m);
  };
  addUpperRoof(0, -10.2, 30.4, 9.9);
  addUpperRoof(0, 10.2, 30.4, 9.9);
  addUpperRoof(-10.2, 0, 9.9, 10.6);
  addUpperRoof(10.2, 0, 9.9, 10.6);

  // Solid balcony guardrails on 1st floor around Central Aangan (-5.2..5.2) so player can look down safely
  colliders.push({ minX: -5.3, maxX: 5.3, minZ: -5.35, maxZ: -5.0, floorLevel: 1, isCover: true });
  colliders.push({ minX: -5.3, maxX: 5.3, minZ: 5.0, maxZ: 5.35, floorLevel: 1, isCover: true });
  colliders.push({ minX: -5.35, maxX: -5.0, minZ: -5.3, maxZ: 5.3, floorLevel: 1, isCover: true });
  colliders.push({ minX: 5.0, maxX: 5.35, minZ: -5.3, maxZ: 5.3, floorLevel: 1, isCover: true });

  // --- 3C. 1ST FLOOR INTERIOR ROOM PARTITIONS ---
  // North Wing: Thakur Study / Library (x: -7.5..7.5, z: -15..-7.5) with wide center doorway & east staircase access
  addFloorWall(1, -4.6, -7.5, 5.4, WT, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 4.6, -7.5, 5.4, WT, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, -7.5, -10.0, WT, 5.0, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 7.5, -9.2, WT, 3.4, F1_WALL_H, F1, plasterMat);

  // West Wing: Bridal Chamber (Dulhan Ka Kamra, x: -15..-7.5, z: -7.5..7.5)
  addFloorWall(1, -7.5, -4.4, WT, 4.4, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, -7.5, 4.4, WT, 4.4, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, -12.2, -7.5, 5.6, WT, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, -12.2, 7.5, 5.6, WT, F1_WALL_H, F1, plasterMat);

  // East Wing: Guest Room (Mehmaan Kamra, x: 7.5..15, z: -6.8..7.5)
  addFloorWall(1, 7.5, -4.4, WT, 4.4, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 7.5, 4.4, WT, 4.4, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 12.6, -7.5, 4.8, WT, F1_WALL_H, F1, plasterMat);
  addFloorWall(1, 12.2, 7.5, 5.6, WT, F1_WALL_H, F1, plasterMat);

  // South Terrace Balcony Pillars (open colonnade overlooking South wing)
  [-4.5, 4.5].forEach((px) => {
    addFloorWall(1, px, 7.5, 0.55, 0.55, F1_WALL_H, F1, plasterMat);
  });

  // --- 3D. THAKUR STUDY / LIBRARY PROPS (North Wing, Y = F1) ---
  // Bookshelves along West and East Study Walls
  const bookColors = [0x6e2323, 0x263f52, 0x3b4d2b, 0x6b5228, 0x4b2a47];
  const bookMats = bookColors.map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.86 })
  );

  const addBookshelf = (bx: number, bz: number, rotY: number) => {
    const shelf = new THREE.Group();
    shelf.position.set(bx, F1, bz);
    shelf.rotation.y = rotY;
    const frame = new THREE.Mesh(getBox(2.2, 2.55, 0.48), darkWoodMat);
    frame.position.y = 1.275;
    shelf.add(frame);

    for (let row = 0; row < 4; row++) {
      const ry = 0.42 + row * 0.56;
      for (let b = 0; b < 5; b++) {
        const book = new THREE.Mesh(
          getBox(0.32, 0.34 + ((b + row) % 2) * 0.06, 0.3),
          bookMats[(row * 5 + b) % bookMats.length]
        );
        book.position.set(-0.78 + b * 0.39, ry, 0.14);
        shelf.add(book);
      }
    }
    root.add(shelf);
    const rot90 = Math.abs(Math.sin(rotY)) > 0.7;
    colliders.push({
      minX: bx - (rot90 ? 0.32 : 1.15),
      maxX: bx + (rot90 ? 0.32 : 1.15),
      minZ: bz - (rot90 ? 1.15 : 0.32),
      maxZ: bz + (rot90 ? 1.15 : 0.32),
      floorLevel: 1,
      isCover: true,
    });
  };
  addBookshelf(-6.9, -11.4, Math.PI / 2);
  addBookshelf(6.9, -11.4, -Math.PI / 2);
  addBookshelf(-4.2, -14.4, 0);
  addBookshelf(4.2, -14.4, 0);

  // Secret Wall Panel in Center North Library Wall (slightly recessed carved wood panel)
  const secretPanel = new THREE.Mesh(getBox(2.1, 2.5, 0.14), darkWoodMat);
  secretPanel.position.set(0, F1 + 1.25, -14.72);
  root.add(secretPanel);
  const secretTrim = new THREE.Mesh(getBox(2.28, 2.66, 0.08), brassMat);
  secretTrim.position.set(0, F1 + 1.25, -14.76);
  root.add(secretTrim);

  // Thakur Study Desk (crawl-under clearance 0.74m) + Brass Lamp
  const studyDesk = createWoodenTable(textures, 2.2, 1.05);
  studyDesk.position.set(0, F1, -11.4);
  root.add(studyDesk);
  colliders.push({
    minX: -1.14,
    maxX: 1.14,
    minZ: -11.96,
    maxZ: -10.84,
    crawlUnderY: 0.74,
    floorLevel: 1,
    isCover: true,
  });

  const studyLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 10), brassMat);
  studyLampBase.position.set(0.65, F1 + 0.96, -11.35);
  root.add(studyLampBase);
  const studyLight = new THREE.PointLight(0xffb452, 2.3, 12, 1.7);
  studyLight.position.set(0.65, F1 + 1.35, -11.35);
  studyLight.castShadow = false;
  root.add(studyLight);
  flickerLights.push({ light: studyLight, baseIntensity: 2.3, phase: 0.9 });

  // --- 3E. BRIDAL CHAMBER (DULHAN KA KAMRA — West Wing, Y = F1) ---
  // Crimson 4-poster Canopy Bed (crawl-under clearance 0.62m)
  createCarvedPalang(-12.6, F1, -0.6, 1, true, 0);

  // Large Antique Brass-Framed Mirror on North Bridal Wall
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(-11.2, F1 + 1.45, -7.12);
  const mirrorFrame = new THREE.Mesh(getBox(1.5, 2.35, 0.1), brassMat);
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 2.08),
    new THREE.MeshStandardMaterial({
      color: 0x8eaeb5,
      roughness: 0.08,
      metalness: 0.94,
    })
  );
  mirrorGlass.position.z = 0.056;
  mirrorGroup.add(mirrorFrame, mirrorGlass);
  root.add(mirrorGroup);

  // Antique Dressing Table with Crimson Sindoor Box & Flickering Diya
  const dressingTable = createWoodenTable(textures, 1.55, 0.72);
  dressingTable.position.set(-11.4, F1, 5.4);
  root.add(dressingTable);
  colliders.push({
    minX: -12.22,
    maxX: -10.58,
    minZ: 5.0,
    maxZ: 5.8,
    crawlUnderY: 0.72,
    floorLevel: 1,
    isCover: true,
  });

  const bridalLight = new THREE.PointLight(0xff7852, 2.1, 11.5, 1.7);
  bridalLight.position.set(-11.4, F1 + 1.25, 5.2);
  bridalLight.castShadow = false;
  root.add(bridalLight);
  flickerLights.push({ light: bridalLight, baseIntensity: 2.1, phase: 2.3 });

  // Moonlight window in Bridal Chamber
  const bridalWin = createMoonlightWindow(textures);
  bridalWin.position.set(-14.74, F1 + 1.95, 2.4);
  bridalWin.rotation.y = Math.PI / 2;
  root.add(bridalWin);

  // --- 3F. GUEST ROOM (MEHMAAN KAMRA — East Wing, Y = F1) ---
  createCarvedPalang(12.6, F1, 0.8, 1, false, Math.PI);

  // Antique Guest Wardrobe along East Wall
  const guestWardrobe = new THREE.Mesh(getBox(0.82, 2.4, 1.48), darkWoodMat);
  guestWardrobe.position.set(14.3, F1 + 1.2, -4.1);
  root.add(guestWardrobe);
  colliders.push({
    minX: 13.85,
    maxX: 14.78,
    minZ: -4.88,
    maxZ: -3.32,
    floorLevel: 1,
    isCover: true,
  });

  const guestWin = createMoonlightWindow(textures);
  guestWin.position.set(14.74, F1 + 1.95, 3.8);
  guestWin.rotation.y = -Math.PI / 2;
  root.add(guestWin);

  const guestLight = new THREE.PointLight(0xffa852, 1.85, 10.5, 1.75);
  guestLight.position.set(11.4, F1 + 1.4, 3.6);
  guestLight.castShadow = false;
  root.add(guestLight);
  flickerLights.push({ light: guestLight, baseIntensity: 1.85, phase: 5.4 });

  // =========================================================
  // ZONE 4: UNDERGROUND BASEMENT (TAHKHANA, Y = -4.20m)
  // =========================================================
  const BM = BASEMENT_Y;
  const BM_H = 3.85;

  // --- 4A. STONE TRAPDOOR & DESCENDING STONE STAIRS (SW Back Corridor: x in [-11.8..-9.4], z: 8.4 -> 13.6) ---
  const bStairCenterX = (STAIRS_DOWN_BOUNDS.minX + STAIRS_DOWN_BOUNDS.maxX) * 0.5; // -10.6
  const bStairW = STAIRS_DOWN_BOUNDS.maxX - STAIRS_DOWN_BOUNDS.minX; // 2.4
  const bStairSpanZ = STAIRS_DOWN_BOUNDS.zBottom - STAIRS_DOWN_BOUNDS.zTop; // 5.2
  const bStepCount = 16;
  const bStepD = bStairSpanZ / bStepCount;
  const bStepH = Math.abs(BM) / bStepCount;
  const bStepGeo = getBox(bStairW, bStepH + 0.08, bStepD + 0.04);

  for (let i = 0; i < bStepCount; i++) {
    const sy = -(i + 0.5) * bStepH;
    const sz = STAIRS_DOWN_BOUNDS.zTop + (i + 0.5) * bStepD;
    const step = new THREE.Mesh(bStepGeo, dampStoneMat);
    step.position.set(bStairCenterX, sy, sz);
    step.receiveShadow = true;
    root.add(step);
  }

  // Stone stairwell side walls guiding down from Ground Floor to Tahkhana
  [STAIRS_DOWN_BOUNDS.minX - 0.12, STAIRS_DOWN_BOUNDS.maxX + 0.12].forEach((sx) => {
    const sideWall = new THREE.Mesh(getBox(0.24, Math.abs(BM) + 0.4, bStairSpanZ + 0.4), dampStoneMat);
    sideWall.position.set(sx, BM * 0.5, (STAIRS_DOWN_BOUNDS.zTop + STAIRS_DOWN_BOUNDS.zBottom) * 0.5);
    root.add(sideWall);
  });

  // Ground floor stone parapet curb around West/East/South edges of trapdoor pit
  colliders.push({
    minX: STAIRS_DOWN_BOUNDS.minX - 0.18,
    maxX: STAIRS_DOWN_BOUNDS.minX + 0.04,
    minZ: STAIRS_DOWN_BOUNDS.zTop + 0.2,
    maxZ: STAIRS_DOWN_BOUNDS.zBottom + 0.25,
    floorLevel: 0,
    isCover: true,
  });
  colliders.push({
    minX: STAIRS_DOWN_BOUNDS.maxX - 0.04,
    maxX: STAIRS_DOWN_BOUNDS.maxX + 0.18,
    minZ: STAIRS_DOWN_BOUNDS.zTop + 0.2,
    maxZ: STAIRS_DOWN_BOUNDS.zBottom + 0.25,
    floorLevel: 0,
    isCover: true,
  });

  // Hinged Heavy Chained Stone & Iron Trapdoor at top of SW stairs
  const trapdoorRoot = new THREE.Group();
  trapdoorRoot.position.set(bStairCenterX, 0.04, STAIRS_DOWN_BOUNDS.zTop);
  const trapFrame = new THREE.Mesh(getBox(bStairW + 0.36, 0.1, 0.24), dampStoneMat);
  trapdoorRoot.add(trapFrame);

  const trapdoorPivot = new THREE.Group();
  trapdoorPivot.position.set(bStairW * 0.5, 0.03, 1.35);
  const trapLeaf = new THREE.Mesh(getBox(bStairW - 0.04, 0.11, 2.75), dampStoneMat);
  trapLeaf.position.set(-bStairW * 0.5, 0, 0);
  const trapTimberInset = new THREE.Mesh(getBox(bStairW - 0.34, 0.125, 2.38), darkWoodMat);
  trapTimberInset.position.set(-bStairW * 0.5, 0, 0);
  const trapBand1 = new THREE.Mesh(getBox(bStairW - 0.02, 0.14, 0.16), rustedIronMat);
  trapBand1.position.set(-bStairW * 0.5, 0, -0.82);
  const trapBand2 = new THREE.Mesh(getBox(bStairW - 0.02, 0.14, 0.16), rustedIronMat);
  trapBand2.position.set(-bStairW * 0.5, 0, 0.82);
  const trapRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.024, 6, 12), rustedIronMat);
  trapRing.rotation.x = Math.PI / 2;
  trapRing.position.set(-bStairW + 0.3, 0.07, 0);
  trapdoorPivot.add(trapLeaf, trapTimberInset, trapBand1, trapBand2, trapRing);
  trapdoorPivot.rotation.z = 0; // Chapter config controls initial locked/open state
  trapdoorRoot.add(trapdoorPivot);

  // Heavy Crisscrossed Iron Chains & Padlock sealing the Stone Trapdoor when locked
  const trapChainGroup = new THREE.Group();
  trapChainGroup.position.set(0, 0.13, 1.35);
  const chainLinkGeo = new THREE.TorusGeometry(0.052, 0.016, 5, 10);
  for (let diag = -1; diag <= 1; diag += 2) {
    for (let s = -6; s <= 6; s++) {
      const f = s / 6;
      const link = new THREE.Mesh(chainLinkGeo, rustedIronMat);
      link.position.set(f * (bStairW * 0.48), 0.02, f * diag * 1.18);
      link.rotation.x = Math.PI * 0.5;
      link.rotation.z = s % 2 === 0 ? 0.35 : -0.35;
      trapChainGroup.add(link);
    }
  }
  const trapPadlock = new THREE.Mesh(getBox(0.2, 0.11, 0.24), brassMat);
  trapPadlock.position.set(0, 0.05, 0);
  const trapShackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI),
    rustedIronMat
  );
  trapShackle.rotation.x = Math.PI * 0.5;
  trapShackle.position.set(0, 0.05, -0.11);
  trapChainGroup.add(trapPadlock, trapShackle);
  trapdoorRoot.add(trapChainGroup);
  root.add(trapdoorRoot);

  const trapdoor: BasementTrapdoorRig = {
    root: trapdoorRoot,
    doorPivot: trapdoorPivot,
    lockChainGroup: trapChainGroup,
    interactPos: new THREE.Vector3(bStairCenterX, 0.45, STAIRS_DOWN_BOUNDS.zTop - 0.38),
    lockedBox: {
      minX: STAIRS_DOWN_BOUNDS.minX - 0.16,
      maxX: STAIRS_DOWN_BOUNDS.maxX + 0.16,
      minZ: STAIRS_DOWN_BOUNDS.zTop - 0.12,
      maxZ: STAIRS_DOWN_BOUNDS.zBottom + 0.25,
    },
    isLocked: true,
    isOpen: false,
    openAmount: 0,
    rattleTimer: 0,
  };

  // --- 4B. TAHKHANA FLOOR, VAULTED CEILING & PERIMETER WALLS ---
  const bmFloor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), dampStoneMat);
  bmFloor.rotation.x = -Math.PI / 2;
  bmFloor.position.y = BM;
  bmFloor.receiveShadow = true;
  root.add(bmFloor);

  // Basement ceiling (y = -0.35, below ground slab, leaving stairwell cut open at SW)
  const addBmCeil = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(getBox(w, 0.22, d), dampStoneMat);
    m.position.set(x, -0.34, z);
    root.add(m);
  };
  addBmCeil(0, -3.5, 30, 23.2); // North & center ceiling (z: -15.1..+8.1)
  addBmCeil(2.9, 11.4, 24.4, 7.2); // South-East & South-Center ceiling (x: -9.3..+15.1)
  addBmCeil(-13.4, 11.4, 3.2, 7.2); // Far SW ceiling west of stairwell

  // Outer Tahkhana Stone Walls
  addFloorWall(-1, 0, -14.8, 30.0, WT, BM_H, BM, dampStoneMat);
  addFloorWall(-1, 0, 14.8, 30.0, WT, BM_H, BM, dampStoneMat);
  addFloorWall(-1, -14.8, 0, WT, 30.0, BM_H, BM, dampStoneMat);
  addFloorWall(-1, 14.8, 0, WT, 30.0, BM_H, BM, dampStoneMat);

  // --- 4C. SIX HEAVY MOSSY STONE PILLARS ---
  const bmPillars: Array<[number, number]> = [
    [-4.6, -2.5],
    [4.6, -2.5],
    [-4.6, 3.5],
    [4.6, 3.5],
    [-4.6, 9.5],
    [4.6, 9.5],
  ];
  bmPillars.forEach(([px, pz]) => {
    const shaft = new THREE.Mesh(getBox(0.95, BM_H, 0.95), dampStoneMat);
    shaft.position.set(px, BM + BM_H / 2, pz);
    root.add(shaft);
    const plinth = new THREE.Mesh(getBox(1.22, 0.32, 1.22), dampStoneMat);
    plinth.position.set(px, BM + 0.16, pz);
    root.add(plinth);
    colliders.push({
      minX: px - 0.56,
      maxX: px + 0.56,
      minZ: pz - 0.56,
      maxZ: pz + 0.56,
      floorLevel: -1,
      isCover: true,
    });
  });

  // --- 4D. PRISON CELLS WITH RUSTED BARS & HANGING CHAINS (West Wing, Y = BM) ---
  const cellZCenters = [-6.2, -1.6, 3.0];
  cellZCenters.forEach((cz, idx) => {
    // Cell divider walls
    addFloorWall(-1, -11.4, cz - 2.3, 6.4, 0.34, BM_H, BM, dampStoneMat);
    if (idx === cellZCenters.length - 1) {
      addFloorWall(-1, -11.4, cz + 2.3, 6.4, 0.34, BM_H, BM, dampStoneMat);
    }

    // Iron bar front gate along x = -8.2 (middle cell slightly ajar so player can peek/enter!)
    const barCount = 7;
    for (let b = 0; b < barCount; b++) {
      if (idx === 1 && (b === 3 || b === 4)) continue; // Open doorway into middle cell
      const bz = cz - 1.9 + (b / (barCount - 1)) * 3.8;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, BM_H, 6), rustedIronMat);
      bar.position.set(-8.2, BM + BM_H / 2, bz);
      root.add(bar);
    }
    if (idx !== 1) {
      colliders.push({
        minX: -8.36,
        maxX: -8.04,
        minZ: cz - 2.2,
        maxZ: cz + 2.2,
        floorLevel: -1,
        isCover: true,
      });
    }

    // Hanging rusted iron ceiling chains inside each cell
    [-12.6, -10.4].forEach((cx) => {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.9, 6), rustedIronMat);
      chain.position.set(cx, BM + BM_H - 0.95, cz);
      root.add(chain);
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 6, 10), rustedIronMat);
      shackle.position.set(cx, BM + BM_H - 1.95, cz);
      root.add(shackle);
    });
  });

  // --- 4E. SUBTERRANEAN WELLSPRING (PAATAL JAL — East Wing, Y = BM) ---
  const wellCenterX = 10.6;
  const wellCenterZ = 0.6;
  const wellBasinWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.85, 3.05, 0.82, 12, 1, true),
    dampStoneMat
  );
  wellBasinWall.position.set(wellCenterX, BM + 0.41, wellCenterZ);
  wellBasinWall.material = dampStoneMat;
  root.add(wellBasinWall);

  const wellRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.85, 0.22, 8, 16),
    dampStoneMat
  );
  wellRim.rotation.x = Math.PI / 2;
  wellRim.position.set(wellCenterX, BM + 0.8, wellCenterZ);
  root.add(wellRim);

  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(2.74, 18),
    new THREE.MeshStandardMaterial({
      color: 0x1e6674,
      emissive: 0x0e3d47,
      emissiveIntensity: 0.72,
      roughness: 0.14,
      metalness: 0.25,
    })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(wellCenterX, BM + 0.56, wellCenterZ);
  root.add(waterMesh);

  colliders.push({
    minX: wellCenterX - 2.9,
    maxX: wellCenterX + 2.9,
    minZ: wellCenterZ - 2.9,
    maxZ: wellCenterZ + 2.9,
    floorLevel: -1,
    isCover: true,
  });

  const wellLight = new THREE.PointLight(0x3ba8bc, 2.2, 11.5, 1.65);
  wellLight.position.set(wellCenterX, BM + 1.8, wellCenterZ);
  wellLight.castShadow = false;
  root.add(wellLight);
  flickerLights.push({ light: wellLight, baseIntensity: 2.2, phase: 3.1 });

  // --- 4F. ANCIENT TANTRIK RITUAL CHAMBER (North Wing, Y = BM) ---
  // Separating archway walls framing the Tantrik Chamber (z = -5.6)
  addFloorWall(-1, -4.8, -5.6, 5.2, WT, BM_H, BM, dampStoneMat);
  addFloorWall(-1, 4.8, -5.6, 5.2, WT, BM_H, BM, dampStoneMat);

  // Glowing Crimson Tantrik Yantra Mandala on the damp stone floor
  const yantraRing = new THREE.Mesh(
    new THREE.RingGeometry(2.3, 2.62, 32),
    new THREE.MeshBasicMaterial({
      color: 0xd9362b,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  yantraRing.rotation.x = -Math.PI / 2;
  yantraRing.position.set(0, BM + 0.03, -10.4);
  root.add(yantraRing);

  const innerYantra = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.3, 6),
    new THREE.MeshBasicMaterial({
      color: 0xff6e40,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  innerYantra.rotation.x = -Math.PI / 2;
  innerYantra.position.set(0, BM + 0.035, -10.4);
  root.add(innerYantra);

  // Dark Basalt Tantrik Ritual Altar in center of Mandala
  const altarBase = new THREE.Mesh(getBox(1.9, 0.92, 1.15), dampStoneMat);
  altarBase.position.set(0, BM + 0.46, -10.4);
  root.add(altarBase);
  const altarCloth = new THREE.Mesh(getBox(1.94, 0.06, 1.19), crimsonClothMat);
  altarCloth.position.set(0, BM + 0.94, -10.4);
  root.add(altarCloth);
  colliders.push({
    minX: -1.0,
    maxX: 1.0,
    minZ: -11.02,
    maxZ: -9.78,
    floorLevel: -1,
    isCover: true,
  });

  // 4 Flickering Ritual Braziers around the Tantrik Chamber + 1 Stairway Torch
  const brazierCoords: Array<[number, number, number]> = [
    [-3.1, BM, -8.2],
    [3.1, BM, -8.2],
    [-3.1, BM, -12.6],
    [3.1, BM, -12.6],
    [bStairCenterX + 1.1, BM + 1.8, 12.2],
  ];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6828 });
  brazierCoords.forEach(([bx, by, bz], idx) => {
    if (idx < 4) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.16, 0.68, 8), rustedIronMat);
      bowl.position.set(bx, by + 0.34, bz);
      root.add(bowl);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 7), flameMat);
      flame.position.set(bx, by + 0.82, bz);
      root.add(flame);
      if (!isLowQuality || idx < 2) {
        const l = new THREE.PointLight(0xff5226, 2.35, 11.5, 1.7);
        l.position.set(bx, by + 1.25, bz);
        l.castShadow = false;
        root.add(l);
        flickerLights.push({ light: l, baseIntensity: 2.35, phase: idx * 1.4, flame });
      }
    } else {
      const stairTorch = new THREE.PointLight(0xff8a36, 2.2, 11, 1.7);
      stairTorch.position.set(bx, by, bz);
      stairTorch.castShadow = false;
      root.add(stairTorch);
      flickerLights.push({ light: stairTorch, baseIntensity: 2.2, phase: 6.2 });
    }
  });

  return {
    firstFloorGate,
    trapdoor,
    colliders,
    flickerLights,
    waterMesh,
    yantraRing,
  };
}
