# ウクレレ コードチェンジ練習

クリックに合わせてコードを切り替えると、タイミングのズレと実際に鳴っている音を採点する。
マイクの音を FFT にかけ、クロマグラムをコードのテンプレートと照合している。

https://tmokmss.github.io/ukulele/

## 使う

```sh
npm install
npm run dev      # http://localhost:5173/
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + ビルド |
| `npm test` | コード判定のテスト |

マイクは HTTPS か localhost でしか使えない。マイクなしで動きを見るなら「テスト音で試す」を選ぶ。

`main` に push すると GitHub Pages へ自動デプロイされる。

## 中身

- 設計と、PoC からの移行の判断: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- PoC 時点の設計メモ: [docs/notes.md](docs/notes.md)
- 移行前の単一HTML: [docs/legacy-poc.html](docs/legacy-poc.html)
