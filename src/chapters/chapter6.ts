import * as THREE from 'three';
import { ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { MinimapObjective } from '../game/types';

/**
 * Chapter 6 (Shifted untouched from previous Chapter 5 / original Chapter 4):
 * "Bandhan Todna" — Find and shatter all 4 cursed crimson Tantrik seals across the Haveli.
 */
export function createChapter6(): ChapterModule {
  return {
    config: {
      id: 6,
      title: 'Bandhan Todna',
      hindiTitle: 'बंधन तोड़ना',
      environment: 'haveli',
      shortTask: 'Shatter 4 Cursed Seals',
      taskLabel: 'Cursed Seals Broken',
      targetCount: 4,
      ghostSpeedMult: 1.04,
      briefingIntro:
        'Four crimson Tantrik seals bind the bride’s spirit inside the Haveli walls. Shatter every pulsing seal — but beware, breaking each seal enrages her and reveals your position!',
      steps: [
        {
          heading: '1. Locate 4 Pulsing Crimson Seals',
          detail:
            'Look for floating red Tantrik talismans in the Pooja Room, Master Bedroom, Old Kitchen, and Back Store Room (marked in crimson on your Spirit Map).',
        },
        {
          heading: '2. Shatter & Sprint to Cover',
          detail:
            'Press E / USE to break a seal. She will scream and immediately surge toward the room — have your escape route to the closest Almirah ready!',
        },
        {
          heading: '3. Free the Path to the Final Havan',
          detail:
            'Once all 4 cursed bindings shatter, the sacred ritual items can finally be gathered for the Chapter 7 Moksha finale.',
        },
      ],
      completionText:
        'The last crimson binding turns to ash! The bride whispers in longing: "Mujhe mukti chahiye..." — only the Final Havan remains.',
    },

    getSpawn: () => ({ x: 0, z: 11.4, yaw: 0 }),

    reset: (ctx: ChapterRuntimeContext) => {
      ctx.world.configureForChapter(6);
    },

    update: (ctx: ChapterRuntimeContext, _dt: number, timeSec: number) => {
      for (const seal of ctx.world.cursedSeals) {
        const mat = seal.auraRing.material as THREE.MeshBasicMaterial;
        if (seal.broken) {
          mat.opacity = 0;
        } else {
          seal.talismanMesh.rotation.y = timeSec * 1.8;
          seal.talismanMesh.position.y = 1.62 + Math.sin(timeSec * 3.2 + seal.position.x) * 0.08;
          mat.opacity = 0.32 + Math.sin(timeSec * 4.8) * 0.16;
          if (seal.light) {
            seal.light.intensity = 1.55 + Math.sin(timeSec * 7 + seal.position.z) * 0.35;
          }
        }
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      for (const seal of ctx.world.cursedSeals) {
        if (seal.broken) continue;
        const d = Math.hypot(
          ctx.playerPos.x - seal.position.x,
          ctx.playerPos.z - seal.position.z
        );
        if (d < 2.55) {
          seal.broken = true;
          seal.talismanMesh.visible = false;
          if (seal.light) seal.light.intensity = 0;
          ctx.resetProgressTimer();
          ctx.triggerInteractImpulse(1.0);
          ctx.spawnBurst(seal.position, 0xff4450);
          ctx.audio.playHavanPlace(true);
          ctx.audio.speakGhostLine('ritual', true);
          ctx.ghostAI.notifyNoise(seal.position, 26);

          const brokenCount = ctx.world.cursedSeals.filter((x) => x.broken).length;
          if (brokenCount >= ctx.world.cursedSeals.length) {
            ctx.completeChapter();
          } else {
            ctx.emitHud();
          }
          return true;
        }
      }
      return false;
    },

    getPrompt: (ctx: ChapterRuntimeContext): ChapterPrompt | null => {
      for (const seal of ctx.world.cursedSeals) {
        if (seal.broken) continue;
        if (
          Math.hypot(ctx.playerPos.x - seal.position.x, ctx.playerPos.z - seal.position.z) < 2.55
        ) {
          return { text: `Shatter Cursed Tantrik Seal (${seal.room})`, key: 'E' };
        }
      }
      return null;
    },

    getProgress: (ctx: ChapterRuntimeContext): number =>
      ctx.world.cursedSeals.filter((s) => s.broken).length,

    getObjectiveText: (ctx: ChapterRuntimeContext): string => {
      const broken = ctx.world.cursedSeals.filter((s) => s.broken).length;
      return `Find & Shatter Crimson Cursed Seals (${broken}/4 Broken)`;
    },

    getHint: (ctx: ChapterRuntimeContext): string | null => {
      const nextSeal = ctx.world.cursedSeals.find((s) => !s.broken);
      return nextSeal ? `A crimson Tantrik seal pulses inside the ${nextSeal.room}...` : null;
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const out: MinimapObjective[] = [];
      for (const s of ctx.world.cursedSeals) {
        if (!s.broken) {
          out.push({
            id: s.id,
            x: s.position.x,
            z: s.position.z,
            label: 'Seal',
            kind: 'seal',
            urgent: true,
          });
        }
      }
      return out;
    },
  };
}
