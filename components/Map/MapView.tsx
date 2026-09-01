'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Map, { Layer, Marker, NavigationControl, ScaleControl, Source, MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { Activity, ArrowUp, Building2, CloudLightning, CloudRain, Droplets, ExternalLink, Flame, MapPinPlus, Pentagon, Radio, Ruler, ThermometerSun, Truck, Wind, Wrench, X } from 'lucide-react';
import { MAP_CENTER, NASA_GIBS_PRECIPITATION_TILE_URL, SMN_RADAR_URL, STATUS_COLORS } from '@/lib/constants';
import { JURISDICTION_GEOJSON, isPointInJurisdiction } from '@/lib/jurisdiction';
import { useWindLayer } from '@/hooks/useWindLayer';
import { useThermalLayer } from '@/hooks/useThermalLayer';
import { useEarthquakes, useLightningLayer, usePrecipitationLayer } from '@/hooks/useEnvironmentalLayers';
import { Fire, FireStation, MapLayerKey, OperationalAsset, OperationalUnit, ThermalAnomaly, WindGridPoint } from '@/types';
import {
  buildVisibleWindVectors,
  getWindColor,
  getWindDestination,
  getWindFlowDirection,
  shouldLabelWindVector,
  WIND_LEGEND_STEPS,
} from '@/lib/wind-layer';
import 'maplibre-gl/dist/maplibre-gl.css';

const EMPTY_WIND_POINTS: WindGridPoint[] = [];
const EMPTY_THERMAL_ANOMALIES: ThermalAnomaly[] = [];

interface MapViewProps {
  fires: Fire[];
  selectedFireId: string | null;
  onFireSelect: (fireId: string) => void;
  onMapReady?: (zoomTo: (lat: number, lon: number) => void) => void;
  onAddFire?: (lat: number, lon: number) => void;
  chrome?: 'standard' | 'minimal';
  toolsSlot?: ReactNode;
  markerMode?: 'live' | 'historical';
  operationalUnits?: OperationalUnit[];
  stations?: FireStation[];
  operationalAssets?: OperationalAsset[];
}

export function MapView({
  fires,
  selectedFireId,
  onFireSelect,
  onMapReady,
  onAddFire,
  chrome = 'standard',
  toolsSlot,
  markerMode = 'live',
  operationalUnits = [],
  stations = [],
  operationalAssets = [],
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [viewState, setViewState] = useState<{
    longitude: number;
    latitude: number;
    zoom: number;
  }>({
    longitude: MAP_CENTER.lon,
    latitude: MAP_CENTER.lat,
    zoom: MAP_CENTER.zoom,
  });
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<'line' | 'polygon' | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<Array<[number, number]>>([]);
  const [showTools, setShowTools] = useState(false);
  const [showWindLayer, setShowWindLayer] = useState(false);
  const [showPrecipitationLayer, setShowPrecipitationLayer] = useState(false);
  const [showThermalLayer, setShowThermalLayer] = useState(false);
  const [showResourceLayer, setShowResourceLayer] = useState(false);
  const [mapLayers, setMapLayers] = useState<Record<MapLayerKey, boolean>>({
    fires: true,
    lightning: false,
    earthquakes: false,
    stations: true,
    available_units: true,
    assigned_units: true,
    machinery: true,
    water_assets: true,
  });
  const [selectedResource, setSelectedResource] = useState<MapResourcePreview | null>(null);
  const windLayer = useWindLayer(showWindLayer);
  const precipitationLayer = usePrecipitationLayer(showPrecipitationLayer);
  const thermalLayer = useThermalLayer(showThermalLayer);
  const lightningLayer = useLightningLayer(mapLayers.lightning);
  const earthquakesLayer = useEarthquakes(mapLayers.earthquakes);
  const windPoints = windLayer.data?.points ?? EMPTY_WIND_POINTS;
  const thermalAnomalies = thermalLayer.data?.anomalies ?? EMPTY_THERMAL_ANOMALIES;
  const thermalGeoJson = useMemo(() => buildThermalGeoJson(thermalAnomalies), [thermalAnomalies]);
  const lightningFlashes = useMemo(() => (lightningLayer.data?.flashes || []).slice(0, 300), [lightningLayer.data?.flashes]);
  const earthquakes = earthquakesLayer.data?.events || [];
  const visibleWindPoints = useMemo(
    () => buildVisibleWindVectors(windPoints, viewState.longitude, viewState.latitude, viewState.zoom),
    [windPoints, viewState.longitude, viewState.latitude, viewState.zoom]
  );
  const isMinimalChrome = chrome === 'minimal';
  const isHistoricalMarkerMode = markerMode === 'historical';

  const zoomToLocation = (lat: number, lon: number) => {
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom: 12,
      duration: 1500,
    });
  };

  const togglePrecipitationLayer = () => {
    const willShowPrecipitation = !showPrecipitationLayer;
    setShowPrecipitationLayer(willShowPrecipitation);

    if (willShowPrecipitation && viewState.zoom > 7.2) {
      mapRef.current?.flyTo({
        center: [MAP_CENTER.lon, MAP_CENTER.lat],
        zoom: 6.2,
        duration: 900,
      });
    }
  };

  useEffect(() => {
    onMapReady?.(zoomToLocation);
  }, [onMapReady]);

  useEffect(() => {
    if (!selectedFireId) return;
    const fire = fires.find((item) => item.id === selectedFireId);
    if (fire) {
      zoomToLocation(fire.lat, fire.lon);
    }
  }, [fires, selectedFireId]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(event: ViewStateChangeEvent) => setViewState(event.viewState)}
        onClick={(event) => {
          if (measurementMode) {
            setMeasurementPoints((points) => [...points, [event.lngLat.lng, event.lngLat.lat]]);
            return;
          }
          if (!isSelectingLocation || !onAddFire) return;
          if (!isPointInJurisdiction(event.lngLat.lat, event.lngLat.lng)) return;
          onAddFire(event.lngLat.lat, event.lngLat.lng);
          setIsSelectingLocation(false);
        }}
        style={{ width: '100%', height: '100%', cursor: isSelectingLocation ? 'crosshair' : 'grab' }}
        mapStyle={{
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              maxzoom: 19,
              attribution: '© Esri',
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
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        }}
      >
        {!isMinimalChrome ? <NavigationControl position="top-right" /> : null}
        <ScaleControl position="bottom-right" />

        {showPrecipitationLayer ? (
          <Source
            id="nasa-imerg-precipitation"
            type="raster"
            tiles={[NASA_GIBS_PRECIPITATION_TILE_URL]}
            tileSize={256}
            minzoom={0}
            maxzoom={6}
            attribution="NASA GPM IMERG / GIBS"
          >
            <Layer
              id="nasa-imerg-precipitation-layer"
              type="raster"
              minzoom={0}
              maxzoom={22}
              paint={{
                'raster-opacity': 0.76,
                'raster-fade-duration': 180,
                'raster-resampling': 'linear',
              }}
            />
          </Source>
        ) : null}

        <Source id="jurisdiction" type="geojson" data={JURISDICTION_GEOJSON as never}>
          <Layer
            id="jurisdiction-fill"
            type="fill"
            paint={{
              'fill-color': '#f97316',
              'fill-opacity': 0.06,
            }}
          />
          <Layer
            id="jurisdiction-line"
            type="line"
            paint={{
              'line-color': '#fb923c',
              'line-width': 2,
              'line-opacity': 0.88,
            }}
          />
        </Source>

        {showWindLayer
          ? visibleWindPoints.map((point) => (
              <Marker key={point.id} longitude={point.lon} latitude={point.lat} anchor="center">
                <div
                  className="pointer-events-none flex h-8 w-8 items-center justify-center"
                  title={`${Math.round(point.windSpeedKmh)} km/h, rachas ${Math.round(point.windGustKmh || point.windSpeedKmh)} km/h, hacia ${getWindDestination(point.windDirectionDeg).label.toLowerCase()}`}
                >
                  <WindVector point={point} zoom={viewState.zoom} />
                </div>
              </Marker>
            ))
          : null}

        {measurementPoints.length > 1 ? (
          <Source id="measurement-source" type="geojson" data={buildMeasurementGeoJson(measurementMode, measurementPoints)}>
            <Layer
              id="measurement-line"
              type="line"
              paint={{
                'line-color': '#f59e0b',
                'line-width': 3,
                'line-dasharray': [1, 1],
              }}
            />
            {measurementMode === 'polygon' && measurementPoints.length > 2 ? (
              <Layer
                id="measurement-fill"
                type="fill"
                paint={{
                  'fill-color': '#f59e0b',
                  'fill-opacity': 0.16,
                }}
              />
            ) : null}
          </Source>
        ) : null}

        {showThermalLayer ? (
          <Source id="thermal-anomalies" type="geojson" data={thermalGeoJson as never}>
            <Layer
              id="thermal-anomaly-halo"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 10, 1, 34],
                'circle-color': '#fb923c',
                'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.16, 1, 0.36],
                'circle-blur': 0.7,
              }}
            />
            <Layer
              id="thermal-anomaly-core"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 3, 1, 9],
                'circle-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'intensity'],
                  0.12,
                  '#facc15',
                  0.45,
                  '#fb923c',
                  0.75,
                  '#ef4444',
                  1,
                  '#f8fafc',
                ],
                'circle-opacity': 0.86,
                'circle-stroke-color': '#7f1d1d',
                'circle-stroke-width': 1,
              }}
            />
          </Source>
        ) : null}

        {mapLayers.lightning
          ? lightningFlashes.map((flash, index) => (
              <Marker key={`lightning:${flash.ts}:${flash.lat}:${flash.lon}:${index}`} longitude={flash.lon} latitude={flash.lat} anchor="center">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-200/80 bg-amber-400/15 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.8)]"
                  title={`Rayo GOES-19 · ${formatCompactTime(flash.ts)}`}
                >
                  <CloudLightning size={12} strokeWidth={2.5} />
                </div>
              </Marker>
            ))
          : null}

        {mapLayers.earthquakes
          ? earthquakes.map((earthquake) => (
              <Marker key={`earthquake:${earthquake.id}`} longitude={earthquake.lon} latitude={earthquake.lat} anchor="center">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-violet-200 bg-violet-950/80 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.75)]"
                  title={`Sismo M ${earthquake.magnitude ?? 's/d'} · ${formatCompactTime(earthquake.occurredAt)}`}
                >
                  <Activity size={14} strokeWidth={2.5} />
                </div>
              </Marker>
            ))
          : null}

        {mapLayers.fires ? fires.map((fire) => (
          <Marker
            key={fire.id}
            longitude={fire.lon}
            latitude={fire.lat}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onFireSelect(fire.id);
            }}
          >
            <div
              className="cursor-pointer transition-transform hover:scale-110"
              style={{
                filter: selectedFireId === fire.id ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))' : 'none',
                transform: selectedFireId === fire.id ? 'scale(1.25)' : 'scale(1)',
              }}
            >
              <Flame
                size={selectedFireId === fire.id ? (isHistoricalMarkerMode ? 40 : 48) : isHistoricalMarkerMode ? 28 : 36}
                fill={STATUS_COLORS[fire.status]}
                color={STATUS_COLORS[fire.status]}
                className={isHistoricalMarkerMode ? 'opacity-85 drop-shadow-lg' : 'animate-pulse drop-shadow-lg'}
                strokeWidth={3}
              />
            </div>
          </Marker>
        )) : null}

        {showResourceLayer && mapLayers.stations
          ? stations
              .filter((station) => typeof station.lat === 'number' && typeof station.lon === 'number')
              .map((station) => (
                <Marker
                  key={`station:${station.id}`}
                  longitude={station.lon as number}
                  latitude={station.lat as number}
                  anchor="bottom"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation();
                    setSelectedResource({
                      id: station.id,
                      label: station.name,
                      detail: station.locality || station.address || 'Cuartel',
                      status: 'operativa',
                      location: `${(station.lat as number).toFixed(3)}, ${(station.lon as number).toFixed(3)}`,
                    });
                  }}
                >
                  <ResourceMarker
                    icon={<Building2 size={16} />}
                    label={station.name}
                    detail={station.locality || 'Cuartel'}
                    tone="station"
                  />
                </Marker>
              ))
          : null}

        {showResourceLayer
          ? operationalUnits
              .filter((unit) => shouldShowUnitOnLayer(unit, mapLayers))
              .map((unit) => (
                <Marker
                  key={`unit:${unit.id}`}
                  longitude={unit.lon as number}
                  latitude={unit.lat as number}
                  anchor="bottom"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation();
                    setSelectedResource({
                      id: unit.id,
                      label: unit.name,
                      detail: `${getUnitTypeLabel(unit.type)} / ${getUnitResourceStatusLabel(unit.status)}`,
                      status: unit.status,
                      location: `${(unit.lat as number).toFixed(3)}, ${(unit.lon as number).toFixed(3)}`,
                    });
                  }}
                >
                  <ResourceMarker
                    icon={<Truck size={16} />}
                    label={unit.name}
                    detail={getUnitResourceStatusLabel(unit.status)}
                    tone={unit.status === 'available' ? 'available' : unit.status === 'assigned' ? 'assigned' : 'unavailable'}
                  />
                </Marker>
              ))
          : null}

        {showResourceLayer && mapLayers.water_assets
          ? operationalAssets
              .filter((asset) => typeof asset.lat === 'number' && typeof asset.lon === 'number')
              .map((asset) => (
                <Marker
                  key={`asset:${asset.id}`}
                  longitude={asset.lon as number}
                  latitude={asset.lat as number}
                  anchor="bottom"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation();
                    setSelectedResource({
                      id: asset.id,
                      label: asset.name,
                      detail: `${getAssetTypeLabel(asset.type)} / ${asset.status}`,
                      status: asset.status,
                      location: `${(asset.lat as number).toFixed(3)}, ${(asset.lon as number).toFixed(3)}`,
                    });
                  }}
                >
                  <ResourceMarker
                    icon={asset.type === 'water_source' || asset.type === 'water_tank' ? <Droplets size={16} /> : <Building2 size={16} />}
                    label={asset.name}
                    detail={`${getAssetTypeLabel(asset.type)} / ${asset.status}`}
                    tone={asset.type === 'water_source' || asset.type === 'water_tank' ? 'water' : 'station'}
                  />
                </Marker>
              ))
          : null}

        {measurementPoints.map(([lon, lat], index) => (
          <Marker key={`${lon}:${lat}:${index}`} longitude={lon} latitude={lat} anchor="center">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-950 text-[10px] font-bold text-amber-200">
              {index + 1}
            </div>
          </Marker>
        ))}
      </Map>

      <div className={`absolute z-50 ${isMinimalChrome ? 'right-4 top-4' : 'left-4 top-4'}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTools((value) => !value)}
            title="Herramientas"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-800 bg-slate-950/92 text-slate-100 shadow-lg backdrop-blur transition-colors hover:bg-slate-900"
          >
            <Wrench size={18} />
          </button>
          <button
            type="button"
            onClick={togglePrecipitationLayer}
            title="Mostrar precipitación y tormentas"
            aria-pressed={showPrecipitationLayer}
            className={`flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-lg backdrop-blur transition-colors ${
              showPrecipitationLayer
                ? 'border-sky-300 bg-sky-500 text-slate-950 hover:bg-sky-400'
                : 'border-slate-800 bg-slate-950/92 text-slate-100 hover:bg-slate-900'
            }`}
          >
            <CloudRain size={18} />
            <span className="hidden sm:inline">Tormentas</span>
          </button>
        </div>

        {showTools ? (
          <div className="mt-2 w-56 rounded-md border border-slate-800 bg-slate-950/94 p-2 text-white shadow-[0_18px_50px_rgba(2,6,23,0.5)] backdrop-blur">
            <div className="mb-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Herramientas
            </div>
            <div className="space-y-1">
              <ToolMenuButton
                active={isSelectingLocation}
                icon={<MapPinPlus size={16} />}
                label={isSelectingLocation ? 'Elegir ubicacion' : 'Reportar foco'}
                onClick={() => {
                  setMeasurementMode(null);
                  setMeasurementPoints([]);
                  setIsSelectingLocation((value) => !value);
                }}
              />
              <ToolMenuButton
                active={measurementMode === 'line'}
                icon={<Ruler size={16} />}
                label="Medir distancia"
                onClick={() => {
                  setIsSelectingLocation(false);
                  setMeasurementMode((value) => (value === 'line' ? null : 'line'));
                  setMeasurementPoints([]);
                }}
              />
              <ToolMenuButton
                active={measurementMode === 'polygon'}
                icon={<Pentagon size={16} />}
                label="Medir area"
                onClick={() => {
                  setIsSelectingLocation(false);
                  setMeasurementMode((value) => (value === 'polygon' ? null : 'polygon'));
                  setMeasurementPoints([]);
                }}
              />
              <ToolMenuButton
                active={showWindLayer}
                icon={<Wind size={16} />}
                label="Mapa de viento"
                onClick={() => setShowWindLayer((value) => !value)}
              />
              <ToolMenuButton
                active={showPrecipitationLayer}
                icon={<CloudRain size={16} />}
                label="Precipitación satelital"
                onClick={togglePrecipitationLayer}
              />
              <ToolMenuLink
                href={SMN_RADAR_URL}
                icon={<CloudRain size={16} />}
                label="Radar de tormentas SMN"
              />
              <ToolMenuButton
                active={showThermalLayer}
                icon={<ThermometerSun size={16} />}
                label="Capa termica"
                onClick={() => setShowThermalLayer((value) => !value)}
              />
              <ToolMenuButton
                active={mapLayers.lightning}
                icon={<CloudLightning size={16} />}
                label="Rayos GOES-19"
                onClick={() => setMapLayers((layers) => ({ ...layers, lightning: !layers.lightning }))}
              />
              <ToolMenuButton
                active={mapLayers.earthquakes}
                icon={<Activity size={16} />}
                label="Sismos"
                onClick={() => setMapLayers((layers) => ({ ...layers, earthquakes: !layers.earthquakes }))}
              />
              <ToolMenuButton
                active={mapLayers.fires}
                icon={<Flame size={16} />}
                label="Focos"
                onClick={() => setMapLayers((layers) => ({ ...layers, fires: !layers.fires }))}
              />
              <ToolMenuButton
                active={showResourceLayer}
                icon={<Truck size={16} />}
                label="Recursos"
                onClick={() => setShowResourceLayer((value) => !value)}
              />
              {showResourceLayer ? (
                <div className="space-y-1 border-l border-slate-800 pl-2">
                  <ToolMenuButton active={mapLayers.stations} icon={<Building2 size={16} />} label="Cuarteles" onClick={() => setMapLayers((layers) => ({ ...layers, stations: !layers.stations }))} />
                  <ToolMenuButton active={mapLayers.available_units} icon={<Truck size={16} />} label="Moviles disponibles" onClick={() => setMapLayers((layers) => ({ ...layers, available_units: !layers.available_units }))} />
                  <ToolMenuButton active={mapLayers.assigned_units} icon={<Radio size={16} />} label="Moviles asignados" onClick={() => setMapLayers((layers) => ({ ...layers, assigned_units: !layers.assigned_units }))} />
                  <ToolMenuButton active={mapLayers.machinery} icon={<Wrench size={16} />} label="Maquinaria" onClick={() => setMapLayers((layers) => ({ ...layers, machinery: !layers.machinery }))} />
                  <ToolMenuButton active={mapLayers.water_assets} icon={<Droplets size={16} />} label="Agua y activos" onClick={() => setMapLayers((layers) => ({ ...layers, water_assets: !layers.water_assets }))} />
                </div>
              ) : null}
              {showThermalLayer ? (
                <div className="px-3 py-1 text-[11px] text-slate-500">
                  {thermalLayer.isFetching
                    ? 'Cargando calor...'
                    : thermalLayer.isError
                      ? 'Capa termica no disponible'
                      : `${thermalAnomalies.length} anomalías térmicas`}
                </div>
              ) : null}
              {showWindLayer ? (
                <div className="px-3 py-1 text-[11px] text-slate-500">
                  {windLayer.isFetching
                    ? 'Cargando viento...'
                    : windLayer.isError
                      ? 'Viento no disponible'
                      : `${visibleWindPoints.length} vectores interpolados`}
                </div>
              ) : null}
              {showPrecipitationLayer ? (
                <div className="px-3 py-1 text-[11px] text-slate-500">
                  {precipitationLayer.isFetching
                    ? 'Leyendo hora del dato...'
                    : precipitationLayer.data?.observedAt
                      ? `IMERG · ${formatCompactTime(precipitationLayer.data.observedAt)}`
                      : 'La imagen continúa disponible sin hora de referencia'}
                </div>
              ) : null}
              {mapLayers.lightning ? (
                <div className="px-3 py-1 text-[11px] text-slate-500">
                  {lightningLayer.isFetching
                    ? 'Cargando rayos...'
                    : lightningLayer.isError
                      ? 'Rayos no disponibles'
                      : `${lightningLayer.data?.count || 0} destellos recientes`}
                </div>
              ) : null}
              {mapLayers.earthquakes ? (
                <div className="px-3 py-1 text-[11px] text-slate-500">
                  {earthquakesLayer.isFetching
                    ? 'Cargando sismos...'
                    : earthquakesLayer.isError
                      ? 'Sismos no disponibles'
                      : `${earthquakes.length} sismos en 7 dias`}
                </div>
              ) : null}
              {measurementMode ? (
                <ToolMenuButton
                  icon={<X size={16} />}
                  label="Limpiar medicion"
                  onClick={() => {
                    setMeasurementMode(null);
                    setMeasurementPoints([]);
                  }}
                />
              ) : null}
              {toolsSlot ? <div className="border-t border-slate-800 pt-1">{toolsSlot}</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      {showWindLayer ? (
        <div className="absolute right-4 top-16 z-40 w-[19rem] rounded-md border border-cyan-900/60 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Wind size={14} className="flex-shrink-0 text-sky-300" />
              <span className="truncate font-semibold">Viento táctico 10 m</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {windLayer.isFetching ? '...' : windLayer.isError ? 'error' : `${visibleWindPoints.length}`}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded border border-slate-800/80 bg-slate-900/60 px-2 py-2">
            <WindMetric label="Prom." value={formatWindMetric(windLayer.data?.summary.averageSpeedKmh)} />
            <WindMetric label="Max." value={formatWindMetric(windLayer.data?.summary.maxSpeedKmh)} />
            <WindMetric label="Racha" value={formatWindMetric(windLayer.data?.summary.maxGustKmh)} />
          </div>
          <WindDirection directionFromDeg={windLayer.data?.summary.dominantDirectionDeg} />
          <div className="mt-2 grid grid-cols-5 gap-1 text-[10px] font-semibold text-slate-300">
            {WIND_LEGEND_STEPS.map((step) => (
              <div key={step.label} className="min-w-0">
                <div className="mb-1 h-1 rounded-full" style={{ backgroundColor: step.color }} />
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 truncate text-[11px] text-slate-500">
            {windLayer.data?.summary.observedAt ? `Dato ${formatCompactTime(windLayer.data.summary.observedAt)}` : windLayer.data?.source || 'Open-Meteo'}
          </p>
        </div>
      ) : null}

      {showThermalLayer ? (
        <div className="absolute right-4 top-[12.4rem] z-40 w-[18rem] rounded-md border border-orange-900/70 bg-slate-950/88 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ThermometerSun size={14} className="flex-shrink-0 text-orange-300" />
              <span className="truncate font-semibold">Anomalias termicas</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {thermalLayer.isFetching ? '...' : thermalLayer.isError ? 'error' : thermalAnomalies.length}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] font-semibold text-slate-300">
            {[
              ['Baja', '#facc15'],
              ['Media', '#fb923c'],
              ['Alta', '#ef4444'],
              ['Extrema', '#f8fafc'],
            ].map(([label, color]) => (
              <div key={label} className="min-w-0">
                <div className="mb-1 h-1 rounded-full" style={{ backgroundColor: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showPrecipitationLayer ? (
        <div className="absolute bottom-10 right-4 z-40 w-[19rem] max-w-[calc(100%-2rem)] rounded-md border border-sky-800/70 bg-slate-950/92 px-3 py-3 text-xs text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <CloudRain size={15} className="flex-shrink-0 text-sky-300" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-100">Precipitación satelital</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">NASA GPM IMERG</div>
              </div>
            </div>
            <span className="whitespace-nowrap text-[11px] text-slate-400">
              {precipitationLayer.isFetching
                ? 'Actualizando...'
                : precipitationLayer.data?.observedAt
                  ? formatCompactTime(precipitationLayer.data.observedAt)
                  : 'Sin hora'}
            </span>
          </div>
          <div
            className="mt-3 h-2 rounded-full border border-white/10"
            style={{ background: 'linear-gradient(90deg, #00764e 0%, #c3e400 28%, #ffb004 48%, #ff3430 68%, #740000 100%)' }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0,1</span>
            <span>1</span>
            <span>5</span>
            <span>10</span>
            <span>≥53 mm/h</span>
          </div>
          <p className="mt-2 leading-4 text-slate-400">
            Estimación cada 30 min · resolución aproximada de 10 km · demora cercana a 4 h.
          </p>
          <p className="mt-1 leading-4 text-slate-500">
            Si no aparecen colores, no hay precipitación estimada desde 0,1 mm/h en el área visible.
          </p>
        </div>
      ) : null}

      {isSelectingLocation ? (
        <div className="pointer-events-none absolute inset-0 z-40 animate-pulse border-2 border-yellow-400 opacity-50" />
      ) : null}

      {!isMinimalChrome ? (
        <div className="absolute bottom-4 left-4 z-50 rounded-lg border border-orange-500/50 bg-slate-900/95 p-3 text-white shadow-xl backdrop-blur-sm">
          <div className="mb-2 text-sm font-bold">Leyenda</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <Flame size={16} fill={STATUS_COLORS.unconfirmed} color={STATUS_COLORS.unconfirmed} strokeWidth={2} />
              <span>Sin confirmar</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={16} fill={STATUS_COLORS.probable} color={STATUS_COLORS.probable} strokeWidth={2} />
              <span>Probable</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={16} fill={STATUS_COLORS.confirmed} color={STATUS_COLORS.confirmed} strokeWidth={2} />
              <span>Confirmado</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={16} fill={STATUS_COLORS.extinguished} color={STATUS_COLORS.extinguished} strokeWidth={2} />
              <span>Extinguido</span>
            </div>
          </div>
        </div>
      ) : null}

      {measurementMode ? (
        <div className="absolute bottom-28 left-4 right-4 z-50 rounded-md border border-amber-500/50 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 shadow-xl backdrop-blur-sm sm:bottom-4 sm:left-auto sm:right-20 sm:max-w-sm">
          <div className="mb-1 font-semibold text-amber-200">
            {measurementMode === 'line' ? 'Medicion de distancia' : 'Medicion de superficie'}
          </div>
          <div className="text-xs text-slate-400">
            {measurementPoints.length < 2
              ? 'Marca puntos sobre el mapa.'
              : measurementMode === 'line'
                ? `${measureDistanceKm(measurementPoints).toFixed(2)} km`
                : `${measurePolygonAreaHa(measurementPoints).toFixed(2)} ha aprox. / perimetro ${measureDistanceKm(closeRing(measurementPoints)).toFixed(2)} km`}
          </div>
        </div>
      ) : null}

      {selectedResource ? (
        <div className="absolute bottom-4 left-4 z-50 w-[min(22rem,calc(100%-2rem))] rounded-lg border border-slate-800 bg-slate-950/94 p-3 text-sm text-slate-100 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{selectedResource.label}</div>
              <div className="mt-1 text-xs text-slate-400">{selectedResource.detail}</div>
              <div className="mt-2 text-xs text-slate-300">{selectedResource.location}</div>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              onClick={() => setSelectedResource(null)}
              aria-label="Cerrar recurso"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildMeasurementGeoJson(mode: 'line' | 'polygon' | null, points: Array<[number, number]>) {
  const coordinates = mode === 'polygon' && points.length > 2 ? closeRing(points) : points;
  if (mode === 'polygon' && points.length > 2) {
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
      properties: {},
    };
  }
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {},
  };
}

function buildThermalGeoJson(anomalies: ThermalAnomaly[]) {
  return {
    type: 'FeatureCollection',
    features: anomalies.map((anomaly) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [anomaly.lon, anomaly.lat],
      },
      properties: {
        id: anomaly.id,
        source: anomaly.source,
        layer: anomaly.layer,
        satellite: anomaly.satellite,
        intensity: anomaly.intensity,
        frp: anomaly.frp || 0,
        ts: anomaly.ts,
      },
    })),
  };
}

function closeRing(points: Array<[number, number]>) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return points;
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

function measureDistanceKm(points: Array<[number, number]>) {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    total += haversineKm(points[index - 1], points[index]);
  }
  return total;
}

function haversineKm(left: [number, number], right: [number, number]) {
  const earthRadiusKm = 6371;
  const lat1 = toRad(left[1]);
  const lat2 = toRad(right[1]);
  const deltaLat = toRad(right[1] - left[1]);
  const deltaLon = toRad(right[0] - left[0]);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function measurePolygonAreaHa(points: Array<[number, number]>) {
  if (points.length < 3) return 0;
  const ring = closeRing(points);
  const centerLat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const kmPerDegreeLon = 111.32 * Math.cos(toRad(centerLat));
  const kmPerDegreeLat = 110.57;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * kmPerDegreeLon * (y2 * kmPerDegreeLat) - x2 * kmPerDegreeLon * (y1 * kmPerDegreeLat);
  }
  return Math.abs(area / 2) * 100;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function WindVector({ point, zoom }: { point: WindGridPoint; zoom: number }) {
  const speed = point.windSpeedKmh;
  const color = getWindColor(speed);
  const length = Math.min(27, Math.max(14, 11 + speed * 0.28));
  const strokeWidth = Math.min(2.8, Math.max(1.4, 1.1 + speed / 34));
  const animationDuration = Math.max(1.2, 2.7 - speed / 38);
  const showLabel = shouldLabelWindVector(point, zoom);

  return (
    <div className="pointer-events-none relative flex h-10 w-10 items-center justify-center">
      <svg
        width="40"
        height="40"
        viewBox="-20 -20 40 40"
        aria-hidden="true"
        className="drop-shadow-[0_2px_3px_rgba(2,6,23,0.85)]"
        style={{
          transform: `rotate(${getWindFlowDirection(point.windDirectionDeg)}deg)`,
          opacity: Math.min(0.95, Math.max(0.62, 0.55 + speed / 90)),
        }}
      >
        <g className="wind-vector-motion" style={{ animationDuration: `${animationDuration}s` }}>
          <line x1={-length / 2} y1="0" x2={length / 2 - 4} y2="0" stroke="#020617" strokeWidth={strokeWidth + 2.4} strokeLinecap="round" />
          <path
            d={`M ${length / 2 - 5} -4 L ${length / 2} 0 L ${length / 2 - 5} 4`}
            fill="none"
            stroke="#020617"
            strokeWidth={strokeWidth + 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1={-length / 2} y1="0" x2={length / 2 - 4} y2="0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path
            d={`M ${length / 2 - 5} -4 L ${length / 2} 0 L ${length / 2 - 5} 4`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      {showLabel ? (
        <span className="absolute left-1/2 top-[1.95rem] -translate-x-1/2 rounded border border-slate-800 bg-slate-950/90 px-1 text-[9px] font-semibold leading-4 text-slate-100 shadow">
          {Math.round(speed)} · {getWindDestination(point.windDirectionDeg).abbreviation}
        </span>
      ) : null}
    </div>
  );
}

function WindMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="truncate text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function WindDirection({ directionFromDeg }: { directionFromDeg?: number | null }) {
  if (typeof directionFromDeg !== 'number') {
    return (
      <div className="mt-2 flex items-center justify-between rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Dirección</span>
        <span className="font-semibold text-slate-400">s/d</span>
      </div>
    );
  }

  const destination = getWindDestination(directionFromDeg);

  return (
    <div className="mt-2 flex items-center justify-between rounded border border-sky-900/60 bg-sky-950/35 px-2 py-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-300/70">Dirección dominante</span>
      <span className="flex items-center gap-1.5 font-semibold text-sky-100">
        <ArrowUp
          size={14}
          aria-hidden="true"
          className="text-sky-300"
          style={{ transform: `rotate(${getWindFlowDirection(directionFromDeg)}deg)` }}
        />
        Hacia {destination.label}
      </span>
    </div>
  );
}

function formatWindMetric(value?: number | null) {
  return typeof value === 'number' ? `${Math.round(value)} km/h` : 's/d';
}

function formatCompactTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function ResourceMarker({
  icon,
  label,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  tone: 'station' | 'water' | 'available' | 'assigned' | 'unavailable';
}) {
  const toneClass =
    tone === 'station'
      ? 'border-cyan-300 bg-cyan-950/90 text-cyan-100'
      : tone === 'water'
        ? 'border-blue-300 bg-blue-950/90 text-blue-100'
      : tone === 'available'
        ? 'border-emerald-300 bg-emerald-950/90 text-emerald-100'
        : tone === 'assigned'
          ? 'border-amber-300 bg-amber-950/90 text-amber-100'
          : 'border-slate-300 bg-slate-950/90 text-slate-100';

  return (
    <div className={`min-w-32 rounded-md border px-2 py-1 shadow-lg backdrop-blur ${toneClass}`} title={`${label} / ${detail}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <strong className="max-w-28 truncate text-[11px]">{label}</strong>
      </div>
      <div className="mt-0.5 truncate text-[10px] opacity-80">{detail}</div>
    </div>
  );
}

type MapResourcePreview = {
  id: string;
  label: string;
  detail: string;
  status: string;
  location: string;
};

function shouldShowUnitOnLayer(unit: OperationalUnit, layers: Record<MapLayerKey, boolean>) {
  if (typeof unit.lat !== 'number' || typeof unit.lon !== 'number') return false;
  if (unit.type === 'machinery') return layers.machinery;
  if (unit.status === 'available') return layers.available_units;
  if (unit.status === 'assigned') return layers.assigned_units;
  return false;
}

function getAssetTypeLabel(type: string) {
  switch (type) {
    case 'water_tank':
      return 'Cisterna / tanque';
    case 'water_source':
      return 'Agua';
    case 'helipad':
      return 'Helipunto';
    case 'station':
      return 'Base';
    case 'staging':
      return 'Punto espera';
    case 'access_point':
      return 'Acceso';
    default:
      return type;
  }
}

function getUnitTypeLabel(type: string) {
  switch (type) {
    case 'engine':
      return 'Autobomba';
    case 'tanker':
      return 'Camion cisterna';
    case 'brush_truck':
      return 'Forestal';
    case 'pickup':
      return 'Camioneta';
    case 'machinery':
      return 'Maquinaria';
    case 'support':
      return 'Apoyo';
    case 'brigade':
      return 'Brigada';
    default:
      return type;
  }
}

function getUnitResourceStatusLabel(status: string) {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'assigned':
      return 'Asignada';
    case 'maintenance':
      return 'Mantenimiento';
    case 'unavailable':
      return 'Fuera de servicio';
    default:
      return status;
  }
}

function ToolMenuButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
        active ? 'bg-orange-600 text-white' : 'text-slate-200 hover:bg-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToolMenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
    >
      {icon}
      <span className="min-w-0 flex-1">{label}</span>
      <ExternalLink size={13} className="text-slate-500" aria-hidden="true" />
    </a>
  );
}
