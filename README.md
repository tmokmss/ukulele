# ウクレレ コードチェンジ練習

クリックに合わせてコードを切り替えると、**タイミングのズレ**と**実際に鳴っている音**を採点する練習アプリ。
マイクで拾った音を FFT にかけ、クロマグラム (12音階ごとのエネルギー) をコードのテンプレートと照合している。

単一 HTML の PoC (`docs/legacy-poc.html`) を React + TypeScript + Vite に移した版。
移行で何をどう判断したかは [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 、
PoC 時点の設計メモは [docs/notes.md](docs/notes.md) にある。

## 使う

```sh
npm install
npm run dev        # http://localhost:5173/
```

マイクは HTTPS か localhost でしか使えない。`npm run dev` は localhost なのでそのまま許可が下りる。
マイクなしで試したいときは「テスト音で試す」を選ぶと、合成音が自動で演奏して採点の動きを確認できる
(わざとズレ・ミュート・押さえ間違いを混ぜている)。

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド (`dist/`) |
| `npm run preview` | ビルド結果を確認する |
| `npm test` | コード判定ロジックのテスト |

## GitHub Pages に載せる

`.github/workflows/deploy.yml` が `main` への push で build → deploy まで走る。
最初の1回だけ、リポジトリ側の設定が要る。

1. GitHub にリポジトリを作って push する
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
3. `main` に push する (または Actions タブから `Deploy to GitHub Pages` を手動実行)

公開先は `https://<ユーザー名>.github.io/<リポジトリ名>/` になる。
`vite.config.ts` の `base` は `'./'` にしてあるので、リポジトリ名が何でも、独自ドメインのルート配置でもそのまま動く。

## テスト

`npm test` は、16コード全部を ±20 セントのチューニングずれ込みで判定できることを確かめる。
Blackman 窓の FFT を `test/fft.ts` で組み、`AnalyserNode.getFloatFrequencyData` と同じスケールの
スペクトルを作って `computeChroma` / `scoreChords` に通している。弦をミュートしたときに
「その弦が弱い」と出ることも見ている。

DSP の定数 (しきい値、集計区間、重みづけ) を動かすとこのテストが効かなくなる。
値を変えるときはテストの期待値もあわせて見直すこと。

## 構成

```
src/
  core/          # コードの定義、DSP、保存、文言。React にも Web Audio にも依存しない
    chords.ts      コード表とテンプレート
    chroma.ts      クロマ算出とコード照合
    report.ts      採点結果 → 日本語の文言
    storage.ts     localStorage (uke.settings, uke.history)
    types.ts
  audio/
    engine.ts    # 入力・メトロノーム・解析・採点。React に依存しない単一クラス
  hooks/
    useEngine.ts # エンジンと React をつなぐ
  components/    # 表示だけ
  App.tsx        # 状態の置き場と配線
```

## わかっている制約

- タイミングの分解能は `requestAnimationFrame` 依存で約16ms。入出力の遅延は端末ごとに違う (Bluetooth は特に大きい)
- Low-G チューニングは未対応 (解析の下限が 235Hz)
- テンポが速く1コードが1秒未満だと、集計フレームが少なく判定が不安定
- スマホは内蔵マイクとスピーカーが近く、クリック音が回り込みやすい。イヤホンを使うか、クリック音なしで画面の拍表示に合わせる
- 実マイクでのしきい値調整は未検証。感度スライダーで合わせる
