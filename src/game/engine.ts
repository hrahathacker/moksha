import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CHAPTER_CONFIGS,
  TOTAL_CHAPTERS,
  getChapterModule,
} from '../chapters/chapterRegistry';
import {
  ChapterCheckpoint,
  ChapterModule,
  ChapterRuntimeContext,
} from '../chapters/types';
import { HorrorAudioManager } from './audio';
import { ForestCourtyardWorld, buildForestCourtyardWorld } from './forestCourtyardMap';
import { GhostAIController } from './ghostAI';
import { HaveliWorld, StealthCoverCheck, buildHaveliWorld } from './haveliMap';
import {
  AlmirahRig,
  FlashlightRig,
  GhostRig,
  createFlashlightViewModel,
  createGhostModel,
} from './models';
import { OutdoorVillageWorld, buildOutdoorVillageWorld } from './outdoorVillageMap';
import { ProceduralTexturePack, createProceduralTextures } from './textures';
import {
  ActiveEnemyHudState,
  ChapterNumber,
  DIFFICULTY_CONFIGS,
  Difficulty,
  DifficultyConfig,
  EnemyCombatEntity,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  LoreNoteData,
  MinimapData,
  PlayerStance,
  RITUAL_ITEMS,
  RitualItemId,
  StealthReason,
  SubtitleState,
} from './types';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();
const _kundCenter = new THREE.Vector3(0, 0.72, 0);
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _dawnHemiColor = new THREE.Color(0xffe09c);
const _dawnMoonColor = new THREE.Color(0xffd478);
const _dawnBgColor = new THREE.Color(0x281a0c);
const _dawnFogColor = new THREE.Color(0x2c1d0d);
const MAX_CAMERA_PITCH = (75 * Math.PI) / 180; // Strict ±75° vertical pitch clamp

const COLD_TEAL_BG = 0x051115;
const COLD_TEAL_HEMI_SKY = 0x286472;
const COLD_TEAL_HEMI_GROUND = 0x171310;
const COLD_TEAL_MOON = 0x58a8ba;
const FOG_DENSITY_HIGH = 0.068;
const FOG_DENSITY_LOW = 0.082;

const DUST_HIGH_COUNT = 200;
const DUST_LOW_COUNT = 75;
const EMBER_HIGH_COUNT = 110;
const EMBER_LOW_COUNT = 44;
const PICKUP_BURST_COUNT = 28;

const EYE_HEIGHT_STANDING = 1.7;
const EYE_HEIGHT_CROUCH = 1.0;
const EYE_HEIGHT_PRONE = 0.45;
const BODY_HEIGHT_STANDING = 1.75;
const BODY_HEIGHT_CROUCH = 1.08;
const BODY_HEIGHT_PRONE = 0.52;
const JUMP_VELOCITY = 5.4;
const GRAVITY = 15.5;
const ATTACK_COOLDOWN_SEC = 6.0;
const ATTACK_STAMINA_COST = 20;
const ATTACK_RANGE_METERS = 2.5;
const ATTACK_ANIM_DURATION = 0.42;
const ATTACK_CONE_COS = Math.cos((65 * Math.PI) / 180);

export interface TouchInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
}

export class MokshaGameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private isMobile: boolean;
  private chapterConfigScratch: DifficultyConfig = { ...DIFFICULTY_CONFIGS.normal };

  private textures: ProceduralTexturePack;
  private world: HaveliWorld;
  private outdoorWorld: OutdoorVillageWorld;
  private forestWorld: ForestCourtyardWorld;
  private activeChapter: ChapterModule;
  private ghostRig: GhostRig;
  private ghostAI: GhostAIController;
  private flashlight: FlashlightRig;
  private trishulEquipped = false;
  public readonly audio: HorrorAudioManager;

  private moonLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private dustParticles: THREE.Points;
  private emberPoints: THREE.Points;
  private emberPositions: Float32Array;
  private emberVelocities: Float32Array;
  private emberLife: Float32Array;
  private emberMaxLife: Float32Array;
  private pickupBurstPoints: THREE.Points;
  private pickupBurstPositions: Float32Array;
  private pickupBurstVelocities: Float32Array;
  private pickupBurstLife = 0;
  private pickupBurstLight: THREE.PointLight;

  private phase: GamePhase = 'title';
  private difficulty: Difficulty = 'normal';
  private quality: GraphicsQuality = 'high';
  private currentChapter: ChapterNumber = 1;

  private playerHealth = 100;
  private damageFlash = 0;
  private hurtInvulnTimer = 0;
  private activeCheckpoint: ChapterCheckpoint = {
    id: 'start',
    label: 'Village Path Start',
    x: 0,
    z: 25.0,
    yaw: 0,
  };
  private checkpointBanner: string | null = null;
  private checkpointBannerTimer = 0;
  private injuredReason: string | null = null;
  private cameraOverrideActive = false;
  private cameraOverridePos = new THREE.Vector3();
  private cameraOverrideLook = new THREE.Vector3();

  private playerPos = new THREE.Vector3(0, EYE_HEIGHT_STANDING, 11.4);
  private playerYaw = 0;
  private playerPitch = 0;
  private stance: PlayerStance = 'standing';
  private playerFeetY = 0;
  private playerVelY = 0;
  private isGrounded = true;
  private currentEyeHeight = EYE_HEIGHT_STANDING;
  private landingDip = 0;
  private headroomBlockedTimer = 0;
  private coverScratch: StealthCoverCheck = { underFurniture: false, nearCover: false };
  private isConcealed = false;
  private stealthReason: StealthReason = 'none';
  private stealthFactor = 1.0;

  private combatEnemies: EnemyCombatEntity[] = [];
  private activeCombatEnemy: EnemyCombatEntity | null = null;
  private attackCooldown = 0;
  private attackAnimTime = 0;
  private attackAnimActive = false;
  private attackLandedHit = false;
  private attackHitFlash = 0;
  private attackRecoilPitch = 0;
  private attackRecoilRoll = 0;
  private lookLagYaw = 0;
  private lookLagPitch = 0;
  private interactImpulse = 0;

  private walkBobPhase = 0;
  private footstepCooldown = 0;
  private breathTimer = 1.6;

  private stamina = 100;
  private battery = 100;
  private flashlightOn = true;
  private bpm = 72;
  private maxBpm = 72;
  private heartbeatTimer = 0.8;

  private holdingItem: RitualItemId | null = null;
  private placedItems: RitualItemId[] = [];
  private hidingAlmirah: AlmirahRig | null = null;
  private activeNote: LoreNoteData | null = null;

  private elapsedSeconds = 0;
  private timeSinceProgress = 0;
  private hintActive = false;
  private climaxRemaining = 10;
  private jumpscareTimer = 0;
  private shantiProgress = 0;
  private jumpscaresSurvived = 0;
  private templeBellTimer = 19;
  private proximityIntensity = 0;
  private subtitle: SubtitleState | null = null;
  private pointerLocked = false;
  private disposed = false;

  private keys = new Set<string>();
  public touchInput: TouchInputState = { moveX: 0, moveY: 0, sprint: false };

  private frameId = 0;
  private lastTimestamp = 0;
  private hudThrottle = 0;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundBlur: () => void;
  private boundResize: () => void;
  private boundOrientationChange: () => void;
  private boundVisibilityChange: () => void;
  private boundPointerLockChange: () => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;

  constructor(
    container: HTMLElement,
    initialDifficulty: Difficulty,
    initialQuality: GraphicsQuality,
    onHudUpdate: (snapshot: HudSnapshot) => void
  ) {
    this.container = container;
    this.difficulty = initialDifficulty;
    this.quality = initialQuality;
    this.onHudUpdate = onHudUpdate;

    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    this.isMobile =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.isMobile && initialQuality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.type = this.isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    this.applyQualityPixelRatio();
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLD_TEAL_BG);
    this.scene.fog = new THREE.FogExp2(
      COLD_TEAL_BG,
      initialQuality === 'low' ? FOG_DENSITY_LOW : FOG_DENSITY_HIGH
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.22;
    pmrem.dispose();

    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.08, 48);
    this.scene.add(this.camera);

    // Create full procedural PBR texture pack before constructing flashlight & world meshes
    this.textures = createProceduralTextures(this.renderer, this.isMobile);

    this.flashlight = createFlashlightViewModel(this.textures);
    this.camera.add(this.flashlight.viewGroup);
    this.camera.add(this.flashlight.spotLight);
    this.camera.add(this.flashlight.spotLight.target);

    this.hemiLight = new THREE.HemisphereLight(COLD_TEAL_HEMI_SKY, COLD_TEAL_HEMI_GROUND, 0.62);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(COLD_TEAL_MOON, 1.38);
    this.moonLight.position.set(7, 16, -6);
    this.moonLight.shadow.mapSize.width = 1024;
    this.moonLight.shadow.mapSize.height = 1024;
    this.moonLight.shadow.camera.near = 1;
    this.moonLight.shadow.camera.far = 34;
    const d = 14;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    this.moonLight.shadow.normalBias = 0.02;
    this.scene.add(this.moonLight);

    this.applyShadowQuality();

    this.world = buildHaveliWorld(this.textures, initialQuality === 'low' || this.isMobile);
    this.world.applyQualityMaterials(initialQuality === 'low');
    this.scene.add(this.world.root);

    this.outdoorWorld = buildOutdoorVillageWorld(
      this.textures,
      initialQuality === 'low' || this.isMobile
    );
    this.outdoorWorld.applyQualityMaterials(initialQuality === 'low');
    this.outdoorWorld.root.visible = false;
    this.scene.add(this.outdoorWorld.root);

    this.forestWorld = buildForestCourtyardWorld(
      this.textures,
      initialQuality === 'low' || this.isMobile
    );
    this.forestWorld.applyQualityMaterials(initialQuality === 'low');
    this.forestWorld.root.visible = false;
    this.scene.add(this.forestWorld.root);

    this.activeChapter = getChapterModule(1);

    this.ghostRig = createGhostModel(this.textures);
    this.scene.add(this.ghostRig.root);

    this.audio = new HorrorAudioManager((sub) => {
      this.subtitle = sub;
      this.emitHud();
    });

    this.ghostAI = new GhostAIController(this.ghostRig, this.world, this.audio);
    this.combatEnemies = [this.ghostAI];

    this.dustParticles = this.createDustMotes(DUST_HIGH_COUNT);
    this.dustParticles.geometry.setDrawRange(
      0,
      initialQuality === 'low' ? DUST_LOW_COUNT : DUST_HIGH_COUNT
    );
    this.scene.add(this.dustParticles);

    // Pooled warm rising embers from Havan Kund & Diyas (zero per-frame allocations)
    this.emberPositions = new Float32Array(EMBER_HIGH_COUNT * 3);
    this.emberVelocities = new Float32Array(EMBER_HIGH_COUNT * 3);
    this.emberLife = new Float32Array(EMBER_HIGH_COUNT);
    this.emberMaxLife = new Float32Array(EMBER_HIGH_COUNT);
    this.emberPoints = this.createEmberPool();
    this.emberPoints.geometry.setDrawRange(
      0,
      initialQuality === 'low' ? EMBER_LOW_COUNT : EMBER_HIGH_COUNT
    );
    this.scene.add(this.emberPoints);

    // Pooled radiant glow burst for item pickups, lighting diyas, ringing bells & shattering seals
    this.pickupBurstPositions = new Float32Array(PICKUP_BURST_COUNT * 3);
    this.pickupBurstVelocities = new Float32Array(PICKUP_BURST_COUNT * 3);
    this.pickupBurstPoints = this.createPickupBurstPool();
    this.pickupBurstPoints.visible = false;
    this.scene.add(this.pickupBurstPoints);

    this.pickupBurstLight = new THREE.PointLight(0xffd268, 0, 5.2, 2);
    this.pickupBurstLight.castShadow = false;
    this.scene.add(this.pickupBurstLight);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundBlur = this.onWindowBlur.bind(this);
    this.boundResize = this.onResize.bind(this);
    this.boundOrientationChange = () => {
      window.setTimeout(() => this.onResize(), 120);
      window.setTimeout(() => this.onResize(), 320);
    };
    this.boundVisibilityChange = () => {
      if (document.hidden && (this.phase === 'playing' || this.phase === 'climax')) {
        this.pauseGame();
      }
    };
    this.boundPointerLockChange = this.onPointerLockChange.bind(this);
    this.boundContextLost = (e: Event) => e.preventDefault();
    this.boundContextRestored = () => this.applyQualityPixelRatio();

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('blur', this.boundBlur);
    window.addEventListener('resize', this.boundResize);
    window.addEventListener('orientationchange', this.boundOrientationChange);
    window.visualViewport?.addEventListener('resize', this.boundResize);
    document.addEventListener('visibilitychange', this.boundVisibilityChange);
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    canvas.addEventListener('webglcontextlost', this.boundContextLost);
    canvas.addEventListener('webglcontextrestored', this.boundContextRestored);

    this.lastTimestamp = performance.now();
    this.emitHud();
    this.scheduleNextFrame();
  }

  private createDustMotes(count: number): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = 0.35 + Math.random() * 4.7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xa4d2dc,
      map: this.textures.softParticle,
      size: 0.068,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  private respawnEmber(index: number, climaxBoost = false): void {
    const emitters = this.world.emberEmitters;
    let emitterPos = _kundCenter;
    if (emitters.length > 0) {
      // Bias 55% of embers toward the central Havan Kund fire, 45% across ambient & lit shrine diyas
      if (climaxBoost || Math.random() < 0.55) {
        emitterPos = emitters[0];
      } else {
        const pick = 1 + Math.floor(Math.random() * Math.max(1, emitters.length - 1));
        emitterPos = emitters[Math.min(pick, emitters.length - 1)];
      }
      // Also mix in lit Chapter 3 shrine diyas when active
      if (!climaxBoost && this.currentChapter === 3 && Math.random() < 0.25) {
        const litDiyas = this.world.shrineDiyas;
        for (let k = 0; k < litDiyas.length; k++) {
          const candidate = litDiyas[(index + k) % litDiyas.length];
          if (candidate.lit) {
            emitterPos = candidate.position;
            break;
          }
        }
      }
    }

    const isKund = emitterPos === emitters[0];
    const spread = isKund ? (climaxBoost ? 0.62 : 0.42) : 0.08;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;

    const i3 = index * 3;
    this.emberPositions[i3] = emitterPos.x + Math.cos(angle) * r;
    this.emberPositions[i3 + 1] = emitterPos.y + (isKund ? 0.04 : 0.14) + Math.random() * 0.1;
    this.emberPositions[i3 + 2] = emitterPos.z + Math.sin(angle) * r;

    this.emberVelocities[i3] = (Math.random() - 0.5) * (climaxBoost ? 0.42 : 0.18);
    this.emberVelocities[i3 + 1] = (isKund ? 0.55 : 0.28) + Math.random() * (climaxBoost ? 0.95 : 0.45);
    this.emberVelocities[i3 + 2] = (Math.random() - 0.5) * (climaxBoost ? 0.42 : 0.18);

    const maxL = (isKund ? 1.5 : 1.05) + Math.random() * 1.4;
    this.emberMaxLife[index] = maxL;
    this.emberLife[index] = maxL;
  }

  private createEmberPool(): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const colors = new Float32Array(EMBER_HIGH_COUNT * 3);
    for (let i = 0; i < EMBER_HIGH_COUNT; i++) {
      this.respawnEmber(i, false);
      // Stagger initial lifetimes so embers are already rising smoothly on frame 1
      this.emberLife[i] = Math.random() * this.emberMaxLife[i];
      const warmMix = Math.random();
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.42 + warmMix * 0.44;
      colors[i * 3 + 2] = 0.1 + warmMix * 0.28;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.emberPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.075,
      map: this.textures.softParticle,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  private createPickupBurstPool(): THREE.Points {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pickupBurstPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd268,
      map: this.textures.softParticle,
      size: 0.14,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  private spawnPickupBurst(origin: THREE.Vector3, colorHex: number): void {
    const mat = this.pickupBurstPoints.material as THREE.PointsMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = 0.95;
    this.pickupBurstLight.color.setHex(colorHex);
    this.pickupBurstLight.position.set(origin.x, origin.y + 0.32, origin.z);
    this.pickupBurstLight.intensity = 4.6;
    this.pickupBurstLife = 0.72;
    this.pickupBurstPoints.visible = true;

    for (let i = 0; i < PICKUP_BURST_COUNT; i++) {
      const i3 = i * 3;
      const theta = (i / PICKUP_BURST_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const spd = 0.55 + Math.random() * 1.45;
      this.pickupBurstPositions[i3] = origin.x + (Math.random() - 0.5) * 0.16;
      this.pickupBurstPositions[i3 + 1] = origin.y + 0.15 + Math.random() * 0.16;
      this.pickupBurstPositions[i3 + 2] = origin.z + (Math.random() - 0.5) * 0.16;
      this.pickupBurstVelocities[i3] = Math.cos(theta) * spd;
      this.pickupBurstVelocities[i3 + 1] = 0.75 + Math.random() * 1.35;
      this.pickupBurstVelocities[i3 + 2] = Math.sin(theta) * spd;
    }
    (this.pickupBurstPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private triggerInteractImpulse(strength = 0.9): void {
    this.interactImpulse = Math.min(1.2, Math.max(this.interactImpulse, strength));
  }

  private applyQualityPixelRatio(): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      return;
    }
    if (this.isMobile) {
      // Strictly cap Android WebView DPR to 1.0 (0.75 on Low mode) for locked 60 FPS
      this.renderer.setPixelRatio(this.quality === 'low' ? 0.75 : 1.0);
    } else {
      const cap = this.quality === 'low' ? 1.15 : 2.0;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    }
  }

  private applyShadowQuality(): void {
    const canShadow = !this.isSoftwareGl && this.quality === 'high';
    if (this.isMobile) {
      // On mobile: zero shadows on Low; single 512x512 BasicShadowMap on flashlight only in High
      this.renderer.shadowMap.enabled = canShadow;
      this.moonLight.castShadow = false;
      this.flashlight.spotLight.castShadow = canShadow;
    } else {
      this.renderer.shadowMap.enabled = canShadow;
      this.moonLight.castShadow = canShadow;
      this.flashlight.spotLight.castShadow = false;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    const isLow = quality === 'low';
    this.applyQualityPixelRatio();
    this.applyShadowQuality();
    this.world.applyQualityMaterials(isLow);
    this.outdoorWorld.applyQualityMaterials(isLow);
    this.forestWorld.applyQualityMaterials(isLow);
    this.dustParticles.visible = true;
    this.dustParticles.geometry.setDrawRange(0, isLow ? DUST_LOW_COUNT : DUST_HIGH_COUNT);
    this.emberPoints.geometry.setDrawRange(0, isLow ? EMBER_LOW_COUNT : EMBER_HIGH_COUNT);
    if (this.scene.fog instanceof THREE.FogExp2) {
      if (this.isForestActive()) {
        this.scene.fog.density = isLow ? 0.046 : 0.038;
      } else if (this.isVillageOutdoor()) {
        this.scene.fog.density = isLow ? 0.044 : 0.036;
      } else {
        this.scene.fog.density = isLow ? FOG_DENSITY_LOW : FOG_DENSITY_HIGH;
      }
    }
  }

  public setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
  }

  public requestPointerLock(): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    try {
      const canvas = this.renderer.domElement;
      if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
        const res = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // ignore if sandbox/mobile blocks pointer lock
    }
  }

  public releasePointerLock(): void {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // ignore
    }
  }

  private getChapterScaledConfig(): DifficultyConfig {
    const base = DIFFICULTY_CONFIGS[this.difficulty];
    const mult = CHAPTER_CONFIGS[this.currentChapter].ghostSpeedMult;
    const out = this.chapterConfigScratch;
    out.label = base.label;
    out.summary = base.summary;
    out.patrolSpeed = base.patrolSpeed * mult;
    out.investigateSpeed = base.investigateSpeed * mult;
    out.chaseSpeed = base.chaseSpeed * mult;
    out.climaxSpeed = base.climaxSpeed * mult;
    out.visionRangeDark = base.visionRangeDark;
    out.visionRangeLit = base.visionRangeLit;
    out.hearingRange = base.hearingRange;
    out.batteryDrainPerSec = base.batteryDrainPerSec;
    out.climaxDuration = base.climaxDuration;
    out.hintDelay = base.hintDelay;
    out.spawnGracePeriod = base.spawnGracePeriod;
    out.playerWalkSpeed = base.playerWalkSpeed;
    out.playerSprintSpeed = base.playerSprintSpeed;
    out.staminaDrainPerSec = base.staminaDrainPerSec;
    out.staminaRegenPerSec = base.staminaRegenPerSec;
    return out;
  }

  private isVillageOutdoor(): boolean {
    return (
      this.phase !== 'title' &&
      this.phase !== 'story' &&
      this.activeChapter.config.environment === 'outdoor'
    );
  }

  private isForestActive(): boolean {
    return (
      this.phase !== 'title' &&
      this.phase !== 'story' &&
      this.activeChapter.config.environment === 'forest'
    );
  }

  private isOutdoorActive(): boolean {
    return this.isVillageOutdoor() || this.isForestActive();
  }

  private syncEnvironmentVisibility(): void {
    const isVillage = this.isVillageOutdoor();
    const isForest = this.isForestActive();
    const isOutdoor = isVillage || isForest;

    this.world.root.visible = !isOutdoor;
    this.outdoorWorld.root.visible = isVillage;
    this.forestWorld.root.visible = isForest;
    this.ghostRig.root.visible = !isOutdoor;
    this.emberPoints.visible = !isOutdoor;

    const targetFar = isForest ? 92 : isVillage ? 84 : 48;
    if (this.camera.far !== targetFar) {
      this.camera.far = targetFar;
      this.camera.updateProjectionMatrix();
    }

    const isLow = this.quality === 'low';
    this.hemiLight.color.setHex(COLD_TEAL_HEMI_SKY);
    this.hemiLight.groundColor.setHex(COLD_TEAL_HEMI_GROUND);
    this.hemiLight.intensity = isForest ? 0.68 : isVillage ? 0.78 : 0.62;
    this.moonLight.color.setHex(COLD_TEAL_MOON);
    this.moonLight.intensity = isForest ? 1.44 : isVillage ? 1.56 : 1.38;
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(COLD_TEAL_BG);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(COLD_TEAL_BG);
      this.scene.fog.density = isForest
        ? isLow
          ? 0.046
          : 0.038
        : isVillage
          ? isLow
            ? 0.044
            : 0.036
          : isLow
            ? FOG_DENSITY_LOW
            : FOG_DENSITY_HIGH;
    }
  }

  private createChapterContext(): ChapterRuntimeContext {
    const self = this;
    return {
      world: this.world,
      outdoorWorld: this.outdoorWorld,
      forestWorld: this.forestWorld,
      ghostAI: this.ghostAI,
      audio: this.audio,
      playerPos: this.playerPos,
      get playerYaw() {
        return self.playerYaw;
      },
      get playerPitch() {
        return self.playerPitch;
      },
      get playerFeetY() {
        return self.playerFeetY;
      },
      get stance() {
        return self.stance;
      },
      get stealthFactor() {
        return self.stealthFactor;
      },
      get flashlightOn() {
        return self.flashlightOn;
      },
      get trishulEquipped() {
        return self.trishulEquipped;
      },
      get difficulty() {
        return self.difficulty;
      },
      get elapsedSeconds() {
        return self.elapsedSeconds;
      },
      get timeSinceProgress() {
        return self.timeSinceProgress;
      },
      get hintActive() {
        return self.hintActive;
      },
      get holdingItem() {
        return self.holdingItem;
      },
      get placedItems() {
        return self.placedItems;
      },
      resetProgressTimer: () => {
        self.timeSinceProgress = 0;
        self.hintActive = false;
      },
      setHoldingItem: (id) => {
        self.holdingItem = id;
      },
      addPlacedItem: (id) => {
        self.placedItems.push(id);
      },
      setTrishulEquipped: (equipped) => {
        self.trishulEquipped = equipped;
        self.flashlight.setWeaponMode(equipped ? 'trishul' : 'flashlight');
      },
      registerCombatEnemy: (enemy) => {
        self.registerCombatEnemy(enemy);
      },
      unregisterCombatEnemy: (enemyId) => {
        self.unregisterCombatEnemy(enemyId);
      },
      setActiveCombatEnemy: (enemy) => {
        self.activeCombatEnemy = enemy;
      },
      setProximityIntensity: (intensity) => {
        self.proximityIntensity = Math.max(0, Math.min(1, intensity));
      },
      completeChapter: () => {
        self.completeNonFinalChapter();
      },
      startClimax: () => {
        self.phase = 'climax';
        self.climaxRemaining = DIFFICULTY_CONFIGS[self.difficulty].climaxDuration;
        self.audio.playPlayerReaction('climax');
      },
      openNote: (note) => {
        self.activeNote = note;
        self.phase = 'note';
        self.keys.clear();
        self.releasePointerLock();
      },
      spawnBurst: (origin, colorHex) => {
        self.spawnPickupBurst(origin, colorHex);
      },
      triggerInteractImpulse: (strength) => {
        self.triggerInteractImpulse(strength);
      },
      triggerCameraJolt: (pitch, roll) => {
        self.attackRecoilPitch = pitch;
        self.attackRecoilRoll = roll;
      },
      setCheckpoint: (cp, showBanner = true) => {
        self.activeCheckpoint = { ...cp };
        if (showBanner) {
          self.checkpointBanner = `Checkpoint Saved · ${cp.label}`;
          self.checkpointBannerTimer = 3.2;
        }
      },
      damagePlayer: (amount, reason, kind, pushX, pushZ) => {
        self.applyPlayerInjury(amount, reason, kind, pushX, pushZ);
      },
      healPlayerFull: () => {
        self.playerHealth = 100;
        self.stamina = 100;
        self.damageFlash = 0;
      },
      forceStance: (next) => {
        self.stance = next;
        self.touchInput.sprint = false;
      },
      setPlayerPose: (x, z, yaw, pitch) => {
        self.playerPos.x = x;
        self.playerPos.z = z;
        if (typeof yaw === 'number') self.playerYaw = yaw;
        if (typeof pitch === 'number') self.playerPitch = pitch;
      },
      setCameraOverride: (pos, lookAt) => {
        self.cameraOverrideActive = true;
        self.cameraOverridePos.copy(pos);
        self.cameraOverrideLook.copy(lookAt);
      },
      clearCameraOverride: () => {
        self.cameraOverrideActive = false;
      },
      emitHud: () => {
        self.emitHud();
      },
    };
  }

  private chapterCtxCache: ChapterRuntimeContext | null = null;
  private getChapterContext(): ChapterRuntimeContext {
    if (!this.chapterCtxCache) {
      this.chapterCtxCache = this.createChapterContext();
    }
    return this.chapterCtxCache;
  }

  private applyPlayerInjury(
    amount: number,
    reason: string,
    kind: 'thorn' | 'scorpion' | 'crawler' | 'boss',
    pushX?: number,
    pushZ?: number
  ): void {
    if (this.hurtInvulnTimer > 0 || this.phase !== 'playing') return;
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.damageFlash = 1.0;
    this.attackRecoilPitch = kind === 'boss' ? 0.22 : 0.14;
    this.attackRecoilRoll = kind === 'scorpion' || kind === 'boss' ? 0.18 : -0.11;

    if (kind === 'thorn') {
      this.audio.playPainThorn();
    } else if (kind === 'scorpion') {
      this.audio.playScorpionSting();
    } else if (kind === 'crawler') {
      this.audio.playCrawlerScreech(true);
    } else {
      this.audio.playBossSlam();
    }

    if (typeof pushX === 'number' && typeof pushZ === 'number') {
      this.playerPos.x += pushX;
      this.playerPos.z += pushZ;
      if (this.isForestActive()) {
        this.forestWorld.resolvePlayerCollision(this.playerPos, 0.36);
      } else if (this.isVillageOutdoor()) {
        this.outdoorWorld.resolvePlayerCollision(this.playerPos, 0.36);
      }
    }

    if (this.playerHealth <= 0) {
      this.phase = 'injured';
      this.injuredReason = reason;
      this.keys.clear();
      this.touchInput.moveX = 0;
      this.touchInput.moveY = 0;
      this.touchInput.sprint = false;
      this.releasePointerLock();
      this.audio.setTension(0, false);
    } else {
      this.hurtInvulnTimer = kind === 'boss' ? 1.25 : 1.15;
    }
    this.emitHud();
  }

  public reviveAtCheckpoint(): void {
    if (this.phase !== 'injured') return;
    this.audio.unlock();
    this.playerHealth = 100;
    this.stamina = 100;
    this.damageFlash = 0;
    this.hurtInvulnTimer = 1.8;
    this.injuredReason = null;
    this.cameraOverrideActive = false;
    this.stance = 'standing';
    this.playerFeetY = 0;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.currentEyeHeight = EYE_HEIGHT_STANDING;
    this.playerPos.set(this.activeCheckpoint.x, EYE_HEIGHT_STANDING, this.activeCheckpoint.z);
    this.playerYaw = this.activeCheckpoint.yaw;
    this.playerPitch = 0;
    this.keys.clear();
    this.touchInput.moveX = 0;
    this.touchInput.moveY = 0;
    this.touchInput.sprint = false;
    this.phase = 'playing';
    this.activeChapter.onCheckpointRevive?.(this.getChapterContext(), this.activeCheckpoint.id);
    this.audio.playTempleBell(0.45);
    this.emitHud();
    this.requestPointerLock();
  }

  private completeNonFinalChapter(): void {
    this.phase = 'chapter_complete';
    this.hidingAlmirah = null;
    this.activeNote = null;
    this.cameraOverrideActive = false;
    this.keys.clear();
    this.releasePointerLock();
    this.audio.setTension(0, false);
    this.audio.playShantiChord();
    this.emitHud();
  }

  private resetRunState(difficulty: Difficulty, chapter: ChapterNumber): void {
    this.difficulty = difficulty;
    this.currentChapter = chapter;
    this.activeChapter = getChapterModule(chapter);
    this.ghostAI.reset();

    this.playerHealth = 100;
    this.damageFlash = 0;
    this.hurtInvulnTimer = 0;
    this.checkpointBanner = null;
    this.checkpointBannerTimer = 0;
    this.injuredReason = null;
    this.cameraOverrideActive = false;

    const sp = this.activeChapter.getSpawn();
    const env = this.activeChapter.config.environment;
    this.activeCheckpoint = {
      id: 'start',
      label:
        env === 'outdoor'
          ? 'Village Path Start'
          : env === 'forest'
            ? 'Village Outer Iron Gate'
            : 'Haveli Courtyard',
      x: sp.x,
      z: sp.z,
      yaw: sp.yaw,
    };

    this.playerPos.set(sp.x, EYE_HEIGHT_STANDING, sp.z);
    this.playerYaw = sp.yaw;
    this.playerPitch = 0;
    this.stance = 'standing';
    this.playerFeetY = 0;
    this.playerVelY = 0;
    this.isGrounded = true;
    this.currentEyeHeight = EYE_HEIGHT_STANDING;
    this.landingDip = 0;
    this.headroomBlockedTimer = 0;
    this.isConcealed = false;
    this.stealthReason = 'none';
    this.stealthFactor = 1.0;
    this.trishulEquipped = false;
    this.flashlight.setWeaponMode('flashlight');
    this.combatEnemies = [this.ghostAI];
    this.activeCombatEnemy = null;
    this.attackCooldown = 0;
    this.attackAnimTime = 0;
    this.attackAnimActive = false;
    this.attackLandedHit = false;
    this.attackHitFlash = 0;
    this.attackRecoilPitch = 0;
    this.attackRecoilRoll = 0;
    this.lookLagYaw = 0;
    this.lookLagPitch = 0;
    this.interactImpulse = 0;
    this.pickupBurstLife = 0;
    this.pickupBurstPoints.visible = false;
    this.pickupBurstLight.intensity = 0;
    this.flashlight.sparkGroup.visible = false;
    this.flashlight.sparkLight.intensity = 0;
    this.stamina = 100;
    this.battery = 100;
    this.flashlightOn = true;
    this.bpm = 72;
    this.maxBpm = 72;
    this.breathTimer = 2.0;
    this.holdingItem = null;
    this.placedItems = [];
    this.hidingAlmirah = null;
    this.activeNote = null;
    this.elapsedSeconds = 0;
    this.timeSinceProgress = 0;
    this.hintActive = false;
    this.climaxRemaining = DIFFICULTY_CONFIGS[difficulty].climaxDuration;
    this.jumpscareTimer = 0;
    this.shantiProgress = 0;
    this.jumpscaresSurvived = 0;
    this.proximityIntensity = 0;
    this.subtitle = null;
    this.keys.clear();
    this.touchInput.moveX = 0;
    this.touchInput.moveY = 0;
    this.touchInput.sprint = false;

    this.world.almirahs.forEach((a) => {
      a.doorOpenAmount = 0;
      a.doorSwingBoost = 0;
      a.leftDoorPivot.rotation.y = 0;
      a.rightDoorPivot.rotation.y = 0;
    });

    this.activeChapter.reset(this.getChapterContext());
  }

  /**
   * Begins chapter start flow: Title -> Unhurried Mission Briefing -> Playing
   */
  public startNewGame(
    difficulty: Difficulty,
    skipStoryAndBriefing = false,
    chapter: ChapterNumber = 1
  ): void {
    this.audio.unlock();
    this.audio.stopVictorySong();
    this.audio.stopStoryNarration();
    this.audio.prewarmGhostVoices();
    this.resetRunState(difficulty, chapter);

    this.phase = skipStoryAndBriefing ? 'playing' : 'briefing';
    this.syncEnvironmentVisibility();
    this.audio.playTempleBell(0.6);
    this.emitHud();
  }

  public startChapterDirect(
    difficulty: Difficulty,
    chapter: ChapterNumber,
    showBriefing = true
  ): void {
    this.audio.unlock();
    this.audio.stopVictorySong();
    this.audio.stopStoryNarration();
    this.audio.prewarmGhostVoices();
    this.resetRunState(difficulty, chapter);

    this.phase = showBriefing ? 'briefing' : 'playing';
    this.syncEnvironmentVisibility();
    this.audio.playTempleBell(0.62);
    this.emitHud();
    if (!showBriefing) {
      this.requestPointerLock();
    }
  }

  public advanceStoryToBriefing(): void {
    if (this.phase !== 'story') return;
    this.audio.stopStoryNarration();
    this.phase = 'briefing';
    this.syncEnvironmentVisibility();
    this.emitHud();
  }

  public enterHaveliFromBriefing(): void {
    if (this.phase !== 'briefing') return;
    this.audio.unlock();
    this.audio.stopStoryNarration();
    this.phase = 'playing';
    this.syncEnvironmentVisibility();
    this.audio.playTempleBell(0.7);
    this.emitHud();
    this.requestPointerLock();
  }

  public pauseGame(): void {
    if (this.phase === 'playing' || this.phase === 'climax') {
      this.phase = 'paused';
      this.keys.clear();
      this.releasePointerLock();
      this.emitHud();
    }
  }

  public resumeGame(): void {
    if (this.phase === 'paused' || this.phase === 'note') {
      this.activeNote = null;
      this.phase = this.placedItems.length >= 4 && this.climaxRemaining > 0 ? 'climax' : 'playing';
      this.emitHud();
      this.requestPointerLock();
    }
  }

  public skipVictoryCutscene(): void {
    if (this.phase !== 'victory') return;
    this.shantiProgress = 1;
    this.emitHud();
  }

  public returnToTitle(): void {
    this.audio.stopStoryNarration();
    this.audio.stopVictorySong();
    this.phase = 'title';
    this.activeNote = null;
    this.hidingAlmirah = null;
    this.cameraOverrideActive = false;
    this.keys.clear();
    this.releasePointerLock();
    this.syncEnvironmentVisibility();
    this.audio.setTension(0, false);
    this.emitHud();
  }

  public toggleFlashlight(): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    this.audio.unlock();
    if (this.battery <= 0.5 && !this.flashlightOn) return;
    this.flashlightOn = !this.flashlightOn;
    this.triggerInteractImpulse(0.32);
    this.audio.playFlashlightClick();
    this.emitHud();
  }

  private getTargetBodyHeight(stance: PlayerStance): number {
    if (stance === 'prone') return BODY_HEIGHT_PRONE;
    if (stance === 'crouching') return BODY_HEIGHT_CROUCH;
    return BODY_HEIGHT_STANDING;
  }

  private getTargetEyeHeight(stance: PlayerStance): number {
    if (stance === 'prone') return EYE_HEIGHT_PRONE;
    if (stance === 'crouching') return EYE_HEIGHT_CROUCH;
    return EYE_HEIGHT_STANDING;
  }

  public setStance(next: PlayerStance): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    if (this.hidingAlmirah) return;
    if (next === this.stance) return;
    this.audio.unlock();

    const targetBodyH = this.getTargetBodyHeight(next);
    const currentBodyH = this.getTargetBodyHeight(this.stance);
    // Block rising if physically underneath a table or wooden charpai (indoor Haveli)
    if (
      !this.isOutdoorActive() &&
      targetBodyH > currentBodyH &&
      !this.world.hasHeadroomAt(this.playerPos.x, this.playerPos.z, 0.34, targetBodyH)
    ) {
      this.headroomBlockedTimer = 1.6;
      this.audio.playFlashlightClick();
      this.emitHud();
      return;
    }

    this.stance = next;
    if (next !== 'standing') {
      this.touchInput.sprint = false;
    }
    this.audio.playStanceShift(next === 'prone');
    this.emitHud();
  }

  public toggleCrouch(): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    if (this.hidingAlmirah) return;
    this.setStance(this.stance === 'crouching' ? 'standing' : 'crouching');
  }

  public toggleProne(): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    if (this.hidingAlmirah) return;
    this.setStance(this.stance === 'prone' ? 'standing' : 'prone');
  }

  public triggerJump(): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    if (this.hidingAlmirah) return;
    this.audio.unlock();

    // Pressing Jump while Crouched or Prone smoothly stands the player back up
    if (this.stance !== 'standing') {
      this.setStance('standing');
      return;
    }

    if (!this.isGrounded) return;
    this.playerVelY = JUMP_VELOCITY;
    this.isGrounded = false;
    this.audio.playJumpTakeoff();
  }

  /** Register a future chapter boss, shadow guardian, or rakshasa into the combat hit-check pipeline */
  public registerCombatEnemy(enemy: EnemyCombatEntity): void {
    if (!this.combatEnemies.some((e) => e.id === enemy.id)) {
      this.combatEnemies.push(enemy);
    }
  }

  public unregisterCombatEnemy(enemyId: string): void {
    this.combatEnemies = this.combatEnemies.filter((e) => e.id !== enemyId);
    if (this.activeCombatEnemy?.id === enemyId) {
      this.activeCombatEnemy = null;
    }
  }

  /**
   * Modular first-person Vintage Torch Bash combat strike:
   * 6s cooldown, 20 stamina cost, 2.5m forward cone check, golden holy spark VFX,
   * staggers & pushes back the Ghost for 2.0s or damages mortal bosses/rakshasas.
   */
  public triggerPlayerAttack(): boolean {
    if (this.phase !== 'playing' && this.phase !== 'climax') return false;
    if (this.hidingAlmirah) return false;
    const ctx = this.getChapterContext();
    if (this.activeChapter.canPlayerAttack && !this.activeChapter.canPlayerAttack(ctx)) {
      return false;
    }

    const isTrishul = this.trishulEquipped;
    const staminaCost = isTrishul ? 12 : ATTACK_STAMINA_COST;
    const cooldownSec = isTrishul ? 0.95 : ATTACK_COOLDOWN_SEC;
    const rangeMeters = isTrishul ? 3.25 : ATTACK_RANGE_METERS;
    const baseDamage = isTrishul ? 35 : 25;

    if (this.attackCooldown > 0 || this.stamina < staminaCost) return false;

    this.audio.unlock();
    this.stamina = Math.max(0, this.stamina - staminaCost);
    this.attackCooldown = cooldownSec;
    this.attackAnimActive = true;
    this.attackAnimTime = 0;
    this.attackLandedHit = false;
    this.attackRecoilPitch = isTrishul ? 0.08 : 0.065;
    this.attackRecoilRoll = isTrishul ? -0.075 : -0.055;
    if (isTrishul) {
      this.audio.playTrishulSwing();
    } else {
      this.audio.playTorchBashSwing();
    }

    // Forward horizontal cone melee hit-check against all registered EnemyCombatEntity targets
    _fwd.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw)).normalize();
    let hitAny = this.activeChapter.onPlayerMeleeSwing?.(ctx, _fwd) ?? false;

    for (let i = 0; i < this.combatEnemies.length; i++) {
      const enemy = this.combatEnemies[i];
      if (this.isOutdoorActive() && enemy === this.ghostAI) continue;
      if (enemy.isDefeated) continue;
      _toEnemy.set(enemy.position.x - this.playerPos.x, 0, enemy.position.z - this.playerPos.z);
      const dist = _toEnemy.length();
      if (dist > rangeMeters) continue;

      const dot = dist > 0.001 ? (_toEnemy.x * _fwd.x + _toEnemy.z * _fwd.z) / dist : 1;
      if (dot < ATTACK_CONE_COS && dist > 1.25) continue;

      // Require clear line of sight in indoor Haveli so attacks don't strike through solid walls
      if (
        !this.isOutdoorActive() &&
        !this.world.hasLineOfSight(this.playerPos, _toEnemy.set(enemy.position.x, 0, enemy.position.z))
      ) {
        continue;
      }

      const kbX = dist > 0.01 ? (enemy.position.x - this.playerPos.x) / dist : _fwd.x;
      const kbZ = dist > 0.01 ? (enemy.position.z - this.playerPos.z) / dist : _fwd.z;
      const hit = enemy.takeDamage(baseDamage, { x: kbX, z: kbZ });
      if (hit) {
        hitAny = true;
        if (enemy.isBossOrMortal) {
          this.activeCombatEnemy = enemy;
          if (enemy.hp <= 0) {
            enemy.onDefeat();
          }
        }
      }
    }

    if (hitAny) {
      this.attackLandedHit = true;
      this.attackHitFlash = 1.0;
      this.attackRecoilPitch = 0.11;
      this.attackRecoilRoll = -0.09;
      this.audio.playHolyWardImpact();
    }

    this.emitHud();
    return true;
  }

  public applyLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing' && this.phase !== 'climax') return;
    const sens = 0.0024;
    const dYaw = -dx * sens;
    const dPitch = -dy * sens;
    this.playerYaw += dYaw;
    this.playerPitch = Math.max(
      -MAX_CAMERA_PITCH,
      Math.min(MAX_CAMERA_PITCH, this.playerPitch + dPitch)
    );

    // Feed smooth FPS camera-turn inertia lag for the held vintage flashlight
    this.lookLagYaw = Math.max(-0.14, Math.min(0.14, this.lookLagYaw + dYaw * 0.42));
    this.lookLagPitch = Math.max(-0.12, Math.min(0.12, this.lookLagPitch + dPitch * 0.36));

    if (this.hidingAlmirah) {
      const centerYaw = this.hidingAlmirah.facingYaw + Math.PI;
      let diff = this.playerYaw - centerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      diff = Math.max(-0.52, Math.min(0.52, diff));
      this.playerYaw = centerYaw + diff;
    }
  }

  public triggerInteract(): void {
    this.audio.unlock();
    if (this.phase === 'note') {
      this.resumeGame();
      return;
    }
    if (this.phase !== 'playing' && this.phase !== 'climax') return;

    // 1. Exit almirah
    if (this.hidingAlmirah) {
      const exitedAlm = this.hidingAlmirah;
      exitedAlm.doorSwingBoost = 0.72;
      this.stance = 'standing';
      this.playerFeetY = 0;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.currentEyeHeight = EYE_HEIGHT_STANDING;
      this.playerPos.set(exitedAlm.exitPos.x, EYE_HEIGHT_STANDING, exitedAlm.exitPos.z);
      this.hidingAlmirah = null;
      this.triggerInteractImpulse(0.9);
      this.audio.playWoodCreak();
      this.ghostAI.notifyNoise(this.playerPos, 7.5);
      this.emitHud();
      return;
    }

    // 2. CHAPTER-SPECIFIC INTERACTIONS (Modular via activeChapter)
    const ctx = this.getChapterContext();
    if (this.activeChapter.interact(ctx)) {
      return;
    }

    // Outdoor chapters handle all interactions via their modular chapter module
    if (this.isOutdoorActive()) {
      return;
    }

    // 3. Open or Close Creaking Hinged Haveli Wing Doors
    for (const door of this.world.hingedDoors) {
      const d = Math.hypot(
        this.playerPos.x - door.interactPos.x,
        this.playerPos.z - door.interactPos.z
      );
      if (d < 2.55) {
        door.isOpen = !door.isOpen;
        this.triggerInteractImpulse(0.9);
        this.audio.playWoodCreak();
        this.ghostAI.notifyNoise(door.interactPos, 8.5, this.stealthFactor);
        this.emitHud();
        return;
      }
    }

    // 4. Climb into nearby wooden Almirah
    for (const alm of this.world.almirahs) {
      const d = Math.hypot(this.playerPos.x - alm.exitPos.x, this.playerPos.z - alm.exitPos.z);
      if (d < 1.95) {
        this.hidingAlmirah = alm;
        alm.doorSwingBoost = 0.72;
        this.stance = 'standing';
        this.playerFeetY = 0;
        this.playerVelY = 0;
        this.isGrounded = true;
        this.touchInput.sprint = false;
        this.playerPos.set(alm.insidePos.x, 1.56, alm.insidePos.z);
        this.playerYaw = alm.facingYaw + Math.PI;
        this.playerPitch = 0;
        this.triggerInteractImpulse(0.85);
        this.audio.playWoodCreak();
        if (this.proximityIntensity > 0.35) {
          this.audio.playPlayerReaction('hide');
        }
        this.ghostAI.notifyPlayerEnteredAlmirah(this.playerPos);
        this.emitHud();
        return;
      }
    }

    // 5. Read nearby Hinglish Lore Note (tracks Chapter 3 clues cleanly via hook)
    for (const note of this.world.notes) {
      const d = Math.hypot(this.playerPos.x - note.position.x, this.playerPos.z - note.position.z);
      if (d < 2.2) {
        const wasUnread = !note.read;
        note.read = true;
        this.activeChapter.onNoteRead?.(ctx, wasUnread, note.position);
        this.triggerInteractImpulse(0.65);
        this.activeNote = note.data;
        this.phase = 'note';
        this.keys.clear();
        this.releasePointerLock();
        this.audio.playItemPickup();
        this.emitHud();
        return;
      }
    }
  }

  private getCurrentPrompt(): { text: string | null; key: string } {
    if (this.phase !== 'playing' && this.phase !== 'climax') {
      return { text: null, key: 'E' };
    }
    if (this.hidingAlmirah) {
      return { text: 'Exit Almirah', key: 'E' };
    }

    const ctx = this.getChapterContext();
    const chapterPrompt = this.activeChapter.getPrompt(ctx);
    if (chapterPrompt) {
      return chapterPrompt;
    }

    if (this.isOutdoorActive()) {
      return { text: null, key: 'E' };
    }

    for (const door of this.world.hingedDoors) {
      if (
        Math.hypot(this.playerPos.x - door.interactPos.x, this.playerPos.z - door.interactPos.z) <
        2.55
      ) {
        return {
          text: `${door.isOpen ? 'Close' : 'Open'} ${door.roomName} Door`,
          key: 'E',
        };
      }
    }

    for (const alm of this.world.almirahs) {
      if (Math.hypot(this.playerPos.x - alm.exitPos.x, this.playerPos.z - alm.exitPos.z) < 1.95) {
        return { text: 'Hide inside Wooden Almirah', key: 'E' };
      }
    }

    for (const note of this.world.notes) {
      if (Math.hypot(this.playerPos.x - note.position.x, this.playerPos.z - note.position.z) < 2.2) {
        const badge = this.activeChapter.getNotePromptBadge?.(ctx, note.read) ?? '';
        return { text: `Read Note${badge}: ${note.data.title}`, key: 'E' };
      }
    }

    return { text: null, key: 'E' };
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Escape') {
      if (this.phase === 'note') {
        this.resumeGame();
      } else if (this.phase === 'playing' || this.phase === 'climax') {
        this.pauseGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (e.repeat) return;
    this.keys.add(e.code);

    if (e.code === 'KeyF') {
      this.toggleFlashlight();
    } else if (e.code === 'KeyE') {
      this.triggerInteract();
    } else if (e.code === 'Space') {
      if (this.phase === 'playing' || this.phase === 'climax') {
        e.preventDefault();
        this.triggerJump();
      }
    } else if (e.code === 'KeyC') {
      this.toggleCrouch();
    } else if (e.code === 'KeyZ') {
      this.toggleProne();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.pointerLocked) return;
    this.applyLookDelta(e.movementX, e.movementY);
  }

  private onWindowBlur(): void {
    this.keys.clear();
    this.touchInput.moveX = 0;
    this.touchInput.moveY = 0;
    this.touchInput.sprint = false;
  }

  private onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  }

  private onResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.visualViewport?.width || window.innerWidth;
    const h = Math.max(
      1,
      this.container.clientHeight || window.visualViewport?.height || window.innerHeight
    );
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Keep wide 20:9 Android landscape phones crisp and distortion-free
    this.camera.fov = aspect > 1.9 ? 66 : aspect < 1 ? 76 : 70;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.applyQualityPixelRatio();
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    const timeSec = now * 0.001;

    this.updateScene(dt, timeSec);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private updateEmbersAndBurst(dt: number, timeSec: number, climaxBoost: boolean): void {
    const activeEmbers = this.quality === 'low' ? EMBER_LOW_COUNT : EMBER_HIGH_COUNT;
    for (let i = 0; i < activeEmbers; i++) {
      this.emberLife[i] -= dt;
      if (this.emberLife[i] <= 0) {
        this.respawnEmber(i, climaxBoost);
      } else {
        const i3 = i * 3;
        const swirl = Math.sin(timeSec * 3.1 + i * 1.7) * 0.14;
        this.emberPositions[i3] += (this.emberVelocities[i3] + swirl) * dt;
        this.emberPositions[i3 + 1] += this.emberVelocities[i3 + 1] * dt;
        this.emberPositions[i3 + 2] +=
          (this.emberVelocities[i3 + 2] + Math.cos(timeSec * 2.6 + i * 1.3) * 0.14) * dt;
      }
    }
    (this.emberPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    if (this.pickupBurstLife > 0) {
      this.pickupBurstLife = Math.max(0, this.pickupBurstLife - dt);
      const norm = this.pickupBurstLife / 0.72;
      for (let i = 0; i < PICKUP_BURST_COUNT; i++) {
        const i3 = i * 3;
        this.pickupBurstPositions[i3] += this.pickupBurstVelocities[i3] * dt;
        this.pickupBurstPositions[i3 + 1] += this.pickupBurstVelocities[i3 + 1] * dt;
        this.pickupBurstPositions[i3 + 2] += this.pickupBurstVelocities[i3 + 2] * dt;
        this.pickupBurstVelocities[i3] *= Math.pow(0.28, dt);
        this.pickupBurstVelocities[i3 + 1] -= 1.35 * dt;
        this.pickupBurstVelocities[i3 + 2] *= Math.pow(0.28, dt);
      }
      (this.pickupBurstPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.pickupBurstPoints.material as THREE.PointsMaterial).opacity = norm * 0.95;
      this.pickupBurstLight.intensity = norm * norm * 4.6;
      if (this.pickupBurstLife <= 0) {
        this.pickupBurstPoints.visible = false;
        this.pickupBurstLight.intensity = 0;
      }
    }
  }

  private updateScene(dt: number, timeSec: number): void {
    const highDetail = this.quality === 'high';

    for (let i = 0; i < this.world.flickerLights.length; i++) {
      const fl = this.world.flickerLights[i];
      const f =
        0.85 + Math.sin(timeSec * 12.5 + fl.phase) * 0.12 + Math.sin(timeSec * 23 + fl.phase) * 0.06;
      fl.light.intensity = fl.baseIntensity * f;
      if (fl.flame) fl.flame.scale.set(1, f, 1);
    }

    if (this.dustParticles.visible) {
      const pos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      const activeDust = highDetail ? DUST_HIGH_COUNT : DUST_LOW_COUNT;
      for (let i = 0; i < activeDust; i++) {
        let y = pos.getY(i) + dt * 0.075;
        if (y > 5.1) y = 0.35;
        const x = pos.getX(i) + Math.sin(timeSec * 0.65 + i) * dt * 0.03;
        pos.setXY(i, x, y);
      }
      pos.needsUpdate = true;
    }

    this.updateEmbersAndBurst(dt, timeSec, this.phase === 'climax');

    // Smoothly articulate all 4 creaking hinged Haveli wing doors
    for (let i = 0; i < this.world.hingedDoors.length; i++) {
      const door = this.world.hingedDoors[i];
      if (door.ghostPushCooldown > 0) {
        door.ghostPushCooldown = Math.max(0, door.ghostPushCooldown - dt);
      }
      const target = door.isOpen ? 1 : 0;
      door.openAmount = THREE.MathUtils.damp(door.openAmount, target, 5.5, dt);
      door.leftPivot.rotation.y = door.openAmount * 1.56;
      door.rightPivot.rotation.y = -door.openAmount * 1.56;
    }

    // Smoothly swing wooden Almirah shutters wide on entry/exit before creaking shut
    for (let i = 0; i < this.world.almirahs.length; i++) {
      const alm = this.world.almirahs[i];
      alm.doorSwingBoost = THREE.MathUtils.damp(alm.doorSwingBoost, 0, 4.5, dt);
      const targetOpen = (this.hidingAlmirah === alm ? 0.08 : 0) + alm.doorSwingBoost;
      alm.doorOpenAmount = THREE.MathUtils.damp(alm.doorOpenAmount, targetOpen, 8.5, dt);
      alm.leftDoorPivot.rotation.y = -alm.doorOpenAmount;
      alm.rightDoorPivot.rotation.y = alm.doorOpenAmount;
    }

    // Live 3D atmospheric camera pan during Title, Story & Briefing modals
    if (this.phase === 'title' || this.phase === 'story' || this.phase === 'briefing') {
      if (this.isForestActive()) {
        // Eerie Banyan & Peepal Forest overview facing the distant crimson-sealed Haveli Main Door
        const sway = Math.sin(timeSec * 0.22) * 2.4;
        this.camera.position.set(sway, 2.55 + Math.sin(timeSec * 0.45) * 0.08, 22.5);
        this.camera.lookAt(0, 2.0, -28.0);
        this.forestWorld.updateVisuals(dt, timeSec);
        this.flashlight.viewGroup.visible = false;
        this.flashlight.spotLight.intensity = 0;
        this.flashlight.beamMesh.visible = false;
        this.flashlight.innerBeamMesh.visible = false;
        this.flashlight.beamDustPoints.visible = false;
        return;
      }
      if (this.isVillageOutdoor()) {
        // Misty outdoor village overview facing the distant lantern-lit Haveli Gate during Ch 1 Briefing
        const sway = Math.sin(timeSec * 0.24) * 2.2;
        this.camera.position.set(sway, 2.35 + Math.sin(timeSec * 0.5) * 0.08, 17.5);
        this.camera.lookAt(0, 1.85, -18.0);
        this.outdoorWorld.updateVisuals(dt, timeSec, 0);
        this.flashlight.viewGroup.visible = false;
        this.flashlight.spotLight.intensity = 0;
        this.flashlight.beamMesh.visible = false;
        this.flashlight.innerBeamMesh.visible = false;
        this.flashlight.beamDustPoints.visible = false;
        return;
      }
      const angle = 0.52 + Math.sin(timeSec * 0.17) * 0.34;
      this.camera.position.set(
        Math.sin(angle) * 6.4,
        1.85 + Math.sin(timeSec * 0.4) * 0.08,
        Math.cos(angle) * 6.4
      );
      this.camera.lookAt(-1.1, 1.18, -1.2);
      this.ghostAI.setTitleShowcasePose(timeSec, highDetail);
      this.flashlight.viewGroup.visible = true;
      this.flashlight.viewGroup.position.set(
        0.28 + Math.cos(timeSec * 0.9) * 0.004,
        -0.22 + Math.sin(timeSec * 1.8) * 0.005,
        -0.44
      );
      this.flashlight.viewGroup.rotation.set(0.06, -0.09, 0.05);
      this.flashlight.spotLight.intensity = 6.8 + Math.sin(timeSec * 7.2) * 0.42;
      this.flashlight.beamMesh.visible = true;
      this.flashlight.innerBeamMesh.visible = true;
      this.flashlight.beamDustPoints.visible = true;
      this.flashlight.updateBeamDust(dt, timeSec, highDetail);
      this.world.havanKund.update(timeSec, false, 0, false);
      return;
    }

    // Jumpscare close-up sequence
    if (this.phase === 'jumpscare') {
      this.jumpscareTimer += dt;
      _fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      this.ghostRig.root.position.copy(this.camera.position).addScaledVector(_fwd, 0.7);
      this.ghostRig.root.position.y = this.camera.position.y - 1.5 + (Math.random() - 0.5) * 0.09;
      this.ghostRig.root.lookAt(
        this.camera.position.x,
        this.ghostRig.root.position.y,
        this.camera.position.z
      );
      this.ghostRig.headGroup.rotation.z = (Math.random() - 0.5) * 0.78;
      this.flashlight.spotLight.intensity = Math.random() > 0.35 ? 16 : 0.8;

      if (this.jumpscareTimer >= 1.4) {
        this.phase = 'gameover';
        this.releasePointerLock();
        this.audio.setTension(0, false);
        this.emitHud();
      } else {
        this.hudThrottle += dt;
        if (this.hudThrottle > 0.05) {
          this.hudThrottle = 0;
          this.emitHud();
        }
      }
      return;
    }

    // Movie-Like 8.5s Victory Shanti Cinematic Sequence (Sweeping Orbit + Sunrise Gold + Ascension)
    if (this.phase === 'victory') {
      this.shantiProgress = Math.min(1, this.shantiProgress + dt / 8.5);
      const p = this.shantiProgress;

      this.ghostAI.update(
        dt,
        timeSec,
        this.playerPos,
        this.camera.quaternion,
        false,
        false,
        false,
        false,
        DIFFICULTY_CONFIGS[this.difficulty],
        1.0,
        false,
        highDetail
      );
      this.world.havanKund.update(timeSec, false, p, false);

      // Transform the cold cursed night into a radiant golden dawn across the entire haveli!
      this.hemiLight.color.lerp(_dawnHemiColor, dt * 0.75);
      this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, 1.85, 1.4, dt);
      this.moonLight.color.lerp(_dawnMoonColor, dt * 0.75);
      this.moonLight.intensity = THREE.MathUtils.damp(this.moonLight.intensity, 2.3, 1.4, dt);
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.lerp(_dawnBgColor, dt * 0.55);
      }
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.lerp(_dawnFogColor, dt * 0.6);
        this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, 0.028, 1.1, dt);
      }

      // Sweeping 135-degree cinematic crane dolly orbit tracking the bride's peaceful ascent!
      const orbitAngle = -0.35 + p * 2.25;
      const radius = 4.6 + Math.sin(p * Math.PI * 0.85) * 2.1;
      const camY = 1.45 + p * 2.15;
      this.camera.position.set(
        Math.sin(orbitAngle) * radius,
        camY,
        Math.cos(orbitAngle) * radius
      );
      const targetLookY = 1.35 + Math.pow(p, 1.25) * 3.1;
      this.camera.lookAt(0, targetLookY, 0);

      this.flashlight.viewGroup.visible = false;
      this.flashlight.spotLight.intensity = 0;
      this.flashlight.beamMesh.visible = false;
      this.flashlight.innerBeamMesh.visible = false;
      this.flashlight.beamDustPoints.visible = false;
      this.hudThrottle += dt;
      if (this.hudThrottle > 0.08) {
        this.hudThrottle = 0;
        this.emitHud();
      }
      return;
    }

    if (this.phase !== 'playing' && this.phase !== 'climax') {
      this.world.havanKund.update(timeSec, false, 0, false);
      return;
    }

    // =========================================================
    // ACTIVE GAMEPLAY & CLIMAX SIMULATION
    // =========================================================
    const config = DIFFICULTY_CONFIGS[this.difficulty];
    const isOutdoor = this.isOutdoorActive();
    this.elapsedSeconds += dt;
    this.timeSinceProgress += dt;
    const inGracePeriod =
      !isOutdoor && this.elapsedSeconds < config.spawnGracePeriod && this.phase === 'playing';

    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    }
    if (this.hurtInvulnTimer > 0) {
      this.hurtInvulnTimer = Math.max(0, this.hurtInvulnTimer - dt);
    }
    if (this.checkpointBannerTimer > 0) {
      this.checkpointBannerTimer = Math.max(0, this.checkpointBannerTimer - dt);
      if (this.checkpointBannerTimer <= 0) {
        this.checkpointBanner = null;
      }
    }

    if (!isOutdoor) {
      this.templeBellTimer -= dt;
      if (this.templeBellTimer <= 0) {
        this.audio.playTempleBell(0.36);
        this.templeBellTimer = 24 + Math.random() * 18;
      }
    }

    if (!this.hintActive && this.phase === 'playing' && this.timeSinceProgress >= config.hintDelay) {
      this.hintActive = true;
      this.audio.playTempleBell(0.75);
    }

    // Update modular Chapter logic, animations, hazards & cinematics
    const chapterCtx = this.getChapterContext();
    this.activeChapter.update(chapterCtx, dt, timeSec);
    if (this.phase !== 'playing' && this.phase !== 'climax') {
      return;
    }

    // Cooldowns & transient timers
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }
    if (this.headroomBlockedTimer > 0) {
      this.headroomBlockedTimer = Math.max(0, this.headroomBlockedTimer - dt);
    }
    if (this.attackHitFlash > 0) {
      this.attackHitFlash = Math.max(0, this.attackHitFlash - dt * 2.8);
    }

    // Movement + Stamina + Stance Physics (Standing / Crouch / Prone + Jump)
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;

    moveForward += this.touchInput.moveY;
    moveRight += this.touchInput.moveX;

    const wantsSprint =
      this.stance === 'standing' &&
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchInput.sprint) &&
      (Math.abs(moveForward) > 0.1 || Math.abs(moveRight) > 0.1) &&
      !this.hidingAlmirah;

    const isSprinting = wantsSprint && this.stamina > 2;
    if (isSprinting) {
      this.stamina = Math.max(0, this.stamina - config.staminaDrainPerSec * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + config.staminaRegenPerSec * dt);
    }

    const movementLocked = Boolean(this.activeChapter.isMovementLocked?.());

    // Vertical Jump & Gravity Physics
    if (!this.hidingAlmirah && !movementLocked) {
      if (!this.isGrounded || this.playerVelY > 0) {
        this.playerFeetY += this.playerVelY * dt;
        this.playerVelY -= GRAVITY * dt;
        if (this.playerFeetY <= 0) {
          const impactSpeed = Math.abs(this.playerVelY);
          this.playerFeetY = 0;
          this.playerVelY = 0;
          this.isGrounded = true;
          this.landingDip = -Math.min(0.16, 0.07 + impactSpeed * 0.015);
          this.audio.playJumpLand(Math.min(1.2, impactSpeed / 5.0));
          if (!isOutdoor && !inGracePeriod) {
            this.ghostAI.notifyNoise(this.playerPos, config.hearingRange * 0.72, this.stealthFactor);
          }
        }
      }
    } else {
      this.playerFeetY = 0;
      this.playerVelY = 0;
      this.isGrounded = true;
    }

    const bodyHeight = this.getTargetBodyHeight(this.stance);
    const stanceSpeedMult =
      this.stance === 'prone' ? 0.35 : this.stance === 'crouching' ? 0.6 : 1.0;

    const isForest = this.isForestActive();
    let isMoving = false;
    const roomNow = isForest
      ? this.forestWorld.getZoneName(this.playerPos.x, this.playerPos.z)
      : isOutdoor
        ? this.outdoorWorld.getZoneName(this.playerPos.x, this.playerPos.z)
        : this.world.getRoomName(this.playerPos.x, this.playerPos.z);

    if (!this.hidingAlmirah && !movementLocked) {
      const mag = Math.hypot(moveForward, moveRight);
      if (mag > 0.05) {
        isMoving = true;
        const clampedMag = Math.min(1, mag);
        const nf = (moveForward / mag) * clampedMag;
        const nr = (moveRight / mag) * clampedMag;

        _fwd.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
        _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));
        _move.set(0, 0, 0).addScaledVector(_fwd, nf).addScaledVector(_right, nr);

        const baseSpeed = isSprinting ? config.playerSprintSpeed : config.playerWalkSpeed;
        const speed = baseSpeed * stanceSpeedMult;
        this.playerPos.addScaledVector(_move, speed * dt);
        if (isForest) {
          this.forestWorld.resolvePlayerCollision(this.playerPos, 0.36);
        } else if (isOutdoor) {
          this.outdoorWorld.resolvePlayerCollision(this.playerPos, 0.36);
        } else {
          this.world.resolvePlayerCollision(this.playerPos, 0.34, this.playerFeetY, bodyHeight);
        }

        if (this.isGrounded) {
          this.walkBobPhase +=
            dt *
            (isSprinting
              ? 13.5
              : this.stance === 'prone'
                ? 5.2
                : this.stance === 'crouching'
                  ? 6.8
                  : 8.5);
          this.footstepCooldown -= dt;
          if (this.footstepCooldown <= 0) {
            if (this.stance === 'prone') {
              this.audio.playStanceShift(true);
              this.footstepCooldown = 0.74;
            } else {
              this.audio.playFootstep(isSprinting, isOutdoor || roomNow === 'Central Aangan');
              this.footstepCooldown = isSprinting
                ? 0.3
                : this.stance === 'crouching'
                  ? 0.62
                  : 0.46;
            }
            if (!isOutdoor && isSprinting && !inGracePeriod) {
              this.ghostAI.notifyNoise(this.playerPos, config.hearingRange, this.stealthFactor);
            }
          }
        }
      }
    }

    // Evaluate real environmental stealth (Almirah / Prone under Furniture / Forest Logs & Rocks / Corner Cover)
    const torchLit = this.flashlightOn && !this.hidingAlmirah;
    if (isForest) {
      const nearForestCover = this.forestWorld.isNearStealthCover(this.playerPos.x, this.playerPos.z);
      if (nearForestCover && (this.stance === 'crouching' || this.stance === 'prone')) {
        this.stealthReason = 'corner';
        this.isConcealed = !torchLit;
        this.stealthFactor = torchLit ? 0.55 : 0.28;
      } else if (this.stance === 'prone') {
        this.stealthReason = 'none';
        this.isConcealed = !torchLit;
        this.stealthFactor = torchLit ? 0.7 : 0.42;
      } else if (this.stance === 'crouching') {
        this.stealthReason = 'none';
        this.isConcealed = false;
        this.stealthFactor = torchLit ? 0.85 : 0.58;
      } else {
        this.stealthReason = 'none';
        this.isConcealed = false;
        this.stealthFactor = 1.0;
      }
    } else if (isOutdoor) {
      this.stealthReason = 'none';
      this.isConcealed = false;
      this.stealthFactor = 1.0;
    } else if (this.hidingAlmirah) {
      this.stealthReason = 'almirah';
      this.isConcealed = !this.flashlightOn;
      this.stealthFactor = this.flashlightOn ? 0.8 : 0.25;
    } else {
      const cover = this.world.evaluateStealthCover(
        this.playerPos.x,
        this.playerPos.z,
        this.stance,
        this.coverScratch
      );
      if (cover.underFurniture) {
        this.stealthReason = 'furniture';
        this.isConcealed = !torchLit;
        this.stealthFactor = torchLit ? 0.55 : 0.25; // 75% detection radius reduction!
      } else if (cover.nearCover && (this.stance === 'crouching' || this.stance === 'prone')) {
        this.stealthReason = 'corner';
        this.isConcealed = !torchLit;
        this.stealthFactor = torchLit ? 0.62 : 0.25; // 75% detection radius reduction!
      } else {
        this.stealthReason = 'none';
        this.isConcealed = false;
        this.stealthFactor =
          this.stance === 'prone'
            ? torchLit
              ? 0.78
              : 0.45
            : this.stance === 'crouching'
              ? torchLit
                ? 0.88
                : 0.62
              : 1.0;
      }
    }

    // Dynamic Player Breathing & Panicked Panting Audio
    this.breathTimer -= dt;
    if (this.breathTimer <= 0) {
      const panic = Math.max(this.proximityIntensity, (100 - this.stamina) / 110);
      if (panic > 0.22 || isSprinting || this.hidingAlmirah) {
        this.audio.playPlayerBreath(panic, isSprinting || this.stamina < 30, this.hidingAlmirah !== null);
      }
      this.breathTimer = isSprinting || panic > 0.65 ? 0.62 : this.hidingAlmirah ? 1.15 : 1.75;
    }

    // Smooth eye-height interpolation (1.70m -> 1.00m -> 0.45m) + landing dip + bob
    const targetEye = this.hidingAlmirah ? 1.54 : this.getTargetEyeHeight(this.stance);
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 10.5, dt);
    this.landingDip = THREE.MathUtils.damp(this.landingDip, 0, 12.0, dt);

    const bobAmp =
      !this.isGrounded
        ? 0
        : isMoving
          ? isSprinting
            ? 0.055
            : this.stance === 'prone'
              ? 0.014
              : this.stance === 'crouching'
                ? 0.02
                : 0.03
          : 0.006;
    const bobY = !this.isGrounded
      ? 0
      : isMoving
        ? Math.sin(this.walkBobPhase) * bobAmp
        : Math.sin(timeSec * 1.8) * bobAmp;

    const finalCamY = Math.max(0.32, this.playerFeetY + this.currentEyeHeight + this.landingDip + bobY);
    this.playerPos.y = finalCamY;

    // Smoothly damp Torch Bash camera recoil, turn inertia lag & interaction impulse
    this.attackRecoilPitch = THREE.MathUtils.damp(this.attackRecoilPitch, 0, 11, dt);
    this.attackRecoilRoll = THREE.MathUtils.damp(this.attackRecoilRoll, 0, 11, dt);
    this.lookLagYaw = THREE.MathUtils.damp(this.lookLagYaw, 0, 10.5, dt);
    this.lookLagPitch = THREE.MathUtils.damp(this.lookLagPitch, 0, 10.5, dt);
    this.interactImpulse = THREE.MathUtils.damp(this.interactImpulse, 0, 9.0, dt);

    if (this.cameraOverrideActive) {
      this.camera.position.copy(this.cameraOverridePos);
      this.camera.lookAt(this.cameraOverrideLook);
    } else {
      this.camera.position.set(this.playerPos.x, finalCamY, this.playerPos.z);
      const shakeAmp = this.proximityIntensity > 0.55 ? (this.proximityIntensity - 0.55) * 0.025 : 0;
      const stanceTilt = this.stance === 'prone' ? 0.018 : 0;
      const breathPitch = !isMoving && this.isGrounded ? Math.sin(timeSec * 1.85) * 0.0045 : 0;
      const interactCamPitch = -this.interactImpulse * 0.024;
      _euler.set(
        this.playerPitch +
          this.attackRecoilPitch +
          breathPitch +
          interactCamPitch +
          (Math.random() - 0.5) * shakeAmp,
        this.playerYaw + (Math.random() - 0.5) * shakeAmp,
        (isMoving && this.isGrounded ? Math.cos(this.walkBobPhase * 0.5) * (isSprinting ? 0.018 : 0.011) : 0) +
          this.attackRecoilRoll +
          stanceTilt,
        'YXZ'
      );
      this.camera.quaternion.setFromEuler(_euler);
    }

    // Flashlight battery & proximity flickering + Vintage Torch Bash animation & Golden Holy Spark VFX
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - config.batteryDrainPerSec * dt);
      if (this.battery <= 0) {
        this.flashlightOn = false;
        this.audio.playFlashlightClick();
      }
    } else {
      this.battery = Math.min(100, this.battery + 0.65 * dt);
    }

    let bashOffX = 0;
    let bashOffY = 0;
    let bashOffZ = 0;
    let bashRotX = 0;
    let bashRotY = 0;
    let bashRotZ = 0;

    if (this.attackAnimActive) {
      this.attackAnimTime += dt;
      const p = Math.min(1, this.attackAnimTime / ATTACK_ANIM_DURATION);

      if (p < 0.24) {
        // Quick wind-up pull back to the right
        const t = p / 0.24;
        bashOffX = t * 0.09;
        bashOffY = t * 0.07;
        bashOffZ = t * 0.08;
        bashRotX = t * 0.35;
        bashRotY = -t * 0.35;
        bashRotZ = -t * 0.28;
      } else if (p < 0.52) {
        // Visceral forward bash arc across center view
        const t = (p - 0.24) / 0.28;
        const ease = 1 - Math.pow(1 - t, 3);
        bashOffX = 0.09 - ease * 0.34;
        bashOffY = 0.07 + Math.sin(ease * Math.PI) * 0.08 - ease * 0.04;
        bashOffZ = 0.08 - ease * 0.36;
        bashRotX = 0.35 - ease * 1.15;
        bashRotY = -0.35 + ease * 0.92;
        bashRotZ = -0.28 + ease * 0.72;
      } else {
        // Smooth damped recovery back to ready grip
        const t = (p - 0.52) / 0.48;
        const inv = 1 - t * t * (3 - 2 * t);
        bashOffX = -0.25 * inv;
        bashOffY = 0.03 * inv;
        bashOffZ = -0.28 * inv;
        bashRotX = -0.8 * inv;
        bashRotY = 0.57 * inv;
        bashRotZ = 0.44 * inv;
      }

      // Golden Holy Spark burst at bash peak (stronger on hit, subtle ward gleam on swing!)
      const sparkWindow = p > 0.2 && p < 0.78 ? Math.sin(((p - 0.2) / 0.58) * Math.PI) : 0;
      const sparkIntensity = this.attackLandedHit ? sparkWindow : sparkWindow * 0.48;
      if (sparkIntensity > 0.02) {
        this.flashlight.sparkGroup.visible = true;
        const expand = (p - 0.2) / 0.58;
        const coreScale = (this.attackLandedHit ? 1.45 : 0.75) * (0.55 + sparkWindow * 0.95);
        this.flashlight.sparkCoreMesh.scale.setScalar(coreScale);
        this.flashlight.sparkCoreMesh.rotation.z = timeSec * 14;
        this.flashlight.sparkCoreMat.opacity = Math.min(0.95, sparkIntensity * 1.1);
        this.flashlight.sparkRayMat.opacity = Math.min(0.92, sparkIntensity);
        this.flashlight.sparkLight.intensity = sparkIntensity * (this.attackLandedHit ? 7.5 : 3.2);

        const rayReach = (this.attackLandedHit ? 0.28 : 0.14) * expand;
        for (let r = 0; r < this.flashlight.sparkRays.length; r++) {
          const ray = this.flashlight.sparkRays[r];
          ray.mesh.position.set(
            ray.dir.x * rayReach,
            ray.dir.y * rayReach,
            ray.dir.z * rayReach
          );
          ray.mesh.scale.set(1, 1, 0.7 + sparkWindow * 1.3);
        }
      } else {
        this.flashlight.sparkGroup.visible = false;
        this.flashlight.sparkLight.intensity = 0;
      }

      if (p >= 1) {
        this.attackAnimActive = false;
        this.flashlight.sparkGroup.visible = false;
        this.flashlight.sparkLight.intensity = 0;
      }
    }

    // Procedural FPS Vintage Flashlight kinematics: breathing sway, stance/sprint bob, look inertia lag, interaction tilt & Torch Bash
    const idleBreathX = Math.cos(timeSec * 0.925) * 0.0042;
    const idleBreathY = Math.sin(timeSec * 1.85) * 0.0055;
    const handBobAmpX = isMoving && this.isGrounded ? (isSprinting ? 0.024 : this.stance === 'prone' ? 0.007 : 0.013) : 0;
    const handBobAmpY = isMoving && this.isGrounded ? (isSprinting ? 0.028 : this.stance === 'prone' ? 0.008 : 0.015) : 0;
    const handBobX = isMoving && this.isGrounded ? Math.cos(this.walkBobPhase * 0.5) * handBobAmpX : 0;
    const handBobY = isMoving && this.isGrounded ? Math.abs(Math.sin(this.walkBobPhase * 0.5)) * handBobAmpY : 0;
    const jumpHandDrop = !this.isGrounded ? Math.max(-0.045, Math.min(0.035, -this.playerVelY * 0.006)) : 0;

    const lagOffX = -this.lookLagYaw * 0.22;
    const lagOffY = this.lookLagPitch * 0.16;
    const lagRotY = -this.lookLagYaw * 0.58;
    const lagRotX = this.lookLagPitch * 0.45;
    const lagRotZ = this.lookLagYaw * 0.35;

    const interactOffZ = -this.interactImpulse * 0.055;
    const interactOffY = -this.interactImpulse * 0.025;
    const interactRotX = -this.interactImpulse * 0.22;
    const interactRotZ = -this.interactImpulse * 0.15;

    this.flashlight.viewGroup.visible = !this.hidingAlmirah && !this.cameraOverrideActive;
    this.flashlight.viewGroup.position.set(
      0.28 + idleBreathX + handBobX + lagOffX + bashOffX,
      -0.22 +
        idleBreathY +
        handBobY +
        jumpHandDrop +
        this.landingDip * 0.35 +
        lagOffY +
        interactOffY +
        (this.stance === 'prone' ? 0.03 : 0) +
        bashOffY,
      -0.44 + interactOffZ + bashOffZ
    );
    this.flashlight.viewGroup.rotation.set(
      0.06 + lagRotX + interactRotX + (isSprinting ? -0.07 : 0) + bashRotX,
      -0.09 + lagRotY + bashRotY,
      0.05 + lagRotZ + interactRotZ + (isMoving && this.isGrounded ? handBobX * 1.4 : 0) + bashRotZ
    );

    // Smoothly slide the metallic power switch nub on top of the torch
    const targetSwitchZ = this.flashlightOn ? -0.068 : -0.044;
    this.flashlight.switchNub.position.z = THREE.MathUtils.damp(
      this.flashlight.switchNub.position.z,
      targetSwitchZ,
      18,
      dt
    );

    if (this.flashlightOn && !this.hidingAlmirah) {
      let flicker = 1.0;
      if (this.proximityIntensity > 0.34) {
        const harsh = Math.sin(timeSec * 48) * Math.sin(timeSec * 17.3);
        const cutoutChance = (this.proximityIntensity - 0.34) * 0.62;
        flicker = Math.random() < cutoutChance ? 0.1 : 0.58 + Math.abs(harsh) * 0.55;
      }
      const lowBatFactor = this.battery < 18 ? 0.55 + (this.battery / 18) * 0.45 : 1;
      const beamOn = flicker > 0.25;
      this.flashlight.spotLight.intensity = 8.6 * flicker * lowBatFactor;
      this.flashlight.beamMesh.visible = beamOn;
      this.flashlight.innerBeamMesh.visible = beamOn;
      this.flashlight.beamDustPoints.visible = beamOn;
      this.flashlight.lensMat.emissiveIntensity = 1.65 * flicker;
      this.flashlight.bulbMat.color.setHex(beamOn ? 0xfff3d4 : 0x554430);
      if (beamOn) {
        this.flashlight.updateBeamDust(dt, timeSec, highDetail);
      }
    } else {
      this.flashlight.spotLight.intensity = 0;
      this.flashlight.beamMesh.visible = false;
      this.flashlight.innerBeamMesh.visible = false;
      this.flashlight.beamDustPoints.visible = false;
      this.flashlight.lensMat.emissiveIntensity = 0.05;
      this.flashlight.bulbMat.color.setHex(0x3a3228);
    }

    if (this.trishulEquipped && !this.cameraOverrideActive) {
      const flamePulse = 0.86 + Math.sin(timeSec * 16.5) * 0.14 + Math.sin(timeSec * 29.0) * 0.08;
      this.flashlight.trishulFlameMesh.scale.set(
        0.92 + Math.sin(timeSec * 21.0) * 0.08,
        flamePulse,
        0.92 + Math.cos(timeSec * 19.0) * 0.08
      );
      this.flashlight.trishulFlameLight.intensity = 2.6 * flamePulse;
    } else {
      this.flashlight.trishulFlameLight.intensity = 0;
    }

    if (isForest) {
      // Chapter 2 Forest & Boss Fight: Chapter 2 feeds proximityIntensity from Crawlers & Aghori Dwarpal
      const targetForestBpm =
        74 +
        Math.round(this.proximityIntensity * 84) +
        (isSprinting ? 14 : 0) +
        Math.round(((100 - this.playerHealth) / 100) * 32);
      this.bpm = THREE.MathUtils.damp(this.bpm, Math.min(176, targetForestBpm), 3.2, dt);
      const roundedForest = Math.round(this.bpm);
      if (roundedForest > this.maxBpm) this.maxBpm = roundedForest;

      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0 && this.proximityIntensity > 0.2) {
        this.audio.playHeartbeat(this.proximityIntensity * 0.9);
        this.heartbeatTimer = 60 / Math.max(76, this.bpm);
      }

      this.audio.setTension(this.proximityIntensity * 0.85, this.activeCombatEnemy !== null);
    } else if (isOutdoor) {
      // Outdoor Prologue: no indoor Haveli ghost pursuit; calm atmospheric tension + injury BPM
      this.proximityIntensity = THREE.MathUtils.damp(this.proximityIntensity, 0, 4.5, dt);
      const targetOutdoorBpm =
        72 + (isSprinting ? 18 : 0) + Math.round(((100 - this.playerHealth) / 100) * 44);
      this.bpm = THREE.MathUtils.damp(this.bpm, Math.min(155, targetOutdoorBpm), 3.0, dt);
      const roundedOutdoor = Math.round(this.bpm);
      if (roundedOutdoor > this.maxBpm) this.maxBpm = roundedOutdoor;
      this.audio.setTension(0, false);
    } else {
      // Update Ghost AI (scaled by current Chapter intensity + real stealth detection reduction + High/Low cloth wave)
      const climaxActive = this.phase === 'climax';
      const chapterConfig = this.getChapterScaledConfig();
      const ghostRes = this.ghostAI.update(
        dt,
        timeSec,
        this.playerPos,
        this.camera.quaternion,
        torchLit,
        this.hidingAlmirah !== null,
        climaxActive,
        inGracePeriod,
        chapterConfig,
        this.stealthFactor,
        this.isConcealed,
        highDetail
      );

      this.proximityIntensity = THREE.MathUtils.damp(
        this.proximityIntensity,
        ghostRes.proximityIntensity,
        4.5,
        dt
      );

      if (ghostRes.justStartedChase && !climaxActive) {
        this.audio.playPlayerGasp();
      }

      if (ghostRes.escapedChase) {
        this.jumpscaresSurvived += 1;
        this.audio.playPlayerReaction('escape');
      }

      // Heartbeat BPM (72 -> 180)
      const targetBpm =
        72 +
        Math.round(this.proximityIntensity * 96) +
        (climaxActive ? 14 : 0) +
        (isSprinting ? 8 : 0);
      this.bpm = THREE.MathUtils.damp(this.bpm, Math.min(180, targetBpm), 3.2, dt);
      const roundedBpm = Math.round(this.bpm);
      if (roundedBpm > this.maxBpm) this.maxBpm = roundedBpm;

      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0 && this.proximityIntensity > 0.14) {
        this.audio.playHeartbeat(this.proximityIntensity);
        this.heartbeatTimer = 60 / Math.max(72, this.bpm);
      }

      this.audio.setTension(this.proximityIntensity, climaxActive);

      const kundBeacon = Boolean(this.activeChapter.isKundBeaconActive?.(chapterCtx));
      this.world.havanKund.update(timeSec, climaxActive, 0, kundBeacon);

      // Catch check -> Jumpscare!
      if (ghostRes.caughtPlayer) {
        this.phase = 'jumpscare';
        this.jumpscareTimer = 0;
        this.maxBpm = Math.max(this.maxBpm, 180);
        this.bpm = 180;
        this.audio.playJumpscare();
        this.emitHud();
        return;
      }

      // Final Ritual Climax Countdown
      if (climaxActive) {
        this.climaxRemaining = Math.max(0, this.climaxRemaining - dt);
        if (this.climaxRemaining <= 0) {
          this.phase = 'victory';
          this.shantiProgress = 0;
          this.hidingAlmirah = null;
          this.releasePointerLock();
          this.ghostAI.position.set(0, 0, 0);
          this.ghostRig.root.position.set(0, 0.7, 0);
          this.playerPos.set(0, 1.65, 5.2);
          this.camera.position.copy(this.playerPos);
          this.ghostAI.triggerShanti();
          this.audio.setTension(0, false);
          this.emitHud();
          return;
        }
      }
    }

    this.hudThrottle += dt;
    if (this.hudThrottle >= 0.065) {
      this.hudThrottle = 0;
      this.emitHud();
    }
  }

  private getChapterProgress(): number {
    return this.activeChapter.getProgress(this.getChapterContext());
  }

  private buildObjectiveText(): string {
    if (this.phase === 'climax') {
      return `Survive the Final Havan (${Math.ceil(this.climaxRemaining)}s)`;
    }
    return this.activeChapter.getObjectiveText(this.getChapterContext());
  }

  private buildHintMessage(): string | null {
    if (!this.hintActive || this.phase !== 'playing') return null;
    return this.activeChapter.getHint(this.getChapterContext());
  }

  private buildMinimapData(): MinimapData {
    const ctx = this.getChapterContext();
    const objectives = this.activeChapter.getMinimapObjectives(ctx);
    const isForest = this.isForestActive();
    const isVillage = this.isVillageOutdoor();

    if (isForest) {
      const enemies: Array<{ id: string; x: number; z: number; isBoss?: boolean }> = [];
      for (let i = 0; i < this.forestWorld.crawlers.length; i++) {
        const c = this.forestWorld.crawlers[i];
        if (c.alive) {
          enemies.push({ id: c.id, x: c.position.x, z: c.position.z, isBoss: false });
        }
      }
      const boss = this.forestWorld.boss;
      if (boss.state !== 'hidden' && boss.state !== 'dead') {
        enemies.push({ id: 'aghori_dwarpal', x: boss.position.x, z: boss.position.z, isBoss: true });
      }
      return {
        mode: 'forest',
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerYaw: this.playerYaw,
        ghostX: boss.state !== 'hidden' && boss.state !== 'dead' ? boss.position.x : 0,
        ghostZ: boss.state !== 'hidden' && boss.state !== 'dead' ? boss.position.z : -99,
        ghostYaw: boss.yaw,
        ghostRoom: 'Outer Courtyard',
        ghostDistance:
          boss.state !== 'hidden' && boss.state !== 'dead'
            ? Math.round(Math.hypot(this.playerPos.x - boss.position.x, this.playerPos.z - boss.position.z))
            : 99,
        objectives,
        almirahs: [],
        dogX: this.forestWorld.dog.position.x,
        dogZ: this.forestWorld.dog.position.z,
        landmarks: this.forestWorld.landmarks,
        enemies,
      };
    }

    if (isVillage) {
      return {
        mode: 'outdoor',
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerYaw: this.playerYaw,
        ghostX: 0,
        ghostZ: -99,
        ghostYaw: 0,
        ghostRoom: 'Haveli',
        ghostDistance: 99,
        objectives,
        almirahs: [],
        dogX: this.outdoorWorld.dog.position.x,
        dogZ: this.outdoorWorld.dog.position.z,
        pawTrailVisible: this.outdoorWorld.pawPrintGroup.visible,
        pawTrail: this.outdoorWorld.pawTrailCoords,
        landmarks: this.outdoorWorld.landmarks,
      };
    }

    const ghostDist = Math.hypot(
      this.playerPos.x - this.ghostAI.position.x,
      this.playerPos.z - this.ghostAI.position.z
    );

    return {
      mode: 'haveli',
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      ghostX: this.ghostAI.position.x,
      ghostZ: this.ghostAI.position.z,
      ghostYaw: this.ghostAI.yaw,
      ghostRoom: this.world.getRoomName(this.ghostAI.position.x, this.ghostAI.position.z),
      ghostDistance: Math.round(ghostDist),
      objectives,
      almirahs: this.world.almirahs.map((a) => ({
        id: a.id,
        x: a.root.position.x,
        z: a.root.position.z,
      })),
    };
  }

  public emitHud(): void {
    const prompt = this.getCurrentPrompt();
    const collectedCount = this.world.ritualItems.filter((r) => r.collected).length;
    const config = DIFFICULTY_CONFIGS[this.difficulty];
    const chapterMeta = CHAPTER_CONFIGS[this.currentChapter] ?? this.activeChapter.config;
    const isOutdoor = this.isOutdoorActive();
    const graceRemaining =
      !isOutdoor && this.phase === 'playing'
        ? Math.max(0, Math.ceil(config.spawnGracePeriod - this.elapsedSeconds))
        : 0;

    // Build optional Enemy Health Bar payload automatically for mortal bosses / shadow guardians / rakshasas
    let activeEnemyHud: ActiveEnemyHudState | null = null;
    if (
      this.activeCombatEnemy &&
      this.activeCombatEnemy.isBossOrMortal &&
      !this.activeCombatEnemy.isDefeated
    ) {
      activeEnemyHud = {
        id: this.activeCombatEnemy.id,
        name: this.activeCombatEnemy.name,
        hindiName: this.activeCombatEnemy.hindiName,
        hp: Math.max(0, Math.round(this.activeCombatEnemy.hp)),
        maxHp: Math.max(1, Math.round(this.activeCombatEnemy.maxHp)),
        staggered: this.activeCombatEnemy.isStaggered,
      };
    } else if (!this.isVillageOutdoor()) {
      // Auto-detect any nearby mortal boss/monster within 18m (including Chapter 2 Forest & Boss)
      for (let i = 0; i < this.combatEnemies.length; i++) {
        const e = this.combatEnemies[i];
        if (!e.isBossOrMortal || e.isDefeated) continue;
        const d = Math.hypot(e.position.x - this.playerPos.x, e.position.z - this.playerPos.z);
        if (d < 18) {
          activeEnemyHud = {
            id: e.id,
            name: e.name,
            hindiName: e.hindiName,
            hp: Math.max(0, Math.round(e.hp)),
            maxHp: Math.max(1, Math.round(e.maxHp)),
            staggered: e.isStaggered,
          };
          break;
        }
      }
    }

    const isForest = this.isForestActive();
    this.onHudUpdate({
      phase: this.phase,
      chapter: this.currentChapter,
      totalChapters: TOTAL_CHAPTERS,
      isOutdoor,
      chapterProgress: this.getChapterProgress(),
      chapterTarget: chapterMeta.targetCount,
      chapterTaskLabel: chapterMeta.taskLabel,
      itemsCollectedCount: collectedCount,
      itemsPlacedCount: this.placedItems.length,
      placedItems: [...this.placedItems],
      holdingItem: this.holdingItem ? RITUAL_ITEMS[this.holdingItem] : null,
      playerHealth: Math.round(this.playerHealth),
      damageFlash: this.damageFlash,
      checkpointBanner: this.checkpointBanner,
      injuredReason: this.injuredReason,
      activeCheckpointLabel: this.activeCheckpoint.label,
      stamina: Math.round(this.stamina),
      battery: Math.round(this.battery),
      flashlightOn: this.flashlightOn,
      trishulEquipped: this.trishulEquipped,
      bpm: Math.round(this.bpm),
      maxBpm: this.maxBpm,
      isHiding: this.hidingAlmirah !== null,
      nearPrompt: prompt.text,
      promptKey: prompt.key,
      roomName: isForest
        ? this.forestWorld.getZoneName(this.playerPos.x, this.playerPos.z)
        : isOutdoor
          ? this.outdoorWorld.getZoneName(this.playerPos.x, this.playerPos.z)
          : this.world.getRoomName(this.playerPos.x, this.playerPos.z),
      climaxRemaining: this.climaxRemaining,
      elapsedSeconds: this.elapsedSeconds,
      jumpscaresSurvived: this.jumpscaresSurvived,
      hintMessage: this.buildHintMessage(),
      proximityIntensity: this.proximityIntensity,
      subtitle: this.subtitle,
      activeNote: this.activeNote,
      pointerLocked: this.pointerLocked,
      ghostState: this.ghostAI.state,
      jumpscareFlash: this.phase === 'jumpscare' ? Math.max(0, 1 - this.jumpscareTimer * 0.85) : 0,
      shantiProgress: this.shantiProgress,
      objectiveText: this.buildObjectiveText(),
      graceRemaining,
      mapData: this.buildMinimapData(),
      stance: this.stance,
      isConcealed: this.isConcealed,
      stealthReason: this.stealthReason,
      attackCooldownRemaining: this.attackCooldown,
      attackCooldownTotal: this.trishulEquipped ? 0.95 : ATTACK_COOLDOWN_SEC,
      attackHitFlash: this.attackHitFlash,
      headroomBlocked: this.headroomBlockedTimer > 0,
      activeCombatEnemy: activeEnemyHud,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('blur', this.boundBlur);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('orientationchange', this.boundOrientationChange);
    window.visualViewport?.removeEventListener('resize', this.boundResize);
    document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.boundContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.boundContextRestored);

    this.releasePointerLock();
    this.audio.dispose();
    this.textures.dispose();
    if (this.envRT) this.envRT.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
