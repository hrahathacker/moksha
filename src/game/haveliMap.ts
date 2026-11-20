import * as THREE from 'three';
import {
  AlmirahRig,
  HavanKundRig,
  HingedDoorRig,
  createAlmirah,
  createCarvedPillarWithBell,
  createHavanKund,
  createHingedHaveliDoor,
  createMoonlightWindow,
  createRitualItemModel,
  createRustedIronGate,
  createWoodenTable,
} from './models';
import { ProceduralTexturePack } from './textures';
import { ChapterNumber, LORE_NOTES, LoreNoteData, PlayerStance, RitualItemId } from './types';

export interface AABBCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** If set, player with (feetY + bodyHeight <= crawlUnderY) can crawl underneath (tables, charpai) */
  crawlUnderY?: number;
  /** If set, jumping player with (feetY >= maxY - 0.14) clears this low obstacle */
  maxY?: number;
  /** Grants stealth cover when crouching/proning adjacent or underneath */
  isCover?: boolean;
}

export interface StealthCoverCheck {
  underFurniture: boolean;
  nearCover: boolean;
}

export interface RitualWorldItem {
  id: RitualItemId;
  room: string;
  position: THREE.Vector3;
  group: THREE.Group;
  auraRing: THREE.Mesh;
  flameMesh?: THREE.Mesh;
  collected: boolean;
  placed: boolean;
}

export interface WorldNoteProp {
  data: LoreNoteData;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  auraRing: THREE.Mesh;
  read: boolean;
}

export interface ShrineDiyaProp {
  id: string;
  room: string;
  position: THREE.Vector3;
  group: THREE.Group;
  flameMesh: THREE.Mesh;
  light: THREE.PointLight | null;
  auraRing: THREE.Mesh;
  lit: boolean;
}

export interface ChapterBellProp {
  id: string;
  orderIndex: number; // 0..3
  room: string;
  label: string;
  position: THREE.Vector3;
  group: THREE.Group;
  bellPivot: THREE.Group;
  auraRing: THREE.Mesh;
  rung: boolean;
  swingVelocity: number;
  swingAngle: number;
}

export interface CursedSealProp {
  id: string;
  room: string;
  position: THREE.Vector3;
  group: THREE.Group;
  talismanMesh: THREE.Mesh;
  auraRing: THREE.Mesh;
  light: THREE.PointLight | null;
  broken: boolean;
}

export interface WaypointNode {
  id: number;
  pos: THREE.Vector3;
  neighbors: number[];
  room: string;
}

export interface HaveliWorld {
  root: THREE.Group;
  colliders: AABBCollider[];
  havanKund: HavanKundRig;
  almirahs: AlmirahRig[];
  hingedDoors: HingedDoorRig[];
  ritualItems: RitualWorldItem[];
  notes: WorldNoteProp[];
  shrineDiyas: ShrineDiyaProp[];
  chapterBells: ChapterBellProp[];
  cursedSeals: CursedSealProp[];
  waypoints: WaypointNode[];
  flickerLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number; flame?: THREE.Mesh }>;
  emberEmitters: THREE.Vector3[];
  getRoomName: (x: number, z: number) => string;
  hasLineOfSight: (a: THREE.Vector3, b: THREE.Vector3) => boolean;
  resolvePlayerCollision: (
    pos: THREE.Vector3,
    radius: number,
    feetY?: number,
    bodyHeight?: number,
    ignoreDoors?: boolean
  ) => void;
  hasHeadroomAt: (x: number, z: number, radius: number, targetHeight: number) => boolean;
  evaluateStealthCover: (x: number, z: number, stance: PlayerStance, out: StealthCoverCheck) => StealthCoverCheck;
  applyQualityMaterials: (isLowQuality: boolean) => void;
  randomizeItemSpawns: () => void;
  configureForChapter: (chapter: ChapterNumber) => void;
}

interface ItemSpawnSlot {
  room: string;
  pos: THREE.Vector3;
}

const ITEM_SPAWN_POOL: ItemSpawnSlot[] = [
  { room: 'Pooja Room', pos: new THREE.Vector3(0, 0.82, -13.6) },
  { room: 'Pooja Room', pos: new THREE.Vector3(3.6, 0.82, -11.4) },
  { room: 'Master Bedroom', pos: new THREE.Vector3(-13.4, 0.82, -3.4) },
  { room: 'Master Bedroom', pos: new THREE.Vector3(-11.2, 0.82, 3.3) },
  { room: 'Old Kitchen', pos: new THREE.Vector3(13.4, 0.82, -2.9) },
  { room: 'Old Kitchen', pos: new THREE.Vector3(11.6, 0.82, 3.2) },
  { room: 'Storeroom', pos: new THREE.Vector3(-3.6, 0.82, 13.3) },
  { room: 'Storeroom', pos: new THREE.Vector3(3.6, 0.82, 12.8) },
];

export function buildHaveliWorld(
  textures: ProceduralTexturePack,
  isLowQuality: boolean
): HaveliWorld {
  const root = new THREE.Group();
  const colliders: AABBCollider[] = [];
  const flickerLights: HaveliWorld['flickerLights'] = [];

  const WALL_H = 3.85;
  const WALL_T = 0.42;

  // Shared PBR Materials with calibrated diffuse + bump + roughness maps (High vs Low toggleable)
  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plasterColor,
    bumpMap: textures.plasterBump,
    bumpScale: isLowQuality ? 0.035 : 0.068,
    roughnessMap: isLowQuality ? null : textures.plasterRoughness,
    roughness: 0.92,
    metalness: 0.04,
  });

  const stoneFloorRoughness = textures.stoneRoughness.clone();
  stoneFloorRoughness.repeat.set(9, 9);
  stoneFloorRoughness.needsUpdate = true;

  const stoneFloorMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor.clone(),
    bumpMap: textures.stoneBump.clone(),
    bumpScale: isLowQuality ? 0.028 : 0.052,
    roughnessMap: isLowQuality ? null : stoneFloorRoughness,
    roughness: 0.88,
    metalness: 0.08,
  });
  stoneFloorMat.map!.repeat.set(9, 9);
  stoneFloorMat.bumpMap!.repeat.set(9, 9);

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: isLowQuality ? 0.024 : 0.042,
    roughnessMap: isLowQuality ? null : textures.woodRoughness,
    roughness: 0.86,
    metalness: 0.06,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x1a1512,
    map: textures.woodColor,
    roughness: 0.94,
    metalness: 0.04,
  });

  const applyQualityMaterials = (lowQuality: boolean) => {
    plasterMat.roughnessMap = lowQuality ? null : textures.plasterRoughness;
    plasterMat.bumpScale = lowQuality ? 0.035 : 0.068;
    plasterMat.needsUpdate = true;

    stoneFloorMat.roughnessMap = lowQuality ? null : stoneFloorRoughness;
    stoneFloorMat.bumpScale = lowQuality ? 0.028 : 0.052;
    stoneFloorMat.needsUpdate = true;

    woodMat.roughnessMap = lowQuality ? null : textures.woodRoughness;
    woodMat.bumpScale = lowQuality ? 0.024 : 0.042;
    woodMat.needsUpdate = true;
  };

  const jaliMat = new THREE.MeshStandardMaterial({
    map: textures.jaliColor,
    alphaMap: textures.jaliAlpha,
    transparent: true,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.84,
  });

  const tapestryMat = new THREE.MeshStandardMaterial({
    map: textures.tapestryColor,
    roughness: 0.92,
    metalness: 0.05,
  });

  // Shared BoxGeometry cache so identical walls, beams, trim & props share GPU buffers
  const boxGeoCache = new Map<string, THREE.BoxGeometry>();
  const getBoxGeo = (w: number, h: number, d: number): THREE.BoxGeometry => {
    const key = `${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
    let geo = boxGeoCache.get(key);
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d);
      boxGeoCache.set(key, geo);
    }
    return geo;
  };
  const sharedCorbelGeo = getBoxGeo(0.24, 0.44, 0.46);

  // Helper to add a wall segment with automatic collision AABB
  const addWall = (
    x: number,
    z: number,
    w: number,
    d: number,
    h = WALL_H,
    yBase = 0,
    solid = true,
    mat: THREE.Material = plasterMat
  ) => {
    const mesh = new THREE.Mesh(getBoxGeo(w, h, d), mat);
    mesh.position.set(x, yBase + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    if (solid && yBase < 1.5) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        isCover: true,
      });
    }
    return mesh;
  };

  // Helper to add ornate Mughal arch lintel header over doorways (matching Reference 3)
  const addArchHeader = (x: number, z: number, span: number, rotatedY = false) => {
    const header = new THREE.Group();
    header.position.set(x, 0, z);
    if (rotatedY) header.rotation.y = Math.PI / 2;

    const topBeam = new THREE.Mesh(getBoxGeo(span + 0.2, 0.92, 0.44), plasterMat);
    topBeam.position.y = WALL_H - 0.46;
    header.add(topBeam);

    // Scalloped dark wood arch trim moldings
    const trim = new THREE.Mesh(getBoxGeo(span, 0.14, 0.48), woodMat);
    trim.position.y = WALL_H - 0.92;
    header.add(trim);

    [-span / 2 + 0.14, span / 2 - 0.14].forEach((sx) => {
      const corbel = new THREE.Mesh(sharedCorbelGeo, woodMat);
      corbel.position.set(sx, WALL_H - 1.12, 0);
      corbel.rotation.z = sx < 0 ? 0.35 : -0.35;
      header.add(corbel);
    });

    root.add(header);
  };

  // =========================================================
  // 1. FLOOR & CEILING (OPEN NIGHT SKY ABOVE CENTRAL AANGAN)
  // =========================================================
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), stoneFloorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // Roof slabs around perimeter leaving central Aangan (-5.2..5.2, -5.2..5.2) open to moonlit sky!
  const addRoof = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), ceilingMat);
    m.position.set(x, WALL_H + 0.12, z);
    root.add(m);
  };
  addRoof(0, -10.6, 32, 10.8); // North wing + North veranda
  addRoof(0, 10.6, 32, 10.8);  // South wing + South veranda
  addRoof(-10.6, 0, 10.8, 10.4); // West wing + West veranda
  addRoof(10.6, 0, 10.8, 10.4);  // East wing + East veranda

  // Double-height upper courtyard walls + ornate carved jali balustrade balcony (matching Reference 1)
  const upperBalconyY = WALL_H + 0.15;
  const balconyH = 1.45;
  const sharedJaliPlaneGeo = new THREE.PlaneGeometry(10.4, balconyH);
  const sharedBalconyRailGeo = getBoxGeo(10.55, 0.12, 0.18);
  const sharedBalconyLedgeGeo = getBoxGeo(10.6, 0.22, 0.35);
  const sharedUpperWallGeo = getBoxGeo(12.8, 3.2, 0.3);

  const addUpperCourtyardEdge = (x: number, z: number, _len: number, rotY: number) => {
    const g = new THREE.Group();
    g.position.set(x, upperBalconyY, z);
    g.rotation.y = rotY;

    const jali = new THREE.Mesh(sharedJaliPlaneGeo, jaliMat);
    jali.position.y = balconyH / 2;
    g.add(jali);

    const rail = new THREE.Mesh(sharedBalconyRailGeo, woodMat);
    rail.position.y = balconyH + 0.04;
    g.add(rail);

    const baseLedge = new THREE.Mesh(sharedBalconyLedgeGeo, plasterMat);
    baseLedge.position.y = 0;
    g.add(baseLedge);

    const upperWall = new THREE.Mesh(sharedUpperWallGeo, plasterMat);
    upperWall.position.set(0, 1.5, -1.6);
    g.add(upperWall);

    root.add(g);
  };
  addUpperCourtyardEdge(0, -5.2, 10.4, 0);
  addUpperCourtyardEdge(0, 5.2, 10.4, Math.PI);
  addUpperCourtyardEdge(-5.2, 0, 10.4, Math.PI / 2);
  addUpperCourtyardEdge(5.2, 0, 10.4, -Math.PI / 2);

  // =========================================================
  // 2. OUTER PERIMETER WALLS (30m x 30m: -15..+15)
  // =========================================================
  addWall(0, -15, 30.4, WALL_T); // North outer
  addWall(0, 15, 30.4, WALL_T);  // South outer
  addWall(-15, 0, WALL_T, 30.4); // West outer
  addWall(15, 0, WALL_T, 30.4);  // East outer

  // Heavy rusted wrought-iron 1984 Haveli Main Entrance Gate on South outer wall (padlocked until Moksha)
  const mainGate = createRustedIronGate(textures);
  mainGate.position.set(0, 0, 14.72);
  root.add(mainGate);

  // =========================================================
  // 3. CENTRAL COURTYARD (AANGAN) COLONNADE PILLARS & HAVAN KUND
  // =========================================================
  const pillarCoords: Array<[number, number]> = [
    [-5.0, -5.0],
    [0, -5.0],
    [5.0, -5.0],
    [-5.0, 0],
    [5.0, 0],
    [-5.0, 5.0],
    [0, 5.0],
    [5.0, 5.0],
  ];
  pillarCoords.forEach(([px, pz], idx) => {
    const pillar = createCarvedPillarWithBell(WALL_H, textures, idx % 2 === 0);
    pillar.position.set(px, 0, pz);
    root.add(pillar);
    colliders.push({
      minX: px - 0.28,
      maxX: px + 0.28,
      minZ: pz - 0.28,
      maxZ: pz + 0.28,
      isCover: true,
    });
  });

  // Central Havan Kund altar
  const havanKund = createHavanKund(textures);
  havanKund.root.position.set(0, 0, 0);
  root.add(havanKund.root);
  colliders.push({ minX: -1.28, maxX: 1.28, minZ: -1.28, maxZ: 1.28 });

  // Hanging overhead courtyard brass temple bells (weathered hammered brass PBR)
  const brassBellMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    bumpMap: textures.brassBump,
    bumpScale: 0.02,
    roughnessMap: textures.brassRoughness,
    color: 0xb68f44,
    roughness: 0.38,
    metalness: 0.86,
  });
  [-1.2, 0, 1.2].forEach((bx, idx) => {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 6), brassBellMat);
    chain.position.set(bx, WALL_H - 0.28, 4.95);
    root.add(chain);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 10), brassBellMat);
    bell.position.set(bx, WALL_H - 0.62 - (idx === 1 ? 0.08 : 0), 4.95);
    root.add(bell);
  });

  // =========================================================
  // 4. INTERIOR WING PARTITIONS WITH ARCHED PASSAGES
  //    Forms a connected loop so player can kite & break LOS!
  // =========================================================

  // --- NORTH WING (POOJA ROOM: x in [-7..7], z in [-15..-7.5]) ---
  // Separating wall at z = -7.5 with center arch [-1.4..1.4] + side loops at x=-7.5 & x=7.5
  addWall(-4.5, -7.5, 5.6, WALL_T);
  addWall(4.5, -7.5, 5.6, WALL_T);
  addArchHeader(0, -7.5, 3.0, false);

  // Side corridor dividers separating Pooja Room from NW & NE passages (doorways at z = -11.2)
  addWall(-7.3, -9.0, WALL_T, 2.8);
  addWall(-7.3, -13.6, WALL_T, 2.8);
  addArchHeader(-7.3, -11.3, 2.2, true);

  addWall(7.3, -9.0, WALL_T, 2.8);
  addWall(7.3, -13.6, WALL_T, 2.8);
  addArchHeader(7.3, -11.3, 2.2, true);

  // --- SOUTH WING (STOREROOM & ENTRY CORRIDOR: x in [-7..7], z in [7.5..15]) ---
  addWall(-4.5, 7.5, 5.6, WALL_T);
  addWall(4.5, 7.5, 5.6, WALL_T);
  addArchHeader(0, 7.5, 3.0, false);

  addWall(-7.3, 9.0, WALL_T, 2.8);
  addWall(-7.3, 13.6, WALL_T, 2.8);
  addArchHeader(-7.3, 11.3, 2.2, true);

  addWall(7.3, 9.0, WALL_T, 2.8);
  addWall(7.3, 13.6, WALL_T, 2.8);
  addArchHeader(7.3, 11.3, 2.2, true);

  // --- WEST WING (MASTER BEDROOM: x in [-15..-7.5], z in [-6.5..6.5]) ---
  addWall(-7.5, -4.3, WALL_T, 4.6);
  addWall(-7.5, 4.3, WALL_T, 4.6);
  addArchHeader(-7.5, 0, 4.0, true);

  // North/South connecting doors from Bedroom to NW/SW arched corridors
  addWall(-12.6, -7.3, 4.8, WALL_T);
  addArchHeader(-8.8, -7.3, 2.8, false);
  addWall(-12.6, 7.3, 4.8, WALL_T);
  addArchHeader(-8.8, 7.3, 2.8, false);

  // --- EAST WING (OLD KITCHEN: x in [7.5..15], z in [-6.5..6.5]) ---
  addWall(7.5, -4.3, WALL_T, 4.6);
  addWall(7.5, 4.3, WALL_T, 4.6);
  addArchHeader(7.5, 0, 4.0, true);

  addWall(12.6, -7.3, 4.8, WALL_T);
  addArchHeader(8.8, -7.3, 2.8, false);
  addWall(12.6, 7.3, 4.8, WALL_T);
  addArchHeader(8.8, 7.3, 2.8, false);

  // =========================================================
  // 4B. FOUR INTERACTIVE HINGED CARVED-TEAK WING DOORS
  // =========================================================
  const hingedDoors: HingedDoorRig[] = [
    createHingedHaveliDoor(
      'door_pooja',
      'Pooja Room',
      new THREE.Vector3(0, 0, -7.5),
      3.4,
      Math.PI,
      textures,
      false
    ),
    createHingedHaveliDoor(
      'door_storeroom',
      'Storeroom',
      new THREE.Vector3(0, 0, 7.5),
      3.4,
      0,
      textures,
      true
    ),
    createHingedHaveliDoor(
      'door_bedroom',
      'Master Bedroom',
      new THREE.Vector3(-7.5, 0, 0),
      4.0,
      -Math.PI / 2,
      textures,
      false
    ),
    createHingedHaveliDoor(
      'door_kitchen',
      'Old Kitchen',
      new THREE.Vector3(7.5, 0, 0),
      4.0,
      Math.PI / 2,
      textures,
      false
    ),
  ];
  hingedDoors.forEach((d) => root.add(d.root));

  // =========================================================
  // 5. ARCHITECTURAL DRESSING: WINDOWS, TAPESTRIES, FURNITURE, DIYAS
  // =========================================================

  // Barred moonlight windows with volumetric shafts (matching Reference 3)
  const addWindow = (x: number, y: number, z: number, rotY: number) => {
    const win = createMoonlightWindow(textures);
    win.position.set(x, y, z);
    win.rotation.y = rotY;
    root.add(win);
  };
  addWindow(-14.74, 2.05, -0.4, Math.PI / 2);  // Bedroom west moonlight
  addWindow(14.74, 2.05, 0.6, -Math.PI / 2);   // Kitchen east moonlight
  addWindow(-4.0, 2.05, -14.74, 0);            // Pooja room north window
  addWindow(11.4, 2.05, 14.74, Math.PI);       // SE corridor window

  // Faded vintage 1980s tapestries on walls
  const addTapestry = (x: number, y: number, z: number, rotY: number, w = 2.1, h = 2.4) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tapestryMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    root.add(m);
  };
  addTapestry(0, 2.15, -14.74, 0, 2.8, 2.5); // Pooja room backdrop
  addTapestry(-14.74, 2.1, 4.2, Math.PI / 2, 2.2, 2.1); // Bedroom tapestry

  // Leaning dusty picture frames along corridors (reusing shared frame & canvas geometry/material)
  const leaningFrameGeo = getBoxGeo(0.86, 1.12, 0.06);
  const leaningCanvasGeo = new THREE.PlaneGeometry(0.72, 0.96);
  const leaningCanvasMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.95 });
  const addLeaningFrame = (x: number, z: number, rotY: number) => {
    const fg = new THREE.Group();
    fg.position.set(x, 0.56, z);
    fg.rotation.y = rotY;
    fg.rotation.x = -0.18;
    const frame = new THREE.Mesh(leaningFrameGeo, woodMat);
    const canvas = new THREE.Mesh(leaningCanvasGeo, leaningCanvasMat);
    canvas.position.z = 0.032;
    fg.add(frame, canvas);
    root.add(fg);
  };
  addLeaningFrame(-10.5, -14.5, 0.1);
  addLeaningFrame(10.8, 14.5, Math.PI - 0.12);
  addLeaningFrame(-14.5, -5.2, Math.PI / 2 + 0.08);
  addLeaningFrame(14.5, 5.4, -Math.PI / 2 - 0.1);

  // Bedroom vintage wooden charpai / bedframe (raised underside clearance 0.58m so Prone player can crawl underneath!)
  const bed = new THREE.Group();
  bed.position.set(-12.8, 0, 0.4);
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 1.45), woodMat);
  bedFrame.position.y = 0.65;
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.96, 0.14, 1.32),
    new THREE.MeshStandardMaterial({ color: 0x3a2b2b, roughness: 0.94 })
  );
  mattress.position.y = 0.77;
  bed.add(bedFrame, mattress);
  [
    [-0.95, -0.62],
    [0.95, -0.62],
    [-0.95, 0.62],
    [0.95, 0.62],
  ].forEach(([lx, lz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.12, 0.1), woodMat);
    post.position.set(lx, 0.56, lz);
    bed.add(post);
  });
  root.add(bed);
  colliders.push({
    minX: -13.95,
    maxX: -11.65,
    minZ: -0.4,
    maxZ: 1.2,
    crawlUnderY: 0.58,
    isCover: true,
  });

  // Old Kitchen stone hearth / chulha counter along East wall
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.85, 3.8),
    new THREE.MeshStandardMaterial({ map: textures.stoneColor, roughness: 0.92 })
  );
  counter.position.set(14.2, 0.425, -0.2);
  root.add(counter);
  colliders.push({ minX: 13.55, maxX: 14.85, minZ: -2.15, maxZ: 1.75, isCover: true });

  // Storeroom wooden crates (low crates can be jumped over or crouched behind)
  const cratePositions: Array<[number, number, number]> = [
    [-5.4, 0.45, 13.6],
    [-4.5, 0.28, 13.9],
    [5.4, 0.48, 13.5],
  ];
  cratePositions.forEach(([cx, cy, cz]) => {
    const crate = new THREE.Mesh(getBoxGeo(0.9, cy * 2, 0.9), woodMat);
    crate.position.set(cx, cy, cz);
    crate.castShadow = !isLowQuality;
    root.add(crate);
    colliders.push({
      minX: cx - 0.5,
      maxX: cx + 0.5,
      minZ: cz - 0.5,
      maxZ: cz + 0.5,
      maxY: cy * 2 <= 0.62 ? cy * 2 : undefined,
      isCover: true,
    });
  });

  // Low broken wooden timber beams & fallen debris obstacles (jumpable with Space / Jump button!)
  const debrisSpecs: Array<{ x: number; z: number; w: number; h: number; d: number; rotY?: number }> = [
    { x: -3.2, z: 6.2, w: 1.55, h: 0.36, d: 0.34 },   // South veranda low fallen beam
    { x: 3.3, z: -6.2, w: 1.5, h: 0.38, d: 0.34 },    // North veranda broken timber
    { x: -6.2, z: -3.1, w: 0.34, h: 0.36, d: 1.45 },  // West colonnade collapsed plank
    { x: 6.2, z: 3.1, w: 0.34, h: 0.38, d: 1.45 },    // East colonnade collapsed plank
  ];
  debrisSpecs.forEach((db) => {
    const beam = new THREE.Mesh(getBoxGeo(db.w, db.h, db.d), woodMat);
    beam.position.set(db.x, db.h / 2, db.z);
    beam.receiveShadow = true;
    root.add(beam);
    colliders.push({
      minX: db.x - db.w / 2,
      maxX: db.x + db.w / 2,
      minZ: db.z - db.d / 2,
      maxZ: db.z + db.d / 2,
      maxY: db.h + 0.04,
      isCover: true,
    });
  });

  // Wooden tables at all 8 ritual item spawn spots (crawlUnderY: 0.72 lets Prone player crawl right underneath!)
  ITEM_SPAWN_POOL.forEach((slot) => {
    const table = createWoodenTable(textures, 1.15, 0.72);
    table.position.set(slot.pos.x, 0, slot.pos.z);
    root.add(table);
    colliders.push({
      minX: slot.pos.x - 0.62,
      maxX: slot.pos.x + 0.62,
      minZ: slot.pos.z - 0.42,
      maxZ: slot.pos.z + 0.42,
      crawlUnderY: 0.72,
      isCover: true,
    });
  });

  // Scattered flickering ambient earthen diyas in corridors & rooms (shared geometries, shadows disabled)
  const clayMat = new THREE.MeshStandardMaterial({ color: 0x7b4328, roughness: 0.86 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffac40 });
  const ambientDiyaCupGeo = new THREE.CylinderGeometry(0.09, 0.05, 0.05, 8);
  const ambientDiyaFlameGeo = new THREE.ConeGeometry(0.028, 0.11, 6);
  const ambientDiyaSpots: Array<[number, number, number]> = [
    [0, 0.03, -10.8],   // Pooja room floor
    [-10.2, 0.03, 0.2], // Bedroom doorway
    [10.2, 0.03, -0.2], // Kitchen doorway
    [0, 0.03, 9.8],     // South corridor (matching Reference 3 floor diya)
    [-5.6, 0.03, -5.6], // Courtyard NW corner
    [5.6, 0.03, 5.6],   // Courtyard SE corner
  ];
  ambientDiyaSpots.forEach(([dx, dy, dz], idx) => {
    const cup = new THREE.Mesh(ambientDiyaCupGeo, clayMat);
    cup.position.set(dx, dy, dz);
    root.add(cup);

    const flame = new THREE.Mesh(ambientDiyaFlameGeo, flameMat);
    flame.position.set(dx, dy + 0.075, dz);
    root.add(flame);

    if (!isLowQuality || idx < 3) {
      const pLight = new THREE.PointLight(0xff8e30, 1.45, 7.2, 1.85);
      pLight.position.set(dx, dy + 0.28, dz);
      pLight.castShadow = false;
      root.add(pLight);
      flickerLights.push({ light: pLight, baseIntensity: 1.45, phase: idx * 1.7, flame });
    }
  });

  // Base warm ember emitter locations (Havan Kund + ambient corridor diyas)
  const emberEmitters: THREE.Vector3[] = [
    new THREE.Vector3(0, 0.56, 0),
    new THREE.Vector3(-0.74, 0.56, -0.74),
    new THREE.Vector3(0.74, 0.56, -0.74),
    new THREE.Vector3(-0.74, 0.56, 0.74),
    new THREE.Vector3(0.74, 0.56, 0.74),
    ...ambientDiyaSpots.map(([dx, dy, dz]) => new THREE.Vector3(dx, dy + 0.12, dz)),
  ];

  // =========================================================
  // 6. FOUR CLIMB-IN WOODEN ALMIRAHS FOR HIDING
  // =========================================================
  const almirahSpecs: Array<{ id: string; room: string; pos: THREE.Vector3; yaw: number }> = [
    { id: 'almirah_pooja', room: 'Pooja Room', pos: new THREE.Vector3(-4.8, 0, -14.2), yaw: 0 },
    { id: 'almirah_bedroom', room: 'Master Bedroom', pos: new THREE.Vector3(-14.2, 0, -5.0), yaw: Math.PI / 2 },
    { id: 'almirah_kitchen', room: 'Old Kitchen', pos: new THREE.Vector3(14.2, 0, 5.1), yaw: -Math.PI / 2 },
    { id: 'almirah_storeroom', room: 'Storeroom', pos: new THREE.Vector3(4.8, 0, 8.3), yaw: Math.PI },
  ];
  const almirahs: AlmirahRig[] = almirahSpecs.map((spec) => {
    const rig = createAlmirah(spec.id, spec.room, spec.pos, spec.yaw, textures);
    root.add(rig.root);
    // Add thin back/side collision box only when player isn't hiding (engine bypasses while inside)
    colliders.push({
      minX: spec.pos.x - 0.52,
      maxX: spec.pos.x + 0.52,
      minZ: spec.pos.z - 0.52,
      maxZ: spec.pos.z + 0.52,
      isCover: true,
    });
    return rig;
  });

  // =========================================================
  // 7. FOUR READABLE HINGLISH LORE NOTES ON SMALL STANDS/FLOORS
  // =========================================================
  const noteCoords: Array<[number, number, number]> = [
    [-2.8, 0.82, 5.4],    // Veranda near start (small pedestal)
    [-2.4, 0.82, -11.5],  // Pooja Room
    [-9.6, 0.82, -3.5],   // Master Bedroom
    [9.8, 0.82, 2.2],     // Old Kitchen
  ];
  const parchmentMat = new THREE.MeshStandardMaterial({
    map: textures.parchmentColor,
    roughness: 0.9,
    emissive: 0x261d12,
    emissiveIntensity: 0.28,
  });

  const notes: WorldNoteProp[] = LORE_NOTES.map((data, i) => {
    const [nx, ny, nz] = noteCoords[i];
    const stool = createWoodenTable(textures, 0.58, 0.52);
    stool.position.set(nx, 0, nz);
    root.add(stool);
    colliders.push({ minX: nx - 0.34, maxX: nx + 0.34, minZ: nz - 0.3, maxZ: nz + 0.3 });

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.34), parchmentMat);
    sheet.position.set(nx, ny, nz);
    sheet.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.28;
    root.add(sheet);

    const noteAura = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.38, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf4c05c,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    noteAura.rotation.x = -Math.PI / 2;
    noteAura.position.set(nx, ny + 0.015, nz);
    root.add(noteAura);

    return {
      data,
      position: new THREE.Vector3(nx, ny, nz),
      mesh: sheet,
      auraRing: noteAura,
      read: false,
    };
  });

  // =========================================================
  // 7B. CHAPTER 1 PROPS: 5 EXTINGUISHED SHRINE DIYAS TO LIGHT
  // =========================================================
  const shrineDiyaSpecs: Array<{ id: string; room: string; pos: [number, number] }> = [
    { id: 'diya_aangan', room: 'Central Aangan', pos: [3.6, 3.6] },
    { id: 'diya_pooja', room: 'Pooja Room', pos: [-2.6, -13.2] },
    { id: 'diya_bedroom', room: 'Master Bedroom', pos: [-12.2, -4.4] },
    { id: 'diya_kitchen', room: 'Old Kitchen', pos: [12.0, 4.1] },
    { id: 'diya_storeroom', room: 'Storeroom', pos: [-2.6, 12.6] },
  ];

  const shrinePedestalGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.72, 10);
  const shrineBowlGeo = new THREE.CylinderGeometry(0.18, 0.1, 0.1, 10);
  const shrineBowlMat = new THREE.MeshStandardMaterial({ color: 0x8f5130, roughness: 0.82 });
  const shrineFlameGeo = new THREE.ConeGeometry(0.055, 0.22, 7);
  const shrineFlameMat = new THREE.MeshBasicMaterial({ color: 0xffb845 });
  const shrineAuraGeo = new THREE.RingGeometry(0.32, 0.48, 20);

  const shrineDiyas: ShrineDiyaProp[] = shrineDiyaSpecs.map((spec) => {
    const group = new THREE.Group();
    group.position.set(spec.pos[0], 0, spec.pos[1]);

    const pedestal = new THREE.Mesh(shrinePedestalGeo, stoneFloorMat);
    pedestal.position.y = 0.36;
    group.add(pedestal);

    const bowl = new THREE.Mesh(shrineBowlGeo, shrineBowlMat);
    bowl.position.y = 0.77;
    group.add(bowl);

    const flameMesh = new THREE.Mesh(shrineFlameGeo, shrineFlameMat);
    flameMesh.position.y = 0.92;
    flameMesh.visible = false;
    group.add(flameMesh);

    const auraRing = new THREE.Mesh(
      shrineAuraGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf5ba54,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.04;
    group.add(auraRing);

    const light = !isLowQuality ? new THREE.PointLight(0xff9b38, 0, 6.5, 1.8) : null;
    if (light) {
      light.position.y = 1.15;
      light.castShadow = false;
      group.add(light);
    }

    root.add(group);
    return {
      id: spec.id,
      room: spec.room,
      position: new THREE.Vector3(spec.pos[0], 0.85, spec.pos[1]),
      group,
      flameMesh,
      light,
      auraRing,
      lit: false,
    };
  });

  // =========================================================
  // 7C. CHAPTER 3 PROPS: 4 SEQUENCED HANGING TEMPLE BELLS
  // =========================================================
  const bellSpecs: Array<{ id: string; room: string; label: string; pos: [number, number] }> = [
    { id: 'bell_pooja', room: 'Pooja Room', label: '1st Bell (Pooja Room)', pos: [0, -12.0] },
    { id: 'bell_bedroom', room: 'Master Bedroom', label: '2nd Bell (Master Bedroom)', pos: [-11.0, -1.6] },
    { id: 'bell_kitchen', room: 'Old Kitchen', label: '3rd Bell (Old Kitchen)', pos: [11.2, -1.4] },
    { id: 'bell_storeroom', room: 'Storeroom', label: '4th Bell (Storeroom)', pos: [0, 11.4] },
  ];

  const chBellChainGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.45, 6);
  const chBellBodyGeo = new THREE.ConeGeometry(0.24, 0.42, 12);
  const chBellRopeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6);
  const chBellRopeMat = new THREE.MeshStandardMaterial({ color: 0x992626, roughness: 0.9 });
  const chBellAuraGeo = new THREE.RingGeometry(0.42, 0.62, 22);

  const chapterBells: ChapterBellProp[] = bellSpecs.map((spec, idx) => {
    const group = new THREE.Group();
    group.position.set(spec.pos[0], 0, spec.pos[1]);

    const bellPivot = new THREE.Group();
    bellPivot.position.y = WALL_H - 0.1;

    const chain = new THREE.Mesh(chBellChainGeo, brassBellMat);
    chain.position.y = -0.725;
    bellPivot.add(chain);

    const bellBody = new THREE.Mesh(chBellBodyGeo, brassBellMat);
    bellBody.position.y = -1.55;
    bellPivot.add(bellBody);

    const rope = new THREE.Mesh(chBellRopeGeo, chBellRopeMat);
    rope.position.y = -2.02;
    bellPivot.add(rope);

    group.add(bellPivot);

    const auraRing = new THREE.Mesh(
      chBellAuraGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf4c259,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.05;
    group.add(auraRing);

    root.add(group);
    return {
      id: spec.id,
      orderIndex: idx,
      room: spec.room,
      label: spec.label,
      position: new THREE.Vector3(spec.pos[0], 1.5, spec.pos[1]),
      group,
      bellPivot,
      auraRing,
      rung: false,
      swingVelocity: 0,
      swingAngle: 0,
    };
  });

  // =========================================================
  // 7D. CHAPTER 4 PROPS: 4 CURSED CRIMSON TANTRIK SEALS
  // =========================================================
  const sealSpecs: Array<{ id: string; room: string; pos: [number, number] }> = [
    { id: 'seal_pooja', room: 'Pooja Room', pos: [4.8, -13.4] },
    { id: 'seal_bedroom', room: 'Master Bedroom', pos: [-13.6, 4.2] },
    { id: 'seal_kitchen', room: 'Old Kitchen', pos: [13.2, -4.4] },
    { id: 'seal_storeroom', room: 'Storeroom', pos: [4.2, 13.4] },
  ];

  const sealStakeGeo = getBoxGeo(0.16, 1.48, 0.16);
  const sealTalismanGeo = new THREE.OctahedronGeometry(0.28, 0);
  const sealTalismanMat = new THREE.MeshStandardMaterial({
    color: 0xb81d26,
    emissive: 0xd9262e,
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.2,
  });
  const sealAuraGeo = new THREE.RingGeometry(0.36, 0.56, 20);

  const cursedSeals: CursedSealProp[] = sealSpecs.map((spec) => {
    const group = new THREE.Group();
    group.position.set(spec.pos[0], 0, spec.pos[1]);

    const stake = new THREE.Mesh(sealStakeGeo, woodMat);
    stake.position.y = 0.74;
    group.add(stake);

    const talismanMesh = new THREE.Mesh(sealTalismanGeo, sealTalismanMat);
    talismanMesh.position.y = 1.62;
    group.add(talismanMesh);

    const auraRing = new THREE.Mesh(
      sealAuraGeo,
      new THREE.MeshBasicMaterial({
        color: 0xe63946,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.05;
    group.add(auraRing);

    const light = !isLowQuality ? new THREE.PointLight(0xe62c36, 1.6, 5.8, 1.8) : null;
    if (light) {
      light.position.y = 1.6;
      light.castShadow = false;
      group.add(light);
    }

    root.add(group);
    return {
      id: spec.id,
      room: spec.room,
      position: new THREE.Vector3(spec.pos[0], 1.4, spec.pos[1]),
      group,
      talismanMesh,
      auraRing,
      light,
      broken: false,
    };
  });

  // =========================================================
  // 8. FOUR SACRED RITUAL ITEMS (RANDOMIZED SPAWN ACROSS ROOMS)
  // =========================================================
  const itemIds: RitualItemId[] = ['kalash', 'chunri', 'diya', 'samagri'];
  const ritualItems: RitualWorldItem[] = itemIds.map((id) => {
    const built = createRitualItemModel(id, textures);
    root.add(built.group);
    return {
      id,
      room: '',
      position: new THREE.Vector3(),
      group: built.group,
      auraRing: built.auraRing,
      flameMesh: built.flameMesh,
      collected: false,
      placed: false,
    };
  });

  const randomizeItemSpawns = () => {
    // Pick 1 random table in each of the 4 distinct rooms (Pooja, Bedroom, Kitchen, Storeroom)
    const rooms = ['Pooja Room', 'Master Bedroom', 'Old Kitchen', 'Storeroom'];
    const chosenSlots: ItemSpawnSlot[] = rooms.map((r) => {
      const candidates = ITEM_SPAWN_POOL.filter((s) => s.room === r);
      return candidates[Math.floor(Math.random() * candidates.length)];
    });
    // Shuffle which item goes in which room
    for (let i = chosenSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = chosenSlots[i];
      chosenSlots[i] = chosenSlots[j];
      chosenSlots[j] = tmp;
    }

    ritualItems.forEach((item, idx) => {
      const slot = chosenSlots[idx];
      item.room = slot.room;
      item.position.copy(slot.pos);
      item.group.position.copy(slot.pos);
      item.group.visible = true;
      item.collected = false;
      item.placed = false;
      havanKund.itemSlots[item.id].visible = false;
    });
  };
  randomizeItemSpawns();

  // =========================================================
  // 9. WAYPOINT NAVIGATION GRAPH FOR SMART GHOST AI
  // =========================================================
  const rawNodes: Array<[number, number, string, number[]]> = [
    // Courtyard ring (0..7)
    [-3.2, -3.2, 'Central Aangan', [1, 3, 8]],
    [3.2, -3.2, 'Central Aangan', [0, 2, 8]],
    [3.2, 3.2, 'Central Aangan', [1, 3, 14]],
    [-3.2, 3.2, 'Central Aangan', [0, 2, 14]],
    [-6.2, 0, 'West Veranda', [0, 3, 10]],
    [6.2, 0, 'East Veranda', [1, 2, 12]],
    [0, -6.2, 'North Veranda', [0, 1, 8]],
    [0, 6.2, 'South Veranda', [2, 3, 14]],
    // Pooja Room (8..9)
    [0, -10.8, 'Pooja Room', [6, 9, 16, 17]],
    [2.0, -12.6, 'Pooja Room', [8]],
    // Master Bedroom (10..11)
    [-10.2, 0, 'Master Bedroom', [4, 11, 16, 18]],
    [-10.8, 3.8, 'Master Bedroom', [10, 18]],
    // Old Kitchen (12..13)
    [10.2, 0, 'Old Kitchen', [5, 13, 17, 19]],
    [10.8, -3.8, 'Old Kitchen', [12, 17]],
    // Storeroom / South Corridor (14..15)
    [0, 10.8, 'Storeroom', [7, 15, 18, 19]],
    [-2.2, 12.2, 'Storeroom', [14]],
    // 4 Corner Arched Corridors (16..19)
    [-9.2, -11.2, 'NW Arched Corridor', [8, 10]],
    [9.2, -11.2, 'NE Arched Corridor', [8, 12, 13]],
    [-9.2, 11.2, 'SW Arched Corridor', [10, 11, 14]],
    [9.2, 11.2, 'SE Arched Corridor', [12, 14]],
  ];

  // Ensure bidirectional edges
  const waypoints: WaypointNode[] = rawNodes.map(([x, z, room, neighbors], id) => ({
    id,
    pos: new THREE.Vector3(x, 0, z),
    neighbors: [...neighbors],
    room,
  }));
  waypoints.forEach((node) => {
    node.neighbors.forEach((nId) => {
      if (!waypoints[nId].neighbors.includes(node.id)) {
        waypoints[nId].neighbors.push(node.id);
      }
    });
  });

  // =========================================================
  // 10. COLLISION, ROOM NAME & LINE-OF-SIGHT HELPERS
  // =========================================================
  const getRoomName = (x: number, z: number): string => {
    if (z < -7.5 && Math.abs(x) < 7.3) return 'Pooja Room';
    if (z > 7.5 && Math.abs(x) < 7.3) return 'Storeroom';
    if (x < -7.5 && Math.abs(z) < 7.3) return 'Master Bedroom';
    if (x > 7.5 && Math.abs(z) < 7.3) return 'Old Kitchen';
    if (Math.abs(x) <= 6.2 && Math.abs(z) <= 6.2) return 'Central Aangan';
    return 'Arched Corridor';
  };

  const resolvePlayerCollision = (
    pos: THREE.Vector3,
    radius: number,
    feetY = 0,
    bodyHeight = 1.75,
    ignoreDoors = false
  ) => {
    // Hard outer perimeter clamp
    pos.x = Math.max(-14.3, Math.min(14.3, pos.x));
    pos.z = Math.max(-14.3, Math.min(14.3, pos.z));

    const pushOutBox = (box: { minX: number; maxX: number; minZ: number; maxZ: number }) => {
      const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          const overlapL = Math.abs(pos.x - box.minX);
          const overlapR = Math.abs(box.maxX - pos.x);
          const overlapT = Math.abs(pos.z - box.minZ);
          const overlapB = Math.abs(box.maxZ - pos.z);
          const minO = Math.min(overlapL, overlapR, overlapT, overlapB);
          if (minO === overlapL) pos.x = box.minX - radius;
          else if (minO === overlapR) pos.x = box.maxX + radius;
          else if (minO === overlapT) pos.z = box.minZ - radius;
          else pos.z = box.maxZ + radius;
        }
      }
    };

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < colliders.length; i++) {
        const box = colliders[i];
        if (box.crawlUnderY !== undefined && feetY + bodyHeight <= box.crawlUnderY) {
          continue;
        }
        if (box.maxY !== undefined && feetY >= box.maxY - 0.14) {
          continue;
        }
        pushOutBox(box);
      }

      // Dynamic collision against closed hinged wing doors
      if (!ignoreDoors) {
        for (let d = 0; d < hingedDoors.length; d++) {
          const door = hingedDoors[d];
          if (door.openAmount < 0.42) {
            pushOutBox(door.closedBox);
          }
        }
      }
    }
  };

  /** Checks whether the player has vertical clearance to stand/crouch up (prevents clipping into tabletops/charpai). */
  const hasHeadroomAt = (x: number, z: number, radius: number, targetHeight: number): boolean => {
    const rSq = (radius * 0.85) * (radius * 0.85);
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (box.crawlUnderY === undefined) continue;
      if (targetHeight <= box.crawlUnderY) continue;
      const cx = Math.max(box.minX, Math.min(x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < rSq) {
        return false;
      }
    }
    return true;
  };

  /** Zero-allocation stealth probe checking if player is prone under furniture or crouching against cover/corners. */
  const evaluateStealthCover = (
    x: number,
    z: number,
    stance: PlayerStance,
    out: StealthCoverCheck
  ): StealthCoverCheck => {
    out.underFurniture = false;
    out.nearCover = false;
    if (stance === 'standing') return out;

    const coverDistSq = 0.88 * 0.88;
    const underPad = 0.14;

    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (stance === 'prone' && box.crawlUnderY !== undefined) {
        if (
          x >= box.minX - underPad &&
          x <= box.maxX + underPad &&
          z >= box.minZ - underPad &&
          z <= box.maxZ + underPad
        ) {
          out.underFurniture = true;
          out.nearCover = true;
          return out;
        }
      }
      if (!out.nearCover && box.isCover) {
        const cx = Math.max(box.minX, Math.min(x, box.maxX));
        const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz <= coverDistSq) {
          out.nearCover = true;
        }
      }
    }
    return out;
  };

  // Fast 2D segment-vs-AABB ray check against structural full-height walls for Ghost vision
  const wallColliders = colliders.filter(
    (c) =>
      c.crawlUnderY === undefined &&
      c.maxY === undefined &&
      (c.maxX - c.minX > 1.8 || c.maxZ - c.minZ > 1.8)
  );

  const segmentHitsAABB = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    b: AABBCollider
  ): boolean => {
    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dz = z2 - z1;

    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-8) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };

    return (
      clip(-dx, x1 - b.minX) &&
      clip(dx, b.maxX - x1) &&
      clip(-dz, z1 - b.minZ) &&
      clip(dz, b.maxZ - z1)
    );
  };

  const hasLineOfSight = (a: THREE.Vector3, b: THREE.Vector3): boolean => {
    for (let i = 0; i < wallColliders.length; i++) {
      if (segmentHitsAABB(a.x, a.z, b.x, b.z, wallColliders[i])) {
        return false;
      }
    }
    // Closed hinged wing doors also block ghost sightlines!
    for (let d = 0; d < hingedDoors.length; d++) {
      const door = hingedDoors[d];
      if (door.openAmount < 0.35 && segmentHitsAABB(a.x, a.z, b.x, b.z, door.closedBox)) {
        return false;
      }
    }
    return true;
  };

  const configureForChapter = (chapter: ChapterNumber) => {
    // Reset hinged wing doors: Storeroom starts open so player steps smoothly into Aangan; other 3 wings closed
    hingedDoors.forEach((door) => {
      const startOpen = door.id === 'door_storeroom';
      door.isOpen = startOpen;
      door.openAmount = startOpen ? 1 : 0;
      door.ghostPushCooldown = 0;
      door.leftPivot.rotation.y = door.openAmount * 1.56;
      door.rightPivot.rotation.y = -door.openAmount * 1.56;
    });

    // Chapter 3 (formerly Ch 2 / orig Ch 1): 5 Shrine Diyas
    shrineDiyas.forEach((d) => {
      d.lit = false;
      d.flameMesh.visible = false;
      if (d.light) d.light.intensity = 0;
      d.group.visible = chapter === 3;
    });

    // Chapter 4 (formerly Ch 3 / orig Ch 2): Notes reset unread state (readable in all indoor chapters, highlighted in Ch 4)
    notes.forEach((n) => {
      n.read = false;
      (n.auraRing.material as THREE.MeshBasicMaterial).opacity = chapter === 4 ? 0.36 : 0;
    });

    // Chapter 5 (formerly Ch 4 / orig Ch 3): 4 Sequenced Brass Temple Bells
    chapterBells.forEach((b) => {
      b.rung = false;
      b.swingAngle = 0;
      b.swingVelocity = 0;
      b.bellPivot.rotation.z = 0;
      b.group.visible = chapter === 5;
    });

    // Chapter 6 (formerly Ch 5 / orig Ch 4): 4 Cursed Crimson Tantrik Seals
    cursedSeals.forEach((s) => {
      s.broken = false;
      s.talismanMesh.visible = true;
      s.talismanMesh.scale.set(1, 1, 1);
      if (s.light) s.light.intensity = chapter === 6 ? 1.65 : 0;
      s.group.visible = chapter === 6;
    });

    // Chapter 7 (formerly Ch 6 / orig Ch 5): 4 Randomized Sacred Ritual Items
    randomizeItemSpawns();
    ritualItems.forEach((item) => {
      item.group.visible = chapter === 7;
      if (chapter !== 7) {
        item.collected = true; // hide from interaction outside Ch 7
      }
    });
  };
  configureForChapter(3);

  return {
    root,
    colliders,
    havanKund,
    almirahs,
    hingedDoors,
    ritualItems,
    notes,
    shrineDiyas,
    chapterBells,
    cursedSeals,
    waypoints,
    flickerLights,
    emberEmitters,
    getRoomName,
    hasLineOfSight,
    resolvePlayerCollision,
    hasHeadroomAt,
    evaluateStealthCover,
    applyQualityMaterials,
    randomizeItemSpawns,
    configureForChapter,
  };
}
