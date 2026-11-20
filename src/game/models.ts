import * as THREE from 'three';
import { ProceduralTexturePack } from './textures';
import { RitualItemId } from './types';

export interface GhostRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  hairGroup: THREE.Group;
  sareeMaterial: THREE.MeshStandardMaterial;
  skinMaterial: THREE.MeshStandardMaterial;
  hairMaterial: THREE.MeshStandardMaterial;
  faceMaterial: THREE.MeshStandardMaterial;
  shantiHalo: THREE.Mesh;
  shantiParticles: THREE.Points;
  shantiVelocities: Float32Array;
  setDissolve: (t: number) => void;
  updateClothWave: (elapsed: number, moveSpeed: number, highDetail: boolean) => void;
}

export interface HavanKundRig {
  root: THREE.Group;
  fireGroup: THREE.Group;
  fireLight: THREE.PointLight;
  shantiBeam: THREE.Mesh;
  cornerFlames: THREE.Mesh[];
  itemSlots: Record<RitualItemId, THREE.Group>;
  auraRing: THREE.Mesh;
  update: (time: number, climaxActive: boolean, shantiProgress: number, hintActive: boolean) => void;
}

export interface AlmirahRig {
  id: string;
  room: string;
  root: THREE.Group;
  leftDoorPivot: THREE.Group;
  rightDoorPivot: THREE.Group;
  insidePos: THREE.Vector3;
  exitPos: THREE.Vector3;
  facingYaw: number;
  doorOpenAmount: number;
  doorSwingBoost: number;
}

export interface HingedDoorRig {
  id: string;
  roomName: string;
  root: THREE.Group;
  leftPivot: THREE.Group;
  rightPivot: THREE.Group;
  interactPos: THREE.Vector3;
  isOpen: boolean;
  openAmount: number; // 0 = closed, 1 = fully swung open
  ghostPushCooldown: number;
  closedBox: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface FlashlightRig {
  viewGroup: THREE.Group;
  flashlightBodyGroup: THREE.Group;
  trishulGroup: THREE.Group;
  trishulFlameMesh: THREE.Mesh;
  trishulFlameLight: THREE.PointLight;
  spotLight: THREE.SpotLight;
  beamMesh: THREE.Mesh;
  innerBeamMesh: THREE.Mesh;
  beamDustPoints: THREE.Points;
  lensMat: THREE.MeshStandardMaterial;
  bulbMat: THREE.MeshBasicMaterial;
  switchNub: THREE.Mesh;
  sparkGroup: THREE.Group;
  sparkCoreMesh: THREE.Mesh;
  sparkCoreMat: THREE.MeshBasicMaterial;
  sparkRays: Array<{ mesh: THREE.Mesh; dir: THREE.Vector3 }>;
  sparkRayMat: THREE.MeshBasicMaterial;
  sparkLight: THREE.PointLight;
  setWeaponMode: (mode: 'flashlight' | 'trishul') => void;
  updateBeamDust: (dt: number, elapsed: number, highDetail: boolean) => void;
}

interface SharedPropAssets {
  contactShadowGeo: THREE.PlaneGeometry;
  contactShadowMat: THREE.MeshBasicMaterial;
  woodMat: THREE.MeshStandardMaterial;
  woodTrimMat: THREE.MeshStandardMaterial;
  stoneBaseMat: THREE.MeshStandardMaterial;
  brassMat: THREE.MeshStandardMaterial;
  ironMat: THREE.MeshStandardMaterial;
  windowGlassMat: THREE.MeshBasicMaterial;
  windowGrillMat: THREE.MeshStandardMaterial;
  windowFrameMat: THREE.MeshStandardMaterial;
  windowShaftMat: THREE.MeshBasicMaterial;
  pillarPlinthGeo: THREE.BoxGeometry;
  pillarCollarGeo: THREE.CylinderGeometry;
  pillarCapitalGeo: THREE.BoxGeometry;
  pillarChainGeo: THREE.CylinderGeometry;
  pillarBellGeo: THREE.LatheGeometry;
  tableLegGeo: THREE.BoxGeometry;
  winGlassGeo: THREE.PlaneGeometry;
  winGrillGeo: THREE.PlaneGeometry;
  winTopGeo: THREE.BoxGeometry;
  winBotGeo: THREE.BoxGeometry;
  winShaftGeo: THREE.PlaneGeometry;
  almBackGeo: THREE.BoxGeometry;
  almSideGeo: THREE.BoxGeometry;
  almCrownGeo: THREE.BoxGeometry;
  almPlinthGeo: THREE.BoxGeometry;
  almHandleGeo: THREE.CylinderGeometry;
  almLowerDoorGeo: THREE.BoxGeometry;
  almStileGeo: THREE.BoxGeometry;
  almTopRailGeo: THREE.BoxGeometry;
  almSlatGeo: THREE.BoxGeometry;
  boxCache: Map<string, THREE.BoxGeometry>;
  cylCache: Map<string, THREE.CylinderGeometry>;
}

const sharedAssetsByPack = new WeakMap<ProceduralTexturePack, SharedPropAssets>();

function getSharedPropAssets(textures: ProceduralTexturePack): SharedPropAssets {
  let cached = sharedAssetsByPack.get(textures);
  if (cached) return cached;

  const contactShadowGeo = new THREE.PlaneGeometry(2, 2);
  contactShadowGeo.rotateX(-Math.PI / 2);

  const bellPts = [
    new THREE.Vector2(0.0, 0.18),
    new THREE.Vector2(0.045, 0.16),
    new THREE.Vector2(0.065, 0.08),
    new THREE.Vector2(0.11, 0.0),
  ];

  const almW = 1.28;
  const almH = 2.28;
  const almD = 0.96;
  const doorW = (almW - 0.18) / 2;
  const doorH = almH - 0.2;

  cached = {
    contactShadowGeo,
    contactShadowMat: new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
    woodMat: new THREE.MeshStandardMaterial({
      map: textures.woodColor,
      bumpMap: textures.woodBump,
      bumpScale: 0.038,
      roughnessMap: textures.woodRoughness,
      roughness: 0.88,
      metalness: 0.06,
    }),
    woodTrimMat: new THREE.MeshStandardMaterial({
      color: 0x22140c,
      bumpMap: textures.woodBump,
      bumpScale: 0.025,
      roughnessMap: textures.woodRoughness,
      roughness: 0.72,
      metalness: 0.12,
    }),
    stoneBaseMat: new THREE.MeshStandardMaterial({
      map: textures.stoneColor,
      bumpMap: textures.stoneBump,
      bumpScale: 0.036,
      roughnessMap: textures.stoneRoughness,
      roughness: 0.9,
      metalness: 0.06,
    }),
    brassMat: new THREE.MeshStandardMaterial({
      map: textures.brassColor,
      bumpMap: textures.brassBump,
      bumpScale: 0.022,
      roughnessMap: textures.brassRoughness,
      roughness: 0.44,
      metalness: 0.86,
    }),
    ironMat: new THREE.MeshStandardMaterial({
      map: textures.ironColor,
      bumpMap: textures.ironBump,
      bumpScale: 0.032,
      roughnessMap: textures.ironRoughness,
      roughness: 0.82,
      metalness: 0.62,
    }),
    windowGlassMat: new THREE.MeshBasicMaterial({ color: 0x3b7684 }),
    windowGrillMat: new THREE.MeshStandardMaterial({
      map: textures.grillColor,
      alphaMap: textures.grillAlpha,
      roughnessMap: textures.ironRoughness,
      transparent: true,
      alphaTest: 0.45,
      roughness: 0.84,
      metalness: 0.58,
    }),
    windowFrameMat: new THREE.MeshStandardMaterial({
      map: textures.woodColor,
      bumpMap: textures.woodBump,
      bumpScale: 0.025,
      roughness: 0.86,
    }),
    windowShaftMat: new THREE.MeshBasicMaterial({
      color: 0x62b0c2,
      transparent: true,
      opacity: 0.095,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    pillarPlinthGeo: new THREE.BoxGeometry(0.46, 0.34, 0.46),
    pillarCollarGeo: new THREE.CylinderGeometry(0.2, 0.2, 0.11, 8),
    pillarCapitalGeo: new THREE.BoxGeometry(0.56, 0.28, 0.56),
    pillarChainGeo: new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6),
    pillarBellGeo: new THREE.LatheGeometry(bellPts, 10),
    tableLegGeo: new THREE.BoxGeometry(0.075, 0.76, 0.075),
    winGlassGeo: new THREE.PlaneGeometry(1.5, 1.9),
    winGrillGeo: new THREE.PlaneGeometry(1.54, 1.94),
    winTopGeo: new THREE.BoxGeometry(1.7, 0.12, 0.16),
    winBotGeo: new THREE.BoxGeometry(1.74, 0.14, 0.22),
    winShaftGeo: new THREE.PlaneGeometry(1.55, 4.4),
    almBackGeo: new THREE.BoxGeometry(almW, almH, 0.08),
    almSideGeo: new THREE.BoxGeometry(0.08, almH, almD),
    almCrownGeo: new THREE.BoxGeometry(almW + 0.14, 0.14, almD + 0.12),
    almPlinthGeo: new THREE.BoxGeometry(almW + 0.06, 0.12, almD + 0.04),
    almHandleGeo: new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8),
    almLowerDoorGeo: new THREE.BoxGeometry(doorW - 0.015, doorH * 0.62, 0.05),
    almStileGeo: new THREE.BoxGeometry(0.07, doorH * 0.38, 0.05),
    almTopRailGeo: new THREE.BoxGeometry(doorW, 0.09, 0.05),
    almSlatGeo: new THREE.BoxGeometry(doorW - 0.12, 0.04, 0.04),
    boxCache: new Map(),
    cylCache: new Map(),
  };

  sharedAssetsByPack.set(textures, cached);
  return cached;
}

const _contactMatFallback = new WeakMap<THREE.CanvasTexture, THREE.MeshBasicMaterial>();
const _contactUnitPlane = (() => {
  const g = new THREE.PlaneGeometry(2, 2);
  g.rotateX(-Math.PI / 2);
  return g;
})();

function addContactShadow(parent: THREE.Object3D, shadowTex: THREE.CanvasTexture, radius: number, y = 0.012): void {
  let mat = _contactMatFallback.get(shadowTex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    _contactMatFallback.set(shadowTex, mat);
  }
  const mesh = new THREE.Mesh(_contactUnitPlane, mat);
  mesh.scale.set(radius, 1, radius);
  mesh.position.y = y;
  parent.add(mesh);
}

/**
 * Terrifying 3D Indian female ghost matching the reference images:
 * tattered dark maroon saree with tarnished gold zari border, long messy black hair,
 * pale gaunt face with hollow dark eyes, barefoot with silver payal anklets.
 */
export function createGhostModel(textures: ProceduralTexturePack): GhostRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const sareeMaterial = new THREE.MeshStandardMaterial({
    map: textures.sareeColor,
    bumpMap: textures.sareeBump,
    bumpScale: 0.042,
    roughness: 0.88,
    metalness: 0.08,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });

  const veilMaterial = new THREE.MeshStandardMaterial({
    map: textures.sareeColor,
    bumpMap: textures.sareeBump,
    bumpScale: 0.025,
    color: 0x6a1d26,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
  });

  const zariGoldMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    roughnessMap: textures.brassRoughness,
    color: 0xaa863e,
    roughness: 0.44,
    metalness: 0.76,
    transparent: true,
    opacity: 1,
  });

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0x859092,
    roughness: 0.72,
    metalness: 0.04,
    transparent: true,
    opacity: 1,
  });

  const faceMaterial = new THREE.MeshStandardMaterial({
    map: textures.ghostFaceColor,
    roughness: 0.64,
    metalness: 0.05,
    emissive: 0x0e181c,
    emissiveIntensity: 0.36,
    transparent: true,
    opacity: 1,
  });

  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0x08090c,
    roughness: 0.92,
    metalness: 0.06,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });

  const silverPayalMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8dd,
    roughness: 0.22,
    metalness: 0.92,
  });

  // 1. Subdivided flared maroon saree skirt with tattered lower edge + stored rest buffer for live cloth wave
  const skirtPoints = [
    new THREE.Vector2(0.35, 0.12),
    new THREE.Vector2(0.32, 0.28),
    new THREE.Vector2(0.29, 0.48),
    new THREE.Vector2(0.25, 0.7),
    new THREE.Vector2(0.21, 0.92),
    new THREE.Vector2(0.18, 1.08),
    new THREE.Vector2(0.21, 1.25),
    new THREE.Vector2(0.16, 1.39),
  ];
  const skirtGeo = new THREE.LatheGeometry(skirtPoints, 22);
  const sPos = skirtGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i);
    let y = sPos.getY(i);
    const z = sPos.getZ(i);
    const angle = Math.atan2(z, x);
    const lowFactor = Math.max(0, 1 - y / 1.42);
    const pleat = 1 + Math.sin(angle * 10) * 0.075 * lowFactor + Math.cos(angle * 5) * 0.03 * lowFactor;
    if (y < 0.22) {
      // Subtle tattered jagged hem contour
      y += Math.sin(angle * 7) * 0.028 + Math.cos(angle * 13) * 0.015;
    }
    sPos.setXYZ(i, x * pleat, y, z * pleat);
  }
  skirtGeo.computeVertexNormals();
  const skirtBasePos = new Float32Array(sPos.array as Float32Array);
  const skirtMesh = new THREE.Mesh(skirtGeo, sareeMaterial);
  skirtMesh.castShadow = true;
  bodyGroup.add(skirtMesh);

  // Diagonal draped saree pallu across chest & left shoulder
  const palluGeo = new THREE.CylinderGeometry(0.195, 0.25, 0.58, 14, 4, true, -0.75, 2.4);
  const palluMesh = new THREE.Mesh(palluGeo, sareeMaterial);
  palluMesh.position.set(-0.02, 1.17, 0.02);
  palluMesh.rotation.z = 0.22;
  bodyGroup.add(palluMesh);

  // Gold zari border sash strip along shoulder drape
  const sashGeo = new THREE.BoxGeometry(0.052, 0.58, 0.28);
  const sashMesh = new THREE.Mesh(sashGeo, zariGoldMat);
  sashMesh.position.set(-0.14, 1.18, 0.02);
  sashMesh.rotation.z = -0.34;
  bodyGroup.add(sashMesh);

  // Flowing tattered trailing pallu cloth hanging down left back/side (animated vertex ribbon!)
  const trailGeo = new THREE.PlaneGeometry(0.32, 0.92, 4, 10);
  const tPos = trailGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tPos.count; i++) {
    const tx = tPos.getX(i);
    const ty = tPos.getY(i);
    const droop = (0.46 - ty) / 0.92; // 0 at top shoulder -> 1 at tattered bottom tip
    tPos.setXYZ(i, tx * (0.78 + droop * 0.45), ty, Math.sin(ty * 6.5) * 0.045 * droop);
  }
  trailGeo.computeVertexNormals();
  const trailBasePos = new Float32Array(tPos.array as Float32Array);
  const trailMesh = new THREE.Mesh(trailGeo, sareeMaterial);
  trailMesh.position.set(-0.22, 0.86, -0.1);
  trailMesh.rotation.y = -0.52;
  bodyGroup.add(trailMesh);

  // Translucent tattered secondary bridal shroud drape behind shoulders (depth & ghostly silhouette)
  const backVeilGeo = new THREE.PlaneGeometry(0.46, 1.12, 4, 8);
  const bvPos = backVeilGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bvPos.count; i++) {
    const vx = bvPos.getX(i);
    const vy = bvPos.getY(i);
    const droop = (0.56 - vy) / 1.12;
    bvPos.setXYZ(i, vx * (0.65 + droop * 0.55), vy, -0.05 - Math.abs(vx) * 0.22);
  }
  backVeilGeo.computeVertexNormals();
  const backVeilBasePos = new Float32Array(bvPos.array as Float32Array);
  const backVeilMesh = new THREE.Mesh(backVeilGeo, veilMaterial);
  backVeilMesh.position.set(0, 1.02, -0.15);
  bodyGroup.add(backVeilMesh);

  // 2. Bare pale ankles, feet & silver payal anklets
  [-0.085, 0.085].forEach((fx) => {
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.16, 10), skinMaterial);
    ankle.position.set(fx, 0.09, 0.01);
    bodyGroup.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.036, 0.16), skinMaterial);
    foot.position.set(fx, 0.02, 0.045);
    bodyGroup.add(foot);

    const payal = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.008, 8, 16), silverPayalMat);
    payal.rotation.x = Math.PI / 2;
    payal.position.set(fx, 0.055, 0.01);
    bodyGroup.add(payal);

    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), silverPayalMat);
      bead.position.set(fx + Math.cos(a) * 0.042, 0.046, 0.01 + Math.sin(a) * 0.042);
      bodyGroup.add(bead);
    }
  });

  // 3. Pale gaunt arms with curved clawed fingers
  const buildArm = (side: -1 | 1): THREE.Group => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.21, 1.35, 0);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.15, 10), sareeMaterial);
    sleeve.position.y = -0.06;
    armGroup.add(sleeve);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.031, 0.28, 8), skinMaterial);
    upper.position.y = -0.22;
    armGroup.add(upper);

    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.022, 0.27, 8), skinMaterial);
    fore.position.set(0, -0.45, 0.04);
    fore.rotation.x = -0.22;
    armGroup.add(fore);

    // Tarnished glass/gold bridal bangles around wrists
    const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.006, 6, 12), zariGoldMat);
    bangle.rotation.x = Math.PI / 2;
    bangle.position.set(0, -0.54, 0.06);
    armGroup.add(bangle);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, 0.024), skinMaterial);
    hand.position.set(0, -0.61, 0.08);
    hand.rotation.x = -0.18;
    armGroup.add(hand);

    return armGroup;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  bodyGroup.add(leftArm, rightArm);

  // 4. Neck, sculpted shrouded head, gaunt face & flowing dark hair ribbons
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.058, 0.12, 10), skinMaterial);
  neck.position.set(0, 1.43, 0.01);
  bodyGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0.02);
  bodyGroup.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.125, 18, 16);
  headGeo.scale(0.86, 1.09, 0.94);
  const headMesh = new THREE.Mesh(headGeo, skinMaterial);
  headGroup.add(headMesh);

  const faceGeo = new THREE.SphereGeometry(
    0.1275,
    18,
    16,
    -Math.PI * 0.35,
    Math.PI * 0.7,
    Math.PI * 0.18,
    Math.PI * 0.68
  );
  faceGeo.scale(0.86, 1.09, 0.94);
  faceGeo.rotateY(Math.PI / 2);
  const faceMesh = new THREE.Mesh(faceGeo, faceMaterial);
  headGroup.add(faceMesh);

  // Tattered maroon bridal ghunghat / shroud hood partially framing crown & temples
  const hoodGeo = new THREE.SphereGeometry(0.152, 16, 12, -Math.PI * 0.92, Math.PI * 1.84, 0, Math.PI * 0.62);
  hoodGeo.scale(0.96, 1.06, 1.08);
  hoodGeo.rotateY(-Math.PI / 2);
  const hoodMesh = new THREE.Mesh(hoodGeo, veilMaterial);
  hoodMesh.position.set(0, 0.025, -0.02);
  headGroup.add(hoodMesh);

  // Long tangled cascading black hair framing face & back with stored rest buffers for wave animation
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.141, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMaterial
  );
  crown.scale.set(0.95, 1.07, 1.05);
  crown.position.set(0, 0.02, -0.015);
  hairGroup.add(crown);

  interface HairLockEntry {
    mesh: THREE.Mesh;
    basePos: Float32Array;
    length: number;
    phase: number;
  }
  const hairLocks: HairLockEntry[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const angle = -Math.PI * 0.88 + t * Math.PI * 1.76;
    const isFrontSide = Math.abs(angle) > Math.PI * 0.56;
    const lockLen = isFrontSide ? 0.54 + (i % 3) * 0.09 : 0.72 + (i % 3) * 0.09;
    const lockW = isFrontSide ? 0.072 : 0.105;
    const geo = new THREE.PlaneGeometry(lockW, lockLen, 2, 6);
    const gp = geo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < gp.count; v++) {
      const vy = gp.getY(v);
      const droop = (lockLen * 0.5 - vy) / lockLen;
      gp.setX(v, gp.getX(v) * (1 - droop * 0.42)); // Taper to fine wisps at tips
      gp.setZ(v, Math.sin(vy * 8 + i) * 0.026 * droop);
    }
    geo.computeVertexNormals();
    const lock = new THREE.Mesh(geo, hairMaterial);
    const rad = 0.126;
    lock.position.set(
      Math.sin(angle) * rad,
      0.06 - lockLen * 0.45,
      -Math.cos(angle) * rad
    );
    lock.rotation.y = angle + Math.PI;
    lock.rotation.z = Math.sin(i * 2.1) * 0.12;
    hairGroup.add(lock);
    hairLocks.push({
      mesh: lock,
      basePos: new Float32Array(gp.array as Float32Array),
      length: lockLen,
      phase: i * 0.73,
    });
  }

  // Subtle dark contact shadow beneath feet
  addContactShadow(root, textures.contactShadow, 0.44, 0.01);

  // 5. Sacred Golden Divine Halo behind head (illuminates during Moksha finale)
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffe49e,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shantiHalo = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.44, 32), haloMat);
  shantiHalo.position.set(0, 1.56, -0.14);
  shantiHalo.visible = false;
  root.add(shantiHalo);

  // 6. Radiant 480-particle Golden-White Shanti Ascension System (soft radial glow sprites)
  const particleCount = 480;
  const pPositions = new Float32Array(particleCount * 3);
  const pVelocities = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.06 + Math.random() * 0.42;
    pPositions[i * 3] = Math.cos(ang) * rad;
    pPositions[i * 3 + 1] = Math.random() * 1.72;
    pPositions[i * 3 + 2] = Math.sin(ang) * rad;

    pVelocities[i * 3] = (Math.random() - 0.5) * 0.65;
    pVelocities[i * 3 + 1] = 0.75 + Math.random() * 1.65;
    pVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.65;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffe8a8,
    map: textures.softParticle,
    size: 0.13,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shantiParticles = new THREE.Points(pGeo, pMat);
  shantiParticles.visible = false;
  root.add(shantiParticles);

  const warmGold = new THREE.Color(0xffcf6e);
  const horrorFaceEmissive = new THREE.Color(0x0e181c);
  const blackEmissive = new THREE.Color(0x000000);

  const setDissolve = (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));

    if (clamped <= 0.005) {
      sareeMaterial.opacity = 1;
      sareeMaterial.emissive.copy(blackEmissive);
      sareeMaterial.emissiveIntensity = 0;
      veilMaterial.opacity = 0.78;
      veilMaterial.emissive.copy(blackEmissive);
      veilMaterial.emissiveIntensity = 0;
      zariGoldMat.opacity = 1;
      skinMaterial.opacity = 1;
      skinMaterial.emissive.copy(blackEmissive);
      skinMaterial.emissiveIntensity = 0;
      faceMaterial.opacity = 1;
      faceMaterial.emissive.copy(horrorFaceEmissive);
      faceMaterial.emissiveIntensity = 0.36;
      hairMaterial.opacity = 1;
      bodyGroup.visible = true;
      shantiHalo.visible = false;
      haloMat.opacity = 0;
      shantiParticles.visible = false;
      pMat.opacity = 0;
      return;
    }

    const glowPhase = Math.min(1, clamped / 0.42);
    sareeMaterial.emissive.copy(warmGold);
    sareeMaterial.emissiveIntensity = glowPhase * 1.65;
    veilMaterial.emissive.copy(warmGold);
    veilMaterial.emissiveIntensity = glowPhase * 1.5;
    skinMaterial.emissive.copy(warmGold);
    skinMaterial.emissiveIntensity = glowPhase * 1.85;
    faceMaterial.emissive.copy(warmGold);
    faceMaterial.emissiveIntensity = 0.36 + glowPhase * 1.75;

    shantiHalo.visible = true;
    const haloScale = 0.75 + glowPhase * 0.85 + Math.max(0, clamped - 0.5) * 1.2;
    shantiHalo.scale.setScalar(haloScale);
    haloMat.opacity = Math.sin(Math.min(1, clamped) * Math.PI) * 0.82;

    const fadeStart = 0.42;
    const bodyAlpha =
      clamped < fadeStart ? 1 : Math.max(0, 1 - (clamped - fadeStart) / 0.42);
    sareeMaterial.opacity = bodyAlpha;
    veilMaterial.opacity = bodyAlpha * 0.78;
    zariGoldMat.opacity = bodyAlpha;
    skinMaterial.opacity = bodyAlpha;
    faceMaterial.opacity = bodyAlpha;
    hairMaterial.opacity = bodyAlpha;
    bodyGroup.visible = bodyAlpha > 0.02;

    shantiParticles.visible = true;
    pMat.opacity = clamped < 0.25 ? (clamped / 0.25) * 0.92 : Math.sin(Math.min(1, clamped) * Math.PI) * 1.0;
  };

  /**
   * Zero-GC cloth & hair wave animator:
   * - High quality: ripples saree hem, billowing trailing pallu/veil, and hair tips in vertex buffers.
   * - Low quality: lightweight transform sway so mid-range Android WebViews stay locked at 60 FPS.
   */
  const updateClothWave = (elapsed: number, moveSpeed: number, highDetail: boolean) => {
    const speedFactor = Math.min(1.6, moveSpeed * 0.28);
    const waveFreq = 2.6 + speedFactor * 2.4;

    // Subtle secondary cloth sway always active
    trailMesh.rotation.x = 0.08 + speedFactor * 0.24 + Math.sin(elapsed * waveFreq) * 0.08;
    backVeilMesh.rotation.x = 0.06 + speedFactor * 0.32 + Math.cos(elapsed * (waveFreq * 0.85)) * 0.07;

    if (!highDetail) {
      hairGroup.rotation.x = speedFactor * 0.14 + Math.sin(elapsed * 2.8) * 0.035;
      hairGroup.rotation.z = Math.sin(elapsed * 3.1) * 0.055;
      return;
    }

    // 1. Live saree hem ripple (strongest near lower tattered edge, pinned at waist/shoulders)
    const skirtArr = sPos.array as Float32Array;
    const ampSkirt = 0.022 + speedFactor * 0.026;
    for (let i = 0; i < skirtBasePos.length; i += 3) {
      const bx = skirtBasePos[i];
      const by = skirtBasePos[i + 1];
      const bz = skirtBasePos[i + 2];
      const weight = Math.max(0, 1 - by / 1.05);
      if (weight <= 0.01) continue;
      const w2 = weight * weight;
      const wave =
        Math.sin(elapsed * waveFreq + bx * 7.5 + bz * 6.5) * ampSkirt +
        Math.cos(elapsed * (waveFreq * 1.45) - by * 5.2 + bz * 5.0) * (ampSkirt * 0.45);
      skirtArr[i] = bx + wave * w2;
      skirtArr[i + 2] = bz - speedFactor * 0.07 * w2 + wave * 0.75 * w2;
    }
    sPos.needsUpdate = true;

    // 2. Trailing pallu cloth flutter
    const trailArr = tPos.array as Float32Array;
    const ampTrail = 0.036 + speedFactor * 0.038;
    for (let i = 0; i < trailBasePos.length; i += 3) {
      const bx = trailBasePos[i];
      const by = trailBasePos[i + 1];
      const bz = trailBasePos[i + 2];
      const droop = Math.max(0, (0.46 - by) / 0.92);
      const flutter = Math.sin(elapsed * (waveFreq + 1.4) - droop * 5.5 + bx * 4) * ampTrail * droop;
      trailArr[i] = bx + flutter * 0.45;
      trailArr[i + 2] = bz + flutter - speedFactor * 0.09 * droop;
    }
    tPos.needsUpdate = true;

    // 3. Translucent rear bridal shroud billow
    const bvArr = bvPos.array as Float32Array;
    for (let i = 0; i < backVeilBasePos.length; i += 3) {
      const bx = backVeilBasePos[i];
      const by = backVeilBasePos[i + 1];
      const bz = backVeilBasePos[i + 2];
      const droop = Math.max(0, (0.56 - by) / 1.12);
      const billow = Math.sin(elapsed * (waveFreq + 0.8) - droop * 4.8 + bx * 5.0) * (0.04 + speedFactor * 0.04) * droop;
      bvArr[i + 2] = bz + billow - speedFactor * 0.14 * droop;
    }
    bvPos.needsUpdate = true;

    // 4. Flowing dark hair strand tips swaying
    const ampHair = 0.018 + speedFactor * 0.022;
    for (let h = 0; h < hairLocks.length; h++) {
      const entry = hairLocks[h];
      const attr = entry.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const base = entry.basePos;
      const halfLen = entry.length * 0.5;
      for (let i = 0; i < base.length; i += 3) {
        const by = base[i + 1];
        const droop = Math.max(0, (halfLen - by) / entry.length);
        if (droop < 0.12) continue;
        const sway = Math.sin(elapsed * (waveFreq + 1.8) + entry.phase - droop * 4.5) * ampHair * droop * droop;
        arr[i] = base[i] + sway * 0.5;
        arr[i + 2] = base[i + 2] + sway;
      }
      attr.needsUpdate = true;
    }
  };

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    hairGroup,
    sareeMaterial,
    skinMaterial,
    hairMaterial,
    faceMaterial,
    shantiHalo,
    shantiParticles,
    shantiVelocities: pVelocities,
    setDissolve,
    updateClothWave,
  };
}

/**
 * 4 distinct composite sacred ritual item models matching Reference Image 2.
 */
export function createRitualItemModel(
  id: RitualItemId,
  textures: ProceduralTexturePack
): { group: THREE.Group; auraRing: THREE.Mesh; flameMesh?: THREE.Mesh } {
  const group = new THREE.Group();

  const brassMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    bumpMap: textures.brassBump,
    bumpScale: 0.018,
    roughnessMap: textures.brassRoughness,
    color: 0xc89e4b,
    roughness: 0.34,
    metalness: 0.88,
  });

  let flameMesh: THREE.Mesh | undefined;

  if (id === 'kalash') {
    // Lathe-turned antique hammered brass pot
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.09, 0.0),
      new THREE.Vector2(0.145, 0.08),
      new THREE.Vector2(0.155, 0.16),
      new THREE.Vector2(0.085, 0.24),
      new THREE.Vector2(0.115, 0.28),
      new THREE.Vector2(0.1, 0.29),
    ];
    const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), brassMat);
    pot.castShadow = true;
    group.add(pot);

    // 5 curved mango leaves tucked into neck
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2a4a24,
      roughness: 0.62,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 4), leafMat);
      leaf.scale.set(1, 1, 0.25);
      leaf.position.set(Math.cos(a) * 0.08, 0.31, Math.sin(a) * 0.08);
      leaf.rotation.y = -a + Math.PI / 2;
      leaf.rotation.x = 0.68;
      group.add(leaf);
    }

    // Fibrous brown coconut seated on top
    const cocoMat = new THREE.MeshStandardMaterial({
      color: 0x563924,
      roughness: 0.94,
      metalness: 0.02,
    });
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), cocoMat);
    coconut.scale.set(0.88, 1.18, 0.88);
    coconut.position.y = 0.33;
    group.add(coconut);
  } else if (id === 'chunri') {
    // Draped crimson sacred cloth folds with tarnished gold zari border
    const clothMat = new THREE.MeshStandardMaterial({
      color: 0x8f1a22,
      bumpMap: textures.sareeBump,
      bumpScale: 0.02,
      roughness: 0.82,
      metalness: 0.06,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4a446,
      roughness: 0.34,
      metalness: 0.78,
    });

    const baseFold = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.24), clothMat);
    baseFold.position.y = 0.03;
    baseFold.rotation.y = 0.2;
    group.add(baseFold);

    const midFold = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.05, 0.2), clothMat);
    midFold.position.set(0.02, 0.07, -0.01);
    midFold.rotation.set(0.06, -0.18, 0.08);
    group.add(midFold);

    const topFold = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.16), clothMat);
    topFold.position.set(-0.02, 0.105, 0.01);
    topFold.rotation.set(-0.08, 0.35, -0.05);
    group.add(topFold);

    // Gold zari border accent ribbons
    const trim1 = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.016, 0.035), goldMat);
    trim1.position.set(0, 0.056, 0.11);
    trim1.rotation.y = 0.2;
    group.add(trim1);

    const trim2 = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.014, 0.028), goldMat);
    trim2.position.set(-0.02, 0.128, 0.07);
    trim2.rotation.y = 0.35;
    group.add(trim2);
  } else if (id === 'diya') {
    // Pedestal brass oil lamp matching Reference 2
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.075, 0.0),
      new THREE.Vector2(0.03, 0.035),
      new THREE.Vector2(0.022, 0.09),
      new THREE.Vector2(0.095, 0.135),
      new THREE.Vector2(0.11, 0.155),
      new THREE.Vector2(0.085, 0.145),
    ];
    const lamp = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), brassMat);
    lamp.castShadow = true;
    group.add(lamp);

    // Glowing teardrop flame
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc65c });
    flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.1, 8), flameMat);
    flameMesh.position.set(0, 0.2, 0);
    group.add(flameMesh);

    // Soft warm local point light for the glowing diya
    const light = new THREE.PointLight(0xff9a38, 1.35, 3.6, 2);
    light.position.set(0, 0.24, 0);
    group.add(light);
  } else {
    // Havan Samagri stone bowl heaped with dark herbs & marigold petals
    const bowlMat = new THREE.MeshStandardMaterial({
      color: 0x3b3530,
      roughness: 0.9,
      metalness: 0.08,
    });
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.09, 0.0),
      new THREE.Vector2(0.145, 0.07),
      new THREE.Vector2(0.17, 0.13),
      new THREE.Vector2(0.15, 0.13),
      new THREE.Vector2(0.11, 0.05),
      new THREE.Vector2(0.0, 0.04),
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), bowlMat);
    bowl.castShadow = true;
    group.add(bowl);

    // Heaped herbal samagri mound
    const herbMat = new THREE.MeshStandardMaterial({
      color: 0x4b3522,
      roughness: 0.96,
      metalness: 0.02,
    });
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), herbMat);
    mound.scale.set(1, 0.58, 1);
    mound.position.y = 0.08;
    group.add(mound);

    // Marigold petal flecks & camphor chunks on top
    const marigoldMat = new THREE.MeshStandardMaterial({ color: 0xe67a1e, roughness: 0.78 });
    const camphorMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d0, roughness: 0.45 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const speck = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.018, 0),
        i % 2 === 0 ? marigoldMat : camphorMat
      );
      speck.position.set(Math.cos(a) * 0.06, 0.135, Math.sin(a) * 0.06);
      group.add(speck);
    }
  }

  // Subtle golden hint aura ring (only visible when 60s hint triggers or gentle proximity shimmer)
  const auraGeo = new THREE.RingGeometry(0.22, 0.3, 24);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffb84d,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.position.y = 0.015;
  group.add(auraRing);

  addContactShadow(group, textures.contactShadow, 0.24, 0.008);

  return { group, auraRing, flameMesh };
}

/**
 * Ancient stepped stone Havan Kund in the center of the Aangan (matching Reference 1).
 */
export function createHavanKund(textures: ProceduralTexturePack): HavanKundRig {
  const root = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.046,
    roughnessMap: textures.stoneRoughness,
    roughness: 0.88,
    metalness: 0.06,
    color: 0x776f65,
  });

  // 3 stepped sandstone tiers
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 2.5), stoneMat);
  tier1.position.y = 0.11;
  tier1.receiveShadow = true;
  tier1.castShadow = true;
  root.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 1.95), stoneMat);
  tier2.position.y = 0.33;
  tier2.receiveShadow = true;
  tier2.castShadow = true;
  root.add(tier2);

  // Outer stone rim framing recessed ash pit
  const rimParts: Array<[number, number, number, number, number, number]> = [
    [1.46, 0.2, 0.24, 0, 0.54, 0.61],
    [1.46, 0.2, 0.24, 0, 0.54, -0.61],
    [0.24, 0.2, 0.98, 0.61, 0.54, 0],
    [0.24, 0.2, 0.98, -0.61, 0.54, 0],
  ];
  rimParts.forEach(([w, h, d, x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  });

  // Ash bed & crossed dried ritual firewood inside pit
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x1e1d1c, roughness: 0.98 });
  const ashBed = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.08, 0.98), ashMat);
  ashBed.position.y = 0.45;
  root.add(ashBed);

  const logMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    roughness: 0.92,
    color: 0x453022,
  });
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.72, 7), logMat);
    const a = (i / 6) * Math.PI * 2;
    log.position.set(Math.cos(a) * 0.14, 0.53 + (i % 2) * 0.05, Math.sin(a) * 0.14);
    log.rotation.z = Math.PI / 2 - 0.28;
    log.rotation.y = a;
    root.add(log);
  }

  // 4 corner earthen diyas flickering warmly (matching Reference 1)
  const cornerFlames: THREE.Mesh[] = [];
  const clayMat = new THREE.MeshStandardMaterial({ color: 0x7c452b, roughness: 0.85 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa838 });
  const corners = [
    [-0.74, -0.74],
    [0.74, -0.74],
    [-0.74, 0.74],
    [0.74, 0.74],
  ];
  corners.forEach(([cx, cz]) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.045, 0.045, 10), clayMat);
    cup.position.set(cx, 0.46, cz);
    root.add(cup);

    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.11, 7), flameMat);
    fl.position.set(cx, 0.53, cz);
    root.add(fl);
    cornerFlames.push(fl);
  });

  // 4 item placement slots around the Havan Kund edge
  const slotPositions: Record<RitualItemId, [number, number, number]> = {
    kalash: [-0.92, 0.22, 0],
    chunri: [0.92, 0.22, 0],
    diya: [0, 0.22, 0.92],
    samagri: [0, 0.22, -0.92],
  };
  const itemSlots = {} as Record<RitualItemId, THREE.Group>;
  (Object.keys(slotPositions) as RitualItemId[]).forEach((id) => {
    const slot = new THREE.Group();
    const [sx, sy, sz] = slotPositions[id];
    slot.position.set(sx, sy, sz);
    const model = createRitualItemModel(id, textures).group;
    model.scale.setScalar(0.88);
    slot.add(model);
    slot.visible = false;
    root.add(slot);
    itemSlots[id] = slot;
  });

  // Scattered marigold petals around the Kund (InstancedMesh!)
  const petalCount = 110;
  const petalGeo = new THREE.DodecahedronGeometry(0.048, 0);
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xe66f14,
    roughness: 0.78,
    metalness: 0.02,
  });
  const petals = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < petalCount; i++) {
    const a = (i * 2.39996) % (Math.PI * 2);
    const r = 1.35 + ((i * 37) % 100) / 100 * 1.45;
    dummy.position.set(Math.cos(a) * r, 0.028, Math.sin(a) * r);
    dummy.rotation.set(i * 0.4, i * 1.1, i * 0.3);
    const sc = 0.65 + ((i * 19) % 10) * 0.07;
    dummy.scale.set(sc, sc * 0.52, sc);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.07 + ((i % 5) * 0.012), 0.9, 0.46 + (i % 3) * 0.06);
    petals.setColorAt(i, tint);
  }
  petals.instanceMatrix.needsUpdate = true;
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  petals.computeBoundingSphere();
  root.add(petals);

  // Broken clay pots near base (matching Reference 1)
  const potPositions: Array<[number, number, number]> = [
    [-1.48, 0.14, 0.85],
    [1.45, 0.13, -0.78],
    [1.22, 0.13, 1.32],
  ];
  potPositions.forEach(([px, py, pz], i) => {
    const matka = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), clayMat);
    matka.position.set(px, py, pz);
    matka.rotation.z = 0.8 + i * 0.5;
    matka.scale.set(1, 0.85, 1);
    root.add(matka);
  });

  // Roaring Final Ritual Fire Group
  const fireGroup = new THREE.Group();
  fireGroup.position.set(0, 0.55, 0);
  fireGroup.visible = false;
  root.add(fireGroup);

  const outerFireMat = new THREE.MeshBasicMaterial({
    color: 0xff6b1a,
    transparent: true,
    opacity: 0.85,
  });
  const innerFireMat = new THREE.MeshBasicMaterial({
    color: 0xffe48c,
    transparent: true,
    opacity: 0.94,
  });
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.28 - i * 0.03, 0.95 + (i % 2) * 0.25, 7),
      i < 3 ? outerFireMat : innerFireMat
    );
    const a = (i / 5) * Math.PI * 2;
    cone.position.set(Math.cos(a) * 0.12, 0.42, Math.sin(a) * 0.12);
    fireGroup.add(cone);
  }

  // Warm central fire point light (starts as soft diya glow, intensifies massively in climax/ending)
  const fireLight = new THREE.PointLight(0xff9234, 2.2, 11, 1.7);
  fireLight.position.set(0, 1.05, 0);
  fireLight.castShadow = false;
  root.add(fireLight);

  // Dual-Layer Towering Heavenly Moksha Pillar of Light (Core + Volumetric Outer Beam)
  const beamGeo = new THREE.CylinderGeometry(0.65, 1.35, 16.0, 24, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c2,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shantiBeam = new THREE.Mesh(beamGeo, beamMat);
  shantiBeam.position.y = 8.1;
  shantiBeam.visible = false;
  root.add(shantiBeam);

  const outerBeamGeo = new THREE.CylinderGeometry(1.45, 2.75, 16.5, 24, 1, true);
  const outerBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffb84d,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shantiOuterBeam = new THREE.Mesh(outerBeamGeo, outerBeamMat);
  shantiOuterBeam.position.y = 8.2;
  shantiOuterBeam.visible = false;
  root.add(shantiOuterBeam);

  // 3 Expanding Golden Courtyard Shockwave Rings (movie-style purifying waves!)
  const shockwaveRings: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phaseOffset: number }> =
    [0, 0.33, 0.66].map((phaseOffset) => {
      const rGeo = new THREE.RingGeometry(0.85, 1.15, 40);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xffd275,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(rGeo, rMat);
      mesh.position.y = 0.12;
      mesh.visible = false;
      root.add(mesh);
      return { mesh, mat: rMat, phaseOffset };
    });

  // 180 Swirling Golden Marigold & Ember Vortex Particles rising around the Havan Kund
  const vortexCount = 180;
  const vortexAngles = new Float32Array(vortexCount);
  const vortexRadii = new Float32Array(vortexCount);
  const vortexHeights = new Float32Array(vortexCount);
  const vortexPositions = new Float32Array(vortexCount * 3);
  for (let i = 0; i < vortexCount; i++) {
    vortexAngles[i] = (i / vortexCount) * Math.PI * 10;
    vortexRadii[i] = 1.05 + (i % 15) * 0.16;
    vortexHeights[i] = (i / vortexCount) * 7.5;
    vortexPositions[i * 3] = Math.cos(vortexAngles[i]) * vortexRadii[i];
    vortexPositions[i * 3 + 1] = vortexHeights[i];
    vortexPositions[i * 3 + 2] = Math.sin(vortexAngles[i]) * vortexRadii[i];
  }
  const vortexGeo = new THREE.BufferGeometry();
  vortexGeo.setAttribute('position', new THREE.BufferAttribute(vortexPositions, 3));
  const vortexMat = new THREE.PointsMaterial({
    color: 0xffc65c,
    map: textures.softParticle,
    size: 0.14,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const vortexPoints = new THREE.Points(vortexGeo, vortexMat);
  vortexPoints.visible = false;
  root.add(vortexPoints);

  // Subtle guidance ring when player holds an item or hint triggers
  const auraGeo = new THREE.RingGeometry(1.55, 1.74, 32);
  auraGeo.rotateX(-Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffbd4a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const auraRing = new THREE.Mesh(auraGeo, auraMat);
  auraRing.position.y = 0.03;
  root.add(auraRing);

  const update = (time: number, climaxActive: boolean, shantiProgress: number, hintActive: boolean) => {
    const flick = 0.88 + Math.sin(time * 13.7) * 0.08 + Math.sin(time * 27.3) * 0.05;
    cornerFlames.forEach((f, idx) => {
      const s = 0.85 + Math.sin(time * 15 + idx * 1.9) * 0.16;
      f.scale.set(1, s, 1);
    });

    if (shantiProgress > 0.005) {
      fireGroup.visible = true;
      shantiBeam.visible = true;
      shantiOuterBeam.visible = true;
      vortexPoints.visible = true;

      const beamCurve = Math.sin(Math.min(1, shantiProgress) * Math.PI);
      const beamPulse = 0.92 + Math.sin(time * 6.5) * 0.08;
      beamMat.opacity = Math.min(0.55, (0.2 + beamCurve * 0.45) * beamPulse);
      outerBeamMat.opacity = Math.min(0.28, (0.1 + beamCurve * 0.22) * beamPulse);
      shantiBeam.scale.set(0.85 + shantiProgress * 0.55, 1, 0.85 + shantiProgress * 0.55);
      shantiOuterBeam.scale.set(0.8 + shantiProgress * 0.7, 1, 0.8 + shantiProgress * 0.7);
      shantiOuterBeam.rotation.y = time * 0.35;

      // Animate 3 expanding courtyard lotus shockwaves
      shockwaveRings.forEach((ring) => {
        ring.mesh.visible = true;
        const cycle = (shantiProgress * 2.4 + ring.phaseOffset) % 1;
        const sc = 1.0 + cycle * 9.5;
        ring.mesh.scale.setScalar(sc);
        ring.mat.opacity = Math.sin(cycle * Math.PI) * 0.48 * (1 - shantiProgress * 0.35);
      });

      // Animate swirling upward golden ember vortex
      const posAttr = vortexGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < vortexCount; i++) {
        const y = (vortexHeights[i] + time * 1.65) % 8.2;
        const ang = vortexAngles[i] + time * 1.45 + y * 0.45;
        const r = vortexRadii[i] * (0.75 + y * 0.12);
        posAttr.setXYZ(i, Math.cos(ang) * r, 0.35 + y, Math.sin(ang) * r);
      }
      posAttr.needsUpdate = true;
      vortexMat.opacity = Math.min(0.95, 0.25 + beamCurve * 0.75);

      fireLight.color.setHex(0xffdf8e);
      fireLight.intensity = 9.0 + beamCurve * 16;
      fireLight.distance = 32;
      fireGroup.scale.setScalar(1.35 + Math.sin(time * 9) * 0.12 + shantiProgress * 0.45);
    } else if (climaxActive) {
      fireGroup.visible = true;
      shantiBeam.visible = false;
      shantiOuterBeam.visible = false;
      vortexPoints.visible = false;
      shockwaveRings.forEach((r) => (r.mesh.visible = false));
      fireGroup.children.forEach((child, idx) => {
        const s = 0.85 + Math.sin(time * 18 + idx * 2.1) * 0.25;
        child.scale.set(1, s, 1);
      });
      fireLight.color.setHex(0xff8424);
      fireLight.intensity = (6.8 + Math.sin(time * 19) * 1.6) * flick;
      fireLight.distance = 22;
    } else {
      fireGroup.visible = false;
      shantiBeam.visible = false;
      shantiOuterBeam.visible = false;
      vortexPoints.visible = false;
      shockwaveRings.forEach((r) => (r.mesh.visible = false));
      fireLight.color.setHex(0xff8f32);
      fireLight.intensity = 2.4 * flick;
      fireLight.distance = 12;
    }

    auraMat.opacity = hintActive ? 0.22 + Math.sin(time * 3.5) * 0.14 : 0;
  };

  return {
    root,
    fireGroup,
    fireLight,
    shantiBeam,
    cornerFlames,
    itemSlots,
    auraRing,
    update,
  };
}

/**
 * Climb-in 1980s North Indian carved wooden almirah (wardrobe) for hiding.
 */
export function createAlmirah(
  id: string,
  room: string,
  pos: THREE.Vector3,
  facingYaw: number,
  textures: ProceduralTexturePack
): AlmirahRig {
  const root = new THREE.Group();
  root.position.copy(pos);
  root.rotation.y = facingYaw;

  const shared = getSharedPropAssets(textures);
  const woodMat = shared.woodMat;
  const trimMat = shared.woodTrimMat;
  const brassMat = shared.brassMat;

  const w = 1.28;
  const h = 2.28;
  const d = 0.96;

  // Back, left, right, top, bottom panels leaving front interior hollow
  const back = new THREE.Mesh(shared.almBackGeo, woodMat);
  back.position.set(0, h / 2, -d / 2 + 0.04);
  back.castShadow = true;
  back.receiveShadow = true;
  root.add(back);

  const leftSide = new THREE.Mesh(shared.almSideGeo, woodMat);
  leftSide.position.set(-w / 2 + 0.04, h / 2, 0);
  leftSide.castShadow = true;
  root.add(leftSide);

  const rightSide = new THREE.Mesh(shared.almSideGeo, woodMat);
  rightSide.position.set(w / 2 - 0.04, h / 2, 0);
  rightSide.castShadow = true;
  root.add(rightSide);

  const topCrown = new THREE.Mesh(shared.almCrownGeo, trimMat);
  topCrown.position.set(0, h + 0.04, 0.02);
  root.add(topCrown);

  const basePlinth = new THREE.Mesh(shared.almPlinthGeo, trimMat);
  basePlinth.position.set(0, 0.06, 0);
  root.add(basePlinth);

  // Articulated double doors with louvered eye-level peek slats
  const doorW = (w - 0.18) / 2;
  const doorH = h - 0.2;

  const buildDoor = (isLeft: boolean): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -w / 2 + 0.08 : w / 2 - 0.08, 0.12, d / 2 - 0.04);
    const xOff = isLeft ? doorW / 2 : -doorW / 2;

    const lower = new THREE.Mesh(shared.almLowerDoorGeo, woodMat);
    lower.position.set(xOff, doorH * 0.31, 0);
    lower.castShadow = true;
    pivot.add(lower);

    const leftStile = new THREE.Mesh(shared.almStileGeo, trimMat);
    leftStile.position.set(xOff - doorW / 2 + 0.035, doorH * 0.81, 0);
    pivot.add(leftStile);

    const rightStile = new THREE.Mesh(shared.almStileGeo, trimMat);
    rightStile.position.set(xOff + doorW / 2 - 0.035, doorH * 0.81, 0);
    pivot.add(rightStile);

    const topRail = new THREE.Mesh(shared.almTopRailGeo, trimMat);
    topRail.position.set(xOff, doorH - 0.045, 0);
    pivot.add(topRail);

    for (let s = 0; s < 5; s++) {
      const slat = new THREE.Mesh(shared.almSlatGeo, woodMat);
      slat.position.set(xOff, doorH * 0.65 + s * 0.12, 0);
      slat.rotation.x = 0.25;
      pivot.add(slat);
    }

    const handle = new THREE.Mesh(shared.almHandleGeo, brassMat);
    handle.position.set(isLeft ? doorW - 0.065 : -doorW + 0.065, doorH * 0.5, 0.045);
    pivot.add(handle);

    return pivot;
  };

  const leftDoorPivot = buildDoor(true);
  const rightDoorPivot = buildDoor(false);
  root.add(leftDoorPivot, rightDoorPivot);

  addContactShadow(root, textures.contactShadow, 0.82, 0.01);

  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), facingYaw);
  const insidePos = pos.clone().addScaledVector(forward, 0.04);
  const exitPos = pos.clone().addScaledVector(forward, 1.15);

  return {
    id,
    room,
    root,
    leftDoorPivot,
    rightDoorPivot,
    insidePos,
    exitPos,
    facingYaw,
    doorOpenAmount: 0,
    doorSwingBoost: 0,
  };
}

/**
 * Multi-part 1980s vintage Indian metal flashlight held on lower-right:
 * knurled metal grip, weathered brass tail-cap & locking collar, slide power switch,
 * fluted flared reflector head, chrome parabolic dish, glowing tungsten filament bulb,
 * dual-layer warm volumetric cone, localized beam dust motes, and Holy Ward Spark Bash VFX.
 */
export function createFlashlightViewModel(textures: ProceduralTexturePack): FlashlightRig {
  const viewGroup = new THREE.Group();

  const knurledBodyMat = new THREE.MeshStandardMaterial({
    map: textures.torchGripColor,
    bumpMap: textures.torchGripBump,
    bumpScale: 0.018,
    roughnessMap: textures.torchGripRoughness,
    color: 0x8e959c,
    roughness: 0.44,
    metalness: 0.84,
  });

  const headMetalMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.01,
    roughnessMap: textures.ironRoughness,
    color: 0x5c6268,
    roughness: 0.36,
    metalness: 0.88,
  });

  const brassAccentMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    bumpMap: textures.brassBump,
    bumpScale: 0.012,
    roughnessMap: textures.brassRoughness,
    color: 0xc29a49,
    roughness: 0.36,
    metalness: 0.88,
  });

  const reflectorMat = new THREE.MeshStandardMaterial({
    color: 0xe6eef2,
    roughness: 0.12,
    metalness: 0.96,
    side: THREE.DoubleSide,
  });

  const bulbMat = new THREE.MeshBasicMaterial({
    color: 0xfff4d4,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xfff1cf,
    emissive: 0xffd58a,
    emissiveIntensity: 1.45,
    roughness: 0.1,
    metalness: 0.08,
    transparent: true,
    opacity: 0.62,
  });

  const flashlightBodyGroup = new THREE.Group();
  viewGroup.add(flashlightBodyGroup);

  // 1. Corrugated knurled cylindrical metal barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.029, 0.25, 18), knurledBodyMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.015;
  flashlightBodyGroup.add(barrel);

  // 2. Weathered brass rear tail-cap & hanging D-ring
  const tailCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0315, 0.03, 0.036, 16), brassAccentMat);
  tailCap.rotation.x = Math.PI / 2;
  tailCap.position.z = 0.15;
  flashlightBodyGroup.add(tailCap);

  const lanyardRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 6, 14), brassAccentMat);
  lanyardRing.position.set(0, -0.008, 0.174);
  lanyardRing.rotation.x = 0.35;
  flashlightBodyGroup.add(lanyardRing);

  // 3. Brass locking collar rings & top thumb-slide power switch housing
  const collarRear = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.014, 16), brassAccentMat);
  collarRear.rotation.x = Math.PI / 2;
  collarRear.position.z = 0.115;
  flashlightBodyGroup.add(collarRear);

  const collarFront = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.033, 0.016, 16), brassAccentMat);
  collarFront.rotation.x = Math.PI / 2;
  collarFront.position.z = -0.105;
  flashlightBodyGroup.add(collarFront);

  const switchTrack = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, 0.056), headMetalMat);
  switchTrack.position.set(0, 0.033, -0.055);
  flashlightBodyGroup.add(switchTrack);

  const switchNub = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.009, 0.02), brassAccentMat);
  switchNub.position.set(0, 0.039, -0.065);
  flashlightBodyGroup.add(switchNub);

  // 4. Lathe-turned flared vintage reflector head (Eveready stepped bell silhouette)
  const headProfile = [
    new THREE.Vector2(0.031, 0.0),
    new THREE.Vector2(0.036, 0.016),
    new THREE.Vector2(0.052, 0.058),
    new THREE.Vector2(0.058, 0.072),
    new THREE.Vector2(0.058, 0.088),
    new THREE.Vector2(0.052, 0.092),
  ];
  const headGeo = new THREE.LatheGeometry(headProfile, 20);
  headGeo.rotateX(-Math.PI / 2);
  const head = new THREE.Mesh(headGeo, headMetalMat);
  head.position.z = -0.11;
  flashlightBodyGroup.add(head);

  // Brass bezel ring around front lens rim
  const frontBezel = new THREE.Mesh(new THREE.TorusGeometry(0.0545, 0.0045, 8, 20), brassAccentMat);
  frontBezel.position.z = -0.201;
  flashlightBodyGroup.add(frontBezel);

  // 5. Recessed parabolic metallic reflector dish + glowing tungsten bulb
  const dishProfile = [
    new THREE.Vector2(0.006, 0.0),
    new THREE.Vector2(0.022, 0.012),
    new THREE.Vector2(0.04, 0.034),
    new THREE.Vector2(0.05, 0.054),
  ];
  const dishGeo = new THREE.LatheGeometry(dishProfile, 18);
  dishGeo.rotateX(-Math.PI / 2);
  const dish = new THREE.Mesh(dishGeo, reflectorMat);
  dish.position.z = -0.145;
  flashlightBodyGroup.add(dish);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), bulbMat);
  bulb.position.z = -0.162;
  flashlightBodyGroup.add(bulb);

  // Protective warm glass lens cap
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.051, 18), lensMat);
  lens.position.z = -0.2;
  lens.rotation.y = Math.PI;
  flashlightBodyGroup.add(lens);

  // 5B. Composite Sacred Iron Trishul & Flaming Mashal (equipped in Chapter 2 at the Shiva Shrine)
  const trishulGroup = new THREE.Group();
  trishulGroup.visible = false;
  trishulGroup.position.set(0.02, -0.02, -0.04);
  trishulGroup.rotation.set(-0.24, 0.06, -0.04);

  const forgedIronMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.022,
    roughnessMap: textures.ironRoughness,
    color: 0x4b5158,
    roughness: 0.42,
    metalness: 0.86,
  });
  const saffronWrapMat = new THREE.MeshStandardMaterial({
    color: 0xa82e14,
    roughness: 0.88,
    metalness: 0.04,
  });

  // Main forged iron shaft extending forward and up
  const tShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.62, 10), forgedIronMat);
  tShaft.rotation.x = Math.PI / 2;
  tShaft.position.z = -0.12;
  trishulGroup.add(tShaft);

  // Saffron sacred cloth wrap around grip & flaming oil-soaked mashal collar
  const tGripWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), saffronWrapMat);
  tGripWrap.rotation.x = Math.PI / 2;
  tGripWrap.position.z = 0.05;
  trishulGroup.add(tGripWrap);

  const mashalWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.09, 10), saffronWrapMat);
  mashalWrap.rotation.x = Math.PI / 2;
  mashalWrap.position.z = -0.27;
  trishulGroup.add(mashalWrap);

  // Brass damaru (small hourglass drum) tied below the trident crescent
  const damaruTop = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.036, 8), brassAccentMat);
  damaruTop.position.set(0.028, -0.01, -0.2);
  damaruTop.rotation.z = Math.PI / 2;
  const damaruBot = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.036, 8), brassAccentMat);
  damaruBot.position.set(0.062, -0.01, -0.2);
  damaruBot.rotation.z = -Math.PI / 2;
  trishulGroup.add(damaruTop, damaruBot);

  // Curved crescent cross-guard + 3 razor-sharp iron trident prongs
  const crescent = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.011, 8, 16, Math.PI),
    forgedIronMat
  );
  crescent.rotation.x = Math.PI / 2;
  crescent.rotation.z = Math.PI;
  crescent.position.z = -0.36;
  trishulGroup.add(crescent);

  const centerProng = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.24, 6), forgedIronMat);
  centerProng.rotation.x = -Math.PI / 2;
  centerProng.position.z = -0.5;
  trishulGroup.add(centerProng);

  [-0.072, 0.072].forEach((px) => {
    const sideProng = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.17, 6), forgedIronMat);
    sideProng.rotation.x = -Math.PI / 2;
    sideProng.rotation.z = px > 0 ? -0.14 : 0.14;
    sideProng.position.set(px, 0, -0.45);
    trishulGroup.add(sideProng);
  });

  // Blazing animated sacred Dhuni mashal flame hugging the upper collar
  const trishulFlameMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.044, 0.15, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffa634,
      transparent: true,
      opacity: 0.9,
    })
  );
  trishulFlameMesh.position.set(0, 0.068, -0.27);
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.024, 0.095, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff0b2 })
  );
  innerFlame.position.y = -0.018;
  trishulFlameMesh.add(innerFlame);
  trishulGroup.add(trishulFlameMesh);

  const trishulFlameLight = new THREE.PointLight(0xff9b38, 0, 7.5, 1.8);
  trishulFlameLight.position.set(0, 0.1, -0.28);
  trishulFlameLight.castShadow = false;
  trishulGroup.add(trishulFlameLight);

  viewGroup.add(trishulGroup);

  // Position in lower-right foreground of FPS camera
  viewGroup.position.set(0.28, -0.22, -0.44);
  viewGroup.rotation.set(0.06, -0.09, 0.05);

  // 6. Dual-layer warm tungsten volumetric translucent beam cone
  const outerBeamGeo = new THREE.ConeGeometry(0.96, 5.8, 18, 1, true);
  outerBeamGeo.translate(0, -2.9, 0);
  outerBeamGeo.rotateX(Math.PI / 2);
  const outerBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffdfa2,
    transparent: true,
    opacity: 0.048,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beamMesh = new THREE.Mesh(outerBeamGeo, outerBeamMat);
  beamMesh.position.set(0, 0, -0.21);
  viewGroup.add(beamMesh);

  const innerBeamGeo = new THREE.ConeGeometry(0.42, 3.8, 14, 1, true);
  innerBeamGeo.translate(0, -1.9, 0);
  innerBeamGeo.rotateX(Math.PI / 2);
  const innerBeamMat = new THREE.MeshBasicMaterial({
    color: 0xfff0cc,
    transparent: true,
    opacity: 0.065,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerBeamMesh = new THREE.Mesh(innerBeamGeo, innerBeamMat);
  innerBeamMesh.position.set(0, 0, -0.21);
  viewGroup.add(innerBeamMesh);

  // 7. Floating dust motes visible directly inside the warm flashlight cone (zero GC)
  const beamDustCount = 46;
  const bdPositions = new Float32Array(beamDustCount * 3);
  const bdSeeds = new Float32Array(beamDustCount * 3);
  for (let i = 0; i < beamDustCount; i++) {
    const zDist = 0.55 + Math.random() * 4.4;
    const coneRad = 0.08 + (zDist / 5.2) * 0.72;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * coneRad;
    bdPositions[i * 3] = Math.cos(ang) * rad;
    bdPositions[i * 3 + 1] = Math.sin(ang) * rad;
    bdPositions[i * 3 + 2] = -0.22 - zDist;

    bdSeeds[i * 3] = Math.random() * Math.PI * 2;
    bdSeeds[i * 3 + 1] = 0.06 + Math.random() * 0.1;
    bdSeeds[i * 3 + 2] = 0.25 + Math.random() * 0.6;
  }
  const bdGeo = new THREE.BufferGeometry();
  bdGeo.setAttribute('position', new THREE.BufferAttribute(bdPositions, 3));
  const bdMat = new THREE.PointsMaterial({
    color: 0xffe8bd,
    map: textures.softParticle,
    size: 0.052,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beamDustPoints = new THREE.Points(bdGeo, bdMat);
  beamDustPoints.frustumCulled = false;
  viewGroup.add(beamDustPoints);

  const updateBeamDust = (dt: number, elapsed: number, highDetail: boolean) => {
    const activeCount = highDetail ? beamDustCount : 18;
    bdGeo.setDrawRange(0, activeCount);
    if (!beamDustPoints.visible) return;
    const posAttr = bdGeo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < activeCount; i++) {
      const i3 = i * 3;
      const phase = bdSeeds[i3];
      const rise = bdSeeds[i3 + 1];
      const sway = bdSeeds[i3 + 2];
      arr[i3] += Math.sin(elapsed * sway + phase) * dt * 0.045;
      arr[i3 + 1] += rise * dt * 0.38;
      const zAbs = Math.max(0.4, -arr[i3 + 2] - 0.22);
      const maxR = 0.08 + (zAbs / 5.2) * 0.72;
      if (arr[i3 + 1] > maxR) {
        arr[i3 + 1] = -maxR * 0.85;
      }
      if (Math.abs(arr[i3]) > maxR) {
        arr[i3] *= -0.75;
      }
    }
    posAttr.needsUpdate = true;
  };

  // 8. Golden Holy Ward Spark burst rig attached near bezel (preserved intact for Torch Bash)
  const sparkGroup = new THREE.Group();
  sparkGroup.position.set(0, 0, -0.22);
  sparkGroup.visible = false;
  viewGroup.add(sparkGroup);

  const sparkCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffe494,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparkCoreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), sparkCoreMat);
  sparkGroup.add(sparkCoreMesh);

  const sparkRayGeo = new THREE.BoxGeometry(0.014, 0.014, 0.14);
  const sparkRayMat = new THREE.MeshBasicMaterial({
    color: 0xffc14a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparkRays: Array<{ mesh: THREE.Mesh; dir: THREE.Vector3 }> = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tilt = i % 2 === 0 ? 0.28 : -0.28;
    const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), -0.55 + tilt).normalize();
    const mesh = new THREE.Mesh(sparkRayGeo, sparkRayMat);
    mesh.lookAt(dir);
    sparkGroup.add(mesh);
    sparkRays.push({ mesh, dir });
  }

  const sparkLight = new THREE.PointLight(0xffcb5c, 0, 6.2, 1.8);
  sparkLight.position.set(0, 0.04, -0.35);
  sparkLight.castShadow = false;
  viewGroup.add(sparkLight);

  // 9. Warm tungsten directional SpotLight contrasting against cold moonlit teal haze
  const spotLight = new THREE.SpotLight(0xffe0a8, 8.6, 24, Math.PI / 4.7, 0.58, 1.48);
  spotLight.position.set(0.18, -0.14, -0.25);
  spotLight.target.position.set(0, -0.05, -6);
  spotLight.castShadow = false;
  spotLight.shadow.mapSize.width = 512;
  spotLight.shadow.mapSize.height = 512;
  spotLight.shadow.camera.near = 0.25;
  spotLight.shadow.camera.far = 22;
  spotLight.shadow.bias = -0.001;

  const setWeaponMode = (mode: 'flashlight' | 'trishul') => {
    const isTrishul = mode === 'trishul';
    flashlightBodyGroup.visible = !isTrishul;
    trishulGroup.visible = isTrishul;
    if (!isTrishul) {
      trishulFlameLight.intensity = 0;
    }
  };

  return {
    viewGroup,
    flashlightBodyGroup,
    trishulGroup,
    trishulFlameMesh,
    trishulFlameLight,
    spotLight,
    beamMesh,
    innerBeamMesh,
    beamDustPoints,
    lensMat,
    bulbMat,
    switchNub,
    sparkGroup,
    sparkCoreMesh,
    sparkCoreMat,
    sparkRays,
    sparkRayMat,
    sparkLight,
    setWeaponMode,
    updateBeamDust,
  };
}

/**
 * Carved North Indian haveli wooden pillar with hanging antique brass bell (reuses shared geometries/materials).
 */
export function createCarvedPillarWithBell(
  height: number,
  textures: ProceduralTexturePack,
  withBell = true
): THREE.Group {
  const group = new THREE.Group();
  const shared = getSharedPropAssets(textures);

  const plinth = new THREE.Mesh(shared.pillarPlinthGeo, shared.stoneBaseMat);
  plinth.position.y = 0.17;
  plinth.receiveShadow = true;
  group.add(plinth);

  const shaftKey = `shaft_${height.toFixed(2)}`;
  let shaftGeo = shared.cylCache.get(shaftKey);
  if (!shaftGeo) {
    shaftGeo = new THREE.CylinderGeometry(0.15, 0.17, height - 0.72, 8);
    shared.cylCache.set(shaftKey, shaftGeo);
  }
  const shaft = new THREE.Mesh(shaftGeo, shared.woodMat);
  shaft.position.y = 0.34 + (height - 0.72) / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  [0.55, height - 0.75].forEach((ry) => {
    const ring = new THREE.Mesh(shared.pillarCollarGeo, shared.woodMat);
    ring.position.y = ry;
    group.add(ring);
  });

  const capital = new THREE.Mesh(shared.pillarCapitalGeo, shared.woodMat);
  capital.position.y = height - 0.22;
  group.add(capital);

  if (withBell) {
    const chain = new THREE.Mesh(shared.pillarChainGeo, shared.brassMat);
    chain.position.set(0.32, height - 0.54, 0);
    group.add(chain);

    const bell = new THREE.Mesh(shared.pillarBellGeo, shared.brassMat);
    bell.position.set(0.32, height - 0.92, 0);
    group.add(bell);
  }

  return group;
}

/**
 * Vintage weathered wooden table for ritual items & lore notes (reuses shared geometries/materials).
 */
export function createWoodenTable(textures: ProceduralTexturePack, width = 1.25, depth = 0.78): THREE.Group {
  const group = new THREE.Group();
  const shared = getSharedPropAssets(textures);

  const topKey = `top_${width.toFixed(2)}_${depth.toFixed(2)}`;
  let topGeo = shared.boxCache.get(topKey);
  if (!topGeo) {
    topGeo = new THREE.BoxGeometry(width, 0.07, depth);
    shared.boxCache.set(topKey, topGeo);
  }

  const top = new THREE.Mesh(topGeo, shared.woodMat);
  top.position.y = 0.78;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const lx = width / 2 - 0.09;
  const lz = depth / 2 - 0.09;
  [
    [-lx, -lz],
    [lx, -lz],
    [-lx, lz],
    [lx, lz],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(shared.tableLegGeo, shared.woodMat);
    leg.position.set(x, 0.38, z);
    leg.castShadow = true;
    group.add(leg);
  });

  addContactShadow(group, textures.contactShadow, Math.max(width, depth) * 0.65, 0.01);
  return group;
}

/**
 * Barred iron window with angled cold teal moonlight shaft (reuses shared geometries/materials).
 */
export function createMoonlightWindow(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const shared = getSharedPropAssets(textures);

  const moonGlass = new THREE.Mesh(shared.winGlassGeo, shared.windowGlassMat);
  group.add(moonGlass);

  const grill = new THREE.Mesh(shared.winGrillGeo, shared.windowGrillMat);
  grill.position.z = 0.04;
  group.add(grill);

  const topB = new THREE.Mesh(shared.winTopGeo, shared.windowFrameMat);
  topB.position.set(0, 0.98, 0.05);
  const botB = new THREE.Mesh(shared.winBotGeo, shared.windowFrameMat);
  botB.position.set(0, -0.98, 0.06);
  group.add(topB, botB);

  const shaft = new THREE.Mesh(shared.winShaftGeo, shared.windowShaftMat);
  shaft.position.set(0, -0.85, 1.65);
  shaft.rotation.x = -0.95;
  group.add(shaft);

  return group;
}

/**
 * Articulated carved-teak Haveli double-leaf wing door with iron strap hinges,
 * weathered brass knockers, and dynamic closed-state collision bounds.
 */
export function createHingedHaveliDoor(
  id: string,
  roomName: string,
  pos: THREE.Vector3,
  openingWidth: number,
  rotY: number,
  textures: ProceduralTexturePack,
  initiallyOpen = false
): HingedDoorRig {
  const root = new THREE.Group();
  root.position.copy(pos);
  root.rotation.y = rotY;

  const shared = getSharedPropAssets(textures);
  const doorH = 2.84;
  const clearSpan = Math.min(2.44, openingWidth - 0.52);
  const jambW = (openingWidth - clearSpan) * 0.5;
  const leafW = clearSpan * 0.5 - 0.015;

  // Carved wooden doorway side pilasters framing the archway cleanly
  if (jambW > 0.08) {
    const jambGeo = new THREE.BoxGeometry(jambW, doorH + 0.08, 0.36);
    [-1, 1].forEach((side) => {
      const jamb = new THREE.Mesh(jambGeo, shared.woodTrimMat);
      jamb.position.set(side * (clearSpan * 0.5 + jambW * 0.5), (doorH + 0.08) * 0.5, 0);
      jamb.receiveShadow = true;
      root.add(jamb);
    });
  }

  // Carved threshold lintel bar at top
  const headerBar = new THREE.Mesh(new THREE.BoxGeometry(clearSpan + 0.24, 0.14, 0.4), shared.woodTrimMat);
  headerBar.position.set(0, doorH + 0.06, 0);
  root.add(headerBar);

  const leafGeo = new THREE.BoxGeometry(leafW, doorH, 0.09);
  const trimRailGeo = new THREE.BoxGeometry(leafW - 0.14, 0.085, 0.115);
  const recessedPanelGeo = new THREE.BoxGeometry(leafW - 0.26, 0.86, 0.108);
  const strapHingeGeo = new THREE.BoxGeometry(0.42, 0.065, 0.118);
  const knockerRingGeo = new THREE.TorusGeometry(0.065, 0.014, 6, 14);
  const knockerPlateGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.125, 10);

  const buildLeaf = (isLeft: boolean): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -clearSpan * 0.5 : clearSpan * 0.5, 0, 0);
    const dir = isLeft ? 1 : -1;
    const xCenter = dir * (leafW * 0.5);

    const panel = new THREE.Mesh(leafGeo, shared.woodMat);
    panel.position.set(xCenter, doorH * 0.5, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    pivot.add(panel);

    // Carved cross rails & recessed Indian panel framing
    [0.14, 1.32, doorH - 0.14].forEach((ry) => {
      const rail = new THREE.Mesh(trimRailGeo, shared.woodTrimMat);
      rail.position.set(xCenter, ry, 0);
      pivot.add(rail);
    });

    [0.74, 2.04].forEach((py) => {
      const inset = new THREE.Mesh(recessedPanelGeo, shared.woodTrimMat);
      inset.position.set(xCenter, py, 0);
      pivot.add(inset);
    });

    // Rusted wrought-iron strap hinges along outer edge
    [0.52, 2.24].forEach((hy) => {
      const strap = new THREE.Mesh(strapHingeGeo, shared.ironMat);
      strap.position.set(dir * 0.22, hy, 0);
      pivot.add(strap);
    });

    // Weathered brass circular door-knocker & plate on both sides
    const innerEdgeX = dir * (leafW - 0.18);
    const plate = new THREE.Mesh(knockerPlateGeo, shared.brassMat);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(innerEdgeX, 1.32, 0);
    pivot.add(plate);

    [-0.075, 0.075].forEach((kz) => {
      const ring = new THREE.Mesh(knockerRingGeo, shared.brassMat);
      ring.position.set(innerEdgeX, 1.24, kz);
      pivot.add(ring);
    });

    return pivot;
  };

  const leftPivot = buildLeaf(true);
  const rightPivot = buildLeaf(false);
  root.add(leftPivot, rightPivot);

  const openAmount = initiallyOpen ? 1 : 0;
  const maxSwing = 1.56;
  leftPivot.rotation.y = openAmount * maxSwing;
  rightPivot.rotation.y = -openAmount * maxSwing;

  // Axis-aligned closed blocker box in world coordinates
  const rotated90 = Math.abs(Math.sin(rotY)) > 0.7;
  const halfW = rotated90 ? 0.22 : openingWidth * 0.48;
  const halfD = rotated90 ? openingWidth * 0.48 : 0.22;

  return {
    id,
    roomName,
    root,
    leftPivot,
    rightPivot,
    interactPos: pos.clone(),
    isOpen: initiallyOpen,
    openAmount,
    ghostPushCooldown: 0,
    closedBox: {
      minX: pos.x - halfW,
      maxX: pos.x + halfW,
      minZ: pos.z - halfD,
      maxZ: pos.z + halfD,
    },
  };
}

/**
 * Heavy 1984 rusted wrought-iron barred main entrance gate with brass lock & chain.
 */
export function createRustedIronGate(textures: ProceduralTexturePack): THREE.Group {
  const group = new THREE.Group();
  const shared = getSharedPropAssets(textures);

  const gateW = 2.85;
  const gateH = 3.05;

  // Flanking weathered sandstone piers
  const pierGeo = new THREE.BoxGeometry(0.32, gateH + 0.16, 0.34);
  [-gateW * 0.5 - 0.12, gateW * 0.5 + 0.12].forEach((px) => {
    const pier = new THREE.Mesh(pierGeo, shared.stoneBaseMat);
    pier.position.set(px, (gateH + 0.16) * 0.5, 0);
    group.add(pier);
  });

  // Heavy dark iron backing recess + outer forged steel frame
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(gateW, gateH),
    new THREE.MeshBasicMaterial({ color: 0x03080a })
  );
  backing.position.set(0, gateH * 0.5, 0.14);
  backing.rotation.y = Math.PI;
  group.add(backing);

  // Horizontal rusted iron crossbars
  [0.14, 1.48, gateH - 0.14].forEach((hy) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(gateW, 0.1, 0.08), shared.ironMat);
    rail.position.set(0, hy, 0);
    group.add(rail);
  });

  // Vertical forged iron bars with spear-point finials
  const barCount = 11;
  const barGeo = new THREE.CylinderGeometry(0.024, 0.024, gateH - 0.18, 6);
  const finialGeo = new THREE.ConeGeometry(0.044, 0.16, 4);
  for (let i = 0; i < barCount; i++) {
    const bx = -gateW * 0.46 + (i / (barCount - 1)) * (gateW * 0.92);
    const bar = new THREE.Mesh(barGeo, shared.ironMat);
    bar.position.set(bx, gateH * 0.5, 0);
    group.add(bar);

    const finial = new THREE.Mesh(finialGeo, shared.ironMat);
    finial.position.set(bx, gateH + 0.04, 0);
    group.add(finial);
  }

  // Heavy rusted iron lock chain & tarnished brass padlock binding the center bars
  const chainLinks = 5;
  const linkGeo = new THREE.TorusGeometry(0.045, 0.012, 6, 10);
  for (let i = 0; i < chainLinks; i++) {
    const link = new THREE.Mesh(linkGeo, shared.ironMat);
    link.position.set(-0.12 + i * 0.06, 1.48, -0.05);
    link.rotation.y = i % 2 === 0 ? 0.35 : Math.PI * 0.45;
    group.add(link);
  }
  const padlockBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.05), shared.brassMat);
  padlockBody.position.set(0, 1.34, -0.075);
  group.add(padlockBody);
  const padlockShackle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 6, 12, Math.PI), shared.ironMat);
  padlockShackle.position.set(0, 1.41, -0.075);
  group.add(padlockShackle);

  return group;
}

