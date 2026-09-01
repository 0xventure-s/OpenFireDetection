import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 's/d';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 's/d';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(value: Date | string | null | undefined): string {
  if (!value) return 's/d';
  const date = new Date(value);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) return 's/d';

  const diffMs = Date.now() - timestamp;
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60000);
  const suffix = diffMs >= 0 ? 'hace' : 'en';

  if (minutes < 1) return 'recien';
  if (minutes < 60) return `${suffix} ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${suffix} ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${suffix} ${days} d`;
  return formatDate(value);
}

export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
