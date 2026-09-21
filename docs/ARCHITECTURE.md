# 移行の方針と、これからUIを足すときの置き場所

単一HTMLの PoC (`legacy-poc.html`, 786行) を React + TypeScript + Vite に移した。
「今後UIが複雑になりうる」という前提で、**どこに何を置くか**を決めるのが移行の主目的だった。

## フレームワークの選定

| 案 | 判断 |
|---|---|
| **React + Vite + TypeScript** | 採用。情報量が多く、後から人 (や別のAI) が触りやすい。Vite は静的ビルドなので GitHub Pages にそのまま置ける |
| Svelte / SolidJS | 細かい更新が速く、このアプリの「毎フレーム値が変わる」性質には合う。ただし後述のとおり**ホットパスはフレームワークの外に出す**ので、速度差が効く場面がほぼ残らない。情報量を優先して見送り |
| Next.js | SSR も API も要らない。GitHub Pages には `output: 'export'` が要り、得るものより手間が増える |
| 素の HTML のまま | UIを足すたび `innerHTML` と `querySelector` の量が増える。PoC の時点ですでに描画と状態が絡んでいた |

ビルドは Vite、型は TypeScript、テストは Vitest。すべて Vite の設定を共有するので、設定ファイルは増えない。

## いちばん効いた判断: オーディオを React の外に出す

PoC は `requestAnimationFrame` のループが解析も DOM 更新も全部やっていた。
これをそのまま React に持ち込むと、毎フレーム `setState` が走って再レンダリングが 60fps で発生する。
音の遅れに直結するので、**解析と時間の管理は React に載せない**ことにした。

```
TrainerEngine (src/audio/engine.ts)  ← React を import していない
  ├ 毎フレーム: onFrame(cb)      → コンポーネントが ref 経由で DOM を直接書き換える
  └ 変化したとき: on(name, cb)   → React の state に載せる
```

分け方の基準はこう:

| 頻度 | 例 | 渡し方 |
|---|---|---|
| 毎フレーム (60Hz) | レベルメーター、クロマの12本のバー、押さえ方の図の光り方、「いちばん近いコード」 | `onFrame` → `useFrame` フック → `ref.current.style` / `setAttribute` |
| 秒に数回 | 拍、いまのコード、残り時間 | `on('tick')` → `setState`。値が変わったときだけ emit する |
| コード1つごと | 採点結果 | `on('result')` → `setState` |
| 練習の開始・終了 | 結果集計、記録の保存 | `on('running')` / `on('end')` → `setState` |

時刻はすべて `AudioContext.currentTime` 基準のまま。React のレンダリング周期とは無関係に動く。

`useFrame` (`src/hooks/useEngine.ts`) はコールバックを ref に持ち替えてから購読するので、
コンポーネントが再レンダリングされても購読は貼り直されない。

## PoC からの対応

| PoC | 移行後 |
|---|---|
| `CHORDS`, `TEMPL`, `PRESETS` | `src/core/chords.ts` |
| `computeChroma`, `scoreChords`, `timingClass`, `median` | `src/core/chroma.ts` (`ctx` 依存を引数 `binHz` に外出し) |
| `showFeedback`, `showSummary` の文言組み立て | `src/core/report.ts` (`describeResult` / `summarize`) |
| `store`, `S`, `saveSettings` | `src/core/storage.ts` |
| `ensureCtx`, `useMic`, `scheduler`, `detectOnset`, `startDrill`, `loop` | `src/audio/engine.ts` |
| `renderStage`, `drawFret`, `renderLive`, `renderHistory` … | `src/components/*.tsx` |
| `init()` の配線 | `src/App.tsx` |

DSP の定数 (`fftSize` 16384、オンセットの帯域 240〜1300Hz、しきい値 `fluxAvg * 2.2 + gate`、
不応期 110ms、集計開始 0.32秒、倍音の重み 640Hz〜、弱い音 16%) は**すべて PoC のまま**にしてある。
移行で挙動が変わっていないことを見るため、`test/chroma.test.ts` で16コード全部を通している。

CSS は PoC からそのまま `src/styles.css` へ。ID セレクタ (`#fret`, `#spark`) だけクラスに変えた。
CSS Modules や Tailwind は入れていない。今の規模では1ファイルで足りるし、
入れるならコンポーネントが増えて実際に困ってからでいい。

## これからUIを足すとき

- **音に関わるものはエンジンに足す。** 新しい解析や採点は `TrainerEngine` にメソッドとイベントを足し、
  `EventMap` に型を書く。コンポーネントからは `on` / `onFrame` で受ける
- **毎フレーム動くものは state に載せない。** `useFrame` の中で ref 経由で DOM を触る。
  ここを間違えると音が遅れる
- **文言はコンポーネントに書かない。** `src/core/report.ts` に関数として足す。テストが書ける
- **状態は `App.tsx` に集める。** いまは `useState` だけで足りている。
  画面が増えて配線が見づらくなったら `useReducer` か、エンジンのイベントを
  `useSyncExternalStore` でまとめる形に寄せる。状態管理ライブラリはまだ要らない

## まだやっていないこと

`docs/notes.md` の「次にやる候補」から引き継ぎ。

1. 実機 (スマホ + 実際のウクレレ) でのしきい値調整。フラックス値としきい値を画面に出すデバッグ表示を足すと楽
2. 遅延の自動キャリブレーション (クリック音をマイクで拾って往復遅延を測る)
3. オンセット検出を AudioWorklet に移して分解能を上げる。いまは rAF 依存で約16ms
4. PWA化、Low-G対応、コードの追加
