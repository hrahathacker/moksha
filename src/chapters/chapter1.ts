import * as THREE from 'three';
import { ChapterCheckpoint, ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { MinimapObjective } from '../game/types';

type Chapter1Step =
  | 'hear_bark_turn'
  | 'follow_paws'
  | 'get_biscuit'
  | 'feed_dog'
  | 'follow_dog_well'
  | 'get_pulley'
  | 'install_pulley'
  | 'draw_water'
  | 'drink_water'
  | 'water_dog'
  | 'water_tulsi'
  | 'rest_veranda'
  | 'lying_poke'
  | 'inspect_key'
  | 'gate_pan';

type DogMode = 'whimper' | 'happy_wait' | 'trot_to_well' | 'wait_well' | 'trot_to_tulsi' | 'sit_tulsi';

const CHECKPOINTS: Record<
  'start' | 'dog_found' | 'biscuit_collected' | 'pulley_fixed' | 'tulsi_watered',
  ChapterCheckpoint
> = {
  start: { id: 'start', label: 'Village Path Start', x: 0, z: 25.0, yaw: 0 },
  dog_found: { id: 'dog_found', label: 'Ruined Hut · Dog Found', x: -9.5, z: 12.6, yaw: 0.65 },
  biscuit_collected: {
    id: 'biscuit_collected',
    label: 'Tea-Stall · Biscuit Found',
    x: -11.8,
    z: 8.8,
    yaw: -0.35,
  },
  pulley_fixed: { id: 'pulley_fixed', label: 'Stone Well · Pulley Fixed', x: 5.5, z: 4.8, yaw: -1.2 },
  tulsi_watered: { id: 'tulsi_watered', label: 'Tulsi Veranda · Blessed', x: 2.6, z: -7.8, yaw: 0.4 },
};

const DOG_WELL_WAYPOINTS: Array<{ x: number; z: number }> = [
  { x: -7.2, z: 10.6 },
  { x: -2.0, z: 8.5 },
  { x: 3.2, z: 6.2 },
  { x: 6.1, z: 4.5 },
];

const DOG_TULSI_WAYPOINTS: Array<{ x: number; z: number }> = [
  { x: 5.8, z: -1.2 },
  { x: 4.6, z: -5.5 },
  { x: 3.2, z: -7.1 },
];

// Reusable zero-GC vectors for smooth camera cinematics & hazard pushback
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _panStartPos = new THREE.Vector3();
const _panStartLook = new THREE.Vector3();
const _panEndPos = new THREE.Vector3(0, 2.35, -13.4);
const _panEndLook = new THREE.Vector3(0, 2.65, -21.8);

function normalizeAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

/**
 * Chapter 1 (Brand-New Outdoor Prologue):
 * "Anjaan Gaon aur Rahasyamayi Chaabhi" — Misty village outskirts, loyal street dog companion,
 * thorn & black scorpion hazards with checkpoints, stone well pulley puzzle, Tulsi ritual,
 * protagonist Hindi voice acting, stone veranda poke, and Iron Haveli Key discovery.
 */
export function createChapter1(): ChapterModule {
  let step: Chapter1Step = 'hear_bark_turn';
  let dogMode: DogMode = 'whimper';
  let dogWaypointIdx = 0;
  let barkPlayed = false;
  let whimperTimer = 2.4;
  let bucketDrawing = false;
  let bucketProgress = 0;
  let stepTimer = 0;
  let pokeTriggered = false;
  let gateBellPlayed = false;
  let completedFired = false;

  const setAuraOpacity = (mesh: THREE.Mesh, opacity: number) => {
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  };

  const getStepMilestoneCount = (): number => {
    switch (step) {
      case 'hear_bark_turn':
        return 0;
      case 'follow_paws':
        return 1;
      case 'get_biscuit':
      case 'feed_dog':
        return 2;
      case 'follow_dog_well':
      case 'get_pulley':
      case 'install_pulley':
      case 'draw_water':
        return 3;
      case 'drink_water':
      case 'water_dog':
      case 'water_tulsi':
        return 4;
      case 'rest_veranda':
      case 'lying_poke':
        return 5;
      case 'inspect_key':
      case 'gate_pan':
        return 6;
    }
  };

  return {
    config: {
      id: 1,
      title: 'Anjaan Gaon aur Rahasyamayi Chaabhi',
      hindiTitle: 'अनजान गाँव और रहस्यमयी चाभी',
      environment: 'outdoor',
      shortTask: 'Find the Haveli Key',
      taskLabel: 'Trail Milestones',
      targetCount: 6,
      ghostSpeedMult: 0.7,
      briefingIntro:
        'Stranded at midnight on the misty outskirts of an abandoned village, you hear a sudden dog bark behind you. Survive thorny brambles and venomous black scorpions, earn a stray dog’s trust, and uncover the hidden key to the looming Haveli gate.',
      steps: [
        {
          heading: '1. Turn Around & Follow the Paw Prints',
          detail:
            'Listen for the stray dog barking behind you. Turn around to spot glowing muddy paw prints leading through the misty groves toward a ruined hut.',
        },
        {
          heading: '2. Jump Over Thorns & Black Scorpions',
          detail:
            'Use JUMP (Space / Jump Button) to clear sharp thorny bushes and scuttling Black Scorpions. Automatic checkpoints save your progress so you can revive safely if injured.',
        },
        {
          heading: '3. Help the Dog, Fix the Well & Rest at Tulsi',
          detail:
            'Feed the hungry dog from the ruined tea-stall, restore the missing pulley on the ancient stone well, water the sacred Tulsi plant, and rest on the veranda to uncover the Iron Haveli Key.',
        },
      ],
      completionText:
        'The rusted Iron Haveli Key rests cold in your palm. Ahead in the mist, the iron gates of the 1984 Haveli await...',
    },

    getSpawn: () => ({ x: CHECKPOINTS.start.x, z: CHECKPOINTS.start.z, yaw: CHECKPOINTS.start.yaw }),

    isMovementLocked: () => step === 'lying_poke' || step === 'gate_pan',

    reset: (ctx: ChapterRuntimeContext) => {
      step = 'hear_bark_turn';
      dogMode = 'whimper';
      dogWaypointIdx = 0;
      barkPlayed = false;
      whimperTimer = 2.6;
      bucketDrawing = false;
      bucketProgress = 0;
      stepTimer = 0;
      pokeTriggered = false;
      gateBellPlayed = false;
      completedFired = false;

      const ow = ctx.outdoorWorld;
      ow.pawPrintGroup.visible = false;
      ow.biscuitGroup.visible = true;
      ow.pulleyPickupGroup.visible = true;
      ow.wellInstalledPulley.visible = false;
      ow.wellRopeMesh.visible = false;
      ow.wellBucketGroup.visible = false;
      ow.wellBucketGroup.position.y = 0.42;
      ow.haveliKeyGroup.visible = false;
      (ow.tulsiWaterGlow.material as THREE.MeshBasicMaterial).opacity = 0;

      // Reset street dog beside Ruined Hut
      ow.dog.position.set(-10.6, 0, 11.4);
      ow.dog.yaw = 0.7;
      ow.dog.root.position.copy(ow.dog.position);
      ow.dog.root.rotation.y = ow.dog.yaw;

      setAuraOpacity(ow.dog.auraRing, 0);
      setAuraOpacity(ow.biscuitAura, 0);
      setAuraOpacity(ow.pulleyPickupAura, 0);
      setAuraOpacity(ow.wellAura, 0);
      setAuraOpacity(ow.tulsiAura, 0);
      setAuraOpacity(ow.verandaAura, 0);
      setAuraOpacity(ow.haveliKeyAura, 0);

      ctx.clearCameraOverride();
      ctx.setCheckpoint(CHECKPOINTS.start, false);
    },

    update: (ctx: ChapterRuntimeContext, dt: number, timeSec: number) => {
      const ow = ctx.outdoorWorld;
      const pulse = 0.3 + Math.sin(timeSec * 4.4) * 0.16;

      // 1. Update outdoor ambient lanterns, scuttling scorpions, pickups & well bucket
      if (bucketDrawing) {
        bucketProgress = Math.min(1, bucketProgress + dt * 0.52);
        if (bucketProgress >= 0.99 && step === 'draw_water') {
          bucketDrawing = false;
          step = 'drink_water';
          ctx.resetProgressTimer();
          ctx.emitHud();
        }
      }
      ow.updateVisuals(dt, timeSec, bucketProgress);

      // 2. Update active objective floor aura rings
      setAuraOpacity(ow.dog.auraRing, step === 'feed_dog' || step === 'water_dog' ? pulse + 0.1 : 0);
      setAuraOpacity(ow.biscuitAura, step === 'get_biscuit' ? pulse + 0.12 : 0);
      setAuraOpacity(ow.pulleyPickupAura, step === 'get_pulley' ? pulse + 0.12 : 0);
      setAuraOpacity(
        ow.wellAura,
        step === 'follow_dog_well' ||
          step === 'install_pulley' ||
          (step === 'draw_water' && !bucketDrawing) ||
          step === 'drink_water'
          ? pulse + 0.1
          : 0
      );
      setAuraOpacity(ow.tulsiAura, step === 'water_tulsi' ? pulse + 0.15 : 0);
      setAuraOpacity(ow.verandaAura, step === 'rest_veranda' ? pulse + 0.15 : 0);
      setAuraOpacity(ow.haveliKeyAura, step === 'inspect_key' ? pulse + 0.2 : 0);

      // 3. Step 1: Initial dog bark & turning around to reveal muddy paw prints
      if (step === 'hear_bark_turn') {
        stepTimer += dt;
        if (!barkPlayed && stepTimer >= 1.1) {
          barkPlayed = true;
          ctx.audio.playDogBark(false, true);
          ctx.emitHud();
        }
        const angleToBehind = Math.abs(normalizeAngle(ctx.playerYaw - Math.PI));
        const turnedAround = barkPlayed && (angleToBehind < 1.25 || ctx.playerPos.z > 25.55 || stepTimer > 6.8);
        if (turnedAround) {
          ow.pawPrintGroup.visible = true;
          step = 'follow_paws';
          stepTimer = 0;
          ctx.resetProgressTimer();
          ctx.audio.playDogBark(false, false);
          ctx.emitHud();
        }
      }

      // 4. Step 2 arrival check: approaching the hungry dog near the Ruined Hut
      if (step === 'follow_paws') {
        const distToDog = Math.hypot(
          ctx.playerPos.x - ow.dog.position.x,
          ctx.playerPos.z - ow.dog.position.z
        );
        if (distToDog < 4.4) {
          step = 'get_biscuit';
          ctx.resetProgressTimer();
          ctx.audio.playDogWhimper();
          ctx.setCheckpoint(CHECKPOINTS.dog_found, true);
          ctx.emitHud();
        }
      }

      // 5. Step 3 arrival check: approaching the Stone Well after dog guides player
      if (step === 'follow_dog_well') {
        const distToWell = Math.hypot(
          ctx.playerPos.x - ow.wellPos.x,
          ctx.playerPos.z - ow.wellPos.z
        );
        if (distToWell < 4.6) {
          step = 'get_pulley';
          ctx.resetProgressTimer();
          ctx.audio.playDogBark(false, false);
          ctx.emitHud();
        }
      }

      // 6. Step 6a: Smooth lie-down on stone veranda -> sharp metallic poke -> Hindi dialogue -> stand up
      if (step === 'lying_poke') {
        stepTimer += dt;
        // Gently settle onto the stone veranda and look slightly upward into the misty night sky
        const settleT = Math.min(1, stepTimer / 0.8);
        const camY = THREE.MathUtils.lerp(0.68, 0.44, settleT);
        _camPos.set(ow.verandaRestPos.x, camY, ow.verandaRestPos.z + 0.15);
        _camLook.set(ow.verandaRestPos.x + 0.15, 1.35 + settleT * 0.85, ow.verandaRestPos.z - 2.6);

        if (!pokeTriggered && stepTimer >= 1.55) {
          pokeTriggered = true;
          ctx.audio.playKeyPoke();
          ctx.triggerCameraJolt(0.18, 0.13);
          ctx.audio.speakProtagonistLine(
            'अरे! ये पीठ में क्या चुभ रहा है?',
            'Arre! Ye peeth mein kya chubh raha hai?',
            3800
          );
          ow.haveliKeyGroup.visible = true;
          ctx.spawnBurst(ow.haveliKeyPos, 0xffdc7a);
        }

        if (pokeTriggered) {
          // Brief sharp jolt toward the gleaming key spot before standing back up
          const jolt = Math.max(0, 1 - (stepTimer - 1.55) * 3.5);
          _camPos.y += Math.sin(stepTimer * 48) * 0.04 * jolt;
          _camLook.lerp(ow.haveliKeyPos, Math.min(1, (stepTimer - 1.55) / 0.5));
        }

        ctx.setCameraOverride(_camPos, _camLook);

        if (stepTimer >= 2.55) {
          ctx.clearCameraOverride();
          ctx.forceStance('standing');
          ctx.setPlayerPose(1.5, -7.55, 0.08, -0.34);
          step = 'inspect_key';
          stepTimer = 0;
          ctx.resetProgressTimer();
          ctx.emitHud();
        }
      }

      // 7. Step 6b: 3.6s Cinematic Camera Pan toward the looming Haveli Main Gate -> Chapter 1 Complete!
      if (step === 'gate_pan') {
        stepTimer += dt;
        if (!gateBellPlayed && stepTimer >= 0.35) {
          gateBellPlayed = true;
          ctx.audio.playTempleBell(0.78);
        }
        const rawT = Math.min(1, stepTimer / 3.5);
        // Smooth ease-in-out cubic curve
        const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
        _camPos.lerpVectors(_panStartPos, _panEndPos, ease);
        _camPos.y += Math.sin(ease * Math.PI) * 0.25;
        _camLook.lerpVectors(_panStartLook, _panEndLook, ease);
        ctx.setCameraOverride(_camPos, _camLook);

        if (stepTimer >= 3.6 && !completedFired) {
          completedFired = true;
          ctx.clearCameraOverride();
          ctx.completeChapter();
          return;
        }
      }

      // 8. Animate 3D Street Dog Companion AI (whimper -> happy wag -> trot to well -> sit by Tulsi)
      const dog = ow.dog;
      let dogSpeed = 0;
      if (dogMode === 'trot_to_well' || dogMode === 'trot_to_tulsi') {
        const path = dogMode === 'trot_to_well' ? DOG_WELL_WAYPOINTS : DOG_TULSI_WAYPOINTS;
        const target = path[Math.min(dogWaypointIdx, path.length - 1)];
        const dx = target.x - dog.position.x;
        const dz = target.z - dog.position.z;
        const dist = Math.hypot(dx, dz);
        // Keep dog waiting kindly if player lags far behind during well escort
        const distToPlayer = Math.hypot(
          ctx.playerPos.x - dog.position.x,
          ctx.playerPos.z - dog.position.z
        );
        const shouldWaitForPlayer = dogMode === 'trot_to_well' && distToPlayer > 9.5;

        if (dist < 0.45) {
          if (dogWaypointIdx < path.length - 1) {
            dogWaypointIdx += 1;
          } else {
            dogMode = dogMode === 'trot_to_well' ? 'wait_well' : 'sit_tulsi';
          }
        } else if (!shouldWaitForPlayer) {
          dogSpeed = 3.1;
          const stepDist = Math.min(dist, dogSpeed * dt);
          dog.position.x += (dx / dist) * stepDist;
          dog.position.z += (dz / dist) * stepDist;
          const desiredYaw = Math.atan2(dx, dz);
          const diff = normalizeAngle(desiredYaw - dog.yaw);
          dog.yaw += diff * Math.min(1, dt * 7.5);
        } else {
          // Turn back to face player while waiting
          const desiredYaw = Math.atan2(
            ctx.playerPos.x - dog.position.x,
            ctx.playerPos.z - dog.position.z
          );
          dog.yaw += normalizeAngle(desiredYaw - dog.yaw) * Math.min(1, dt * 5.0);
        }
      } else {
        // Face player affectionately when stationary
        const desiredYaw = Math.atan2(
          ctx.playerPos.x - dog.position.x,
          ctx.playerPos.z - dog.position.z
        );
        dog.yaw += normalizeAngle(desiredYaw - dog.yaw) * Math.min(1, dt * 4.5);

        if (dogMode === 'whimper' && (step === 'follow_paws' || step === 'get_biscuit')) {
          whimperTimer -= dt;
          const distP = Math.hypot(
            ctx.playerPos.x - dog.position.x,
            ctx.playerPos.z - dog.position.z
          );
          if (whimperTimer <= 0 && distP < 12) {
            ctx.audio.playDogWhimper();
            whimperTimer = 4.8 + Math.random() * 2.5;
          }
        }
      }

      dog.root.position.copy(dog.position);
      dog.root.rotation.y = dog.yaw;

      // Procedural dog body, head, tail & leg animation
      if (dogSpeed > 0.1) {
        const stride = timeSec * 12.5;
        dog.legs[0].rotation.x = Math.sin(stride) * 0.55;
        dog.legs[1].rotation.x = -Math.sin(stride) * 0.55;
        dog.legs[2].rotation.x = -Math.sin(stride) * 0.55;
        dog.legs[3].rotation.x = Math.sin(stride) * 0.55;
        dog.bodyGroup.position.y = Math.abs(Math.sin(stride)) * 0.055;
        dog.tailPivot.rotation.z = Math.sin(timeSec * 14) * 0.52;
        dog.headGroup.rotation.x = -0.08 + Math.sin(stride) * 0.05;
      } else {
        for (let i = 0; i < dog.legs.length; i++) {
          dog.legs[i].rotation.x = THREE.MathUtils.damp(dog.legs[i].rotation.x, 0, 10, dt);
        }
        dog.bodyGroup.position.y = Math.sin(timeSec * 2.4) * 0.015;
        const isHungry = dogMode === 'whimper';
        dog.tailPivot.rotation.z = isHungry
          ? Math.sin(timeSec * 3.0) * 0.1
          : Math.sin(timeSec * 11.5) * 0.58;
        dog.headGroup.rotation.x = isHungry ? 0.24 + Math.sin(timeSec * 2.1) * 0.06 : -0.05;
      }

      // 9. Environmental Hazard Collision Checks (Thorns = 50 dmg, Black Scorpions = 100 instant faint)
      if (step !== 'lying_poke' && step !== 'gate_pan') {
        for (let i = 0; i < ow.thorns.length; i++) {
          const thorn = ow.thorns[i];
          const dx = ctx.playerPos.x - thorn.position.x;
          const dz = ctx.playerPos.z - thorn.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < thorn.radius && ctx.playerFeetY < thorn.clearanceY) {
            const nx = dist > 0.01 ? dx / dist : 0;
            const nz = dist > 0.01 ? dz / dist : 1;
            ctx.damagePlayer(
              50,
              'You stepped on sharp thorny bushes (काँटे)! Jump over them safely.',
              'thorn',
              nx * 0.9,
              nz * 0.9
            );
            return;
          }
        }

        for (let i = 0; i < ow.scorpions.length; i++) {
          const scorp = ow.scorpions[i];
          const dx = ctx.playerPos.x - scorp.position.x;
          const dz = ctx.playerPos.z - scorp.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < scorp.radius && ctx.playerFeetY < scorp.clearanceY) {
            ctx.damagePlayer(
              100,
              'A venomous Black Scorpion (बिच्छू) stung you! Watch the ground and jump clear.',
              'scorpion'
            );
            return;
          }
        }
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      if (step === 'lying_poke' || step === 'gate_pan') return true;
      const ow = ctx.outdoorWorld;

      const distToDog = Math.hypot(
        ctx.playerPos.x - ow.dog.position.x,
        ctx.playerPos.z - ow.dog.position.z
      );
      const distToBiscuit = Math.hypot(
        ctx.playerPos.x - ow.biscuitPos.x,
        ctx.playerPos.z - ow.biscuitPos.z
      );
      const distToPulley = Math.hypot(
        ctx.playerPos.x - ow.pulleyPickupPos.x,
        ctx.playerPos.z - ow.pulleyPickupPos.z
      );
      const distToWell = Math.hypot(
        ctx.playerPos.x - ow.wellPos.x,
        ctx.playerPos.z - ow.wellPos.z
      );
      const distToTulsi = Math.hypot(
        ctx.playerPos.x - ow.tulsiPos.x,
        ctx.playerPos.z - ow.tulsiPos.z
      );
      const distToVeranda = Math.hypot(
        ctx.playerPos.x - ow.verandaRestPos.x,
        ctx.playerPos.z - ow.verandaRestPos.z
      );
      const distToKey = Math.hypot(
        ctx.playerPos.x - ow.haveliKeyPos.x,
        ctx.playerPos.z - ow.haveliKeyPos.z
      );

      // Collect Biscuit Packet from Ruined Tea-Stall
      if ((step === 'get_biscuit' || step === 'follow_paws') && ow.biscuitGroup.visible && distToBiscuit < 2.65) {
        ow.biscuitGroup.visible = false;
        step = 'feed_dog';
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.9);
        ctx.spawnBurst(ow.biscuitPos, 0xf5be58);
        ctx.audio.playItemPickup();
        ctx.setCheckpoint(CHECKPOINTS.biscuit_collected, true);
        ctx.emitHud();
        return true;
      }

      // Feed Hungry Street Dog -> Dog becomes loyal companion and leads to Stone Well
      if (step === 'feed_dog' && distToDog < 3.0) {
        step = 'follow_dog_well';
        dogMode = 'trot_to_well';
        dogWaypointIdx = 0;
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.85);
        ctx.spawnBurst(ow.dog.position, 0xffd268);
        ctx.audio.playDogBark(true, false);
        ctx.emitHud();
        return true;
      }

      // Inspect Stone Well (discovers missing pulley if player interacts right away)
      if (step === 'follow_dog_well' && distToWell < 3.4) {
        step = 'get_pulley';
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.6);
        ctx.audio.playWoodCreak();
        ctx.emitHud();
        return true;
      }

      // Collect Missing Pulley (घिरनी) from Broken Wooden Shed
      if ((step === 'get_pulley' || step === 'follow_dog_well') && ow.pulleyPickupGroup.visible && distToPulley < 2.7) {
        ow.pulleyPickupGroup.visible = false;
        step = 'install_pulley';
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.95);
        ctx.spawnBurst(ow.pulleyPickupPos, 0xf5be58);
        ctx.audio.playItemPickup();
        ctx.emitHud();
        return true;
      }

      // Install Pulley onto Ancient Stone Well
      if (step === 'install_pulley' && distToWell < 3.4) {
        ow.wellInstalledPulley.visible = true;
        ow.wellRopeMesh.visible = true;
        ow.wellBucketGroup.visible = true;
        bucketProgress = 0;
        step = 'draw_water';
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.95);
        ctx.spawnBurst(ow.wellPos, 0xf5be58);
        ctx.audio.playWoodCreak();
        ctx.setCheckpoint(CHECKPOINTS.pulley_fixed, true);
        ctx.emitHud();
        return true;
      }

      // Hoist Water Bucket from Well with Smooth Pulley Animation
      if (step === 'draw_water' && !bucketDrawing && distToWell < 3.4) {
        bucketDrawing = true;
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.85);
        ctx.audio.playPulleyDraw();
        ctx.emitHud();
        return true;
      }

      // Drink Fresh Well Water (Restores 100% Health & Stamina)
      if (step === 'drink_water' && distToWell < 3.4) {
        step = 'water_dog';
        ctx.healPlayerFull();
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.75);
        ctx.spawnBurst(ow.wellPos, 0x74d8e8);
        ctx.audio.playWaterSplash();
        ctx.emitHud();
        return true;
      }

      // Give Water to the Street Dog -> Dog trots to watch over the Sacred Tulsi Chaura
      if (step === 'water_dog' && distToDog < 3.2) {
        step = 'water_tulsi';
        dogMode = 'trot_to_tulsi';
        dogWaypointIdx = 0;
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.8);
        ctx.spawnBurst(ow.dog.position, 0x74d8e8);
        ctx.audio.playWaterSplash();
        ctx.audio.playDogBark(true, false);
        ctx.emitHud();
        return true;
      }

      // Pour Water onto Sacred Tulsi Plant -> Trigger Protagonist Hindi Monologue via AndroidTTS!
      if (step === 'water_tulsi' && distToTulsi < 2.95) {
        step = 'rest_veranda';
        (ow.tulsiWaterGlow.material as THREE.MeshBasicMaterial).opacity = 0.72;
        ctx.resetProgressTimer();
        ctx.triggerInteractImpulse(0.9);
        ctx.spawnBurst(ow.tulsiPos, 0x74d8e8);
        ctx.audio.playWaterSplash();
        ctx.setCheckpoint(CHECKPOINTS.tulsi_watered, true);
        ctx.audio.speakProtagonistLine(
          'कहाँ फँस गया यार मैं... बढ़िया कॉर्पोरेट जॉब चल रही थी शहर में, इस सुनसान गाँव में आके कहाँ फँस गया!',
          'Kahan phans gaya yaar main... badhiya corporate job chal rahi thi sheher mein, is sunsaan gaon mein aake kahan phans gaya!',
          6400
        );
        ctx.emitHud();
        return true;
      }

      // Lie Down to Rest on Stone Veranda -> Smooth Prone Lie-Down & Metallic Key Poke
      if (step === 'rest_veranda' && distToVeranda < 3.0) {
        step = 'lying_poke';
        stepTimer = 0;
        pokeTriggered = false;
        ctx.forceStance('prone');
        ctx.setPlayerPose(ow.verandaRestPos.x, ow.verandaRestPos.z, 0, 0.25);
        ctx.triggerInteractImpulse(0.6);
        ctx.emitHud();
        return true;
      }

      // Pick Up Gleaming Rusted Iron Haveli Key -> Smooth 3.5s Cinematic Camera Pan to Haveli Main Gate
      if (step === 'inspect_key' && ow.haveliKeyGroup.visible && distToKey < 2.85) {
        ow.haveliKeyGroup.visible = false;
        step = 'gate_pan';
        stepTimer = 0;
        gateBellPlayed = false;
        ctx.triggerInteractImpulse(1.0);
        ctx.spawnBurst(ow.haveliKeyPos, 0xffd268);
        ctx.audio.playItemPickup();

        // Capture smooth starting camera pose for the cinematic sweep toward the closed Haveli Main Gate
        _panStartPos.copy(ctx.playerPos);
        _panStartLook.set(
          ctx.playerPos.x - Math.sin(ctx.playerYaw) * 4.5,
          ctx.playerPos.y + Math.sin(ctx.playerPitch) * 3.0,
          ctx.playerPos.z - Math.cos(ctx.playerYaw) * 4.5
        );
        ctx.emitHud();
        return true;
      }

      return false;
    },

    getPrompt: (ctx: ChapterRuntimeContext): ChapterPrompt | null => {
      if (step === 'lying_poke' || step === 'gate_pan') return null;
      const ow = ctx.outdoorWorld;

      if ((step === 'get_biscuit' || step === 'follow_paws') && ow.biscuitGroup.visible) {
        if (Math.hypot(ctx.playerPos.x - ow.biscuitPos.x, ctx.playerPos.z - ow.biscuitPos.z) < 2.65) {
          return { text: 'Take Biscuit Packet (बिस्कुट)', key: 'E' };
        }
      }
      if (step === 'feed_dog') {
        if (Math.hypot(ctx.playerPos.x - ow.dog.position.x, ctx.playerPos.z - ow.dog.position.z) < 3.0) {
          return { text: 'Feed Biscuit to Street Dog', key: 'E' };
        }
      }
      if (step === 'follow_dog_well') {
        if (Math.hypot(ctx.playerPos.x - ow.wellPos.x, ctx.playerPos.z - ow.wellPos.z) < 3.4) {
          return { text: 'Inspect Ancient Stone Well (Pulley Missing!)', key: 'E' };
        }
      }
      if ((step === 'get_pulley' || step === 'follow_dog_well') && ow.pulleyPickupGroup.visible) {
        if (
          Math.hypot(
            ctx.playerPos.x - ow.pulleyPickupPos.x,
            ctx.playerPos.z - ow.pulleyPickupPos.z
          ) < 2.7
        ) {
          return { text: 'Take Wooden Well Pulley (घिरनी)', key: 'E' };
        }
      }
      if (step === 'install_pulley') {
        if (Math.hypot(ctx.playerPos.x - ow.wellPos.x, ctx.playerPos.z - ow.wellPos.z) < 3.4) {
          return { text: 'Install Pulley onto Stone Well', key: 'E' };
        }
      }
      if (step === 'draw_water') {
        if (Math.hypot(ctx.playerPos.x - ow.wellPos.x, ctx.playerPos.z - ow.wellPos.z) < 3.4) {
          return bucketDrawing
            ? { text: 'Drawing Water Bucket from Well...', key: '' }
            : { text: 'Draw Bucket of Water from Well', key: 'E' };
        }
      }
      if (step === 'drink_water') {
        if (Math.hypot(ctx.playerPos.x - ow.wellPos.x, ctx.playerPos.z - ow.wellPos.z) < 3.4) {
          return { text: 'Drink Fresh Well Water (Restore Health)', key: 'E' };
        }
      }
      if (step === 'water_dog') {
        if (Math.hypot(ctx.playerPos.x - ow.dog.position.x, ctx.playerPos.z - ow.dog.position.z) < 3.2) {
          return { text: 'Give Water to Street Dog', key: 'E' };
        }
      }
      if (step === 'water_tulsi') {
        if (Math.hypot(ctx.playerPos.x - ow.tulsiPos.x, ctx.playerPos.z - ow.tulsiPos.z) < 2.95) {
          return { text: 'Pour Water onto Sacred Tulsi Plant (तुलसी)', key: 'E' };
        }
      }
      if (step === 'rest_veranda') {
        if (
          Math.hypot(
            ctx.playerPos.x - ow.verandaRestPos.x,
            ctx.playerPos.z - ow.verandaRestPos.z
          ) < 3.0
        ) {
          return { text: 'Lie Down & Rest on Stone Veranda', key: 'E' };
        }
      }
      if (step === 'inspect_key' && ow.haveliKeyGroup.visible) {
        if (
          Math.hypot(ctx.playerPos.x - ow.haveliKeyPos.x, ctx.playerPos.z - ow.haveliKeyPos.z) < 2.85
        ) {
          return { text: 'Pick Up Rusted Iron Haveli Key (हवेली की चाभी)', key: 'E' };
        }
      }

      return null;
    },

    getProgress: (): number => getStepMilestoneCount(),

    getObjectiveText: (): string => {
      switch (step) {
        case 'hear_bark_turn':
          return 'A dog barked behind you — turn around and inspect the muddy road';
        case 'follow_paws':
          return 'Follow the glowing dog paw prints (Jump over thorns & scorpions!)';
        case 'get_biscuit':
          return 'Find a Biscuit Packet near the ruined wooden Tea-Stall for the hungry dog';
        case 'feed_dog':
          return 'Return to the Ruined Hut and feed the Biscuit Packet to the dog';
        case 'follow_dog_well':
          return 'Follow the loyal dog east to the Ancient Stone Well (Kuan)';
        case 'get_pulley':
          return 'Well pulley is missing — find the Pulley (घिरनी) in the Broken Shed';
        case 'install_pulley':
          return 'Return to the Stone Well and fit the Pulley onto the beam';
        case 'draw_water':
          return bucketDrawing
            ? 'Hoisting cool water from the Stone Well...'
            : 'Use the pulley to draw a bucket of water from the Stone Well';
        case 'drink_water':
          return 'Drink fresh water from the well bucket to restore Health & Stamina';
        case 'water_dog':
          return 'Offer fresh water to your street dog companion';
        case 'water_tulsi':
          return 'Pour water onto the sacred Tulsi Plant (तुलसी) north-west of the well';
        case 'rest_veranda':
          return 'Lie down and catch your breath on the Stone Veranda beside the Tulsi';
        case 'lying_poke':
          return 'Something sharp poked your back under the stone slab...';
        case 'inspect_key':
          return 'Inspect the gleaming spot on the veranda and pick up the Haveli Key';
        case 'gate_pan':
          return 'The Iron Haveli Key is yours — the 1984 Haveli Gate awaits...';
      }
    },

    getHint: (): string | null => {
      switch (step) {
        case 'hear_bark_turn':
          return 'Look behind you (180°) on the misty village road.';
        case 'follow_paws':
          return 'Follow the glowing golden-mud paw prints northwest; tap JUMP over thorns and black scorpions.';
        case 'get_biscuit':
          return 'Check the wooden crates beside the Ruined Tea-Stall (marked on your Village Map).';
        case 'feed_dog':
          return 'Walk back to the whimpering dog beside the Ruined Hut.';
        case 'follow_dog_well':
          return 'Follow the trotting dog across the central trail to the Ancient Stone Well.';
        case 'get_pulley':
          return 'Head northeast to the Broken Wooden Shed and watch out for the black scorpion!';
        case 'install_pulley':
        case 'draw_water':
        case 'drink_water':
          return 'Approach the Ancient Stone Well and press E / USE.';
        case 'water_dog':
          return 'Walk up to the dog standing right beside the well.';
        case 'water_tulsi':
          return 'Follow the glowing diya north to the Sacred Tulsi Chaura.';
        case 'rest_veranda':
          return 'Step onto the raised Stone Veranda right next to the Tulsi Chaura.';
        case 'inspect_key':
          return 'Look down at the gleaming rusted Iron Key on the stone veranda slab.';
        default:
          return null;
      }
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const ow = ctx.outdoorWorld;
      switch (step) {
        case 'hear_bark_turn':
          return [
            {
              id: 'paw_start',
              x: ow.pawTrailCoords[0].x,
              z: ow.pawTrailCoords[0].z,
              label: 'Bark Behind',
              kind: 'dog',
              urgent: true,
            },
          ];
        case 'follow_paws':
        case 'feed_dog':
        case 'water_dog':
          return [
            {
              id: 'obj_dog',
              x: ow.dog.position.x,
              z: ow.dog.position.z,
              label: step === 'follow_paws' ? 'Dog' : step === 'feed_dog' ? 'Feed Dog' : 'Water Dog',
              kind: 'dog',
              urgent: true,
            },
          ];
        case 'get_biscuit':
          return [
            {
              id: 'obj_biscuit',
              x: ow.biscuitPos.x,
              z: ow.biscuitPos.z,
              label: 'Biscuit',
              kind: 'biscuit',
              urgent: true,
            },
          ];
        case 'follow_dog_well':
        case 'install_pulley':
        case 'draw_water':
        case 'drink_water':
          return [
            {
              id: 'obj_well',
              x: ow.wellPos.x,
              z: ow.wellPos.z,
              label: 'Stone Well',
              kind: 'well',
              urgent: true,
            },
          ];
        case 'get_pulley':
          return [
            {
              id: 'obj_pulley',
              x: ow.pulleyPickupPos.x,
              z: ow.pulleyPickupPos.z,
              label: 'Pulley',
              kind: 'pulley',
              urgent: true,
            },
          ];
        case 'water_tulsi':
          return [
            {
              id: 'obj_tulsi',
              x: ow.tulsiPos.x,
              z: ow.tulsiPos.z,
              label: 'Tulsi Plant',
              kind: 'tulsi',
              urgent: true,
            },
          ];
        case 'rest_veranda':
        case 'lying_poke':
          return [
            {
              id: 'obj_veranda',
              x: ow.verandaRestPos.x,
              z: ow.verandaRestPos.z,
              label: 'Veranda',
              kind: 'veranda',
              urgent: true,
            },
          ];
        case 'inspect_key':
          return [
            {
              id: 'obj_key',
              x: ow.haveliKeyPos.x,
              z: ow.haveliKeyPos.z,
              label: 'Haveli Key',
              kind: 'key',
              urgent: true,
            },
          ];
        case 'gate_pan':
          return [
            {
              id: 'obj_gate',
              x: ow.haveliGatePos.x,
              z: ow.haveliGatePos.z,
              label: 'Haveli Gate',
              kind: 'gate',
              urgent: true,
            },
          ];
      }
    },
  };
}
