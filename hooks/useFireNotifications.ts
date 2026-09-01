import { useEffect, useRef } from 'react';
import { Fire } from '@/types';
import { toast } from 'sonner';

type FireAlertSoundStatus = 'probable' | 'confirmed';

let fireAlertAudioContext: AudioContext | null = null;

export function useFireNotifications(fires: Fire[], enabled = true) {
  const seenStatusesRef = useRef<Map<string, string>>(new Map());
  const isBootstrappedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (fires.length === 0) return;

    // Bootstrap on first non-empty dataset so existing incidents are not treated as new.
    if (!isBootstrappedRef.current) {
      for (const fire of fires) {
        seenStatusesRef.current.set(fire.id, fire.status);
      }
      isBootstrappedRef.current = true;
      return;
    }

    let alertSoundStatus: FireAlertSoundStatus | null = null;

    for (const fire of fires) {
      const previousStatus = seenStatusesRef.current.get(fire.id);
      const isNewFire = previousStatus === undefined;
      const hasStatusChange = previousStatus !== undefined && previousStatus !== fire.status;

      if ((isNewFire || hasStatusChange) && fire.status === 'confirmed') {
        const title = 'Nuevo incendio confirmado';
        const body = `Detectado en ${fire.lat.toFixed(4)} grados, ${fire.lon.toFixed(4)} grados`;
        alertSoundStatus = 'confirmed';

        toast.error(title, {
          description: body,
          duration: 10000,
        });

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/openfire-mark.svg',
            tag: `fire-${fire.id}-confirmed`,
          });
        }
      } else if ((isNewFire || hasStatusChange) && fire.status === 'probable') {
        alertSoundStatus ??= 'probable';

        toast.warning('Nuevo incendio probable', {
          description: `En ${fire.lat.toFixed(4)} grados, ${fire.lon.toFixed(4)} grados`,
          duration: 5000,
        });
      }

      seenStatusesRef.current.set(fire.id, fire.status);
    }

    if (alertSoundStatus) {
      playFireAlertSound(alertSoundStatus);
    }
  }, [fires, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const unlockAudio = () => {
      void getFireAlertAudioContext()?.resume().catch(() => undefined);
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [enabled]);
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function playFireAlertSound(status: FireAlertSoundStatus) {
  if (typeof window === 'undefined') return;

  const context = getFireAlertAudioContext();
  if (!context) return;

  const pattern =
    status === 'confirmed'
      ? [
          { frequency: 880, delay: 0, duration: 0.18 },
          { frequency: 660, delay: 0.22, duration: 0.18 },
          { frequency: 880, delay: 0.44, duration: 0.24 },
        ]
      : [
          { frequency: 620, delay: 0, duration: 0.16 },
          { frequency: 780, delay: 0.2, duration: 0.18 },
        ];

  const play = () => {
    const startAt = context.currentTime;
    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, startAt);
    masterGain.gain.exponentialRampToValueAtTime(status === 'confirmed' ? 0.22 : 0.14, startAt + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.85);
    masterGain.connect(context.destination);

    for (const note of pattern) {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const noteStart = startAt + note.delay;
      const noteEnd = noteStart + note.duration;

      oscillator.type = status === 'confirmed' ? 'square' : 'triangle';
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(1, noteStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    }

  };

  if (context.state === 'suspended') {
    void context.resume().then(play).catch(() => context.close());
    return;
  }

  play();
}

function getFireAlertAudioContext() {
  if (fireAlertAudioContext && fireAlertAudioContext.state !== 'closed') {
    return fireAlertAudioContext;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  fireAlertAudioContext = new AudioContextConstructor();
  return fireAlertAudioContext;
}
