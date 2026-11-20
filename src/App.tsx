import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AIStoryModal } from './components/AIStoryModal';
import { ChapterCompleteModal } from './components/ChapterCompleteModal';
import { EndScreen } from './components/EndScreen';
import { GameHud } from './components/GameHud';
import { InjuredReviveModal } from './components/InjuredReviveModal';
import { LandscapeGate } from './components/LandscapeGate';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { MobileControls } from './components/MobileControls';
import { NoteModal } from './components/NoteModal';
import { PauseMenu } from './components/PauseMenu';
import { OfflineIndicator } from './components/PWAInstallButton';
import { TitleScreen } from './components/TitleScreen';
import {
  FINAL_CHAPTER_ID,
  TOTAL_CHAPTERS,
  getNextChapterId,
  isValidChapterId,
} from './chapters/chapterRegistry';
import {
  acquireScreenWakeLock,
  enterAndroidLandscapeFullscreen,
  isFullscreenActive,
  releaseScreenWakeLock,
  toggleFullscreenMode,
} from './game/androidViewport';
import { MokshaGameEngine } from './game/engine';
import { BUILT_IN_VICTORY_SONG } from './game/storyData';
import {
  ChapterNumber,
  Difficulty,
  GameSettings,
  GraphicsQuality,
  HudSnapshot,
} from './game/types';

const COMPLETED_STORAGE_KEY = 'moksha_completed_chapters_v3';
const TOUCH_SENS_STORAGE_KEY = 'moksha_touch_sens_v1';
const HOME_INTRO_SONG_URL = '/assets/aistudio/MOKSHA__Game_Intro_Rap__Chaurasi_Fix__2d20d95d.mp3';

function loadTouchSensitivity(): number {
  try {
    const raw = window.localStorage.getItem(TOUCH_SENS_STORAGE_KEY);
    if (!raw) return 1.0;
    const val = parseFloat(raw);
    return Number.isFinite(val) ? Math.max(0.5, Math.min(2.0, val)) : 1.0;
  } catch {
    return 1.0;
  }
}

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  chapter: 1,
  totalChapters: TOTAL_CHAPTERS,
  isOutdoor: true,
  chapterProgress: 0,
  chapterTarget: 6,
  chapterTaskLabel: 'Trail Milestones',
  itemsCollectedCount: 0,
  itemsPlacedCount: 0,
  placedItems: [],
  holdingItem: null,
  playerHealth: 100,
  damageFlash: 0,
  checkpointBanner: null,
  injuredReason: null,
  activeCheckpointLabel: 'Village Path Start',
  stamina: 100,
  battery: 100,
  flashlightOn: true,
  trishulEquipped: false,
  bpm: 72,
  maxBpm: 72,
  isHiding: false,
  nearPrompt: null,
  promptKey: 'E',
  roomName: 'Misty Village Path',
  climaxRemaining: 10,
  elapsedSeconds: 0,
  jumpscaresSurvived: 0,
  hintMessage: null,
  proximityIntensity: 0,
  subtitle: null,
  activeNote: null,
  pointerLocked: false,
  ghostState: 'patrol',
  jumpscareFlash: 0,
  shantiProgress: 0,
  graceRemaining: 0,
  objectiveText: 'Turn around and follow the barking dog into the village outskirts',
  mapData: {
    mode: 'haveli',
    playerX: 0,
    playerZ: 11.4,
    playerYaw: 0,
    ghostX: 0,
    ghostZ: -11.5,
    ghostYaw: 0,
    ghostRoom: 'Pooja Room',
    ghostDistance: 23,
    objectives: [],
    almirahs: [],
  },
  stance: 'standing',
  isConcealed: false,
  stealthReason: 'none',
  attackCooldownRemaining: 0,
  attackCooldownTotal: 6,
  attackHitFlash: 0,
  headroomBlocked: false,
  activeCombatEnemy: null,
};

function loadCompletedChapters(): ChapterNumber[] {
  try {
    const raw = window.localStorage.getItem(COMPLETED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidChapterId);
  } catch {
    return [];
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MokshaGameEngine | null>(null);
  const titleBgmRef = useRef<HTMLAudioElement | null>(null);
  const draggingLookRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });
  const victorySongAutoStartedRef = useRef(false);

  const [titleBgmBlocked, setTitleBgmBlocked] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissPortraitGate, setDismissPortraitGate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedChapter, setSelectedChapter] = useState<ChapterNumber>(1);
  const [completedChapters, setCompletedChapters] = useState<ChapterNumber[]>(() =>
    typeof window !== 'undefined' ? loadCompletedChapters() : []
  );
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => ({
    difficulty: 'normal',
    quality: 'high',
    volume: 0.78,
    muted: false,
    touchSensitivity: typeof window !== 'undefined' ? loadTouchSensitivity() : 1.0,
  }));

  // Pre-built Instant Victory Ghost Song ("Moksha Geet") playback state
  const [songPlaying, setSongPlaying] = useState(false);
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);

  const markChapterCompleted = useCallback((ch: ChapterNumber) => {
    setCompletedChapters((prev) => {
      if (prev.includes(ch)) return prev;
      const next = [...prev, ch].sort((a, b) => a - b);
      try {
        window.localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  }, []);

  // Detect touch-capable devices, portrait/landscape orientation, and fullscreen state
  useEffect(() => {
    const syncViewport = () => {
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
      setIsTouchDevice(hasTouch);

      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      const portrait = hasTouch && h > w * 1.02;
      setIsPortraitMobile(portrait);
      if (!portrait) {
        // Reset dismiss so if player rotates back to portrait later, gate works again cleanly
        setDismissPortraitGate(false);
      }
      setIsFullscreen(isFullscreenActive());
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    document.addEventListener('fullscreenchange', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      document.removeEventListener('fullscreenchange', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
    };
  }, []);

  // Keep Android screen awake during active gameplay & cutscenes
  useEffect(() => {
    const active =
      hud.phase === 'playing' ||
      hud.phase === 'climax' ||
      hud.phase === 'victory' ||
      hud.phase === 'story';
    if (active) {
      void acquireScreenWakeLock();
    } else {
      void releaseScreenWakeLock();
    }
    return () => {
      void releaseScreenWakeLock();
    };
  }, [hud.phase]);

  // Android Hardware Back Button / Gesture support: Pause or close modals instead of closing APK
  useEffect(() => {
    const handlePopState = () => {
      if (showGuideModal) {
        setShowGuideModal(false);
        window.history.pushState({ moksha: true }, '');
      } else if (mapExpanded) {
        setMapExpanded(false);
        window.history.pushState({ moksha: true }, '');
      } else if (hud.phase === 'note') {
        engineRef.current?.resumeGame();
        window.history.pushState({ moksha: true }, '');
      } else if (hud.phase === 'playing' || hud.phase === 'climax') {
        engineRef.current?.pauseGame();
        window.history.pushState({ moksha: true }, '');
      }
    };

    if (hud.phase !== 'title') {
      window.history.pushState({ moksha: true }, '');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hud.phase, showGuideModal, mapExpanded]);

  // Persist completed chapters automatically
  useEffect(() => {
    if (hud.phase === 'chapter_complete') {
      markChapterCompleted(hud.chapter);
      setMapExpanded(false);
    } else if (hud.phase === 'victory') {
      markChapterCompleted(FINAL_CHAPTER_ID);
      setMapExpanded(false);
    } else if (
      hud.phase === 'gameover' ||
      hud.phase === 'injured' ||
      hud.phase === 'paused' ||
      hud.phase === 'title'
    ) {
      setMapExpanded(false);
    }
  }, [hud.phase, hud.chapter, markChapterCompleted]);

  // Keyboard shortcuts (M for map, Esc for modals)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (showGuideModal) {
          e.preventDefault();
          setShowGuideModal(false);
        } else if (mapExpanded) {
          e.preventDefault();
          setMapExpanded(false);
        }
        return;
      }
      if (e.code === 'KeyM' && (hud.phase === 'playing' || hud.phase === 'climax') && !showGuideModal) {
        e.preventDefault();
        setMapExpanded((prev) => {
          const next = !prev;
          if (next) {
            engineRef.current?.releasePointerLock();
          } else {
            engineRef.current?.requestPointerLock();
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showGuideModal, mapExpanded, hud.phase]);

  // Mount isolated Three.js engine once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new MokshaGameEngine(container, 'normal', 'high', (snapshot) => {
      setHud(snapshot);
    });
    engine.audio.setSongListener((playing, lyricIndex) => {
      setSongPlaying(playing);
      setActiveLyricIndex(lyricIndex);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Start pre-built Moksha Geet IMMEDIATELY when entering the Victory movie finale
  useEffect(() => {
    if (hud.phase !== 'victory') {
      victorySongAutoStartedRef.current = false;
      return;
    }
    if (!victorySongAutoStartedRef.current) {
      victorySongAutoStartedRef.current = true;
      void engineRef.current?.audio.startVictorySong(BUILT_IN_VICTORY_SONG);
    }
  }, [hud.phase]);

  // Create persistent looping Home Screen Intro Rap audio element
  useEffect(() => {
    const bgm = new Audio(HOME_INTRO_SONG_URL);
    bgm.loop = true;
    bgm.preload = 'auto';
    titleBgmRef.current = bgm;
    return () => {
      bgm.pause();
      bgm.currentTime = 0;
      bgm.src = '';
      titleBgmRef.current = null;
    };
  }, []);

  // Play/loop Home Intro Song on Title screen, sync volume/mute, and stop cleanly when entering game
  useEffect(() => {
    const bgm = titleBgmRef.current;
    if (!bgm) return;

    const targetVol = settings.muted ? 0 : Math.max(0, Math.min(1, settings.volume * 0.78));
    bgm.volume = targetVol;
    bgm.muted = settings.muted;

    if (hud.phase !== 'title') {
      bgm.pause();
      bgm.currentTime = 0;
      setTitleBgmBlocked(false);
      return;
    }

    if (settings.muted || targetVol <= 0.001) {
      bgm.pause();
      setTitleBgmBlocked(false);
      return;
    }

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled || document.hidden) return;
      const playPromise = bgm.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (!cancelled) setTitleBgmBlocked(false);
          })
          .catch(() => {
            if (!cancelled) setTitleBgmBlocked(true);
          });
      }
    };

    tryPlay();

    const unlockOnGesture = () => {
      if (bgm.paused && !settings.muted && hud.phase === 'title') {
        tryPlay();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        bgm.pause();
      } else if (hud.phase === 'title' && !settings.muted) {
        tryPlay();
      }
    };

    window.addEventListener('pointerdown', unlockOnGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', unlockOnGesture, { capture: true, passive: true });
    window.addEventListener('keydown', unlockOnGesture, { capture: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', unlockOnGesture, true);
      window.removeEventListener('touchstart', unlockOnGesture, true);
      window.removeEventListener('keydown', unlockOnGesture, true);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hud.phase, settings.muted, settings.volume]);

  const handleStartTitleBgm = useCallback(() => {
    const bgm = titleBgmRef.current;
    if (!bgm || hud.phase !== 'title' || settings.muted) return;
    bgm.volume = Math.max(0, Math.min(1, settings.volume * 0.78));
    bgm.muted = false;
    void bgm
      .play()
      .then(() => setTitleBgmBlocked(false))
      .catch(() => setTitleBgmBlocked(true));
  }, [hud.phase, settings.muted, settings.volume]);

  const handleToggleFullscreen = useCallback(() => {
    void toggleFullscreenMode().then((active) => setIsFullscreen(active));
  }, []);

  const handleToggleSong = useCallback(() => {
    const audio = engineRef.current?.audio;
    if (!audio) return;
    if (audio.isVictorySongPlaying()) {
      audio.stopVictorySong();
    } else {
      void audio.startVictorySong(BUILT_IN_VICTORY_SONG);
    }
  }, []);

  const handleReplaySong = useCallback(() => {
    void engineRef.current?.audio.startVictorySong(BUILT_IN_VICTORY_SONG);
  }, []);

  const handleSkipVictoryCutscene = useCallback(() => {
    engineRef.current?.skipVictoryCutscene();
  }, []);

  const handleChangeDifficulty = useCallback((d: Difficulty) => {
    setSettings((prev) => ({ ...prev, difficulty: d }));
    engineRef.current?.setDifficulty(d);
  }, []);

  const handleChangeQuality = useCallback((q: GraphicsQuality) => {
    setSettings((prev) => ({ ...prev, quality: q }));
    engineRef.current?.setGraphicsQuality(q);
  }, []);

  const handleChangeVolume = useCallback((v: number) => {
    setSettings((prev) => ({ ...prev, volume: v, muted: v <= 0.001 }));
    engineRef.current?.audio.unlock();
    engineRef.current?.audio.setMuted(v <= 0.001);
    engineRef.current?.audio.setVolume(v);
  }, []);

  const handleToggleMute = useCallback(() => {
    setSettings((prev) => {
      const nextMuted = !prev.muted;
      engineRef.current?.audio.unlock();
      engineRef.current?.audio.setMuted(nextMuted);
      return { ...prev, muted: nextMuted };
    });
  }, []);

  const handleChangeTouchSensitivity = useCallback((s: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, Math.round(s * 10) / 10));
    setSettings((prev) => ({ ...prev, touchSensitivity: clamped }));
    try {
      window.localStorage.setItem(TOUCH_SENS_STORAGE_KEY, String(clamped));
    } catch {
      // ignore storage restrictions
    }
  }, []);

  const handleStartGame = useCallback(() => {
    setShowGuideModal(false);
    setMapExpanded(false);
    engineRef.current?.audio.unlock();
    engineRef.current?.audio.stopVictorySong();
    engineRef.current?.audio.stopStoryNarration();
    if (isTouchDevice) {
      void enterAndroidLandscapeFullscreen();
    }
    engineRef.current?.startChapterDirect(settings.difficulty, selectedChapter, true);
  }, [settings.difficulty, selectedChapter, isTouchDevice]);

  const handlePlayAgain = useCallback(() => {
    setShowGuideModal(false);
    setMapExpanded(false);
    engineRef.current?.audio.unlock();
    engineRef.current?.audio.stopVictorySong();
    if (isTouchDevice) {
      void enterAndroidLandscapeFullscreen();
    }
    const targetChapter = hud.phase === 'victory' ? 1 : hud.chapter;
    setSelectedChapter(targetChapter);
    engineRef.current?.startChapterDirect(settings.difficulty, targetChapter, false);
    window.setTimeout(() => {
      engineRef.current?.requestPointerLock();
    }, 60);
  }, [settings.difficulty, hud.phase, hud.chapter, isTouchDevice]);

  const handleNextChapter = useCallback(() => {
    const nextCh = getNextChapterId(hud.chapter) ?? FINAL_CHAPTER_ID;
    setSelectedChapter(nextCh);
    setMapExpanded(false);
    engineRef.current?.startChapterDirect(settings.difficulty, nextCh, true);
  }, [settings.difficulty, hud.chapter]);

  const handleReviveAtCheckpoint = useCallback(() => {
    setMapExpanded(false);
    if (isTouchDevice) {
      void enterAndroidLandscapeFullscreen();
    }
    engineRef.current?.reviveAtCheckpoint();
  }, [isTouchDevice]);

  const handleReplayCurrentChapter = useCallback(() => {
    setMapExpanded(false);
    engineRef.current?.startChapterDirect(settings.difficulty, hud.chapter, false);
  }, [settings.difficulty, hud.chapter]);

  const handleAdvanceStoryToBriefing = useCallback(() => {
    engineRef.current?.advanceStoryToBriefing();
  }, []);

  const handleEnterHaveliFromBriefing = useCallback(() => {
    if (isTouchDevice) {
      void enterAndroidLandscapeFullscreen();
    }
    engineRef.current?.enterHaveliFromBriefing();
  }, [isTouchDevice]);

  const handlePause = useCallback(() => {
    setMapExpanded(false);
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    setShowGuideModal(false);
    engineRef.current?.resumeGame();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setShowGuideModal(false);
    setMapExpanded(false);
    engineRef.current?.audio.stopVictorySong();
    engineRef.current?.returnToTitle();
  }, []);

  const handleRequestLock = useCallback(() => {
    if (mapExpanded) return;
    engineRef.current?.audio.unlock();
    engineRef.current?.requestPointerLock();
  }, [mapExpanded]);

  const handleToggleMap = useCallback(() => {
    setMapExpanded((prev) => {
      const next = !prev;
      if (next) {
        engineRef.current?.releasePointerLock();
      } else {
        engineRef.current?.requestPointerLock();
      }
      return next;
    });
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((hud.phase !== 'playing' && hud.phase !== 'climax') || mapExpanded) return;
    engineRef.current?.audio.unlock();
    if (hud.pointerLocked && !isTouchDevice && e.button === 0) {
      engineRef.current?.triggerPlayerAttack();
      return;
    }
    if (!hud.pointerLocked && !isTouchDevice) {
      engineRef.current?.requestPointerLock();
      draggingLookRef.current = true;
      lastDragPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingLookRef.current || hud.pointerLocked || mapExpanded) return;
    const dx = (e.clientX - lastDragPosRef.current.x) * 1.4;
    const dy = (e.clientY - lastDragPosRef.current.y) * 1.4;
    lastDragPosRef.current = { x: e.clientX, y: e.clientY };
    engineRef.current?.applyLookDelta(dx, dy);
  };

  const handleCanvasMouseUp = () => {
    draggingLookRef.current = false;
  };

  const showEndScreen =
    hud.phase === 'gameover' || (hud.phase === 'victory' && hud.shantiProgress >= 0.98);
  const currentVictoryLyric =
    BUILT_IN_VICTORY_SONG.lyrics[activeLyricIndex] ?? BUILT_IN_VICTORY_SONG.lyrics[0];

  const activeChapterForGuide: ChapterNumber =
    hud.phase === 'title' ? selectedChapter : hud.chapter;

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#05090a]">
      {/* Isolated Full-Bleed Three.js WebGL Viewport */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      />

      {/* Active Gameplay HUD, Live Radar/Village Map & Cinematic Moksha Finale */}
      {hud.phase !== 'title' &&
        hud.phase !== 'story' &&
        hud.phase !== 'briefing' &&
        hud.phase !== 'injured' &&
        hud.phase !== 'chapter_complete' && (
          <GameHud
            hud={hud}
            difficulty={settings.difficulty}
            isTouchDevice={isTouchDevice}
            isFullscreen={isFullscreen}
            mapExpanded={mapExpanded}
            victoryLyric={currentVictoryLyric}
            onPause={handlePause}
            onRequestLock={handleRequestLock}
            onToggleMap={handleToggleMap}
            onToggleFullscreen={handleToggleFullscreen}
            onSkipVictoryCutscene={handleSkipVictoryCutscene}
          />
        )}

      {/* Android Landscape PUBG/BGMI Action-Horror Multi-Touch Controls */}
      {isTouchDevice && (hud.phase === 'playing' || hud.phase === 'climax') && !mapExpanded && (
        <MobileControls
          flashlightOn={hud.flashlightOn}
          isHiding={hud.isHiding}
          hasPrompt={hud.nearPrompt !== null}
          stance={hud.stance}
          stamina={hud.stamina}
          attackCooldownRemaining={hud.attackCooldownRemaining}
          attackCooldownTotal={hud.attackCooldownTotal}
          touchSensitivity={settings.touchSensitivity}
          onMoveVector={(x, y) => {
            if (engineRef.current) {
              engineRef.current.touchInput.moveX = x;
              engineRef.current.touchInput.moveY = y;
            }
          }}
          onLookDelta={(dx, dy) => {
            engineRef.current?.applyLookDelta(dx, dy);
          }}
          onSprintChange={(sprinting) => {
            if (engineRef.current) {
              engineRef.current.touchInput.sprint = sprinting;
            }
          }}
          onInteract={() => engineRef.current?.triggerInteract()}
          onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
          onJump={() => engineRef.current?.triggerJump()}
          onToggleCrouch={() => engineRef.current?.toggleCrouch()}
          onToggleProne={() => engineRef.current?.toggleProne()}
          onAttack={() => engineRef.current?.triggerPlayerAttack()}
        />
      )}

      {/* Landscape-Optimized Title Screen with PWA Install & Fullscreen */}
      {hud.phase === 'title' && (
        <TitleScreen
          settings={settings}
          selectedChapter={selectedChapter}
          completedChapters={completedChapters}
          isTouchDevice={isTouchDevice}
          isFullscreen={isFullscreen}
          titleBgmBlocked={titleBgmBlocked && !settings.muted}
          onStartTitleBgm={handleStartTitleBgm}
          onSelectChapter={setSelectedChapter}
          onChangeDifficulty={handleChangeDifficulty}
          onChangeQuality={handleChangeQuality}
          onChangeVolume={handleChangeVolume}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onStart={handleStartGame}
          onOpenGuide={() => setShowGuideModal(true)}
          keyboardDisabled={showGuideModal}
        />
      )}

      {/* Instant Built-In Opening Story */}
      {hud.phase === 'story' && (
        <AIStoryModal
          audio={engineRef.current?.audio ?? null}
          onContinue={handleAdvanceStoryToBriefing}
        />
      )}

      {/* Pre-Game Chapter Mission Briefing */}
      {hud.phase === 'briefing' && (
        <MissionBriefingModal
          mode="pregame"
          chapter={hud.chapter}
          difficulty={settings.difficulty}
          isTouchDevice={isTouchDevice}
          onConfirm={handleEnterHaveliFromBriefing}
        />
      )}

      {/* Outdoor Hazard Injury & Checkpoint Revive Modal */}
      {hud.phase === 'injured' && (
        <InjuredReviveModal
          reason={hud.injuredReason ?? 'You were injured by a village hazard!'}
          checkpointLabel={hud.activeCheckpointLabel}
          onRevive={handleReviveAtCheckpoint}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Chapter Completion Modal */}
      {hud.phase === 'chapter_complete' && (
        <ChapterCompleteModal
          completedChapter={hud.chapter}
          elapsedSeconds={hud.elapsedSeconds}
          maxBpm={hud.maxBpm}
          jumpscaresSurvived={hud.jumpscaresSurvived}
          onNextChapter={handleNextChapter}
          onReplayChapter={handleReplayCurrentChapter}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* 1984 Hinglish Lore Note Modal */}
      {hud.phase === 'note' && hud.activeNote && (
        <NoteModal note={hud.activeNote} onClose={handleResume} />
      )}

      {/* Pause Menu */}
      {hud.phase === 'paused' && !showGuideModal && (
        <PauseMenu
          settings={settings}
          isFullscreen={isFullscreen}
          onResume={handleResume}
          onRestart={handleReplayCurrentChapter}
          onQuit={handleReturnTitle}
          onOpenGuide={() => setShowGuideModal(true)}
          onChangeVolume={handleChangeVolume}
          onToggleMute={handleToggleMute}
          onChangeQuality={handleChangeQuality}
          onChangeTouchSensitivity={handleChangeTouchSensitivity}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Standalone How-to-Play Guide */}
      {showGuideModal && (
        <MissionBriefingModal
          mode="guide"
          chapter={activeChapterForGuide}
          difficulty={settings.difficulty}
          isTouchDevice={isTouchDevice}
          onConfirm={() => setShowGuideModal(false)}
        />
      )}

      {/* Finale Victory or Game Over Screen */}
      {showEndScreen && (
        <EndScreen
          stats={{
            victory: hud.phase === 'victory',
            chapter: hud.chapter,
            chapterProgress: hud.chapterProgress,
            chapterTarget: hud.chapterTarget,
            chapterTaskLabel: hud.chapterTaskLabel,
            elapsedSeconds: hud.elapsedSeconds,
            difficulty: settings.difficulty,
            maxBpm: hud.maxBpm,
            jumpscaresSurvived: hud.jumpscaresSurvived,
            itemsPlacedCount: hud.itemsPlacedCount,
          }}
          victorySong={BUILT_IN_VICTORY_SONG}
          songPlaying={songPlaying}
          activeLyricIndex={activeLyricIndex}
          onToggleSong={handleToggleSong}
          onReplaySong={handleReplaySong}
          onPlayAgain={handlePlayAgain}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Android Portrait-to-Landscape Lock Gate */}
      {isPortraitMobile && !dismissPortraitGate && (
        <LandscapeGate onDismiss={() => setDismissPortraitGate(true)} />
      )}

      {/* Offline Mode Indicator */}
      <OfflineIndicator />
    </main>
  );
}
