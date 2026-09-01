import { FIRMS_GEOSTATIONARY_PRODUCTS, FIRMS_POLAR_PRODUCTS } from './satellite-layers';

export const JURISDICTION_NAME = process.env.NEXT_PUBLIC_JURISDICTION_NAME?.trim() || 'Jurisdicción demo';
export const JURISDICTION_TIMEZONE = process.env.NEXT_PUBLIC_JURISDICTION_TIMEZONE?.trim() || 'UTC';

// Safe demo extent. Every installation should set its own public bounding box.
export const JURISDICTION_BBOX = {
  west: envNumber(process.env.NEXT_PUBLIC_BBOX_WEST, -67),
  south: envNumber(process.env.NEXT_PUBLIC_BBOX_SOUTH, -32),
  east: envNumber(process.env.NEXT_PUBLIC_BBOX_EAST, -63),
  north: envNumber(process.env.NEXT_PUBLIC_BBOX_NORTH, -28),
};

export const MAP_CENTER = {
  lat: envNumber(process.env.NEXT_PUBLIC_MAP_CENTER_LAT, -30),
  lon: envNumber(process.env.NEXT_PUBLIC_MAP_CENTER_LON, -65),
  zoom: envNumber(process.env.NEXT_PUBLIC_MAP_ZOOM, 7),
};

export const SMN_RADAR_URL = 'https://ws2.smn.gob.ar/radar';

export const NASA_GIBS_PRECIPITATION_TILE_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png';

export const NASA_GIBS_PRECIPITATION_METADATA_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/default/GoogleMapsCompatible_Level6/0/0/0.png';

// Fire status types
export const FIRE_STATUS = {
  UNCONFIRMED: 'unconfirmed',
  PROBABLE: 'probable',
  CONFIRMED: 'confirmed',
  FALSE_POSITIVE: 'false_positive',
  EXTINGUISHED: 'extinguished',
} as const;

// Fire status colors
export const STATUS_COLORS = {
  unconfirmed: '#06b6d4', // cyan
  probable: '#f59e0b',    // amber
  confirmed: '#ef4444',   // red
  false_positive: '#64748b', // slate
  extinguished: '#10b981', // green
} as const;

export const STATUS_LABELS = {
  unconfirmed: 'Sin confirmar',
  probable: 'Probable',
  confirmed: 'Confirmado',
  false_positive: 'Falso positivo',
  extinguished: 'Extinguido',
} as const;

export const LIFECYCLE_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
  TEST: 'test',
} as const;

export const LIFECYCLE_LABELS = {
  active: 'Activo',
  closed: 'Cerrado',
  archived: 'Archivado',
  test: 'Prueba',
} as const;

// FIRMS API configuration
export const FIRMS_CONFIG = {
  BASE_URL: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
  RATE_LIMIT: 5000, // requests per 10 minutes
  CACHE_TTL: 600000, // 10 minutes in milliseconds
  MAX_DAYS: 10, // Maximum days to query
  // Múltiples satélites para mejor cobertura
  SATELLITES: [...FIRMS_POLAR_PRODUCTS, ...FIRMS_GEOSTATIONARY_PRODUCTS],
} as const;

// Detection thresholds
export const DETECTION_THRESHOLDS = {
  NEARBY_RADIUS_KM: 1, // Radius to consider fires as "nearby"
  NEARBY_TIME_MINUTES: 30, // Time window for nearby detection
  PROBABLE_REPEATS: 2, // Number of detections to mark as "probable"
  FIRMS_MATCH_RADIUS_KM: 3, // Radius to match FIRMS data
  FIRMS_MATCH_HOURS: 3, // Time window to match FIRMS data
  MIN_FRP_MW: 1.0, // Minimum FRP in MW to be considered a real fire
  AUTO_CLOSE_UNACTIONED_HOURS: 24, // Move unoperated active incidents to history
  AUTO_CLOSE_STALE_ACTIVE_HOURS: 3, // Move active incidents with no fresh satellite signal to history
} as const;

// API rate limiting
export const RATE_LIMITS = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 100, // per window
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const;

function envNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
