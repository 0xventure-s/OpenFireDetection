'use client';

import { useMemo, useState } from 'react';
import Map, { Marker, NavigationControl, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { MapPin, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAP_CENTER } from '@/lib/constants';
import 'maplibre-gl/dist/maplibre-gl.css';

type CoordinatePickerMapProps = {
  lat: string;
  lon: string;
  onChange: (coords: { lat: string; lon: string }) => void;
};

const FALLBACK_COORDS = {
  lat: -28.46,
  lon: -65.78,
  zoom: 12,
};

export function CoordinatePickerMap({ lat, lon, onChange }: CoordinatePickerMapProps) {
  const selectedCoords = useMemo(() => parseCoords(lat, lon), [lat, lon]);
  const center = selectedCoords ?? FALLBACK_COORDS;
  const [viewState, setViewState] = useState({
    longitude: center.lon,
    latitude: center.lat,
    zoom: selectedCoords ? 14 : MAP_CENTER.zoom,
  });

  const markLocation = (nextLat: number, nextLon: number) => {
    onChange({
      lat: formatCoord(nextLat),
      lon: formatCoord(nextLon),
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">Ubicacion en mapa</div>
          <div className="truncate text-xs text-muted-foreground">
            {selectedCoords ? `${formatCoord(selectedCoords.lat)}, ${formatCoord(selectedCoords.lon)}` : 'Click en el mapa para marcar el punto real'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Centrar mapa"
            onClick={() => setViewState((current) => ({ ...current, longitude: center.lon, latitude: center.lat, zoom: selectedCoords ? 14 : FALLBACK_COORDS.zoom }))}
          >
            <RotateCcw />
          </Button>
          {selectedCoords ? (
            <Button type="button" variant="outline" size="icon-sm" aria-label="Limpiar ubicacion" onClick={() => onChange({ lat: '', lon: '' })}>
              <X />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="h-48">
        <Map
          {...viewState}
          onMove={(event: ViewStateChangeEvent) => setViewState(event.viewState)}
          onClick={(event) => markLocation(event.lngLat.lat, event.lngLat.lng)}
          style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
          mapStyle={{
            version: 8,
            sources: {
              satellite: {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: 'Esri',
              },
            },
            layers: [
              {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                minzoom: 0,
                maxzoom: 22,
              },
            ],
          }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {selectedCoords ? (
            <Marker longitude={selectedCoords.lon} latitude={selectedCoords.lat} anchor="bottom">
              <div className="flex size-9 items-center justify-center rounded-full border border-red-200 bg-red-600 text-white shadow-lg shadow-black/35">
                <MapPin className="size-5" fill="currentColor" />
              </div>
            </Marker>
          ) : null}
        </Map>
      </div>
    </div>
  );
}

function parseCoords(lat: string, lon: string) {
  const parsedLat = Number(lat.replace(',', '.'));
  const parsedLon = Number(lon.replace(',', '.'));
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLon < -180 || parsedLon > 180) return null;
  return { lat: parsedLat, lon: parsedLon };
}

function formatCoord(value: number) {
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
