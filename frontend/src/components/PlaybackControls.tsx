import { memo } from "react";
import type { PlaybackSpeed } from "../hooks/usePlayback";
import type { PhaseMarker } from "../lib/phaseMarkers";

const SPEEDS: PlaybackSpeed[] = [1, 5, 10, 50];

type Props = {
  elapsedMs: number;
  durationMs: number;
  phase: string;
  playing: boolean;
  speed: PlaybackSpeed;
  markers: PhaseMarker[];
  onToggle: () => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  /** Scrub by flight time so the thumb matches the clock / chart cursor. */
  onScrubElapsed: (elapsedMs: number) => void;
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
 * The scrubber is driven by elapsed flight time (not discrete sample index) so
 * it stays aligned with the interpolated clock and chart cursor.
 */
export const PlaybackControls = memo(function PlaybackControls({
  elapsedMs,
  durationMs,
  phase,
  playing,
  speed,
  markers,
  onToggle,
  onSpeed,
  onScrubElapsed,
}: Props) {
  const safeDuration = Math.max(durationMs, 1);

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
          max={safeDuration}
          value={Math.min(elapsedMs, safeDuration)}
          onChange={(e) => onScrubElapsed(Number(e.target.value))}
          aria-label="Timeline"
        />

        <div className="phase-markers" aria-hidden="true">
          {markers.map((marker) => {
            const left = (marker.elapsed_ms / safeDuration) * 100;
            return (
              <button
                key={`${marker.phase}-${marker.index}`}
                type="button"
                className="phase-tick"
                style={{ left: `${left}%` }}
                title={`${marker.phase} @ ${formatClock(marker.elapsed_ms)}`}
                onClick={() => onScrubElapsed(marker.elapsed_ms)}
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
