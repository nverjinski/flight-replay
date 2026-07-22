import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { interpolateTelemetry } from "../lib/interpolateTelemetry";
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
  /** Jump to a discrete sample (blend reset). */
  scrub: (index: number) => void;
  /** Jump to an interpolated time along the flight (keeps scrubber/clock/charts aligned). */
  scrubToElapsed: (elapsedMs: number) => void;
  /** Discrete sample at `index` (phase markers, flown path). */
  sample: TelemetryPoint | null;
  /** Position blended toward the next sample using leftover carry time. */
  current: TelemetryPoint | null;
};

/**
 * Advance by simulated flight time:
 *   wall_ms_elapsed * speed  ≈  how much elapsed_ms to consume
 *
 * So 50× means “50 seconds of flight per 1 second of wall clock”,
 * not “50 animation frames per second”.
 *
 * Between samples, `blend` (0–1) tracks progress across the current step so
 * the map icon can move continuously instead of jumping ~1s at a time.
 */
export function usePlayback(points: TelemetryPoint[]): PlaybackState {
  const [index, setIndex] = useState(0);
  const [blend, setBlend] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);

  const indexRef = useRef(0);
  const carryMsRef = useRef(0);
  const lastWallRef = useRef<number | null>(null);
  const lastEmitWallRef = useRef(0);
  /** Max React setState rate while playing (~120fps). rAF still caps to display refresh. */
  const UI_EMIT_INTERVAL_MS = 1000 / 120;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    setIndex(0);
    indexRef.current = 0;
    setBlend(0);
    setPlaying(false);
    carryMsRef.current = 0;
    lastWallRef.current = null;
  }, [points]);

  // Playback clock: while playing, run a requestAnimationFrame loop that converts
  // wall-clock time into simulated flight time (wallDelta * speed), accumulates it
  // in carryMsRef, then advances index across telemetry points by spending that
  // budget on each point's elapsed_ms delta. Leftover carry / step → blend for
  // smooth interpolation. Stops at the last point.
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
        const cost = step > 0 ? step : 1;

        if (carryMsRef.current < cost) {
          break;
        }

        carryMsRef.current -= cost;
        i += 1;
      }

      if (i !== indexRef.current) {
        indexRef.current = i;
      }

      const atEnd = i >= points.length - 1;
      let nextBlend = 0;
      if (!atEnd) {
        const step = points[i + 1].elapsed_ms - points[i].elapsed_ms;
        nextBlend = step > 0 ? Math.min(1, carryMsRef.current / step) : 0;
      }

      const dueForUi = atEnd || now - lastEmitWallRef.current >= UI_EMIT_INTERVAL_MS;
      if (dueForUi) {
        lastEmitWallRef.current = now;
        setIndex(i);
        setBlend(nextBlend);
      }

      if (atEnd) {
        setIndex(i);
        setBlend(0);
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
    if (indexRef.current >= points.length - 1) {
      indexRef.current = 0;
      setIndex(0);
      setBlend(0);
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
      setBlend(0);
      carryMsRef.current = 0;
      lastWallRef.current = null;
    },
    [points.length],
  );

  const scrubToElapsed = useCallback(
    (elapsedMs: number) => {
      if (points.length === 0) {
        return;
      }

      const maxElapsed = points[points.length - 1].elapsed_ms;
      const target = Math.max(0, Math.min(elapsedMs, maxElapsed));

      // Largest index with elapsed_ms <= target.
      let lo = 0;
      let hi = points.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (points[mid].elapsed_ms <= target) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }

      const i = lo;
      indexRef.current = i;
      setIndex(i);
      lastWallRef.current = null;

      if (i >= points.length - 1) {
        setBlend(0);
        carryMsRef.current = 0;
        return;
      }

      const step = points[i + 1].elapsed_ms - points[i].elapsed_ms;
      const into = target - points[i].elapsed_ms;
      if (step <= 0) {
        setBlend(0);
        carryMsRef.current = 0;
        return;
      }

      const nextBlend = Math.min(1, Math.max(0, into / step));
      setBlend(nextBlend);
      carryMsRef.current = into;
    },
    [points],
  );

  const sample = points[index] ?? null;

  const current = useMemo(() => {
    if (!sample) {
      return null;
    }
    const next = points[Math.min(index + 1, points.length - 1)];
    if (!next || blend <= 0) {
      return sample;
    }
    return interpolateTelemetry(sample, next, blend);
  }, [points, index, blend, sample]);

  return {
    index,
    playing,
    speed,
    play,
    pause,
    toggle,
    setSpeed,
    scrub,
    scrubToElapsed,
    sample,
    current,
  };
}
