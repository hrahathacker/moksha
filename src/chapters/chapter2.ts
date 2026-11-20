import * as THREE from 'three';
import { ChapterModule, ChapterPrompt, ChapterRuntimeContext } from './types';
import { EnemyCombatEntity, MinimapObjective } from '../game/types';
import { ShadowCrawlerRig } from '../game/forestCourtyardMap';

type Chapter2Stage =
  | 'unlock_gate'
  | 'stealth_to_shrine'
  | 'shatter_runes'
  | 'boss_fight'
  | 'ending_pan'
  | 'done';

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _burstPos = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

/**
 * Chapter 2: "Shapit Jungle Aur Haveli Ka Dwarpal"
 * Full 5–6 minute action-horror bridge from Chapter 1 (Haveli Iron Key) to Chapter 3 (Indoor Haveli):
 *   Phase 1: Unlock Village Outer Iron Gate (dog refuses to enter, Hindi TTS monologue)
 *   Phase 2: Crouch/Prone stealth past 3 Forest Shadow Crawlers to Ruined Shiva Shrine -> equip Sacred Iron Trishul & Flaming Torch (Checkpoint 1)
 *   Phase 3: Melee combat & shatter 3 Glowing Tantric Rune Stones across Baoli, Stables/Cart, and Courtyard Altar (Checkpoint 2)
 *   Phase 4: Boss Fight against the chain-bound Aghori Dwarpal with Boss Health Bar -> Ash Dissolve & Haveli Main Doors swing open!
 */
export function createChapter2(): ChapterModule {
  let stage: Chapter2Stage = 'unlock_gate';
  let introVoicePlayed = false;
  let introVoiceDelay = 0.85;
  let dogWhineTimer = 1.6;
  let barrierLineSpoken = false;
  let trishulCollected = false;
  let crawlersDefeated = 0;
  let runesBroken = 0;
  let endingPanTimer = 0;
  let noWeaponWarningTimer = 0;

  let crawlerEntities: EnemyCombatEntity[] = [];
  let bossEntity: EnemyCombatEntity | null = null;

  const makeCrawlerEntity = (
    c: ShadowCrawlerRig,
    ctx: ChapterRuntimeContext
  ): EnemyCombatEntity => ({
    id: c.id,
    name: 'Shadow Crawler',
    hindiName: 'शापित पिशाच',
    get position() {
      return c.position;
    },
    get hp() {
      return c.hp;
    },
    set hp(val: number) {
      c.hp = val;
    },
    maxHp: c.maxHp,
    isBossOrMortal: true,
    get isDefeated() {
      return !c.alive;
    },
    get isStaggered() {
      return c.staggerTimer > 0;
    },
    takeDamage(amount: number, knockbackDir?: { x: number; z: number }) {
      if (!c.alive || !ctx.trishulEquipped) return false;
      c.hp = Math.max(0, c.hp - amount);
      c.hitFlash = 1.0;
      c.staggerTimer = 0.65;
      c.alertState = 'chase';
      if (knockbackDir) {
        c.position.x += knockbackDir.x * 1.15;
        c.position.z += knockbackDir.z * 1.15;
        ctx.forestWorld.resolvePlayerCollision(c.position, 0.45);
      }
      ctx.spawnBurst(_burstPos.set(c.position.x, 0.85, c.position.z), 0xff6238);
      ctx.audio.playCrawlerScreech(true);
      return true;
    },
    stagger(durationSec: number) {
      c.staggerTimer = Math.max(c.staggerTimer, durationSec);
    },
    onDefeat() {
      if (!c.alive) return;
      c.alive = false;
      c.dissolveProgress = 0.01;
      crawlersDefeated += 1;
      ctx.spawnBurst(_burstPos.set(c.position.x, 0.9, c.position.z), 0xff4c2b);
      ctx.audio.playRuneShatter();
      ctx.unregisterCombatEnemy(c.id);
      ctx.emitHud();
    },
  });

  const spawnBoss = (ctx: ChapterRuntimeContext) => {
    const fw = ctx.forestWorld;
    const b = fw.boss;
    b.root.visible = true;
    b.position.set(0, 0, -27.2);
    b.yaw = 0;
    b.root.rotation.y = 0;
    b.hp = b.maxHp;
    b.state = 'intro';
    b.stateTimer = 1.45;
    b.slamProgress = 0;
    b.slamDamageDealt = false;
    b.hitFlash = 0;
    b.dissolveProgress = 0;
    b.boneMat.opacity = 1;
    b.shroudMat.opacity = 1;
    b.bodyGroup.scale.set(1, 1, 1);
    b.bodyGroup.position.y = 0;
    b.slamRing.visible = false;
    b.ashPoints.visible = false;

    fw.lightningFlashLight.intensity = 22;
    ctx.audio.playThunderCrack();
    ctx.audio.playBossRoar();
    ctx.triggerCameraJolt(0.11, 0.09);
    ctx.spawnBurst(_burstPos.set(0, 1.8, -27.2), 0xff3b28);

    bossEntity = {
      id: 'boss_aghori_dwarpal',
      name: 'Aghori Dwarpal',
      hindiName: 'अघोरी द्वारपाल',
      get position() {
        return b.position;
      },
      get hp() {
        return b.hp;
      },
      set hp(val: number) {
        b.hp = val;
      },
      maxHp: b.maxHp,
      isBossOrMortal: true,
      get isDefeated() {
        return b.state === 'dying' || b.state === 'dead';
      },
      get isStaggered() {
        return b.state === 'staggered' || b.state === 'recover';
      },
      takeDamage(amount: number, knockbackDir?: { x: number; z: number }) {
        if (b.state === 'hidden' || b.state === 'dying' || b.state === 'dead') return false;
        const applied = b.state === 'recover' ? Math.round(amount * 1.25) : amount;
        b.hp = Math.max(0, b.hp - applied);
        b.hitFlash = 1.0;
        if (knockbackDir && b.state !== 'charge') {
          b.position.x += knockbackDir.x * 0.45;
          b.position.z += knockbackDir.z * 0.45;
          ctx.forestWorld.resolvePlayerCollision(b.position, 0.85);
        }
        ctx.spawnBurst(_burstPos.set(b.position.x, 1.65, b.position.z), 0xffc65c);
        if (b.hp > 0 && b.state === 'stalk' && Math.random() < 0.35) {
          b.state = 'staggered';
          b.stateTimer = 0.65;
          ctx.audio.playBossRoar();
        }
        return true;
      },
      stagger(durationSec: number) {
        if (b.state !== 'dying' && b.state !== 'dead') {
          b.state = 'staggered';
          b.stateTimer = Math.max(b.stateTimer, durationSec);
        }
      },
      onDefeat() {
        if (b.state === 'dying' || b.state === 'dead') return;
        b.hp = 0;
        b.state = 'dying';
        b.stateTimer = 2.1;
        b.dissolveProgress = 0;
        b.slamRing.visible = false;
        b.ashPoints.visible = true;
        (b.ashPoints.material as THREE.PointsMaterial).opacity = 0.95;
        ctx.audio.playBossRoar();
        ctx.audio.playThunderCrack();
        ctx.spawnBurst(_burstPos.set(b.position.x, 1.8, b.position.z), 0xff7b36);
        ctx.setActiveCombatEnemy(null);
        ctx.unregisterCombatEnemy('boss_aghori_dwarpal');
        ctx.emitHud();
      },
    };

    ctx.registerCombatEnemy(bossEntity);
    ctx.setActiveCombatEnemy(bossEntity);
    ctx.audio.speakProtagonistLine(
      'ये कौन है?! हवेली का अघोरी द्वारपाल! इसके गदा के वार से बचकर त्रिशूल से वार करना होगा!',
      'Ye kaun hai?! Haveli ka Aghori Dwarpal! Iske gada ke waar se bachkar Trishul se waar karna hoga!',
      6200
    );
  };

  const shatterRuneStone = (
    rune: ForestCourtyardWorldRune,
    ctx: ChapterRuntimeContext
  ): boolean => {
    if (rune.broken) return false;
    rune.broken = true;
    rune.hp = 0;
    runesBroken += 1;
    ctx.resetProgressTimer();
    ctx.triggerInteractImpulse(1.0);
    ctx.triggerCameraJolt(0.08, -0.07);
    ctx.spawnBurst(rune.position, 0xff4a38);
    ctx.audio.playRuneShatter();

    if (runesBroken >= ctx.forestWorld.runeStones.length) {
      // Save Checkpoint 2 right before Aghori Dwarpal Boss Fight!
      ctx.setCheckpoint(
        {
          id: 'before_boss',
          label: 'Outer Courtyard (Boss Fight)',
          x: 0,
          z: -16.2,
          yaw: 0,
        },
        true
      );
      ctx.healPlayerFull();
      stage = 'boss_fight';
      spawnBoss(ctx);
    } else {
      ctx.audio.speakProtagonistLine(
        `एक मंत्र-पत्थर टूट गया! अभी ${3 - runesBroken} पत्थर और तोड़ने हैं।`,
        `Ek mantra-patthar toot gaya! Abhi ${3 - runesBroken} patthar aur todne hain.`,
        3600
      );
    }
    ctx.emitHud();
    return true;
  };

  type ForestCourtyardWorldRune = ChapterRuntimeContext['forestWorld']['runeStones'][number];

  const resetEnemiesForCheckpoint = (
    ctx: ChapterRuntimeContext,
    keepForestDead: boolean
  ) => {
    const fw = ctx.forestWorld;
    crawlerEntities.forEach((e) => ctx.unregisterCombatEnemy(e.id));
    crawlerEntities = [];

    fw.crawlers.forEach((c) => {
      if (keepForestDead && c.zone === 'forest') {
        c.alive = false;
        c.dissolveProgress = 1;
        c.root.visible = false;
        return;
      }
      c.alive = true;
      c.hp = c.maxHp;
      c.dissolveProgress = 0;
      c.staggerTimer = 0;
      c.hitFlash = 0;
      c.attackCooldown = 0.8;
      c.alertState = 'patrol';
      c.patrolIndex = 0;
      c.position.copy(c.homePos);
      c.root.visible = true;
      c.bodyGroup.scale.set(1, 1, 1);
      c.bodyMat.opacity = 1;
      c.eyeMat.opacity = 1;
      const ent = makeCrawlerEntity(c, ctx);
      crawlerEntities.push(ent);
      ctx.registerCombatEnemy(ent);
    });
  };

  const updateCrawlers = (ctx: ChapterRuntimeContext, dt: number, timeSec: number) => {
    const fw = ctx.forestWorld;
    let closestThreatDist = Infinity;

    for (let i = 0; i < fw.crawlers.length; i++) {
      const c = fw.crawlers[i];
      if (!c.alive) {
        if (c.dissolveProgress < 1) {
          c.dissolveProgress = Math.min(1, c.dissolveProgress + dt * 1.6);
          const s = Math.max(0.01, 1 - c.dissolveProgress);
          c.bodyGroup.scale.set(s, s * 1.15, s);
          c.bodyGroup.position.y = 0.58 + c.dissolveProgress * 0.55;
          c.bodyMat.opacity = s;
          c.eyeMat.opacity = s;
          if (c.dissolveProgress >= 1) c.root.visible = false;
        }
        continue;
      }

      // Don't let crawlers cross through the locked outer gate or interfere once Boss starts
      if (stage === 'unlock_gate') continue;
      if (stage === 'boss_fight' || stage === 'ending_pan' || stage === 'done') {
        if (c.zone === 'forest') continue;
      }

      if (c.hitFlash > 0) {
        c.hitFlash = Math.max(0, c.hitFlash - dt * 4.2);
        c.bodyMat.emissive.setHex(c.hitFlash > 0.2 ? 0xff4a24 : 0x240608);
        c.bodyMat.emissiveIntensity = 0.35 + c.hitFlash * 2.4;
      }
      if (c.attackCooldown > 0) c.attackCooldown = Math.max(0, c.attackCooldown - dt);
      if (c.screechCooldown > 0) c.screechCooldown = Math.max(0, c.screechCooldown - dt);

      if (c.staggerTimer > 0) {
        c.staggerTimer = Math.max(0, c.staggerTimer - dt);
        c.bodyGroup.rotation.z = Math.sin(timeSec * 36) * 0.24;
        continue;
      }
      c.bodyGroup.rotation.z = 0;

      const distToPlayer = Math.hypot(
        ctx.playerPos.x - c.position.x,
        ctx.playerPos.z - c.position.z
      );

      // Stealth-aware detection radius (Crouch/Prone behind fallen logs/rocks drastically shrinks detection!)
      const baseDetect = ctx.flashlightOn ? 9.6 : 6.8;
      const detectRadius = Math.max(2.1, baseDetect * ctx.stealthFactor);

      // Keep forest crawlers in forest (z > -2) and courtyard crawlers in courtyard (z < -2)
      const playerInMyZone =
        (c.zone === 'forest' && ctx.playerPos.z < 29.6 && ctx.playerPos.z > -4.5) ||
        (c.zone === 'courtyard' && ctx.playerPos.z < -1.2);

      if (playerInMyZone && distToPlayer < detectRadius) {
        if (c.alertState !== 'chase' && c.screechCooldown <= 0) {
          ctx.audio.playCrawlerScreech(false);
          c.screechCooldown = 5.5;
        }
        c.alertState = 'chase';
      } else if (!playerInMyZone || distToPlayer > detectRadius * 1.75) {
        c.alertState = 'patrol';
      }

      if (c.alertState === 'chase') {
        closestThreatDist = Math.min(closestThreatDist, distToPlayer);
      }

      let targetX = c.homePos.x;
      let targetZ = c.homePos.z;
      let moveSpeed = c.zone === 'forest' ? 1.95 : 2.15;

      if (c.alertState === 'chase') {
        targetX = ctx.playerPos.x;
        targetZ = ctx.playerPos.z;
        moveSpeed =
          ctx.difficulty === 'nightmare'
            ? 4.15
            : ctx.difficulty === 'speedrun'
              ? 3.75
              : trishulCollected
                ? 3.45
                : 3.1;
      } else {
        const pt = c.patrolPoints[c.patrolIndex];
        targetX = pt.x;
        targetZ = pt.z;
        if (Math.hypot(targetX - c.position.x, targetZ - c.position.z) < 0.75) {
          c.patrolIndex = (c.patrolIndex + 1) % c.patrolPoints.length;
        }
      }

      const dx = targetX - c.position.x;
      const dz = targetZ - c.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const step = Math.min(d, moveSpeed * dt);
        c.position.x += (dx / d) * step;
        c.position.z += (dz / d) * step;
        if (c.zone === 'forest') {
          c.position.z = Math.min(28.8, Math.max(-1.2, c.position.z));
        } else {
          c.position.z = Math.min(-3.2, Math.max(-31.5, c.position.z));
        }
        fw.resolvePlayerCollision(c.position, 0.42);

        const desiredYaw = Math.atan2(-dx, -dz);
        let diff = desiredYaw - c.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.yaw += diff * Math.min(1, dt * 8.5);
        c.root.rotation.y = c.yaw;
      }

      // Spider-like creepy Hastar crawl limb animation & head twitch
      const crawlFreq = c.alertState === 'chase' ? 15.5 : 8.2;
      c.limbs.forEach((limb, idx) => {
        const phase = idx % 2 === 0 ? 0 : Math.PI;
        limb.rotation.x = Math.sin(timeSec * crawlFreq + phase + idx * 0.8) * 0.55;
      });
      c.bodyGroup.position.y = 0.56 + Math.abs(Math.sin(timeSec * crawlFreq)) * 0.08;
      c.headGroup.rotation.z = Math.sin(timeSec * 19 + i * 2) * 0.16;

      // Melee claw slash if Shadow Crawler reaches the player
      if (c.alertState === 'chase' && distToPlayer < 1.38 && c.attackCooldown <= 0) {
        c.attackCooldown = 1.45;
        ctx.audio.playCrawlerScreech(true);
        const pushX = distToPlayer > 0.05 ? ((ctx.playerPos.x - c.position.x) / distToPlayer) * 0.65 : 0;
        const pushZ = distToPlayer > 0.05 ? ((ctx.playerPos.z - c.position.z) / distToPlayer) * 0.65 : 0.65;
        const dmg = ctx.difficulty === 'nightmare' ? 40 : 30;
        ctx.damagePlayer(
          dmg,
          'A Shadow Crawler (शापित पिशाच) ambushed you in the dark! Use Crouch/Prone stealth or strike back with the Sacred Trishul.',
          'crawler',
          pushX,
          pushZ
        );
      }
    }

    if (stage !== 'boss_fight') {
      const prox = closestThreatDist < 12 ? Math.max(0, 1 - closestThreatDist / 12) : 0;
      ctx.setProximityIntensity(prox);
    }
  };

  const updateBoss = (ctx: ChapterRuntimeContext, dt: number, timeSec: number) => {
    const fw = ctx.forestWorld;
    const b = fw.boss;
    if (b.state === 'hidden' || b.state === 'dead') return;

    if (b.hitFlash > 0) {
      b.hitFlash = Math.max(0, b.hitFlash - dt * 4.5);
      b.boneMat.emissive.setHex(b.hitFlash > 0.15 ? 0xff7733 : 0x220806);
      b.boneMat.emissiveIntensity = 0.25 + b.hitFlash * 2.2;
    }

    // Dying ash dissolve animation -> opens massive Haveli Main Doors!
    if (b.state === 'dying') {
      b.dissolveProgress = Math.min(1, b.dissolveProgress + dt * 0.52);
      const inv = Math.max(0.01, 1 - b.dissolveProgress);
      b.boneMat.opacity = inv;
      b.shroudMat.opacity = inv;
      b.bodyGroup.scale.set(inv, 1 + b.dissolveProgress * 0.25, inv);
      b.bodyGroup.position.y = b.dissolveProgress * 0.9;

      // Animate rising glowing ash cloud
      const posAttr = b.ashPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length / 3; i++) {
        const i3 = i * 3;
        arr[i3] += b.ashVelocities[i3] * dt;
        arr[i3 + 1] += b.ashVelocities[i3 + 1] * dt;
        arr[i3 + 2] += b.ashVelocities[i3 + 2] * dt;
      }
      posAttr.needsUpdate = true;
      (b.ashPoints.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.dissolveProgress * 0.95);

      if (b.dissolveProgress >= 1) {
        b.state = 'dead';
        b.root.visible = false;
        fw.haveliDoorUnlocked = true;
        stage = 'ending_pan';
        endingPanTimer = 0;
        ctx.audio.playGateUnlock();
        ctx.audio.playShantiChord();
        ctx.audio.speakProtagonistLine(
          'द्वारपाल राख हो गया... हवेली का मुख्य दरवाज़ा खुल रहा है!',
          'Dwarpal raakh ho gaya... Haveli ka mukhya darwaza khul raha hai!',
          4200
        );
        ctx.emitHud();
      }
      return;
    }

    // Smooth yaw tracking toward player except during active charge dash
    const dx = ctx.playerPos.x - b.position.x;
    const dz = ctx.playerPos.z - b.position.z;
    const dist = Math.hypot(dx, dz);
    ctx.setProximityIntensity(Math.max(0.35, Math.min(0.92, 1 - dist / 18)));

    if (b.state !== 'charge') {
      const desiredYaw = Math.atan2(dx, dz);
      let diff = desiredYaw - b.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      b.yaw += diff * Math.min(1, dt * 5.2);
      b.root.rotation.y = b.yaw;
    }

    // Animate iron chains & menacing skeletal sway
    b.chains.forEach((ch, idx) => {
      ch.rotation.z = Math.sin(timeSec * 5.5 + idx) * 0.14;
    });

    // Expanding shockwave ring after mace slam
    if (b.slamRing.visible) {
      b.slamProgress += dt * 2.2;
      const rScale = 0.8 + b.slamProgress * 3.8;
      b.slamRing.scale.set(rScale, 1, rScale);
      b.slamRingMat.opacity = Math.max(0, 0.85 * (1 - b.slamProgress));
      if (b.slamProgress >= 1) {
        b.slamRing.visible = false;
      }
    }

    b.stateTimer -= dt;

    if (b.state === 'intro') {
      b.rightArmPivot.rotation.x = -1.6 + Math.sin(timeSec * 10) * 0.15;
      b.leftArmPivot.rotation.x = -0.7;
      if (b.stateTimer <= 0) {
        b.state = 'stalk';
        b.stateTimer = 2.6;
      }
      return;
    }

    if (b.state === 'staggered') {
      b.bodyGroup.rotation.x = -0.18;
      b.rightArmPivot.rotation.x = -0.4;
      if (b.stateTimer <= 0) {
        b.bodyGroup.rotation.x = 0;
        b.state = 'stalk';
        b.stateTimer = 1.6;
      }
      return;
    }

    if (b.state === 'stalk') {
      const stalkSpeed = ctx.difficulty === 'nightmare' ? 3.25 : 2.55;
      if (dist > 2.6) {
        b.position.x += (dx / dist) * stalkSpeed * dt;
        b.position.z += (dz / dist) * stalkSpeed * dt;
        b.position.z = Math.min(-4.2, Math.max(-31.0, b.position.z));
        fw.resolvePlayerCollision(b.position, 0.82);
      }
      b.bodyGroup.position.y = Math.abs(Math.sin(timeSec * 6.5)) * 0.12;
      b.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        b.rightArmPivot.rotation.x,
        -0.35 + Math.sin(timeSec * 6.5) * 0.25,
        8,
        dt
      );
      b.leftArmPivot.rotation.x = Math.sin(timeSec * 6.5 + Math.PI) * 0.28;
      b.maceHeadMat.emissiveIntensity = 0.4 + Math.sin(timeSec * 6) * 0.2;

      if (dist < 7.8 && b.stateTimer <= 0) {
        // Begin unmistakable Telegraph Wind-up!
        b.state = 'telegraph';
        b.stateTimer = ctx.difficulty === 'nightmare' ? 0.72 : 0.92;
        b.chargeDirX = dist > 0.05 ? dx / dist : 0;
        b.chargeDirZ = dist > 0.05 ? dz / dist : 1;
        b.slamDamageDealt = false;
        ctx.audio.playBossRoar();
      }
      return;
    }

    if (b.state === 'telegraph') {
      // Raise heavy Gada high overhead with blazing crimson glow so player knows to Sprint/Jump!
      b.rightArmPivot.rotation.x = THREE.MathUtils.damp(b.rightArmPivot.rotation.x, -2.55, 9, dt);
      b.leftArmPivot.rotation.x = THREE.MathUtils.damp(b.leftArmPivot.rotation.x, -0.85, 9, dt);
      b.maceHeadMat.emissiveIntensity = 2.6 + Math.sin(timeSec * 28) * 0.9;
      // Refresh charge heading slightly during early windup
      if (b.stateTimer > 0.28 && dist > 0.1) {
        b.chargeDirX = dx / dist;
        b.chargeDirZ = dz / dist;
      }
      if (b.stateTimer <= 0) {
        b.state = 'charge';
        b.stateTimer = 0.62;
      }
      return;
    }

    if (b.state === 'charge') {
      // Fast demonic charge forward + heavy downward Gada slam!
      const chargeSpeed = ctx.difficulty === 'nightmare' ? 9.8 : 8.2;
      b.position.x += b.chargeDirX * chargeSpeed * dt;
      b.position.z += b.chargeDirZ * chargeSpeed * dt;
      b.position.z = Math.min(-4.2, Math.max(-31.0, b.position.z));
      fw.resolvePlayerCollision(b.position, 0.85);

      b.rightArmPivot.rotation.x = THREE.MathUtils.damp(b.rightArmPivot.rotation.x, 0.55, 16, dt);

      // Slam impact near end of charge or if colliding with player
      if (!b.slamDamageDealt && (b.stateTimer <= 0.16 || dist < 2.2)) {
        b.slamDamageDealt = true;
        b.slamRing.visible = true;
        b.slamProgress = 0;
        b.slamRing.scale.set(0.8, 1, 0.8);
        b.slamRingMat.opacity = 0.9;
        ctx.audio.playBossSlam();
        ctx.triggerCameraJolt(0.14, 0.1);
        ctx.spawnBurst(_burstPos.set(b.position.x, 0.4, b.position.z), 0xff4c24);

        // Player dodges shockwave cleanly if outside 3.35m OR mid-Jump (playerFeetY > 0.30)!
        if (dist < 3.35 && ctx.playerFeetY < 0.32) {
          const pushX = dist > 0.05 ? (dx / dist) * 1.4 : 0;
          const pushZ = dist > 0.05 ? (dz / dist) * 1.4 : 1.4;
          const slamDmg = ctx.difficulty === 'nightmare' ? 55 : 40;
          ctx.damagePlayer(
            slamDmg,
            'Aghori Dwarpal slammed you with his iron Gada! Sprint sideways or Jump over his red shockwave, then counter-attack with the Trishul.',
            'boss',
            pushX,
            pushZ
          );
        }
      }

      if (b.stateTimer <= 0) {
        b.state = 'recover';
        b.stateTimer = ctx.difficulty === 'nightmare' ? 1.15 : 1.55;
        b.maceHeadMat.emissiveIntensity = 0.35;
      }
      return;
    }

    if (b.state === 'recover') {
      // Hunched recovery pause — golden window for player to rush in and strike with Trishul!
      b.rightArmPivot.rotation.x = THREE.MathUtils.damp(b.rightArmPivot.rotation.x, 0.35, 6, dt);
      b.bodyGroup.rotation.x = THREE.MathUtils.damp(b.bodyGroup.rotation.x, 0.22, 6, dt);
      if (b.stateTimer <= 0) {
        b.bodyGroup.rotation.x = 0;
        b.state = 'stalk';
        b.stateTimer = 1.65;
      }
    }
  };

  return {
    config: {
      id: 2,
      title: 'Shapit Jungle Aur Dwarpal',
      hindiTitle: 'शापित जंगल और हवेली का द्वारपाल',
      environment: 'forest',
      shortTask: 'Trishul, 3 Runes & Aghori Boss',
      taskLabel: 'Chapter 2 Milestones',
      targetCount: 6,
      ghostSpeedMult: 1.0,
      briefingIntro:
        'Armed with the rusted Iron Key from the village veranda, unlock the outer iron gate and brave the cursed Banyan forest. Sneak past Shadow Crawlers to claim the Sacred Iron Trishul, shatter 3 Tantric Rune Stones, and defeat the Aghori Gatekeeper!',
      steps: [
        {
          heading: '1. Unlock the Gate & Sneak to Shiva Shrine',
          detail:
            'Unlock the outer iron gate with your key. Three Shadow Crawlers hunt the misty woods—use Crouch / Prone behind fallen logs and boulders to reach the Ruined Shiva Shrine safely.',
        },
        {
          heading: '2. Equip Sacred Iron Trishul & Flaming Torch',
          detail:
            'Pick up the Sacred Iron Trishul beside the Shiva Shrine Dhuni fire. This unlocks melee combat (Attack / LMB) and saves Checkpoint 1 so you can slay the Shadow Crawlers.',
        },
        {
          heading: '3. Shatter 3 Tantric Rune Stones',
          detail:
            'In the Haveli Outer Courtyard, locate 3 glowing crimson Rune Stones at the Baoli Stepwell, Ruined Stables, and Stone Altar. Strike all 3 with the Trishul to break the red barrier (Checkpoint 2).',
        },
        {
          heading: '4. Defeat the Aghori Dwarpal Boss',
          detail:
            'Dodge the Gatekeeper’s telegraphed Gada charge and red shockwave using Sprint and Jump, then rush in with Trishul strikes until he turns to ash and the Haveli Main Doors open!',
        },
      ],
      completionText:
        'The Aghori Dwarpal turns to ash! The colossal Haveli Main Doors creak wide open — Chapter 3 (Andhere Ki Shuruwat) begins inside the 1984 Haveli...',
    },

    getSpawn: () => ({ x: 0, z: 34.4, yaw: 0 }),

    reset: (ctx: ChapterRuntimeContext) => {
      const fw = ctx.forestWorld;
      stage = 'unlock_gate';
      introVoicePlayed = false;
      introVoiceDelay = 0.85;
      dogWhineTimer = 1.6;
      barrierLineSpoken = false;
      trishulCollected = false;
      crawlersDefeated = 0;
      runesBroken = 0;
      endingPanTimer = 0;
      noWeaponWarningTimer = 0;
      bossEntity = null;

      ctx.setTrishulEquipped(false);
      ctx.setActiveCombatEnemy(null);
      ctx.unregisterCombatEnemy('boss_aghori_dwarpal');
      ctx.clearCameraOverride();

      // Reset Outer Gate & Haveli Door
      fw.outerGateUnlocked = false;
      fw.outerGateOpenAmount = 0;
      fw.outerGateLeftPivot.rotation.y = 0;
      fw.outerGateRightPivot.rotation.y = 0;
      fw.outerGatePadlock.visible = true;

      fw.haveliDoorUnlocked = false;
      fw.haveliDoorOpenAmount = 0;
      fw.haveliDoorLeftPivot.rotation.y = 0;
      fw.haveliDoorRightPivot.rotation.y = 0;
      fw.redBarrierMesh.visible = true;

      // Reset Shrine Trishul pickup
      fw.trishulPickupGroup.visible = true;

      // Reset 3 Rune Stones
      fw.runeStones.forEach((r) => {
        r.broken = false;
        r.hp = r.maxHp;
        r.hitFlash = 0;
        r.crystalMesh.visible = true;
        r.ringMesh.visible = true;
        r.tetherMesh.visible = true;
        if (r.light) r.light.intensity = 2.8;
      });

      // Reset Boss hidden until 3rd Rune Stone breaks
      fw.boss.root.visible = false;
      fw.boss.state = 'hidden';
      fw.boss.hp = fw.boss.maxHp;
      fw.boss.slamRing.visible = false;
      fw.boss.ashPoints.visible = false;

      resetEnemiesForCheckpoint(ctx, false);

      ctx.setCheckpoint(
        {
          id: 'start',
          label: 'Village Outer Iron Gate',
          x: 0,
          z: 34.4,
          yaw: 0,
        },
        false
      );
    },

    onCheckpointRevive: (ctx: ChapterRuntimeContext, checkpointId: string) => {
      const fw = ctx.forestWorld;
      ctx.clearCameraOverride();

      if (checkpointId === 'before_boss') {
        ctx.setTrishulEquipped(true);
        trishulCollected = true;
        stage = 'boss_fight';
        // Keep courtyard clean and reset Aghori Dwarpal cleanly for a fresh boss duel
        resetEnemiesForCheckpoint(ctx, true);
        fw.crawlers.forEach((c) => {
          c.alive = false;
          c.root.visible = false;
        });
        ctx.unregisterCombatEnemy('boss_aghori_dwarpal');
        spawnBoss(ctx);
      } else if (checkpointId === 'shiva_shrine') {
        ctx.setTrishulEquipped(true);
        trishulCollected = true;
        if (stage === 'boss_fight') {
          stage = 'shatter_runes';
        }
        resetEnemiesForCheckpoint(ctx, false);
      } else {
        resetEnemiesForCheckpoint(ctx, false);
      }
      ctx.emitHud();
    },

    canPlayerAttack: (ctx: ChapterRuntimeContext): boolean => {
      if (!ctx.trishulEquipped) {
        if (noWeaponWarningTimer <= 0) {
          noWeaponWarningTimer = 2.8;
          ctx.audio.playFlashlightClick();
          ctx.audio.speakProtagonistLine(
            'मेरे पास कोई हथियार नहीं है... पहले शिव मंदिर से त्रिशूल उठाना होगा!',
            'Mere paas koi hathiyaar nahi hai... pehle Shiva Shrine se Trishul uthana hoga!',
            3200
          );
        }
        return false;
      }
      return true;
    },

    onPlayerMeleeSwing: (ctx: ChapterRuntimeContext, forwardDir: THREE.Vector3): boolean => {
      if (!ctx.trishulEquipped || stage !== 'shatter_runes') return false;
      const fw = ctx.forestWorld;
      let hitRune = false;
      for (let i = 0; i < fw.runeStones.length; i++) {
        const rune = fw.runeStones[i];
        if (rune.broken) continue;
        _toTarget.set(rune.position.x - ctx.playerPos.x, 0, rune.position.z - ctx.playerPos.z);
        const dist = _toTarget.length();
        if (dist > 3.45) continue;
        const dot = dist > 0.01 ? (_toTarget.x * forwardDir.x + _toTarget.z * forwardDir.z) / dist : 1;
        if (dot < 0.25 && dist > 1.35) continue;
        rune.hitFlash = 1.0;
        shatterRuneStone(rune, ctx);
        hitRune = true;
        break;
      }
      return hitRune;
    },

    update: (ctx: ChapterRuntimeContext, dt: number, timeSec: number) => {
      const fw = ctx.forestWorld;
      fw.updateVisuals(dt, timeSec);

      if (noWeaponWarningTimer > 0) {
        noWeaponWarningTimer = Math.max(0, noWeaponWarningTimer - dt);
      }

      // Phase 1: Dog whimpering & Protagonist Hindi voice at Village Outer Iron Gate
      if (stage === 'unlock_gate') {
        const gateAuraMat = fw.outerGateAura.material as THREE.MeshBasicMaterial;
        gateAuraMat.opacity = 0.36 + Math.sin(timeSec * 4.5) * 0.16;

        if (!introVoicePlayed) {
          introVoiceDelay -= dt;
          if (introVoiceDelay <= 0) {
            introVoicePlayed = true;
            ctx.audio.playDogWhimper();
            ctx.audio.speakProtagonistLine(
              'अरे ये कुत्ता भी यहीं रुक गया... लगता है इस फाटक के उस पार सच में कुछ गड़बड़ है।',
              'Are ye kutta bhi yahin ruk gaya... lagta hai is phaatak ke us paar sach mein kuch gadbad hai.',
              6400
            );
          }
        }
        dogWhineTimer -= dt;
        if (dogWhineTimer <= 0) {
          dogWhineTimer = 5.5 + Math.random() * 2.5;
          if (ctx.playerPos.z > 27) {
            ctx.audio.playDogBark(false, false);
          }
        }
      } else {
        (fw.outerGateAura.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      // Phase 2: Shiva Shrine Sacred Trishul pulsing golden aura
      const trishulAuraMat = fw.trishulPickupAura.material as THREE.MeshBasicMaterial;
      if (!trishulCollected && stage === 'stealth_to_shrine') {
        trishulAuraMat.opacity = 0.42 + Math.sin(timeSec * 5.2) * 0.18;
        fw.trishulPickupGroup.rotation.y = Math.sin(timeSec * 1.4) * 0.18;
      } else {
        trishulAuraMat.opacity = 0;
      }

      // Phase 3: Realize red barrier when player nears sealed Haveli Main Door
      if (stage === 'shatter_runes' && !barrierLineSpoken && ctx.playerPos.z < -20.5) {
        barrierLineSpoken = true;
        ctx.audio.speakProtagonistLine(
          'दरवाज़े पर लाल तांत्रिक कवच है! अहाते में छिपे तीनों चमकते मंत्र-पत्थर त्रिशूल से तोड़ने होंगे!',
          'Darwaze par laal tantrik kavach hai! Ahaate mein chhipe teenon mantra-patthar Trishul se todne honge!',
          5600
        );
      }

      // Courtyard Jumpable Thorns hazard check
      if (stage === 'shatter_runes' || stage === 'boss_fight') {
        for (let i = 0; i < fw.thorns.length; i++) {
          const th = fw.thorns[i];
          const d = Math.hypot(ctx.playerPos.x - th.position.x, ctx.playerPos.z - th.position.z);
          if (d < th.radius && ctx.playerFeetY < th.clearanceY) {
            const pushX = d > 0.05 ? ((ctx.playerPos.x - th.position.x) / d) * 0.9 : 0;
            const pushZ = d > 0.05 ? ((ctx.playerPos.z - th.position.z) / d) * 0.9 : 0.9;
            ctx.damagePlayer(
              35,
              'You stepped onto razor-sharp courtyard thorns! Use Jump to leap cleanly over them.',
              'thorn',
              pushX,
              pushZ
            );
          }
        }
      }

      // Update Shadow Crawlers & Aghori Boss
      updateCrawlers(ctx, dt, timeSec);
      updateBoss(ctx, dt, timeSec);

      // Cinematic Ending Pan into the newly opened Haveli Main Doors!
      if (stage === 'ending_pan') {
        endingPanTimer += dt;
        const t = Math.min(1, endingPanTimer / 3.0);
        const smooth = t * t * (3 - 2 * t);
        _camPos.set(
          THREE.MathUtils.lerp(ctx.playerPos.x, 0, smooth * 0.85),
          THREE.MathUtils.lerp(1.7, 2.25, smooth),
          THREE.MathUtils.lerp(ctx.playerPos.z, -24.5, smooth)
        );
        _camLook.set(0, 2.35, -37.5);
        ctx.setCameraOverride(_camPos, _camLook);
        if (endingPanTimer >= 3.1) {
          stage = 'done';
          ctx.clearCameraOverride();
          ctx.completeChapter();
        }
      }
    },

    interact: (ctx: ChapterRuntimeContext): boolean => {
      const fw = ctx.forestWorld;

      // 1. Unlock Village Outer Iron Gate with Chapter 1 Iron Key
      if (stage === 'unlock_gate') {
        const dGate = Math.hypot(
          ctx.playerPos.x - fw.outerGatePos.x,
          ctx.playerPos.z - fw.outerGatePos.z
        );
        if (dGate < 3.4) {
          fw.outerGateUnlocked = true;
          fw.outerGatePadlock.visible = false;
          stage = 'stealth_to_shrine';
          ctx.resetProgressTimer();
          ctx.triggerInteractImpulse(1.0);
          ctx.spawnBurst(_burstPos.set(0, 1.5, 30.0), 0xffc864);
          ctx.audio.playGateUnlock();
          ctx.audio.playCrawlerScreech(false);
          ctx.audio.speakProtagonistLine(
            'फाटक खुल गया... अरे! आगे जंगल में लाल आँखों वाले पिशाच घूम रहे हैं! झुककर शिव मंदिर तक पहुँचना होगा।',
            'Phaatak khul gaya... aage jungle mein laal aankhon wale Pishach ghoom rahe hain! Jhukkar Shiva Shrine tak pahunchna hoga.',
            5800
          );
          ctx.emitHud();
          return true;
        }
      }

      // 2. Pick up Sacred Iron Trishul & Flaming Torch at Ruined Shiva Shrine -> Checkpoint 1
      if (!trishulCollected && (stage === 'stealth_to_shrine' || stage === 'shatter_runes')) {
        const dTrishul = Math.hypot(
          ctx.playerPos.x - fw.trishulPickupPos.x,
          ctx.playerPos.z - fw.trishulPickupPos.z
        );
        if (dTrishul < 3.2) {
          trishulCollected = true;
          fw.trishulPickupGroup.visible = false;
          stage = 'shatter_runes';
          ctx.setTrishulEquipped(true);
          ctx.healPlayerFull();
          ctx.resetProgressTimer();
          ctx.triggerInteractImpulse(1.0);
          ctx.spawnBurst(fw.trishulPickupPos, 0xffaa38);
          ctx.audio.playTempleBell(0.95);
          ctx.setCheckpoint(
            {
              id: 'shiva_shrine',
              label: 'Shiva Shrine (Trishul Equipped)',
              x: fw.shrinePos.x + 2.4,
              z: fw.shrinePos.z,
              yaw: 0,
            },
            true
          );
          ctx.audio.speakProtagonistLine(
            'ये पुराना लोहे का त्रिशूल और जलती मशाल... अब इन शापित पिशाचों का सामना करना पड़ेगा!',
            'Ye purana lohe ka Trishul aur jalti mashal... ab in shapit Pishachon ka saamna karna padega!',
            5400
          );
          ctx.emitHud();
          return true;
        }
      }

      // 3. Also allow shattering a Rune Stone via Interact/USE if Trishul is equipped & standing close
      if (stage === 'shatter_runes' && trishulCollected) {
        for (let i = 0; i < fw.runeStones.length; i++) {
          const r = fw.runeStones[i];
          if (r.broken) continue;
          if (Math.hypot(ctx.playerPos.x - r.position.x, ctx.playerPos.z - r.position.z) < 2.85) {
            ctx.audio.playTrishulSwing();
            return shatterRuneStone(r, ctx);
          }
        }
      }

      // 4. Sealed Haveli Main Door remains locked until Aghori Dwarpal is defeated
      if (
        !fw.haveliDoorUnlocked &&
        Math.hypot(ctx.playerPos.x - fw.haveliDoorPos.x, ctx.playerPos.z - fw.haveliDoorPos.z) < 4.5
      ) {
        ctx.triggerInteractImpulse(0.55);
        ctx.audio.playLockedChainRattle();
        ctx.audio.showHintSubtitle(
          'यह रास्ता अभी बंद है — आगे के अध्याय में खुलेगा।',
          'Yeh raasta abhi band hai — aage ke adhyay mein khulega.',
          3800
        );
        ctx.emitHud();
        return true;
      }

      return false;
    },

    getPrompt: (ctx: ChapterRuntimeContext): ChapterPrompt | null => {
      const fw = ctx.forestWorld;

      if (stage === 'unlock_gate') {
        if (
          Math.hypot(ctx.playerPos.x - fw.outerGatePos.x, ctx.playerPos.z - fw.outerGatePos.z) <
          3.4
        ) {
          return { text: 'Unlock Outer Iron Gate (Iron Haveli Key)', key: 'E' };
        }
      }

      if (!trishulCollected && stage === 'stealth_to_shrine') {
        if (
          Math.hypot(
            ctx.playerPos.x - fw.trishulPickupPos.x,
            ctx.playerPos.z - fw.trishulPickupPos.z
          ) < 3.2
        ) {
          return { text: 'Equip Sacred Iron Trishul & Flaming Torch', key: 'E' };
        }
      }

      if (stage === 'shatter_runes' && trishulCollected) {
        for (let i = 0; i < fw.runeStones.length; i++) {
          const r = fw.runeStones[i];
          if (r.broken) continue;
          if (Math.hypot(ctx.playerPos.x - r.position.x, ctx.playerPos.z - r.position.z) < 3.1) {
            return { text: `Shatter ${r.label} (ATTACK or USE)`, key: 'E' };
          }
        }
      }

      if (
        !fw.haveliDoorUnlocked &&
        Math.hypot(ctx.playerPos.x - fw.haveliDoorPos.x, ctx.playerPos.z - fw.haveliDoorPos.z) < 4.5
      ) {
        return {
          text:
            stage === 'boss_fight'
              ? 'Haveli Main Door Locked — Defeat Aghori Dwarpal'
              : `Locked Haveli Main Door — Shatter ${Math.max(0, 3 - runesBroken)} Rune ${3 - runesBroken === 1 ? 'Stone' : 'Stones'}`,
          key: 'E',
        };
      }

      return null;
    },

    getProgress: (): number => {
      let score = 0;
      if (stage !== 'unlock_gate') score += 1; // Gate unlocked
      if (trishulCollected) score += 1; // Trishul equipped
      score += runesBroken; // +3 for 3 Rune Stones
      if (stage === 'ending_pan' || stage === 'done') score += 1; // Boss defeated
      return Math.min(6, score);
    },

    getObjectiveText: (): string => {
      switch (stage) {
        case 'unlock_gate':
          return 'Unlock the Village Outer Iron Gate using your Iron Haveli Key';
        case 'stealth_to_shrine':
          return 'Sneak (Crouch/Prone behind logs) to the Ruined Shiva Shrine to find a weapon';
        case 'shatter_runes':
          return `Shatter 3 Glowing Rune Stones in the Haveli Courtyard with the Trishul (${runesBroken}/3)`;
        case 'boss_fight':
          return 'BOSS FIGHT: Dodge Aghori Dwarpal’s Gada slam (Sprint/Jump) & strike with Trishul!';
        case 'ending_pan':
        case 'done':
          return 'The Haveli Main Doors swing open — stepping inside...';
      }
    },

    getHint: (ctx: ChapterRuntimeContext): string | null => {
      if (stage === 'unlock_gate') {
        return 'Walk straight ahead to the rusted Village Outer Iron Gate and press E / USE.';
      }
      if (stage === 'stealth_to_shrine') {
        return 'Look for the warm orange Dhuni fire west of the forest path — the Ruined Shiva Shrine holds the Sacred Trishul.';
      }
      if (stage === 'shatter_runes') {
        const nextRune = ctx.forestWorld.runeStones.find((r) => !r.broken);
        return nextRune
          ? `Follow the crimson energy tether to the ${nextRune.locationName} and strike the Rune Stone!`
          : null;
      }
      if (stage === 'boss_fight') {
        return 'When his Gada glows bright red, Sprint sideways or Jump over the shockwave, then strike during his pause!';
      }
      return null;
    },

    getMinimapObjectives: (ctx: ChapterRuntimeContext): MinimapObjective[] => {
      const fw = ctx.forestWorld;
      if (stage === 'unlock_gate') {
        return [
          {
            id: 'obj_outer_gate',
            x: fw.outerGatePos.x,
            z: fw.outerGatePos.z,
            label: 'Outer Gate',
            kind: 'gate',
            urgent: true,
          },
        ];
      }
      if (stage === 'stealth_to_shrine') {
        return [
          {
            id: 'obj_shiva_trishul',
            x: fw.trishulPickupPos.x,
            z: fw.trishulPickupPos.z,
            label: 'Shiva Shrine (Trishul)',
            kind: 'trishul',
            urgent: true,
          },
        ];
      }
      if (stage === 'shatter_runes') {
        return fw.runeStones
          .filter((r) => !r.broken)
          .map((r) => ({
            id: r.id,
            x: r.position.x,
            z: r.position.z,
            label: r.label,
            kind: 'rune' as const,
            urgent: true,
          }));
      }
      if (stage === 'boss_fight') {
        return [
          {
            id: 'obj_aghori_boss',
            x: fw.boss.position.x,
            z: fw.boss.position.z,
            label: 'Aghori Dwarpal',
            kind: 'boss',
            urgent: true,
          },
        ];
      }
      return [
        {
          id: 'obj_haveli_door',
          x: fw.haveliDoorPos.x,
          z: fw.haveliDoorPos.z,
          label: 'Haveli Door',
          kind: 'haveli_door',
          urgent: true,
        },
      ];
    },

    isMovementLocked: (): boolean => stage === 'ending_pan' || stage === 'done',
  };
}
