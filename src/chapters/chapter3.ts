import * as THREE from 'three';
import { ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { MinimapObjective } from '../game/types';

/**
 * Chapter 3 (Shifted untouched from previous Chapter 2 / original Chapter 1):
 * "Andhere Ki Shuruwat" — Light all 5 extinguished Shrine Diyas across the 1984 Haveli.
 */
export function createChapter3(): ChapterModule {
  return {
    config: {
      id: 3,
      title: 'Andhere Ki Shuruwat',
      hindiTitle: 'अंधेरे की शुरुआत',
      environment: 'haveli',
      shortTask: 'Light 5 Shrine Diyas',
      taskLabel: 'Shrine Diyas Lit',
      targetCount: 5,
      ghostSpeedMult: 0.78,
      briefingIntro:
        'With the Aghori Gatekeeper vanquished, you have stepped inside the cursed 1984 Haveli courtyard. Before any ritual can begin, light all 5 sacred Shrine Diyas hidden across the rooms.',
      steps: [
        {
          heading: '1. Find 5 Unlit Shrine Diyas',
          detail:
            'Explore the Aangan, Pooja Room, Master Bedroom, Old Kitchen, and Back Store Room. Each unlit brass diya glows with a subtle golden floor ring.',
        },
        {
          heading: '2. Read Your Live Spirit Map',
          detail:
            'Keep an eye on the top-right Haveli Blueprint! Golden flame markers show unlit Diyas, and the pulsing crimson spirit marker tracks her exact room.',
        },
        {
          heading: '3. Hide Inside Almirahs or Behind Cover',
          detail:
            'She moves calmly in Chapter 3, giving you time to learn the Haveli layout. Toggle Torch OFF (F) and crouch/prone or slip inside a Wooden Almirah whenever payal chimes grow loud.',
        },
      ],
      completionText:
        'All 5 Shrine Diyas burn warm across the dark corridors. The shadows recoil — revealing the forgotten 1984 diaries...',
    },

    getSpawn: () => ({ x: 0, z: 11.4, yaw: 0 }),

    reset: (ctx: ChapterRuntimeContext) => {
      ctx.world.configureForChapter(3);
    },

    update: (ctx: ChapterRuntimeContext, _dt: number, timeSec: number) => {
      for (const diya of ctx.world.shrineDiyas) {
        const mat = diya.auraRing.material as THREE.MeshBasicMaterial;
        if (diya.lit) {
          mat.opacity = 0;
          const flick = 0.85 + Math.sin(timeSec * 15 + diya.position.x) * 0.2;
          diya.flameMesh.scale.set(1, flick, 1);
          if (diya.light) diya.light.intensity = 1.8 * flick;
        } else {
          mat.opacity = 0.26 + Math.sin(timeSec * 3.8 + diya.position.z) * 0.14;
        }
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      for (const diya of ctx.world.shrineDiyas) {
        if (diya.lit) continue;
        const d = Math.hypot(
          ctx.playerPos.x - diya.position.x,
          ctx.playerPos.z - diya.position.z
        );
        if (d < 2.45) {
          diya.lit = true;
          diya.flameMesh.visible = true;
          if (diya.light) diya.light.intensity = 1.9;
          ctx.resetProgressTimer();
          ctx.triggerInteractImpulse(0.85);
          ctx.spawnBurst(diya.position, 0xffb84d);
          ctx.audio.playHavanPlace(false);

          const litCount = ctx.world.shrineDiyas.filter((x) => x.lit).length;
          if (litCount === 3) {
            ctx.audio.speakGhostLine('patrol', true);
          }
          if (litCount >= ctx.world.shrineDiyas.length) {
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
      for (const diya of ctx.world.shrineDiyas) {
        if (diya.lit) continue;
        if (
          Math.hypot(ctx.playerPos.x - diya.position.x, ctx.playerPos.z - diya.position.z) < 2.45
        ) {
          return { text: `Light Shrine Diya (${diya.room})`, key: 'E' };
        }
      }
      return null;
    },

    getProgress: (ctx: ChapterRuntimeContext): number =>
      ctx.world.shrineDiyas.filter((d) => d.lit).length,

    getObjectiveText: (ctx: ChapterRuntimeContext): string => {
      const lit = ctx.world.shrineDiyas.filter((d) => d.lit).length;
      const rem = ctx.world.shrineDiyas.length - lit;
      return `Light ${rem} Extinguished Shrine ${rem === 1 ? 'Diya' : 'Diyas'} (${lit}/5)`;
    },

    getHint: (ctx: ChapterRuntimeContext): string | null => {
      const nextDiya = ctx.world.shrineDiyas.find((d) => !d.lit);
      return nextDiya ? `An unlit Shrine Diya awaits in the ${nextDiya.room}...` : null;
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const out: MinimapObjective[] = [];
      for (const d of ctx.world.shrineDiyas) {
        if (!d.lit) {
          out.push({ id: d.id, x: d.position.x, z: d.position.z, label: 'Diya', kind: 'diya' });
        }
      }
      return out;
    },
  };
}
