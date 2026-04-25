# 電気椅子ゲーム

電気椅子ゲームの混合戦略ナッシュ均衡を解析し、AI と対戦できる Web アプリ。

🔗 デモ: https://f-mm7.github.io/electric-chair-game/

## ゲーム概要

12 脚の椅子（番号 1〜12）を使った 2 人ゼロサム有限ゲーム。各ターンで攻撃側が椅子を 1 つ選んで電流を仕掛け、防御側も椅子を 1 つ選ぶ。一致すれば攻撃側に電流ペナルティ、不一致なら攻撃側が選んだ番号分の点数を獲得して椅子は撤去される。**40 点先取で勝利・電流 3 回で敗北**。詳細ルールは [`rule.md`](./rule.md) を参照。

## 解析

- 全到達可能盤面の評価値（プレイヤー1目線の期待値）と最適混合戦略を算出
- 状態は 32 ビット整数にハッシュ化（ターン4 / 椅子残存12 / 各点数6 / 各電流2 ビット）
- ゼロサム完全情報ゲームとして Fictitious Play で混合戦略ナッシュ均衡を計算
- 解析結果は `analysis-results/turn-{N}/strategies.json` に保存
- バッチ処理は 1000 盤面単位、ハッシュデータは事前に生成（`generate-hashes`）

## 開発

```bash
npm install

# Web アプリ
npm run dev               # 開発サーバ
npm run build             # ビルド
npm run deploy            # gh-pages へデプロイ

# 解析パイプライン
npm run generate-hashes   # ハッシュ生成（解析の前提）
npm run analyze           # 混合戦略ナッシュ均衡の計算
npm run analyze -- --status   # 進捗確認
npm run analyze -- --config   # 設定確認

# デバッグツール
npm run display-state
npm run debug-strategy
npm run debug-transition
npm run calculate-hash
```

設定は `analysis.config.json` で管理（評価値、バッチサイズ、出力先など）。

## 補足ドキュメント

- [`rule.md`](./rule.md): ゲームルールの詳細
- [`CODE_STRUCTURE.md`](./CODE_STRUCTURE.md): ディレクトリ構成・主要モジュールの役割

## 技術スタック

React / TypeScript / Vite / javascript-lp-solver
