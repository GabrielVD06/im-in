import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useStepCounter(active: boolean) {
  const [steps, setSteps] = useState<number | null>(null);
  const shown = useRef<number | null>(null);
  const saved = useRef(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    let alive = true;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available || !alive) {
          return;
        }
        const permission = await Pedometer.requestPermissionsAsync();
        if (!permission.granted || !alive) {
          return;
        }
        subscription = Pedometer.watchStepCount((result) => {
          const total = saved.current + Math.max(0, Math.round(result.steps));
          shown.current = total;
          setSteps(total);
        });
      } catch {
        // This phone has no step counter. The summary leaves that number empty.
      }
    })();

    return () => {
      alive = false;
      if (shown.current !== null) {
        saved.current = shown.current;
      }
      subscription?.remove();
    };
  }, [active]);

  const reset = useCallback(() => {
    saved.current = 0;
    shown.current = null;
    setSteps(null);
  }, []);

  return { steps, reset };
}
