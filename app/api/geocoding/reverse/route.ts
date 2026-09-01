import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM_CACHE = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Missing lat or lon parameters' },
        { status: 400 }
      );
    }

    const cacheKey = `${lat},${lon}`;
    const cached = NOMINATIM_CACHE.get(cacheKey);

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ displayName: cached.name });
    }

    // Fetch from Nominatim
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=es`,
      {
        headers: {
          'User-Agent': 'OpenFireDetection/1.0',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { displayName: `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lon).toFixed(4)}°` }
      );
    }

    const data = await response.json();
    const displayName = data.address?.city ||
                       data.address?.town ||
                       data.address?.village ||
                       data.address?.county ||
                       `${parseFloat(lat).toFixed(4)}°, ${parseFloat(lon).toFixed(4)}°`;

    // Cache the result
    NOMINATIM_CACHE.set(cacheKey, {
      name: displayName,
      timestamp: Date.now(),
    });

    return NextResponse.json({ displayName });
  } catch (error) {
    console.error('[API] Geocoding error:', error);
    return NextResponse.json(
      { displayName: 'Ubicación desconocida' }
    );
  }
}
