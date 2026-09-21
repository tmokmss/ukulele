# ウクレレ練習

## ローカルで起動

```sh
npm install
npm run dev      # http://localhost:5173/
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + ビルド |
| `npm test` | コード判定・楽譜・タイムラインのテスト |
| `npm run score -- song.json` | 楽譜の JSON が読めるか確かめる |

開くとすぐマイクにつなぐ。マイクは HTTPS か localhost でしか使えない。

コード進行の繰り返しのほか、コード譜を JSON で貼れば曲を通して練習できる。
ストロークを書くと1打ごとに採点する。楽譜は `.claude/skills/ukulele-score/` のスキルに書かせる。

`main` に push すると GitHub Pages へ自動デプロイされる。

## 中身

- 楽譜 (コード譜) の JSON の書き方: [docs/score-format.md](docs/score-format.md)
- 設計と、PoC からの移行の判断: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- PoC 時点の設計メモ: [docs/notes.md](docs/notes.md)
- 移行前の単一HTML: [docs/legacy-poc.html](docs/legacy-poc.html)
