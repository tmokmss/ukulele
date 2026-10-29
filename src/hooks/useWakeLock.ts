import { useEffect } from 'react';

/**
 * active の間、画面が暗くならないようにする。
 * ほかのアプリへ切り替えるとブラウザがロックを外すので、戻ってきたら取り直す。
 * 対応していないブラウザや、電池の節約などで断られたときは何もしない。
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;

    const acquire = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (done) void l.release();
        else lock = l;
      } catch {
        // 断られたら諦める
      }
    };
    const onVisible = (): void => {
      if (lock?.released !== false) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
