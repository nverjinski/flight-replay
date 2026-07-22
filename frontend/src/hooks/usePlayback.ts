import { useCallback, useEffect, useRef, useState } from "react";
import type { TelemetryPoint } from "../types/telemetry";

export type PlaybackSpeed = 1 | 5 | 10 | 50;

export type PlaybackState = {
  index: number;
  playing: boolean;
  speed: PlaybackSpeed;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  scrub: (index: number) => void;
  current: TelemetryPoint | null;
};

/**
 * Advance by simulated flight time:
 *   wall_ms_elapsed * speed  ≈  how much elapsed_ms to consume
 *
 * So 50× means “50 seconds of flight per 1 second of wall clock”,
 * not “50 animation frames per second”.
 */
export function usePlayback(points: TelemetryPoint[]): PlaybackState {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);

  const indexRef = useRef(0);
  const carryMsRef = useRef(0);
  const lastWallRef = useRef<number | null>(null);
  const lastEmitWallRef = useRef(0);
  /** Max React setState rate while playing (~120fps). rAF still caps to display refresh. */
  const UI_EMIT_INTERVAL_MS = 1000 / 120;

  // Keep indexRef in sync for the rAF loop (avoids stale closures).
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Reset when a new telemetry array loads.
  useEffect(() => {
    setIndex(0);
    indexRef.current = 0;
    setPlaying(false);
    carryMsRef.current = 0;
    lastWallRef.current = null;
  }, [points]);

  // Playback clock: while playing, run a requestAnimationFrame loop that converts
  // wall-clock time into simulated flight time (wallDelta * speed), accumulates it
  // in carryMsRef, then advances index across telemetry points by spending that
  // budget on each point's elapsed_ms delta. Stops at the last point. Depends on
  // playing/speed/points only — index is read/written via refs so the loop does
  // not restart every frame.
  useEffect(() => {
    if (!playing || points.length < 2) {
      lastWallRef.current = null;
      return;
    }

    let rafId = 0;

    const tick = (now: number) => {
      if (lastWallRef.current === null) {
        lastWallRef.current = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const wallDelta = now - lastWallRef.current;
      lastWallRef.current = now;
      carryMsRef.current += wallDelta * speed;

      let i = indexRef.current;

      while (i < points.length - 1) {
        const step = points[i + 1].elapsed_ms - points[i].elapsed_ms;
        // Duplicate / identical timestamps: always advance.
        const cost = step > 0 ? step : 1;

        if (carryMsRef.current < cost) {
          break;
        }

        carryMsRef.current -= cost;
        i += 1;
      }

      const moved = i !== indexRef.current;
      if (moved) {
        indexRef.current = i;
      }

      const atEnd = i >= points.length - 1;
      const dueForUi =
        atEnd || now - lastEmitWallRef.current >= UI_EMIT_INTERVAL_MS;

      if (moved && dueForUi) {
        lastEmitWallRef.current = now;
        setIndex(i);
      }

      if (atEnd) {
        // Final index flush (in case last emit was throttled) + stop.
        setIndex(i);
        setPlaying(false);
        carryMsRef.current = 0;
        lastWallRef.current = null;
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [playing, speed, points]);

  const play = useCallback(() => {
    if (points.length === 0) {
      return;
    }
    // Restart from beginning if we finished.
    if (indexRef.current >= points.length - 1) {
      indexRef.current = 0;
      setIndex(0);
      carryMsRef.current = 0;
    }
    setPlaying(true);
  }, [points.length]);

  const pause = useCallback(() => {
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) {
      pause();
    } else {
      play();
    }
  }, [playing, play, pause]);

  const setSpeed = useCallback((next: PlaybackSpeed) => {
    setSpeedState(next);
  }, []);

  const scrub = useCallback(
    (nextIndex: number) => {
      if (points.length === 0) {
        return;
      }
      const clamped = Math.max(0, Math.min(nextIndex, points.length - 1));
      indexRef.current = clamped;
      setIndex(clamped);
      carryMsRef.current = 0;
      lastWallRef.current = null;
    },
    [points.length],
  );

  return {
    index,
    playing,
    speed,
    play,
    pause,
    toggle,
    setSpeed,
    scrub,
    current: points[index] ?? null,
  };
}