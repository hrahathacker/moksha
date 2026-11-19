import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Flashlight, Flame, Hand, Lock } from 'lucide-react';
import { PlayerStance } from '../game/types';

interface MobileControlsProps {
  flashlightOn: boolean;
  isHiding: boolean;
  hasPrompt: boolean;
  stance: PlayerStance;
  stamina: number;
  attackCooldownRemaining: number;
  attackCooldownTotal: number;
  touchSensitivity: number;
  onMoveVector: (x: number, y: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onSprintChange: (sprinting: boolean) => void;
  onInteract: () => void;
  onToggleFlashlight: () => void;
  onJump: () => void;
  onToggleCrouch: () => void;
  onToggleProne: () => void;
  onAttack: () => void;
}

const JOY_MAX_RADIUS = 46;
const JOY_DEADZONE = 0.14; // Prevents accidental thumb drift
const JOY_SPRINT_THRESHOLD = 0.7; // 0..70% walk, 70..100% forward auto-sprint
const LOCK_BADGE_OFFSET_Y = 98; // Pixels directly above joystick center

/** Clean custom kneeling silhouette icon for Crouch */
const CrouchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="13" cy="5.5" r="2.2" />
    <path d="M12 8.5l-2.5 4.2 4.5 1.8v4.5" />
    <path d="M9.5 12.7L7 17.5h4.2" />
    <path d="M11.5 10l3.5 1.4" />
  </svg>
);

/** Clean custom lying-flat crawling silhouette icon for Prone */
const ProneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="18.2" cy="12.5" r="2.1" />
    <path d="M4 16.5h12.2l1.8-1.5" />
    <path d="M15.5 15l1.5 2.5h2.5" />
    <path d="M4 16.5l-1.5-2" />
  </svg>
);

export const MobileControls: React.FC<MobileControlsProps> = ({
  flashlightOn,
  isHiding,
  hasPrompt,
  stance,
  stamina,
  attackCooldownRemaining,
  attackCooldownTotal,
  touchSensitivity,
  onMoveVector,
  onLookDelta,
  onSprintChange,
  onInteract,
  onToggleFlashlight,
  onJump,
  onToggleCrouch,
  onToggleProne,
  onAttack,
}) => {
  const [joyActive, setJoyActive] = useState(false);
  const [joyAnchor, setJoyAnchor] = useState({ x: 96, y: 260 });
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [sprinting, setSprinting] = useState(false);
  const [showLockBadge, setShowLockBadge] = useState(false);
  const [lockHover, setLockHover] = useState(false);
  const [autoSprintLocked, setAutoSprintLocked] = useState(false);

  // Strict per-finger touch.identifier tracking so movement, look, and action buttons NEVER clash
  const joyTouchId = useRef<number | null>(null);
  const joyOrigin = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });
  const lockHoverRef = useRef(false);
  const autoSprintRef = useRef(false);
  const stanceRef = useRef<PlayerStance>(stance);
  const lastTouchActionTime = useRef(0);

  const onMoveVectorRef = useRef(onMoveVector);
  const onSprintChangeRef = useRef(onSprintChange);
  onMoveVectorRef.current = onMoveVector;
  onSprintChangeRef.current = onSprintChange;
  stanceRef.current = stance;

  const cancelAutoSprint = useCallback(() => {
    if (!autoSprintRef.current) return;
    autoSprintRef.current = false;
    setAutoSprintLocked(false);
    setSprinting(false);
    onSprintChangeRef.current(false);
    if (joyTouchId.current === null) {
      onMoveVectorRef.current(0, 0);
    }
  }, []);

  // Cancel Auto-Sprint immediately if player switches to Crouch/Prone or hides in Almirah
  useEffect(() => {
    if (stance !== 'standing' || isHiding) {
      if (autoSprintRef.current) {
        cancelAutoSprint();
      } else if (sprinting) {
        setSprinting(false);
        onSprintChangeRef.current(false);
      }
    }
  }, [stance, isHiding, sprinting, cancelAutoSprint]);

  // Cleanly release movement/sprint ONLY when MobileControls actually unmounts
  useEffect(() => {
    return () => {
      joyTouchId.current = null;
      lookTouchId.current = null;
      autoSprintRef.current = false;
      onMoveVectorRef.current(0, 0);
      onSprintChangeRef.current(false);
    };
  }, []);

  const updateJoyFromPoint = (cx: number, cy: number) => {
    const dx = cx - joyOrigin.current.x;
    const dy = cy - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOY_MAX_RADIUS);
    const ang = Math.atan2(dy, dx);
    const ox = Math.cos(ang) * clamped;
    const oy = Math.sin(ang) * clamped;
    setKnobOffset({ x: ox, y: oy });

    const norm = clamped / JOY_MAX_RADIUS;
    if (norm <= JOY_DEADZONE) {
      setSprinting(false);
      setShowLockBadge(false);
      setLockHover(false);
      lockHoverRef.current = false;
      onMoveVectorRef.current(0, 0);
      onSprintChangeRef.current(false);
      return;
    }

    const scaled = (norm - JOY_DEADZONE) / (1 - JOY_DEADZONE);
    const moveX = Math.cos(ang) * scaled;
    const moveY = -Math.sin(ang) * scaled; // +1 = forward (up on screen)
    onMoveVectorRef.current(moveX, moveY);

    const canSprint = stanceRef.current === 'standing';
    // Forward cone check (dragging upward toward top of ring)
    const forwardAlignment = -dy / Math.max(1, dist);
    const draggingForward = canSprint && forwardAlignment > 0.45 && norm >= 0.52;

    // 0%..70% radius = normal walk; 70%..100% forward drag = auto-activate Sprint!
    const shouldSprint = canSprint && norm >= JOY_SPRINT_THRESHOLD && forwardAlignment > 0.42;
    setSprinting(shouldSprint);
    onSprintChangeRef.current(shouldSprint);

    // Show Auto-Sprint Lock badge directly above joystick ring when dragging forward
    setShowLockBadge(draggingForward);

    // Check if thumb slid up onto the glowing Auto-Sprint Lock badge
    const lockCenterX = joyOrigin.current.x;
    const lockCenterY = joyOrigin.current.y - LOCK_BADGE_OFFSET_Y;
    const distToLock = Math.hypot(cx - lockCenterX, cy - lockCenterY);
    const overLock =
      draggingForward &&
      (distToLock <= 36 || (dy <= -(JOY_MAX_RADIUS + 20) && Math.abs(dx) <= 44));
    lockHoverRef.current = overLock;
    setLockHover(overLock);
  };

  // =========================================================
  // LEFT 45% ZONE: PUBG / BGMI FLOATING JOYSTICK + AUTO-SPRINT LOCK
  // =========================================================
  const handleLeftZoneStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Touching left joystick immediately cancels active Auto-Sprint so thumb regains control
    if (autoSprintRef.current) {
      autoSprintRef.current = false;
      setAutoSprintLocked(false);
      setSprinting(false);
      onSprintChangeRef.current(false);
    }

    if (joyTouchId.current !== null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) continue;

      joyTouchId.current = t.identifier;
      const vw = window.innerWidth || 800;
      const vh = window.innerHeight || 400;
      // Keep joystick ring + top Auto-Sprint Lock badge cleanly inside safe screen bounds
      const clampedX = Math.max(70, Math.min(vw * 0.42, t.clientX));
      const clampedY = Math.max(132, Math.min(vh - 70, t.clientY));
      joyOrigin.current = { x: clampedX, y: clampedY };
      setJoyAnchor({ x: clampedX, y: clampedY });
      setJoyActive(true);
      setKnobOffset({ x: 0, y: 0 });
      setShowLockBadge(false);
      setLockHover(false);
      lockHoverRef.current = false;
      onMoveVectorRef.current(0, 0);
      onSprintChangeRef.current(false);
      break;
    }
  };

  const handleLeftZoneMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoyFromPoint(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleLeftZoneEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (joyTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setJoyActive(false);
        setKnobOffset({ x: 0, y: 0 });
        setShowLockBadge(false);

        if (lockHoverRef.current && stanceRef.current === 'standing') {
          // Engage hands-free Auto-Sprint Lock!
          lockHoverRef.current = false;
          setLockHover(false);
          autoSprintRef.current = true;
          setAutoSprintLocked(true);
          setSprinting(true);
          onMoveVectorRef.current(0, 1);
          onSprintChangeRef.current(true);
        } else {
          lockHoverRef.current = false;
          setLockHover(false);
          setSprinting(false);
          onMoveVectorRef.current(0, 0);
          onSprintChangeRef.current(false);
        }
        break;
      }
    }
  };

  // =========================================================
  // RIGHT 55% ZONE: SMOOTH TOUCH-DRAG CAMERA ROTATION (OPEN MIDDLE-RIGHT)
  // =========================================================
  const handleLookZoneStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (lookTouchId.current !== null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) continue;
      lookTouchId.current = t.identifier;
      lastLookPos.current = { x: t.clientX, y: t.clientY };
      break;
    }
  };

  const handleLookZoneMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (lookTouchId.current === null) return;

    const sens = Math.max(0.4, Math.min(2.5, touchSensitivity));
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const rawDx = t.clientX - lastLookPos.current.x;
        const rawDy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };

        const clampedDx = Math.max(-90, Math.min(90, rawDx));
        const clampedDy = Math.max(-90, Math.min(90, rawDy));
        onLookDelta(clampedDx * 1.48 * sens, clampedDy * 1.28 * sens);
        break;
      }
    }
  };

  const handleLookZoneEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  // =========================================================
  // INSTANT TOUCHSTART ACTION BUTTONS (ZERO 300ms DELAY, ZERO CLASH)
  // =========================================================
  const fireInstantAction = (action: () => void, isTouch: boolean) => {
    const now = performance.now();
    if (isTouch) {
      lastTouchActionTime.current = now;
      action();
    } else if (now - lastTouchActionTime.current > 450) {
      action();
    }
  };

  const makeActionHandlers = (action: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fireInstantAction(action, true);
    },
    onTouchMove: (e: React.TouchEvent) => {
      e.stopPropagation();
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      fireInstantAction(action, false);
    },
  });

  // Cooldown SVG ring math for primary Attack button
  const cooldownProgress =
    attackCooldownTotal > 0 ? Math.max(0, Math.min(1, attackCooldownRemaining / attackCooldownTotal)) : 0;
  const ringRadius = 33;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - cooldownProgress);
  const attackReady = attackCooldownRemaining <= 0.05 && stamina >= 20 && !isHiding;

  return (
    <div className="fixed inset-0 z-15 pointer-events-none select-none touch-none">
      {/* LEFT 45% SCREEN: Floating PUBG Movement Joystick Surface */}
      <div
        className="pointer-events-auto absolute top-14 bottom-0 left-0 w-[45%] touch-none select-none"
        onTouchStart={handleLeftZoneStart}
        onTouchMove={handleLeftZoneMove}
        onTouchEnd={handleLeftZoneEnd}
        onTouchCancel={handleLeftZoneEnd}
      />

      {/* RIGHT 55% SCREEN: Open Camera Look Surface */}
      <div
        className="pointer-events-auto absolute top-14 bottom-0 left-[45%] right-0 touch-none select-none"
        onTouchStart={handleLookZoneStart}
        onTouchMove={handleLookZoneMove}
        onTouchEnd={handleLookZoneEnd}
        onTouchCancel={handleLookZoneEnd}
      />

      {/* ========================================================= */}
      {/* ACTIVE AUTO-SPRINT LOCK BADGE (DRAG-TO-LOCK ABOVE RING)   */}
      {/* ========================================================= */}
      {joyActive && showLockBadge && (
        <div
          className="pointer-events-none fixed flex flex-col items-center"
          style={{
            left: `${joyAnchor.x - 24}px`,
            top: `${joyAnchor.y - LOCK_BADGE_OFFSET_Y - 24}px`,
          }}
        >
          <div
            className="w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-transform duration-100"
            style={{
              transform: lockHover ? 'scale(1.16)' : 'scale(1)',
              borderColor: lockHover ? '#ffe29c' : 'rgba(229, 169, 76, 0.82)',
              backgroundColor: lockHover ? 'rgba(218, 146, 38, 0.92)' : 'rgba(18, 14, 8, 0.86)',
              color: lockHover ? '#120d06' : '#f7d58b',
              boxShadow: lockHover
                ? '0 0 18px rgba(242, 186, 78, 0.78)'
                : '0 0 10px rgba(229, 169, 76, 0.35)',
            }}
          >
            <Lock className="w-4 h-4" />
            <span className="text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5">
              Lock
            </span>
          </div>
          <div
            className="w-0.5 h-6"
            style={{
              backgroundColor: lockHover ? 'rgba(255, 224, 146, 0.9)' : 'rgba(229, 169, 76, 0.45)',
            }}
          />
        </div>
      )}

      {/* Tappable Cancel Pill when Auto-Sprint Lock is actively running */}
      {autoSprintLocked && !joyActive && (
        <button
          type="button"
          aria-label="Cancel Auto-Sprint"
          {...makeActionHandlers(cancelAutoSprint)}
          className="pointer-events-auto fixed px-3 py-1.5 rounded-full border-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer touch-none select-none active:scale-95 transition-transform"
          style={{
            left: 'max(22px, var(--sal))',
            bottom: 'calc(max(18px, var(--sab)) + 124px)',
            borderColor: '#f4c56a',
            backgroundColor: 'rgba(166, 108, 26, 0.92)',
            color: '#fff6de',
            boxShadow: '0 0 14px rgba(235, 174, 66, 0.48)',
          }}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Auto Sprint · Tap to Stop</span>
        </button>
      )}

      {/* Visual Floating Joystick Ring (Gold inner thumbstick + Sprint halo) */}
      <div
        className="pointer-events-none fixed w-28 h-28 rounded-full border flex items-center justify-center transition-opacity duration-100"
        style={
          joyActive
            ? {
                left: `${joyAnchor.x - 56}px`,
                top: `${joyAnchor.y - 56}px`,
                borderColor: sprinting ? 'rgba(244, 194, 92, 0.88)' : 'rgba(229, 169, 76, 0.55)',
                backgroundColor: 'rgba(6, 12, 14, 0.58)',
                opacity: 1,
              }
            : {
                left: 'max(22px, var(--sal))',
                bottom: 'max(18px, var(--sab))',
                borderColor: autoSprintLocked ? 'rgba(244, 194, 92, 0.85)' : 'rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(6, 12, 14, 0.44)',
                opacity: autoSprintLocked ? 0.96 : 0.78,
              }
        }
      >
        {/* Subtle 70% walk-to-sprint inner dashed threshold ring */}
        <span
          className="absolute rounded-full border border-dashed pointer-events-none"
          style={{
            width: '78px',
            height: '78px',
            borderColor: sprinting ? 'rgba(244, 194, 92, 0.55)' : 'rgba(255, 255, 255, 0.14)',
          }}
        />
        <span className="absolute top-2 w-1 h-1 rounded-full bg-white/35" />
        <span className="absolute bottom-2 w-1 h-1 rounded-full bg-white/30" />
        <span className="absolute left-2 w-1 h-1 rounded-full bg-white/30" />
        <span className="absolute right-2 w-1 h-1 rounded-full bg-white/30" />

        {/* Gold Inner Thumbstick */}
        <div
          className="w-11 h-11 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: sprinting || autoSprintLocked ? '#ffe099' : 'rgba(229, 169, 76, 0.9)',
            backgroundColor:
              sprinting || autoSprintLocked ? 'rgba(235, 168, 56, 0.52)' : 'rgba(229, 169, 76, 0.32)',
            transform: autoSprintLocked && !joyActive
              ? `translate3d(0px, -${JOY_MAX_RADIUS * 0.85}px, 0)`
              : `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        >
          {(sprinting || autoSprintLocked) && (
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#fff6dc]">
              RUN
            </span>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ERGONOMIC BOTTOM-RIGHT 6-BUTTON MOBILE FPS ACTION ARC     */}
      {/* (Middle-right viewport kept completely open for Look!)    */}
      {/* ========================================================= */}

      {/* 1. PRIMARY ATTACK / HOLY TORCH STRIKE (Bottom-right anchor with SVG cooldown ring) */}
      <button
        type="button"
        aria-label="Torch Strike Attack"
        {...makeActionHandlers(onAttack)}
        className="pointer-events-auto absolute p-2 flex items-center justify-center cursor-pointer touch-none select-none active:scale-95 transition-transform"
        style={{
          right: 'max(10px, var(--sar))',
          bottom: 'max(8px, var(--sab))',
        }}
      >
        <span
          className="relative w-[72px] h-[72px] rounded-full border-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{
            borderColor: attackReady ? 'rgba(244, 192, 86, 0.92)' : 'rgba(255, 255, 255, 0.22)',
            backgroundColor: attackReady ? 'rgba(138, 74, 18, 0.86)' : 'rgba(6, 12, 14, 0.78)',
            color: attackReady ? '#fff3d4' : '#8da0a2',
          }}
        >
          {/* SVG Circular Cooldown Sweep Ring */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
            viewBox="0 0 72 72"
            aria-hidden="true"
          >
            <circle
              cx="36"
              cy="36"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3"
            />
            {cooldownProgress > 0.01 && (
              <circle
                cx="36"
                cy="36"
                r={ringRadius}
                fill="none"
                stroke="#f4be58"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
              />
            )}
          </svg>
          <Flame className="w-5 h-5" />
          <span className="font-mono-tabular leading-none">
            {attackCooldownRemaining > 0.05 ? `${Math.ceil(attackCooldownRemaining)}s` : 'Strike'}
          </span>
        </span>
      </button>

      {/* 2. USE / INTERACT (Contextual crimson-gold button just left of Attack) */}
      <button
        type="button"
        aria-label={isHiding ? 'Exit hiding spot' : 'Interact or hide'}
        {...makeActionHandlers(onInteract)}
        className="pointer-events-auto absolute p-1.5 flex items-center justify-center cursor-pointer touch-none select-none active:scale-95 transition-transform"
        style={{
          right: 'calc(max(10px, var(--sar)) + 84px)',
          bottom: 'max(12px, var(--sab))',
        }}
      >
        <span
          className={`w-[58px] h-[58px] rounded-full border-2 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            hasPrompt || isHiding
              ? 'border-[#f0b450] text-[#fff2d6]'
              : 'border-white/25 text-[#c6d5d6]'
          }`}
          style={{
            backgroundColor:
              hasPrompt || isHiding ? 'rgba(184, 52, 38, 0.9)' : 'rgba(6, 12, 14, 0.78)',
          }}
        >
          <Hand className="w-4 h-4" />
          <span>{isHiding ? 'Exit' : 'Use'}</span>
        </span>
      </button>

      {/* 3. TORCH (Inner lower arc left of Use) */}
      <button
        type="button"
        aria-label={flashlightOn ? 'Turn off flashlight' : 'Turn on flashlight'}
        {...makeActionHandlers(onToggleFlashlight)}
        className="pointer-events-auto absolute p-1.5 flex items-center justify-center cursor-pointer touch-none select-none active:scale-95 transition-transform"
        style={{
          right: 'calc(max(10px, var(--sar)) + 152px)',
          bottom: 'max(12px, var(--sab))',
        }}
      >
        <span
          className={`w-[48px] h-[48px] rounded-full border flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider ${
            flashlightOn
              ? 'border-[#e5a94c]/90 text-[#fae0ab]'
              : 'border-white/25 text-[#9fb1b3]'
          }`}
          style={{
            backgroundColor: flashlightOn ? 'rgba(130, 82, 22, 0.8)' : 'rgba(6, 12, 14, 0.78)',
          }}
        >
          <Flashlight className="w-4 h-4" />
          <span className="leading-none">Torch</span>
        </span>
      </button>

      {/* 4. JUMP (Directly above Attack — also smoothly stands up from Crouch/Prone) */}
      <button
        type="button"
        aria-label={stance !== 'standing' ? 'Stand up' : 'Jump'}
        {...makeActionHandlers(onJump)}
        className="pointer-events-auto absolute p-1.5 flex items-center justify-center cursor-pointer touch-none select-none active:scale-95 transition-transform"
        style={{
          right: 'calc(max(10px, var(--sar)) + 10px)',
          bottom: 'calc(max(8px, var(--sab)) + 86px)',
        }}
      >
        <span
          className="w-[54px] h-[54px] rounded-full border flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{
            borderColor: stance !== 'standing' ? 'rgba(229, 169, 76, 0.7)' : 'rgba(255, 255, 255, 0.28)',
            backgroundColor: 'rgba(6, 12, 14, 0.78)',
            color: stance !== 'standing' ? '#f7d896' : '#dce6e7',
          }}
        >
          <ArrowUp className="w-4 h-4" />
          <span className="leading-none">{stance !== 'standing' ? 'Stand' : 'Jump'}</span>
        </span>
      </button>

      {/* 5. CROUCH (Arced left of Jump — toggles Crouch & immediately cancels Auto-Sprint) */}
      <button
        type="button"
        aria-label={stance === 'crouching' ? 'Stand up from crouch' : 'Crouch'}
        {...makeActionHandlers(() => {
          cancelAutoSprint();
          onToggleCrouch();
        })}
        className="pointer-events-auto absolute p-1.5 flex items-center justify-center cursor-pointer touch-none select-none active:scale-95 transition-transform"
        style={{
          right: 'calc(max(10px, var(--sar)) + 74px)',
          bottom: 'calc(max(8px, var(--sab)) + 76px)',
        }}
      >
        <span
          className="w-[50px] h-[50px] rounded-full border flex flex-col items-center justify-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider"
          style={{
            borderColor: stance === 'crouching' ? '#f4be58' : 'rgba(255, 255, 255, 0.25)',
            backgroundColor:
              stance === 'crouching' ? 'rgba(148, 96, 26, 0.86)' : 'rgba(6, 12, 14, 0.78)',
            color: stance === 'crouching' ? '#fff3d4' : '#c6d6d7',
          }}
        >
          <CrouchIcon className="w-4 h-4" />
          <span className="leading-none">Crouch</span>
        </span>
      </button>

      {/* 6. PRONE (Arced left of Crouch — toggles Prone & immediately cancels Auto-Sprint) */}
      <button
        type="button"
        aria-label={stance === 'prone' ? 'Stand up from prone' : 'Go prone'}
        {...makeActionHandlers(() => {
          cancelAutoSprint();
          onToggleProne();
        })}
        className="pointer-events-auto absolute p-1.5 flex items-center justify-center cursor-pointer touch-none select-none active:scale-95 transition-transform"
        style={{
          right: 'calc(max(10px, var(--sar)) + 134px)',
          bottom: 'calc(max(8px, var(--sab)) + 64px)',
        }}
      >
        <span
          className="w-[50px] h-[50px] rounded-full border flex flex-col items-center justify-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider"
          style={{
            borderColor: stance === 'prone' ? '#f4be58' : 'rgba(255, 255, 255, 0.25)',
            backgroundColor:
              stance === 'prone' ? 'rgba(148, 96, 26, 0.86)' : 'rgba(6, 12, 14, 0.78)',
            color: stance === 'prone' ? '#fff3d4' : '#c6d6d7',
          }}
        >
          <ProneIcon className="w-4 h-4" />
          <span className="leading-none">Prone</span>
        </span>
      </button>
    </div>
  );
};
