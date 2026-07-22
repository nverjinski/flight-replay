import { useEffect, useMemo, useRef, useState } from "react";
import { MapPinIcon } from "@heroicons/react/24/solid";
import { Map, useControl } from "react-map-gl/mapbox";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { MapViewState } from "@deck.gl/core";
import type { TelemetryPoint } from "../types/telemetry";
import { AIRCRAFT_ICON_ATLAS, AIRCRAFT_ICON_MAPPING } from "../lib/aircraftIcon";
import "mapbox-gl/dist/mapbox-gl.css";

type OverlayProps = {
  layers: ConstructorParameters<typeof MapboxOverlay>[0] extends infer P
    ? P extends { layers?: infer L }
      ? L
      : never
    : never;
};

/** Bridge Deck.gl layers onto a Mapbox map (react-map-gl). */
function DeckGLOverlay({ layers }: { layers: OverlayProps["layers"] }) {
  const overlay = useControl<MapboxOverlay>(
    // Non-interleaved: Deck draws in an overlay canvas above the map.
    // More reliable for IconLayer textures than interleaved Mapbox layers.
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

/**
 * Mapbox basemap + Deck.gl path trail and heading-aware aircraft marker.
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
    // Ref first so the rAF loop stops pulling the camera before React re-renders.
    followActiveRef.current = false;
    setFollowActive(false);
  };

  const armFollow = () => {
    followActiveRef.current = true;
    setFollowActive(true);
  };

  // Arm follow whenever playback starts; clear when it stops.
  useEffect(() => {
    if (playing) {
      armFollow();
    } else {
      breakFollow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to play/pause edges
  }, [playing]);

  // Damped pan-only follow. Preserves the user's zoom.
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

  const pathFeature = useMemo(
    () => [
      {
        path: points.map((p) => [p.longitude, p.latitude] as [number, number]),
      },
    ],
    [points],
  );

  const flownFeature = useMemo(() => {
    const flown = points
      .slice(0, sampleIndex + 1)
      .map((p) => [p.longitude, p.latitude] as [number, number]);
    const tip: [number, number] = [current.longitude, current.latitude];
    const last = flown[flown.length - 1];
    if (!last || last[0] !== tip[0] || last[1] !== tip[1]) {
      flown.push(tip);
    }
    if (flown.length < 2 && points[0]) {
      flown.unshift([points[0].longitude, points[0].latitude]);
    }
    return [{ path: flown }];
  }, [points, sampleIndex, current.longitude, current.latitude]);

  const layers = useMemo(() => {
    const trail = new PathLayer({
      id: "flight-trail-full",
      data: pathFeature,
      getPath: (d: { path: [number, number][] }) => d.path,
      getColor: [80, 100, 130, 160],
      getWidth: 3,
      widthUnits: "pixels",
      pickable: false,
    });

    const flown = new PathLayer({
      id: "flight-trail-flown",
      data: flownFeature,
      getPath: (d: { path: [number, number][] }) => d.path,
      getColor: [94, 200, 255, 230],
      getWidth: 4,
      widthUnits: "pixels",
      pickable: false,
      updateTriggers: {
        getPath: [sampleIndex, current.longitude, current.latitude],
      },
    });

    const aircraftData = [
      {
        position: [current.longitude, current.latitude] as [number, number],
        heading: current.heading_true_deg,
      },
    ];

    const aircraftDot = new ScatterplotLayer({
      id: "aircraft-dot",
      data: aircraftData,
      getPosition: (d: { position: [number, number] }) => d.position,
      getRadius: 10,
      radiusUnits: "pixels",
      getFillColor: [255, 176, 32, 255],
      getLineColor: [11, 16, 23, 255],
      lineWidthUnits: "pixels",
      getLineWidth: 2,
      stroked: true,
      pickable: false,
      parameters: { depthTest: false },
      updateTriggers: {
        getPosition: [current.longitude, current.latitude],
      },
    });

    const aircraft = new IconLayer({
      id: "aircraft",
      data: aircraftData,
      iconAtlas: AIRCRAFT_ICON_ATLAS,
      iconMapping: AIRCRAFT_ICON_MAPPING,
      getIcon: () => "aircraft",
      getPosition: (d: { position: [number, number] }) => d.position,
      getAngle: (d: { heading: number }) => -d.heading,
      getSize: 56,
      sizeUnits: "pixels",
      billboard: true,
      pickable: false,
      alphaCutoff: 0.05,
      parameters: { depthTest: false },
      updateTriggers: {
        getPosition: [current.longitude, current.latitude],
        getAngle: [current.heading_true_deg],
      },
    });

    return [trail, flown, aircraftDot, aircraft];
  }, [
    pathFeature,
    flownFeature,
    sampleIndex,
    current.longitude,
    current.latitude,
    current.heading_true_deg,
  ]);

  if (!token) {
    return (
      <div className="map-missing-token">
        Set <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env</code> and restart Vite.
      </div>
    );
  }

  const showRecenter = playing && !followActive;

  return (
    <div className="replay-map">
      <Map
        mapboxAccessToken={token}
        {...viewState}
        onMove={(evt) => {
          viewStateRef.current = evt.viewState;
          setViewState(evt.viewState);

          // User-driven map moves include originalEvent. Programmatic follow
          // updates do not. Wheel/pinch zoom keeps follow; drag pan breaks it.
          const original = (evt as {originalEvent?: Event}).originalEvent;
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
