import * as THREE from 'three';
import { ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { MinimapObjective } from '../game/types';

/**
 * Chapter 5 (Shifted untouched from previous Chapter 4 / original Chapter 3):
 * "Mandir Ki Ghantiyan" — Ring 4 hanging brass temple bells in exact ritual sequence.
 */
export function createChapter5(): ChapterModule {
  let nextBellIndex = 0;

  return {
    config: {
      id: 5,
      title: 'Mandir Ki Ghantiyan',
      hindiTitle: 'मंदिर की घंटियाँ',
      environment: 'haveli',
      shortTask: 'Ring 4 Bells in Order',
      taskLabel: 'Sacred Bells Rung',
      targetCount: 4,
      ghostSpeedMult: 0.95,
      briefingIntro:
        'Four hanging brass Temple Bells must be rung in exact ritual order — Pooja Room → Master Bedroom → Old Kitchen → Back Store Room. Each loud chime draws the spirit toward the sound!',
      steps: [
        {
          heading: '1. Follow the Active Bell Marker',
          detail:
            'Your live Spirit Map highlights the exact next bell in bright gold. Ringing out of order will not count.',
        },
        {
          heading: '2. Ring & Vanish Immediately',
          detail:
            'The moment a brass bell tolls, the spirit rushes toward that room to investigate. Sprint to the nearest Almirah or slip silently around the courtyard pillars.',
        },
        {
          heading: '3. Complete All 4 Resonances',
          detail:
            'Once the fourth bell resonates in the Back Store Room, the ancient crimson seals guarding the ritual will become visible.',
        },
      ],
      completionText:
        'The fourth brass bell echoes into the midnight sky. Cracks of red light split open across the walls — the Tantrik seals are exposed!',
    },

    getSpawn: () => ({ x: 0, z: 11.4, yaw: 0 }),

    reset: (ctx: ChapterRuntimeContext) => {
      nextBellIndex = 0;
      ctx.world.configureForChapter(5);
    },

    update: (ctx: ChapterRuntimeContext, dt: number, timeSec: number) => {
      for (const bell of ctx.world.chapterBells) {
        if (Math.abs(bell.swingVelocity) > 0.01 || Math.abs(bell.swingAngle) > 0.005) {
          bell.swingVelocity -= bell.swingAngle * 14 * dt;
          bell.swingVelocity *= Math.pow(0.28, dt);
          bell.swingAngle += bell.swingVelocity * dt;
          bell.bellPivot.rotation.z = bell.swingAngle;
        }
        const mat = bell.auraRing.material as THREE.MeshBasicMaterial;
        if (bell.rung) {
          mat.opacity = 0;
        } else if (bell.orderIndex === nextBellIndex) {
          mat.color.setHex(0xffc857);
          mat.opacity = 0.42 + Math.sin(timeSec * 5.2) * 0.18;
        } else {
          mat.color.setHex(0x6c8c94);
          mat.opacity = 0.12;
        }
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      for (const bell of ctx.world.chapterBells) {
        if (bell.rung) continue;
        const d = Math.hypot(
          ctx.playerPos.x - bell.position.x,
          ctx.playerPos.z - bell.position.z
        );
        if (d < 2.65) {
          if (bell.orderIndex === nextBellIndex) {
            bell.rung = true;
            bell.swingVelocity = 4.2;
            nextBellIndex += 1;
            ctx.resetProgressTimer();
            ctx.triggerInteractImpulse(0.95);
            ctx.spawnBurst(bell.position, 0xffe082);
            ctx.audio.playTempleBell(1.0);
            ctx.ghostAI.notifyNoise(bell.position, 24);
            if (nextBellIndex === 2) {
              ctx.audio.speakGhostLine('near', true);
            }
            if (nextBellIndex >= ctx.world.chapterBells.length) {
              ctx.completeChapter();
            } else {
              ctx.emitHud();
            }
            return true;
          } else {
            ctx.audio.playFlashlightClick();
            ctx.emitHud();
            return true;
          }
        }
      }
      return false;
    },

    getPrompt: (ctx: ChapterRuntimeContext): ChapterPrompt | null => {
      for (const bell of ctx.world.chapterBells) {
        if (bell.rung) continue;
        if (
          Math.hypot(ctx.playerPos.x - bell.position.x, ctx.playerPos.z - bell.position.z) < 2.65
        ) {
          if (bell.orderIndex === nextBellIndex) {
            return { text: `Ring ${bell.label}`, key: 'E' };
          }
          const nextBell = ctx.world.chapterBells[nextBellIndex];
          return {
            text: `Wrong order — Ring ${nextBell?.label ?? 'next bell'} first!`,
            key: '',
          };
        }
      }
      return null;
    },

    getProgress: (): number => nextBellIndex,

    getObjectiveText: (ctx: ChapterRuntimeContext): string => {
      const nextBell = ctx.world.chapterBells[nextBellIndex];
      return nextBell
        ? `Ring ${nextBell.label} (${nextBellIndex}/4)`
        : 'All Sacred Bells Rung!';
    },

    getHint: (ctx: ChapterRuntimeContext): string | null => {
      const nextBell = ctx.world.chapterBells[nextBellIndex];
      return nextBell ? `Ring the next hanging brass bell in the ${nextBell.room}...` : null;
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const out: MinimapObjective[] = [];
      const nextBell = ctx.world.chapterBells[nextBellIndex];
      if (nextBell) {
        out.push({
          id: nextBell.id,
          x: nextBell.position.x,
          z: nextBell.position.z,
          label: `Bell ${nextBell.orderIndex + 1}`,
          kind: 'bell',
          urgent: true,
        });
      }
      return out;
    },
  };
}
