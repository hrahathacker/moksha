import * as THREE from 'three';
import { createRustedIronGate } from './models';
import { ProceduralTexturePack } from './textures';
import { MinimapLandmark } from './types';

export interface OutdoorCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ThornHazard {
  id: string;
  position: THREE.Vector3;
  radius: number;
  clearanceY: number;
  group: THREE.Group;
}

export interface ScorpionHazard {
  id: string;
  origin: THREE.Vector3;
  axis: 'x' | 'z';
  amplitude: number;
  speed: number;
  phase: number;
  position: THREE.Vector3;
  radius: number;
  clearanceY: number;
  group: THREE.Group;
  tailGroup: THREE.Group;
  legsLeft: THREE.Mesh[];
  legsRight: THREE.Mesh[];
}

export interface DogCompanionRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  tailPivot: THREE.Group;
  legs: THREE.Mesh[]; // FL, FR, BL, BR
  position: THREE.Vector3;
  yaw: number;
  auraRing: THREE.Mesh;
}

export interface OutdoorVillageWorld {
  root: THREE.Group;
  colliders: OutdoorCollider[];
  thorns: ThornHazard[];
  scorpions: ScorpionHazard[];
  dog: DogCompanionRig;
  pawPrintGroup: THREE.Group;
  pawPrintMats: THREE.MeshBasicMaterial[];
  pawTrailCoords: Array<{ x: number; z: number }>;
  biscuitPos: THREE.Vector3;
  biscuitGroup: THREE.Group;
  biscuitAura: THREE.Mesh;
  pulleyPickupPos: THREE.Vector3;
  pulleyPickupGroup: THREE.Group;
  pulleyPickupAura: THREE.Mesh;
  wellPos: THREE.Vector3;
  wellInstalledPulley: THREE.Group;
  wellBucketGroup: THREE.Group;
  wellBucketWater: THREE.Mesh;
  wellRopeMesh: THREE.Mesh;
  wellAura: THREE.Mesh;
  tulsiPos: THREE.Vector3;
  tulsiWaterGlow: THREE.Mesh;
  tulsiAura: THREE.Mesh;
  verandaRestPos: THREE.Vector3;
  verandaAura: THREE.Mesh;
  haveliKeyPos: THREE.Vector3;
  haveliKeyGroup: THREE.Group;
  haveliKeyAura: THREE.Mesh;
  haveliGatePos: THREE.Vector3;
  lanternLights: Array<{ light: THREE.PointLight; base: number; phase: number; flame?: THREE.Mesh }>;
  landmarks: MinimapLandmark[];
  resolvePlayerCollision: (pos: THREE.Vector3, radius: number) => void;
  getZoneName: (x: number, z: number) => string;
  applyQualityMaterials: (isLow: boolean) => void;
  updateVisuals: (dt: number, elapsed: number, bucketProgress: number) => void;
}

function makeAuraRing(colorHex: number, radius = 0.65): THREE.Mesh {
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
  mesh.position.y = 0.035;
  return mesh;
}

function createGnarledTree(
  barkMat: THREE.MeshStandardMaterial,
  foliageMat: THREE.MeshStandardMaterial,
  scale = 1.0,
  seed = 1
): THREE.Group {
  const g = new THREE.Group();

  // Primary gnarled trunk + flare base
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28 * scale, 0.56 * scale, 3.8 * scale, 8),
    barkMat
  );
  trunk.position.y = 1.9 * scale;
  trunk.rotation.z = ((seed % 5) - 2) * 0.03;
  g.add(trunk);

  // Thick spreading branches (Banyan/Peepal silhouette)
  const branchAngles = [0.2, 2.25, 4.3];
  branchAngles.forEach((ang, idx) => {
    const br = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * scale, 0.22 * scale, 2.4 * scale, 6),
      barkMat
    );
    br.position.set(
      Math.cos(ang + seed) * 0.75 * scale,
      3.4 * scale + idx * 0.2 * scale,
      Math.sin(ang + seed) * 0.75 * scale
    );
    br.rotation.z = Math.cos(ang + seed) * -0.68;
    br.rotation.x = Math.sin(ang + seed) * 0.68;
    g.add(br);

    // Aerial hanging banyan root
    const rootStrand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03 * scale, 0.045 * scale, 3.1 * scale, 5),
      barkMat
    );
    rootStrand.position.set(
      Math.cos(ang + seed) * 1.45 * scale,
      1.65 * scale,
      Math.sin(ang + seed) * 1.45 * scale
    );
    g.add(rootStrand);
  });

  // Layered canopy clusters (composite silhouette, not single sphere)
  const canopyOffsets: Array<[number, number, number, number]> = [
    [0, 4.7, 0, 1.9],
    [-1.2, 4.15, 0.65, 1.35],
    [1.15, 4.25, -0.55, 1.45],
    [0.25, 4.05, 1.2, 1.25],
    [-0.45, 5.2, -0.7, 1.18],
  ];
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  canopyOffsets.forEach(([x, y, z, r]) => {
    const puff = new THREE.Mesh(crownGeo, foliageMat);
    puff.position.set(x * scale, y * scale, z * scale);
    puff.scale.set(r * scale * 1.15, r * scale * 0.72, r * scale * 1.08);
    g.add(puff);
  });

  return g;
}

function createThornBush(
  barkMat: THREE.MeshStandardMaterial,
  foliageMat: THREE.MeshStandardMaterial,
  spikeMat: THREE.MeshStandardMaterial
): THREE.Group {
  const g = new THREE.Group();

  // Low dark thorny mound
  const baseGeo = new THREE.DodecahedronGeometry(0.58, 0);
  const m1 = new THREE.Mesh(baseGeo, foliageMat);
  m1.position.set(0, 0.24, 0);
  m1.scale.set(1.55, 0.52, 0.92);
  g.add(m1);

  const m2 = new THREE.Mesh(baseGeo, barkMat);
  m2.position.set(0.32, 0.2, 0.14);
  m2.scale.set(1.05, 0.44, 0.78);
  g.add(m2);

  // Sharp protruding bramble spikes (clearly readable under moonlight & flashlight)
  const spikeGeo = new THREE.ConeGeometry(0.038, 0.38, 5);
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const rad = 0.22 + (i % 3) * 0.22;
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(Math.cos(ang) * rad * 1.35, 0.34 + (i % 2) * 0.08, Math.sin(ang) * rad * 0.82);
    spike.rotation.z = -Math.cos(ang) * 0.65;
    spike.rotation.x = Math.sin(ang) * 0.55;
    g.add(spike);
  }

  return g;
}

function createScorpionRig(
  chitinMat: THREE.MeshStandardMaterial,
  stingerMat: THREE.MeshStandardMaterial
): { group: THREE.Group; tailGroup: THREE.Group; legsLeft: THREE.Mesh[]; legsRight: THREE.Mesh[] } {
  const group = new THREE.Group();

  // Segmented glossy black scorpion carapace
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.34), chitinMat);
  torso.position.set(0, 0.11, 0);
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), chitinMat);
  head.position.set(0, 0.1, 0.2);
  group.add(head);

  // Twin curved pincer arms
  const pincerGeo = new THREE.BoxGeometry(0.06, 0.055, 0.26);
  const leftArm = new THREE.Mesh(pincerGeo, chitinMat);
  leftArm.position.set(-0.18, 0.11, 0.31);
  leftArm.rotation.y = 0.42;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(pincerGeo, chitinMat);
  rightArm.position.set(0.18, 0.11, 0.31);
  rightArm.rotation.y = -0.42;
  group.add(rightArm);

  // Claw tips
  const clawGeo = new THREE.ConeGeometry(0.045, 0.14, 5);
  clawGeo.rotateX(Math.PI / 2);
  const lClaw = new THREE.Mesh(clawGeo, stingerMat);
  lClaw.position.set(-0.22, 0.11, 0.44);
  lClaw.rotation.y = -0.35;
  group.add(lClaw);

  const rClaw = new THREE.Mesh(clawGeo, stingerMat);
  rClaw.position.set(0.22, 0.11, 0.44);
  rClaw.rotation.y = 0.35;
  group.add(rClaw);

  // Arched curled venomous tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.13, -0.17);
  const segGeo = new THREE.BoxGeometry(0.085, 0.08, 0.14);
  const t1 = new THREE.Mesh(segGeo, chitinMat);
  t1.position.set(0, 0.08, -0.08);
  t1.rotation.x = 0.72;
  tailGroup.add(t1);

  const t2 = new THREE.Mesh(segGeo, chitinMat);
  t2.position.set(0, 0.21, -0.11);
  t2.rotation.x = 1.45;
  tailGroup.add(t2);

  const t3 = new THREE.Mesh(segGeo, chitinMat);
  t3.position.set(0, 0.32, -0.02);
  t3.rotation.x = 2.45;
  tailGroup.add(t3);

  const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.13, 6), stingerMat);
  stinger.position.set(0, 0.33, 0.09);
  stinger.rotation.x = Math.PI * 0.62;
  tailGroup.add(stinger);
  group.add(tailGroup);

  // 8 animated scuttling legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.032, 0.036);
  const legsLeft: THREE.Mesh[] = [];
  const legsRight: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const zOff = 0.12 - i * 0.085;
    const ll = new THREE.Mesh(legGeo, chitinMat);
    ll.position.set(-0.2, 0.07, zOff);
    ll.rotation.z = 0.35;
    group.add(ll);
    legsLeft.push(ll);

    const rl = new THREE.Mesh(legGeo, chitinMat);
    rl.position.set(0.2, 0.07, zOff);
    rl.rotation.z = -0.35;
    group.add(rl);
    legsRight.push(rl);
  }

  // Subtle pale crimson ground hazard ring under the scorpion so night readability is fair on mobile
  const warnRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 18).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xd94444,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  warnRing.position.y = 0.025;
  group.add(warnRing);

  return { group, tailGroup, legsLeft, legsRight };
}

function createStreetDogRig(textures: ProceduralTexturePack): DogCompanionRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const furMat = new THREE.MeshStandardMaterial({
    color: 0xa6794b,
    bumpMap: textures.woodBump,
    bumpScale: 0.015,
    roughness: 0.88,
    metalness: 0.02,
  });
  const darkFurMat = new THREE.MeshStandardMaterial({
    color: 0x4b3320,
    roughness: 0.9,
    metalness: 0.02,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf6d38b });

  // Contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.85).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    })
  );
  shadow.position.y = 0.015;
  root.add(shadow);

  // Primary torso & chest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.74), furMat);
  torso.position.set(0, 0.48, 0);
  bodyGroup.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.28), furMat);
  chest.position.set(0, 0.5, 0.24);
  bodyGroup.add(chest);

  // Articulated head, snout, floppy ears & warm reflective eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.64, 0.38);
  bodyGroup.add(headGroup);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.23, 0.26), furMat);
  skull.position.set(0, 0.08, 0.04);
  headGroup.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.2), darkFurMat);
  snout.position.set(0, 0.02, 0.2);
  headGroup.add(snout);

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x151210, roughness: 0.35 })
  );
  nose.position.set(0, 0.045, 0.3);
  headGroup.add(nose);

  const earGeo = new THREE.BoxGeometry(0.06, 0.16, 0.09);
  const leftEar = new THREE.Mesh(earGeo, darkFurMat);
  leftEar.position.set(-0.13, 0.12, 0.02);
  leftEar.rotation.z = 0.28;
  headGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, darkFurMat);
  rightEar.position.set(0.13, 0.12, 0.02);
  rightEar.rotation.z = -0.28;
  headGroup.add(rightEar);

  const eyeGeo = new THREE.SphereGeometry(0.022, 6, 6);
  const lEye = new THREE.Mesh(eyeGeo, eyeMat);
  lEye.position.set(-0.07, 0.11, 0.165);
  headGroup.add(lEye);
  const rEye = new THREE.Mesh(eyeGeo, eyeMat);
  rEye.position.set(0.07, 0.11, 0.165);
  headGroup.add(rEye);

  // Articulated wagging tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.56, -0.36);
  bodyGroup.add(tailPivot);

  const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 0.36, 6), darkFurMat);
  tailMesh.position.set(0, 0.11, -0.11);
  tailMesh.rotation.x = -0.78;
  tailPivot.add(tailMesh);

  // 4 articulated trotting legs
  const legGeo = new THREE.CylinderGeometry(0.042, 0.034, 0.42, 6);
  const legCoords: Array<[number, number]> = [
    [-0.11, 0.26],
    [0.11, 0.26],
    [-0.11, -0.25],
    [0.11, -0.25],
  ];
  const legs: THREE.Mesh[] = legCoords.map(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, furMat);
    leg.position.set(lx, 0.21, lz);
    bodyGroup.add(leg);
    return leg;
  });

  const auraRing = makeAuraRing(0xf3bd60, 0.82);
  root.add(auraRing);

  return {
    root,
    bodyGroup,
    headGroup,
    tailPivot,
    legs,
    position: new THREE.Vector3(-10.6, 0, 11.4),
    yaw: 0.7,
    auraRing,
  };
}

export function buildOutdoorVillageWorld(
  textures: ProceduralTexturePack,
  isLowQuality: boolean
): OutdoorVillageWorld {
  const root = new THREE.Group();
  const colliders: OutdoorCollider[] = [];
  const lanternLights: OutdoorVillageWorld['lanternLights'] = [];

  const addCollider = (cx: number, cz: number, w: number, d: number) => {
    colliders.push({
      minX: cx - w * 0.5,
      maxX: cx + w * 0.5,
      minZ: cz - d * 0.5,
      maxZ: cz + d * 0.5,
    });
  };

  // Shared outdoor PBR materials (Full diffuse + bump + roughness on High; lighter on Low)
  const mudMat = new THREE.MeshStandardMaterial({
    map: textures.mudColor,
    bumpMap: textures.mudBump,
    bumpScale: 0.055,
    roughnessMap: isLowQuality ? null : textures.mudRoughness,
    roughness: 0.9,
    metalness: 0.04,
  });

  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x5c4935,
    map: textures.mudColor,
    bumpMap: textures.mudBump,
    bumpScale: 0.04,
    roughness: 0.88,
    metalness: 0.03,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.05,
    roughnessMap: isLowQuality ? null : textures.stoneRoughness,
    roughness: 0.86,
    metalness: 0.06,
  });

  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plasterColor,
    bumpMap: textures.plasterBump,
    bumpScale: 0.045,
    roughnessMap: isLowQuality ? null : textures.plasterRoughness,
    roughness: 0.88,
    metalness: 0.04,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.04,
    roughnessMap: isLowQuality ? null : textures.woodRoughness,
    roughness: 0.84,
    metalness: 0.06,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: textures.ironColor,
    bumpMap: textures.ironBump,
    bumpScale: 0.035,
    roughnessMap: isLowQuality ? null : textures.ironRoughness,
    roughness: 0.54,
    metalness: 0.78,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    map: textures.brassColor,
    bumpMap: textures.brassBump,
    bumpScale: 0.025,
    roughnessMap: isLowQuality ? null : textures.brassRoughness,
    roughness: 0.34,
    metalness: 0.84,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.barkColor,
    bumpMap: textures.barkBump,
    bumpScale: 0.05,
    roughness: 0.94,
    metalness: 0.02,
  });

  const foliageMat = new THREE.MeshStandardMaterial({
    map: textures.foliageColor,
    bumpMap: textures.foliageBump,
    bumpScale: 0.035,
    roughness: 0.92,
    metalness: 0.02,
  });

  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0x8f7d63,
    roughness: 0.75,
    metalness: 0.08,
  });

  // ========================================================
  // 1. EXTENDED DAMP VILLAGE TERRAIN & DIRT PATHS (OPEN HORIZON)
  // ========================================================
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), mudMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // Main village mud road leading from Start (0, 25) straight north to Haveli Gate (0, -22)
  const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 52), pathMat);
  mainRoad.rotation.x = -Math.PI / 2;
  mainRoad.position.set(0, 0.015, 3);
  mainRoad.receiveShadow = true;
  root.add(mainRoad);

  // Side dirt lane curving west to Ruined Hut & Tea-Stall
  const westLane = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.8), pathMat);
  westLane.rotation.x = -Math.PI / 2;
  westLane.rotation.z = -0.35;
  westLane.position.set(-7.5, 0.014, 15.8);
  root.add(westLane);

  // Cross-lane connecting Ruined Hut -> Stone Well -> Broken Shed -> Tulsi Chaura
  const wellLane = new THREE.Mesh(new THREE.PlaneGeometry(25, 2.6), pathMat);
  wellLane.rotation.x = -Math.PI / 2;
  wellLane.rotation.z = 0.28;
  wellLane.position.set(-1.0, 0.014, 7.6);
  root.add(wellLane);

  const shedLane = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), pathMat);
  shedLane.rotation.x = -Math.PI / 2;
  shedLane.rotation.z = 0.55;
  shedLane.position.set(11.6, 0.014, -0.2);
  root.add(shedLane);

  // ========================================================
  // 2. MONUMENTAL HAVELI FACADE & CLOSED MAIN GATE (NORTH: Z = -22)
  // ========================================================
  const haveliGatePos = new THREE.Vector3(0, 0, -21.8);
  const gateFacade = new THREE.Group();
  gateFacade.position.copy(haveliGatePos);

  // Flanking weathered haveli boundary walls
  const leftBoundary = new THREE.Mesh(new THREE.BoxGeometry(18, 4.4, 1.1), plasterMat);
  leftBoundary.position.set(-11.4, 2.2, 0);
  gateFacade.add(leftBoundary);
  addCollider(-11.4, -21.8, 18, 1.4);

  const rightBoundary = new THREE.Mesh(new THREE.BoxGeometry(18, 4.4, 1.1), plasterMat);
  rightBoundary.position.set(11.4, 2.2, 0);
  gateFacade.add(rightBoundary);
  addCollider(11.4, -21.8, 18, 1.4);

  // Looming upper Haveli silhouette rising behind the closed gate
  const haveliBackdrop = new THREE.Mesh(new THREE.BoxGeometry(24, 9.2, 3.2), plasterMat);
  haveliBackdrop.position.set(0, 4.6, -6.5);
  gateFacade.add(haveliBackdrop);

  // Ornate central arched gatehouse parapet + chhatri dome silhouettes
  const gateArch = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.6, 1.3), stoneMat);
  gateArch.position.set(0, 4.5, 0);
  gateFacade.add(gateArch);

  const domeGeo = new THREE.SphereGeometry(0.95, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const leftDome = new THREE.Mesh(domeGeo, stoneMat);
  leftDome.position.set(-2.35, 5.25, 0);
  gateFacade.add(leftDome);
  const rightDome = new THREE.Mesh(domeGeo, stoneMat);
  rightDome.position.set(2.35, 5.25, 0);
  gateFacade.add(rightDome);

  // Reuse our detailed rusted wrought-iron double gate
  const ironGate = createRustedIronGate(textures);
  ironGate.scale.set(1.22, 1.15, 1);
  gateFacade.add(ironGate);
  addCollider(0, -21.6, 5.4, 1.2);

  // Warm oil lanterns flanking the closed Haveli gate so the silhouette beckons in the mist
  [-2.65, 2.65].forEach((gx, idx) => {
    const lanternHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.34, 6), ironMat);
    lanternHousing.position.set(gx, 3.45, 0.72);
    gateFacade.add(lanternHousing);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb84d })
    );
    flame.position.set(gx, 3.42, 0.72);
    gateFacade.add(flame);

    const light = new THREE.PointLight(0xff9c38, 2.4, 12, 1.7);
    light.position.set(gx, 3.42, 1.0);
    light.castShadow = false;
    gateFacade.add(light);
    lanternLights.push({ light, base: 2.4, phase: idx * 2.1, flame });
  });
  root.add(gateFacade);

  // ========================================================
  // 3. GLOWING MUDDY DOG PAW PRINT TRAIL (STEP 1 -> STEP 2)
  // ========================================================
  const pawPrintGroup = new THREE.Group();
  pawPrintGroup.visible = false; // Revealed when player turns around after hearing the bark!
  const pawPrintMats: THREE.MeshBasicMaterial[] = [];
  const pawTrailCoords: Array<{ x: number; z: number }> = [
    { x: 0.1, z: 26.2 },
    { x: -1.1, z: 25.0 },
    { x: -2.4, z: 23.6 },
    { x: -3.6, z: 22.4 },
    { x: -5.1, z: 20.6 },
    { x: -6.4, z: 19.2 },
    { x: -7.7, z: 17.8 },
    { x: -9.1, z: 16.0 },
    { x: -10.0, z: 14.2 },
    { x: -10.5, z: 12.6 },
  ];

  const pawGeo = new THREE.PlaneGeometry(0.68, 0.68);
  pawGeo.rotateX(-Math.PI / 2);

  pawTrailCoords.forEach((pt, idx) => {
    const next = pawTrailCoords[Math.min(idx + 1, pawTrailCoords.length - 1)];
    const yaw = Math.atan2(next.x - pt.x, next.z - pt.z);
    const mat = new THREE.MeshBasicMaterial({
      map: textures.pawPrintColor,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const decal = new THREE.Mesh(pawGeo, mat);
    const sideOffset = (idx % 2 === 0 ? 1 : -1) * 0.16;
    decal.position.set(pt.x + sideOffset, 0.032, pt.z);
    decal.rotation.y = yaw + Math.PI;
    pawPrintGroup.add(decal);
    pawPrintMats.push(mat);
  });
  root.add(pawPrintGroup);

  // ========================================================
  // 4. RUINED HUT (WHERE THE HUNGRY DOG WAITS: -11.5, 11.4)
  // ========================================================
  const hutGroup = new THREE.Group();
  hutGroup.position.set(-12.6, 0, 11.2);
  hutGroup.rotation.y = 0.35;

  const hutBack = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.35, 0.32), plasterMat);
  hutBack.position.set(0, 1.18, -1.35);
  hutGroup.add(hutBack);
  const hutLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.15, 2.7), plasterMat);
  hutLeft.position.set(-1.55, 1.08, 0);
  hutGroup.add(hutLeft);
  const hutRightBroken = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.25, 1.6), plasterMat);
  hutRightBroken.position.set(1.55, 0.62, -0.5);
  hutGroup.add(hutRightBroken);
  const hutRoof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 3.2), woodMat);
  hutRoof.position.set(-0.15, 2.45, -0.1);
  hutRoof.rotation.z = 0.16;
  hutGroup.add(hutRoof);
  root.add(hutGroup);
  addCollider(-13.1, 10.6, 3.2, 2.6);

  // ========================================================
  // 5. RUINED WOODEN TEA-STALL & CRATES (BISCUIT PACKET: -15.4, 3.4)
  // ========================================================
  const stallGroup = new THREE.Group();
  stallGroup.position.set(-15.8, 0, 3.2);
  stallGroup.rotation.y = 0.22;

  const stallCounter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.92, 1.05), woodMat);
  stallCounter.position.set(0, 0.46, 0);
  stallGroup.add(stallCounter);

  [[-1.2, -0.42], [1.2, -0.42], [-1.2, 0.42], [1.2, 0.42]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.35, 0.11), woodMat);
    post.position.set(px, 1.18, pz);
    stallGroup.add(post);
  });

  const stallAwning = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.65), woodMat);
  stallAwning.position.set(0, 2.38, 0.08);
  stallAwning.rotation.x = 0.22;
  stallGroup.add(stallAwning);

  // Wooden crates beside the tea-stall
  const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.68, 0.72), woodMat);
  crate1.position.set(1.85, 0.34, 0.28);
  crate1.rotation.y = 0.35;
  stallGroup.add(crate1);

  const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.62), woodMat);
  crate2.position.set(1.65, 0.26, -0.58);
  stallGroup.add(crate2);
  root.add(stallGroup);
  addCollider(-15.8, 3.2, 2.8, 1.35);

  // Collectible Biscuit Packet resting atop the tea-stall crate
  const biscuitPos = new THREE.Vector3(-13.9, 0.78, 3.85);
  const biscuitGroup = new THREE.Group();
  biscuitGroup.position.copy(biscuitPos);
  const packBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.12, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0xd99038,
      emissive: 0x6b3a08,
      emissiveIntensity: 0.45,
      roughness: 0.45,
    })
  );
  biscuitGroup.add(packBody);
  const packStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.04, 0.165),
    new THREE.MeshStandardMaterial({ color: 0x9b241c, roughness: 0.5 })
  );
  biscuitGroup.add(packStripe);
  const biscuitAura = makeAuraRing(0xf5be58, 0.75);
  biscuitAura.position.set(biscuitPos.x, 0.035, biscuitPos.z);
  root.add(biscuitGroup);
  root.add(biscuitAura);

  // ========================================================
  // 6. ANCIENT STONE WELL (KUAN) + PULLEY & ANIMATED WATER BUCKET (8.0, 4.0)
  // ========================================================
  const wellPos = new THREE.Vector3(8.0, 0, 4.0);
  const wellGroup = new THREE.Group();
  wellGroup.position.copy(wellPos);

  // Outer stone rim + plinth
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.62, 0.28, 16), stoneMat);
  wellBase.position.y = 0.14;
  wellGroup.add(wellBase);

  const wellRim = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.26, 0.96, 16, 1, true), stoneMat);
  wellRim.position.y = 0.68;
  wellGroup.add(wellRim);

  const wellLip = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.13, 8, 20).rotateX(Math.PI / 2),
    stoneMat
  );
  wellLip.position.y = 1.15;
  wellGroup.add(wellLip);

  // Dark shaft water interior
  const wellShaft = new THREE.Mesh(
    new THREE.CircleGeometry(1.04, 16).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x061014, roughness: 0.2, metalness: 0.35 })
  );
  wellShaft.position.y = 0.38;
  wellGroup.add(wellShaft);

  // Timber A-frame supporting the pulley crossbeam
  [-1.12, 1.12].forEach((wx) => {
    const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.55, 7), woodMat);
    upright.position.set(wx, 1.55, 0);
    wellGroup.add(upright);
  });
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.16, 0.18), woodMat);
  crossBeam.position.set(0, 2.75, 0);
  wellGroup.add(crossBeam);

  // Empty iron mounting bracket (visible until pulley is fitted)
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.22), ironMat);
  bracket.position.set(0, 2.58, 0);
  wellGroup.add(bracket);

  // Mountable Wooden-and-Iron Pulley (ghirni) — hidden until installed!
  const wellInstalledPulley = new THREE.Group();
  wellInstalledPulley.position.set(0, 2.42, 0);
  wellInstalledPulley.visible = false;
  const pulleyWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14).rotateZ(Math.PI / 2),
    woodMat
  );
  wellInstalledPulley.add(pulleyWheel);
  const pulleyRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.032, 6, 16).rotateY(Math.PI / 2),
    ironMat
  );
  wellInstalledPulley.add(pulleyRim);
  const pulleyAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8).rotateZ(Math.PI / 2),
    ironMat
  );
  wellInstalledPulley.add(pulleyAxle);
  wellGroup.add(wellInstalledPulley);

  // Hemp rope dropping from pulley down to bucket
  const wellRopeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.85, 6),
    new THREE.MeshStandardMaterial({ color: 0x8f744c, roughness: 0.95 })
  );
  wellRopeMesh.position.set(0, 1.52, 0);
  wellRopeMesh.visible = false;
  wellGroup.add(wellRopeMesh);

  // Rusted Iron Water Bucket rising out of the well
  const wellBucketGroup = new THREE.Group();
  wellBucketGroup.position.set(0, 0.48, 0);
  wellBucketGroup.visible = false;
  const bucketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.36, 12, 1, true), ironMat);
  wellBucketGroup.add(bucketBody);
  const bucketBottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 10).rotateX(-Math.PI / 2),
    ironMat
  );
  bucketBottom.position.y = -0.17;
  wellBucketGroup.add(bucketBottom);
  const wellBucketWater = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 12).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x4fb4c8,
      emissive: 0x164a56,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.25,
    })
  );
  wellBucketWater.position.y = 0.11;
  wellBucketGroup.add(wellBucketWater);
  wellGroup.add(wellBucketGroup);

  const wellAura = makeAuraRing(0xf5be58, 1.75);
  wellGroup.add(wellAura);
  root.add(wellGroup);
  addCollider(wellPos.x, wellPos.z, 2.75, 2.75);

  // ========================================================
  // 7. BROKEN WOODEN SHED (MISSING PULLEY PICKUP: 15.6, -4.4)
  // ========================================================
  const shedGroup = new THREE.Group();
  shedGroup.position.set(16.4, 0, -4.8);
  shedGroup.rotation.y = -0.45;

  const shedBack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.15, 0.22), woodMat);
  shedBack.position.set(0, 1.08, -1.1);
  shedGroup.add(shedBack);
  const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 2.5), woodMat);
  shedRoof.position.set(0, 2.12, 0);
  shedRoof.rotation.x = 0.25;
  shedRoof.rotation.z = -0.12;
  shedGroup.add(shedRoof);
  const shedBench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.56, 0.72), woodMat);
  shedBench.position.set(-0.4, 0.28, 0.35);
  shedGroup.add(shedBench);
  root.add(shedGroup);
  addCollider(16.6, -5.2, 3.0, 2.2);

  // Collectible Wood-and-Iron Pulley (घिरनी)
  const pulleyPickupPos = new THREE.Vector3(15.2, 0.74, -4.1);
  const pulleyPickupGroup = new THREE.Group();
  pulleyPickupGroup.position.copy(pulleyPickupPos);
  const pWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.09, 14).rotateX(Math.PI / 2),
    woodMat
  );
  pulleyPickupGroup.add(pWheel);
  const pRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 6, 16), ironMat);
  pulleyPickupGroup.add(pRim);
  const pHook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 10, Math.PI * 1.4), ironMat);
  pHook.position.set(0, 0.28, 0);
  pulleyPickupGroup.add(pHook);

  const pulleyPickupAura = makeAuraRing(0xf5be58, 0.78);
  pulleyPickupAura.position.set(pulleyPickupPos.x, 0.035, pulleyPickupPos.z);
  root.add(pulleyPickupGroup);
  root.add(pulleyPickupAura);

  // ========================================================
  // 8. SACRED TULSI CHAURA & STONE VERANDA (4.2, -8.8)
  // ========================================================
  const tulsiPos = new THREE.Vector3(4.2, 0, -8.8);
  const tulsiGroup = new THREE.Group();
  tulsiGroup.position.copy(tulsiPos);

  const chauraBase = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.32, 1.25), stoneMat);
  chauraBase.position.y = 0.16;
  tulsiGroup.add(chauraBase);
  const chauraMid = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.68, 0.92), plasterMat);
  chauraMid.position.y = 0.66;
  tulsiGroup.add(chauraMid);
  const chauraCrown = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.14, 1.06), stoneMat);
  chauraCrown.position.y = 1.04;
  tulsiGroup.add(chauraCrown);

  // Lush Sacred Tulsi Plant stems & leaf clusters
  const tulsiLeafMat = new THREE.MeshStandardMaterial({
    color: 0x3b7a45,
    map: textures.foliageColor,
    roughness: 0.72,
    metalness: 0.02,
  });
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.45, 5);
  const leafClusterGeo = new THREE.DodecahedronGeometry(0.16, 0);
  [
    [0, 0],
    [-0.14, 0.12],
    [0.14, 0.1],
    [-0.1, -0.13],
    [0.12, -0.11],
  ].forEach(([lx, lz], idx) => {
    const stem = new THREE.Mesh(stemGeo, barkMat);
    stem.position.set(lx, 1.26, lz);
    stem.rotation.z = lx * 1.4;
    tulsiGroup.add(stem);
    const leaf = new THREE.Mesh(leafClusterGeo, tulsiLeafMat);
    leaf.position.set(lx * 1.35, 1.48 + (idx % 2) * 0.08, lz * 1.35);
    leaf.scale.set(1.15, 0.82, 1.15);
    tulsiGroup.add(leaf);
  });

  // Glowing blessed water shimmer ring after watering Tulsi
  const tulsiWaterGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.44, 18).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x74d8e8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  tulsiWaterGlow.position.y = 1.13;
  tulsiGroup.add(tulsiWaterGlow);

  // Warm clay Diya sitting on the Tulsi Chaura niche
  const tulsiDiya = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.05, 8), brassMat);
  tulsiDiya.position.set(0, 1.13, 0.44);
  tulsiGroup.add(tulsiDiya);
  const tulsiFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.032, 0.1, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc65c })
  );
  tulsiFlame.position.set(0, 1.2, 0.44);
  tulsiGroup.add(tulsiFlame);
  const tulsiLight = new THREE.PointLight(0xffa43c, 1.85, 8.5, 1.8);
  tulsiLight.position.set(0, 1.42, 0.58);
  tulsiLight.castShadow = false;
  tulsiGroup.add(tulsiLight);
  lanternLights.push({ light: tulsiLight, base: 1.85, phase: 4.4, flame: tulsiFlame });

  const tulsiAura = makeAuraRing(0x74d8e8, 1.15);
  tulsiGroup.add(tulsiAura);
  root.add(tulsiGroup);
  addCollider(tulsiPos.x, tulsiPos.z, 1.35, 1.35);

  // Stone Veranda / Chabutra beside the Tulsi Chaura where player lies down & gets poked!
  const verandaRestPos = new THREE.Vector3(1.5, 0, -9.0);
  const verandaSlab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.24, 2.2), stoneMat);
  verandaSlab.position.set(verandaRestPos.x, 0.12, verandaRestPos.z);
  verandaSlab.receiveShadow = true;
  root.add(verandaSlab);

  const verandaAura = makeAuraRing(0xf5be58, 1.05);
  verandaAura.position.set(verandaRestPos.x, 0.26, verandaRestPos.z);
  root.add(verandaAura);

  // Heavy Rusted Iron Haveli Key (हवेली की चाभी) revealed on the veranda soil after the poke!
  const haveliKeyPos = new THREE.Vector3(1.65, 0.28, -9.15);
  const haveliKeyGroup = new THREE.Group();
  haveliKeyGroup.position.copy(haveliKeyPos);
  haveliKeyGroup.visible = false;

  const keyBow = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 14), ironMat);
  keyBow.rotation.x = Math.PI / 2;
  keyBow.position.set(-0.14, 0.04, 0);
  haveliKeyGroup.add(keyBow);

  const keyShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8).rotateZ(Math.PI / 2),
    ironMat
  );
  keyShaft.position.set(0.05, 0.04, 0);
  haveliKeyGroup.add(keyShaft);

  const keyBit1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, 0.095), ironMat);
  keyBit1.position.set(0.14, 0.04, 0.045);
  haveliKeyGroup.add(keyBit1);
  const keyBit2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 0.075), ironMat);
  keyBit2.position.set(0.19, 0.04, 0.038);
  haveliKeyGroup.add(keyBit2);

  // Golden glint rim so the key gleams clearly on the dark stone slab
  const keyGlint = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdc7a })
  );
  keyGlint.position.set(0.04, 0.08, 0);
  haveliKeyGroup.add(keyGlint);

  const haveliKeyAura = makeAuraRing(0xffd268, 0.58);
  haveliKeyAura.position.set(haveliKeyPos.x, 0.265, haveliKeyPos.z);
  root.add(haveliKeyGroup);
  root.add(haveliKeyAura);

  // ========================================================
  // 9. SHARP THORNY BUSHES (काँटे) — JUMP TO CROSS!
  // ========================================================
  const thornCoords: Array<{ id: string; x: number; z: number; rot: number }> = [
    { id: 'thorn_trail_1', x: -3.4, z: 22.6, rot: 0.45 },
    { id: 'thorn_trail_2', x: -8.6, z: 16.4, rot: -0.35 },
    { id: 'thorn_stall', x: -12.6, z: 7.4, rot: 0.22 },
    { id: 'thorn_shed', x: 11.8, z: -0.6, rot: -0.58 },
  ];

  const thorns: ThornHazard[] = thornCoords.map((tc) => {
    const group = createThornBush(barkMat, foliageMat, spikeMat);
    group.position.set(tc.x, 0, tc.z);
    group.rotation.y = tc.rot;
    root.add(group);
    return {
      id: tc.id,
      position: new THREE.Vector3(tc.x, 0, tc.z),
      radius: 0.88,
      clearanceY: 0.42,
      group,
    };
  });

  // ========================================================
  // 10. ANIMATED SCUTTLING BLACK SCORPIONS (बिच्छू)
  // ========================================================
  const chitinMat = new THREE.MeshStandardMaterial({
    color: 0x161920,
    roughness: 0.24,
    metalness: 0.45,
  });
  const stingerMat = new THREE.MeshStandardMaterial({
    color: 0x9c2828,
    emissive: 0x450b0b,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.25,
  });

  const scorpionConfigs: Array<{
    id: string;
    x: number;
    z: number;
    axis: 'x' | 'z';
    amp: number;
    speed: number;
    phase: number;
  }> = [
    { id: 'scorp_trail', x: -6.5, z: 19.2, axis: 'x', amp: 1.85, speed: 1.45, phase: 0.4 },
    { id: 'scorp_stall', x: -13.6, z: 5.4, axis: 'x', amp: 1.9, speed: 1.65, phase: 2.1 },
    { id: 'scorp_shed', x: 13.6, z: -2.4, axis: 'z', amp: 1.85, speed: 1.55, phase: 4.0 },
  ];

  const scorpions: ScorpionHazard[] = scorpionConfigs.map((sc) => {
    const rig = createScorpionRig(chitinMat, stingerMat);
    rig.group.position.set(sc.x, 0, sc.z);
    root.add(rig.group);
    return {
      id: sc.id,
      origin: new THREE.Vector3(sc.x, 0, sc.z),
      axis: sc.axis,
      amplitude: sc.amp,
      speed: sc.speed,
      phase: sc.phase,
      position: new THREE.Vector3(sc.x, 0, sc.z),
      radius: 0.62,
      clearanceY: 0.34,
      group: rig.group,
      tailGroup: rig.tailGroup,
      legsLeft: rig.legsLeft,
      legsRight: rig.legsRight,
    };
  });

  // ========================================================
  // 11. NATURAL PERIMETER: GNARLED BANYAN/PEEPAL GROVES & MOSSY ROCKS
  // ========================================================
  const treePlacements: Array<[number, number, number]> = [
    // Flanking the village road & outskirts
    [-5.8, 28.5, 1.2],
    [6.2, 27.2, 1.15],
    [9.4, 21.0, 1.35],
    [13.5, 14.5, 1.18],
    [17.8, 7.2, 1.3],
    [20.5, -1.2, 1.25],
    [19.2, -11.5, 1.4],
    [12.4, -17.5, 1.2],
    [-10.2, 24.5, 1.25],
    [-16.8, 18.2, 1.38],
    [-20.5, 9.5, 1.25],
    [-21.2, -2.5, 1.32],
    [-16.4, -11.8, 1.4],
    [-9.8, -17.8, 1.22],
    // Atmospheric landmark trees inside outskirts (well clear of trails)
    [-3.5, 12.2, 1.05],
    [3.8, 15.6, 1.12],
    [-6.2, -4.8, 1.24],
    [9.5, -14.2, 1.15],
  ];

  treePlacements.forEach(([tx, tz, sc], idx) => {
    const tree = createGnarledTree(barkMat, foliageMat, sc, idx + 1);
    tree.position.set(tx, 0, tz);
    tree.rotation.y = idx * 1.17;
    root.add(tree);
    addCollider(tx, tz, 1.25 * sc, 1.25 * sc);
  });

  // Mossy rock outcrops framing the village perimeter
  const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
  const rockCoords: Array<[number, number, number]> = [
    [-4.2, 29.8, 1.1],
    [4.4, 29.6, 1.2],
    [0.0, 30.8, 1.4],
    [-18.5, 13.5, 1.3],
    [18.8, 2.8, 1.2],
    [-11.8, -14.5, 1.15],
    [12.5, 10.5, 1.0],
  ];
  rockCoords.forEach(([rx, rz, rs], i) => {
    const rock = new THREE.Mesh(rockGeo, stoneMat);
    rock.position.set(rx, 0.35 * rs, rz);
    rock.scale.set(rs * 1.25, rs * 0.65, rs * 1.1);
    rock.rotation.set(i * 0.4, i * 0.9, 0);
    root.add(rock);
    addCollider(rx, rz, rs * 1.8, rs * 1.6);
  });

  // ========================================================
  // 12. ANIMATED 3D STREET DOG COMPANION
  // ========================================================
  const dog = createStreetDogRig(textures);
  dog.root.position.copy(dog.position);
  dog.root.rotation.y = dog.yaw;
  root.add(dog.root);

  // Minimap landmarks metadata
  const landmarks: MinimapLandmark[] = [
    { id: 'lm_hut', x: -12.6, z: 11.2, label: 'Hut', kind: 'hut' },
    { id: 'lm_stall', x: -15.4, z: 3.4, label: 'Stall', kind: 'stall' },
    { id: 'lm_well', x: wellPos.x, z: wellPos.z, label: 'Well', kind: 'well' },
    { id: 'lm_shed', x: 16.0, z: -4.6, label: 'Shed', kind: 'shed' },
    { id: 'lm_tulsi', x: tulsiPos.x, z: tulsiPos.z, label: 'Tulsi', kind: 'tulsi' },
    { id: 'lm_gate', x: haveliGatePos.x, z: haveliGatePos.z, label: 'Haveli Gate', kind: 'gate' },
  ];

  // ========================================================
  // COLLISION & QUALITY HELPERS
  // ========================================================
  const resolvePlayerCollision = (pos: THREE.Vector3, radius: number) => {
    // Soft natural perimeter clamp (bounded by dense trees & rocks before fog horizon)
    pos.x = Math.max(-19.2, Math.min(19.2, pos.x));
    pos.z = Math.max(-20.2, Math.min(28.8, pos.z));

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
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
            pos.z += radius;
          }
        }
      }
    }
  };

  const getZoneName = (x: number, z: number): string => {
    if (z < -15) return 'Haveli Main Gate';
    if (z < -4 && x > -2 && x < 9) return 'Tulsi Veranda';
    if (x > 11 && z < 1) return 'Broken Shed';
    if (x > 3 && z >= -2 && z <= 10) return 'Ancient Stone Well';
    if (x < -11 && z < 8) return 'Ruined Tea-Stall';
    if (x < -7 && z >= 8) return 'Ruined Village Hut';
    return 'Misty Village Path';
  };

  const applyQualityMaterials = (isLow: boolean) => {
    mudMat.roughnessMap = isLow ? null : textures.mudRoughness;
    stoneMat.roughnessMap = isLow ? null : textures.stoneRoughness;
    plasterMat.roughnessMap = isLow ? null : textures.plasterRoughness;
    woodMat.roughnessMap = isLow ? null : textures.woodRoughness;
    ironMat.roughnessMap = isLow ? null : textures.ironRoughness;
    brassMat.roughnessMap = isLow ? null : textures.brassRoughness;
    mudMat.needsUpdate = true;
    stoneMat.needsUpdate = true;
    plasterMat.needsUpdate = true;
    woodMat.needsUpdate = true;
    ironMat.needsUpdate = true;
    brassMat.needsUpdate = true;
  };

  const updateVisuals = (dt: number, elapsed: number, bucketProgress: number) => {
    // Flicker outdoor lanterns & Tulsi diya
    for (let i = 0; i < lanternLights.length; i++) {
      const fl = lanternLights[i];
      const f =
        0.86 + Math.sin(elapsed * 11.4 + fl.phase) * 0.1 + Math.sin(elapsed * 21.2 + fl.phase) * 0.06;
      fl.light.intensity = fl.base * f;
      if (fl.flame) fl.flame.scale.set(1, f, 1);
    }

    // Shimmer paw prints gently when revealed
    if (pawPrintGroup.visible) {
      for (let i = 0; i < pawPrintMats.length; i++) {
        pawPrintMats[i].opacity = 0.52 + Math.sin(elapsed * 3.4 - i * 0.45) * 0.34;
      }
    }

    // Animate scuttling black scorpions along narrow patrol lanes
    for (let i = 0; i < scorpions.length; i++) {
      const sc = scorpions[i];
      const wave = Math.sin(elapsed * sc.speed + sc.phase);
      const dir = Math.cos(elapsed * sc.speed + sc.phase) >= 0 ? 1 : -1;
      if (sc.axis === 'x') {
        sc.position.set(sc.origin.x + wave * sc.amplitude, 0, sc.origin.z);
        sc.group.rotation.y = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      } else {
        sc.position.set(sc.origin.x, 0, sc.origin.z + wave * sc.amplitude);
        sc.group.rotation.y = dir > 0 ? 0 : Math.PI;
      }
      sc.group.position.copy(sc.position);

      // Scuttling legs & twitching curled stinger
      for (let l = 0; l < sc.legsLeft.length; l++) {
        const legSwing = Math.sin(elapsed * 22 + l * 1.55 + sc.phase) * 0.28;
        sc.legsLeft[l].rotation.y = legSwing;
        sc.legsRight[l].rotation.y = -legSwing;
      }
      sc.tailGroup.rotation.x = Math.sin(elapsed * 5.2 + sc.phase) * 0.14;
    }

    // Gentle hover shimmer on active pickups
    if (biscuitGroup.visible) {
      biscuitGroup.position.y = biscuitPos.y + Math.sin(elapsed * 3.1) * 0.035;
      biscuitGroup.rotation.y = elapsed * 0.9;
    }
    if (pulleyPickupGroup.visible) {
      pulleyPickupGroup.position.y = pulleyPickupPos.y + Math.sin(elapsed * 2.8 + 1) * 0.038;
      pulleyPickupGroup.rotation.y = elapsed * 0.85;
    }
    if (haveliKeyGroup.visible) {
      haveliKeyGroup.position.y = haveliKeyPos.y + Math.sin(elapsed * 3.4) * 0.032;
      haveliKeyGroup.rotation.y = elapsed * 1.25;
    }

    // Smoothly animate well pulley rotation & rising water bucket
    if (wellInstalledPulley.visible) {
      const targetBucketY = 0.42 + bucketProgress * 0.96;
      const prevY = wellBucketGroup.position.y;
      wellBucketGroup.position.y = THREE.MathUtils.damp(prevY, targetBucketY, 4.5, dt);
      const deltaY = wellBucketGroup.position.y - prevY;
      if (Math.abs(deltaY) > 0.0002) {
        wellInstalledPulley.rotation.x += deltaY * 9.5;
      }
      const ropeLen = Math.max(0.45, 2.38 - wellBucketGroup.position.y);
      wellRopeMesh.scale.y = ropeLen / 1.85;
      wellRopeMesh.position.y = 2.4 - ropeLen * 0.5;
    }
  };

  root.visible = false;

  return {
    root,
    colliders,
    thorns,
    scorpions,
    dog,
    pawPrintGroup,
    pawPrintMats,
    pawTrailCoords,
    biscuitPos,
    biscuitGroup,
    biscuitAura,
    pulleyPickupPos,
    pulleyPickupGroup,
    pulleyPickupAura,
    wellPos,
    wellInstalledPulley,
    wellBucketGroup,
    wellBucketWater,
    wellRopeMesh,
    wellAura,
    tulsiPos,
    tulsiWaterGlow,
    tulsiAura,
    verandaRestPos,
    verandaAura,
    haveliKeyPos,
    haveliKeyGroup,
    haveliKeyAura,
    haveliGatePos,
    lanternLights,
    landmarks,
    resolvePlayerCollision,
    getZoneName,
    applyQualityMaterials,
    updateVisuals,
  };
}
