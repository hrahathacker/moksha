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
