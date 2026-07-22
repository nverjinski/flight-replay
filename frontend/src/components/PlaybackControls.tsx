import { memo } from "react";
import type { PlaybackSpeed } from "../hooks/usePlayback";
import type { PhaseMarker } from "../lib/phaseMarkers";

const SPEEDS: PlaybackSpeed[] = [1, 5, 10, 50];

type Props = {
  index: number;
  maxIndex: number;
  elapsedMs: number;
  durationMs: number;
  phase: string;
  playing: boolean;
  speed: PlaybackSpeed;
  markers: PhaseMarker[];
  onToggle: () => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  onScrub: (index: number) => void;
};

function formatClock(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Timeline UI for flight replay: play/pause, speed (1×–50×), scrubber, clock,
 * current phase label, and clickable phase-change markers along the track.
 *
 * Takes scalar playback fields (not the full points array) so rapid ticks do not
 * push a huge prop tree through React DevTools performance cloning.
 */
export const PlaybackControls = memo(function PlaybackControls({
  index,
  maxIndex,
  elapsedMs,
  durationMs,
  phase,
  playing,
  speed,
  markers,
  onToggle,
  onSpeed,
  onScrub,
}: Props) {
  return (
    <section className="playback">
      <div className="playback-row">
        <button type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"}
        </button>

        <div className="speed-group" role="group" aria-label="Playback speed">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === speed ? "active" : undefined}
              onClick={() => onSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>

        <span className="clock">
          {formatClock(elapsedMs)} / {formatClock(durationMs)}
        </span>

        <span className="phase-label">{phase || "—"}</span>
      </div>

      <div className="timeline">
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={index}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Timeline"
        />

        <div className="phase-markers" aria-hidden="true">
          {markers.map((marker) => {
            const left = maxIndex === 0 ? 0 : (marker.index / maxIndex) * 100;
            return (
              <button
                key={`${marker.phase}-${marker.index}`}
                type="button"
                className="phase-tick"
                style={{ left: `${left}%` }}
                title={`${marker.phase} @ ${formatClock(marker.elapsed_ms)}`}
                onClick={() => onScrub(marker.index)}
              >
                <span className="phase-tick-label">{marker.phase}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
});
