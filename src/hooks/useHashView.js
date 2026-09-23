import { useCallback, useEffect, useState } from 'react';
const HASH = { practice: '#/', settings: '#/settings' };
const viewOf = (hash) => (hash === HASH.settings ? 'settings' : 'practice');
/**
 * 画面の出し分け。ルーターは入れず、ハッシュだけ見る。
 * スマホの「戻る」で練習画面へ帰れるように、履歴には残す。
 */
export function useHashView() {
    const [view, setView] = useState(() => viewOf(location.hash));
    useEffect(() => {
        const onHash = () => setView(viewOf(location.hash));
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);
    // 画面が変わったら先頭から見せる
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [view]);
    const go = useCallback((v) => {
        location.hash = HASH[v];
    }, []);
    return [view, go];
}
