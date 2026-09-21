import { useCallback, useEffect, useState } from 'react';

/** 画面は2つだけ。練習と設定 */
export type View = 'practice' | 'settings';

const HASH: Record<View, string> = { practice: '#/', settings: '#/settings' };

const viewOf = (hash: string): View => (hash === HASH.settings ? 'settings' : 'practice');

/**
 * 画面の出し分け。ルーターは入れず、ハッシュだけ見る。
 * スマホの「戻る」で練習画面へ帰れるように、履歴には残す。
 */
export function useHashView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() => viewOf(location.hash));

  useEffect(() => {
    const onHash = (): void => setView(viewOf(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 画面が変わったら先頭から見せる
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const go = useCallback((v: View) => {
    location.hash = HASH[v];
  }, []);

  return [view, go];
}
