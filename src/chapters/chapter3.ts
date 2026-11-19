import * as THREE from 'three';
import { ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { MinimapObjective } from '../game/types';

const _kundCenter = new THREE.Vector3(0, 0.72, 0);

/**
 * Chapter 3 (Shifted from original Chapter 2):
 * "1984 Ka Raaz" — Uncover all 4 1984 Diary Clues and decode Pandit ji's Mantra at the Havan Kund.
 */
export function createChapter3(): ChapterModule {
  let decoded = false;

  return {
    config: {
      id: 3,
      title: '1984 Ka Raaz',
      hindiTitle: '1984 का राज़',
      environment: 'haveli',
      shortTask: 'Read 4 Clues & Decode Mantra',
      taskLabel: 'Clues Decoded',
      targetCount: 5,
      ghostSpeedMult: 0.88,
      briefingIntro:
        'To break the curse, you must uncover what truly happened on that 1984 wedding night. Locate all 4 Hinglish diary clues and decode Pandit ji’s Mantra at the Havan Kund.',
      steps: [
        {
          heading: '1. Inspect All 4 1984 Lore Notes',
          detail:
            'Follow the parchment markers on your Spirit Map across the Aangan Veranda, Pooja Room, Master Bedroom, and Old Kitchen.',
        },
        {
          heading: '2. Avoid Her Growing Curiosity',
          detail:
            'Every diary clue you uncover stirs her memory. Watch her red radar cone — cut your flashlight when she patrols near your doorway.',
        },
        {
          heading: '3. Decode the Mantra at the Havan Kund',
          detail:
            'Once all 4 notes are read, return to the Central Aangan Havan Kund and press E / USE to unlock the secret of the Temple Bells.',
        },
      ],
      completionText:
        'Pandit ji’s final mantra clicks into place: only four sacred bells rung in exact harmony can wake the silent temple...',
    },

    getSpawn: () => ({ x: 0, z: 11.4, yaw: 0 }),

    reset: (ctx: ChapterRuntimeContext) => {
      decoded = false;
      ctx.world.configureForChapter(3);
    },

    update: (ctx: ChapterRuntimeContext, _dt: number, timeSec: number) => {
      for (const note of ctx.world.notes) {
        const mat = note.auraRing.material as THREE.MeshBasicMaterial;
        mat.opacity = note.read ? 0 : 0.28 + Math.sin(timeSec * 4.2 + note.position.x) * 0.14;
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      const distToKund = Math.hypot(ctx.playerPos.x, ctx.playerPos.z);
      const readCount = ctx.world.notes.filter((n) => n.read).length;
      if (readCount >= ctx.world.notes.length && !decoded && distToKund < 3.2) {
        decoded = true;
        ctx.triggerInteractImpulse(1.0);
        ctx.spawnBurst(_kundCenter, 0xffd268);
        ctx.audio.playHavanPlace(true);
        ctx.completeChapter();
        return true;
      }
      return false;
    },

    onNoteRead: (ctx: ChapterRuntimeContext, wasUnread: boolean, pos: THREE.Vector3) => {
      if (wasUnread) {
        ctx.resetProgressTimer();
        ctx.ghostAI.notifyNoise(pos, 14);
      }
    },

    getNotePromptBadge: (_ctx: ChapterRuntimeContext, read: boolean): string =>
      read ? '' : ' [CLUE]',

    getPrompt: (ctx: ChapterRuntimeContext): ChapterPrompt | null => {
      const distToKund = Math.hypot(ctx.playerPos.x, ctx.playerPos.z);
      if (distToKund < 3.2) {
        const readCount = ctx.world.notes.filter((n) => n.read).length;
        if (readCount >= ctx.world.notes.length) {
          return { text: 'Decode 1984 Mantra at Havan Kund', key: 'E' };
        }
        return { text: `Read all 4 1984 Clues first (${readCount}/4 Read)`, key: '' };
      }
      return null;
    },

    getProgress: (ctx: ChapterRuntimeContext): number =>
      ctx.world.notes.filter((n) => n.read).length + (decoded ? 1 : 0),

    getObjectiveText: (ctx: ChapterRuntimeContext): string => {
      const read = ctx.world.notes.filter((n) => n.read).length;
      if (read < ctx.world.notes.length) {
        return `Inspect 1984 Diary Clues across the Haveli (${read}/4 Read)`;
      }
      return 'Return to Central Havan Kund to decode Pandit ji’s Mantra';
    },

    getHint: (ctx: ChapterRuntimeContext): string | null => {
      const nextNote = ctx.world.notes.find((n) => !n.read);
      if (nextNote) return `An unread 1984 clue lies in the ${nextNote.data.room}...`;
      return 'All 4 clues found — return to the Central Aangan Havan Kund!';
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const out: MinimapObjective[] = [];
      const unread = ctx.world.notes.filter((n) => !n.read);
      if (unread.length > 0) {
        for (const n of unread) {
          out.push({
            id: n.data.id,
            x: n.position.x,
            z: n.position.z,
            label: 'Clue',
            kind: 'note',
          });
        }
      } else if (!decoded) {
        out.push({
          id: 'kund_decode',
          x: 0,
          z: 0,
          label: 'Havan Kund',
          kind: 'kund',
          urgent: true,
        });
      }
      return out;
    },

    isKundBeaconActive: (ctx: ChapterRuntimeContext): boolean =>
      ctx.world.notes.every((n) => n.read) && !decoded,
  };
}
