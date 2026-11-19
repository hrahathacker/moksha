export type GamePhase =
  | 'title'
  | 'story'
  | 'briefing'
  | 'playing'
  | 'paused'
  | 'note'
  | 'climax'
  | 'injured'
  | 'chapter_complete'
  | 'victory'
  | 'jumpscare'
  | 'gameover';

export type ChapterNumber = number;

export type ChapterEnvironment = 'outdoor' | 'haveli';

export type Difficulty = 'normal' | 'nightmare' | 'speedrun';

export type GraphicsQuality = 'high' | 'low';

export type RitualItemId = 'kalash' | 'chunri' | 'diya' | 'samagri';

export type GhostAIState = 'patrol' | 'investigate' | 'chase' | 'search' | 'staggered' | 'shanti';

export type PlayerStance = 'standing' | 'crouching' | 'prone';

export type StealthReason = 'none' | 'almirah' | 'furniture' | 'corner';

export interface EnemyCombatEntity {
  readonly id: string;
  readonly name: string;
  readonly hindiName?: string;
  readonly position: { x: number; y: number; z: number };
  hp: number;
  maxHp: number;
  readonly isBossOrMortal: boolean;
  readonly isDefeated: boolean;
  readonly isStaggered: boolean;
  takeDamage: (amount: number, knockbackDir?: { x: number; z: number }) => boolean;
  stagger: (durationSec: number, knockbackDir?: { x: number; z: number }) => void;
  onDefeat: () => void;
}

export interface ActiveEnemyHudState {
  id: string;
  name: string;
  hindiName?: string;
  hp: number;
  maxHp: number;
  staggered: boolean;
}

export interface ChapterConfig {
  id: ChapterNumber;
  title: string;
  hindiTitle: string;
  environment: ChapterEnvironment;
  shortTask: string;
  taskLabel: string;
  targetCount: number;
  ghostSpeedMult: number;
  briefingIntro: string;
  steps: Array<{ heading: string; detail: string }>;
  completionText: string;
}

export interface MinimapObjective {
  id: string;
  x: number;
  z: number;
  label: string;
  kind:
    | 'diya'
    | 'note'
    | 'bell'
    | 'seal'
    | 'item'
    | 'kund'
    | 'dog'
    | 'biscuit'
    | 'well'
    | 'pulley'
    | 'tulsi'
    | 'veranda'
    | 'key'
    | 'gate';
  urgent?: boolean;
}

export interface MinimapLandmark {
  id: string;
  x: number;
  z: number;
  label: string;
  kind: 'hut' | 'stall' | 'well' | 'shed' | 'tulsi' | 'gate' | 'hazard';
}

export interface MinimapData {
  mode: 'haveli' | 'outdoor';
  playerX: number;
  playerZ: number;
  playerYaw: number;
  ghostX: number;
  ghostZ: number;
  ghostYaw: number;
  ghostRoom: string;
  ghostDistance: number;
  objectives: MinimapObjective[];
  almirahs: Array<{ id: string; x: number; z: number }>;
  dogX?: number;
  dogZ?: number;
  pawTrailVisible?: boolean;
  pawTrail?: Array<{ x: number; z: number }>;
  landmarks?: MinimapLandmark[];
}

export interface RitualItemMeta {
  id: RitualItemId;
  name: string;
  hindiName: string;
  description: string;
}

export interface LoreNoteData {
  id: string;
  title: string;
  date: string;
  body: string;
  room: string;
}

export interface SubtitleState {
  hindi: string;
  hinglish: string;
  speaker?: 'ghost' | 'player' | 'song';
  id: number;
}

export interface StoryChapter {
  heading: string;
  hindiQuote: string;
  narration: string;
  moodCue: string;
}

export interface AIStoryPayload {
  title: string;
  year: string;
  chapters: StoryChapter[];
}

export interface VictorySongLyric {
  timeSec: number;
  hindi: string;
  hinglish: string;
}

export interface VictorySongData {
  title: string;
  subtitle: string;
  lyrics: VictorySongLyric[];
  vocalAudioBase64?: string;
}

export interface GameSettings {
  difficulty: Difficulty;
  quality: GraphicsQuality;
  volume: number;
  muted: boolean;
  touchSensitivity: number;
}

export interface DifficultyConfig {
  label: string;
  summary: string;
  patrolSpeed: number;
  investigateSpeed: number;
  chaseSpeed: number;
  climaxSpeed: number;
  visionRangeDark: number;
  visionRangeLit: number;
  hearingRange: number;
  batteryDrainPerSec: number;
  climaxDuration: number;
  hintDelay: number;
  spawnGracePeriod: number;
  playerWalkSpeed: number;
  playerSprintSpeed: number;
  staminaDrainPerSec: number;
  staminaRegenPerSec: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  chapter: ChapterNumber;
  totalChapters: number;
  isOutdoor: boolean;
  chapterProgress: number;
  chapterTarget: number;
  chapterTaskLabel: string;
  itemsCollectedCount: number;
  itemsPlacedCount: number;
  placedItems: RitualItemId[];
  holdingItem: RitualItemMeta | null;
  playerHealth: number; // 0..100
  damageFlash: number; // 0..1
  checkpointBanner: string | null;
  injuredReason: string | null;
  activeCheckpointLabel: string;
  stamina: number; // 0..100
  battery: number; // 0..100
  flashlightOn: boolean;
  bpm: number;
  maxBpm: number;
  isHiding: boolean;
  nearPrompt: string | null;
  promptKey: string;
  roomName: string;
  climaxRemaining: number;
  elapsedSeconds: number;
  jumpscaresSurvived: number;
  hintMessage: string | null;
  proximityIntensity: number; // 0..1
  subtitle: SubtitleState | null;
  activeNote: LoreNoteData | null;
  pointerLocked: boolean;
  ghostState: GhostAIState;
  jumpscareFlash: number; // 0..1
  shantiProgress: number; // 0..1
  objectiveText: string;
  graceRemaining: number;
  mapData: MinimapData;
  stance: PlayerStance;
  isConcealed: boolean;
  stealthReason: StealthReason;
  attackCooldownRemaining: number;
  attackCooldownTotal: number;
  attackHitFlash: number;
  headroomBlocked: boolean;
  activeCombatEnemy: ActiveEnemyHudState | null;
}

export const RITUAL_ITEMS: Record<RitualItemId, RitualItemMeta> = {
  kalash: {
    id: 'kalash',
    name: 'Brass Kalash',
    hindiName: 'Peetal Kalash',
    description: 'Sacred brass vessel crowned with mango leaves and coconut.',
  },
  chunri: {
    id: 'chunri',
    name: 'Red Chunri',
    hindiName: 'Laal Chunri',
    description: 'Crimson ceremonial cloth edged with weathered gold zari.',
  },
  diya: {
    id: 'diya',
    name: 'Glowing Brass Diya',
    hindiName: 'Akhand Diya',
    description: 'Pedestal brass lamp burning with an unbroken flame.',
  },
  samagri: {
    id: 'samagri',
    name: 'Havan Samagri Bowl',
    hindiName: 'Havan Samagri',
    description: 'Stone bowl filled with dried herbs, camphor, and marigold.',
  },
};

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  normal: {
    label: 'Normal (Easy)',
    summary: 'Story-friendly survival horror: slower spirit, faster hints, fair escapes.',
    patrolSpeed: 1.5,
    investigateSpeed: 1.95,
    chaseSpeed: 2.85,
    climaxSpeed: 3.05,
    visionRangeDark: 5.5,
    visionRangeLit: 10.5,
    hearingRange: 7.5,
    batteryDrainPerSec: 0.16,
    climaxDuration: 10,
    hintDelay: 35,
    spawnGracePeriod: 12,
    playerWalkSpeed: 3.55,
    playerSprintSpeed: 5.9,
    staminaDrainPerSec: 15,
    staminaRegenPerSec: 22,
  },
  nightmare: {
    label: 'Nightmare',
    summary: 'Relentless spirit, razor-sharp senses, intense battery & stamina pressure.',
    patrolSpeed: 2.55,
    investigateSpeed: 3.25,
    chaseSpeed: 4.45,
    climaxSpeed: 4.65,
    visionRangeDark: 9.2,
    visionRangeLit: 17.5,
    hearingRange: 13.0,
    batteryDrainPerSec: 0.65,
    climaxDuration: 12,
    hintDelay: 70,
    spawnGracePeriod: 3,
    playerWalkSpeed: 3.35,
    playerSprintSpeed: 5.55,
    staminaDrainPerSec: 23,
    staminaRegenPerSec: 13,
  },
  speedrun: {
    label: 'Speedrun',
    summary: 'Fast sprint movement and brisk patrol tuned for record ritual times.',
    patrolSpeed: 2.25,
    investigateSpeed: 2.85,
    chaseSpeed: 4.05,
    climaxSpeed: 4.25,
    visionRangeDark: 7.8,
    visionRangeLit: 14.0,
    hearingRange: 10.5,
    batteryDrainPerSec: 0.28,
    climaxDuration: 12,
    hintDelay: 40,
    spawnGracePeriod: 4,
    playerWalkSpeed: 4.1,
    playerSprintSpeed: 6.5,
    staminaDrainPerSec: 14,
    staminaRegenPerSec: 24,
  },
};

export const LORE_NOTES: LoreNoteData[] = [
  {
    id: 'note_veranda',
    title: 'Warning — Haveli Watchman',
    date: '14 October 1984',
    room: 'Aangan Veranda',
    body: 'Raat 3 baje payal ki aawaz aaye toh torch band karke almirah mein chhup jana. Woh roshni dekh leti hai... aur daudne ki aawaz door se sun leti hai.',
  },
  {
    id: 'note_pooja',
    title: 'Pandit ji ke Aakhiri Nirdesh',
    date: '16 October 1984',
    room: 'Pooja Room',
    body: 'Is haveli ki bhatakti aatma ko bandhan se mukt karne ke liye chaaron pavitra cheezein — Brass Kalash, Red Chunri, Glowing Diya aur Havan Samagri — Aangan ke Havan Kund mein ek-ek karke arpit karni hongi.',
  },
  {
    id: 'note_bedroom',
    title: 'Torn Diary Page',
    date: '19 October 1984',
    room: 'Master Bedroom',
    body: 'Us raat dulhan ko isi kamre mein akela chhod diya gaya tha. Laal saree aur chandi ki payal... aaj bhi jab hawa rukti hai, lagta hai koi peechhe khada hai. Peechhe mat mudna.',
  },
  {
    id: 'note_kitchen',
    title: 'Scribbled Note by the Hearth',
    date: '21 October 1984',
    room: 'Old Kitchen',
    body: 'Chauthi aur aakhiri samagri rakhte hi Havan Kund mein agni bhadak uthegi. Aakhiri kuch second khud ko bacha lena... agni poori hote hi usey Moksha mil jayega.',
  },
];
