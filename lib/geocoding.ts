/**
 * Geocoding utilities - Get place names from coordinates
 */

interface GeocodingResult {
  displayName: string;
  lat: number;
  lon: number;
}

// Cache for geocoding results
const geocodingCache = new Map<string, { data: GeocodingResult; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get place name from coordinates using Nominatim (OpenStreetMap)
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodingResult> {
  const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;

  // Check cache first
  if (geocodingCache.has(cacheKey)) {
    const cached = geocodingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    // Use API endpoint instead of direct fetch to avoid CORS issues
    const response = await fetch(
      `/api/geocoding/reverse?lat=${lat}&lon=${lon}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const displayName = data.displayName || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

    const result: GeocodingResult = {
      displayName,
      lat,
      lon,
    };

    // Cache the result
    geocodingCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error('[Geocoding] Error:', error);

    // Return fallback
    const fallback: GeocodingResult = {
      displayName: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
      lat,
      lon,
    };

    return fallback;
  }
}

/**
 * Get simple location name (for cards/lists)
 */
export async function getLocationName(lat: number, lon: number): Promise<string> {
  const result = await reverseGeocode(lat, lon);
  return result.displayName;
}

/**
 * Clear geocoding cache
 */
export function clearGeocodeCache() {
  geocodingCache.clear();
}
