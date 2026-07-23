import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinIcon, PaperAirplaneIcon } from "@heroicons/react/24/solid";
import { Map, Marker, useControl } from "react-map-gl/mapbox";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer } from "@deck.gl/layers";
import type { MapViewState } from "@deck.gl/core";
import type { TelemetryPoint } from "../types/telemetry";
import "mapbox-gl/dist/mapbox-gl.css";

type OverlayProps = {
  layers: ConstructorParameters<typeof MapboxOverlay>[0] extends infer P
    ? P extends { layers?: infer L }
      ? L
      : never
    : never;
};

/** Bridge Deck.gl path layers onto a Mapbox map (react-map-gl). */
function DeckGLOverlay({ layers }: { layers: OverlayProps["layers"] }) {
  const overlay = useControl<MapboxOverlay>(
    () => new MapboxOverlay({ interleaved: false }),
  );

  useEffect(() => {
    overlay.setProps({ layers });
  }, [overlay, layers]);

  return null;
}

type Props = {
  points: TelemetryPoint[];
  /** Interpolated playback pose (smooth between samples). */
  current: TelemetryPoint;
  /** Discrete index for the flown-path polyline. */
  sampleIndex: number;
  /** When playback is running, follow arms automatically until the user pans. */
  playing?: boolean;
};

function boundsFromPoints(points: TelemetryPoint[]): MapViewState {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const p of points) {
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
  }

  return {
    longitude: (minLon + maxLon) / 2,
    latitude: (minLat + maxLat) / 2,
    zoom: 9.5,
    pitch: 0,
    bearing: 0,
  };
}

/** Wheel / pinch zoom should not break follow; drag pan should. */
function isZoomGesture(originalEvent: Event): boolean {
  if (typeof WheelEvent !== "undefined" && originalEvent instanceof WheelEvent) {
    return true;
  }
  if (typeof TouchEvent !== "undefined" && originalEvent instanceof TouchEvent) {
    return originalEvent.touches.length > 1;
  }
  return false;
}

function toPathCoords(slice: TelemetryPoint[]): [number, number][] {
  return slice.map((p) => [p.longitude, p.latitude]);
}

function ensureMinPath(path: [number, number][]): [number, number][] {
  if (path.length === 1) {
    return [path[0]!, path[0]!];
  }
  return path;
}

/**
 * Mapbox basemap + Deck.gl path trail + Heroicons aircraft marker.
 * Play arms camera follow; panning breaks follow and shows a recenter control.
 * Zoom never breaks follow.
 */
export function ReplayMap({
  points,
  current,
  sampleIndex,
  playing = false,
}: Props) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  const initialViewState = useMemo(() => boundsFromPoints(points), [points]);
  const [viewState, setViewState] = useState<MapViewState>(initialViewState);
  const [followActive, setFollowActive] = useState(false);

  const viewStateRef = useRef(viewState);
  const followTargetRef = useRef({
    longitude: current.longitude,
    latitude: current.latitude,
  });
  const followActiveRef = useRef(false);
  const playingRef = useRef(playing);

  viewStateRef.current = viewState;
  followTargetRef.current = {
    longitude: current.longitude,
    latitude: current.latitude,
  };
  playingRef.current = playing;

  const breakFollow = () => {
    followActiveRef.current = false;
    setFollowActive(false);
  };

  const armFollow = () => {
    followActiveRef.current = true;
    setFollowActive(true);
  };

  useEffect(() => {
    if (playing) {
      armFollow();
    } else {
      breakFollow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to play/pause edges
  }, [playing]);

  useEffect(() => {
    if (!followActive) {
      return;
    }

    const FOLLOW_LERP = 0.12;
    let rafId = 0;

    const tick = () => {
      if (followActiveRef.current) {
        const prev = viewStateRef.current;
        const target = followTargetRef.current;
        const longitude =
          prev.longitude + (target.longitude - prev.longitude) * FOLLOW_LERP;
        const latitude =
          prev.latitude + (target.latitude - prev.latitude) * FOLLOW_LERP;

        if (
          Math.abs(longitude - prev.longitude) > 1e-8 ||
          Math.abs(latitude - prev.latitude) > 1e-8
        ) {
          const next = { ...prev, longitude, latitude };
          viewStateRef.current = next;
          setViewState(next);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [followActive]);

  const recenterOnAircraft = () => {
    const prev = viewStateRef.current;
    const next = {
      ...prev,
      longitude: current.longitude,
      latitude: current.latitude,
    };
    viewStateRef.current = next;
    setViewState(next);
    armFollow();
  };

  // Flown = discrete samples through sampleIndex + interpolated tip (glued to
  // the aircraft). Remaining starts at that same tip so the two PathLayers
  // share a vertex but do not overdraw the same segment (reduces AA static).
  const tip = useMemo(
    (): [number, number] => [current.longitude, current.latitude],
    [current.longitude, current.latitude],
  );

  const flownFeature = useMemo(() => {
    const path = toPathCoords(points.slice(0, sampleIndex + 1));
    const last = path[path.length - 1];
    if (!last || last[0] !== tip[0] || last[1] !== tip[1]) {
      path.push(tip);
    }
    const finalPath = ensureMinPath(path);
    return finalPath.length >= 2 ? [{ path: finalPath }] : [];
  }, [points, sampleIndex, tip]);

  const remainingFeature = useMemo(() => {
    const rest = toPathCoords(points.slice(sampleIndex + 1));
    const path = ensureMinPath([tip, ...rest]);
    return path.length >= 2 ? [{ path }] : [];
  }, [points, sampleIndex, tip]);

  const layers = useMemo(() => {
    const remaining = new PathLayer({
      id: "flight-trail-remaining",
      data: remainingFeature,
      getPath: (d: { path: [number, number][] }) => d.path,
      getColor: [80, 100, 130, 255],
      getWidth: 3,
      widthUnits: "pixels",
      widthMinPixels: 2,
      pickable: false,
      parameters: { depthTest: false },
      updateTriggers: {
        getPath: [sampleIndex, tip[0], tip[1]],
      },
    });

    const flown = new PathLayer({
      id: "flight-trail-flown",
      data: flownFeature,
      getPath: (d: { path: [number, number][] }) => d.path,
      getColor: [94, 200, 255, 255],
      getWidth: 4,
      widthUnits: "pixels",
      widthMinPixels: 2,
      pickable: false,
      parameters: { depthTest: false },
      updateTriggers: {
        getPath: [sampleIndex, tip[0], tip[1]],
      },
    });

    // Remaining under flown so the join pixel prefers cyan.
    return [remaining, flown];
  }, [remainingFeature, flownFeature, sampleIndex, tip]);

  if (!token) {
    return (
      <div className="map-missing-token">
        Set <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env</code> and restart Vite.
      </div>
    );
  }

  const showRecenter = playing && !followActive;

  // Heroicons PaperAirplane points east by default; offset so 0° heading = north.
  const markerRotation = current.heading_true_deg - 90;

  return (
    <div className="replay-map">
      <Map
        mapboxAccessToken={token}
        {...viewState}
        onMove={(evt) => {
          viewStateRef.current = evt.viewState;
          setViewState(evt.viewState);

          const original = (evt as { originalEvent?: Event }).originalEvent;
          if (
            playingRef.current &&
            followActiveRef.current &&
            original &&
            !isZoomGesture(original)
          ) {
            breakFollow();
          }
        }}
        onDragStart={() => {
          if (playingRef.current) {
            breakFollow();
          }
        }}
        onDrag={() => {
          if (playingRef.current && followActiveRef.current) {
            breakFollow();
          }
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <DeckGLOverlay layers={layers} />
        <Marker
          longitude={current.longitude}
          latitude={current.latitude}
          anchor="center"
          rotation={markerRotation}
          rotationAlignment="map"
          pitchAlignment="map"
          style={{ zIndex: 3 }}
        >
          <PaperAirplaneIcon
            className="aircraft-marker-icon"
            aria-label="Aircraft"
          />
        </Marker>
      </Map>

      {showRecenter && (
        <button
          type="button"
          className="map-recenter-btn"
          onClick={recenterOnAircraft}
          title="Re-center and follow aircraft"
          aria-label="Re-center and follow aircraft"
        >
          <MapPinIcon className="map-recenter-icon" />
        </button>
      )}
    </div>
  );
}
