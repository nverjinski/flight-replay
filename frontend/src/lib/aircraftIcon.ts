import aircraftUrl from "../assets/aircraft.png";

/**
 * Raster atlas URL for Deck.gl IconLayer.
 * Note: WebGL textures need PNG/JPEG — SVG imports often fail to appear.
 */
export const AIRCRAFT_ICON_ATLAS = aircraftUrl;

export const AIRCRAFT_ICON_MAPPING = {
  aircraft: {
    x: 0,
    y: 0,
    width: 128,
    height: 128,
    mask: false,
    anchorX: 64,
    anchorY: 64,
  },
} as const;
