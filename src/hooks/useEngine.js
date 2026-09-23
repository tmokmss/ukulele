import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TrainerEngine } from '../audio/engine';
/** エンジンはアプリに1つ。初期設定だけ受け取り、以降の更新は setSettings で流す */
export function useEngine(settings) {
    const [engine] = useState(() => new TrainerEngine(settings));
    useEffect(() => {
        engine.setSettings(settings);
    }, [engine, settings]);
    useEffect(() => () => engine.dispose(), [engine]);
    return engine;
}
/**
 * 毎フレームの値を受け取る。ここで setState すると 60fps で再レンダリングされるので、
 * コールバックの中では ref 経由で DOM を直接書き換えること。
 */
export function useFrame(engine, cb) {
    const ref = useRef(cb);
    useLayoutEffect(() => {
        ref.current = cb;
    });
    useEffect(() => engine.onFrame((f) => ref.current(f)), [engine]);
}
