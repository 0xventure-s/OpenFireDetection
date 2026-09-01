import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimAutoScanLock, releaseAutoScanLock, shouldRunAutoScan } from './useAutoScan';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('auto scan polling lock', () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prevents duplicate polling scans while the lock is fresh', () => {
    expect(claimAutoScanLock(1000)).toBe(true);
    expect(claimAutoScanLock(1100)).toBe(false);
    expect(claimAutoScanLock(1000 + 2 * 60 * 1000 + 1)).toBe(true);
  });

  it('respects the 10 minute polling interval and visibility checks', () => {
    expect(shouldRunAutoScan(1000)).toBe(true);
    window.localStorage.setItem('open-fire-detection:auto-scan-last-run', String(1000));

    expect(shouldRunAutoScan(1000 + 9 * 60 * 1000)).toBe(false);
    expect(shouldRunAutoScan(1000 + 10 * 60 * 1000)).toBe(true);

    vi.stubGlobal('document', { visibilityState: 'hidden' });
    expect(shouldRunAutoScan(1000 + 11 * 60 * 1000)).toBe(false);
  });

  it('releases the scan lock explicitly', () => {
    expect(claimAutoScanLock(1000)).toBe(true);
    releaseAutoScanLock();
    expect(claimAutoScanLock(1100)).toBe(true);
  });
});
