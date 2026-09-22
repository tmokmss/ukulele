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

テストは実装の隣に置く。`src/core/score.ts` なら `src/core/score.test.ts`。
本番から使わないテスト専用のヘルパーだけ `src/testing/` にまとめる。

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
| 毎フレーム (60Hz) | 押さえ方の図の光り方、弦ごとの鳴り、チューナーの針 | `onFrame` → `useFrame` フック → `ref.current.style` / `setAttribute` |
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
移行で挙動が変わっていないことを見るため、`src/core/chroma.test.ts` で16コード全部を通している。

CSS は PoC からそのまま `src/styles.css` へ。ID セレクタ (`#fret`, `#spark`) だけクラスに変えた。
CSS Modules や Tailwind は入れていない。今の規模では1ファイルで足りるし、
入れるならコンポーネントが増えて実際に困ってからでいい。

例外は曲を選ぶコンボボックス (`src/components/Combobox.tsx`) で、
**shadcn/ui の Combobox と同じ組み合わせ (Radix Popover + cmdk) を直接使っている**。
絞り込み・キーボード操作・フォーカスの扱いを自前で書くと確実に粗が出るため。
ただし shadcn そのもの (Tailwind + CLI 生成) は入れなかった。
1つの部品のために Tailwind を足すと、この1枚の CSS と二重になって、
以降ずっと「どちらで書くか」を迷うことになる。見た目はここのトークンで書いてある。

## 練習するものは Timeline に集める

「進行を bpc 拍ずつ延々と繰り返す」のも「楽譜を2周して終わる」のも、
`src/core/timeline.ts` の `Timeline` (拍の上に並んだコードのスロット) に落としてから渡す。

```
buildTimeline(prog, bpc)   ┐
                           ├→ Timeline ─→ engine.start({ tl, bpm, end })
scoreTimeline(parseScore)  ┘              └→ ChordLane / Stage
```

エンジンは進行も楽譜も知らない。区間の長さは `placeSlot` で引き、
クリックのアクセントは `barBeats`、終わりは `planEnd` が返す `{ slots, beat }` で決まる。
新しい練習モード (ランダム、1コードだけ、など) を足すときも、Timeline を作る関数を1つ書けばいい。

## 一時停止とシークは、時刻を引き直して表す

練習の位置は `AudioContext.currentTime` から引いているだけなので、止めたり飛んだりしても
「いま何拍目か」を別に持ちたくない。そこで**位置を動かすこと = 拍0の時刻 (`t0`) を引き直すこと**にした。
一時停止は「止めた拍を覚えて `t0` を見ない」、再開とシークは「その拍がいまになるよう `t0` を置き直す」。

- 動き出す位置の手前 `COUNT_IN` 拍はカウントイン (`liveBeat` より前)。クリックだけ鳴らし、
  お手本も採点もしない。練習の頭が負の拍なのは、その特別な場合でしかなくなった
- 弾きかけのコードは頭まで巻き戻す。画面で見えている位置から、そのまま弾き直せる
- 飛ばしたところを「鳴らせなかった」と数えないよう、通った拍の区間を持っておく (`src/core/ranges.ts`)。
  弾き直すときは、そのコードから先の採点を捨ててから (`rewindTo`)

## 左手のモードと、右手のモード

楽譜が `strum` を持つと、Timeline に**打点** (`hits`) が乗る。
すると採点の重心が変わる。

| | コード進行の練習 | 楽譜 (ストロークあり) |
|---|---|---|
| 見るもの | 左手。コードが合っているか | 右手。拍どおりに鳴らせたか |
| オンセットの寄せ先 | いちばん近い拍 | いちばん近い打点 (`nearestHit`) |
| 採点 | コード一致・弱い弦・チェンジのズレ | 1打ごとのズレ、鳴らし漏れ、余分、強さの粒 |

コード判定をするかどうかは `canJudgeChords` が決める。クロマ用の FFT は窓が約340msあるので、
**1コードが0.5秒を切る曲では、そもそも前後が混ざって判定できない**。
その場合は `Plan.chordJudge` が false になり、`loop()` は大きい FFT を読みに行かない
(スマホでの負荷も下がる)。画面側も、そのあいだは音名まわりの表示を出さない。

不応期110msがオンセット検出の下限なので、16分を拾えるのは約135BPMまで。

チューナー (設定画面) だけは同じ大きい FFT から基本周波数を1つ拾う (`src/core/pitch.ts`)。
クロマは12音階に畳んでしまい「何Hzか」が残らないので、別の計算にしてある。
開いているあいだだけ `enableTuner()` で回す。

楽譜の JSON を読むのは `src/core/score.ts` だけ。書式は [score-format.md](score-format.md)。

楽譜そのものは**リポジトリの `songs/*.json` で管理する**。画面で打ち込むのではなく、
Claude に書かせてコミットし、アプリはタイトルで選ぶだけにした。読み込みは
`src/core/songs.ts` の `import.meta.glob` で、ビルドに同梱される
(取りに行く通信も、GitHub Pages のパスの心配も要らない)。
読めない楽譜は一覧から落ちるので、`npm test` と `npm run score` の両方で全部を通している。

## これからUIを足すとき

- **音に関わるものはエンジンに足す。** 新しい解析や採点は `TrainerEngine` にメソッドとイベントを足し、
  `EventMap` に型を書く。コンポーネントからは `on` / `onFrame` で受ける
- **毎フレーム動くものは state に載せない。** `useFrame` の中で ref 経由で DOM を触る。
  ここを間違えると音が遅れる
- **文言はコンポーネントに書かない。** `src/core/report.ts` に関数として足す。テストが書ける
- **画面は練習と設定の2つ。** 出し分けは `useHashView` (`#/settings`) だけで、ルーターは入れていない。
  練習中に触らないもの (チューニング、遅延補正、感度) は設定へ置き、練習画面は弾くことだけに使う
- **状態は `App.tsx` に集める。** いまは `useState` だけで足りている。
  画面が増えて配線が見づらくなったら `useReducer` か、エンジンのイベントを
  `useSyncExternalStore` でまとめる形に寄せる。状態管理ライブラリはまだ要らない

## まだやっていないこと

`docs/notes.md` の「次にやる候補」から引き継ぎ。

1. 実機 (スマホ + 実際のウクレレ) でのしきい値調整。フラックス値としきい値を画面に出すデバッグ表示を足すと楽
2. 遅延の自動キャリブレーション (クリック音をマイクで拾って往復遅延を測る)
3. オンセット検出を AudioWorklet に移して分解能を上げる。いまは rAF 依存で約16ms
4. PWA化、Low-G対応、コードの追加 (楽譜に書けるコードも `CHORDS` の16個に縛られている)
