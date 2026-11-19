import * as THREE from 'three';
import { HorrorAudioManager } from './audio';
import { HaveliWorld, WaypointNode } from './haveliMap';
import { GhostRig } from './models';
import { DifficultyConfig, EnemyCombatEntity, GhostAIState } from './types';

const _toPlayer = new THREE.Vector3();
const _ghostFwd = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _cameraRight = new THREE.Vector3();
const _staggerGold = new THREE.Color(0xffc95c);
const _horrorFaceBase = new THREE.Color(0x10181a);
const _blackColor = new THREE.Color(0x000000);

export interface GhostTickResult {
  distanceToPlayer: number;
  state: GhostAIState;
  caughtPlayer: boolean;
  escapedChase: boolean;
  justStartedChase: boolean;
  proximityIntensity: number; // 0..1
}

export class GhostAIController implements EnemyCombatEntity {
  public readonly id = 'cursed_bride_spirit';
  public readonly name = 'Dulhan Ki Aatma';
  public readonly hindiName = 'दुल्हन की आत्मा';
  public readonly isBossOrMortal = false;
  public hp = 999;
  public maxHp = 999;
  public isDefeated = false;

  public state: GhostAIState = 'patrol';
  public readonly position = new THREE.Vector3(0, 0, -11.5);
  public yaw = 0;

  private readonly rig: GhostRig;
  private readonly world: HaveliWorld;
  private readonly audio: HorrorAudioManager;

  private path: number[] = [];
  private currentWaypointId = 8; // Start in far North Pooja Room
  private investigateTarget = new THREE.Vector3();
  private stateTimer = 0;
  private staggerTimer = 0;
  private knockbackVel = new THREE.Vector3();
  private glideVel = new THREE.Vector3();
  private currentBankRoll = 0;
  private currentLeanPitch = 0;
  private loseSightTimer = 0;
  private payalTimer = 0;
  private patrolVoiceTimer = 11;
  private wailTimer = 16;
  private knockTimer = 25;
  private nearVoiceCooldown = 0;
  private headTwitchTimer = 2.4;
  private headTwitchPulse = 0;
  private sawPlayerHide = false;
  private wasChasing = false;
  private shantiTime = 0;

  public get isStaggered(): boolean {
    return this.state === 'staggered' && this.staggerTimer > 0;
  }

  constructor(rig: GhostRig, world: HaveliWorld, audio: HorrorAudioManager) {
    this.rig = rig;
    this.world = world;
    this.audio = audio;
    this.reset();
  }

  public reset(): void {
    this.state = 'patrol';
    this.position.set(0, 0, -11.5);
    this.yaw = 0;
    this.currentWaypointId = 8;
    this.path = [];
    this.stateTimer = 0;
    this.staggerTimer = 0;
    this.knockbackVel.set(0, 0, 0);
    this.glideVel.set(0, 0, 0);
    this.currentBankRoll = 0;
    this.currentLeanPitch = 0;
    this.loseSightTimer = 0;
    this.payalTimer = 0.8;
    this.patrolVoiceTimer = 10;
    this.wailTimer = 14;
    this.knockTimer = 22;
    this.nearVoiceCooldown = 0;
    this.sawPlayerHide = false;
    this.wasChasing = false;
    this.shantiTime = 0;
    this.hp = this.maxHp;
    this.isDefeated = false;

    const posAttr = this.rig.shantiParticles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = 0.08 + (((i * 17) % 100) / 100) * 0.36;
      posAttr.setXYZ(i, Math.cos(ang) * rad, (((i * 31) % 100) / 100) * 1.65, Math.sin(ang) * rad);
    }
    posAttr.needsUpdate = true;
    this.rig.setDissolve(0);
    this.rig.bodyGroup.rotation.set(0, 0, 0);
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;
  }

  public setTitleShowcasePose(elapsed: number, highDetailCloth = true): void {
    this.rig.setDissolve(0);
    this.rig.root.position.set(-4.55, 0.06 + Math.sin(elapsed * 1.7) * 0.04, -4.65);
    this.rig.root.rotation.y = 0.72;
    this.rig.bodyGroup.rotation.set(0.05, 0, Math.sin(elapsed * 1.1) * 0.03);
    this.rig.headGroup.rotation.set(
      0.06,
      Math.sin(elapsed * 0.8) * 0.14,
      Math.sin(elapsed * 2.3) > 0.94 ? 0.34 : 0.08
    );
    this.rig.leftArm.rotation.set(-0.5, 0, 0.2);
    this.rig.rightArm.rotation.set(-0.25, 0, -0.08);
    this.rig.updateClothWave(elapsed, 0.8, highDetailCloth);
  }

  public notifyNoise(sourcePos: THREE.Vector3, range: number, stealthFactor = 1.0): void {
    if (this.state === 'shanti' || this.state === 'chase' || this.state === 'staggered') return;
    const effectiveRange = range * Math.max(0.2, Math.min(1, stealthFactor));
    const dist = this.position.distanceTo(sourcePos);
    if (dist <= effectiveRange) {
      this.state = 'investigate';
      this.investigateTarget.copy(sourcePos);
      this.stateTimer = 6.5;
      this.planPathTo(sourcePos);
    }
  }

  public notifyPlayerEnteredAlmirah(playerPos: THREE.Vector3): void {
    const dist = this.position.distanceTo(playerPos);
    const hasLos = this.world.hasLineOfSight(this.position, playerPos);
    // Fairer stealth rule: only caught if she was literally right behind you (< 5.2m) watching you climb in
    this.sawPlayerHide = this.state === 'chase' && hasLos && dist < 5.2;
    if (!this.sawPlayerHide && dist < 10) {
      this.notifyNoise(playerPos, 10, 1.0);
    }
  }

  /** EnemyCombatEntity: Immortal story spirit cannot be slain, but holy-ward strikes stagger & repel her! */
  public takeDamage(_amount: number, knockbackDir?: { x: number; z: number }): boolean {
    if (this.state === 'shanti') return false;
    this.stagger(2.0, knockbackDir);
    return true;
  }

  public stagger(durationSec: number, knockbackDir?: { x: number; z: number }): void {
    if (this.state === 'shanti') return;
    this.state = 'staggered';
    this.staggerTimer = Math.max(this.staggerTimer, durationSec);
    this.loseSightTimer = 0;
    this.sawPlayerHide = false;
    if (knockbackDir) {
      const len = Math.hypot(knockbackDir.x, knockbackDir.z) || 1;
      this.knockbackVel.set((knockbackDir.x / len) * 5.2, 0, (knockbackDir.z / len) * 5.2);
    } else {
      this.knockbackVel.set(-Math.sin(this.yaw) * 4.5, 0, -Math.cos(this.yaw) * 4.5);
    }
    this.audio.playGhostStaggerShriek();
  }

  public onDefeat(): void {
    // Story ghost is freed via the Moksha ritual rather than slain
  }

  public triggerShanti(): void {
    this.state = 'shanti';
    this.shantiTime = 0;
    this.staggerTimer = 0;
    this.audio.speakGhostLine('victory', true);
    this.audio.playShantiChord();
  }

  private findNearestWaypoint(pos: THREE.Vector3): number {
    let bestId = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.world.waypoints.length; i++) {
      const wp = this.world.waypoints[i];
      const dx = wp.pos.x - pos.x;
      const dz = wp.pos.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestId = wp.id;
      }
    }
    return bestId;
  }

  private planPathTo(targetPos: THREE.Vector3): void {
    const startId = this.findNearestWaypoint(this.position);
    const goalId = this.findNearestWaypoint(targetPos);
    if (startId === goalId) {
      this.path = [goalId];
      return;
    }

    const queue: number[] = [startId];
    const visited = new Set<number>([startId]);
    const parent = new Map<number, number>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === goalId) break;
      const node: WaypointNode = this.world.waypoints[curr];
      for (let i = 0; i < node.neighbors.length; i++) {
        const next = node.neighbors[i];
        if (!visited.has(next)) {
          visited.add(next);
          parent.set(next, curr);
          queue.push(next);
        }
      }
    }

    const rev: number[] = [];
    let step: number | undefined = goalId;
    while (step !== undefined && step !== startId) {
      rev.push(step);
      step = parent.get(step);
    }
    rev.reverse();
    this.path = rev.length > 0 ? rev : [goalId];
  }

  private pickNextPatrolWaypoint(): void {
    const curr = this.world.waypoints[this.currentWaypointId];
    const targetId = Math.floor(Math.random() * this.world.waypoints.length);
    if (targetId === curr.id) {
      const fallback = curr.neighbors[Math.floor(Math.random() * curr.neighbors.length)];
      this.path = [fallback];
    } else {
      this.planPathTo(this.world.waypoints[targetId].pos);
    }
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    cameraQuaternion: THREE.Quaternion,
    flashlightOn: boolean,
    isHiding: boolean,
    climaxActive: boolean,
    inGracePeriod: boolean,
    config: DifficultyConfig,
    stealthFactor = 1.0,
    isConcealed = false,
    highDetailCloth = true
  ): GhostTickResult {
    // 1. Movie-Like 4-Act Victory Shanti Ascension & Stardust Dissolution (8.4s)
    if (this.state === 'shanti') {
      this.shantiTime += dt;
      const progress = Math.min(1, this.shantiTime / 8.4);

      const lift =
        progress < 0.25
          ? 0.45 + (progress / 0.25) * 0.35
          : 0.8 + Math.pow((progress - 0.25) / 0.75, 1.45) * 3.85;

      this.rig.root.position.set(0, lift, 0);
      this.rig.root.rotation.y = progress * Math.PI * 1.15;
      this.rig.bodyGroup.rotation.set(0, 0, 0);

      const skyTilt = -0.05 - Math.min(1, progress * 1.8) * 0.36;
      this.rig.headGroup.rotation.set(skyTilt, Math.sin(this.shantiTime * 0.7) * 0.06, 0);

      const armSpread = Math.min(1, progress * 2.1);
      this.rig.leftArm.rotation.set(-0.35 - armSpread * 0.45, 0, 0.22 + armSpread * 0.58);
      this.rig.rightArm.rotation.set(-0.35 - armSpread * 0.45, 0, -0.22 - armSpread * 0.58);
      this.rig.hairGroup.rotation.z = Math.sin(this.shantiTime * 1.6) * 0.03;
      this.rig.shantiHalo.rotation.z = this.shantiTime * 0.75;
      this.rig.updateClothWave(elapsed, 1.4, highDetailCloth);

      this.rig.setDissolve(progress);

      const posAttr = this.rig.shantiParticles.geometry.attributes.position as THREE.BufferAttribute;
      const vels = this.rig.shantiVelocities;
      const swirlRate = 1.6 + progress * 2.4;
      for (let i = 0; i < posAttr.count; i++) {
        let px = posAttr.getX(i);
        let py = posAttr.getY(i);
        let pz = posAttr.getZ(i);

        const c = Math.cos(swirlRate * dt);
        const s = Math.sin(swirlRate * dt);
        const nx = px * c - pz * s;
        const nz = px * s + pz * c;

        const expand = progress > 0.38 ? 1 + dt * 0.55 : 1 + dt * 0.12;
        px = nx * expand + vels[i * 3] * dt * 0.35;
        py = py + vels[i * 3 + 1] * dt * (0.45 + progress * 1.35);
        pz = nz * expand + vels[i * 3 + 2] * dt * 0.35;

        posAttr.setXYZ(i, px, py, pz);
      }
      posAttr.needsUpdate = true;

      return {
        distanceToPlayer: this.position.distanceTo(playerPos),
        state: 'shanti',
        caughtPlayer: false,
        escapedChase: false,
        justStartedChase: false,
        proximityIntensity: 0,
      };
    }

    let escapedChase = false;
    let justStartedChase = false;

    _toPlayer.subVectors(playerPos, this.position);
    _toPlayer.y = 0;
    const dist = _toPlayer.length();

    // 1B. STAGGERED STATE (2.0s Holy Torch Bash recoil & knockback!)
    if (this.state === 'staggered') {
      this.staggerTimer -= dt;
      if (this.knockbackVel.lengthSq() > 0.01) {
        this.position.addScaledVector(this.knockbackVel, dt);
        this.world.resolvePlayerCollision(this.position, 0.36);
        const damp = Math.exp(-5.4 * dt);
        this.knockbackVel.multiplyScalar(damp);
      }

      const wardPulse = Math.max(0, Math.min(1, this.staggerTimer / 2.0));
      this.rig.sareeMaterial.emissive.copy(_staggerGold);
      this.rig.sareeMaterial.emissiveIntensity = wardPulse * 0.9;
      this.rig.faceMaterial.emissive.copy(_staggerGold);
      this.rig.faceMaterial.emissiveIntensity = 0.35 + wardPulse * 1.1;

      const recoilShake = Math.sin(elapsed * 34) * 0.08 * wardPulse;
      this.rig.root.position.set(this.position.x + recoilShake, 0.08, this.position.z);
      this.rig.root.rotation.y = this.yaw;
      this.rig.bodyGroup.rotation.set(-0.22 * wardPulse, 0, recoilShake * 2.2);
      this.rig.headGroup.rotation.set(-0.42 * wardPulse, Math.sin(elapsed * 22) * 0.32, Math.cos(elapsed * 28) * 0.36);
      this.rig.leftArm.rotation.set(-1.35 * wardPulse, 0, 0.55 * wardPulse);
      this.rig.rightArm.rotation.set(-1.35 * wardPulse, 0, -0.55 * wardPulse);
      this.rig.updateClothWave(elapsed, 3.2 * wardPulse, highDetailCloth);

      if (this.staggerTimer <= 0) {
        this.rig.sareeMaterial.emissive.copy(_blackColor);
        this.rig.sareeMaterial.emissiveIntensity = 0;
        this.rig.faceMaterial.emissive.copy(_horrorFaceBase);
        this.rig.faceMaterial.emissiveIntensity = 0.35;
        this.state = climaxActive ? 'chase' : 'search';
        this.stateTimer = 2.6;
        this.path = [];
      }

      const distFactor = Math.max(0, Math.min(1, 1 - (dist - 1.5) / 13.5));
      return {
        distanceToPlayer: dist,
        state: this.state,
        caughtPlayer: false,
        escapedChase: false,
        justStartedChase: false,
        proximityIntensity: distFactor * 0.55,
      };
    }

    const hasLos = this.world.hasLineOfSight(this.position, playerPos);

    // Stereo pan for spatial horror SFX
    _cameraRight.set(1, 0, 0).applyQuaternion(cameraQuaternion);
    const pan =
      dist > 0.2
        ? (_cameraRight.x * _toPlayer.x * -1 + _cameraRight.z * _toPlayer.z * -1) / dist
        : 0;

    // Apply real stealth detection radius scaling (75% reduction when concealed in corner or under furniture!)
    const clampedStealth = Math.max(0.25, Math.min(1, stealthFactor));
    const baseVisionRange = flashlightOn ? config.visionRangeLit : config.visionRangeDark;
    const visionRange = baseVisionRange * clampedStealth;

    _ghostFwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const facingDot = dist > 0.01 ? _ghostFwd.dot(_toPlayer) / dist : 1;
    const closeSenseDist = 3.4 * clampedStealth;
    const inVisionCone = facingDot > 0.22 || dist < closeSenseDist;

    // When safely concealed (almirah, dark corner crouch, or prone under furniture with torch OFF),
    // ghost cannot spot the player unless she literally bumps into them (< 0.92m) or saw them enter!
    const safelyHidden = (isHiding || isConcealed) && !flashlightOn && !this.sawPlayerHide;
    const physicalCollisionReveal = isConcealed && !isHiding && dist < 0.92;

    const canSeePlayer =
      !inGracePeriod &&
      hasLos &&
      ((!safelyHidden && dist < visionRange && inVisionCone) || physicalCollisionReveal);

    if (climaxActive) {
      if (this.state !== 'chase') {
        this.state = 'chase';
        justStartedChase = true;
        this.audio.playChaseSting();
        this.audio.speakGhostLine('ritual', true);
      }
      if (!isHiding || flashlightOn) {
        this.investigateTarget.copy(playerPos);
      } else {
        this.investigateTarget.set(
          Math.cos(elapsed * 0.7) * 3.4,
          0,
          Math.sin(elapsed * 0.7) * 3.4
        );
      }
    } else if (canSeePlayer) {
      if (this.state !== 'chase') {
        this.state = 'chase';
        this.wasChasing = true;
        justStartedChase = true;
        this.audio.playChaseSting();
        this.audio.speakGhostLine('spot');
      }
      this.loseSightTimer = 2.8;
      this.investigateTarget.copy(playerPos);
    } else if (this.state === 'chase') {
      this.loseSightTimer -= dt;
      if (safelyHidden) {
        this.loseSightTimer -= dt * 2.2;
      }
      if (this.loseSightTimer <= 0) {
        this.state = 'search';
        this.stateTimer = 3.6;
        this.audio.speakGhostLine('near');
        if (this.wasChasing) {
          escapedChase = true;
          this.wasChasing = false;
        }
      }
    } else if (this.state === 'search') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'patrol';
        this.sawPlayerHide = false;
        this.pickNextPatrolWaypoint();
      }
    } else if (this.state === 'investigate') {
      this.stateTimer -= dt;
      if (this.position.distanceTo(this.investigateTarget) < 1.15 || this.stateTimer <= 0) {
        this.state = 'search';
        this.stateTimer = 2.6;
      }
    }

    // Periodic eerie ghost vocals, corridor weeping wails, and hollow knocks
    this.patrolVoiceTimer -= dt;
    if (this.state === 'patrol' && this.patrolVoiceTimer <= 0 && dist < 18) {
      this.audio.speakGhostLine('patrol');
      this.patrolVoiceTimer = 13 + Math.random() * 8;
    }

    this.wailTimer -= dt;
    if (this.wailTimer <= 0 && dist > 4.5 && dist < 22) {
      this.audio.playGhostWail(dist, pan);
      this.wailTimer = 15 + Math.random() * 12;
    }

    this.knockTimer -= dt;
    if (this.knockTimer <= 0 && this.state !== 'chase') {
      this.audio.playDistantKnock();
      this.knockTimer = 24 + Math.random() * 16;
    }

    this.nearVoiceCooldown -= dt;
    if (!inGracePeriod && dist < 5.5 && this.nearVoiceCooldown <= 0 && this.state !== 'chase') {
      this.audio.speakGhostLine('near');
      this.nearVoiceCooldown = 14;
    }

    // Determine movement speed & target
    let speed = inGracePeriod ? config.patrolSpeed * 0.45 : config.patrolSpeed;
    let moveGoal: THREE.Vector3 | null = null;

    if (inGracePeriod) {
      // Gently hover around North Pooja Room during start grace period
      moveGoal = this.world.waypoints[8].pos;
      if (this.position.distanceTo(moveGoal) < 0.8) speed = 0;
    } else if (this.state === 'chase') {
      speed = climaxActive ? config.climaxSpeed : config.chaseSpeed;
      if (hasLos && dist < 11) {
        moveGoal = this.investigateTarget;
      } else {
        if (this.path.length === 0 || Math.random() < dt * 2.2) {
          this.planPathTo(this.investigateTarget);
        }
        if (this.path.length > 0) {
          moveGoal = this.world.waypoints[this.path[0]].pos;
        }
      }
    } else if (this.state === 'investigate') {
      speed = config.investigateSpeed;
      if (this.path.length > 0) {
        moveGoal = this.world.waypoints[this.path[0]].pos;
      } else {
        moveGoal = this.investigateTarget;
      }
    } else if (this.state === 'patrol') {
      speed = config.patrolSpeed;
      if (this.path.length === 0) {
        this.pickNextPatrolWaypoint();
      }
      if (this.path.length > 0) {
        moveGoal = this.world.waypoints[this.path[0]].pos;
      }
    } else {
      speed = 0;
      this.yaw += Math.sin(elapsed * 2.1) * dt * 1.5;
    }

    // Velocity-damped smooth ghostly gliding (eliminates stiff robot sliding) + auto-opening closed wing doors
    let targetVx = 0;
    let targetVz = 0;
    let yawTurnRate = 0;

    if (moveGoal && speed > 0) {
      _moveDir.subVectors(moveGoal, this.position);
      _moveDir.y = 0;
      const rem = _moveDir.length();
      if (rem < 0.65 && this.path.length > 0) {
        this.currentWaypointId = this.path.shift()!;
      } else if (rem > 0.05) {
        _moveDir.divideScalar(rem);
        // Subtle ghostly lateral weave when gliding through corridors
        const weave = Math.sin(elapsed * (this.state === 'chase' ? 3.2 : 1.7)) * (this.state === 'chase' ? 0.14 : 0.08);
        const dirX = _moveDir.x - _moveDir.z * weave;
        const dirZ = _moveDir.z + _moveDir.x * weave;
        const norm = Math.hypot(dirX, dirZ) || 1;
        targetVx = (dirX / norm) * speed;
        targetVz = (dirZ / norm) * speed;

        const targetYaw = Math.atan2(_moveDir.x, _moveDir.z);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        yawTurnRate = diff;
        this.yaw += diff * Math.min(1, dt * (this.state === 'chase' ? 7.5 : 5.2));
      }
    }

    const velDamp = this.state === 'chase' ? 7.2 : 4.8;
    this.glideVel.x = THREE.MathUtils.damp(this.glideVel.x, targetVx, velDamp, dt);
    this.glideVel.z = THREE.MathUtils.damp(this.glideVel.z, targetVz, velDamp, dt);

    const currentSpeed = Math.hypot(this.glideVel.x, this.glideVel.z);
    if (currentSpeed > 0.02) {
      this.position.x += this.glideVel.x * dt;
      this.position.z += this.glideVel.z * dt;

      // If the ghost glides up to a closed hinged wing door, dramatically swing it creaking open!
      for (let d = 0; d < this.world.hingedDoors.length; d++) {
        const door = this.world.hingedDoors[d];
        if (!door.isOpen && door.ghostPushCooldown <= 0) {
          const doorDist = Math.hypot(
            this.position.x - door.interactPos.x,
            this.position.z - door.interactPos.z
          );
          if (doorDist < 1.85) {
            door.isOpen = true;
            door.ghostPushCooldown = 3.5;
            if (dist < 18) {
              this.audio.playWoodCreak();
            }
          }
        }
      }

      // Ghost passes smoothly through doors she just pushed open while respecting all solid walls
      this.world.resolvePlayerCollision(this.position, 0.36, 0, 1.75, true);
    }

    // Eerie floating hover, predatory chase forward lean, banking tilt, head-twitch & cloth sway
    const hoverFreq = this.state === 'chase' ? 4.4 : 2.15;
    const hoverY = 0.08 + Math.sin(elapsed * hoverFreq) * 0.055 + Math.cos(elapsed * hoverFreq * 0.5) * 0.018;
    this.rig.root.position.set(this.position.x, hoverY, this.position.z);
    this.rig.root.rotation.y = this.yaw;

    const targetLean = this.state === 'chase' ? 0.16 : currentSpeed > 0.2 ? 0.07 : 0.02;
    const targetBank = Math.max(-0.14, Math.min(0.14, -yawTurnRate * 0.12));
    this.currentLeanPitch = THREE.MathUtils.damp(this.currentLeanPitch, targetLean, 5.5, dt);
    this.currentBankRoll = THREE.MathUtils.damp(this.currentBankRoll, targetBank, 5.5, dt);
    this.rig.bodyGroup.rotation.set(
      this.currentLeanPitch,
      0,
      this.currentBankRoll + Math.sin(elapsed * 1.8) * 0.024
    );

    this.headTwitchTimer -= dt;
    if (this.headTwitchTimer <= 0) {
      this.headTwitchPulse = 0.26 + Math.random() * 0.24;
      this.headTwitchTimer =
        this.state === 'chase' ? 0.5 + Math.random() * 0.85 : 1.7 + Math.random() * 2.6;
    }
    if (this.headTwitchPulse > 0) {
      this.headTwitchPulse -= dt;
      const snapSign = Math.sin(elapsed * 42) >= 0 ? 1 : -1;
      this.rig.headGroup.rotation.z = snapSign * (0.34 + Math.random() * 0.18);
      this.rig.headGroup.rotation.y = (Math.random() - 0.5) * 0.48;
      this.rig.headGroup.rotation.x = -0.1 + (Math.random() - 0.5) * 0.22;
    } else {
      this.rig.headGroup.rotation.z = THREE.MathUtils.damp(
        this.rig.headGroup.rotation.z,
        Math.sin(elapsed * 1.4) * 0.11,
        7.5,
        dt
      );
      this.rig.headGroup.rotation.y = THREE.MathUtils.damp(
        this.rig.headGroup.rotation.y,
        Math.sin(elapsed * 0.9) * 0.06,
        7.5,
        dt
      );
      this.rig.headGroup.rotation.x = THREE.MathUtils.damp(
        this.rig.headGroup.rotation.x,
        this.state === 'chase' ? -0.14 : 0.04,
        7.5,
        dt
      );
    }

    const targetArmX =
      this.state === 'chase'
        ? -1.2 + Math.sin(elapsed * 7) * 0.12
        : -0.08 + Math.sin(elapsed * 2) * 0.05;
    this.rig.leftArm.rotation.x = THREE.MathUtils.damp(this.rig.leftArm.rotation.x, targetArmX, 6, dt);
    this.rig.rightArm.rotation.x = THREE.MathUtils.damp(
      this.rig.rightArm.rotation.x,
      targetArmX * 0.92,
      6,
      dt
    );
    this.rig.leftArm.rotation.z = THREE.MathUtils.damp(
      this.rig.leftArm.rotation.z,
      this.state === 'chase' ? 0.14 : 0.05,
      5,
      dt
    );
    this.rig.rightArm.rotation.z = THREE.MathUtils.damp(
      this.rig.rightArm.rotation.z,
      this.state === 'chase' ? -0.14 : -0.05,
      5,
      dt
    );

    // Drive live saree, veil & hair cloth wave animation (High: vertex ripples; Low: lightweight sway)
    this.rig.updateClothWave(elapsed, currentSpeed, highDetailCloth);

    // Spatial distance-attenuated silver payal / ghungroo anklet chimes
    this.payalTimer -= dt;
    if (this.payalTimer <= 0 && speed > 0) {
      this.audio.playPayalChime(dist, pan);
      this.payalTimer = this.state === 'chase' ? 0.42 : 0.88;
    }

    const distFactor = Math.max(0, Math.min(1, 1 - (dist - 1.5) / 13.5));
    const proximityIntensity = inGracePeriod
      ? distFactor * 0.25
      : Math.min(1, distFactor * (this.state === 'chase' ? 1.25 : 0.82) + (climaxActive ? 0.28 : 0));

    const canCatch =
      !inGracePeriod && (!safelyHidden || physicalCollisionReveal);
    const caughtPlayer = canCatch && dist < (isConcealed && !isHiding ? 0.88 : 1.05);

    return {
      distanceToPlayer: dist,
      state: this.state,
      caughtPlayer,
      escapedChase,
      justStartedChase,
      proximityIntensity,
    };
  }
}
