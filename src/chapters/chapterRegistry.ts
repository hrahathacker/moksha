import { createChapter1 } from './chapter1';
import { createChapter2 } from './chapter2';
import { createChapter3 } from './chapter3';
import { createChapter4 } from './chapter4';
import { createChapter5 } from './chapter5';
import { createChapter6 } from './chapter6';
import { createChapter7 } from './chapter7';
import { ChapterModule } from './types';
import { ChapterConfig, ChapterNumber } from '../game/types';

/**
 * Central modular Chapter Registry (designed to scale cleanly up to 12+ chapters).
 * Each chapter lives in its own isolated file under src/chapters/chapterN.ts.
 */
const CHAPTER_FACTORIES: Record<ChapterNumber, () => ChapterModule> = {
  1: createChapter1,
  2: createChapter2,
  3: createChapter3,
  4: createChapter4,
  5: createChapter5,
  6: createChapter6,
  7: createChapter7,
};

const CHAPTER_INSTANCES: Record<ChapterNumber, ChapterModule> = {
  1: CHAPTER_FACTORIES[1](),
  2: CHAPTER_FACTORIES[2](),
  3: CHAPTER_FACTORIES[3](),
  4: CHAPTER_FACTORIES[4](),
  5: CHAPTER_FACTORIES[5](),
  6: CHAPTER_FACTORIES[6](),
  7: CHAPTER_FACTORIES[7](),
};

export const CHAPTER_LIST: ChapterConfig[] = Object.keys(CHAPTER_INSTANCES)
  .map((k) => Number(k))
  .sort((a, b) => a - b)
  .map((id) => CHAPTER_INSTANCES[id].config);

export const CHAPTER_CONFIGS: Record<ChapterNumber, ChapterConfig> = CHAPTER_LIST.reduce(
  (acc, cfg) => {
    acc[cfg.id] = cfg;
    return acc;
  },
  {} as Record<ChapterNumber, ChapterConfig>
);

export const TOTAL_CHAPTERS = CHAPTER_LIST.length;
export const FINAL_CHAPTER_ID = CHAPTER_LIST[CHAPTER_LIST.length - 1].id;
export const MASTER_TOTAL_CHAPTERS = 11;

export interface MasterChapterRoadmapEntry {
  id: number;
  title: string;
  hindiTitle: string;
  zoneLabel: string;
  playable: boolean;
}

/**
 * Full 11-Chapter Master Saga Roadmap across all 4 interconnected zones:
 * Zone 1 (Village Outskirts & Shapit Jungle), Zone 2 (Haveli Ground Floor),
 * Zone 3 (1st Floor — Upar Ki Manzil), and Zone 4 (Underground Tahkhana).
 * Chapters 1–7 are live and playable anytime; Chapters 8–11 are mapped for upcoming story expansions.
 */
export const MASTER_CAMPAIGN_ROADMAP: MasterChapterRoadmapEntry[] = [
  ...CHAPTER_LIST.map((ch) => ({
    id: ch.id,
    title: ch.title,
    hindiTitle: ch.hindiTitle,
    zoneLabel:
      ch.environment === 'outdoor'
        ? 'Village'
        : ch.environment === 'forest'
          ? 'Jungle'
          : 'Ground Floor',
    playable: true,
  })),
  {
    id: 8,
    title: 'Thakur Ka Pustakalaya',
    hindiTitle: 'ठाकुर का पुस्तकालय',
    zoneLabel: '1st Floor',
    playable: false,
  },
  {
    id: 9,
    title: 'Dulhan Ka Aaina',
    hindiTitle: 'दुल्हन का आईना',
    zoneLabel: '1st Floor',
    playable: false,
  },
  {
    id: 10,
    title: 'Tahkhane Ki Zanjeerein',
    hindiTitle: 'तहखाने की जंजीरें',
    zoneLabel: 'Tahkhana',
    playable: false,
  },
  {
    id: 11,
    title: 'Maha Tantrik Ka Ant',
    hindiTitle: 'महा तांत्रिक का अंत',
    zoneLabel: 'Tahkhana',
    playable: false,
  },
];

export function isValidChapterId(id: unknown): id is ChapterNumber {
  return typeof id === 'number' && Number.isInteger(id) && id in CHAPTER_INSTANCES;
}

export function getChapterModule(id: ChapterNumber): ChapterModule {
  return CHAPTER_INSTANCES[id] ?? CHAPTER_INSTANCES[1];
}

export function getNextChapterId(current: ChapterNumber): ChapterNumber | null {
  const idx = CHAPTER_LIST.findIndex((c) => c.id === current);
  if (idx < 0 || idx >= CHAPTER_LIST.length - 1) return null;
  return CHAPTER_LIST[idx + 1].id;
}
