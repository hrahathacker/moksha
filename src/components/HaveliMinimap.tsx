import React from 'react';
import { Maximize2, Minimize2, Map as MapIcon, X } from 'lucide-react';
import { GhostAIState, MinimapData, RadarFloorLevel } from '../game/types';

interface HaveliMinimapProps {
  mapData: MinimapData;
  ghostState: GhostAIState;
  isTouchDevice: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}

// Convert indoor Haveli world meters (-15..+15) into SVG blueprint coordinates (0..180)
const SIZE = 180;
const PAD = 10;
const INNER = SIZE - PAD * 2;
const toSvg = (worldCoord: number) => PAD + ((worldCoord + 15) / 30) * INNER;

// Convert outdoor Village Outskirts coordinates (x: -22..+22, z: -24..+30) into SVG space
const toOutdoorX = (wx: number) => PAD + ((wx + 22) / 44) * INNER;
const toOutdoorZ = (wz: number) => PAD + ((wz + 24) / 54) * INNER;

// Convert Chapter 2 Forest & Outer Courtyard coordinates (x: -22..+22, z: -36..+37) into SVG space
const toForestX = (wx: number) => PAD + ((wx + 22) / 44) * INNER;
const toForestZ = (wz: number) => PAD + ((wz + 36) / 73) * INNER;

const getHaveliFloorFromY = (y = 0): 'basement' | 'ground' | 'first' => {
  if (y < -1.5) return 'basement';
  if (y >= 3.5) return 'first';
  return 'ground';
};

const FLOOR_BADGE: Record<RadarFloorLevel, { short: string; full: string; accent: string }> = {
  outdoor: { short: 'OUTDOOR', full: 'OUTDOOR · VILLAGE', accent: '#74d8a8' },
  jungle: { short: 'JUNGLE', full: 'JUNGLE · COURTYARD', accent: '#f2a44b' },
  basement: { short: 'UNDERGROUND', full: 'UNDERGROUND · TAHKHANA', accent: '#d87a74' },
  ground: { short: 'GROUND', full: 'GROUND FLOOR · HAVELI', accent: '#7de2ee' },
  first: { short: '1ST FLOOR', full: '1ST FLOOR · UPAR MANZIL', accent: '#e5b864' },
};

export const HaveliMinimap: React.FC<HaveliMinimapProps> = ({
  mapData,
  ghostState,
  isTouchDevice,
  expanded,
  onToggleExpanded,
}) => {
  const isOutdoor = mapData.mode === 'outdoor';
  const isForest = mapData.mode === 'forest';
  const floorLevel: RadarFloorLevel =
    mapData.floorLevel ??
    (isForest ? 'jungle' : isOutdoor ? 'outdoor' : getHaveliFloorFromY(mapData.playerY ?? 0));

  const isBasement = floorLevel === 'basement';
  const isFirstFloor = floorLevel === 'first';
  const isGroundFloor = floorLevel === 'ground';
  const isIndoorHaveli = isBasement || isGroundFloor || isFirstFloor;

  const ghostFloor = getHaveliFloorFromY(mapData.ghostY ?? 0);
  const ghostOnCurrentFloor = isIndoorHaveli && ghostFloor === floorLevel;
  const ghostFloorHint =
    !isIndoorHaveli || ghostOnCurrentFloor
      ? null
      : isFirstFloor
        ? 'Ground ↓'
        : isBasement
          ? 'Ground ↑'
          : ghostFloor === 'first'
            ? '1st Floor ↑'
            : 'Tahkhana ↓';

  const playerDeg = (-mapData.playerYaw * 180) / Math.PI;
  const isChasing = ghostOnCurrentFloor && ghostState === 'chase';
  const isStaggered = ghostOnCurrentFloor && ghostState === 'staggered';
  const isSearching =
    ghostOnCurrentFloor && (ghostState === 'investigate' || ghostState === 'search');
  const hasForestBoss = isForest && (mapData.enemies?.some((e) => e.isBoss) ?? false);

  const statusText = isStaggered
    ? 'STAGGERED'
    : isChasing
      ? 'CHASING'
      : isSearching
        ? 'HUNTING'
        : 'PATROL';

  const floorBadge = FLOOR_BADGE[floorLevel];

  const renderStairMarker = (
    wx: number,
    wz: number,
    dir: 'up' | 'down',
    tag: string,
    highlightObj: boolean,
    locked = false
  ) => {
    const sx = toSvg(wx);
    const sz = toSvg(wz);
    const strokeCol = locked ? '#b85049' : highlightObj ? '#ffd166' : '#7ea3ab';
    const fillCol = locked
      ? 'rgba(130, 32, 28, 0.28)'
      : highlightObj
        ? 'rgba(245, 190, 88, 0.24)'
        : 'rgba(20, 42, 48, 0.9)';
    return (
      <g transform={`translate(${sx}, ${sz})`}>
        <rect
          x={-7}
          y={-11}
          width={14}
          height={22}
          rx={1.5}
          fill={fillCol}
          stroke={strokeCol}
          strokeWidth={highlightObj || locked ? '1.15' : '0.85'}
        />
        <line x1={-5} y1={-6} x2={5} y2={-6} stroke={strokeCol} strokeWidth="0.7" opacity="0.7" />
        <line x1={-5} y1={-2} x2={5} y2={-2} stroke={strokeCol} strokeWidth="0.7" opacity="0.7" />
        <line x1={-5} y1={2} x2={5} y2={2} stroke={strokeCol} strokeWidth="0.7" opacity="0.7" />
        <line x1={-5} y1={6} x2={5} y2={6} stroke={strokeCol} strokeWidth="0.7" opacity="0.7" />
        {locked && (
          <g stroke="#e0665e" strokeWidth="1.2">
            <line x1={-5} y1={-8} x2={5} y2={8} />
            <line x1={5} y1={-8} x2={-5} y2={8} />
          </g>
        )}
        <text
          y={dir === 'up' ? -13 : 17}
          fill={locked ? '#d96b64' : highlightObj ? '#ffd166' : '#8cb3bc'}
          fontSize="5.4"
          fontWeight={highlightObj || locked ? 'bold' : 'normal'}
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          {locked ? `${tag} LOCK` : dir === 'up' ? `↑ ${tag}` : `↓ ${tag}`}
        </text>
      </g>
    );
  };

  const renderOutdoorBlueprint = (svgClass: string) => {
    const px = toOutdoorX(mapData.playerX);
    const pz = toOutdoorZ(mapData.playerZ);
    const hasDog = typeof mapData.dogX === 'number' && typeof mapData.dogZ === 'number';
    const dx = hasDog ? toOutdoorX(mapData.dogX!) : 0;
    const dz = hasDog ? toOutdoorZ(mapData.dogZ!) : 0;

    return (
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={svgClass}
        role="img"
        aria-label="Outdoor village outskirts map showing trails, landmarks, dog companion, and objective pins."
      >
        <rect
          x={PAD}
          y={PAD}
          width={INNER}
          height={INNER}
          fill="#071214"
          stroke="#48666a"
          strokeWidth="1.6"
        />

        <g stroke="#4b3f30" strokeLinecap="round" fill="none" opacity="0.88">
          <line
            x1={toOutdoorX(0)}
            y1={toOutdoorZ(27)}
            x2={toOutdoorX(0)}
            y2={toOutdoorZ(-21)}
            strokeWidth="8"
          />
          <line
            x1={toOutdoorX(0)}
            y1={toOutdoorZ(24)}
            x2={toOutdoorX(-12.6)}
            y2={toOutdoorZ(11.2)}
            strokeWidth="5.5"
          />
          <line
            x1={toOutdoorX(-12.6)}
            y1={toOutdoorZ(11.2)}
            x2={toOutdoorX(-15.4)}
            y2={toOutdoorZ(3.4)}
            strokeWidth="4.8"
          />
          <line
            x1={toOutdoorX(-11.5)}
            y1={toOutdoorZ(10.8)}
            x2={toOutdoorX(8.0)}
            y2={toOutdoorZ(4.0)}
            strokeWidth="5.2"
          />
          <line
            x1={toOutdoorX(8.0)}
            y1={toOutdoorZ(4.0)}
            x2={toOutdoorX(16.0)}
            y2={toOutdoorZ(-4.6)}
            strokeWidth="4.8"
          />
          <line
            x1={toOutdoorX(8.0)}
            y1={toOutdoorZ(4.0)}
            x2={toOutdoorX(4.2)}
            y2={toOutdoorZ(-8.8)}
            strokeWidth="5"
          />
        </g>

        <line
          x1={PAD + 4}
          y1={toOutdoorZ(-21.8)}
          x2={SIZE - PAD - 4}
          y2={toOutdoorZ(-21.8)}
          stroke="#7f6c56"
          strokeWidth="2.4"
        />
        <rect
          x={toOutdoorX(-3.2)}
          y={toOutdoorZ(-22.6)}
          width={toOutdoorX(3.2) - toOutdoorX(-3.2)}
          height={5}
          fill="#c48a42"
          stroke="#f5d599"
          strokeWidth="0.7"
        />

        {mapData.pawTrailVisible &&
          mapData.pawTrail &&
          mapData.pawTrail.map((pt, i) => (
            <circle
              key={`paw-${i}`}
              cx={toOutdoorX(pt.x)}
              cy={toOutdoorZ(pt.z)}
              r={1.7}
              fill="#f3bd60"
              opacity="0.72"
            />
          ))}

        {(mapData.landmarks ?? []).map((lm) => {
          const lx = toOutdoorX(lm.x);
          const lz = toOutdoorZ(lm.z);
          const color =
            lm.kind === 'tulsi'
              ? '#58c47a'
              : lm.kind === 'well'
                ? '#64c2d8'
                : lm.kind === 'gate'
                  ? '#e8a84a'
                  : '#8ea3a6';
          return (
            <g key={lm.id} transform={`translate(${lx}, ${lz})`}>
              <rect
                x={-3.5}
                y={-3.5}
                width={7}
                height={7}
                rx={lm.kind === 'well' || lm.kind === 'tulsi' ? 3.5 : 1}
                fill="#0d1e22"
                stroke={color}
                strokeWidth="1"
              />
              <text
                y={lm.kind === 'gate' ? 10 : -5.5}
                fill="#8aa6aa"
                fontSize="5.8"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                {lm.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {hasDog && (
          <g transform={`translate(${dx}, ${dz})`}>
            <circle r={5.4} fill="rgba(243, 189, 96, 0.24)" />
            <circle r={2.8} fill="#f3bd60" stroke="#1c1205" strokeWidth="0.8" />
          </g>
        )}

        {mapData.objectives.map((obj) => {
          const ox = toOutdoorX(obj.x);
          const oz = toOutdoorZ(obj.z);
          const pinColor =
            obj.kind === 'tulsi'
              ? '#74e0a0'
              : obj.kind === 'well'
                ? '#74d8e8'
                : '#ffd166';
          return (
            <g key={obj.id} transform={`translate(${ox}, ${oz})`}>
              <circle r={8.5} fill={pinColor} opacity="0.22" stroke={pinColor} strokeWidth="0.9" />
              <circle r={3.6} fill={pinColor} stroke="#141008" strokeWidth="0.9" />
            </g>
          );
        })}

        <g transform={`translate(${px}, ${pz}) rotate(${playerDeg})`}>
          <polygon points="0,0 -7,-16 7,-16" fill="rgba(125, 211, 224, 0.26)" />
          <polygon
            points="0,-5 3.8,4 0,2 -3.8,4"
            fill="#7de2ee"
            stroke="#061215"
            strokeWidth="0.9"
          />
        </g>
      </svg>
    );
  };

  const renderForestBlueprint = (svgClass: string) => {
    const px = toForestX(mapData.playerX);
    const pz = toForestZ(mapData.playerZ);
    const hasDog = typeof mapData.dogX === 'number' && typeof mapData.dogZ === 'number';
    const dx = hasDog ? toForestX(mapData.dogX!) : 0;
    const dz = hasDog ? toForestZ(mapData.dogZ!) : 0;

    return (
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={svgClass}
        role="img"
        aria-label="Cursed Banyan Forest and Haveli Outer Courtyard tactical map."
      >
        <rect
          x={PAD}
          y={PAD}
          width={INNER}
          height={INNER}
          fill="#071214"
          stroke="#48666a"
          strokeWidth="1.6"
        />

        <rect
          x={toForestX(-18)}
          y={toForestZ(-34)}
          width={toForestX(18) - toForestX(-18)}
          height={toForestZ(-4) - toForestZ(-34)}
          fill="#0c181b"
          stroke="#5c767a"
          strokeWidth="1.3"
        />

        <g stroke="#4b3f30" strokeLinecap="round" fill="none" opacity="0.88">
          <line
            x1={toForestX(0)}
            y1={toForestZ(34)}
            x2={toForestX(0)}
            y2={toForestZ(-32)}
            strokeWidth="6.5"
          />
          <line
            x1={toForestX(0)}
            y1={toForestZ(12)}
            x2={toForestX(-9.5)}
            y2={toForestZ(7.5)}
            strokeWidth="4.6"
          />
          <line
            x1={toForestX(0)}
            y1={toForestZ(-16)}
            x2={toForestX(-13)}
            y2={toForestZ(-18)}
            strokeWidth="4.5"
          />
          <line
            x1={toForestX(0)}
            y1={toForestZ(-16)}
            x2={toForestX(13)}
            y2={toForestZ(-17)}
            strokeWidth="4.5"
          />
        </g>

        <rect
          x={toForestX(-3.2)}
          y={toForestZ(29.5)}
          width={toForestX(3.2) - toForestX(-3.2)}
          height={3.5}
          fill="#c48a42"
          stroke="#f5d599"
          strokeWidth="0.6"
        />

        <rect
          x={toForestX(-3.6)}
          y={toForestZ(-34.6)}
          width={toForestX(3.6) - toForestX(-3.6)}
          height={4.5}
          fill="#a62f2b"
          stroke="#f28472"
          strokeWidth="0.7"
        />

        {(mapData.landmarks ?? []).map((lm) => {
          const lx = toForestX(lm.x);
          const lz = toForestZ(lm.z);
          const color =
            lm.kind === 'shrine'
              ? '#f2a44b'
              : lm.kind === 'baoli'
                ? '#64c2d8'
                : lm.kind === 'haveli_door'
                  ? '#ef5350'
                  : '#8ea3a6';
          return (
            <g key={lm.id} transform={`translate(${lx}, ${lz})`}>
              <rect
                x={-3}
                y={-3}
                width={6}
                height={6}
                rx={lm.kind === 'baoli' || lm.kind === 'shrine' ? 3 : 1}
                fill="#0d1e22"
                stroke={color}
                strokeWidth="0.95"
              />
              <text
                y={lm.kind === 'haveli_door' ? 9 : -5}
                fill="#8aa6aa"
                fontSize="5.4"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                {lm.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {hasDog && (
          <g transform={`translate(${dx}, ${dz})`}>
            <circle r={2.5} fill="#f3bd60" stroke="#1c1205" strokeWidth="0.7" />
          </g>
        )}

        {mapData.objectives.map((obj) => {
          const ox = toForestX(obj.x);
          const oz = toForestZ(obj.z);
          const pinColor =
            obj.kind === 'rune' || obj.kind === 'boss'
              ? '#ff5a52'
              : obj.kind === 'trishul' || obj.kind === 'shrine'
                ? '#ffb84d'
                : '#ffd166';
          return (
            <g key={obj.id} transform={`translate(${ox}, ${oz})`}>
              <circle r={7.5} fill={pinColor} opacity="0.2" stroke={pinColor} strokeWidth="0.85" />
              <circle r={3.2} fill={pinColor} stroke="#141008" strokeWidth="0.85" />
            </g>
          );
        })}

        {(mapData.enemies ?? []).map((en) => {
          const ex = toForestX(en.x);
          const ez = toForestZ(en.z);
          if (en.isBoss) {
            return (
              <g key={en.id} transform={`translate(${ex}, ${ez})`}>
                <circle
                  r={10.5}
                  fill="rgba(239, 68, 68, 0.28)"
                  stroke="#ff5555"
                  strokeWidth="1.2"
                />
                <polygon
                  points="0,-5.5 4.4,0 0,5.5 -4.4,0"
                  fill="#ff3b44"
                  stroke="#ffe5e5"
                  strokeWidth="0.9"
                />
              </g>
            );
          }
          return (
            <g key={en.id} transform={`translate(${ex}, ${ez})`}>
              <circle r={4.5} fill="rgba(239, 68, 68, 0.24)" />
              <circle r={2.4} fill="#ff4c4c" stroke="#1c0606" strokeWidth="0.7" />
            </g>
          );
        })}

        <g transform={`translate(${px}, ${pz}) rotate(${playerDeg})`}>
          <polygon points="0,0 -7,-16 7,-16" fill="rgba(125, 211, 224, 0.26)" />
          <polygon
            points="0,-5 3.8,4 0,2 -3.8,4"
            fill="#7de2ee"
            stroke="#061215"
            strokeWidth="0.9"
          />
        </g>
      </svg>
    );
  };

  const renderHaveliGroundBlueprint = (svgClass: string) => {
    const px = toSvg(mapData.playerX);
    const pz = toSvg(mapData.playerZ);
    const gx = toSvg(mapData.ghostX);
    const gz = toSvg(mapData.ghostZ);

    const hasObjUp = mapData.objectives.some((o) => getHaveliFloorFromY(o.y ?? 0) === 'first');
    const hasObjDown = mapData.objectives.some((o) => getHaveliFloorFromY(o.y ?? 0) === 'basement');

    return (
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={svgClass}
        role="img"
        aria-label={`Haveli Ground Floor map. Spirit is in ${mapData.ghostRoom}, ${mapData.ghostDistance} meters away.`}
      >
        <rect
          x={PAD}
          y={PAD}
          width={INNER}
          height={INNER}
          fill="#081215"
          stroke="#456066"
          strokeWidth="1.6"
        />

        <rect
          x={toSvg(-5.2)}
          y={toSvg(-5.2)}
          width={toSvg(5.2) - toSvg(-5.2)}
          height={toSvg(5.2) - toSvg(-5.2)}
          fill="#0d1d22"
          stroke="#2c4a52"
          strokeWidth="0.9"
          strokeDasharray="2.5 2"
        />

        <g stroke="#6c858a" strokeWidth="1.8" strokeLinecap="square">
          <line x1={toSvg(-7.3)} y1={toSvg(-7.5)} x2={toSvg(-1.7)} y2={toSvg(-7.5)} />
          <line x1={toSvg(1.7)} y1={toSvg(-7.5)} x2={toSvg(7.3)} y2={toSvg(-7.5)} />
          <line x1={toSvg(-7.3)} y1={toSvg(-7.6)} x2={toSvg(-7.3)} y2={toSvg(-10.4)} />
          <line x1={toSvg(-7.3)} y1={toSvg(-12.2)} x2={toSvg(-7.3)} y2={toSvg(-15)} />
          <line x1={toSvg(7.3)} y1={toSvg(-7.6)} x2={toSvg(7.3)} y2={toSvg(-10.4)} />
          <line x1={toSvg(7.3)} y1={toSvg(-12.2)} x2={toSvg(7.3)} y2={toSvg(-15)} />

          <line x1={toSvg(-7.3)} y1={toSvg(7.5)} x2={toSvg(-1.7)} y2={toSvg(7.5)} />
          <line x1={toSvg(1.7)} y1={toSvg(7.5)} x2={toSvg(7.3)} y2={toSvg(7.5)} />
          <line x1={toSvg(-7.3)} y1={toSvg(7.6)} x2={toSvg(-7.3)} y2={toSvg(10.4)} />
          <line x1={toSvg(-7.3)} y1={toSvg(12.2)} x2={toSvg(-7.3)} y2={toSvg(15)} />
          <line x1={toSvg(7.3)} y1={toSvg(7.6)} x2={toSvg(7.3)} y2={toSvg(10.4)} />
          <line x1={toSvg(7.3)} y1={toSvg(12.2)} x2={toSvg(7.3)} y2={toSvg(15)} />

          <line x1={toSvg(-7.5)} y1={toSvg(-6.6)} x2={toSvg(-7.5)} y2={toSvg(-2.0)} />
          <line x1={toSvg(-7.5)} y1={toSvg(2.0)} x2={toSvg(-7.5)} y2={toSvg(6.6)} />
          <line x1={toSvg(-15)} y1={toSvg(-7.3)} x2={toSvg(-10.2)} y2={toSvg(-7.3)} />
          <line x1={toSvg(-15)} y1={toSvg(7.3)} x2={toSvg(-10.2)} y2={toSvg(7.3)} />

          <line x1={toSvg(7.5)} y1={toSvg(-6.6)} x2={toSvg(7.5)} y2={toSvg(-2.0)} />
          <line x1={toSvg(7.5)} y1={toSvg(2.0)} x2={toSvg(7.5)} y2={toSvg(6.6)} />
          <line x1={toSvg(10.2)} y1={toSvg(-7.3)} x2={toSvg(15)} y2={toSvg(-7.3)} />
          <line x1={toSvg(10.2)} y1={toSvg(7.3)} x2={toSvg(15)} y2={toSvg(7.3)} />
        </g>

        {/* NE Grand Stairs UP (to 1st Floor) & SW Stone Stairs DOWN (to Tahkhana) */}
        {renderStairMarker(10.6, -11.0, 'up', '1F', hasObjUp, Boolean(mapData.firstFloorLocked))}
        {renderStairMarker(-10.6, 11.0, 'down', 'B1', hasObjDown, Boolean(mapData.basementLocked))}

        <g
          fill="#6e8b90"
          fontSize="6.2"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
          letterSpacing="0.8"
        >
          <text x={toSvg(0)} y={toSvg(-11.2)}>
            POOJA
          </text>
          <text x={toSvg(-11.3)} y={toSvg(0.4)}>
            BEDROOM
          </text>
          <text x={toSvg(11.3)} y={toSvg(0.4)}>
            KITCHEN
          </text>
          <text x={toSvg(0)} y={toSvg(11.8)}>
            STORE
          </text>
          <text x={toSvg(0)} y={toSvg(3.8)} fill="#5c797f" fontSize="5.4">
            AANGAN
          </text>
        </g>

        <rect
          x={toSvg(-1.2)}
          y={toSvg(-1.2)}
          width={toSvg(1.2) - toSvg(-1.2)}
          height={toSvg(1.2) - toSvg(-1.2)}
          fill="#3a2414"
          stroke="#e5a94c"
          strokeWidth="1.1"
        />

        {mapData.almirahs
          .filter((a) => getHaveliFloorFromY(a.y ?? 0) === 'ground')
          .map((alm) => (
            <rect
              key={alm.id}
              x={toSvg(alm.x) - 2.6}
              y={toSvg(alm.z) - 2.6}
              width={5.2}
              height={5.2}
              fill="#634129"
              stroke="#b88456"
              strokeWidth="0.7"
            />
          ))}

        {mapData.objectives
          .filter((obj) => getHaveliFloorFromY(obj.y ?? 0) === 'ground')
          .map((obj) => {
            const ox = toSvg(obj.x);
            const oz = toSvg(obj.z);
            const fill = obj.kind === 'seal' ? '#f2784b' : '#f5be58';
            return (
              <g key={obj.id} transform={`translate(${ox}, ${oz})`}>
                <circle r={obj.urgent ? 6.5 : 4.8} fill={fill} opacity="0.22" />
                <circle r={obj.urgent ? 3.2 : 2.6} fill={fill} stroke="#1a1206" strokeWidth="0.8" />
              </g>
            );
          })}

        {ghostOnCurrentFloor && (
          <g transform={`translate(${gx}, ${gz})`}>
            <circle
              r={isChasing ? 12 : 9}
              fill={isChasing ? 'rgba(239, 68, 68, 0.28)' : 'rgba(220, 48, 56, 0.18)'}
              stroke={isChasing ? '#ff5555' : '#d8454a'}
              strokeWidth={isChasing ? '1.3' : '0.9'}
            />
            <polygon
              points="0,-5.5 4.4,0 0,5.5 -4.4,0"
              fill="#ff3b44"
              stroke="#ffe5e5"
              strokeWidth="0.9"
            />
          </g>
        )}

        <g transform={`translate(${px}, ${pz}) rotate(${playerDeg})`}>
          <polygon points="0,0 -7,-16 7,-16" fill="rgba(125, 211, 224, 0.24)" />
          <polygon
            points="0,-5 3.8,4 0,2 -3.8,4"
            fill="#7de2ee"
            stroke="#061215"
            strokeWidth="0.9"
          />
        </g>
      </svg>
    );
  };

  const renderFirstFloorBlueprint = (svgClass: string) => {
    const px = toSvg(mapData.playerX);
    const pz = toSvg(mapData.playerZ);
    const hasObjDown = mapData.objectives.some((o) => getHaveliFloorFromY(o.y ?? 0) !== 'first');

    return (
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={svgClass}
        role="img"
        aria-label="Haveli 1st Floor blueprint showing Thakur Study, Bridal Chamber, Guest Room, Terrace Balcony, and open Aangan void."
      >
        <rect
          x={PAD}
          y={PAD}
          width={INNER}
          height={INNER}
          fill="#0d1316"
          stroke="#706246"
          strokeWidth="1.6"
        />

        {/* Open Central Aangan Void overlooking Ground Floor below */}
        <rect
          x={toSvg(-5.2)}
          y={toSvg(-5.2)}
          width={toSvg(5.2) - toSvg(-5.2)}
          height={toSvg(5.2) - toSvg(-5.2)}
          fill="#05090b"
          stroke="#6b5c42"
          strokeWidth="1"
          strokeDasharray="3 2"
        />

        {/* 1st Floor Room Partitions (Study North, Bridal West, Guest East, Terrace South) */}
        <g stroke="#928264" strokeWidth="1.8" strokeLinecap="square">
          {/* North Study / Library wall */}
          <line x1={toSvg(-7.5)} y1={toSvg(-7.5)} x2={toSvg(-1.6)} y2={toSvg(-7.5)} />
          <line x1={toSvg(1.6)} y1={toSvg(-7.5)} x2={toSvg(7.5)} y2={toSvg(-7.5)} />
          <line x1={toSvg(-7.5)} y1={toSvg(-15)} x2={toSvg(-7.5)} y2={toSvg(-7.5)} />
          <line x1={toSvg(7.5)} y1={toSvg(-15)} x2={toSvg(7.5)} y2={toSvg(-11.8)} />
          <line x1={toSvg(7.5)} y1={toSvg(-9.4)} x2={toSvg(7.5)} y2={toSvg(-7.5)} />

          {/* West Bridal Chamber wall */}
          <line x1={toSvg(-7.5)} y1={toSvg(-7.5)} x2={toSvg(-7.5)} y2={toSvg(-1.8)} />
          <line x1={toSvg(-7.5)} y1={toSvg(1.8)} x2={toSvg(-7.5)} y2={toSvg(7.5)} />
          <line x1={toSvg(-15)} y1={toSvg(-7.5)} x2={toSvg(-7.5)} y2={toSvg(-7.5)} />
          <line x1={toSvg(-15)} y1={toSvg(7.5)} x2={toSvg(-7.5)} y2={toSvg(7.5)} />

          {/* East Guest Room wall */}
          <line x1={toSvg(7.5)} y1={toSvg(-7.5)} x2={toSvg(7.5)} y2={toSvg(-1.8)} />
          <line x1={toSvg(7.5)} y1={toSvg(1.8)} x2={toSvg(7.5)} y2={toSvg(7.5)} />
          <line x1={toSvg(7.5)} y1={toSvg(-7.5)} x2={toSvg(15)} y2={toSvg(-7.5)} />
          <line x1={toSvg(7.5)} y1={toSvg(7.5)} x2={toSvg(15)} y2={toSvg(7.5)} />

          {/* South Terrace Parapet */}
          <line x1={toSvg(-7.5)} y1={toSvg(7.5)} x2={toSvg(-2.2)} y2={toSvg(7.5)} />
          <line x1={toSvg(2.2)} y1={toSvg(7.5)} x2={toSvg(7.5)} y2={toSvg(7.5)} />
        </g>

        {/* NE Grand Staircase DOWN to Ground Floor */}
        {renderStairMarker(10.6, -11.0, 'down', 'GF', hasObjDown)}

        <g
          fill="#a99978"
          fontSize="6"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
          letterSpacing="0.8"
        >
          <text x={toSvg(0)} y={toSvg(-11.2)}>
            STUDY
          </text>
          <text x={toSvg(-11.3)} y={toSvg(0.4)}>
            BRIDAL
          </text>
          <text x={toSvg(11.3)} y={toSvg(0.4)}>
            GUEST
          </text>
          <text x={toSvg(0)} y={toSvg(11.6)}>
            TERRACE
          </text>
          <text x={toSvg(0)} y={toSvg(0.5)} fill="#606d70" fontSize="5.2">
            AANGAN VOID
          </text>
        </g>

        {mapData.objectives
          .filter((obj) => getHaveliFloorFromY(obj.y ?? 0) === 'first')
          .map((obj) => {
            const ox = toSvg(obj.x);
            const oz = toSvg(obj.z);
            return (
              <g key={obj.id} transform={`translate(${ox}, ${oz})`}>
                <circle r={6.2} fill="#f5be58" opacity="0.24" />
                <circle r={3} fill="#f5be58" stroke="#1a1206" strokeWidth="0.8" />
              </g>
            );
          })}

        <g transform={`translate(${px}, ${pz}) rotate(${playerDeg})`}>
          <polygon points="0,0 -7,-16 7,-16" fill="rgba(125, 211, 224, 0.24)" />
          <polygon
            points="0,-5 3.8,4 0,2 -3.8,4"
            fill="#7de2ee"
            stroke="#061215"
            strokeWidth="0.9"
          />
        </g>
      </svg>
    );
  };

  const renderBasementBlueprint = (svgClass: string) => {
    const px = toSvg(mapData.playerX);
    const pz = toSvg(mapData.playerZ);
    const hasObjUp = mapData.objectives.some((o) => getHaveliFloorFromY(o.y ?? 0) !== 'basement');

    return (
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={svgClass}
        role="img"
        aria-label="Underground Tahkhana Basement blueprint showing Prison Cells, Subterranean Wellspring, and Tantrik Ritual Chamber."
      >
        <rect
          x={PAD}
          y={PAD}
          width={INNER}
          height={INNER}
          fill="#0a0c11"
          stroke="#5c474a"
          strokeWidth="1.6"
        />

        {/* West Iron-Barred Prison Cells */}
        <g stroke="#7a5d60" strokeWidth="1.4" fill="rgba(28, 18, 22, 0.7)">
          <rect
            x={toSvg(-14.4)}
            y={toSvg(-9.5)}
            width={toSvg(-8.4) - toSvg(-14.4)}
            height={toSvg(-3.5) - toSvg(-9.5)}
          />
          <rect
            x={toSvg(-14.4)}
            y={toSvg(-3.2)}
            width={toSvg(-8.4) - toSvg(-14.4)}
            height={toSvg(2.8) - toSvg(-3.2)}
          />
          <rect
            x={toSvg(-14.4)}
            y={toSvg(3.1)}
            width={toSvg(-8.4) - toSvg(-14.4)}
            height={toSvg(8.8) - toSvg(3.1)}
          />
        </g>

        {/* Subterranean Wellspring (East) */}
        <circle
          cx={toSvg(10.6)}
          cy={toSvg(0.4)}
          r={13}
          fill="#0a232b"
          stroke="#4ea8bd"
          strokeWidth="1.2"
        />
        <circle cx={toSvg(10.6)} cy={toSvg(0.4)} r={7} fill="#123a46" opacity="0.7" />

        {/* Ancient Tantrik Ritual Yantra (North-Center) */}
        <circle
          cx={toSvg(0)}
          cy={toSvg(-8.6)}
          r={14}
          fill="rgba(168, 34, 34, 0.16)"
          stroke="#c9443e"
          strokeWidth="1.1"
          strokeDasharray="2.5 1.8"
        />
        <polygon
          points={`${toSvg(0)},${toSvg(-10.4)} ${toSvg(1.8)},${toSvg(-7.2)} ${toSvg(-1.8)},${toSvg(-7.2)}`}
          fill="none"
          stroke="#e25d55"
          strokeWidth="0.9"
        />

        {/* 6 Heavy Stone Pillars */}
        {[
          [-4.8, -3.5],
          [4.8, -3.5],
          [-4.8, 2.2],
          [4.8, 2.2],
          [-4.8, 7.6],
          [4.8, 7.6],
        ].map(([cx, cz], i) => (
          <rect
            key={`pil-${i}`}
            x={toSvg(cx) - 2.6}
            y={toSvg(cz) - 2.6}
            width={5.2}
            height={5.2}
            fill="#40393b"
            stroke="#736668"
            strokeWidth="0.7"
          />
        ))}

        {/* SW Stone Staircase UP to Ground Floor */}
        {renderStairMarker(-10.6, 11.0, 'up', 'GF', hasObjUp)}

        <g
          fill="#a48586"
          fontSize="5.8"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
          letterSpacing="0.8"
        >
          <text x={toSvg(0)} y={toSvg(-12.6)} fill="#e06f67">
            TANTRIK
          </text>
          <text x={toSvg(-11.4)} y={toSvg(-0.2)}>
            CELLS
          </text>
          <text x={toSvg(10.6)} y={toSvg(5.4)} fill="#66bcd0">
            WELL
          </text>
          <text x={toSvg(0.6)} y={toSvg(12.2)}>
            TAHKHANA
          </text>
        </g>

        {mapData.objectives
          .filter((obj) => getHaveliFloorFromY(obj.y ?? 0) === 'basement')
          .map((obj) => {
            const ox = toSvg(obj.x);
            const oz = toSvg(obj.z);
            return (
              <g key={obj.id} transform={`translate(${ox}, ${oz})`}>
                <circle r={6.2} fill="#f5be58" opacity="0.24" />
                <circle r={3} fill="#f5be58" stroke="#1a1206" strokeWidth="0.8" />
              </g>
            );
          })}

        <g transform={`translate(${px}, ${pz}) rotate(${playerDeg})`}>
          <polygon points="0,0 -7,-16 7,-16" fill="rgba(125, 211, 224, 0.24)" />
          <polygon
            points="0,-5 3.8,4 0,2 -3.8,4"
            fill="#7de2ee"
            stroke="#061215"
            strokeWidth="0.9"
          />
        </g>
      </svg>
    );
  };

  const renderSvgBlueprint = (svgClass: string) => {
    if (isForest) return renderForestBlueprint(svgClass);
    if (isOutdoor) return renderOutdoorBlueprint(svgClass);
    if (isFirstFloor) return renderFirstFloorBlueprint(svgClass);
    if (isBasement) return renderBasementBlueprint(svgClass);
    return renderHaveliGroundBlueprint(svgClass);
  };

  const primaryObjLabel = mapData.objectives[0]?.label ?? 'Explore';

  // Expanded Tactical Map Modal Overlay
  if (expanded) {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 pointer-events-auto"
        style={{ backgroundColor: 'rgba(4, 9, 11, 0.86)' }}
        onClick={onToggleExpanded}
      >
        <div
          className="w-full max-w-2xl max-h-[92dvh] rounded-sm border border-[#e5a94c]/45 p-3.5 sm:p-5 flex flex-col sm:flex-row gap-4 items-center"
          style={{ backgroundColor: '#081114' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[230px] sm:w-[270px] aspect-square shrink-0">
            {renderSvgBlueprint('w-full h-full block')}
          </div>

          <div className="flex-1 w-full flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-[#e5a94c] shrink-0" />
                <div>
                  <div
                    className="text-[10px] font-mono-tabular uppercase tracking-[0.16em]"
                    style={{ color: floorBadge.accent }}
                  >
                    {floorBadge.full}
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#f4ede0] tracking-wide">
                    {isForest
                      ? 'Cursed Forest & Courtyard'
                      : isOutdoor
                        ? 'Village Outskirts'
                        : isFirstFloor
                          ? 'Haveli 1st Floor (Upar Manzil)'
                          : isBasement
                            ? 'Underground Tahkhana'
                            : 'Haveli Ground Floor'}
                  </h3>
                  <p className="text-[11px] font-mono-tabular text-[#95abae]">
                    {isForest || isOutdoor ? (
                      <>
                        Next Pin:{' '}
                        <span className="text-[#f5c768] font-semibold">{primaryObjLabel}</span>
                      </>
                    ) : ghostOnCurrentFloor ? (
                      <>
                        Ghost:{' '}
                        <span className="text-[#ff6b6b] font-semibold">{mapData.ghostRoom}</span> (
                        {mapData.ghostDistance}m · {statusText})
                      </>
                    ) : (
                      <>
                        Ghost:{' '}
                        <span className="text-[#f3bd60] font-semibold">
                          {ghostFloorHint} ({mapData.ghostRoom})
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleExpanded}
                className="p-1.5 text-[#9eb2b4] hover:text-white cursor-pointer"
                aria-label="Close expanded map"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isForest ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-[#b4c4c6]">
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 bg-[#7de2ee] shrink-0" />
                  <span>Your Position</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ff4c4c] shrink-0" />
                  <span>Shadow Crawlers</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rotate-45 bg-[#ff3b44] border border-white/60 shrink-0" />
                  <span>Aghori Dwarpal</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ffb84d] shrink-0" />
                  <span>Shrine / Runes</span>
                </div>
              </div>
            ) : isOutdoor ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-[#b4c4c6]">
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 bg-[#7de2ee] shrink-0" />
                  <span>Your Position</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ffd166] shrink-0" />
                  <span>Objective Pin</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#f3bd60] shrink-0" />
                  <span>Street Dog</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#58c47a] shrink-0" />
                  <span>Tulsi / Landmarks</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs text-[#b4c4c6]">
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rotate-45 bg-[#ff3b44] border border-white/60 shrink-0" />
                  <span>Ghost (Current Floor)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 bg-[#7de2ee] shrink-0" />
                  <span>Your Position</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#f5be58] shrink-0" />
                  <span>Task / ↑↓ Stairs</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-sm bg-[#0c171b] border border-white/10">
                  <span className="inline-block w-2.5 h-2.5 bg-[#634129] border border-[#b88456] shrink-0" />
                  <span>Almirah / Bed Hide</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleExpanded}
              className="w-full py-2.5 rounded-sm bg-[#b8322b] hover:bg-[#cf3c34] text-[#faf3e8] text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer"
            >
              Close Map
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact Live HUD Multi-Floor Radar
  return (
    <div
      className="pointer-events-auto absolute rounded-sm border transition-colors"
      style={{
        width: isTouchDevice ? '106px' : '180px',
        ...(isTouchDevice
          ? {
              top: 'calc(max(8px, var(--sat)) + 44px)',
              right: 'max(10px, var(--sar))',
            }
          : {
              bottom: '20px',
              right: '20px',
            }),
        backgroundColor: 'rgba(6, 12, 14, 0.86)',
        borderColor:
          isChasing || hasForestBoss
            ? 'rgba(239, 68, 68, 0.75)'
            : 'rgba(255, 255, 255, 0.14)',
      }}
    >
      {/* Dynamic Floor / Zone Header Row */}
      <div className="flex items-center justify-between px-1.5 py-0.5 sm:px-2 sm:py-1 border-b border-white/10 gap-1">
        <span
          className="text-[8.5px] sm:text-[10px] font-mono-tabular font-semibold uppercase tracking-[0.1em] truncate"
          style={{ color: floorBadge.accent }}
        >
          {floorBadge.short}
        </span>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="text-[#9bb0b2] hover:text-[#f3bd60] transition-colors cursor-pointer flex items-center gap-1 text-[10px] shrink-0"
          aria-label="Expand Map"
          title="Expand Map (M)"
        >
          {!isTouchDevice && <span className="font-mono-tabular text-[9px] opacity-80">[M]</span>}
          {expanded ? (
            <Minimize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          ) : (
            <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          )}
        </button>
      </div>

      {/* Live Blueprint SVG */}
      <div className="p-1 sm:p-1.5 cursor-pointer" onClick={onToggleExpanded}>
        {renderSvgBlueprint('w-full h-auto block')}
      </div>

      {/* Dynamic Floor-Filtered Footer Row */}
      <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 border-t border-white/10 flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-mono-tabular">
        {isForest || isOutdoor ? (
          <span
            className="truncate font-semibold"
            style={{ color: hasForestBoss ? '#ff6464' : '#f3bd60' }}
          >
            {isTouchDevice ? primaryObjLabel : `Pin: ${primaryObjLabel}`}
          </span>
        ) : ghostOnCurrentFloor ? (
          <>
            <span
              className="truncate font-semibold"
              style={{ color: isChasing ? '#ff6464' : '#e0898d' }}
            >
              {isTouchDevice ? mapData.ghostRoom.split(' ')[0] : `Ghost: ${mapData.ghostRoom}`}
            </span>
            <span className="text-[#9eb2b4] shrink-0">{mapData.ghostDistance}m</span>
          </>
        ) : (
          <span className="truncate font-semibold text-[#f3bd60]">
            {isTouchDevice ? `Ghost ${ghostFloorHint}` : `Ghost: ${ghostFloorHint}`}
          </span>
        )}
      </div>
    </div>
  );
};
