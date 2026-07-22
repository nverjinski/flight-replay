import { useEffect, useMemo, useRef, useState } from "react";
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
  /** When true, ease the camera toward the aircraft (unless user is dragging/zooming). */
  follow?: boolean;
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

  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  return {
    longitude: centerLon,
    latitude: centerLat,
    // Corridor overview; follow mode eases in closer so early climb is visible.
    zoom: 9.5,
    pitch: 0,
    bearing: 0,
  };
}

/**
 * Mapbox basemap + Deck.gl path trail and heading-aware aircraft marker.
 * Trail geometry is memoized; aircraft uses the interpolated `current` pose.
 */
export function ReplayMap({
  points,
  current,
  sampleIndex,
  follow = true,
}: Props) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  const initialViewState = useMemo(() => boundsFromPoints(points), [points]);
  const [viewState, setViewState] = useState<MapViewState>(initialViewState);

  const viewStateRef = useRef(viewState);
  const followTargetRef = useRef({
    longitude: current.longitude,
    latitude: current.latitude,
  });
  const userInteractingRef = useRef(false);
  const followEnabledRef = useRef(follow);

  viewStateRef.current = viewState;
  followTargetRef.current = {
    longitude: current.longitude,
    latitude: current.latitude,
  };
  followEnabledRef.current = follow;

  // Damped camera follow on rAF. Skips frames while the user drags/zooms so we
  // never snap the map out from under a held pointer. Also eases zoom in — at
  // overview zoom (~8) early climb only moves a few hundred meters and looks
  // "stuck on the runway" even when altitude/phase have advanced correctly.
  useEffect(() => {
    if (!follow) {
      return;
    }

    const FOLLOW_LERP = 0.12;
    const FOLLOW_ZOOM = 12;
    const ZOOM_LERP = 0.06;
    let rafId = 0;

    const tick = () => {
      if (!userInteractingRef.current && followEnabledRef.current) {
        const prev = viewStateRef.current;
        const target = followTargetRef.current;
        const longitude =
          prev.longitude + (target.longitude - prev.longitude) * FOLLOW_LERP;
        const latitude =
          prev.latitude + (target.latitude - prev.latitude) * FOLLOW_LERP;
        const zoom = prev.zoom + (FOLLOW_ZOOM - prev.zoom) * ZOOM_LERP;

        if (
          Math.abs(longitude - prev.longitude) > 1e-8 ||
          Math.abs(latitude - prev.latitude) > 1e-8 ||
          Math.abs(zoom - prev.zoom) > 1e-4
        ) {
          const next = { ...prev, longitude, latitude, zoom };
          viewStateRef.current = next;
          setViewState(next);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [follow]);

  const pathFeature = useMemo(
    () => [
      {
        path: points.map((p) => [p.longitude, p.latitude] as [number, number]),
      },
    ],
    [points],
  );

  const flownFeature = useMemo(() => {
    // Discrete samples up to the current index, then the interpolated pose so the
    // cyan trail tip stays glued to the aircraft (not one sample behind).
    const flown = points
      .slice(0, sampleIndex + 1)
      .map((p) => [p.longitude, p.latitude] as [number, number]);
    const tip: [number, number] = [current.longitude, current.latitude];
    const last = flown[flown.length - 1];
    if (!last || last[0] !== tip[0] || last[1] !== tip[1]) {
      flown.push(tip);
    }
    // PathLayer needs at least 2 vertices.
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

  return (
    <div className="replay-map">
      <Map
        mapboxAccessToken={token}
        {...viewState}
        onMove={(evt) => {
          viewStateRef.current = evt.viewState;
          setViewState(evt.viewState);
        }}
        onDragStart={() => {
          userInteractingRef.current = true;
        }}
        onDragEnd={() => {
          userInteractingRef.current = false;
        }}
        onZoomStart={() => {
          userInteractingRef.current = true;
        }}
        onZoomEnd={() => {
          userInteractingRef.current = false;
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        attributionControl={true}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
    </div>
  );
}
