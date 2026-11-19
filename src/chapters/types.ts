import * as THREE from 'three';
import { HorrorAudioManager } from '../game/audio';
import { GhostAIController } from '../game/ghostAI';
import { HaveliWorld } from '../game/haveliMap';
import { OutdoorVillageWorld } from '../game/outdoorVillageMap';
import {
  ChapterConfig,
  Difficulty,
  LoreNoteData,
  MinimapObjective,
  PlayerStance,
  RitualItemId,
} from '../game/types';

export interface ChapterCheckpoint {
  id: string;
  label: string;
  x: number;
  z: number;
  yaw: number;
}

export interface ChapterPrompt {
  text: string;
  key: string;
}

export interface ChapterCameraOverride {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export interface ChapterRuntimeContext {
  world: HaveliWorld;
  outdoorWorld: OutdoorVillageWorld;
  ghostAI: GhostAIController;
  audio: HorrorAudioManager;
  playerPos: THREE.Vector3;
  playerYaw: number;
  playerPitch: number;
  playerFeetY: number;
  stance: PlayerStance;
  difficulty: Difficulty;
  elapsedSeconds: number;
  timeSinceProgress: number;
  hintActive: boolean;
  holdingItem: RitualItemId | null;
  placedItems: RitualItemId[];
  resetProgressTimer: () => void;
  setHoldingItem: (id: RitualItemId | null) => void;
  addPlacedItem: (id: RitualItemId) => void;
  completeChapter: () => void;
  startClimax: () => void;
  openNote: (note: LoreNoteData) => void;
  spawnBurst: (origin: THREE.Vector3, colorHex: number) => void;
  triggerInteractImpulse: (strength?: number) => void;
  triggerCameraJolt: (pitch: number, roll: number) => void;
  setCheckpoint: (cp: ChapterCheckpoint, showBanner?: boolean) => void;
  damagePlayer: (
    amount: number,
    reason: string,
    kind: 'thorn' | 'scorpion',
    pushX?: number,
    pushZ?: number
  ) => void;
  healPlayerFull: () => void;
  forceStance: (next: PlayerStance) => void;
  setPlayerPose: (x: number, z: number, yaw?: number, pitch?: number) => void;
  setCameraOverride: (pos: THREE.Vector3, lookAt: THREE.Vector3) => void;
  clearCameraOverride: () => void;
  emitHud: () => void;
}

export interface ChapterModule {
  readonly config: ChapterConfig;
  getSpawn: () => { x: number; z: number; yaw: number };
  reset: (ctx: ChapterRuntimeContext) => void;
  update: (ctx: ChapterRuntimeContext, dt: number, timeSec: number) => void;
  interact: (ctx: ChapterRuntimeContext) => boolean;
  getPrompt: (ctx: ChapterRuntimeContext) => ChapterPrompt | null;
  getProgress: (ctx: ChapterRuntimeContext) => number;
  getObjectiveText: (ctx: ChapterRuntimeContext) => string;
  getHint: (ctx: ChapterRuntimeContext) => string | null;
  getMinimapObjectives: (ctx: ChapterRuntimeContext) => MinimapObjective[];
  isKundBeaconActive?: (ctx: ChapterRuntimeContext) => boolean;
  onNoteRead?: (ctx: ChapterRuntimeContext, wasUnread: boolean, pos: THREE.Vector3) => void;
  getNotePromptBadge?: (ctx: ChapterRuntimeContext, read: boolean) => string;
  isMovementLocked?: () => boolean;
}
