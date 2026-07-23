import { AIRCRAFT_ICON_DATA_URL } from "./aircraftIconData";

/**
 * Atlas for Deck.gl IconLayer — data URL so WebGL does not depend on Vite's
 * hashed asset fetch (which often fails silently for IconLayer).
 * Source art: Heroicons solid PaperAirplane in src/assets/aircraft.svg
 */
export const AIRCRAFT_ICON_ATLAS = AIRCRAFT_ICON_DATA_URL;

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
