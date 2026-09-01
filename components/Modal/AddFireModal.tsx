'use client';

import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateFire } from '@/hooks/useFires';
import { isPointInJurisdiction } from '@/lib/jurisdiction';

interface AddFireModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialLat?: number;
  initialLon?: number;
}

export function AddFireModal({ onClose, onSuccess, initialLat, initialLon }: AddFireModalProps) {
  const createFire = useCreateFire();
  const [lat, setLat] = useState(initialLat ? initialLat.toFixed(6) : '');
  const [lon, setLon] = useState(initialLon ? initialLon.toFixed(6) : '');
  const [notes, setNotes] = useState('');
  const [latError, setLatError] = useState('');
  const [lonError, setLonError] = useState('');

  const validateCoordinates = (latitude: string, longitude: string) => {
    let nextLatError = '';
    let nextLonError = '';
    const parsedLat = parseFloat(latitude);
    const parsedLon = parseFloat(longitude);

    if (latitude && (Number.isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      nextLatError = 'Latitud invalida (-90 a 90)';
    }

    if (longitude && (Number.isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180)) {
      nextLonError = 'Longitud invalida (-180 a 180)';
    }

    if (!nextLatError && !nextLonError && latitude && longitude && !isPointInJurisdiction(parsedLat, parsedLon)) {
      nextLatError = 'Fuera de la jurisdicción';
      nextLonError = 'Fuera de la jurisdicción';
    }

    setLatError(nextLatError);
    setLonError(nextLonError);

    return !nextLatError && !nextLonError;
  };

  const handleSave = async () => {
    if (!validateCoordinates(lat, lon)) {
      return;
    }

    try {
      await createFire.mutateAsync({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        detectedAt: new Date().toISOString(),
        notes: notes.trim() || 'Incendio reportado manualmente',
      });
      onSuccess();
      onClose();
    } catch {
      toast.error('No se pudo agregar el incendio');
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalizacion no disponible');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude.toFixed(6);
        const nextLon = position.coords.longitude.toFixed(6);
        setLat(nextLat);
        setLon(nextLon);
        validateCoordinates(nextLat, nextLon);
      },
      () => {
        toast.error('No se pudo obtener la ubicacion');
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h3 className="text-lg font-bold text-white">Reportar incendio manualmente</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-orange-700 bg-orange-900/20 p-4 text-sm text-orange-300">
            Usa esta funcion para reportar incendios detectados visualmente o por llamadas de emergencia.
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">
              <MapPin size={16} className="mr-1 inline" />
              Coordenadas del incendio
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Latitud</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLat(value);
                    validateCoordinates(value, lon);
                  }}
                  placeholder="-27.500000"
                  className={`w-full rounded-lg border bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    latError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
                  }`}
                />
                {latError ? <p className="mt-1 text-xs text-red-400">{latError}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Longitud</label>
                <input
                  type="number"
                  step="0.000001"
                  value={lon}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLon(value);
                    validateCoordinates(lat, value);
                  }}
                  placeholder="-67.000000"
                  className={`w-full rounded-lg border bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                    lonError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
                  }`}
                />
                {lonError ? <p className="mt-1 text-xs text-red-400">{lonError}</p> : null}
              </div>
            </div>

            <button
              onClick={handleGetCurrentLocation}
              className="mt-2 text-xs text-blue-400 transition-colors hover:text-blue-300"
            >
              Usar mi ubicacion actual
            </button>

            {lat && lon ? (
              <div className="mt-3 rounded-lg border border-slate-600 bg-slate-800 p-3">
                <div className="text-xs text-slate-400">Ubicacion exacta</div>
                <div className="font-mono text-sm text-slate-200">
                  {parseFloat(lat).toFixed(6)}°, {parseFloat(lon).toFixed(6)}°
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Descripcion / notas</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej: humo visible desde Ruta 40, acceso por camino rural."
              className="h-24 w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-lg bg-slate-800 p-4 text-xs text-slate-400">
            <div className="mb-2 font-semibold text-slate-300">Informacion</div>
            <ul className="space-y-1">
              <li>- El incendio se registrara como sin confirmar.</li>
              <li>- Luego podra confirmarse, rechazarse o marcarse como extinguido.</li>
              <li>- La acción queda auditada con la guardia operativa.</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-700 p-4">
          <button
            onClick={onClose}
            disabled={createFire.isPending}
            className="flex-1 rounded-lg bg-slate-700 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={createFire.isPending || !lat || !lon}
            className="flex-1 rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {createFire.isPending ? 'Guardando...' : 'Reportar incendio'}
          </button>
        </div>
      </div>
    </div>
  );
}
