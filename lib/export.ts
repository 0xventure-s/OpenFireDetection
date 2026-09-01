import { Fire } from '@/types';
import { formatDate } from './utils';

export function exportToCSV(fires: Fire[], filename = 'incendios-jurisdiccion.csv') {
  // CSV headers
  const headers = [
    'ID',
    'Estado',
    'Latitud',
    'Longitud',
    'Detectado',
    'Confirmado',
    'Confirmado Por',
    'Potencia (MW)',
    'Detecciones',
    'Extinguido',
  ];

  // Convert fires to CSV rows
  const rows = fires.map((fire) => {
    const frp = fire.sources?.[0]?.frp?.toFixed(1) || 'N/A';
    const detections = Array.isArray(fire.sources) ? fire.sources.length : 0;

    return [
      fire.id,
      fire.status,
      fire.lat.toFixed(6),
      fire.lon.toFixed(6),
      formatDate(fire.detectedAt),
      fire.confirmed ? 'Sí' : 'No',
      fire.confirmedBy || 'N/A',
      frp,
      detections,
      fire.status === 'extinguished' ? 'Sí' : 'No',
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportRowsToCSV(rows: Array<Record<string, unknown>>, filename: string) {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportToJSON(fires: Fire[], filename = 'incendios-jurisdiccion.json') {
  const jsonContent = JSON.stringify(fires, null, 2);

  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
