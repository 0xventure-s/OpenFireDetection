import { useEffect, useRef } from 'react';
import { useTriggerScan } from './useFires';

const POLL_INTERVAL_MS = 10 * 60 * 1000;
const SCAN_LOCK_KEY = 'open-fire-detection:auto-scan-lock';
const SCAN_LAST_RUN_KEY = 'open-fire-detection:auto-scan-last-run';
const LOCK_TTL_MS = 2 * 60 * 1000;

export function useAutoScan(enabled = true) {
  const { isPending, mutate } = useTriggerScan();
  const pendingRef = useRef(false);

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const tick = () => {
      if (pendingRef.current || !shouldRunAutoScan()) return;
      if (!claimAutoScanLock()) return;

      pendingRef.current = true;
      window.localStorage.setItem(SCAN_LAST_RUN_KEY, String(Date.now()));
      mutate(
        { triggerType: 'polling', silent: true },
        {
          onSettled: () => {
            pendingRef.current = false;
            releaseAutoScanLock();
          },
        }
      );
    };

    const interval = window.setInterval(tick, 30 * 1000);
    tick();

    return () => window.clearInterval(interval);
  }, [enabled, mutate]);

  return { isPending };
}

export function shouldRunAutoScan(now = Date.now()) {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const rawLastRun = window.localStorage.getItem(SCAN_LAST_RUN_KEY);
  if (!rawLastRun) return true;
  const lastRun = Number(rawLastRun);
  return !Number.isFinite(lastRun) || now - lastRun >= POLL_INTERVAL_MS;
}

export function claimAutoScanLock(now = Date.now()) {
  const lock = readAutoScanLock();
  if (lock && now - lock.timestamp < LOCK_TTL_MS) return false;

  const token = `${now}:${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(SCAN_LOCK_KEY, JSON.stringify({ token, timestamp: now }));
  return readAutoScanLock()?.token === token;
}

export function releaseAutoScanLock() {
  window.localStorage.removeItem(SCAN_LOCK_KEY);
}

function readAutoScanLock(): { token: string; timestamp: number } | null {
  try {
    const value = window.localStorage.getItem(SCAN_LOCK_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as { token?: unknown; timestamp?: unknown };
    if (typeof parsed.token !== 'string' || typeof parsed.timestamp !== 'number') return null;
    return { token: parsed.token, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}
