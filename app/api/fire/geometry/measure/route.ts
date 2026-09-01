import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { area, length, lineString, polygon } from '@turf/turf';
import { fail, getErrorMessage, ok } from '@/lib/api';
import { geometryMeasureSchema } from '@/lib/validations';
import { guardFireApi } from '../../_auth';

export async function POST(request: NextRequest) {
  try {
    const authResponse = await guardFireApi(request, 'incident.read');
    if (authResponse) return authResponse;

    const validated = geometryMeasureSchema.parse(await request.json());

    if (validated.type === 'line') {
      const feature = lineString(validated.coordinates);
      return ok({
        type: 'line',
        distanceKm: Number(length(feature, { units: 'kilometers' }).toFixed(3)),
      });
    }

    const coordinates = closePolygon(validated.coordinates);
    const feature = polygon([coordinates]);
    const areaSqM = area(feature);
    const perimeterKm = length(lineString(coordinates), { units: 'kilometers' });

    return ok({
      type: 'polygon',
      areaHa: Number((areaSqM / 10000).toFixed(2)),
      perimeterKm: Number(perimeterKm.toFixed(3)),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(400, 'Validation error', error.errors[0]?.message);
    }
    return fail(500, 'Internal server error', getErrorMessage(error));
  }
}

function closePolygon(coordinates: Array<[number, number]>) {
  const first = coordinates[0];
  const last = coordinates.at(-1);
  if (!first || !last) return coordinates;
  if (first[0] === last[0] && first[1] === last[1]) return coordinates;
  return [...coordinates, first];
}
