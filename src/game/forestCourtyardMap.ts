import * as THREE from 'three';
import { ProceduralTexturePack } from './textures';
import { MinimapLandmark } from './types';

export interface ForestCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  id?: string;
}

export interface StealthCoverZone {
  x: number;
  z: number;
  radius: number;
}

export interface ForestThornHazard {
  id: string;
  position: THREE.Vector3;
  radius: number;
  clearanceY: number;
  group: THREE.Group;
}

export interface RuneStoneRig {
  id: string;
  label: string;
  locationName: string;
  position: THREE.Vector3;
  group: THREE.Group;
  crystalMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  auraRing: THREE.Mesh;
  tetherMesh: THREE.Mesh;
  light: THREE.PointLight | null;
  broken: boolean;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export interface ShadowCrawlerRig {
  id: string;
  zone: 'forest' | 'courtyard';
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  limbs: THREE.Group[]; // 4 articulated limbs
  bodyMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshBasicMaterial;
  position: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolPoints: Array<{ x: number; z: number }>;
  patrolIndex: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  dissolveProgress: number; // 0 = intact, 1 = gone
  staggerTimer: number;
  hitFlash: number;
  attackCooldown: number;
  alertState: 'patrol' | 'chase';
  screechCooldown: number;
}

export type BossAIState = 'hidden' | 'intro' | 'stalk' | 'telegraph' | 'charge' | 'recover' | 'staggered' | 'dying' | 'dead';

export interface AghoriBossRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  macePivot: THREE.Group;
  maceHeadMat: THREE.MeshStandardMaterial;
  boneMat: THREE.MeshStandardMaterial;
  shroudMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshBasicMaterial;
  chains: THREE.Mesh[];
  slamRing: THREE.Mesh;
  slamRingMat: THREE.MeshBasicMaterial;
  ashPoints: THREE.Points;
  ashVelocities: Float32Array;
  position: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  state: BossAIState;
  stateTimer: number;
  chargeDirX: number;
  chargeDirZ: number;
  slamProgress: number;
  slamDamageDealt: boolean;
  hitFlash: number;
  dissolveProgress: number;
}

export interface ForestDogRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  tailPivot: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
}

export interface ForestCourtyardWorld {
  root: THREE.Group;
  colliders: ForestCollider[];
  stealthCoverZones: StealthCoverZone[];
  thorns: ForestThornHazard[];
  dog: ForestDogRig;

  // Phase 1: Outer Village Iron Gate (z = +30)
  outerGatePos: THREE.Vector3;
  outerGateLeftPivot: THREE.Group;
  outerGateRightPivot: THREE.Group;
  outerGatePadlock: THREE.Group;
  outerGateAura: THREE.Mesh;
  outerGateOpenAmount: number;
  outerGateUnlocked: boolean;

  // Phase 2: Ruined Shiva Shrine & Sacred Trishul Pickup
  shrinePos: THREE.Vector3;
  trishulPickupPos: THREE.Vector3;
  trishulPickupGroup: THREE.Group;
  trishulPickupAura: THREE.Mesh;
  dhuniLight: THREE.PointLight;
  dhuniFlame: THREE.Mesh;

  // Phase 3: 3 Tantric Rune Stones & Sealed Haveli Main Door
  runeStones: RuneStoneRig[];
  haveliDoorPos: THREE.Vector3;
  haveliDoorLeftPivot: THREE.Group;
  haveliDoorRightPivot: THREE.Group;
  haveliDoorOpenAmount: number;
  haveliDoorUnlocked: boolean;
  redBarrierMesh: THREE.Mesh;
  redBarrierMat: THREE.MeshBasicMaterial;
  redBarrierLight: THREE.PointLight;
  interiorGlowMesh: THREE.Mesh;

  // Combat Enemies & Boss
  crawlers: ShadowCrawlerRig[];
  boss: AghoriBossRig;
  lightningFlashLight: THREE.PointLight;

  lanternLights: Array<{ light: THREE.PointLight; base: number; phase: number; flame?: THREE.Mesh }>;
  landmarks: MinimapLandmark[];
  resolvePlayerCollision: (pos: THREE.Vector3, radius: number) => void;
  isNearStealthCover: (x: number, z: number) => boolean;
  getZoneName: (x: number, z: number) => string;
  applyQualityMaterials: (isLow: boolean) => void;
  updateVisuals: (dt: number, elapsed: number) => void;
}

function makeAuraRing(colorHex: number, radius = 0.72): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.72, radius, 28);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.04;
  return mesh;
}

function createBanyanTree(
  barkMat: THREE.MeshStandardMaterial,
  foliageMat: THREE.MeshStandardMaterial,
  clothMat: THREE.MeshStandardMaterial,
  scale = 1.0,
  seed = 1,
  withTantricStrip = false
): THREE.Group {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32 * scale, 0.62 * scale, 4.2 * scale, 8),
    barkMat
  );
  trunk.position.y = 2.1 * scale;
  trunk.rotation.z = ((seed % 5) - 2) * 0.035;
  g.add(trunk);

  // Spreading Banyan boughs + hanging aerial roots
  [0.2, 2.2, 4.35].forEach((ang, idx) => {
    const a = ang + seed * 0.45;
    const br = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scale, 0.24 * scale, 2.7 * scale, 6),
      barkMat
    );
    br.position.set(
      Math.cos(a) * 0.85 * scale,
      3.7 * scale + idx * 0.22 * scale,
      Math.sin(a) * 0.85 * scale
    );
    br.rotation.z = Math.cos(a) * -0.58;
    br.rotation.x = Math.sin(a) * 0.58;
    g.add(br);

    // Hanging aerial banyan root
    const root = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035 * scale, 0.055 * scale, 3.2 * scale, 5),
      barkMat
    );
    root.position.set(Math.cos(a) * 1.45 * scale, 1.6 * scale, Math.sin(a) * 1.45 * scale);
    g.add(root);
  });

  // Layered canopy clusters
  const crowns: Array<[number, number, number, number]> = [
    [0, 4.8, 0, 2.1],
    [-1.25, 4.3, 0.7, 1.5],
    [1.2, 4.4, -0.65, 1.55],
    [0.25, 5.5, 0.55, 1.45],
  ];
  crowns.forEach(([cx, cy, cz, r]) => {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r * scale, 1), foliageMat);
    c.position.set(cx * scale, cy * scale, cz * scale);
    c.scale.set(1.18, 0.68, 1.15);
    g.add(c);
  });

  if (withTantricStrip) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.03), clothMat);
    strip.position.set(0.54 * scale, 1.8 * scale, 0.2 * scale);
    strip.rotation.z = 0.08;
    g.add(strip);
  }

  return g;
}

function createShadowCrawlerMesh(
  id: string,
  zone: 'forest' | 'courtyard',
  home: [number, number],
  patrol: Array<{ x: number; z: number }>,
  textures: ProceduralTexturePack
): ShadowCrawlerRig {
  const root = new THREE.Group();
  root.position.set(home[0], 0, home[1]);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: textures.barkColor,
    bumpMap: textures.barkBump,
    bumpScale: 0.04,
    color: 0x161214,
    emissive: 0x240608,
    emissiveIntensity: 0.35,
    roughness: 0.86,
    metalness: 0.12,
    transparent: true,
    opacity: 1,
  });

  const eyeMat = new THREE.MeshBasicMaterial({
    color: 0xff2828,
    transparent: true,
    opacity: 1,
  });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.58;
  root.add(bodyGroup);

  // Hunched gaunt Hastar-like torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.56, 5, 10), bodyMat);
  torso.rotation.x = Math.PI * 0.38;
  bodyGroup.add(torso);

  // Jagged spine ridges along hunched back
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), bodyMat);
    spike.position.set(0, 0.22 - i * 0.03, -0.18 + i * 0.14);
    spike.rotation.x = -0.35;
    bodyGroup.add(spike);
  }

  // Twitching skull-like head with twin glowing crimson eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.22, -0.44);
  bodyGroup.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 1), bodyMat);
  cranium.scale.set(0.88, 1.05, 1.12);
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.18), bodyMat);
  jaw.position.set(0, -0.11, -0.04);
  headGroup.add(jaw);

  [-0.065, 0.065].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eyeMat);
    eye.position.set(ex, 0.02, -0.16);
    headGroup.add(eye);
  });

  // 4 gaunt spider-like crawling limbs with elongated claws
  const limbs: THREE.Group[] = [];
  const limbAnchors: Array<[number, number, number]> = [
    [-0.24, 0.06, -0.26],
    [0.24, 0.06, -0.26],
    [-0.22, -0.06, 0.24],
    [0.22, -0.06, 0.24],
  ];
  limbAnchors.forEach(([lx, ly, lz]) => {
    const limbPivot = new THREE.Group();
    limbPivot.position.set(lx, ly, lz);
    const side = lx < 0 ? -1 : 1;

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.48, 6), bodyMat);
    upper.position.set(side * 0.16, -0.14, 0);
    upper.rotation.z = side * 0.65;
    limbPivot.add(upper);

    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.02, 0.56, 6), bodyMat);
    fore.position.set(side * 0.28, -0.42, -0.08);
    fore.rotation.z = side * -0.18;
    limbPivot.add(fore);

    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 4), bodyMat);
    claw.position.set(side * 0.28, -0.68, -0.12);
    claw.rotation.x = Math.PI;
    limbPivot.add(claw);

    bodyGroup.add(limbPivot);
    limbs.push(limbPivot);
  });

  // Soft ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.6),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  return {
    id,
    zone,
    root,
    bodyGroup,
    headGroup,
    limbs,
    bodyMat,
    eyeMat,
    position: root.position,
    homePos: new THREE.Vector3(home[0], 0, home[1]),
    patrolPoints: patrol,
    patrolIndex: 0,
    yaw: 0,
    hp: 65,
    maxHp: 65,
    alive: true,
    dissolveProgress: 0,
    staggerTimer: 0,
    hitFlash: 0,
    attackCooldown: 0,
    alertState: 'patrol',
    screechCooldown: 0,
  };
}

function createAghoriBossMesh(textures: ProceduralTexturePack): AghoriBossRig {
  const root = new THREE.Group();
  root.position.set(0, 0, -28.2);
  root.visible = false;

  const boneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.035,
    color: 0xc2b59e,
    emissive: 0x220806,
    emissiveIntensity: 0.25,
    roughness: 0.78,
    metalness: 0.12,
    transparent: true,
    opacity: 1,
  });

  const shroudMat = new THREE.MeshStandardMaterial({
    color: 0x281010,
    emissive: 0x1a0404,
    emissiveIntensity: 0.3,
    roughness: 0.92,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });

  const chainIronMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.028,
    roughnessMap: textures.ironRoughness,
    color: 0x52575e,
    roughness: 0.58,
    metalness: 0.78,
  });

  const maceHeadMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.03,
    color: 0x3b3d42,
    emissive: 0xaa1a12,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.85,
  });

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b22 });

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Towering lower legs + tattered Aghori shroud skirt
  [-0.36, 0.36].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 1.25, 8), boneMat);
    leg.position.set(lx, 0.62, 0);
    bodyGroup.add(leg);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), boneMat);
    knee.position.set(lx, 0.64, 0.04);
    bodyGroup.add(knee);
  });

  const dhoti = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.72, 1.15, 10, 1, true), shroudMat);
  dhoti.position.y = 0.88;
  bodyGroup.add(dhoti);

  // Skeletal spine + massive ribcage torso
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.2, 8), boneMat);
  spine.position.y = 1.75;
  bodyGroup.add(spine);

  for (let r = 0; r < 4; r++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.38 - r * 0.03, 0.055, 6, 14), boneMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 2.15 - r * 0.18;
    bodyGroup.add(rib);
  }

  // Broad hunched iron-chained pauldrons
  [-0.62, 0.62].forEach((sx) => {
    const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), chainIronMat);
    pauldron.position.set(sx, 2.32, 0);
    pauldron.scale.set(1.1, 0.8, 1.0);
    bodyGroup.add(pauldron);
  });

  // Heavy chains draped diagonally across chest & hanging from wrists
  const chains: THREE.Mesh[] = [];
  const chainGeo = new THREE.TorusGeometry(0.085, 0.022, 6, 10);
  for (let c = 0; c < 7; c++) {
    const link = new THREE.Mesh(chainGeo, chainIronMat);
    link.position.set(-0.48 + c * 0.16, 2.28 - c * 0.13, 0.36);
    link.rotation.y = c % 2 === 0 ? 0.2 : Math.PI * 0.45;
    bodyGroup.add(link);
    chains.push(link);
  }

  // Ash-smeared horned Aghori demon skull + glowing eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.66, 0.12);
  bodyGroup.add(headGroup);

  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 1), boneMat);
  skull.scale.set(0.92, 1.12, 1.05);
  headGroup.add(skull);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.24), boneMat);
  jaw.position.set(0, -0.22, 0.06);
  headGroup.add(jaw);

  // Curved demonic horns + crimson tilak mark
  [-1, 1].forEach((side) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.56, 6), chainIronMat);
    horn.position.set(side * 0.24, 0.28, -0.02);
    horn.rotation.z = side * -0.58;
    horn.rotation.x = 0.22;
    headGroup.add(horn);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), eyeMat);
    eye.position.set(side * 0.1, 0.04, 0.24);
    headGroup.add(eye);
  });

  const tilak = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.16, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xdd2218 })
  );
  tilak.position.set(0, 0.14, 0.28);
  headGroup.add(tilak);

  // Left skeletal arm with hanging iron chain
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.68, 2.26, 0);
  bodyGroup.add(leftArmPivot);
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.05, 7), boneMat);
  lArm.position.y = -0.48;
  leftArmPivot.add(lArm);
  const lChain = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 6), chainIronMat);
  lChain.position.set(0, -1.12, 0.05);
  leftArmPivot.add(lChain);
  chains.push(lChain);

  // Right arm wielding the towering spiked Iron Gada (Heavy Mace)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.68, 2.26, 0);
  bodyGroup.add(rightArmPivot);
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 1.02, 7), boneMat);
  rArm.position.y = -0.46;
  rightArmPivot.add(rArm);

  const macePivot = new THREE.Group();
  macePivot.position.set(0, -0.92, 0.18);
  rightArmPivot.add(macePivot);

  const maceShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.95, 8), chainIronMat);
  maceShaft.rotation.x = Math.PI / 2;
  maceShaft.position.z = 0.72;
  macePivot.add(maceShaft);

  const maceHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), maceHeadMat);
  maceHead.position.z = 1.65;
  macePivot.add(maceHead);

  // Spikes protruding from Gada head
  for (let s = 0; s < 6; s++) {
    const ang = (s / 6) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 5), chainIronMat);
    sp.position.set(Math.cos(ang) * 0.36, Math.sin(ang) * 0.36, 1.65);
    sp.rotation.z = ang - Math.PI / 2;
    macePivot.add(sp);
  }

  // Boss ground contact shadow
  const bossShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  bossShadow.rotation.x = -Math.PI / 2;
  bossShadow.position.y = 0.025;
  root.add(bossShadow);

  // Expanding Crimson Shockwave Ring when Gada slams the ground
  const slamRingGeo = new THREE.RingGeometry(0.7, 1.0, 32);
  slamRingGeo.rotateX(-Math.PI / 2);
  const slamRingMat = new THREE.MeshBasicMaterial({
    color: 0xff3b28,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const slamRing = new THREE.Mesh(slamRingGeo, slamRingMat);
  slamRing.position.y = 0.07;
  slamRing.visible = false;
  root.add(slamRing);

  // Rising black/ember ash dissolve cloud when defeated
  const ashCount = 90;
  const ashPos = new Float32Array(ashCount * 3);
  const ashVelocities = new Float32Array(ashCount * 3);
  for (let i = 0; i < ashCount; i++) {
    ashPos[i * 3] = (Math.random() - 0.5) * 1.4;
    ashPos[i * 3 + 1] = 0.3 + Math.random() * 2.5;
    ashPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
    ashVelocities[i * 3] = (Math.random() - 0.5) * 1.4;
    ashVelocities[i * 3 + 1] = 1.2 + Math.random() * 2.2;
    ashVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ashMat = new THREE.PointsMaterial({
    color: 0xff6e3a,
    map: textures.softParticle,
    size: 0.24,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ashPoints = new THREE.Points(ashGeo, ashMat);
  ashPoints.visible = false;
  ashPoints.frustumCulled = false;
  root.add(ashPoints);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    macePivot,
    maceHeadMat,
    boneMat,
    shroudMat,
    eyeMat,
    chains,
    slamRing,
    slamRingMat,
    ashPoints,
    ashVelocities,
    position: root.position,
    yaw: 0,
    hp: 260,
    maxHp: 260,
    state: 'hidden',
    stateTimer: 0,
    chargeDirX: 0,
    chargeDirZ: 1,
    slamProgress: 0,
    slamDamageDealt: false,
    hitFlash: 0,
    dissolveProgress: 0,
  };
}

function createForestDog(textures: ProceduralTexturePack): ForestDogRig {
  const root = new THREE.Group();
  root.position.set(-1.9, 0, 32.3);

  const furMat = new THREE.MeshStandardMaterial({
    map: textures.mudColor,
    color: 0xa47448,
    roughness: 0.9,
    metalness: 0.02,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.85 });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.42;
  root.add(bodyGroup);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.48, 4, 8), furMat);
  torso.rotation.x = Math.PI / 2;
  bodyGroup.add(torso);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.14, -0.34);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.26), furMat);
  headGroup.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), darkMat);
  snout.position.set(0, -0.04, -0.17);
  headGroup.add(snout);

  [-0.09, 0.09].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), darkMat);
    ear.position.set(ex, 0.12, 0.02);
    ear.rotation.z = ex < 0 ? 0.35 : -0.35;
    headGroup.add(ear);
  });

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.06, 0.34);
  bodyGroup.add(tailPivot);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.038, 0.28, 6), furMat);
  tail.position.set(0, -0.06, 0.1);
  tail.rotation.x = 0.65; // Tucked nervously
  tailPivot.add(tail);

  [
    [-0.1, -0.22],
    [0.1, -0.22],
    [-0.1, 0.2],
    [0.1, 0.2],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.42, 6), furMat);
    leg.position.set(lx, -0.21, lz);
    bodyGroup.add(leg);
  });

  return {
    root,
    bodyGroup,
    headGroup,
    tailPivot,
    position: root.position,
    yaw: 0,
  };
}

export function buildForestCourtyardWorld(
  textures: ProceduralTexturePack,
  isLowQuality: boolean
): ForestCourtyardWorld {
  const root = new THREE.Group();
  const colliders: ForestCollider[] = [];
  const stealthCoverZones: StealthCoverZone[] = [];
  const thorns: ForestThornHazard[] = [];
  const lanternLights: Array<{
    light: THREE.PointLight;
    base: number;
    phase: number;
    flame?: THREE.Mesh;
  }> = [];

  const addBoxCollider = (cx: number, cz: number, w: number, d: number, id?: string) => {
    colliders.push({
      minX: cx - w * 0.5,
      maxX: cx + w * 0.5,
      minZ: cz - d * 0.5,
      maxZ: cz + d * 0.5,
      id,
    });
  };

  // Shared PBR Materials
  const mudGroundMat = new THREE.MeshStandardMaterial({
    map: textures.mudColor,
    bumpMap: textures.mudBump,
    bumpScale: 0.05,
    roughnessMap: textures.mudRoughness,
    color: 0x3b423a,
    roughness: 0.94,
    metalness: 0.02,
  });

  const dirtTrailMat = new THREE.MeshStandardMaterial({
    map: textures.mudColor,
    bumpMap: textures.mudBump,
    bumpScale: 0.04,
    color: 0x62523f,
    roughness: 0.92,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.042,
    roughnessMap: textures.stoneRoughness,
    color: 0x687272,
    roughness: 0.9,
    metalness: 0.05,
  });

  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plasterColor,
    bumpMap: textures.plasterBump,
    bumpScale: 0.04,
    roughnessMap: textures.plasterRoughness,
    color: 0x736b5e,
    roughness: 0.9,
    metalness: 0.04,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.038,
    roughnessMap: textures.woodRoughness,
    color: 0x5c3f28,
    roughness: 0.88,
    metalness: 0.05,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.032,
    roughnessMap: textures.ironRoughness,
    color: 0x5e5650,
    roughness: 0.72,
    metalness: 0.72,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    bumpMap: textures.brassBump,
    bumpScale: 0.02,
    roughnessMap: textures.brassRoughness,
    color: 0xc29846,
    roughness: 0.42,
    metalness: 0.85,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.barkColor,
    bumpMap: textures.barkBump,
    bumpScale: 0.045,
    color: 0x463a2e,
    roughness: 0.93,
    metalness: 0.02,
  });

  const foliageMat = new THREE.MeshStandardMaterial({
    map: textures.foliageColor,
    bumpMap: textures.foliageBump,
    bumpScale: 0.03,
    color: 0x20352c,
    roughness: 0.88,
    metalness: 0.02,
  });

  const clothMat = new THREE.MeshStandardMaterial({
    color: 0x8f1e18,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });

  const pbrMats = [
    mudGroundMat,
    dirtTrailMat,
    stoneMat,
    plasterMat,
    woodMat,
    ironMat,
    brassMat,
    barkMat,
    foliageMat,
  ];

  // 1. Extended Outdoor Forest Terrain (140m x 140m fading smoothly into horizon fog)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mudGroundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // Winding Forest Dirt Trail + Outer Courtyard Stone Cobble Apron
  const trailSegments: Array<[number, number, number, number, number]> = [
    [0, 26, 4.4, 20, 0],
    [-1.8, 13, 4.2, 14, -0.22],
    [-5.8, 11.2, 7.2, 3.2, 0.18], // Branch to Ruined Shiva Shrine
    [0.8, 3, 4.4, 14, 0.16],
    [0, -17, 32, 30, 0], // Wide Haveli Outer Courtyard ground
  ];
  trailSegments.forEach(([tx, tz, tw, td, rot], idx) => {
    const seg = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, td),
      idx === 4 ? stoneMat : dirtTrailMat
    );
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = rot;
    seg.position.set(tx, idx === 4 ? 0.022 : 0.018, tz);
    seg.receiveShadow = true;
    root.add(seg);
  });

  // Helper: Oil Lantern on Stone Post
  const addLanternPost = (x: number, z: number, withLight: boolean, phase = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.25, 7), woodMat);
    post.position.y = 1.12;
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.07), ironMat);
    arm.position.set(0.18, 2.15, 0);
    g.add(arm);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.24, 6), ironMat);
    cage.position.set(0.36, 1.98, 0);
    g.add(cage);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffbe55 })
    );
    flame.position.set(0.36, 1.98, 0);
    g.add(flame);
    if (withLight) {
      const light = new THREE.PointLight(0xffa94a, 2.5, 13.5, 1.8);
      light.position.set(0.36, 2.02, 0);
      light.castShadow = false;
      g.add(light);
      lanternLights.push({ light, base: 2.5, phase, flame });
    }
    root.add(g);
  };

  // =========================================================================
  // 2. ZONE 1: VILLAGE OUTER IRON GATE (z = +30.0) & COMPANION DOG
  // =========================================================================
  const outerGatePos = new THREE.Vector3(0, 0, 30.0);
  const gateGroup = new THREE.Group();
  gateGroup.position.copy(outerGatePos);
  root.add(gateGroup);

  // Flanking weathered boundary wall stubs + sandstone gate piers
  [-2.35, 2.35].forEach((px) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.68, 3.6, 0.72), stoneMat);
    pier.position.set(px, 1.8, 0);
    gateGroup.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 0.88), stoneMat);
    cap.position.set(px, 3.7, 0);
    gateGroup.add(cap);
  });

  // Low mossy stone boundary walls flanking the outer gate
  [-11.5, 11.5].forEach((wx) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(17.8, 2.5, 0.55), plasterMat);
    wall.position.set(wx, 1.25, 0);
    gateGroup.add(wall);
    addBoxCollider(wx, 30.0, 17.8, 0.9);
  });

  const buildIronGateLeaf = (isLeft: boolean): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -1.95 : 1.95, 0, 0);
    const dir = isLeft ? 1 : -1;
    const leafW = 1.92;
    const leafH = 3.05;

    [0.2, 1.5, leafH - 0.16].forEach((ry) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.11, 0.08), ironMat);
      rail.position.set(dir * leafW * 0.5, ry, 0);
      pivot.add(rail);
    });
    for (let i = 0; i < 6; i++) {
      const bx = dir * (0.14 + (i / 5) * (leafW - 0.28));
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, leafH, 6), ironMat);
      bar.position.set(bx, leafH * 0.5, 0);
      pivot.add(bar);
      const spear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), ironMat);
      spear.position.set(bx, leafH + 0.08, 0);
      pivot.add(spear);
    }
    return pivot;
  };

  const outerGateLeftPivot = buildIronGateLeaf(true);
  const outerGateRightPivot = buildIronGateLeaf(false);
  gateGroup.add(outerGateLeftPivot, outerGateRightPivot);

  const outerGatePadlock = new THREE.Group();
  outerGatePadlock.position.set(0, 1.44, 0.12);
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.08), brassMat);
  const lockShackle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI), ironMat);
  lockShackle.position.y = 0.12;
  outerGatePadlock.add(lockBody, lockShackle);
  gateGroup.add(outerGatePadlock);

  // Removable collider blocking the outer gate until unlocked
  addBoxCollider(0, 30.0, 4.1, 0.7, 'outer_gate_blocker');

  const outerGateAura = makeAuraRing(0xffc966, 1.15);
  outerGateAura.position.set(0, 0.04, 31.3);
  root.add(outerGateAura);

  addLanternPost(-3.1, 31.4, true, 0.4);
  addLanternPost(3.1, 31.4, !isLowQuality, 1.8);

  const dog = createForestDog(textures);
  root.add(dog.root);

  // =========================================================================
  // 3. ZONE 2: CURSED BANYAN & PEEPAL FOREST + STEALTH COVER (z = +29 to -2)
  // =========================================================================
  const treeSpecs: Array<[number, number, number, boolean]> = [
    // Western & Eastern dense perimeter trees (natural forest boundary)
    [-19, 34, 1.25, false],
    [-19.5, 25, 1.35, true],
    [-20, 16, 1.4, false],
    [-19, 7, 1.28, true],
    [-19.5, -1, 1.32, false],
    [19, 34, 1.22, false],
    [19.5, 24, 1.38, true],
    [19, 14, 1.3, false],
    [19.5, 5, 1.36, true],
    [19, -2, 1.28, false],
    // Interior forest Banyan & Peepal trees framing stealth lanes
    [-11.5, 24.5, 1.18, true],
    [9.8, 23.2, 1.24, false],
    [-4.8, 19.6, 1.05, true],
    [6.4, 16.5, 1.15, true],
    [-14.2, 15.0, 1.12, false],
    [12.8, 11.2, 1.22, true],
    [-3.6, 5.2, 1.08, false],
    [8.2, 4.5, 1.18, true],
    [-13.5, 2.2, 1.24, false],
    [13.4, -0.5, 1.15, false],
    // Outer courtyard rim trees
    [-22.5, -10, 1.35, false],
    [-23, -21, 1.4, false],
    [-22, -32, 1.32, false],
    [22.5, -10, 1.32, false],
    [23, -21, 1.38, false],
    [22, -32, 1.3, false],
  ];

  treeSpecs.forEach(([tx, tz, sc, strip], idx) => {
    const tree = createBanyanTree(barkMat, foliageMat, clothMat, sc, idx + 3, strip);
    tree.position.set(tx, 0, tz);
    root.add(tree);
    addBoxCollider(tx, tz, 1.05 * sc, 1.05 * sc);
  });

  // Fallen Mossy Logs & Dark Stealth Boulders for Crouch / Prone hiding in the forest!
  const coverSpots: Array<[number, number, number, 'log' | 'boulder']> = [
    [-4.2, 24.2, 0.4, 'log'],
    [4.4, 21.0, -0.35, 'boulder'],
    [-2.4, 15.6, 0.25, 'log'],
    [4.8, 11.4, 0.8, 'boulder'],
    [-5.8, 6.2, -0.5, 'log'],
    [3.8, 3.6, 0.3, 'boulder'],
    [-8.2, -7.2, 0.2, 'boulder'],
    [7.4, -7.8, -0.4, 'log'],
  ];

  coverSpots.forEach(([cx, cz, rot, kind]) => {
    const cg = new THREE.Group();
    cg.position.set(cx, 0, cz);
    cg.rotation.y = rot;
    if (kind === 'log') {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 2.9, 8), barkMat);
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.36;
      cg.add(log);
      // Surrounding dense fern/shrub foliage helping conceal crouched/prone player
      [-1.1, 0, 1.1].forEach((bx) => {
        const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), foliageMat);
        bush.position.set(bx, 0.48, 0.36);
        bush.scale.set(1.2, 0.85, 0.9);
        cg.add(bush);
      });
      addBoxCollider(cx, cz, 2.3, 0.75);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.92, 1), stoneMat);
      rock.position.y = 0.56;
      rock.scale.set(1.35, 0.88, 1.05);
      cg.add(rock);
      const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), foliageMat);
      shrub.position.set(0.85, 0.42, 0.4);
      cg.add(shrub);
      addBoxCollider(cx, cz, 1.8, 1.45);
    }
    root.add(cg);
    stealthCoverZones.push({ x: cx, z: cz, radius: 2.65 });
  });

  // =========================================================================
  // 4. RUINED SHIVA SHRINE & SACRED TRISHUL + FLAMING MASHAL (x=-9.5, z=+10.5)
  // =========================================================================
  const shrinePos = new THREE.Vector3(-9.5, 0, 10.5);
  const shrineGroup = new THREE.Group();
  shrineGroup.position.copy(shrinePos);
  root.add(shrineGroup);

  // Two-tier carved sandstone mandapam plinth
  const plinthBot = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.32, 5.2), stoneMat);
  plinthBot.position.y = 0.16;
  const plinthTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.24, 4.4), stoneMat);
  plinthTop.position.y = 0.42;
  shrineGroup.add(plinthBot, plinthTop);

  // 4 weathered corner stone pillars + cracked shikhara dome roof
  [
    [-1.8, -1.8],
    [1.8, -1.8],
    [-1.8, 1.8],
    [1.8, 1.8],
  ].forEach(([px, pz]) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.1, 0.36), stoneMat);
    col.position.set(px, 2.05, pz);
    shrineGroup.add(col);
    addBoxCollider(shrinePos.x + px, shrinePos.z + pz, 0.52, 0.52);
  });

  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.26, 4.5), stoneMat);
  roofSlab.position.y = 3.68;
  const shikhara = new THREE.Mesh(new THREE.ConeGeometry(2.15, 2.2, 4), stoneMat);
  shikhara.rotation.y = Math.PI / 4;
  shikhara.position.y = 4.9;
  const kalashTop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), brassMat);
  kalashTop.position.y = 6.08;
  shrineGroup.add(roofSlab, shikhara, kalashTop);

  // Stone Shiva Lingam on Yoni Pedestal at center
  const yoniBase = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.62, 0.24, 12), stoneMat);
  yoniBase.position.set(0, 0.66, -0.35);
  const lingam = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 6, 12), stoneMat);
  lingam.position.set(0, 1.08, -0.35);
  shrineGroup.add(yoniBase, lingam);
  addBoxCollider(shrinePos.x, shrinePos.z - 0.35, 1.25, 1.25);

  // Sacred glowing Dhuni fire pit right beside the Lingam
  const dhuniRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 7, 14), stoneMat);
  dhuniRim.rotation.x = Math.PI / 2;
  dhuniRim.position.set(0.95, 0.58, 0.95);
  shrineGroup.add(dhuniRim);

  const dhuniEmbers = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 12),
    new THREE.MeshBasicMaterial({ color: 0xff6218 })
  );
  dhuniEmbers.rotation.x = -Math.PI / 2;
  dhuniEmbers.position.set(0.95, 0.58, 0.95);
  shrineGroup.add(dhuniEmbers);

  const dhuniFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.72, 8),
    new THREE.MeshBasicMaterial({ color: 0xffad38, transparent: true, opacity: 0.9 })
  );
  dhuniFlame.position.set(0.95, 0.94, 0.95);
  shrineGroup.add(dhuniFlame);

  const dhuniLight = new THREE.PointLight(0xff9232, 4.2, 16, 1.65);
  dhuniLight.position.set(0.95, 1.5, 0.95);
  dhuniLight.castShadow = false;
  shrineGroup.add(dhuniLight);

  // Pickup Prop: Sacred Iron Trishul & Flaming Mashal leaning by the Dhuni fire
  const trishulPickupPos = new THREE.Vector3(shrinePos.x + 1.55, 0.54, shrinePos.z + 1.15);
  const trishulPickupGroup = new THREE.Group();
  trishulPickupGroup.position.copy(trishulPickupPos);
  root.add(trishulPickupGroup);

  const pShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 1.85, 8), ironMat);
  pShaft.position.y = 0.92;
  trishulPickupGroup.add(pShaft);
  const pCrescent = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.028, 7, 14, Math.PI),
    ironMat
  );
  pCrescent.rotation.z = Math.PI;
  pCrescent.position.y = 1.68;
  trishulPickupGroup.add(pCrescent);
  const pMidProng = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.48, 6), ironMat);
  pMidProng.position.y = 1.98;
  trishulPickupGroup.add(pMidProng);
  [-0.22, 0.22].forEach((px) => {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 6), ironMat);
    sp.position.set(px, 1.86, 0);
    trishulPickupGroup.add(sp);
  });
  const pFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.28, 7),
    new THREE.MeshBasicMaterial({ color: 0xffa838 })
  );
  pFlame.position.set(0, 1.48, 0);
  trishulPickupGroup.add(pFlame);

  const trishulPickupAura = makeAuraRing(0xffc955, 1.05);
  trishulPickupAura.position.set(trishulPickupPos.x, 0.56, trishulPickupPos.z);
  root.add(trishulPickupAura);

  // =========================================================================
  // 5. ZONE 3: HAVELI OUTER COURTYARD ARCHWAY, BAOLI, STABLES & BULLOCK CART
  // =========================================================================
  // Broken courtyard boundary wall with wide central gateway at z = -2.0
  [-12.2, 12.2].forEach((wx) => {
    const cw = new THREE.Mesh(new THREE.BoxGeometry(17.2, 2.8, 0.7), plasterMat);
    cw.position.set(wx, 1.4, -2.0);
    root.add(cw);
    addBoxCollider(wx, -2.0, 17.2, 1.0);
  });
  [-3.4, 3.4].forEach((px) => {
    const archPier = new THREE.Mesh(new THREE.BoxGeometry(0.95, 4.1, 0.95), stoneMat);
    archPier.position.set(px, 2.05, -2.0);
    root.add(archPier);
    addBoxCollider(px, -2.0, 1.05, 1.05);
  });
  addLanternPost(-4.2, -1.2, true, 2.1);
  addLanternPost(4.2, -1.2, !isLowQuality, 3.4);

  // Old Stepwell / Baoli (West Courtyard: x = -13.5, z = -14.5)
  const baoliGroup = new THREE.Group();
  baoliGroup.position.set(-13.5, 0, -14.5);
  root.add(baoliGroup);

  const baoliWater = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 5.6),
    new THREE.MeshStandardMaterial({
      color: 0x0b262c,
      roughness: 0.16,
      metalness: 0.35,
    })
  );
  baoliWater.rotation.x = -Math.PI / 2;
  baoliWater.position.y = 0.05;
  baoliGroup.add(baoliWater);

  // Stepped sandstone parapets around Baoli
  [
    [0, -3.2, 6.8, 0.7],
    [0, 3.2, 6.8, 0.7],
    [-3.2, 0, 0.7, 6.0],
    [3.2, -2.1, 0.7, 2.1],
    [3.2, 2.1, 0.7, 2.1],
  ].forEach(([bx, bz, bw, bd]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.92, bd), stoneMat);
    wall.position.set(bx, 0.46, bz);
    baoliGroup.add(wall);
    addBoxCollider(-13.5 + bx, -14.5 + bz, bw + 0.1, bd + 0.1);
  });
  // Sunken stepped ledges visual
  for (let st = 0; st < 3; st++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.18 + st * 0.12, 4.4 - st * 0.6),
      stoneMat
    );
    step.position.set(2.3 - st * 0.42, 0.12 + st * 0.04, 0);
    baoliGroup.add(step);
  }
  addBoxCollider(-14.3, -14.5, 3.6, 4.4); // Keep player from walking into deep water pit

  // Broken Bullock Cart & Ruined Stables (East Courtyard: x = +13.5, z = -12.0)
  const stablesGroup = new THREE.Group();
  stablesGroup.position.set(13.5, 0, -12.0);
  root.add(stablesGroup);

  // Stable back & side wooden timber frame + slanted collapsed roof
  const stableBack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 8.6), woodMat);
  stableBack.position.set(3.2, 1.6, 0);
  stablesGroup.add(stableBack);
  addBoxCollider(16.7, -12.0, 0.65, 8.6);

  [-4.1, 0, 4.1].forEach((sz) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.26), woodMat);
    post.position.set(-1.6, 1.45, sz);
    stablesGroup.add(post);
    addBoxCollider(11.9, -12.0 + sz, 0.45, 0.45);
  });

  const stableRoof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 9.0), woodMat);
  stableRoof.position.set(0.8, 3.05, 0);
  stableRoof.rotation.z = 0.16;
  stablesGroup.add(stableRoof);

  // Broken Bullock Cart tilted beside the stables (x = +9.2, z = -16.8)
  const cartGroup = new THREE.Group();
  cartGroup.position.set(9.2, 0, -16.8);
  cartGroup.rotation.y = -0.52;
  root.add(cartGroup);

  const cartBed = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, 2.8), woodMat);
  cartBed.position.set(0, 0.84, 0);
  cartBed.rotation.z = 0.18;
  cartGroup.add(cartBed);
  [-0.82, 0.82].forEach((sx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 2.7), woodMat);
    rail.position.set(sx, 1.12, 0);
    rail.rotation.z = 0.18;
    cartGroup.add(rail);
  });
  // Spoked wooden wheels with iron rims
  [-0.98, 0.98].forEach((wx, idx) => {
    const wheel = new THREE.Group();
    wheel.position.set(wx, idx === 0 ? 0.66 : 0.78, 0.2);
    wheel.rotation.y = Math.PI / 2;
    if (idx === 0) wheel.rotation.x = 0.28; // broken tilted wheel
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 16), ironMat);
    wheel.add(rim);
    for (let sp = 0; sp < 4; sp++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), woodMat);
      spoke.rotation.z = (sp / 4) * Math.PI;
      wheel.add(spoke);
    }
    cartGroup.add(wheel);
  });
  // Yoke poles resting on the mud
  const yokePole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.2, 6), woodMat);
  yokePole.rotation.x = Math.PI / 2 + 0.22;
  yokePole.position.set(0, 0.52, -2.1);
  cartGroup.add(yokePole);
  addBoxCollider(9.2, -16.8, 2.4, 3.1);

  // Courtyard Sacrificial Stone Altar Alcove (North-West Courtyard: x = -6.5, z = -25.8)
  const altarGroup = new THREE.Group();
  altarGroup.position.set(-6.5, 0, -25.8);
  root.add(altarGroup);
  const altarSlab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.55, 2.2), stoneMat);
  altarSlab.position.y = 0.28;
  altarGroup.add(altarSlab);
  [-1.1, 1.1].forEach((px) => {
    const brokenPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.1, 8), stoneMat);
    brokenPillar.position.set(px, 1.3, -0.8);
    brokenPillar.rotation.z = px < 0 ? -0.14 : 0.1;
    altarGroup.add(brokenPillar);
  });
  addBoxCollider(-6.5, -25.8, 2.9, 2.3);

  // =========================================================================
  // 6. MASSIVE SEALED HAVELI MAIN DOOR & RED TANTRIC BARRIER (x = 0, z = -33.5)
  // =========================================================================
  const haveliDoorPos = new THREE.Vector3(0, 0, -33.5);
  const haveliFacade = new THREE.Group();
  haveliFacade.position.copy(haveliDoorPos);
  root.add(haveliFacade);

  // Imposing 1984 Rajasthani Haveli Front Facade flanking the Main Door
  [-10.8, 10.8].forEach((fx) => {
    const wingWall = new THREE.Mesh(new THREE.BoxGeometry(16.2, 8.6, 1.8), plasterMat);
    wingWall.position.set(fx, 4.3, 0);
    haveliFacade.add(wingWall);
    addBoxCollider(fx, -33.5, 16.2, 2.0);
  });

  // Grand Arch Header & Carved Balcony Cornice above Main Doors
  const topFacade = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.8, 1.9), plasterMat);
  topFacade.position.set(0, 6.7, 0);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(26, 0.45, 2.2), stoneMat);
  cornice.position.set(0, 8.6, 0.15);
  haveliFacade.add(topFacade, cornice);

  [-2.65, 2.65].forEach((px) => {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.75, 5.1, 1.95), stoneMat);
    jamb.position.set(px, 2.55, 0.1);
    haveliFacade.add(jamb);
  });

  // Twin Massive Studded Teak Haveli Main Doors
  const buildHaveliLeaf = (isLeft: boolean): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -2.25 : 2.25, 0, 0.35);
    const dir = isLeft ? 1 : -1;
    const leafW = 2.22;
    const leafH = 4.65;

    const panel = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.24), woodMat);
    panel.position.set(dir * leafW * 0.5, leafH * 0.5, 0);
    pivot.add(panel);

    // Forged iron cross straps & defensive brass spikes
    [0.6, 2.3, 4.0].forEach((sy) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.12, 0.18, 0.28), ironMat);
      strap.position.set(dir * leafW * 0.5, sy, 0);
      pivot.add(strap);
    });
    const knocker = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.036, 7, 14), brassMat);
    knocker.position.set(dir * (leafW - 0.45), 1.95, 0.16);
    pivot.add(knocker);
    return pivot;
  };

  const haveliDoorLeftPivot = buildHaveliLeaf(true);
  const haveliDoorRightPivot = buildHaveliLeaf(false);
  haveliFacade.add(haveliDoorLeftPivot, haveliDoorRightPivot);

  // Dark warm interior glow plane visible once the doors swing open
  const interiorGlowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.8),
    new THREE.MeshBasicMaterial({ color: 0x3b2210, side: THREE.DoubleSide })
  );
  interiorGlowMesh.position.set(0, 2.4, -0.5);
  haveliFacade.add(interiorGlowMesh);

  // Pulsing Crimson Tantric Energy Barrier sealing the Main Door until 3 Rune Stones break
  const redBarrierMat = new THREE.MeshBasicMaterial({
    color: 0xff2824,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const redBarrierMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.9), redBarrierMat);
  redBarrierMesh.position.set(0, 2.45, 0.92);
  haveliFacade.add(redBarrierMesh);

  const redBarrierLight = new THREE.PointLight(0xff2c24, 4.5, 16, 1.7);
  redBarrierLight.position.set(0, 2.5, 2.1);
  redBarrierLight.castShadow = false;
  haveliFacade.add(redBarrierLight);

  addBoxCollider(0, -33.2, 5.2, 1.3, 'haveli_door_blocker');
  addLanternPost(-4.2, -31.8, true, 0.8);
  addLanternPost(4.2, -31.8, true, 2.9);

  // =========================================================================
  // 7. 3 TANTRIC RUNE STONES WITH CRIMSON ENERGY TETHERS TO MAIN DOOR
  // =========================================================================
  const runeSpecs: Array<{
    id: string;
    label: string;
    locationName: string;
    x: number;
    z: number;
  }> = [
    {
      id: 'rune_baoli',
      label: 'Baoli Rune Stone',
      locationName: 'Old Stepwell (Baoli)',
      x: -10.3,
      z: -14.5,
    },
    {
      id: 'rune_stables',
      label: 'Stables Rune Stone',
      locationName: 'Ruined Stables',
      x: 14.3,
      z: -12.0,
    },
    {
      id: 'rune_altar',
      label: 'Courtyard Altar Rune Stone',
      locationName: 'North-West Courtyard Altar',
      x: -6.5,
      z: -24.1,
    },
  ];

  const runeStones: RuneStoneRig[] = runeSpecs.map((spec) => {
    const rg = new THREE.Group();
    rg.position.set(spec.x, 0, spec.z);
    root.add(rg);

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 0.62, 7), stoneMat);
    pedestal.position.y = 0.31;
    rg.add(pedestal);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x3b0c10,
      emissive: 0xff2b2b,
      emissiveIntensity: 1.4,
      roughness: 0.26,
      metalness: 0.45,
    });
    const crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crystalMat);
    crystalMesh.scale.set(0.85, 1.65, 0.85);
    crystalMesh.position.y = 1.42;
    rg.add(crystalMesh);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.032, 6, 18),
      new THREE.MeshBasicMaterial({
        color: 0xff5a3c,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
      })
    );
    ringMesh.position.y = 1.42;
    rg.add(ringMesh);

    const auraRing = makeAuraRing(0xff4c3b, 1.05);
    rg.add(auraRing);

    let light: THREE.PointLight | null = null;
    if (!isLowQuality) {
      light = new THREE.PointLight(0xff382c, 2.8, 9.5, 1.8);
      light.position.y = 1.5;
      light.castShadow = false;
      rg.add(light);
    }

    // Glowing crimson energy tether stretching from this Rune Stone to the Haveli Main Door barrier
    const startVec = new THREE.Vector3(spec.x, 1.55, spec.z);
    const endVec = new THREE.Vector3(0, 2.55, -32.6);
    const dir = new THREE.Vector3().subVectors(endVec, startVec);
    const dist = dir.length();
    const tetherGeo = new THREE.CylinderGeometry(0.032, 0.032, dist, 5);
    tetherGeo.rotateX(Math.PI / 2);
    const tetherMat = new THREE.MeshBasicMaterial({
      color: 0xff342a,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tetherMesh = new THREE.Mesh(tetherGeo, tetherMat);
    tetherMesh.position.copy(startVec).addScaledVector(dir, 0.5);
    tetherMesh.lookAt(endVec);
    root.add(tetherMesh);

    return {
      id: spec.id,
      label: spec.label,
      locationName: spec.locationName,
      position: new THREE.Vector3(spec.x, 1.35, spec.z),
      group: rg,
      crystalMesh,
      ringMesh,
      auraRing,
      tetherMesh,
      light,
      broken: false,
      hp: 35,
      maxHp: 35,
      hitFlash: 0,
    };
  });

  // =========================================================================
  // 8. COURTYARD THORN PATCHES (JUMPABLE HAZARDS)
  // =========================================================================
  const thornCoords: Array<[string, number, number]> = [
    ['ch2_thorn_1', -7.2, -11.5],
    ['ch2_thorn_2', 7.8, -10.8],
    ['ch2_thorn_3', -1.8, -21.5],
  ];
  const thornMat = new THREE.MeshStandardMaterial({
    color: 0x261d14,
    roughness: 0.95,
    metalness: 0.05,
  });
  thornCoords.forEach(([tid, tx, tz]) => {
    const tg = new THREE.Group();
    tg.position.set(tx, 0, tz);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 0.25 + (i % 3) * 0.28;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.58, 4), thornMat);
      spike.position.set(Math.cos(a) * r, 0.26, Math.sin(a) * r);
      spike.rotation.z = Math.cos(a) * 0.45;
      spike.rotation.x = Math.sin(a) * 0.45;
      tg.add(spike);
    }
    root.add(tg);
    thorns.push({
      id: tid,
      position: new THREE.Vector3(tx, 0, tz),
      radius: 1.08,
      clearanceY: 0.34,
      group: tg,
    });
  });

  // =========================================================================
  // 9. 5 SHADOW CRAWLERS (3 FOREST + 2 COURTYARD) & AGHORI DWARPAL BOSS
  // =========================================================================
  const crawlers: ShadowCrawlerRig[] = [
    createShadowCrawlerMesh(
      'crawler_forest_1',
      'forest',
      [1.8, 22.0],
      [
        { x: -3.2, z: 22.5 },
        { x: 4.5, z: 19.2 },
        { x: 0.6, z: 24.4 },
      ],
      textures
    ),
    createShadowCrawlerMesh(
      'crawler_forest_2',
      'forest',
      [-3.5, 13.8],
      [
        { x: -5.5, z: 14.5 },
        { x: 3.4, z: 12.2 },
        { x: -1.8, z: 9.2 },
      ],
      textures
    ),
    createShadowCrawlerMesh(
      'crawler_forest_3',
      'forest',
      [2.5, 5.2],
      [
        { x: -4.2, z: 4.2 },
        { x: 5.2, z: 6.2 },
        { x: 0.5, z: 1.5 },
      ],
      textures
    ),
    createShadowCrawlerMesh(
      'crawler_court_1',
      'courtyard',
      [-6.2, -16.5],
      [
        { x: -8.5, z: -10.5 },
        { x: -4.2, z: -18.5 },
        { x: -8.2, z: -20.5 },
      ],
      textures
    ),
    createShadowCrawlerMesh(
      'crawler_court_2',
      'courtyard',
      [7.5, -13.5],
      [
        { x: 5.5, z: -8.5 },
        { x: 11.2, z: -13.2 },
        { x: 5.4, z: -21.5 },
      ],
      textures
    ),
  ];
  crawlers.forEach((c) => root.add(c.root));

  const boss = createAghoriBossMesh(textures);
  root.add(boss.root);

  const lightningFlashLight = new THREE.PointLight(0x9ee0ff, 0, 55, 1.2);
  lightningFlashLight.position.set(0, 14, -22);
  lightningFlashLight.castShadow = false;
  root.add(lightningFlashLight);

  const landmarks: MinimapLandmark[] = [
    { id: 'lm_outer_gate', x: 0, z: 30, label: 'Gate', kind: 'gate' },
    { id: 'lm_shrine', x: -9.5, z: 10.5, label: 'Shiva Shrine', kind: 'shrine' },
    { id: 'lm_baoli', x: -13.5, z: -14.5, label: 'Baoli', kind: 'baoli' },
    { id: 'lm_stables', x: 13.5, z: -12.0, label: 'Stables', kind: 'stables' },
    { id: 'lm_cart', x: 9.2, z: -16.8, label: 'Cart', kind: 'cart' },
    { id: 'lm_haveli_door', x: 0, z: -33.5, label: 'Haveli Door', kind: 'haveli_door' },
  ];

  const worldRef: ForestCourtyardWorld = {
    root,
    colliders,
    stealthCoverZones,
    thorns,
    dog,
    outerGatePos,
    outerGateLeftPivot,
    outerGateRightPivot,
    outerGatePadlock,
    outerGateAura,
    outerGateOpenAmount: 0,
    outerGateUnlocked: false,
    shrinePos,
    trishulPickupPos,
    trishulPickupGroup,
    trishulPickupAura,
    dhuniLight,
    dhuniFlame,
    runeStones,
    haveliDoorPos,
    haveliDoorLeftPivot,
    haveliDoorRightPivot,
    haveliDoorOpenAmount: 0,
    haveliDoorUnlocked: false,
    redBarrierMesh,
    redBarrierMat,
    redBarrierLight,
    interiorGlowMesh,
    crawlers,
    boss,
    lightningFlashLight,
    lanternLights,
    landmarks,

    resolvePlayerCollision: (pos: THREE.Vector3, radius: number) => {
      // Soft playable forest/courtyard bounds (natural dense tree lines beyond)
      pos.x = Math.max(-18.2, Math.min(18.2, pos.x));
      pos.z = Math.max(-34.8, Math.min(36.2, pos.z));

      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (c.id === 'outer_gate_blocker' && worldRef.outerGateUnlocked) continue;
        if (c.id === 'haveli_door_blocker' && worldRef.haveliDoorUnlocked) continue;

        const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - nearestX;
        const dz = pos.z - nearestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const push = radius - dist;
            pos.x += (dx / dist) * push;
            pos.z += (dz / dist) * push;
          } else {
            const penLeft = Math.abs(pos.x - c.minX);
            const penRight = Math.abs(c.maxX - pos.x);
            const penTop = Math.abs(pos.z - c.minZ);
            const penBot = Math.abs(c.maxZ - pos.z);
            const minPen = Math.min(penLeft, penRight, penTop, penBot);
            if (minPen === penLeft) pos.x = c.minX - radius;
            else if (minPen === penRight) pos.x = c.maxX + radius;
            else if (minPen === penTop) pos.z = c.minZ - radius;
            else pos.z = c.maxZ + radius;
          }
        }
      }
    },

    isNearStealthCover: (x: number, z: number): boolean => {
      for (let i = 0; i < stealthCoverZones.length; i++) {
        const zc = stealthCoverZones[i];
        const dx = x - zc.x;
        const dz = z - zc.z;
        if (dx * dx + dz * dz <= zc.radius * zc.radius) return true;
      }
      return false;
    },

    getZoneName: (x: number, z: number): string => {
      if (z > 29.5) return 'Village Outer Iron Gate';
      if (z > -2.0) {
        if (Math.hypot(x + 9.5, z - 10.5) < 6.5) return 'Ruined Shiva Shrine';
        return 'Shapit Banyan Forest';
      }
      if (Math.hypot(x + 13.5, z + 14.5) < 6.8) return 'Ancient Baoli (Stepwell)';
      if (Math.hypot(x - 13.5, z + 12.0) < 7.2) return 'Ruined Stables & Cart';
      if (z < -27.5) return 'Haveli Main Entrance';
      return 'Haveli Outer Courtyard';
    },

    applyQualityMaterials: (isLow: boolean) => {
      pbrMats.forEach((m) => {
        m.bumpScale = isLow ? 0 : 0.036;
        m.needsUpdate = true;
      });
    },

    updateVisuals: (dt: number, elapsed: number) => {
      // Smoothly swing outer iron gate open once unlocked
      const targetOuter = worldRef.outerGateUnlocked ? 1 : 0;
      worldRef.outerGateOpenAmount = THREE.MathUtils.damp(
        worldRef.outerGateOpenAmount,
        targetOuter,
        3.2,
        dt
      );
      outerGateLeftPivot.rotation.y = worldRef.outerGateOpenAmount * -1.48;
      outerGateRightPivot.rotation.y = worldRef.outerGateOpenAmount * 1.48;

      // Smoothly swing massive Haveli Main Doors open when Boss is defeated
      const targetHaveli = worldRef.haveliDoorUnlocked ? 1 : 0;
      worldRef.haveliDoorOpenAmount = THREE.MathUtils.damp(
        worldRef.haveliDoorOpenAmount,
        targetHaveli,
        2.1,
        dt
      );
      haveliDoorLeftPivot.rotation.y = worldRef.haveliDoorOpenAmount * -1.42;
      haveliDoorRightPivot.rotation.y = worldRef.haveliDoorOpenAmount * 1.42;

      // Dhuni sacred fire & oil lanterns flicker
      const df = 0.86 + Math.sin(elapsed * 14.5) * 0.16;
      dhuniFlame.scale.set(1, df, 1);
      dhuniLight.intensity = 3.9 * df;

      for (let i = 0; i < lanternLights.length; i++) {
        const l = lanternLights[i];
        const f = 0.88 + Math.sin(elapsed * 11 + l.phase) * 0.14;
        l.light.intensity = l.base * f;
        if (l.flame) l.flame.scale.setScalar(f);
      }

      // Nervous trembling street dog outside the gate
      dog.bodyGroup.position.x = Math.sin(elapsed * 18) * 0.012;
      dog.headGroup.rotation.y = Math.sin(elapsed * 2.4) * 0.25;
      dog.tailPivot.rotation.y = Math.sin(elapsed * 6) * 0.14;

      // Pulse remaining Rune Stones & Red Barrier
      let activeRunes = 0;
      for (let i = 0; i < runeStones.length; i++) {
        const r = runeStones[i];
        const auraMat = r.auraRing.material as THREE.MeshBasicMaterial;
        if (r.broken) {
          auraMat.opacity = 0;
          r.crystalMesh.visible = false;
          r.ringMesh.visible = false;
          r.tetherMesh.visible = false;
          if (r.light) r.light.intensity = 0;
        } else {
          activeRunes++;
          r.crystalMesh.rotation.y = elapsed * 1.45 + i;
          r.crystalMesh.position.y = 1.42 + Math.sin(elapsed * 3.1 + i) * 0.09;
          r.ringMesh.rotation.x = elapsed * 1.1 + i;
          r.ringMesh.rotation.y = elapsed * 1.6;
          auraMat.opacity = 0.34 + Math.sin(elapsed * 4.5 + i) * 0.16;
          if (r.hitFlash > 0) {
            r.hitFlash = Math.max(0, r.hitFlash - dt * 4);
            (r.crystalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
              1.4 + r.hitFlash * 3.0;
          } else {
            (r.crystalMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
              1.25 + Math.sin(elapsed * 5 + i) * 0.35;
          }
          const tMat = r.tetherMesh.material as THREE.MeshBasicMaterial;
          tMat.opacity = 0.28 + Math.sin(elapsed * 6 + i) * 0.16;
        }
      }

      if (activeRunes > 0) {
        redBarrierMesh.visible = true;
        redBarrierMat.opacity = 0.32 + Math.sin(elapsed * 5.2) * 0.14;
        redBarrierLight.intensity = 3.2 + Math.sin(elapsed * 7.5) * 1.1;
      } else {
        redBarrierMesh.visible = false;
        redBarrierLight.intensity = 0;
      }

      if (lightningFlashLight.intensity > 0.05) {
        lightningFlashLight.intensity = THREE.MathUtils.damp(
          lightningFlashLight.intensity,
          0,
          5.5,
          dt
        );
      } else {
        lightningFlashLight.intensity = 0;
      }
    },
  };

  return worldRef;
}
