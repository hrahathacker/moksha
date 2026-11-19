import * as THREE from 'three';
import { ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { MinimapObjective, RITUAL_ITEMS, RitualItemId } from '../game/types';

const _kundCenter = new THREE.Vector3(0, 0.72, 0);

/**
 * Chapter 6 (Shifted from original Chapter 5):
 * "Aakhiri Havan — MOKSHA" — Gather 4 sacred ritual items, ignite the Havan Kund, and witness Moksha Geet.
 */
export function createChapter6(): ChapterModule {
  return {
    config: {
      id: 6,
      title: 'Aakhiri Havan — MOKSHA',
      hindiTitle: 'आख़िरी हवन — मोक्ष',
      environment: 'haveli',
      shortTask: 'Offer 4 Sacred Items & Survive',
      taskLabel: 'Sacred Items Offered',
      targetCount: 4,
      ghostSpeedMult: 1.08,
      briefingIntro:
        'The final night of the 1984 curse. Collect all 4 Sacred Ritual Items one by one, offer them to the Central Aangan Havan Kund, and survive the blazing climax to grant her Moksha!',
      steps: [
        {
          heading: '1. Gather 4 Sacred Ritual Items',
          detail:
            'Find Brass Kalash (Pooja Room), Red Chunri (Master Bedroom), Akhand Diya (Old Kitchen), and Havan Samagri (Back Store Room). Carry one at a time back to the Central Havan Kund.',
        },
        {
          heading: '2. Outsmart Her With Live Map & Almirahs',
          detail:
            'Use your Spirit Map to slip past her patrol path. If her red gaze locks on you, sprint around a pillar, turn Torch OFF (F), and hide inside an Almirah or crawl under furniture.',
        },
        {
          heading: '3. Survive the Final Havan & Witness Moksha',
          detail:
            'Offering the 4th item ignites the Havan Agni. Survive the final countdown to break the 1984 curse forever and hear the bride’s haunting Moksha Geet finale.',
        },
      ],
      completionText:
        'Agni rises to the heavens. The red bride ascends in golden light — Atma ko Shanti Mili!',
    },

    getSpawn: () => ({ x: 0, z: 11.4, yaw: 0 }),

    reset: (ctx: ChapterRuntimeContext) => {
      ctx.world.configureForChapter(6);
    },

    update: (ctx: ChapterRuntimeContext, _dt: number, timeSec: number) => {
      let nearestUncollectedId: RitualItemId | null = null;
      let nearestUncollectedDist = Infinity;
      for (const item of ctx.world.ritualItems) {
        if (item.flameMesh) {
          const s = 0.85 + Math.sin(timeSec * 16) * 0.18;
          item.flameMesh.scale.set(1, s, 1);
        }
        if (!item.collected) {
          item.group.position.y =
            item.position.y + Math.sin(timeSec * 2.6 + item.position.x) * 0.032;
          item.group.rotation.y = timeSec * 0.55;
          const d = Math.hypot(
            ctx.playerPos.x - item.position.x,
            ctx.playerPos.z - item.position.z
          );
          if (d < nearestUncollectedDist) {
            nearestUncollectedDist = d;
            nearestUncollectedId = item.id;
          }
        }
      }
      for (const item of ctx.world.ritualItems) {
        const mat = item.auraRing.material as THREE.MeshBasicMaterial;
        const shouldGlow =
          !item.collected &&
          ((ctx.hintActive && item.id === nearestUncollectedId) ||
            nearestUncollectedDist < 4.5 ||
            ctx.difficulty === 'normal');
        const baseOp = ctx.hintActive && item.id === nearestUncollectedId ? 0.36 : 0.14;
        mat.opacity = shouldGlow ? baseOp + Math.sin(timeSec * 3.8) * 0.12 : 0;
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      const distToKund = Math.hypot(ctx.playerPos.x, ctx.playerPos.z);

      if (ctx.holdingItem && distToKund < 3.1) {
        const id = ctx.holdingItem;
        ctx.setHoldingItem(null);
        ctx.addPlacedItem(id);
        const worldItem = ctx.world.ritualItems.find((r) => r.id === id);
        if (worldItem) worldItem.placed = true;
        ctx.world.havanKund.itemSlots[id].visible = true;
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.95);
        ctx.spawnBurst(_kundCenter, 0xffae38);

        const isFinal = ctx.placedItems.length >= 4;
        ctx.audio.playHavanPlace(isFinal);

        if (isFinal) {
          ctx.startClimax();
        } else if (ctx.placedItems.length === 2) {
          ctx.audio.speakGhostLine('ritual');
        }
        ctx.emitHud();
        return true;
      }

      if (!ctx.holdingItem) {
        for (const item of ctx.world.ritualItems) {
          if (item.collected) continue;
          const d = Math.hypot(
            ctx.playerPos.x - item.position.x,
            ctx.playerPos.z - item.position.z
          );
          if (d < 2.35) {
            item.collected = true;
            item.group.visible = false;
            ctx.setHoldingItem(item.id);
            ctx.resetProgressTimer();
            ctx.triggerInteractImpulse(0.92);
            ctx.spawnBurst(item.position, 0xffd268);
            ctx.audio.playItemPickup();
            ctx.emitHud();
            return true;
          }
        }
      }

      return false;
    },

    getPrompt: (ctx: ChapterRuntimeContext): ChapterPrompt | null => {
      const distToKund = Math.hypot(ctx.playerPos.x, ctx.playerPos.z);
      if (distToKund < 3.1) {
        if (ctx.holdingItem) {
          return {
            text: `Offer ${RITUAL_ITEMS[ctx.holdingItem].name} to Havan Kund`,
            key: 'E',
          };
        }
        if (ctx.placedItems.length < 4) {
          return {
            text: `Havan Kund (${ctx.placedItems.length}/4 Sacred Items Placed)`,
            key: '',
          };
        }
      }

      for (const item of ctx.world.ritualItems) {
        if (item.collected) continue;
        if (
          Math.hypot(ctx.playerPos.x - item.position.x, ctx.playerPos.z - item.position.z) < 2.35
        ) {
          if (ctx.holdingItem) {
            return {
              text: 'Offer held item to the Courtyard Havan Kund first',
              key: '',
            };
          }
          return { text: `Collect ${RITUAL_ITEMS[item.id].name}`, key: 'E' };
        }
      }

      return null;
    },

    getProgress: (ctx: ChapterRuntimeContext): number => ctx.placedItems.length,

    getObjectiveText: (ctx: ChapterRuntimeContext): string => {
      if (ctx.holdingItem) {
        return `Offer ${RITUAL_ITEMS[ctx.holdingItem].name} to the Courtyard Havan Kund`;
      }
      const remaining = 4 - ctx.placedItems.length;
      return `Find ${remaining} Sacred Ritual ${remaining === 1 ? 'Item' : 'Items'} (${ctx.placedItems.length}/4 Placed)`;
    },

    getHint: (ctx: ChapterRuntimeContext): string | null => {
      if (ctx.holdingItem) {
        return 'Temple bell echoes from the Central Aangan — return to the Havan Kund.';
      }
      const uncollected = ctx.world.ritualItems.find((r) => !r.collected);
      if (!uncollected) return null;
      return `A faint temple bell chimes from the ${uncollected.room}...`;
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const out: MinimapObjective[] = [];
      if (ctx.holdingItem) {
        out.push({
          id: 'kund_offer',
          x: 0,
          z: 0,
          label: 'Havan Kund',
          kind: 'kund',
          urgent: true,
        });
      } else {
        for (const item of ctx.world.ritualItems) {
          if (!item.collected) {
            out.push({
              id: item.id,
              x: item.position.x,
              z: item.position.z,
              label: RITUAL_ITEMS[item.id].name,
              kind: 'item',
            });
          }
        }
      }
      return out;
    },

    isKundBeaconActive: (ctx: ChapterRuntimeContext): boolean =>
      ctx.holdingItem !== null || (ctx.hintActive && ctx.placedItems.length < 4),
  };
}
