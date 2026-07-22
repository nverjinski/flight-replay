/** Mirrors backend FlightSummary (api/schemas.py) */
export type FlightSummary = {
    id: string;
    point_count: number;
    duration_ms: number;
    aircraft_type: string;
    tail_number: string;
    origin_label: string | null;
    destination_label: string | null;
    phases: string[];
    synthetic: boolean;
  };
  
  /** Mirrors backend TelemetryPoint (api/schemas.py) */
  export type TelemetryPoint = {
    schema_version: string;
    flight_id: string;
    sequence: number;
    timestamp: string; // JSON datetime → ISO string
    elapsed_ms: number;
    latitude: number;
    longitude: number;
    altitude_ft: number;
    heading_true_deg: number;
    pitch_deg: number;
    bank_deg: number;
    indicated_airspeed_kt: number;
    vertical_speed_fpm: number;
    phase: string;
    on_ground: boolean;
    aircraft_type: string;
    tail_number: string;
    throttle_pct: number;
    flaps_deg: number;
    gear_down: boolean;
    synthetic: boolean;
  };